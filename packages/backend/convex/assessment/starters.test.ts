import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(
  t: ReturnType<typeof initConvexTest>,
  industry = "itTelecom"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry,
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  return { orgId, asAdmin }
}

describe("getIndustryStarter", () => {
  it("returns the org industry's starter in the requested locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "sv" }
    )
    expect(starter.families.length).toBeGreaterThan(0)
    expect(starter.families[0]?.name).toBe("Engineering")
    // One role per JOB (ADR-0005): no junior/senior variants, no level.
    expect(starter.families[0]?.roles[0]).toEqual({
      title: "Systemutvecklare",
      trackKey: "IC",
    })
  })

  it("falls back to the generic set for an unknown industry", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(
      t,
      "somethingElse"
    )
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "en" }
    )
    expect(starter.families[0]?.name).toBe("Operations")
  })
})

describe("createStarterSet", () => {
  it("creates families and draft roles in one call, audited as starter", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Software Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families.map((family) => family.name)).toEqual([
      "Design",
      "Engineering",
    ])
    const roles = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
    })
    expect(roles).toHaveLength(2)
    expect(roles[0]).toMatchObject({
      title: "Software Developer",
      familyName: "Engineering",
      trackKey: "IC",
      status: "draft",
      profileComplete: false,
    })
    await t.run(async (ctx) => {
      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(created).toHaveLength(2)
      expect(created[0]?.payload).toMatchObject({ source: "starter" })
      const roleRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(roleRows).toHaveLength(2)
      expect(roleRows[0]?.payload).toMatchObject({ source: "starter" })
      // Starter roles are honest drafts: no invented profile data.
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(role?.function).toBe("")
      expect(role?.team).toBe("")
      expect(role?.purpose).toBe("")
    })
  })

  it("rejects duplicates against existing families and unknown track keys", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [{ name: "engineering", roles: [] }],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [
          {
            name: "Quality",
            roles: [{ title: "QA", trackKey: "Ghost" }],
          },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("is a no-op for an empty list", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toEqual([])
  })
})
