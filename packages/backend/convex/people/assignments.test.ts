import { MAX_ASSIGNMENTS_PER_MUTATION } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
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
  const { personId } = await asAdmin.mutation(api.people.people.createPerson, {
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
        seniority: "IC3",
        senioritySource: "confirmed",
      }
    )

    await t.run(async (ctx) => {
      const row = await ctx.db.get(assignmentId)
      expect(row).not.toBeNull()
      expect(row?.orgId).toBe(orgId)
      expect(row?.personId).toBe(personId)
      expect(row?.roleId).toBe(roleId)
      expect(row?.seniority).toBe("IC3")
      expect(row?.senioritySource).toBe("confirmed")
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
        seniority: "IC1",
        senioritySource: "suggested",
        effectiveAt: ts,
      }
    )

    await t.run(async (ctx) => {
      const row = await ctx.db.get(assignmentId)
      expect(row?.effectiveAt).toBe(ts)
    })
  })

  it("rejects a seniority that does not belong to the role's track", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    // IC role, but M1 is a Manager-track seniority.
    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        seniority: "M1",
        senioritySource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidSeniority/)
  })

  it("rejects an entirely unknown seniority string", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        seniority: "XYZ",
        senioritySource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidSeniority/)
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
      seniority: "IC1",
      senioritySource: "confirmed",
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
        seniority: "IC2",
        senioritySource: "confirmed",
        effectiveAt: 50,
      })
    ).rejects.toThrow(/errors.invalidEffectiveDate/)

    // Also reject an equal timestamp (zero-length interval is also broken).
    await expect(
      asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        seniority: "IC2",
        senioritySource: "confirmed",
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
        seniority: "IC1",
        senioritySource: "confirmed",
        effectiveAt: ts1,
      }
    )

    const second = await asAdmin.mutation(
      api.people.assignments.assignPersonToRole,
      {
        orgId,
        personId,
        roleId,
        seniority: "IC2",
        senioritySource: "confirmed",
        effectiveAt: ts2,
      }
    )

    await t.run(async (ctx) => {
      const firstRow = await ctx.db.get(first)
      expect(firstRow?.endedAt).toBe(ts2)

      const secondRow = await ctx.db.get(second)
      expect(secondRow?.seniority).toBe("IC2")
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
      seniority: "IC1",
      senioritySource: "suggested",
      effectiveAt: 1_700_000_000_000,
    })

    // Re-assign to IC3.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC3",
      senioritySource: "confirmed",
      effectiveAt: 1_700_000_100_000,
    })

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).not.toBeNull()
    expect(current?.seniority).toBe("IC3")
    expect(current?.senioritySource).toBe("confirmed")
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
      seniority: "IC1",
      senioritySource: "suggested",
      effectiveAt: 1_700_000_000_000,
    })

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC2",
      senioritySource: "confirmed",
      effectiveAt: 1_700_000_100_000,
    })

    const list = await asAdmin.query(
      api.people.assignments.listAssignmentsForPerson,
      { orgId, personId }
    )
    expect(list).toHaveLength(2)
    // Most recent (IC2) first.
    expect(list[0]?.seniority).toBe("IC2")
    expect(list[0]?.endedAt).toBeNull()
    expect(list[1]?.seniority).toBe("IC1")
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
    const { personId: personAId } = await asAdminA.mutation(
      api.people.people.createPerson,
      {
        orgId: orgA,
        displayName: "Person A",
        gender: "Man",
      }
    )

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
        seniority: "IC1",
        senioritySource: "confirmed",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("cannot assign a person to another org's role", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    // Create a person in org B.
    const { personId: personBId } = await asAdminB.mutation(
      api.people.people.createPerson,
      {
        orgId: orgB,
        displayName: "Person B",
        gender: "Kvinna",
      }
    )

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
        seniority: "IC1",
        senioritySource: "confirmed",
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
      seniority: "IC2",
      senioritySource: "confirmed",
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
      seniority: "IC1",
      senioritySource: "confirmed",
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
    const { personId: secondPersonId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )

    const ids = await asAdmin.mutation(
      api.people.assignments.assignPeopleToRole,
      {
        orgId,
        assignments: [
          { personId, roleId, seniority: "IC2" },
          { personId: secondPersonId, roleId, seniority: "IC1" },
        ],
        senioritySource: "confirmed",
      }
    )
    expect(ids).toHaveLength(2)

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("personAssignments")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.senioritySource === "confirmed")).toBe(true)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "assignment.set")
        )
        .collect()
      expect(auditRows).toHaveLength(2)
    })
  })

  it("rejects the whole batch when one seniority is invalid for the role's track", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    const { personId: secondPersonId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )

    await expect(
      asAdmin.mutation(api.people.assignments.assignPeopleToRole, {
        orgId,
        assignments: [
          { personId, roleId, seniority: "IC2" },
          // M1 is not a valid seniority on the IC track.
          { personId: secondPersonId, roleId, seniority: "M1" },
        ],
        senioritySource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidSeniority/)

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

describe("assignPeopleToRole batch bound", () => {
  it("rejects a batch larger than MAX_ASSIGNMENTS_PER_MUTATION", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-bound1@acme.se")
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    // One person/role repeated: the length gate must fire before any
    // per-item work, so a batch this size never reaches the loop.
    const assignments = Array.from(
      { length: MAX_ASSIGNMENTS_PER_MUTATION + 1 },
      () => ({ personId, roleId, seniority: "IC1" })
    )
    await expect(
      asAdmin.mutation(api.people.assignments.assignPeopleToRole, {
        orgId,
        assignments,
        senioritySource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("accepts a batch exactly at the bound", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-bound2@acme.se")
    const { roleId } = await seedPersonAndRole(orgId, asAdmin)

    // A distinct person per entry: assigning the same person twice in one
    // batch would collide with the strictly-chronological guard in
    // writeAssignment (all entries share one effectiveAt), a different
    // invariant than the batch LENGTH bound under test here.
    const personIds: Id<"people">[] = []
    for (let i = 0; i < MAX_ASSIGNMENTS_PER_MUTATION; i++) {
      const { personId } = await asAdmin.mutation(
        api.people.people.createPerson,
        { orgId, displayName: `Batch Person ${i}`, gender: "Man" }
      )
      personIds.push(personId)
    }

    const assignments = personIds.map((personId) => ({
      personId,
      roleId,
      seniority: "IC1",
    }))
    const ids = await asAdmin.mutation(
      api.people.assignments.assignPeopleToRole,
      { orgId, assignments, senioritySource: "confirmed" }
    )
    expect(ids).toHaveLength(MAX_ASSIGNMENTS_PER_MUTATION)
  })
})

describe("listPeopleForRole", () => {
  it("returns the role's current holders, name-ordered, with their seniority", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-holders@acme.se")
    const { roleId } = await seedPersonAndRole(orgId, asAdmin)

    // Inserted out of order: the query sorts by name, not by insert time.
    const { personId: bo } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Bo Persson",
        gender: "Man",
        department: "Platform",
        ftePercent: 80,
      }
    )
    const { personId: anna } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Lind",
        gender: "Kvinna",
        department: "Engineering",
        ftePercent: 100,
      }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: bo,
      roleId,
      seniority: "IC2",
      senioritySource: "suggested",
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: anna,
      roleId,
      seniority: "IC3",
      senioritySource: "confirmed",
    })

    const rows = await asAdmin.query(api.people.assignments.listPeopleForRole, {
      orgId,
      roleId,
    })
    expect(rows.map((row) => row.displayName)).toEqual([
      "Anna Lind",
      "Bo Persson",
    ])
    expect(rows[0]).toMatchObject({
      personId: anna,
      seniority: "IC3",
      senioritySource: "confirmed",
      department: "Engineering",
      ftePercent: 100,
    })
    // The route handle travels with the row: the card links to the person
    // page by publicId, never by the internal id.
    expect(rows[0]?.publicId).toBeTypeOf("string")
    expect(rows[1]).toMatchObject({
      seniority: "IC2",
      senioritySource: "suggested",
    })
  })

  it("reports null for a person with no department or FTE on record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-sparse@acme.se")
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC1",
      senioritySource: "confirmed",
    })

    const rows = await asAdmin.query(api.people.assignments.listPeopleForRole, {
      orgId,
      roleId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.department).toBeNull()
    expect(rows[0]?.ftePercent).toBeNull()
  })

  it("drops holders whose assignment ended, and archived people", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-ended@acme.se")
    const { personId: mover, roleId } = await seedPersonAndRole(orgId, asAdmin)
    const { roleId: otherRoleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Staff Engineer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
      }
    )
    const { personId: leaver } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Leaving Person", gender: "Man" }
    )

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: mover,
      roleId,
      seniority: "IC1",
      senioritySource: "confirmed",
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: leaver,
      roleId,
      seniority: "IC1",
      senioritySource: "confirmed",
    })
    // A later assignment closes the first one: the mover is a holder of the
    // new role only.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: mover,
      roleId: otherRoleId,
      seniority: "IC2",
      senioritySource: "confirmed",
      effectiveAt: Date.now() + 1000,
    })
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: leaver,
    })

    expect(
      await asAdmin.query(api.people.assignments.listPeopleForRole, {
        orgId,
        roleId,
      })
    ).toEqual([])
    const moved = await asAdmin.query(
      api.people.assignments.listPeopleForRole,
      { orgId, roleId: otherRoleId }
    )
    expect(moved.map((row) => row.personId)).toEqual([mover])
  })

  it("returns nothing for a role in another org", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-org-a@acme.se")
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC1",
      senioritySource: "confirmed",
    })

    const other = await seedOrg(t, "hr-org-b@beta.se")
    expect(
      await other.asAdmin.query(api.people.assignments.listPeopleForRole, {
        orgId: other.orgId,
        roleId,
      })
    ).toEqual([])
  })
})

