import { validateMethod } from "@workspace/core"
import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { buildMethodCheckInput } from "../evaluationModel/approval"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import type { CriteriaLibraryKey } from "../evaluationModel/criteriaLibrary"
import { initConvexTest } from "../testing.helpers"
import {
  DEMO_ANCHOR_ROLES,
  DEMO_RATING_MOTIVATION,
  DEMO_WEIGHT_POINTS,
  DEV_COMPANY,
} from "./devCompany"

const EXPECTED_ROLES = DEV_COMPANY.reduce((sum, f) => sum + f.roles.length, 0)
const EXPECTED_FAMILIES = DEV_COMPANY.length
const EXPECTED_RATINGS = EXPECTED_ROLES * 8

// The founder account the seed runs for: its authId is threaded as actorId so
// seeded audit rows resolve to this account instead of the "system" sentinel.
const FOUNDER_AUTH_ID = "ba_user_founder"
const FOUNDER_NAME = "Founder"

describe("assessment/seed.seedRatedRoles", () => {
  it("seeds the dev company, rates every role, and is idempotent", async () => {
    const t = initConvexTest()
    const orgId = "org_rated"
    // The founder mirror row so audit actorName snapshots resolve to a real
    // name rather than "unknown".
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: FOUNDER_AUTH_ID,
        email: "founder@blueprnt.se",
        name: FOUNDER_NAME,
      })
    })
    // Ratings reference the seeded criteria, so the model must exist first.
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId,
      locale: "sv",
      actorId: FOUNDER_AUTH_ID,
    })

    const result = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: FOUNDER_AUTH_ID,
    })
    expect(result).toEqual({
      roleCount: EXPECTED_ROLES,
      ratingCount: EXPECTED_RATINGS,
    })

    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(EXPECTED_ROLES)
      expect(roles.every((role) => role.familyId !== undefined)).toBe(true)

      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families).toHaveLength(EXPECTED_FAMILIES)

      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(8)
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(ratings).toHaveLength(EXPECTED_RATINGS)
      for (const role of roles) {
        const roleRatings = ratings.filter((r) => r.roleId === role._id)
        expect(roleRatings).toHaveLength(8)
      }

      // Verify the role -> criterion -> rating-row and libraryKey -> column
      // mapping landed: a mis-map would still total the same count but score
      // wrong.
      const libraryKeyById = new Map(criteria.map((c) => [c._id, c.libraryKey]))
      const roleIdByTitle = new Map(roles.map((r) => [r.title, r._id]))
      const cell = (title: string, libraryKey: string) => {
        const roleId = roleIdByTitle.get(title)
        return ratings.find(
          (r) =>
            r.roleId === roleId &&
            libraryKeyById.get(r.criterionId) === libraryKey
        )?.value
      }
      const motivationFor = (title: string, libraryKey: string) => {
        const roleId = roleIdByTitle.get(title)
        return ratings.find(
          (r) =>
            r.roleId === roleId &&
            libraryKeyById.get(r.criterionId) === libraryKey
        )?.motivation
      }
      // Every rating obeys the dimension-aware law: 1-5, or 0 only on the
      // workingConditions (on-call) column.
      for (const rating of ratings) {
        const libraryKey = libraryKeyById.get(rating.criterionId)
        const min =
          libraryKey !== undefined &&
          LIBRARY_DIMENSION[libraryKey as CriteriaLibraryKey] ===
            "workingConditions"
            ? 0
            : 1
        expect(rating.value, `value for ${libraryKey}`).toBeGreaterThanOrEqual(
          min
        )
        expect(rating.value).toBeLessThanOrEqual(5)
      }
      // CEO: at the ceiling on every criterion except knowledge-breadth.
      expect(cell("CEO", "scope-impact")).toBe(5)
      expect(cell("CEO", "complexity-ambiguity")).toBe(5)
      expect(cell("CEO", "knowledge-breadth")).toBe(3)
      // Software Developer (SPECIALIST_IC): hands-on specialist, no people
      // responsibility.
      expect(cell("Software Developer", "risk-consequence")).toBe(3)
      expect(cell("Software Developer", "knowledge-depth")).toBe(3)
      expect(cell("Software Developer", "on-call")).toBe(0)
      // Cloud Architect: peaks on the technical criteria.
      expect(cell("Cloud Architect", "complexity-ambiguity")).toBe(4)
      expect(cell("Cloud Architect", "knowledge-depth")).toBe(4)
      // Order & Indoor Sales: junior, low magnitude.
      expect(cell("Order & Indoor Sales", "scope-impact")).toBe(2)
      // Infrastructure Engineer: the demo's clearest on-call exposure.
      expect(cell("Infrastructure Engineer", "on-call")).toBe(3)

      // 1/4/5 ratings carry the seeded motivation so the demo satisfies its
      // own motivation-required law, including a 1 on the workingConditions
      // column; 2/3 (and on-call's legitimate 0) carry none.
      expect(motivationFor("CEO", "scope-impact")).toBe(DEMO_RATING_MOTIVATION) // 5
      expect(motivationFor("CEO", "knowledge-breadth")).toBeUndefined() // 3
      expect(motivationFor("Cloud Architect", "on-call")).toBe(
        DEMO_RATING_MOTIVATION
      ) // 1
      expect(motivationFor("Software Developer", "on-call")).toBeUndefined() // 0
      expect(
        motivationFor("Infrastructure Engineer", "on-call")
      ).toBeUndefined() // 3, no motivation required

      // The calibrated demo weighting landed on every seeded criterion.
      for (const criterion of criteria) {
        expect(
          criterion.weightPoints,
          `weight for ${criterion.libraryKey}`
        ).toBe(
          DEMO_WEIGHT_POINTS[
            criterion.libraryKey as keyof typeof DEMO_WEIGHT_POINTS
          ]
        )
      }
      expect(criteria.reduce((sum, c) => sum + c.weightPoints, 0)).toBe(24)

      // The demo org has already tested and closed out working conditions:
      // active, since on-call is a real, material requirement in its
      // drift/support role families.
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.workingConditions?.status).toBe("active")
      expect(model?.workingConditions?.motivation).toBe(
        "Jour och beredskap är ett återkommande och materiellt rollkrav i drift- och supportrollerna."
      )

      // Track calibration from prod: the two Lead-track roles.
      const roleByTitle = new Map(roles.map((r) => [r.title, r]))
      expect(roleByTitle.get("E-Commerce Strategy Lead")?.trackKey).toBe("Lead")
      expect(roleByTitle.get("UX Lead")?.trackKey).toBe("Lead")

      // The anchor designation landed: active, at the expected level, with the
      // fixture's motivation.
      for (const [title, anchor] of Object.entries(DEMO_ANCHOR_ROLES)) {
        const anchorRole = roleByTitle.get(title)?.anchorRole
        expect(anchorRole?.status, `anchor for ${title}`).toBe("active")
        expect(anchorRole?.expectedLevel).toBe(anchor.expectedLevel)
        expect(anchorRole?.motivation).toBe(anchor.motivation)
        expect(anchorRole?.reviewedAt).toBeGreaterThan(0)
      }

      // Seeded role.created (and roleFamily.created) rows are attributed to the
      // founder account, not the "system" sentinel, and resolve to the
      // founder's name rather than "unknown".
      const roleCreated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(roleCreated).toHaveLength(EXPECTED_ROLES)
      expect(roleCreated.every((row) => row.actorId === FOUNDER_AUTH_ID)).toBe(
        true
      )
      expect(roleCreated.every((row) => row.actorName === FOUNDER_NAME)).toBe(
        true
      )

      const familyCreated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(familyCreated).toHaveLength(EXPECTED_FAMILIES)
      expect(
        familyCreated.every((row) => row.actorId === FOUNDER_AUTH_ID)
      ).toBe(true)

      // The demo org has DONE its assessment work too (spec 2.4/6,
      // completion is the reveal): every role is completed, attributed to the founder,
      // and completedAt lands at or after approvedAt so a freshly reset demo
      // never shows a stale-method drift chip nobody earned.
      expect(
        roles.every((role) => role.assessment?.completedBy === FOUNDER_AUTH_ID)
      ).toBe(true)
      const approvedAt = model?.approval?.approvedAt ?? 0
      expect(
        roles.every((role) => (role.assessment?.completedAt ?? 0) >= approvedAt)
      ).toBe(true)
      // Completed, not additionally calibrated: calibration is a separate,
      // explicit confirmation step the seed does not perform.
      expect(
        roles.every((role) => role.assessment?.calibratedAt === undefined)
      ).toBe(true)
    })

    // Idempotent: any existing role short-circuits the whole seed.
    const second = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: FOUNDER_AUTH_ID,
    })
    expect(second).toEqual({ roleCount: 0, ratingCount: 0 })
    await t.run(async (ctx) => {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(ratings).toHaveLength(EXPECTED_RATINGS)
    })
  })

  it("completes compliance and approves the seeded model with an all-green checklist", async () => {
    const t = initConvexTest()
    const orgId = "org_rated_approval"
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: FOUNDER_AUTH_ID,
        email: "founder@blueprnt.se",
        name: FOUNDER_NAME,
      })
    })
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId,
      locale: "sv",
      actorId: FOUNDER_AUTH_ID,
    })
    await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: FOUNDER_AUTH_ID,
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("seed")
      // The seed approves via its own internal path (approveSeededModel),
      // attributed to the founder account, not a "system" sentinel.
      expect(model.approval?.approvedBy).toBe(FOUNDER_AUTH_ID)
      expect(model.approval?.approvedAt).toBeGreaterThan(0)

      // Every one of the twelve checks (blockers AND warnings) comes back
      // ok, using the SAME engine input builder approveModel/getMethodChecks
      // consume: the seed satisfies its own method law, not a bypass that
      // would leave the Method tab's checklist showing red/amber rows on a
      // freshly reset demo org.
      const input = await buildMethodCheckInput(ctx, model)
      const checks = validateMethod(input)
      const failing = checks.filter((check) => !check.ok)
      expect(failing).toEqual([])

      // Documentation is real, not just the approved flag: every seeded
      // criterion carries the activateCriterion prefill (purpose from the
      // library's fullDefinition, whyRelevant from whenSuitable), so the
      // Method tab's compliance dialog never shows blank locked text under a
      // green checklist.
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      expect(criteria).toHaveLength(8)
      for (const criterion of criteria) {
        expect(
          criterion.purpose?.trim().length ?? 0,
          `purpose for ${criterion.libraryKey}`
        ).toBeGreaterThan(0)
        expect(
          criterion.whyRelevant?.trim().length ?? 0,
          `whyRelevant for ${criterion.libraryKey}`
        ).toBeGreaterThan(0)
      }

      const approvedRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approved")
        )
        .collect()
      expect(approvedRows).toHaveLength(1)
      expect(approvedRows[0]?.actorId).toBe(FOUNDER_AUTH_ID)
      const payload = approvedRows[0]?.payload as {
        criteriaCount: number
        checksPassed: number
      }
      expect(payload.criteriaCount).toBe(8)
      expect(payload.checksPassed).toBe(checks.length)
    })
  })

  // A seed that simulates completed work has to materialise every trace that
  // work would have left, not only its data. The weighting is the case that
  // caught it: DEMO_WEIGHT_POINTS is indistinguishable from an untouched
  // selection, because criteria enter at 3 points and the budget is the
  // criteria count times 3, so without the marker the Viktning chapter reads
  // zero against seeded weights and a seeded motivation.
  it("stamps the acts the seeded state pretends, so no chapter reads zero", async () => {
    const t = initConvexTest()
    const orgId = "org_seed_markers"
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: FOUNDER_AUTH_ID,
        email: "founder@blueprnt.se",
        name: FOUNDER_NAME,
      })
    })
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId,
      locale: "sv",
      actorId: FOUNDER_AUTH_ID,
    })
    await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: FOUNDER_AUTH_ID,
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("seed")
      // The weighting act.
      expect(model.weightsSavedAt).toBeGreaterThan(0)
      // The approval act, and the buffer that approval writes.
      expect(model.approval?.approvedBy).toBe(FOUNDER_AUTH_ID)
      expect(model.lastApprovedModel).toBeDefined()
      // The materiality decision.
      expect(model.workingConditions?.status).toBe("active")
      expect(model.workingConditions?.decidedBy).toBe(FOUNDER_AUTH_ID)
      // The obligations the Viktning chapter counts on this model: the
      // dominance guard, which every weighted model carries, and NOT the
      // people-leadership one, which the demo selection has no criterion for.
      // With the save above that makes the seeded org read two of two.
      const input = await buildMethodCheckInput(ctx, model)
      const weightChecks = validateMethod(input)
      const dominance = weightChecks.find(
        (check) => check.key === "dimensionWeightBalance"
      )
      const leadership = weightChecks.find(
        (check) => check.key === "peopleLeadershipWeight"
      )
      expect(dominance?.ok).toBe(true)
      expect(leadership?.applies).toBe(false)

      // Every criterion's own compliance sign-off.
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      expect(criteria.length).toBeGreaterThan(0)
      for (const criterion of criteria) {
        expect(criterion.approved).toBe(true)
        expect(criterion.decidedBy).toBe(FOUNDER_AUTH_ID)
      }
    })
    // The reading the dashboard takes from the marker (getMethodChecks
    // reporting weightsSaved) is pinned where that query lives
    // (evaluationModel/criteria.test.ts): it is an org query and needs a
    // signed-in caller, which this seed harness has no identity for.
  })

  it("completes every role so getResults exposes a level for all of them", async () => {
    // A real membership (not the bare users-mirror row the other tests use)
    // so the org-scoped getResults query actually authorizes; the founder
    // account itself is threaded through as actorId, matching how the
    // production seed call attributes the work.
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "founder@blueprnt.se", name: FOUNDER_NAME, role: "admin" }
    )
    const asFounder = t.withIdentity({ subject: userId })
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId,
      locale: "sv",
      actorId: userId,
    })
    await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: userId,
    })

    const results = await asFounder.query(api.assessment.results.getResults, {
      orgId,
    })
    expect(results.rows).toHaveLength(EXPECTED_ROLES)
    expect(results.rows.every((row) => row.completed)).toBe(true)
    expect(results.rows.every((row) => row.level !== null)).toBe(true)
    expect(results.rows.every((row) => row.methodDrift === false)).toBe(true)
  })

  it("inserts the roles but no ratings when the org has no model yet", async () => {
    const t = initConvexTest()
    const orgId = "org_no_model"
    // No model => no criteria to rate against; the seed must not throw, it just
    // creates the roles with zero ratings.
    const result = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      actorId: FOUNDER_AUTH_ID,
    })
    expect(result.roleCount).toBe(EXPECTED_ROLES)
    expect(result.ratingCount).toBe(0)
  })
})
