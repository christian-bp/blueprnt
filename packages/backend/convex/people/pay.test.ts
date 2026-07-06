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
      components: [],
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
      expect(row?.components).toEqual([])
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
      expect(payload?.components).toBeUndefined()
    })
  })

  it("stores components when provided and round-trips them correctly", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const inputComponents = [
      { kind: "variable", monthlyAmount: 1000 },
      { kind: "benefitInKind", monthlyAmount: 500 },
    ]

    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 60000,
      currency: "SEK",
      components: inputComponents,
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(payRecordId)
      expect(row?.components).toEqual(inputComponents)
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
      components: [],
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
      components: [],
      effectiveAt: 1_000,
    })

    const second = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
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
        components: [],
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("appendSalary (internal, import path)", () => {
  it("inserts a row with source import", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const { payRecordId, created } = await t.mutation(
      internal.people.pay.appendSalary,
      {
        orgId,
        actorId: userId,
        personId,
        payYear: 2024,
        basicMonthly: 55000,
        currency: "SEK",
        components: [],
        effectiveAt: 1_700_000_000_000,
      }
    )
    expect(created).toBe(true)

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
      expect(payload?.components).toBeUndefined()
    })
  })

  it("skips an append identical to the latest record, appends a changed one", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const base = {
      orgId,
      actorId: userId,
      personId,
      payYear: 2026,
      basicMonthly: 55000,
      currency: "SEK",
      components: [{ kind: "targetBonus", monthlyAmount: 1000 }],
    }
    const first = await t.mutation(internal.people.pay.appendSalary, base)
    expect(first.created).toBe(true)

    // Identical re-import: no duplicate row, no extra audit entry.
    const dup = await t.mutation(internal.people.pay.appendSalary, base)
    expect(dup.created).toBe(false)
    expect(dup.payRecordId).toBe(first.payRecordId)

    // A changed value still appends (real pay history).
    const raised = await t.mutation(internal.people.pay.appendSalary, {
      ...base,
      basicMonthly: 57500,
    })
    expect(raised.created).toBe(true)

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(rows).toHaveLength(2)
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
        components: [],
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
      components: [],
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [{ kind: "variable", monthlyAmount: 2000 }],
      effectiveAt: 3_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      components: [],
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
    // Derived totalMonthlyComp: 50000 + 2000.
    expect(history[0]?.totalMonthlyComp).toBe(52000)
    expect(history[1]?.effectiveAt).toBe(2_000)
    // No components: totalMonthlyComp equals basicMonthly.
    expect(history[1]?.totalMonthlyComp).toBe(45000)
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
      components: [],
    })

    const result = await asAdminB.query(api.people.pay.getSalaryHistory, {
      orgId: orgB,
      personId: personAId,
    })
    expect(result).toHaveLength(0)
  })
})

describe("getCurrentSalary", () => {
  it("returns the row with the greatest effectiveAt <= asOf", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2022,
      basicMonthly: 40000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      components: [{ kind: "bonus", monthlyAmount: 3000 }],
      effectiveAt: 2_000,
    })

    // asOf=3_000: both records are <= asOf, so the 2023 record wins.
    const current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
      asOf: 3_000,
    })

    expect(current).not.toBeNull()
    expect(current?.basicMonthly).toBe(45000)
    expect(current?.payYear).toBe(2023)
    // Derived totalMonthlyComp: 45000 + 3000.
    expect(current?.totalMonthlyComp).toBe(48000)
  })

  it("excludes a record whose effectiveAt is strictly after asOf", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })
    // This record is future-dated relative to the asOf we will use below.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 60000,
      currency: "SEK",
      components: [],
      effectiveAt: 5_000,
    })

    // asOf=2_000 precedes the 2024 record (effectiveAt=5_000), so only the
    // 2023 record qualifies.
    const current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
      asOf: 2_000,
    })

    expect(current).not.toBeNull()
    expect(current?.basicMonthly).toBe(45000)
    expect(current?.payYear).toBe(2023)
    expect(current?.totalMonthlyComp).toBe(45000)
  })

  it("returns null when no pay records exist", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
      asOf: Date.now(),
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
      components: [],
      effectiveAt: 1_000,
    })

    const result = await asAdminB.query(api.people.pay.getCurrentSalary, {
      orgId: orgB,
      personId: personAId,
      asOf: Date.now(),
    })
    expect(result).toBeNull()
  })
})

