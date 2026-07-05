import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
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

// Seeds a person and an IC-track role for tests that need both.
async function seedPersonAndRole(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
) {
  const personId = await asAdmin.mutation(api.people.people.createPerson, {
    orgId,
    displayName: "Anna Svensson",
    gender: "Kvinna",
  })
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: "IC",
  })
  return { personId, roleId }
}

describe("assignPersonToRole", () => {
  it("inserts an assignment row and writes an assignment.set audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    const assignmentId = await asAdmin.mutation(
      api.people.assignments.assignPersonToRole,
      {
        orgId,
        personId,
        roleId,
        level: "IC3",
        levelSource: "confirmed",
      }
    )

    await t.run(async (ctx) => {
      const row = await ctx.db.get(assignmentId)
      expect(row).not.toBeNull()
      expect(row?.orgId).toBe(orgId)
      expect(row?.personId).toBe(personId)
      expect(row?.roleId).toBe(roleId)
      expect(row?.level).toBe("IC3")
      expect(row?.levelSource).toBe("confirmed")
      expect(row?.effectiveAt).toBeTypeOf("number")
      expect(row?.endedAt).toBeUndefined()

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "assignment.set")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const payload = auditRows[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)
      expect(payload?.roleId).toBe(roleId)
    })
  })

  it("respects an explicit effectiveAt timestamp", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    const ts = 1_700_000_000_000

    const assignmentId = await asAdmin.mutation(
      api.people.assignments.assignPersonToRole,
      {
        orgId,
        personId,
        roleId,
        level: "IC1",
        levelSource: "suggested",
        effectiveAt: ts,
      }
    )

    await t.run(async (ctx) => {
      const row = await ctx.db.get(assignmentId)
      expect(row?.effectiveAt).toBe(ts)
    })
  })

  it("rejects a level that does not belong to the role's track", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    // IC role, but M1 is a Manager-track level.
    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        level: "M1",
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidLevel/)
  })

  it("rejects an entirely unknown level string", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        level: "XYZ",
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidLevel/)
  })

  it("rejects a new assignment whose effectiveAt is <= the current open assignment's effectiveAt", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    // First assignment at t=100.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC1",
      levelSource: "confirmed",
      effectiveAt: 100,
    })

    // Re-assign at t=50 (retroactive): must be rejected because closing the
    // open row at t=50 would set endedAt(50) <= effectiveAt(100), breaking
    // the interval. Out-of-order insertion is deferred to V2-core.
    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        level: "IC2",
        levelSource: "confirmed",
        effectiveAt: 50,
      })
    ).rejects.toThrow(/errors.invalidEffectiveDate/)

    // Also reject an equal timestamp (zero-length interval is also broken).
    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        level: "IC2",
        levelSource: "confirmed",
        effectiveAt: 100,
      })
    ).rejects.toThrow(/errors.invalidEffectiveDate/)
  })

  it("closes the prior open assignment and opens a new one on re-assign", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    const ts1 = 1_700_000_000_000
    const ts2 = 1_700_000_100_000

    const first = await asAdmin.mutation(
      api.people.assignments.assignPersonToRole,
      {
        orgId,
        personId,
        roleId,
        level: "IC1",
        levelSource: "confirmed",
        effectiveAt: ts1,
      }
    )

    const second = await asAdmin.mutation(
      api.people.assignments.assignPersonToRole,
      {
        orgId,
        personId,
        roleId,
        level: "IC2",
        levelSource: "confirmed",
        effectiveAt: ts2,
      }
    )

    await t.run(async (ctx) => {
      const firstRow = await ctx.db.get(first)
      expect(firstRow?.endedAt).toBe(ts2)

      const secondRow = await ctx.db.get(second)
      expect(secondRow?.level).toBe("IC2")
      expect(secondRow?.endedAt).toBeUndefined()
    })
  })

  it("getCurrentAssignment reflects the active assignment after re-assign", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC1",
      levelSource: "suggested",
      effectiveAt: 1_700_000_000_000,
    })

    // Re-assign to IC3.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC3",
      levelSource: "confirmed",
      effectiveAt: 1_700_000_100_000,
    })

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).not.toBeNull()
    expect(current?.level).toBe("IC3")
    expect(current?.levelSource).toBe("confirmed")
    expect(current?.endedAt).toBeNull()
  })

  it("listAssignmentsForPerson returns history sorted most-recent first", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC1",
      levelSource: "suggested",
      effectiveAt: 1_700_000_000_000,
    })

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC2",
      levelSource: "confirmed",
      effectiveAt: 1_700_000_100_000,
    })

    const list = await asAdmin.query(
      api.people.assignments.listAssignmentsForPerson,
      { orgId, personId }
    )
    expect(list).toHaveLength(2)
    // Most recent (IC2) first.
    expect(list[0]?.level).toBe("IC2")
    expect(list[0]?.endedAt).toBeNull()
    expect(list[1]?.level).toBe("IC1")
    expect(list[1]?.endedAt).toBeTypeOf("number")
  })

  it("getCurrentAssignment returns null for a person with no assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await seedPersonAndRole(orgId, asAdmin)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).toBeNull()
  })
})

