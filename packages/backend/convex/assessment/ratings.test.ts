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
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: track.key,
    purpose: "p",
    responsibilities: "r",
  })
  return { orgId, userId, asAdmin, model, roleId }
}

describe("setRating", () => {
  it("upserts by (role, criterion), audits, and logs band.shift on completion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)

    // Rate the first 8 criteria at 5: still incomplete, so no band.shift.
    for (const criterion of model.criteria.slice(0, 8)) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 5,
      })
    }
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts).toHaveLength(0)
    })

    // The 9th rating completes the role: all-5 means score 100, Band 1.
    const lastCriterion = model.criteria[8]
    if (lastCriterion === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: lastCriterion.criterionId,
      value: 5,
      motivation: "Top of the scale",
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts).toHaveLength(1)
      expect(shifts[0]?.payload).toMatchObject({
        roleId,
        changes: { band: { from: null, to: 1 } },
      })
    })

    // Re-rating the scope criterion (5 weight points) from 5 to 0 drops the
    // normalized score from 100 to floor(20 * 110 / 27) = 81: Band 3.
    const scopeCriterion = model.criteria[0]
    if (scopeCriterion === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: scopeCriterion.criterionId,
      value: 0,
    })
    await t.run(async (ctx) => {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Upsert: still exactly 9 rating rows.
      expect(ratings).toHaveLength(9)
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts).toHaveLength(2)
      expect(shifts[0]?.payload).toMatchObject({
        roleId,
        changes: { band: { from: null, to: 1 } },
      })
      expect(shifts[1]?.payload).toMatchObject({
        roleId,
        changes: { band: { from: 1, to: 3 } },
      })
      const changes = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "rating.change")
        )
        .collect()
      expect(changes.map((row) => row.payload)).toContainEqual({
        roleId,
        criterionId: scopeCriterion.criterionId,
        oldValue: 5,
        newValue: 0,
      })
    })
  })

  it("short-circuits a no-op save (no extra audit row)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
      motivation: "Same",
    })
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
      motivation: "Same",
    })
    await t.run(async (ctx) => {
      const changes = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "rating.change")
        )
        .collect()
      expect(changes).toHaveLength(1)
    })
  })

  it("rejects out-of-range values, locked roles, and incomplete profiles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")

    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 6,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 2.5,
      })
    ).rejects.toThrow(/errors.invalidInput/)

    // Archived role: rating is locked.
    for (const item of model.criteria) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: item.criterionId,
        value: 3,
      })
    }
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { archivedAt: Date.now() })
    })
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 1,
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("requires the mandatory job profile core before rating", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed")
    const bareRoleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Bare",
      function: "F",
      team: "T",
      trackKey: track.key,
    })
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId: bareRoleId,
        criterionId: criterion.criterionId,
        value: 3,
      })
    ).rejects.toThrow(/errors.profileIncomplete/)
  })
})
