import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { isCriterionKey } from "../evaluationModel/localize"
import { CRITERION_KEYS } from "../evaluationModel/standardTemplate"
import { DEV_COMPANY, RATINGS_BY_TITLE } from "./devCompany"
import { insertStarterSet } from "./starters"

// Dev/seed-only: give an org the blueprnt demo company (DEV_COMPANY: ~40 roles
// across 8 families) and rate every role so the results/band view is populated.
// Creates the families + roles via the shared insertStarterSet helper, then
// rates each role against all nine criteria using RATINGS_BY_LEVEL keyed by the
// role's level (seniority -> band). Idempotent:
// skips entirely if the org already has a role. The standard model must exist
// first (seedStandardModel), since ratings reference the seeded criteria by id.
// No auth context (the dev seed is "use node"), so this is an internalMutation;
// the founder authId is passed in as actorId (the admin-gated
// createStarterSet/setRating cannot be used) so the role/roleFamily.created
// audit rows are attributed to the seeded account, not "system". Ratings are
// inserted directly and do not log rating.change/band.shift rows.
export const seedRatedRoles = internalMutation({
  args: { orgId: v.string(), actorId: v.string() },
  returns: v.object({ roleCount: v.number(), ratingCount: v.number() }),
  handler: async (ctx, { orgId, actorId }) => {
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    if (existingRole !== null) return { roleCount: 0, ratingCount: 0 }

    await insertStarterSet(ctx, {
      orgId,
      actorId,
      families: DEV_COMPANY.map((family) => ({
        name: family.name,
        roles: family.roles.map((role) => ({
          title: role.title,
          trackKey: role.trackKey,
          purpose: role.purpose,
          responsibilities: role.responsibilities,
        })),
      })),
      source: "starter",
    })

    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()

    let ratingCount = 0
    for (const role of roles) {
      const ratingRow = RATINGS_BY_TITLE[role.title.trim()]
      if (ratingRow === undefined) {
        throw new Error(`seedRatedRoles: no ratings for role "${role.title}"`)
      }
      // Ratings key on criterionId (the criteria row id); the rating column comes
      // from the criterion's templateKey position in CRITERION_KEYS, never the
      // query order. Custom criteria (no templateKey) are skipped.
      for (const criterion of criteria) {
        const templateKey = criterion.templateKey
        if (templateKey === undefined || !isCriterionKey(templateKey)) continue
        const value = ratingRow[CRITERION_KEYS.indexOf(templateKey)]
        if (value === undefined) {
          throw new Error(
            `seedRatedRoles: missing rating for "${role.title}" / ${templateKey}`
          )
        }
        await ctx.db.insert("ratings", {
          orgId,
          roleId: role._id,
          criterionId: criterion._id,
          value,
        })
        ratingCount += 1
      }
    }

    return { roleCount: roles.length, ratingCount }
  },
})
