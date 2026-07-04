import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Read the anonymized test fixture once at module load time. Using an absolute
// path derived from import.meta.dirname keeps the test runnable from any cwd.
const FIXTURE_PATH = join(
  import.meta.dirname,
  "__fixtures__",
  "import-testfil.csv"
)
const FIXTURE_CSV = readFileSync(FIXTURE_PATH, "utf8")

// columnMap is string[][] (array of [sourceHeader, canonicalFieldKey] pairs)
// because Convex forbids non-ASCII characters in v.record() object field names
// at serialization time. Swedish CSV headers like "Månadslön" and "Födelsedatum"
// would fail the ASCII field-name check if passed as Record keys.

// Full mapping: every header in the fixture CSV. The " Valuta " header includes
// its surrounding spaces exactly as tokenizeCsv returns it.
const FULL_COLUMN_MAP: string[][] = [
  ["Anstallningsdatum", "employmentStartDate"],
  ["Fornamn", "firstName"],
  ["Efternamn", "lastName"],
  ["Chef", "isManager"],
  ["Kon", "gender"],
  ["Land", "country"],
  ["Löneår", "payYear"],
  ["Födelsedatum", "birthDate"],
  ["Befattning", "title"],
  ["Statistikkod", "statisticalCode"],
  ["Månadslön", "basicMonthly"],
  ["Tjänstebil", "benefitInKind"],
  ["Målbonus", "variable"],
  [" Valuta ", "currency"],
  ["Anstnr", "externalRef"],
  ["Sysselssättningsgrad", "ftePercent"],
]

// Minimal map missing basicMonthly — used for the blocking case.
const MISSING_BASIC_MONTHLY_MAP: string[][] = [
  ["Anstnr", "externalRef"],
  ["Kon", "gender"],
  // basicMonthly intentionally absent
]

