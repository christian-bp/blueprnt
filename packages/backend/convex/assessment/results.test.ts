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
  tracks: { trackId: string; levels: { levelId: string }[] }[]
}

async function createRatedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: SeededModel
  title: string
  value: number
  rateCount?: number
  levelIndex?: number
}) {
  const track = args.model.tracks[0]
  const level = track?.levels[args.levelIndex ?? 1]
  if (track === undefined || level === undefined) throw new Error("seed")
  const roleId = await args.asAdmin.mutation(api.assessment.roles.createRole, {
    orgId: args.orgId,
    title: args.title,
    function: "Engineering",
    team: "Core",
    trackId: track.trackId as never,
    levelId: level.levelId as never,
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
      score: 540,
      band: 1,
    })
    // All-5 on an IC2 role violates all 8 advisory ranges for that level.
    expect(results.rows[0]?.warningCount).toBe(8)
    expect(results.rows[1]).toMatchObject({ score: 0, band: 7 })
    expect(results.rows[2]).toMatchObject({
      complete: false,
      score: null,
      band: null,
      ratedCount: 4,
      totalCriteria: 9,
    })
  })
})

describe("getRoleResult", () => {
  it("returns the per-criterion breakdown with guardrail flags when complete", async () => {
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
    expect(result).toMatchObject({ complete: true, score: 540, band: 1 })
    expect(result?.criteria).toHaveLength(9)
    const scopeRow = result?.criteria[0]
    expect(scopeRow?.value).toBe(5)
    // IC2 scope guardrail is [1, 2]: a 5 is outside.
    expect(scopeRow?.guardrail).toEqual({ min: 1, max: 2 })
    expect(scopeRow?.outside).toBe(true)
    // The breakdown shows importance LEVELS (labels client-side), never weights.
    expect(scopeRow?.importanceLevel).toBe(7)
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
