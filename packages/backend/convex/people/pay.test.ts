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
  const { personId } = await asAdmin.mutation(api.people.people.createPerson, {
    orgId,
    displayName: "Anna Svensson",
    gender: "Kvinna",
  })
  return personId
}

// Seeds a role and assigns the given person to it at the given seniority.
async function seedRoleWithAssignment(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  personId: Awaited<ReturnType<typeof seedPerson>>,
  seniority = "IC3"
) {
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: "IC",
  })
  await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId,
    roleId,
    seniority,
    senioritySource: "confirmed",
  })
  return roleId
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
      basis: "monthly",
      basicAmount: 50000,
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
      expect(row?.basis).toBe("monthly")
      expect(row?.basicAmount).toBe(50000)
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
      expect(payload?.basicAmount).toBeUndefined()
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
      basis: "monthly",
      basicAmount: 60000,
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
      basis: "monthly",
      basicAmount: 45000,
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
      basis: "monthly",
      basicAmount: 45000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })

    const second = await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: 2_000,
    })

    await t.run(async (ctx) => {
      // Both rows must exist — the first is never overwritten.
      const firstRow = await ctx.db.get(first)
      expect(firstRow).not.toBeNull()
      expect(firstRow?.basicAmount).toBe(45000)

      const secondRow = await ctx.db.get(second)
      expect(secondRow).not.toBeNull()
      expect(secondRow?.basicAmount).toBe(50000)

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
        basis: "monthly",
        basicAmount: 50000,
        currency: "SEK",
        components: [],
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects a currency other than the org's own", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    // The org's currency is SEK (seedOrg); EUR must be refused, not stored.
    await expect(
      asAdmin.mutation(api.people.pay.setSalary, {
        orgId,
        personId,
        payYear: 2026,
        basis: "monthly",
        basicAmount: 50000,
        currency: "EUR",
        components: [],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects negative amounts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await expect(
      asAdmin.mutation(api.people.pay.setSalary, {
        orgId,
        personId,
        payYear: 2026,
        basis: "monthly",
        basicAmount: 50000,
        currency: "SEK",
        components: [{ kind: "variable", monthlyAmount: -100 }],
      })
    ).rejects.toThrow(/errors.invalidInput/)
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
        basis: "monthly",
        basicAmount: 55000,
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
      expect(row?.basis).toBe("monthly")
      expect(row?.basicAmount).toBe(55000)
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
      expect(payload?.basicAmount).toBeUndefined()
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
      basis: "monthly" as const,
      basicAmount: 55000,
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
      basicAmount: 57500,
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
        basis: "monthly",
        basicAmount: 50000,
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
      basis: "monthly",
      basicAmount: 40000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [{ kind: "variable", monthlyAmount: 2000 }],
      effectiveAt: 3_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basis: "monthly",
      basicAmount: 45000,
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
      basis: "monthly",
      basicAmount: 50000,
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
      basis: "monthly",
      basicAmount: 40000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basis: "monthly",
      basicAmount: 45000,
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
      basis: "monthly",
      basicAmount: 45000,
      currency: "SEK",
      components: [],
      effectiveAt: 1_000,
    })
    // This record is future-dated relative to the asOf we will use below.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basis: "monthly",
      basicAmount: 60000,
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
      basis: "monthly",
      basicAmount: 50000,
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
  it("setSalary audit row contains no basicAmount or components amounts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basis: "monthly",
      basicAmount: 99999,
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
      const changes = payload?.changes as
        | Record<string, { from: unknown; to: unknown }>
        | undefined

      // Top-level payload must not expose amounts.
      expect(payload?.basicAmount).toBeUndefined()
      expect(payload).not.toHaveProperty("basicAmount")
      expect(payload).not.toHaveProperty("components")
      expect(payload).not.toHaveProperty("totalMonthlyComp")

      // The changes diff must not expose amounts either.
      expect(changes).not.toHaveProperty("basicAmount")
      expect(changes).not.toHaveProperty("components")
      expect(changes).not.toHaveProperty("totalMonthlyComp")

      // Non-sensitive fields are captured, basis (coded) included.
      expect(changes).toHaveProperty("payYear")
      expect(changes).toHaveProperty("source")
      expect(changes).toHaveProperty("currency")
      expect(changes?.basis?.to).toBe("monthly")
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
      basis: "monthly",
      basicAmount: 88888,
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
      const changes = payload?.changes as
        | Record<string, { from: unknown; to: unknown }>
        | undefined

      expect(payload?.basicAmount).toBeUndefined()
      expect(payload).not.toHaveProperty("basicAmount")
      expect(payload).not.toHaveProperty("components")
      expect(payload).not.toHaveProperty("totalMonthlyComp")
      expect(changes).not.toHaveProperty("basicAmount")
      expect(changes).not.toHaveProperty("components")
      expect(changes).not.toHaveProperty("totalMonthlyComp")
      expect(changes?.basis?.to).toBe("monthly")
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
      basis: "monthly",
      basicAmount: 50000,
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
      expect(changes?.basis).toEqual({ from: "monthly", to: null })
      // GDPR: never the amounts.
      expect(changes).not.toHaveProperty("basicAmount")
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
      basis: "monthly",
      basicAmount: 50000,
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

describe("getSalaryHistory role/seniority join", () => {
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
      seniority: "IC3",
      senioritySource: "confirmed",
      effectiveAt: 1000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2025,
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: 1500,
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: managerId,
      seniority: "M2",
      senioritySource: "confirmed",
      effectiveAt: 2000,
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 60000,
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
    expect(history[0]?.assignment).toEqual({
      roleId: managerId,
      seniority: "M2",
    })
    expect(history[1]?.assignment).toEqual({
      roleId: engineerId,
      seniority: "IC3",
    })
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
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: 500,
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC1",
      senioritySource: "confirmed",
      effectiveAt: 1000,
    })

    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    expect(history[0]?.assignment).toBeNull()
  })
})

