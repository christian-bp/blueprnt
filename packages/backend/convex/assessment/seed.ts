import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { internalMutation } from "../_generated/server"
import {
  DEMO_ANCHOR_ROLES,
  DEMO_SELECTED_KEYS,
  DEMO_WEIGHT_POINTS,
  DEV_COMPANY,
  RATINGS_BY_TITLE,
} from "./devCompany"
import { insertStarterSet } from "./starters"

// Dev/seed-only: give an org the blueprnt demo company (DEV_COMPANY: ~40 roles
// across 8 families) and rate every role so the results/level view is
// populated. Creates the families + roles via the shared insertStarterSet
// helper, selects the demo's 8 calibrated library criteria directly onto the
// model seedDefaultModel already created, then rates each role against them
// using RATINGS_BY_TITLE keyed by the role's title (per-role vectors mirroring
// the production demo org's hand-tuned ratings, re-keyed onto the library
// selection; seniority is not stored on the role and does not drive the
// level). Idempotent: skips entirely if the org already has a role. The
// default model must exist first (seedDefaultModel), since ratings reference
// the seeded criteria by id. No auth context (the dev seed is "use node"), so
// this is an internalMutation; the founder authId is passed in as actorId (the
// admin-gated createStarterSet/activateCriterion cannot be used) so the
// role/roleFamily.created audit rows are attributed to the seeded account, not
// "system". The demo org mirrors the production demo company as a company
// that has DONE its model work: DEMO_SELECTED_KEYS/DEMO_WEIGHT_POINTS are
// inserted directly (bypassing activateCriterion's per-mutation dimension
// caps, like every other seed write bypasses its interactive counterpart's
// guards) and the DEMO_ANCHOR_ROLES designations are applied. Criteria,
// ratings, and anchors are written directly and do not log the audit rows the
// interactive paths write (mirroring model.created's own seed variant, which
// does log once for the model itself).
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

    // Select the demo's calibrated criteria directly onto the model
    // seedDefaultModel created (with zero criteria): the library picker is
    // the only interactive way in, but a trusted seed writes rows directly,
    // exactly like every other seed write here.
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const criterionIdByKey = new Map<string, Id<"criteria">>()
    if (model !== null) {
      for (const [index, libraryKey] of DEMO_SELECTED_KEYS.entries()) {
        const criterionId = await ctx.db.insert("criteria", {
          orgId,
          modelId: model._id,
          libraryKey,
          weightPoints: DEMO_WEIGHT_POINTS[libraryKey],
          order: index + 1,
        })
        criterionIdByKey.set(libraryKey, criterionId)
      }
      // The demo org has already tested working conditions at method-building
      // time and found nothing recurring across its role families (ADR-0022
      // section 6.1): seeded as testedNotMaterial rather than leaving the
      // decision unmade, so the demo model reads as a company that finished
      // its method work, like its weighting already does.
      await ctx.db.patch(model._id, {
        workingConditions: {
          status: "testedNotMaterial",
          motivation:
            "Prövad vid metodbyggnaden: inga rollfamiljer har återkommande särskilda arbetsförhållanden som inte fångas av övriga kriterier.",
          decidedBy: actorId,
          decidedAt: Date.now(),
        },
      })
    }

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()

    // Designate the demo org's anchor roles.
    for (const role of roles) {
      const anchor = DEMO_ANCHOR_ROLES[role.title.trim()]
      if (anchor === undefined) continue
      await ctx.db.patch(role._id, {
        anchorRole: { ...anchor, status: "active", reviewedAt: Date.now() },
      })
    }

    let ratingCount = 0
    for (const role of roles) {
      const ratingRow = RATINGS_BY_TITLE[role.title.trim()]
      if (ratingRow === undefined) {
        throw new Error(`seedRatedRoles: no ratings for role "${role.title}"`)
      }
      // Ratings key on criterionId (the criteria row id); the rating column
      // comes from the criterion's position in DEMO_SELECTED_KEYS, matched by
      // libraryKey via criterionIdByKey (built at insert time above), never
      // the query order.
      for (const [index, libraryKey] of DEMO_SELECTED_KEYS.entries()) {
        const criterionId = criterionIdByKey.get(libraryKey)
        if (criterionId === undefined) continue
        const value = ratingRow[index]
        if (value === undefined) {
          throw new Error(
            `seedRatedRoles: missing rating for "${role.title}" / ${libraryKey}`
          )
        }
        await ctx.db.insert("ratings", {
          orgId,
          roleId: role._id,
          criterionId,
          value,
        })
        ratingCount += 1
      }
    }

    return { roleCount: roles.length, ratingCount }
  },
})
