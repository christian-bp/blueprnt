import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import {
  DEMO_ANCHOR_ROLES,
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
      expect(ratings.every((r) => r.value >= 0 && r.value <= 5)).toBe(true)
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