describe("getRolePayComparison", () => {
  it("returns unclassified when the person has no active assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    expect(result).toEqual({ status: "unclassified" })
  })

  it("returns noSalary when classified but without any pay record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await seedRoleWithAssignment(orgId, asAdmin, personId)

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    expect(result).toEqual({ status: "noSalary" })
  })

  it("returns identified points with the FTE-adjusted basic/variable split", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRoleWithAssignment(orgId, asAdmin, personId)

    // Peer on the same role at 80% FTE: 40000 basic + 0 components
    // grosses up to 50000. senioritySource "suggested" must still count.
    const { personId: peerId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Berg", gender: "Man", ftePercent: 80 }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: peerId,
      roleId,
      seniority: "IC2",
      senioritySource: "suggested",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: peerId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 40000,
      currency: "SEK",
      components: [],
    })

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 55000,
      currency: "SEK",
      components: [{ kind: "variable", monthlyAmount: 5000 }],
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.currency).toBe("SEK")
    expect(result.excludedCount).toBe(0)
    expect(result.points).toHaveLength(2)

    const self = result.points.find((p) => p.isSelf)
    const peer = result.points.find((p) => !p.isSelf)
    // Self: full time, basic 55000 + variable 5000 = 60000.
    expect(self).toMatchObject({
      displayName: "Anna Svensson",
      gender: "Kvinna",
      seniority: "IC3",
      basic: 55000,
      variable: 5000,
      amount: 60000,
      payYear: 2026,
      isSelf: true,
    })
    expect(self?.publicId).toBeTypeOf("string")
    // Peer: 80% FTE grosses 40000 basic to 50000, no variable; suggested
    // seniority still counts.
    expect(peer).toMatchObject({
      displayName: "Bo Berg",
      gender: "Man",
      seniority: "IC2",
      basic: 50000,
      variable: 0,
      amount: 50000,
      payYear: 2026,
      isSelf: false,
    })

    // The contract shape: identity + gender (the chart's coloring lens) + the
    // FTE-adjusted split + pay year, and NOTHING else (no internal id).
    for (const point of result.points) {
      expect(Object.keys(point).sort()).toEqual([
        "amount",
        "basic",
        "displayName",
        "gender",
        "isSelf",
        "payYear",
        "publicId",
        "seniority",
        "variable",
      ])
    }
  })

  it("computes the hourly point without FTE division, beside a monthly peer's own division", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRoleWithAssignment(orgId, asAdmin, personId)
    await t.run(async (ctx) => {
      await ctx.db.patch(personId, { ftePercent: 50 })
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "hourly",
      basicAmount: 195,
      currency: "SEK",
      components: [],
    })

    const { personId: peerId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Berg", gender: "Man", ftePercent: 80 }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: peerId,
      roleId,
      seniority: "IC2",
      senioritySource: "confirmed",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: peerId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 40000,
      currency: "SEK",
      components: [],
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    const self = result.points.find((p) => p.isSelf)
    const peer = result.points.find((p) => !p.isSelf)
    // Hourly: 195 x 165h (se country default) = 32175, no FTE division.
    expect(self?.amount).toBe(32175)
    // Monthly peer: 40000 grossed up from 80% FTE.
    expect(peer?.amount).toBe(50000)
  })

  it("uses each person's latest payYear record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await seedRoleWithAssignment(orgId, asAdmin, personId)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basis: "monthly",
      basicAmount: 40000,
      currency: "SEK",
      components: [],
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 48000,
      currency: "SEK",
      components: [],
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.points[0]?.amount).toBe(48000)
  })

  it("excludes other-currency peers with a count and skips archived peers", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRoleWithAssignment(orgId, asAdmin, personId)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [],
    })

    // Peer paid in EUR: excluded, counted.
    const { personId: eurPeer } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Eva Euro", gender: "Kvinna" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: eurPeer,
      roleId,
      seniority: "IC2",
      senioritySource: "confirmed",
    })
    // Insert the EUR record directly: setSalary now rejects any currency other
    // than the org's, so a non-org currency can only reach the DB via a
    // non-setSalary path (legacy/import data). This simulates exactly that.
    await t.run(async (ctx) => {
      await ctx.db.insert("payRecords", {
        orgId,
        personId: eurPeer,
        payYear: 2026,
        source: "import",
        basis: "monthly",
        basicAmount: 4000,
        currency: "EUR",
        components: [],
        effectiveAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
      })
    })

    // Archived peer: skipped silently (not part of the active population).
    const { personId: archivedPeer } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Ola Old", gender: "Man" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: archivedPeer,
      roleId,
      seniority: "IC4",
      senioritySource: "confirmed",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: archivedPeer,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 70000,
      currency: "SEK",
      components: [],
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(archivedPeer, { archivedAt: 1_700_000_000_000 })
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.excludedCount).toBe(1)
    expect(result.points).toHaveLength(1)
    expect(result.points[0]?.isSelf).toBe(true)
  })

  it("is org-isolated: another org's caller gets unclassified", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "a@a.se")
    const personId = await seedPerson(orgA, asAdminA)
    await seedRoleWithAssignment(orgA, asAdminA, personId)

    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "b@b.se")
    const result = await asAdminB.query(api.people.pay.getRolePayComparison, {
      orgId: orgB,
      personId,
    })
    expect(result).toEqual({ status: "unclassified" })
  })
})

