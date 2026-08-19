import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// A spread of 8 library keys across every dimension at (or under) its own
// DIMENSION_MAX_ACTIVE cap (competence 2, effort 2, responsibility 3,
// workingConditions 1), so activating all of them never trips a cap. Every
// one enters at the neutral 3 weight points (budget 24).
const EIGHT_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of EIGHT_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: track.key,
    purpose: "p",
    responsibilities: "r",
  })
  // setRating's FIRST gate (ADR-0023) requires an approved model; this file
  // tests rating behavior, not the approval checklist, so grant it directly.
  await grantModelApproval(t, orgId)
  return { orgId, userId, asAdmin, model, roleId }
}

describe("setRating", () => {
  it("upserts by (role, criterion), audits, and logs level.shift on completion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)

    // Rate the first 7 criteria at 5 (a motivation is required at 5): still
    // incomplete, so no level.shift.
    for (const criterion of model.criteria.slice(0, 7)) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 5,
        motivation: "Meets the top anchor consistently.",
      })
    }
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      expect(shifts).toHaveLength(0)
    })

    // The 8th rating completes the role: all-5 means score 100, Level 1.
    const lastCriterion = model.criteria[7]
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
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      expect(shifts).toHaveLength(1)
      expect(shifts[0]?.payload).toMatchObject({
        roleId,
        changes: { level: { from: null, to: 1 } },
      })
    })

    // Re-rating the 8th criterion (safety-exposure, the model's one
    // workingConditions criterion: the only one 0 is legal on) from 5 to 0
    // drops the normalized score from 100 to floor(20 * 105 / 24) = 87
    // (neutral 3 weight points, like every activated criterion): Level 3.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: lastCriterion.criterionId,
      value: 0,
    })
    await t.run(async (ctx) => {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Upsert: still exactly 8 rating rows.
      expect(ratings).toHaveLength(8)
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      expect(shifts).toHaveLength(2)
      expect(shifts[0]?.payload).toMatchObject({
        roleId,
        changes: { level: { from: null, to: 1 } },
      })
      expect(shifts[1]?.payload).toMatchObject({
        roleId,
        changes: { level: { from: 1, to: 3 } },
      })
      const changes = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "rating.change")
        )
        .collect()
      // The 8th criterion was first rated 5 with a motivation (create), then
      // re-rated to 0 with no motivation argument (update, legal since 0
      // needs none): a single row, created:false, a value from/to, and no
      // motivation entry (motivation was untouched, not cleared).
      expect(changes.map((row) => row.payload)).toContainEqual({
        roleId,
        criterionId: lastCriterion.criterionId,
        created: false,
        changes: { value: { from: 5, to: 0 } },
      })
      // The completing rating supplied a motivation, so its create row records
      // both value and motivation as created (from null).
      expect(changes.map((row) => row.payload)).toContainEqual({
        roleId,
        criterionId: lastCriterion.criterionId,
        created: true,
        changes: {
          value: { from: null, to: 5 },
          motivation: { from: null, to: "Top of the scale" },
        },
      })
    })

    // level.shift cause: the last shift was triggered by re-rating the 8th
    // criterion, so its payload records the rating.change cause with the role
    // and criterion that moved it.
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      const lastShift = shifts[shifts.length - 1]
      expect(lastShift?.payload).toMatchObject({
        roleId,
        cause: {
          event: "rating.change",
          roleId,
          criterionId: lastCriterion.criterionId,
        },
      })
    })
  })

  it("records value-only updates without a motivation entry (leave-untouched)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    // 2 and 3 never require a motivation, so this stays a pure value-only
    // path (the required-at-1/4/5 interaction has its own tests below).
    // Create with a value only (no motivation arg).
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 2,
    })
    // Update the value only; motivation arg omitted.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
    })
    await t.run(async (ctx) => {
      const changes = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "rating.change")
        )
        .collect()
      expect(changes).toHaveLength(2)
      // Create: value from null, no motivation key.
      expect(changes[0]?.payload).toEqual({
        roleId,
        criterionId: criterion.criterionId,
        created: true,
        changes: { value: { from: null, to: 2 } },
      })
      // Update: value from/to, motivation untouched -> no motivation key.
      expect(changes[1]?.payload).toEqual({
        roleId,
        criterionId: criterion.criterionId,
        created: false,
        changes: { value: { from: 2, to: 3 } },
      })
    })
  })

  it("records a motivation change as a from/to entry", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
      motivation: "First reason",
    })
    // Same value, new motivation.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
      motivation: "Revised reason",
    })
    await t.run(async (ctx) => {
      const changes = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "rating.change")
        )
        .collect()
      expect(changes).toHaveLength(2)
      expect(changes[1]?.payload).toEqual({
        roleId,
        criterionId: criterion.criterionId,
        created: false,
        changes: {
          motivation: { from: "First reason", to: "Revised reason" },
        },
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

  it("rejects 0 on a non-working-conditions criterion but accepts it (motivation-free) on the working-conditions one", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const nonWc = model.criteria.find(
      (c) => c.dimensionKey !== "workingConditions"
    )
    const wc = model.criteria.find(
      (c) => c.dimensionKey === "workingConditions"
    )
    if (nonWc === undefined || wc === undefined) throw new Error("seed")

    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: nonWc.criterionId,
        value: 0,
      })
    ).rejects.toThrow(/errors.invalidInput/)

    // 0 ("omfattas inte") on the working-conditions criterion is legal and
    // needs no motivation.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: wc.criterionId,
      value: 0,
    })
    await t.run(async (ctx) => {
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", wc.criterionId)
        )
        .unique()
      expect(rating?.value).toBe(0)
      expect(rating?.motivation).toBeUndefined()
    })
  })

  it("requires a motivation at 1, 4, or 5 but not at 2 or 3", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")

    for (const value of [1, 4, 5] as const) {
      await expect(
        asAdmin.mutation(api.assessment.ratings.setRating, {
          orgId,
          roleId,
          criterionId: criterion.criterionId,
          value,
        })
      ).rejects.toThrow(/errors.motivationRequired/)
    }
    for (const value of [2, 3] as const) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value,
      })
    }
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 4,
      motivation: "Advanced, cross-team scope.",
    })
    await t.run(async (ctx) => {
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", criterion.criterionId)
        )
        .unique()
      expect(rating?.value).toBe(4)
      expect(rating?.motivation).toBe("Advanced, cross-team scope.")
    })
  })

  it("keeps the no-op short-circuit and untouched-motivation edit paths legal under the motivation-required law", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    const criterion = model.criteria[0]
    const other = model.criteria[1]
    if (criterion === undefined || other === undefined) throw new Error("seed")

    // Seed a 4 with its required motivation.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 4,
      motivation: "Broad, cross-team reach.",
    })

    // An edit that changes the value to 2 or 3 stays legal without motivation.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 3,
    })

    // Moving back to 4 without touching motivation reuses the one already on
    // file: the field the write leaves behind is non-empty, so this is legal.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 4,
    })

    // A different criterion at 1/4/5 whose motivation is neither stored nor
    // provided is refused.
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: other.criterionId,
        value: 5,
      })
    ).rejects.toThrow(/errors.motivationRequired/)

    // Providing a motivation with the SAME 1/4/5 value is a legal
    // motivation-only update (also proves this is not swallowed by the no-op
    // short-circuit, since the motivation text itself changed).
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: 4,
      motivation: "Revised: broader scope than first noted.",
    })
    await t.run(async (ctx) => {
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", criterion.criterionId)
        )
        .unique()
      expect(rating?.value).toBe(4)
      expect(rating?.motivation).toBe(
        "Revised: broader scope than first noted."
      )
    })
  })

  it("requires the mandatory job profile core before rating", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed")
    const { roleId: bareRoleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Bare",
        function: "F",
        team: "T",
        trackKey: track.key,
      }
    )
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
