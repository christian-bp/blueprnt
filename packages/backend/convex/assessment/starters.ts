import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { clampLocale } from "../evaluationModel/localize"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { clampIndustry, starterContent } from "./industryStarters"

const MAX_FAMILIES = 20
const MAX_ROLES = 100
const MAX_FAMILY_NAME = 100
const MAX_ROLE_TITLE = 200

const starterFamilyShape = v.object({
  name: v.string(),
  roles: v.array(
    v.object({
      title: v.string(),
      trackKey: v.string(),
      levelKey: v.string(),
    })
  ),
})

// The industry starter for the onboarding families step. Display only: the
// org's saved industry picks the set, the locale picks the language, and
// nothing is written until createStarterSet runs with the user's adjusted
// list (founder decision 2026-06-06: pre-filled and adjustable).
export const getIndustryStarter = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({ families: v.array(starterFamilyShape) }),
  handler: async (ctx, { locale }) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const industry = clampIndustry(settings?.industry ?? undefined)
    const content = starterContent(clampLocale(locale))
    return { families: content[industry] }
  },
})

// Creates the adjusted starter set in ONE transaction: families plus their
// draft roles. Roles insert with EMPTY function/team/purpose/responsibilities
// (honest drafts, no invented data; rollfamilj stays separate from
// funktion/avdelning). Families never affect scoring, so there is no
// band-shift wrap. Member scope, like the role register.
export const createStarterSet = orgMutation({
  args: { families: v.array(starterFamilyShape) },
  returns: v.null(),
  handler: async (ctx, { families }) => {
    if (families.length === 0) return null
    if (families.length > MAX_FAMILIES) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const totalRoles = families.reduce(
      (sum, family) => sum + family.roles.length,
      0
    )
    if (totalRoles > MAX_ROLES) throw appError(ERROR_CODES.invalidInput)

    // Level lookup by stable key against the org's model; both seed paths
    // write the fixed schema, so keys resolve for every org with a model.
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const levelByKey = new Map<
      string,
      { trackId: Id<"tracks">; levelId: Id<"levels">; trackKey: string }
    >()
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    for (const track of tracks) {
      const levels = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", track._id))
        .collect()
      for (const level of levels) {
        levelByKey.set(level.key, {
          trackId: track._id,
          levelId: level._id,
          trackKey: track.key,
        })
      }
    }

    // Uniqueness: against the org's existing families AND within the payload.
    const existing = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const taken = new Set(existing.map((family) => family.name.toLowerCase()))

    for (const family of families) {
      const name = family.name.trim()
      if (name.length === 0 || name.length > MAX_FAMILY_NAME) {
        throw appError(ERROR_CODES.invalidInput)
      }
      const lowered = name.toLowerCase()
      if (taken.has(lowered)) throw appError(ERROR_CODES.roleFamilyExists)
      taken.add(lowered)

      const familyId = await ctx.db.insert("roleFamilies", {
        orgId: ctx.orgId,
        name,
      })
      await logAudit(ctx, {
        orgId: ctx.orgId,
        type: AUDIT_EVENTS.roleFamilyCreated,
        actorId: ctx.authUserId,
        payload: { familyId, name, source: "starter" },
      })

      for (const role of family.roles) {
        const title = role.title.trim()
        if (title.length === 0 || title.length > MAX_ROLE_TITLE) {
          throw appError(ERROR_CODES.invalidInput)
        }
        const level = levelByKey.get(role.levelKey)
        if (level === undefined || level.trackKey !== role.trackKey) {
          throw appError(ERROR_CODES.invalidInput)
        }
        const roleId = await ctx.db.insert("roles", {
          orgId: ctx.orgId,
          title,
          function: "",
          team: "",
          trackId: level.trackId,
          levelId: level.levelId,
          familyId,
          purpose: "",
          responsibilities: "",
          status: "draft",
        })
        await logAudit(ctx, {
          orgId: ctx.orgId,
          type: AUDIT_EVENTS.roleCreated,
          actorId: ctx.authUserId,
          payload: { roleId, source: "starter" },
        })
      }
    }
    return null
  },
})
