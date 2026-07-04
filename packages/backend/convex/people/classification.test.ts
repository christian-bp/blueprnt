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
})
