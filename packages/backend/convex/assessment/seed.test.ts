import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { DEV_COMPANY } from "./devCompany"

const EXPECTED_ROLES = DEV_COMPANY.reduce((sum, f) => sum + f.roles.length, 0)
const EXPECTED_FAMILIES = DEV_COMPANY.length
const EXPECTED_RATINGS = EXPECTED_ROLES * 9

describe("assessment/seed.seedRatedRoles", () => {
  it("seeds the dev company, rates every role, and is idempotent", async () => {
    const t = initConvexTest()
    const orgId = "org_rated"
    // Ratings reference the seeded criteria, so the model must exist first.
    await t.mutation(internal.evaluationModel.model.seedStandardModel, {
      orgId,
      locale: "sv",
    })

    const result = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
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
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(ratings).toHaveLength(EXPECTED_RATINGS)
      expect(ratings.every((r) => r.value >= 0 && r.value <= 5)).toBe(true)
      for (const role of roles) {
        const roleRatings = ratings.filter((r) => r.roleId === role._id)
        expect(roleRatings).toHaveLength(9)
      }

      // Verify the role -> level -> rating-row and templateKey -> column mapping
      // landed: a mis-map would still total the same count but score wrong.
      const templateKeyById = new Map(
        criteria.map((c) => [c._id, c.templateKey])
      )
      const roleIdByTitle = new Map(roles.map((r) => [r.title, r._id]))
      const cell = (title: string, templateKey: string) => {
        const roleId = roleIdByTitle.get(title)
        return ratings.find(
          (r) =>
            r.roleId === roleId &&
            templateKeyById.get(r.criterionId) === templateKey
        )?.value
      }
      // CEO (EXEC_CEO): broad leader, deliberately low on the technical criteria.
      expect(cell("CEO", "scope")).toBe(5)
      expect(cell("CEO", "complexity")).toBe(3)
      expect(cell("CEO", "people")).toBe(5)
      // Software Developer (DEV): peaks on the technical criteria, low on people.
      expect(cell("Software Developer", "complexity")).toBe(5)
      expect(cell("Software Developer", "knowledge")).toBe(5)
      expect(cell("Software Developer", "people")).toBe(1)
      // Technical Solutions Architect (ARCHITECT): deep technical leader.
      expect(cell("Technical Solutions Architect", "complexity")).toBe(5)
      expect(cell("Technical Solutions Architect", "knowledge")).toBe(5)
      // Order & Indoor Sales (JR_IC): junior, low magnitude.
      expect(cell("Order & Indoor Sales", "scope")).toBe(2)
      expect(cell("Order & Indoor Sales", "people")).toBe(1)
    })

    // Idempotent: any existing role short-circuits the whole seed.
    const second = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
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
    })
    expect(result.roleCount).toBe(EXPECTED_ROLES)
    expect(result.ratingCount).toBe(0)
  })
})
