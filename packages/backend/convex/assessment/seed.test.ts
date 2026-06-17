import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("assessment/seed.seedRatedRoles", () => {
  it("seeds the itTelecom starter, rates every role, and is idempotent", async () => {
    const t = initConvexTest()
    const orgId = "org_rated"
    // Ratings reference the seeded criteria, so the model must exist first.
    await t.mutation(internal.evaluationModel.model.seedStandardModel, {
      orgId,
      locale: "sv",
    })

    const result = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      locale: "sv",
    })
    expect(result).toEqual({ roleCount: 9, ratingCount: 81 })

    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(9)
      expect(roles.every((role) => role.status === "approved")).toBe(true)
      expect(roles.every((role) => role.familyId !== undefined)).toBe(true)

      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families).toHaveLength(5)

      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(ratings).toHaveLength(81)
      expect(ratings.every((r) => r.value >= 0 && r.value <= 5)).toBe(true)
      // Each role has exactly one rating per criterion.
      for (const role of roles) {
        const roleRatings = ratings.filter((r) => r.roleId === role._id)
        expect(roleRatings).toHaveLength(9)
      }

      // Verify the role -> rating-row and templateKey -> column mapping landed
      // correctly: a mis-map would still total 81 ratings but score wrong.
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
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
      // Engineering Manager is all 5s (band 1).
      expect(cell("Engineering Manager", "scope")).toBe(5)
      expect(cell("Engineering Manager", "people")).toBe(5)
      expect(cell("Engineering Manager", "formal")).toBe(5)
      // Systemutvecklare row [scope 3, ..., people 1, formal 2].
      expect(cell("Systemutvecklare", "scope")).toBe(3)
      expect(cell("Systemutvecklare", "people")).toBe(1)
      expect(cell("Systemutvecklare", "formal")).toBe(2)
      // Supportspecialist row: scope 2, financial 1.
      expect(cell("Supportspecialist", "scope")).toBe(2)
      expect(cell("Supportspecialist", "financial")).toBe(1)
    })

    // Idempotent: any existing role short-circuits the whole seed.
    const second = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      locale: "sv",
    })
    expect(second).toEqual({ roleCount: 0, ratingCount: 0 })
    await t.run(async (ctx) => {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(ratings).toHaveLength(81)
    })
  })

  it("inserts the roles but no ratings when the org has no model yet", async () => {
    const t = initConvexTest()
    const orgId = "org_no_model"
    // No model => no criteria to rate against; the seed must not throw, it just
    // creates the starter roles with zero ratings.
    const result = await t.mutation(internal.assessment.seed.seedRatedRoles, {
      orgId,
      locale: "sv",
    })
    expect(result.roleCount).toBe(9)
    expect(result.ratingCount).toBe(0)
  })
})
