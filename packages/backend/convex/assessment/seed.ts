import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { clampLocale, isCriterionKey } from "../evaluationModel/localize"
import { CRITERION_KEYS } from "../evaluationModel/standardTemplate"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { starterContent } from "./industryStarters"
import { insertStarterSet } from "./starters"

// blueprnt's dev company is itTelecom; its starter set is a believable 9-role
// SaaS org. The seed rates those roles so the results/band view is populated.
const STARTER_INDUSTRY = "itTelecom" as const

// Per-role 0-5 ratings for the itTelecom starter, in its family-then-role
// flatten order, against the nine criteria in CRITERION_KEYS order
// [scope, complexity, autonomy, risk, knowledge, stakeholders, financial,
// people, formal]. Tuned against the engine (score = floor(20 * sum(value *
// weightPoints) / 27), weights summing 27, default thresholds 98/83/74/63/53/
// 41/0) to a believable band spread:
//   Systemutvecklare 57 (band 5), Tech Lead 82 (band 3),
//   Engineering Manager 100 (band 1), Product Manager 78 (band 3),
//   UX-designer 52 (band 6), Account Executive 62 (band 5),
//   Forsaljningschef 91 (band 2), Supportspecialist 47 (band 6),
//   Customer Success Manager 68 (band 4).
const SEED_RATINGS: ReadonlyArray<readonly number[]> = [
  [3, 4, 3, 3, 4, 2, 2, 1, 2], // Systemutvecklare (IC)
  [4, 5, 4, 4, 5, 4, 3, 3, 4], // Tech Lead (Lead)
  [5, 5, 5, 5, 5, 5, 5, 5, 5], // Engineering Manager (M)
  [4, 4, 4, 4, 4, 5, 4, 2, 3], // Product Manager (IC)
  [3, 3, 3, 2, 4, 3, 1, 1, 1], // UX-designer (IC)
  [3, 3, 4, 3, 3, 4, 4, 1, 2], // Account Executive (IC)
  [5, 4, 5, 4, 4, 5, 5, 5, 4], // Forsaljningschef (M)
  [2, 3, 3, 2, 3, 3, 1, 1, 2], // Supportspecialist (IC)
  [4, 3, 4, 3, 4, 4, 3, 2, 2], // Customer Success Manager (IC)
]

// Dev/seed-only: give an org a realistic, fully rated SaaS company. Creates the
// itTelecom industry starter (5 families, 9 roles) via the shared insertStarterSet
// helper, then rates every role against all nine criteria so each derives a band,
// and marks the roles approved. Idempotent: skips entirely if the org already has
// a role. The standard model must exist first (seedStandardModel), since ratings
// reference the seeded criteria by id. No auth context (the dev seed is "use
// node"), so this is an internalMutation with actorId "system", matching the
// other seed mutations; the admin-gated createStarterSet/setRating cannot be used.
export const seedRatedRoles = internalMutation({
  args: { orgId: v.string(), locale: v.optional(v.string()) },
  returns: v.object({ roleCount: v.number(), ratingCount: v.number() }),
  handler: async (ctx, { orgId, locale }) => {
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    if (existingRole !== null) return { roleCount: 0, ratingCount: 0 }

    const families = starterContent(clampLocale(locale))[STARTER_INDUSTRY]
    await insertStarterSet(ctx, {
      orgId,
      actorId: "system",
      families,
      source: "starter",
    })

    // Rating row per role, matched by title (unique in the itTelecom set) so the
    // mapping survives any query-order change. The flatten order of the families
    // we just inserted is the seeded roles' creation order.
    const flatTitles = families.flatMap((family) =>
      family.roles.map((role) => role.title.trim())
    )
    if (flatTitles.length !== SEED_RATINGS.length) {
      throw new Error(
        `seedRatedRoles: itTelecom starter has ${flatTitles.length} roles but SEED_RATINGS has ${SEED_RATINGS.length}`
      )
    }
    const ratingRowByTitle = new Map<string, readonly number[]>()
    flatTitles.forEach((title, index) => {
      const row = SEED_RATINGS[index]
      if (row !== undefined) ratingRowByTitle.set(title, row)
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
      const ratingRow = ratingRowByTitle.get(role.title.trim())
      if (ratingRow === undefined) {
        throw new Error(
          `seedRatedRoles: no rating row for role "${role.title}"`
        )
      }
      await ctx.db.patch(role._id, { status: "approved" })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleStatusChanged,
        actorId: "system",
        payload: { roleId: role._id, status: "approved" },
      })
      // Ratings key on criterionId (the criteria row id); the SEED_RATINGS
      // column comes from the criterion's templateKey position in CRITERION_KEYS,
      // never the query order. Custom criteria (no templateKey) are skipped.
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