describe("cross-org isolation", () => {
  it("cannot assign another org's person to a role", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    // Create a person in org A.
    const personAId = await asAdminA.mutation(api.people.people.createPerson, {
      orgId: orgA,
      displayName: "Person A",
      gender: "Man",
    })

    // Create a role in org B.
    const { roleId: roleBId } = await asAdminB.mutation(
      api.assessment.roles.createRole,
      {
        orgId: orgB,
        title: "Engineer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
      }
    )

    // Org B tries to assign org A's person.
    await expect(
      asAdminB.mutation(api.people.assignments.assignPersonToRole, {
        orgId: orgB,
        personId: personAId,
        roleId: roleBId,
        level: "IC1",
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("cannot assign a person to another org's role", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    // Create a person in org B.
    const personBId = await asAdminB.mutation(api.people.people.createPerson, {
      orgId: orgB,
      displayName: "Person B",
      gender: "Kvinna",
    })

    // Create a role in org A.
    const { roleId: roleAId } = await asAdminA.mutation(
      api.assessment.roles.createRole,
      {
        orgId: orgA,
        title: "Engineer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
      }
    )

    // Org B tries to assign their person to org A's role.
    await expect(
      asAdminB.mutation(api.people.assignments.assignPersonToRole, {
        orgId: orgB,
        personId: personBId,
        roleId: roleAId,
        level: "IC1",
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("getCurrentAssignment returns null for a cross-org person id", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const { personId, roleId } = await seedPersonAndRole(orgA, asAdminA)
    await asAdminA.mutation(api.people.assignments.assignPersonToRole, {
      orgId: orgA,
      personId,
      roleId,
      level: "IC2",
      levelSource: "confirmed",
    })

    // Org B queries for org A's person: should get null, not the assignment.
    const result = await asAdminB.query(
      api.people.assignments.getCurrentAssignment,
      { orgId: orgB, personId }
    )
    expect(result).toBeNull()
  })

  it("listAssignmentsForPerson returns empty for a cross-org person id", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const { personId, roleId } = await seedPersonAndRole(orgA, asAdminA)
    await asAdminA.mutation(api.people.assignments.assignPersonToRole, {
      orgId: orgA,
      personId,
      roleId,
      level: "IC1",
      levelSource: "confirmed",
    })

    const result = await asAdminB.query(
      api.people.assignments.listAssignmentsForPerson,
      { orgId: orgB, personId }
    )
    expect(result).toHaveLength(0)
  })
})

describe("assignPeopleToRole (bulk)", () => {
  it("assigns every person in one call and writes one audit row each", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    const secondPersonId = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )

    const ids = await asAdmin.mutation(
      api.people.assignments.assignPeopleToRole,
      {
        orgId,
        assignments: [
          { personId, roleId, level: "IC2" },
          { personId: secondPersonId, roleId, level: "IC1" },
        ],
        levelSource: "confirmed",
      }
    )
    expect(ids).toHaveLength(2)

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("personAssignments")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.levelSource === "confirmed")).toBe(true)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "assignment.set")
        )
        .collect()
      expect(auditRows).toHaveLength(2)
    })
  })

  it("rejects the whole batch when one level is invalid for the role's track", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    const secondPersonId = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )

    await expect(
      asAdmin.mutation(api.people.assignments.assignPeopleToRole, {
        orgId,
        assignments: [
          { personId, roleId, level: "IC2" },
          // M1 is not a valid level on the IC track.
          { personId: secondPersonId, roleId, level: "M1" },
        ],
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidLevel/)

    // All-or-nothing: the valid first assignment must not have persisted.
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("personAssignments")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(rows).toHaveLength(0)
    })
  })
})