describe("hourly pay", () => {
  it("derives the monthly figure from the org's country default when nothing else is set", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t) // country se -> 165 h
    const personId = await seedPerson(orgId, asAdmin)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "hourly",
      basicAmount: 195,
      currency: "SEK",
      components: [],
    })
    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    expect(history[0]).toMatchObject({
      basis: "hourly",
      basicAmount: 195,
      basicMonthly: 32175,
      totalMonthlyComp: 32175,
      hoursPerMonth: 165,
    })
  })

  it("uses the organization default over the country, and the person's value over both", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "hourly",
      basicAmount: 200,
      currency: "SEK",
      components: [],
    })
    await t.run(async (ctx) => {
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (org) await ctx.db.patch(org._id, { fullTimeHoursPerMonth: 160 })
    })
    let current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
      asOf: Date.now() + 1000,
    })
    expect(current).toMatchObject({
      basicMonthly: 32000,
      hoursPerMonth: 160,
    })

    await t.run(async (ctx) => {
      await ctx.db.patch(personId, { fullTimeHoursPerMonth: 150 })
    })
    current = await asAdmin.query(api.people.pay.getCurrentSalary, {
      orgId,
      personId,
      asOf: Date.now() + 1000,
    })
    expect(current).toMatchObject({
      basicMonthly: 30000,
      hoursPerMonth: 150,
    })
  })

  it("rejects a negative amount at the validator", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await expect(
      asAdmin.mutation(api.people.pay.setSalary, {
        orgId,
        personId,
        payYear: 2026,
        basis: "hourly",
        basicAmount: -1,
        currency: "SEK",
        components: [],
      })
    ).rejects.toThrow()
  })

  it("getPayDefaults names the currency and the resolved hours", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    expect(
      await asAdmin.query(api.people.pay.getPayDefaults, { orgId, personId })
    ).toEqual({ currency: "SEK", hoursPerMonth: 165 })
  })

  it("a basis change with the same figure is a real new record, not a duplicate", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, userId } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const first = await t.mutation(internal.people.pay.appendSalary, {
      orgId,
      actorId: userId,
      personId,
      payYear: 2026,
      basis: "monthly",
      basicAmount: 195,
      currency: "SEK",
      components: [],
    })
    const second = await t.mutation(internal.people.pay.appendSalary, {
      orgId,
      actorId: userId,
      personId,
      payYear: 2026,
      basis: "hourly",
      basicAmount: 195,
      currency: "SEK",
      components: [],
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(true)
  })
})
