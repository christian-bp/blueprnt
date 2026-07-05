import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const BLANK_GENDER_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "blank-gender.csv"),
  "utf8"
)

// Read the anonymized test fixture once at module load time. Using an absolute
// path derived from import.meta.dirname keeps the test runnable from any cwd.
const FIXTURE_PATH = join(
  import.meta.dirname,
  "__fixtures__",
  "import-testfil.csv"
)
const FIXTURE_CSV = readFileSync(FIXTURE_PATH, "utf8")

// Binary fixture: a ZIP/XLSX magic-byte sequence that tokenizeCsv rejects.
// Read as latin1 so each raw byte is preserved as its corresponding code point
// (UTF-8 decoding would mangle high bytes in the binary sequence).
const BINARY_INPUT = readFileSync(
  join(import.meta.dirname, "__fixtures__", "binary.bin"),
  "latin1"
)

const PERSONEC_FRACTION_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "personec-fraction.csv"),
  "utf8"
)
const SAP_NUMERIC_GENDER_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "sap-numeric-gender.csv"),
  "utf8"
)

const DATE_FORMS_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "date-forms.csv"),
  "utf8"
)

const DATE_FORMS_MAP: string[][] = [
  ["Id", "externalRef"],
  ["Fornamn", "firstName"],
  ["Kon", "gender"],
  ["Manadslon", "basicMonthly"],
  ["Befattning", "title"],
  ["Fodelsedatum", "birthDate"],
]

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
    expect(result.peopleCreated).toBe(116)
    expect(result.peopleUpdated).toBe(0)
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
      expect(auditPayload.peopleCreated).toBe(116)
      expect(auditPayload.peopleUpdated).toBe(0)
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
      (i: { code: string }) => i.code === "duplicateId"
    )
    expect(duplicateIssues).toHaveLength(2)

    const nonNumericIssues = result.validation.issues.filter(
      (i: { code: string }) => i.code === "nonNumericCode"
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
    expect(result2.peopleCreated).toBe(0)
    expect(result2.peopleUpdated).toBe(116)

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
    expect(result.peopleCreated).toBe(0)
    expect(result.salariesImported).toBe(0)
    expect(result.skippedRows).toBe(0)
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

  it("blocking return has ok:false, zero counts, and skippedRows:0 (not rows.length)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    // MISSING_BASIC_MONTHLY_MAP omits basicMonthly, which is a required field.
    // The fixture has 118 data rows, but none should be reflected in skippedRows
    // because the import was blocked before any row was processed.
    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: MISSING_BASIC_MONTHLY_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(false)
    expect(result.peopleCreated).toBe(0)
    expect(result.salariesImported).toBe(0)
    expect(result.skippedRows).toBe(0)
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

// ---------------------------------------------------------------------------
// Row-skip triage: soft issues must not skip rows
// ---------------------------------------------------------------------------

const PERSONEC_COLUMN_MAP: string[][] = [
  ["Ansattnr", "externalRef"],
  ["Fornavn", "firstName"],
  ["Etternavn", "lastName"],
  ["Kjønn", "gender"],
  ["Grunnlønn", "basicMonthly"],
  ["Fødselsdato", "birthDate"],
  ["Stillingsprosent", "ftePercent"],
  ["Stilling", "title"],
]

const SAP_COLUMN_MAP: string[][] = [
  ["PERNR", "externalRef"],
  ["PLANS", "title"],
  ["GESCH", "gender"],
  ["ANSAL", "basicMonthly"],
]

describe("importPayroll (row-skip triage)", () => {
  it("does NOT skip fraction-FTE rows (fractionScaled is a soft issue)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: PERSONEC_FRACTION_CSV,
      columnMap: PERSONEC_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(true)
    // Both rows carry fractionScaled + ambiguousDate (soft issues) but no hard
    // issue. Neither row should be skipped.
    expect(result.skippedRows).toBe(0)
    expect(result.peopleCreated).toBe(2)
    expect(result.salariesImported).toBe(2)
  })

  it("does NOT skip numeric-gender rows (SAP GESCH 1/2)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: SAP_NUMERIC_GENDER_CSV,
      columnMap: SAP_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(true)
    expect(result.skippedRows).toBe(0)
    expect(result.peopleCreated).toBe(2)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(2)

      const p1 = people.find((p) => p.externalRef === "00010001")
      const p2 = people.find((p) => p.externalRef === "00010002")
      expect(p1?.gender).toBe("Man")
      expect(p2?.gender).toBe("Kvinna")
    })
  })
})

