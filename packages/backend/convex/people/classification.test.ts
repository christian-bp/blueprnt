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

// Inserts a person carrying a title directly (bypasses the import wizard).
async function seedPerson(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  fields: {
    displayName: string
    title?: string
    employmentStartDate?: string
    isManager?: boolean
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("people", {
      orgId,
      publicId: crypto.randomUUID().slice(0, 8),
      displayName: fields.displayName,
      gender: "Kvinna",
      ...(fields.title !== undefined ? { title: fields.title } : {}),
      ...(fields.employmentStartDate !== undefined
        ? { employmentStartDate: fields.employmentStartDate }
        : {}),
      ...(fields.isManager !== undefined
        ? { isManager: fields.isManager }
        : {}),
    })
  )
}

describe("runClassificationSuggestions", () => {
  it("writes a suggested assignment for a person whose title matches a role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(1)
    expect(result.unmatchedTitles).toBe(0)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("suggested")
    expect(current?.level.startsWith("IC")).toBe(true)
  })

  it("creates no assignment for a person whose title matches no role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Rocket Scientist",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)
    expect(result.unmatchedTitles).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).toBeNull()
  })

  it("creates no assignment for a person with no title", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, { displayName: "No Title" })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).toBeNull()
  })

  it("is idempotent: a second run adds no duplicate suggested assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const first = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(first.suggested).toBe(1)

    const second = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(second.suggested).toBe(0)
    expect(second.skipped).toBe(1)

    const assignments = await asAdmin.query(
      api.people.assignments.listAssignmentsForPerson,
      { orgId, personId }
    )
    expect(assignments).toHaveLength(1)
  })

  it("does not overwrite a confirmed assignment on re-run", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    // HR confirms the person at IC5 first.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC5",
      levelSource: "confirmed",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("confirmed")
    expect(current?.level).toBe("IC5")
  })

  it("re-suggests when the existing confirmed assignment points to an archived role (C1 consistency)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId: retiredRoleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Retired Role",
        function: "Ops",
        team: "Ops",
        trackKey: "IC",
      }
    )
    const { roleId: newRoleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Software Engineer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
      }
    )
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })
    // HR confirmed the person against a role that has since been archived
    // directly (bypassing archiveRole, which now ends its own open
    // assignments), simulating a pre-existing stale row.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: retiredRoleId,
      level: "IC5",
      levelSource: "confirmed",
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(retiredRoleId, { archivedAt: Date.now() })
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    // NOT skipped as "already confirmed": a confirmed assignment to an
    // archived role is not classified (matches listPeopleByTitle's
    // currentAssignment: null for the same row), so it stays suggestable
    // against the title-matched active role.
    expect(result.suggested).toBe(1)
    expect(result.skipped).toBe(0)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.roleId).toBe(newRoleId)
    expect(current?.levelSource).toBe("suggested")
  })

  it("writes a PII-free classification.suggested audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "classification.suggested")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as Record<string, unknown>
      expect(payload.suggested).toBe(1)
      // No PII: the payload carries only counts, no names.
      expect(JSON.stringify(payload)).not.toContain("Anna")
    })
  })

  it("the internal wrapper suggests for imported people", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const result = await t.mutation(
      internal.people.classificationInternal
        .internalRunClassificationSuggestions,
      { orgId, actorId: userId }
    )
    expect(result.suggested).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("suggested")
  })
})

describe("listPeopleByTitle", () => {
  it("groups people by title with their current assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const anna = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
      employmentStartDate: "2020-01-01",
    })
    await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Software Engineer",
    })
    await seedPerson(t, orgId, { displayName: "No Title Nils" })

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: anna,
      roleId,
      level: "IC3",
      levelSource: "confirmed",
    })

    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )

    // Two groups: "Software Engineer" (2 people) and the null group (1).
    expect(groups).toHaveLength(2)
    const seGroup = groups.find((g) => g.title === "Software Engineer")
    expect(seGroup?.personCount).toBe(2)
    // The query runs the engines: the exact-title match points at the
    // created role.
    expect(seGroup?.suggestedRoleId).toBe(roleId)
    const annaRow = seGroup?.people.find((p) => p.personId === anna)
    expect(annaRow?.currentAssignment?.level).toBe("IC3")
    expect(annaRow?.currentAssignment?.levelSource).toBe("confirmed")
    expect(annaRow?.employmentStartDate).toBe("2020-01-01")
    // Each matched person carries an engine level suggestion for the role's track.
    expect(annaRow?.suggestedLevel?.startsWith("IC")).toBe(true)
    const boRow = seGroup?.people.find((p) => p.displayName === "Bo Karlsson")
    expect(boRow?.currentAssignment).toBeNull()
    expect(boRow?.suggestedLevel?.startsWith("IC")).toBe(true)

    // The null-title group is last, with no role suggestion.
    const nullGroup = groups[groups.length - 1]
    expect(nullGroup?.title).toBeNull()
    expect(nullGroup?.suggestedRoleId).toBeNull()
    expect(nullGroup?.people[0]?.suggestedLevel).toBeNull()
  })

  it("exposes currentAssignment: null when a confirmed open assignment points to an archived role (C1)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Retired Role",
      function: "Ops",
      team: "Ops",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Dana Berg",
      title: "Retired Role",
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC3",
      levelSource: "confirmed",
    })
    // Simulate a PRE-EXISTING stale row: archive the role directly
    // (bypassing archiveRole, which now ends its own open assignments), so
    // the confirmed assignment stays open, pointing at an archived role.
    await t.run(async (ctx) => {
      await ctx.db.patch(roleId, { archivedAt: Date.now() })
    })

    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )
    const row = groups
      .flatMap((g) => g.people)
      .find((p) => p.personId === personId)
    // NOT the stale roleId/level: a confirmed assignment to an archived role
    // is not a real classification, so it surfaces exactly like "no
    // assignment at all" for reassignment on the classify page.
    expect(row?.currentAssignment).toBeNull()
  })

  it("marks a title that matches no role as unmatched", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Rocket Scientist",
    })

    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )
    const rsGroup = groups.find((g) => g.title === "Rocket Scientist")
    expect(rsGroup?.suggestedRoleId).toBeNull()
    expect(rsGroup?.people[0]?.suggestedLevel).toBeNull()
  })

  it("returns an empty array for an org with no people", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )
    expect(groups).toHaveLength(0)
  })

  it("does not leak another org's people", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "b@beta.se")
    await seedPerson(t, orgA, {
      displayName: "Anna A",
      title: "Engineer",
    })

    const groupsB = await asAdminB.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId: orgB }
    )
    expect(groupsB).toHaveLength(0)
    // Sanity: org A does see its own person.
    const groupsA = await asAdminA.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId: orgA }
    )
    expect(groupsA).toHaveLength(1)
  })
})
