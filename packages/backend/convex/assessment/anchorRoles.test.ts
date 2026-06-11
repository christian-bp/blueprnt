import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@anchor.se", name: "HR Person", role: "admin" }
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
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  return { orgId, asAdmin, model }
}

async function createRatedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: { criteria: { criterionId: string }[] }
  title: string
  value: number
  rateCount?: number
}) {
  const roleId = await args.asAdmin.mutation(api.assessment.roles.createRole, {
    orgId: args.orgId,
    title: args.title,
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    purpose: "p",
    responsibilities: "r",
  })
  const count = args.rateCount ?? args.model.criteria.length
  for (const criterion of args.model.criteria.slice(0, count)) {
    await args.asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId: args.orgId,
      roleId,
      criterionId: criterion.criterionId as never,
      value: args.value,
    })
  }
  return roleId
}

describe("designateAnchorRole", () => {
  it("designates a fully rated role, audits, and lists it with the computed band", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Software Developer",
      value: 5,
    })

    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 1,
      motivation: "  Stable, well-understood reference for engineering.  ",
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.anchorRole?.status).toBe("active")
      expect(role?.anchorRole?.expectedBand).toBe(1)
      // The motivation is stored trimmed.
      expect(role?.anchorRole?.motivation).toBe(
        "Stable, well-understood reference for engineering."
      )
      expect(role?.anchorRole?.reviewedAt).toBeGreaterThan(0)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.designated")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })

    const anchors = await asAdmin.query(
      api.assessment.anchorRoles.listAnchorRoles,
      { orgId }
    )
    expect(anchors).toHaveLength(1)
    expect(anchors[0]?.title).toBe("Software Developer")
    expect(anchors[0]?.expectedBand).toBe(1)
    // All ratings are 5, so the computed band is the top band.
    expect(anchors[0]?.computedBand).toBe(1)

    // getRole carries the designation for the role page.
    const role = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId,
    })
    expect(role?.anchorRole?.status).toBe("active")
  })

  it("requires a complete assessment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Half Rated",
      value: 3,
      rateCount: 4,
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedBand: 3,
        motivation: "m",
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)
  })

  it("rejects an out-of-range band and a blank motivation", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    for (const expectedBand of [0, 8, 2.5]) {
      await expect(
        asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
          orgId,
          roleId,
          expectedBand,
          motivation: "m",
        })
      ).rejects.toThrow(/errors.invalidInput/)
    }
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedBand: 3,
        motivation: "   ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects designating a role that is already an anchor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 3,
      motivation: "m",
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedBand: 3,
        motivation: "m",
      })
    ).rejects.toThrow(/errors.invalidTransition/)
  })
})

describe("updateAnchorRole", () => {
  it("updates band, motivation, and status, bumps reviewedAt, and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 3,
      motivation: "first",
    })
    const before = await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      return role?.anchorRole?.reviewedAt ?? 0
    })

    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 4,
      motivation: "second",
      status: "underReview",
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.anchorRole).toMatchObject({
        expectedBand: 4,
        motivation: "second",
        status: "underReview",
      })
      expect(role?.anchorRole?.reviewedAt).toBeGreaterThanOrEqual(before)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toMatchObject({
        expectedBand: 4,
        status: "underReview",
        motivationChanged: true,
      })
    })
  })

  it("reactivates a replaced anchor only while the assessment is complete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 3,
      motivation: "m",
    })
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "replaced",
    })

    // Still fully rated: reactivation passes.
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "active",
    })
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "replaced",
    })

    // A new criterion makes every role's assessment incomplete, so the
    // replaced anchor can no longer re-enter the calibration set.
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "New criterion",
      description: "d",
      helpText: "h",
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "active",
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)
  })

  it("retires the designation when the role is archived and blocks reactivation", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 3,
      motivation: "m",
    })

    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      // Archiving retires the anchor with its own audit row, so the role
      // page and the calibration surfaces agree.
      expect(role?.anchorRole?.status).toBe("replaced")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toMatchObject({
        status: "replaced",
        viaArchive: true,
      })
    })

    const anchors = await asAdmin.query(
      api.assessment.anchorRoles.listAnchorRoles,
      { orgId }
    )
    expect(anchors).toHaveLength(0)

    // The archived role's anchor cannot come back to life.
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "active",
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("rejects updating a role that is not an anchor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "replaced",
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
