import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
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

interface SeededModel {
  criteria: { criterionId: string }[]
}

async function createRatedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: SeededModel
  title: string
  value: number
  rateCount?: number
}) {
  const { roleId } = await args.asAdmin.mutation(
    api.assessment.roles.createRole,
    {
      orgId: args.orgId,
      title: args.title,
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "p",
      responsibilities: "r",
    }
  )
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

describe("getResults", () => {
  it("derives the standardmall anchors live and sorts band-first", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    const lowId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Low",
      value: 0,
    })
    const partialId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Partial",
      value: 3,
      rateCount: 4,
    })

    const results = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(results.bands.map((band) => band.band)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
    expect(results.rows.map((row) => row.roleId)).toEqual([
      topId,
      lowId,
      partialId,
    ])
    expect(results.rows[0]).toMatchObject({
      title: "Top",
      complete: true,
      score: 100,
      band: 1,
    })
    expect(results.rows[1]).toMatchObject({ score: 0, band: 7 })
    expect(results.rows[2]).toMatchObject({
      complete: false,
      score: null,
      band: null,
      ratedCount: 4,
      totalCriteria: 9,
    })
  })

  it("includes anchor info per row, and excludes non-anchor and replaced anchors", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    // Fully rated => complete => band 1 (value 5 on every criterion).
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await createRatedRole({ orgId, asAdmin, model, title: "Plain", value: 0 })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId: topId,
      expectedBand: 2,
      motivation: "reference point",
    })

    const active = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const top = active.rows.find((row) => row.roleId === topId)
    // The computed band (1) and the agreed band (2) diverge by design.
    expect(top?.band).toBe(1)
    expect(top?.anchor).toEqual({ expectedBand: 2, status: "active" })
    expect(active.rows.find((row) => row.title === "Plain")?.anchor).toBeNull()

    // underReview passes through; replaced reads as null (calibration history).
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId: topId,
      status: "underReview",
    })
    const review = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(review.rows.find((row) => row.roleId === topId)?.anchor).toEqual({
      expectedBand: 2,
      status: "underReview",
    })

    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId: topId,
      status: "replaced",
    })
    const replaced = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(replaced.rows.find((row) => row.roleId === topId)?.anchor).toBeNull()
  })
})

describe("getRoleResult", () => {
  it("returns the per-criterion breakdown when complete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    const result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
      locale: "sv",
    })
    expect(result).not.toBeNull()
    expect(result).toMatchObject({ complete: true, score: 100, band: 1 })
    expect(result?.criteria).toHaveLength(9)
    const scopeRow = result?.criteria[0]
    expect(scopeRow?.value).toBe(5)
    // The breakdown carries the criterion's weight points (scope = 5 in the
    // standard template).
    expect(scopeRow?.weightPoints).toBe(5)
  })

  it("returns the incomplete shape while ratings are missing", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Partial",
      value: 3,
      rateCount: 2,
    })
    const result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result).toMatchObject({
      complete: false,
      ratedCount: 2,
      totalCriteria: 9,
      score: null,
      band: null,
    })
  })

  it("returns null for garbage ids", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    expect(
      await asAdmin.query(api.assessment.results.getRoleResult, {
        orgId,
        roleId: "garbage",
      })
    ).toBeNull()
  })
})
