import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds a minimal org with one admin member.
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
  })
  const asAdmin = t.withIdentity({ subject: userId })
  return { orgId, userId, asAdmin }
}

// Seeds a person in the given org via the public API.
async function seedPerson(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
) {
  return await asAdmin.mutation(api.people.people.createPerson, {
    orgId,
    displayName: "Anna Svensson",
    gender: "Kvinna",
  })
}

describe("setSalary", () => {
  it("appends a payRecords row with source manual and writes an audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(payRecordId)
      expect(row).not.toBeNull()
      expect(row?.orgId).toBe(orgId)
      expect(row?.personId).toBe(personId)
      expect(row?.payYear).toBe(2024)
      expect(row?.source).toBe("manual")
      expect(row?.basicMonthly).toBe(50000)
      expect(row?.currency).toBe("SEK")
      expect(row?.variable).toBeUndefined()
      expect(row?.benefitInKind).toBeUndefined()
      expect(row?.effectiveAt).toBeTypeOf("number")
      expect(row?.createdAt).toBeTypeOf("number")

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.salarySet")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const payload = auditRows[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)

      // GDPR: the audit payload must NEVER contain salary amounts.
      expect(payload?.basicMonthly).toBeUndefined()
      expect(payload?.variable).toBeUndefined()
      expect(payload?.benefitInKind).toBeUndefined()
    })
  })

  it("stores optional variable and benefitInKind when provided", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 60000,
      currency: "SEK",
      variable: 12000,
      benefitInKind: 3000,
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(payRecordId)
      expect(row?.variable).toBe(12000)
      expect(row?.benefitInKind).toBe(3000)
    })
  })

  it("respects an explicit effectiveAt timestamp", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const ts = 1_700_000_000_000

    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      effectiveAt: ts,
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(payRecordId)
      expect(row?.effectiveAt).toBe(ts)
    })
  })

  it("appends a NEW row on a second call and keeps the first (history retained)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const first = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      effectiveAt: 1_000,
    })

    const second = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      effectiveAt: 2_000,
    })

    await t.run(async (ctx) => {
      // Both rows must exist — the first is never overwritten.
      const firstRow = await ctx.db.get(first)
      expect(firstRow).not.toBeNull()
      expect(firstRow?.basicMonthly).toBe(45000)

      const secondRow = await ctx.db.get(second)
      expect(secondRow).not.toBeNull()
      expect(secondRow?.basicMonthly).toBe(50000)

      // Two distinct rows in the DB.
      expect(first).not.toBe(second)
    })
  })

  it("rejects a personId that belongs to a different org", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const personAId = await seedPerson(orgA, asAdminA)

    await expect(
      asAdminB.mutation(api.people.pay.setSalary, {
        orgId: orgB,
        personId: personAId,
        payYear: 2024,
        basicMonthly: 50000,
        currency: "SEK",
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("appendSalary (internal, import path)", () => {
  it("inserts a row with source import", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const payRecordId = await t.mutation(internal.people.pay.appendSalary, {
      orgId,
      actorId: userId,
      personId,
      payYear: 2024,
      basicMonthly: 55000,
      currency: "SEK",
      effectiveAt: 1_700_000_000_000,
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(payRecordId)
      expect(row).not.toBeNull()
      expect(row?.source).toBe("import")
      expect(row?.basicMonthly).toBe(55000)
      expect(row?.effectiveAt).toBe(1_700_000_000_000)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.salarySet")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const payload = auditRows[0]?.payload as Record<string, unknown>

      // GDPR: no salary amounts in the audit trail.
      expect(payload?.basicMonthly).toBeUndefined()
      expect(payload?.variable).toBeUndefined()
      expect(payload?.benefitInKind).toBeUndefined()
    })
  })

  it("rejects a personId that does not belong to the given orgId", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, userId: userBId } = await seedOrg(t, "hr-b@beta.se")

    const personAId = await seedPerson(orgA, asAdminA)

    await expect(
      t.mutation(internal.people.pay.appendSalary, {
        orgId: orgB,
        actorId: userBId,
        personId: personAId,
        payYear: 2024,
        basicMonthly: 50000,
        currency: "SEK",
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("getSalaryHistory", () => {
  it("returns all rows sorted by effectiveAt descending", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2022,
      basicMonthly: 40000,
      currency: "SEK",
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      effectiveAt: 3_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      effectiveAt: 2_000,
    })

    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })

    expect(history).toHaveLength(3)
    // Most recent effectiveAt first.
    expect(history[0]?.effectiveAt).toBe(3_000)
    expect(history[0]?.basicMonthly).toBe(50000)
    expect(history[1]?.effectiveAt).toBe(2_000)
    expect(history[2]?.effectiveAt).toBe(1_000)
  })

  it("returns an empty array for a person with no pay records", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    expect(history).toHaveLength(0)
  })

  it("returns empty for a cross-org person id", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const personAId = await seedPerson(orgA, asAdminA)
    await asAdminA.mutation(api.people.pay.setSalary, {
      orgId: orgA,
      personId: personAId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
    })

    const result = await asAdminB.query(api.people.pay.getSalaryHistory, {
      orgId: orgB,
      personId: personAId,
    })
    expect(result).toHaveLength(0)
  })
})

describe("getCurrentSalary", () => {
  it("returns the row with the greatest effectiveAt <= now", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    // Past records: effectiveAt well in the past.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2022,
      basicMonthly: 40000,
      currency: "SEK",
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      effectiveAt: 2_000,
    })

    const current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
    })

    expect(current).not.toBeNull()
    // Greatest effectiveAt <= now is the 2023 record (effectiveAt=2000).
    expect(current?.basicMonthly).toBe(45000)
    expect(current?.payYear).toBe(2023)
  })

  it("returns null when no pay records exist", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
    })
    expect(current).toBeNull()
  })

  it("returns null for a cross-org person id", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const personAId = await seedPerson(orgA, asAdminA)
    await asAdminA.mutation(api.people.pay.setSalary, {
      orgId: orgA,
      personId: personAId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      effectiveAt: 1_000,
    })

    const result = await asAdminB.query(api.people.pay.getCurrentSalary, {
      orgId: orgB,
      personId: personAId,
    })
    expect(result).toBeNull()
  })
})