describe("GDPR: pay.salarySet audit payload is amount-free", () => {
  it("setSalary audit row contains no basicMonthly or components amounts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 99999,
      currency: "SEK",
      components: [
        { kind: "variable", monthlyAmount: 20000 },
        { kind: "benefitInKind", monthlyAmount: 5000 },
      ],
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
      expect(payload).not.toHaveProperty("components")
      expect(payload).not.toHaveProperty("totalMonthlyComp")

      // The changes diff must not expose amounts either.
      expect(changes).not.toHaveProperty("basicMonthly")
      expect(changes).not.toHaveProperty("components")
      expect(changes).not.toHaveProperty("totalMonthlyComp")

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
      components: [
        { kind: "variable", monthlyAmount: 15000 },
        { kind: "benefitInKind", monthlyAmount: 2000 },
      ],
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
      expect(payload).not.toHaveProperty("components")
      expect(payload).not.toHaveProperty("totalMonthlyComp")
      expect(changes).not.toHaveProperty("basicMonthly")
      expect(changes).not.toHaveProperty("components")
      expect(changes).not.toHaveProperty("totalMonthlyComp")
    })
  })
})

describe("deleteSalary", () => {
  it("hard-deletes the record and writes an amount-free audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    await asAdmin.mutation(api.people.pay.deleteSalary, {
      orgId,
      payRecordId,
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get(payRecordId)).toBeNull()

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.salaryDeleted")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const payload = auditRows[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)
      const changes = payload?.changes as Record<
        string,
        { from: unknown; to: unknown }
      >
      expect(changes?.payYear).toEqual({ from: 2024, to: null })
      // GDPR: never the amounts.
      expect(changes).not.toHaveProperty("basicMonthly")
    })
  })

  it("rejects a cross-org payRecordId", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { orgId: otherOrgId, asAdmin: asOtherAdmin } = await seedOrg(
      t,
      "hr@other.se"
    )
    const personId = await seedPerson(orgId, asAdmin)
    const payRecordId = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    await expect(
      asOtherAdmin.mutation(api.people.pay.deleteSalary, {
        orgId: otherOrgId,
        payRecordId,
      })
    ).rejects.toThrow()

    // The record survives the failed cross-org attempt.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(payRecordId)).not.toBeNull()
    })
  })
})

describe("getSalaryHistory role/level join", () => {
  it("joins each record to the assignment active at its effective time", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const { roleId: engineerId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Software Engineer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
      }
    )
    const { roleId: managerId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Engineering Manager",
        function: "Engineering",
        team: "Platform",
        trackKey: "M",
      }
    )

    // Timeline: engineer from t=1000, salary at t=1500, promoted to manager
    // at t=2000 (closes the engineer assignment), raise at t=2500.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: engineerId,
      level: "IC3",
      levelSource: "confirmed",
      effectiveAt: 1000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2025,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: 1500,
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: managerId,
      level: "M2",
      levelSource: "confirmed",
      effectiveAt: 2000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basicMonthly: 60000,
      currency: "SEK",
      components: [],
      effectiveAt: 2500,
    })

    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    // Most recent first: the raise under the manager assignment, then the
    // old salary under the (now closed) engineer assignment.
    expect(history).toHaveLength(2)
    expect(history[0]?.assignment).toEqual({ roleId: managerId, level: "M2" })
    expect(history[1]?.assignment).toEqual({ roleId: engineerId, level: "IC3" })
  })

  it("returns a null assignment for a record that predates all assignments", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })

    // Salary imported/entered before the person was ever classified.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2025,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: 500,
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC1",
      levelSource: "confirmed",
      effectiveAt: 1000,
    })

    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    expect(history[0]?.assignment).toBeNull()
  })
})