// ---------------------------------------------------------------------------
// Fraction FTE scaling: fractional column (0,8 / 1,0) -> stored as 80 / 100
// ---------------------------------------------------------------------------

describe("importPayroll (fraction FTE)", () => {
  it("scales a fractional ftePercent column x100 (0,8 -> 80, 1,0 -> 100)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: PERSONEC_FRACTION_CSV,
      columnMap: PERSONEC_COLUMN_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const ola = people.find((p) => p.externalRef === "N1")
      const kari = people.find((p) => p.externalRef === "N2")
      expect(ola?.ftePercent).toBe(80) // "0,8" scaled x100
      expect(kari?.ftePercent).toBe(100) // "1,0" scaled x100
    })
  })

  it("does NOT scale a normal-percent ftePercent column (80 stays 80, 100 stays 100)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    // The happy-path fixture has Sysselssättningsgrad mapped to ftePercent.
    // All values are whole percents (e.g. 100), so fteIsFraction is false.
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
      // Every ftePercent that was stored must be in [0, 100] — not 80x100=8000.
      for (const p of people) {
        if (p.ftePercent !== undefined) {
          expect(p.ftePercent).toBeGreaterThanOrEqual(0)
          expect(p.ftePercent).toBeLessThanOrEqual(100)
        }
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Date form expansion: compact YYYYMMDD, Excel serial, short personnummer, ISO
// ---------------------------------------------------------------------------

describe("importPayroll (date forms)", () => {
  it("parses compact, Excel-serial, short-personnummer, and ISO birth dates", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: DATE_FORMS_CSV,
      columnMap: DATE_FORMS_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const byRef = (ref: string) => people.find((p) => p.externalRef === ref)

      expect(byRef("E1")?.birthDate).toBe("1987-05-12") // compact YYYYMMDD
      expect(byRef("E2")?.birthDate).toBe("2023-01-01") // Excel serial 44927
      expect(byRef("E3")?.birthDate).toBe("1987-05-12") // short personnummer + refYear 2026
      expect(byRef("E4")?.birthDate).toBe("1990-11-03") // plain ISO
    })
  })
})

// ---------------------------------------------------------------------------
// Title field: Befattning column is persisted on the person
// ---------------------------------------------------------------------------