describe("GDPR: pay.salarySet audit payload is amount-free", () => {
  it("setSalary audit row contains no basicMonthly, variable, or benefitInKind", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 99999,
      currency: "SEK",
      variable: 20000,
      benefitInKind: 5000,
    })

    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.salarySet")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>
      const changes = payload?.changes as Record<string, unknown> | undefined

      // Top-level payload must not expose amounts.
      expect(payload).not.toHaveProperty("basicMonthly")
      expect(payload).not.toHaveProperty("variable")
      expect(payload).not.toHaveProperty("benefitInKind")

      // The changes diff must not expose amounts either.
      expect(changes).not.toHaveProperty("basicMonthly")
      expect(changes).not.toHaveProperty("variable")
      expect(changes).not.toHaveProperty("benefitInKind")

      // Non-sensitive fields are captured.
      expect(changes).toHaveProperty("payYear")
      expect(changes).toHaveProperty("source")
      expect(changes).toHaveProperty("currency")
    })
  })

  it("appendSalary audit row contains no salary amounts", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await t.mutation(internal.people.pay.appendSalary, {
      orgId,
      actorId: userId,
      personId,
      payYear: 2024,
      basicMonthly: 88888,
      currency: "EUR",
      variable: 15000,
      benefitInKind: 2000,
    })

    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.salarySet")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>
      const changes = payload?.changes as Record<string, unknown> | undefined

      expect(payload).not.toHaveProperty("basicMonthly")
      expect(payload).not.toHaveProperty("variable")
      expect(payload).not.toHaveProperty("benefitInKind")
      expect(changes).not.toHaveProperty("basicMonthly")
      expect(changes).not.toHaveProperty("variable")
      expect(changes).not.toHaveProperty("benefitInKind")
    })
  })
})