// Seeds a minimal org with one admin member and returns helpers for calling
// functions as that admin.
async function seedOrg(
  t: ReturnType<typeof initConvexTest>,
  email = "hr@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
    })
    // Seed a users mirror row so logAudit can resolve the actorName snapshot.
    await ctx.db.insert("users", {
      authId: userId,
      name: "HR Person",
      email,
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  return { orgId, userId, asAdmin }
}

// ---------------------------------------------------------------------------
// Happy-path: full import with the real fixture CSV
// ---------------------------------------------------------------------------

describe("importPayroll (happy path)", () => {
  it("imports good rows, skips the two Anstnr=114 rows, sets employeeCount, saves mapping profile, and audits with counts only", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
      effectiveAt: Date.now(),
    })

    // Top-level shape.
    expect(result.ok).toBe(true)

    // The fixture has 118 data rows; 2 are skipped (both Anstnr=114 rows:
    // Torsten Malm row 57 and Ludvig Palm row 94 both get duplicateId;
    // Torsten also gets nonNumericCode for "Software Developer").
    expect(result.skippedRows).toBe(2)
    expect(result.peopleImported).toBe(116)
    expect(result.salariesImported).toBe(116)

    // No blocking issues on a complete mapping.
    expect(result.validation.blocking).toHaveLength(0)

    await t.run(async (ctx) => {
      // All 116 good people are in the DB.
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(116)

      // All 116 pay records are in the DB.
      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(pays).toHaveLength(116)

      // employeeCount is set to the imported active count.
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(org?.employeeCount).toBe(116)

      // The mapping profile was saved.
      const profile = await ctx.db
        .query("importMappingProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(profile).not.toBeNull()
      // Profile stores canonicalFieldKey -> sourceHeader; spot-check a few.
      expect(profile?.columnMap.externalRef).toBe("Anstnr")
      expect(profile?.columnMap.gender).toBe("Kon")

      // The import.completed audit row carries counts only (no PII, no salary).
      const importAudit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "people.imported")
        )
        .collect()
      expect(importAudit).toHaveLength(1)

      const auditPayload = importAudit[0]?.payload as Record<string, unknown>
      expect(auditPayload.peopleImported).toBe(116)
      expect(auditPayload.salariesImported).toBe(116)
      expect(auditPayload.skippedRows).toBe(2)

      // No PII in the audit payload.
      expect(auditPayload).not.toHaveProperty("displayName")
      expect(auditPayload).not.toHaveProperty("basicMonthly")
      expect(auditPayload).not.toHaveProperty("gender")
    })
  })

  it("parses Swedish gender values correctly (Man/Kvinna)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()

      // Every imported person has a valid gender value.
      for (const p of people) {
        expect(["Man", "Kvinna"]).toContain(p.gender)
      }

      // Check a known person: Nils Sjödin (Anstnr=63) should be "Man".
      const nils = people.find((p) => p.externalRef === "63")
      expect(nils).toBeDefined()
      expect(nils?.gender).toBe("Man")
      expect(nils?.displayName).toBe("Nils Sjödin")
    })
  })

  it("parses pay correctly: basicMonthly, currency, and components", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      // Nils Sjödin (Anstnr=63): "94 500 kr" basic, Tjänstebil=5000, Målbonus=100000.
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const nils = people.find((p) => p.externalRef === "63")
      if (nils === undefined) throw new Error("Nils Sjödin not found")

      const nilsPayRecords = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", nils._id)
        )
        .collect()
      expect(nilsPayRecords).toHaveLength(1)

      const pay = nilsPayRecords[0]
      if (pay === undefined) throw new Error("pay record not found")
      expect(pay.basicMonthly).toBe(94500)
      expect(pay.currency).toBe("SEK")
      expect(pay.payYear).toBe(2026)

      // Components: benefitInKind=5000, variable=100000.
      const benefitComp = pay.components.find((c) => c.kind === "benefitInKind")
      const variableComp = pay.components.find((c) => c.kind === "variable")
      expect(benefitComp?.monthlyAmount).toBe(5000)
      expect(variableComp?.monthlyAmount).toBe(100000)
    })
  })

  it("skips exactly the two Anstnr=114 rows and no others", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    // Exactly 2 rows skipped.
    expect(result.skippedRows).toBe(2)

    // Per-row issues: both Anstnr=114 rows get duplicateId;
    // Torsten Malm (UX Developer) also gets nonNumericCode.
    const duplicateIssues = result.validation.issues.filter(
      (i) => i.code === "duplicateId"
    )
    expect(duplicateIssues).toHaveLength(2)

    const nonNumericIssues = result.validation.issues.filter(
      (i) => i.code === "nonNumericCode"
    )
    expect(nonNumericIssues).toHaveLength(1)
    expect(nonNumericIssues[0]?.detail).toContain("Software Developer")

    // Neither skipped person should be in the DB.
    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const refs = people.map((p) => p.externalRef)
      expect(refs).not.toContain("114")
    })
  })

  it("re-import is idempotent: upserts update existing people and add a new pay record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    // First import.
    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    // Second import with the same CSV.
    const result2 = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result2.ok).toBe(true)
    expect(result2.peopleImported).toBe(116)

    await t.run(async (ctx) => {
      // Still 116 people (upsert, not double-insert).
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(116)

      // Each person gets a second pay record (appendSalary always inserts).
      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(pays).toHaveLength(232)
    })
  })
})

// ---------------------------------------------------------------------------
// Blocking case: required field unmapped -> nothing persisted
// ---------------------------------------------------------------------------

describe("importPayroll (blocking validation)", () => {
  it("returns ok:false and persists nothing when basicMonthly is not mapped", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: MISSING_BASIC_MONTHLY_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(false)
    expect(result.peopleImported).toBe(0)
    expect(result.salariesImported).toBe(0)
    expect(result.validation.blocking).toContain("basicMonthly")

    // Nothing written to the DB.
    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(0)

      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(pays).toHaveLength(0)

      const importAudit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "people.imported")
        )
        .collect()
      expect(importAudit).toHaveLength(0)
    })
  })

  it("returns ok:false when externalRef is not mapped", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      // Only basicMonthly and gender: externalRef is absent.
      columnMap: [
        ["Månadslön", "basicMonthly"],
        ["Kon", "gender"],
      ],
      payYear: 2026,
    })

    expect(result.ok).toBe(false)
    expect(result.validation.blocking).toContain("externalRef")

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

describe("importPayroll (auth)", () => {
  it("throws when called without authentication", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t)

    await expect(
      t.action(api.people.import.importPayroll, {
        orgId,
        csvText: FIXTURE_CSV,
        columnMap: FULL_COLUMN_MAP,
        payYear: 2026,
      })
    ).rejects.toThrow()
  })
})