describe("importPayroll (title field)", () => {
  it("persists the mapped Befattning column as the person title", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: DATE_FORMS_CSV,
      columnMap: DATE_FORMS_MAP,
    })
    expect(result.ok).toBe(true)
    expect(result.peopleCreated).toBeGreaterThan(0)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Every imported row in the DATE_FORMS fixture has a non-empty Befattning,
      // so every upserted person must carry a title string.
      expect(people.length).toBeGreaterThan(0)
      for (const person of people) {
        expect(typeof person.title).toBe("string")
        expect((person.title ?? "").length).toBeGreaterThan(0)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Binary / file-level guard: binary input returns ok:false, does not throw
// ---------------------------------------------------------------------------

describe("importPayroll (binary / file-level guard)", () => {
  it("returns ok:false with invalidFileFormat instead of throwing on a binary file", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BINARY_INPUT,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(false)
    expect(result.peopleCreated).toBe(0)
    expect(result.validation.blocking).toContain("invalidFileFormat")
    expect(result.validation.fileFormatError).toBe("invalidFileFormat")

    // Nothing persisted.
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
// Gender overrides: wizard-supplied Man/Kvinna for blank-gender rows
// ---------------------------------------------------------------------------

const BLANK_GENDER_MAP: string[][] = [
  ["Id", "externalRef"],
  ["Fornamn", "firstName"],
  ["Kon", "gender"],
  ["Manadslon", "basicMonthly"],
  ["Befattning", "title"],
]

describe("importPayroll (gender overrides)", () => {
  it("imports a blank-gender row when a matching override is supplied", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BLANK_GENDER_CSV,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      genderOverrides: [["G2", "Kvinna"]],
    })

    expect(result.ok).toBe(true)
    expect(result.peopleCreated).toBe(2)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const frida = people.find((p) => p.externalRef === "G2")
      expect(frida?.gender).toBe("Kvinna")
    })
  })

  it("skips the blank-gender row when no override is supplied", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BLANK_GENDER_CSV,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      // no genderOverrides
    })

    expect(result.ok).toBe(true)
    // G2 has unresolvedGender (HARD) so it is skipped; only G1 imports.
    expect(result.peopleCreated).toBe(1)
    expect(result.skippedRows).toBe(1)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people.map((p) => p.externalRef)).not.toContain("G2")
    })
  })

  it("ignores an invalid override value and still skips the row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BLANK_GENDER_CSV,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      // "Unknown" is not a valid override value; the row stays skipped.
      genderOverrides: [["G2", "Unknown"]],
    })

    expect(result.ok).toBe(true)
    expect(result.peopleCreated).toBe(1)
    expect(result.skippedRows).toBe(1)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people.map((p) => p.externalRef)).not.toContain("G2")
    })
  })

  it("still skips a row that has a gender override AND a duplicateId issue", async () => {
    // CSV: G1 is unique; G2 appears twice (Frida with explicit gender, Anna with
    // blank gender). validateImport flags duplicateId on BOTH G2 rows (first
    // occurrence is also flagged when a duplicate is detected). The second G2
    // (Anna) additionally has unresolvedGender. A genderOverrides entry for G2
    // covers unresolvedGender, but duplicateId is still a HARD issue on both
    // rows, so neither G2 row imports. Only G1 should be imported.
    const dupCsv =
      "Id,Fornamn,Kon,Manadslon,Befattning\nG1,Erik,Man,45000,Developer\nG2,Frida,Kvinna,47000,Designer\nG2,Anna,,48000,Analyst\n"
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: dupCsv,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      // G2 (row 2, Anna) has both duplicateId AND unresolvedGender;
      // the override covers unresolvedGender but duplicateId is still HARD,
      // so that row stays skipped. G2 (row 1, Frida) also has duplicateId,
      // so it is skipped too. Only G1 imports.
      genderOverrides: [["G2", "Kvinna"]],
    })

    expect(result.ok).toBe(true)
    // Only G1 imports; both G2 rows are skipped due to duplicateId.
    expect(result.peopleCreated).toBe(1)
    expect(result.skippedRows).toBe(2)
  })
})

describe("import progress (live counts for the importing screen)", () => {
  it("setImportProgress upserts one row per org and clearImportProgress removes it", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t)

    await t.mutation(internal.people.importHelpers.setImportProgress, {
      orgId,
      processed: 0,
      total: 118,
    })
    await t.mutation(internal.people.importHelpers.setImportProgress, {
      orgId,
      processed: 50,
      total: 118,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("importProgress").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.processed).toBe(50)
      expect(rows[0]?.total).toBe(118)
    })

    await t.mutation(internal.people.importHelpers.clearImportProgress, {
      orgId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.query("importProgress").collect()).toHaveLength(0)
    })
  })

  it("importPayroll leaves no progress row behind after completion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: FIXTURE_CSV,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
      effectiveAt: Date.now(),
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.query("importProgress").collect()).toHaveLength(0)
    })
  })
})