describe("listPeopleForRole ordering and history", () => {
  it("orders names by the caller's locale collation", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-collate@acme.se")
    const { roleId } = await seedPersonAndRole(orgId, asAdmin)

    // Å sorts after Z in Swedish but next to A in English, so the same two
    // names come back in a different order per locale.
    for (const displayName of ["Åsa Ek", "Bo Nilsson"]) {
      const { personId } = await asAdmin.mutation(
        api.people.people.createPerson,
        { orgId, displayName, gender: "Kvinna" }
      )
      await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId,
        roleId,
        seniority: "IC1",
        senioritySource: "confirmed",
      })
    }

    const sv = await asAdmin.query(api.people.assignments.listPeopleForRole, {
      orgId,
      roleId,
      locale: "sv",
    })
    expect(sv.map((row) => row.displayName)).toEqual(["Bo Nilsson", "Åsa Ek"])
    const en = await asAdmin.query(api.people.assignments.listPeopleForRole, {
      orgId,
      roleId,
      locale: "en",
    })
    expect(en.map((row) => row.displayName)).toEqual(["Åsa Ek", "Bo Nilsson"])
  })

  it("lists a re-assigned person once, at their current seniority", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr-relevel@acme.se")
    const { personId, roleId } = await seedPersonAndRole(orgId, asAdmin)

    // A seniority change within the same role closes the first row and opens a
    // second one, so the role's history holds two rows for one holder.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC2",
      senioritySource: "suggested",
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC3",
      senioritySource: "confirmed",
      effectiveAt: Date.now() + 1000,
    })

    const rows = await asAdmin.query(api.people.assignments.listPeopleForRole, {
      orgId,
      roleId,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      seniority: "IC3",
      senioritySource: "confirmed",
    })
  })
})
