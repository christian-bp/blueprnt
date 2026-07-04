import { v } from "convex/values"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import { orgMutation, orgQuery } from "../lib/functions"

// Validator for parseRules (mirrors the schema field exactly).
const parseRulesValidator = v.object({
  delimiter: v.optional(v.string()),
})

// Wire shape returned by getImportMappingProfile.
const profileShape = v.object({
  profileId: v.id("importMappingProfiles"),
  columnMap: v.record(v.string(), v.string()),
  parseRules: v.union(
    v.object({ delimiter: v.optional(v.string()) }),
    v.null()
  ),
  updatedAt: v.number(),
})

// Upsert the single per-org import-mapping profile. Looks up by `by_org`;
// inserts on miss, patches changed fields on hit. No write and no audit row
// when nothing changed (same values as stored). Returns null.
// Delegates to internalSaveImportMappingProfile so all upsert/audit logic
// lives in one place.
export const saveImportMappingProfile = orgMutation({
  args: {
    columnMap: v.record(v.string(), v.string()),
    parseRules: v.optional(parseRulesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(
      internal.people.importProfile.internalSaveImportMappingProfile,
      {
        orgId: ctx.orgId,
        actorId: ctx.authUserId,
        columnMap: args.columnMap,
        ...(args.parseRules !== undefined
          ? { parseRules: args.parseRules }
          : {}),
      }
    )
    return null
  },
})

// Internal variant of saveImportMappingProfile for the payroll-import action.
// Actions cannot use orgMutation (no ctx.auth), so the import action calls this
// with the already-resolved orgId + actorId instead. Uses the free logAudit
// (internal mutations have no ctx.audit). Also called by the public
// saveImportMappingProfile above so the upsert + audit logic is defined once.
export const internalSaveImportMappingProfile = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    columnMap: v.record(v.string(), v.string()),
    parseRules: v.optional(parseRulesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("importMappingProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first()

    if (existing === null) {
      const profileId = await ctx.db.insert("importMappingProfiles", {
        orgId: args.orgId,
        columnMap: args.columnMap,
        ...(args.parseRules !== undefined
          ? { parseRules: args.parseRules }
          : {}),
        updatedAt: Date.now(),
      })

      await logAudit(ctx, {
        orgId: args.orgId,
        type: AUDIT_EVENTS.mappingProfileSaved,
        actorId: args.actorId,
        payload: {
          orgId: args.orgId,
          changes: {
            profileId: { from: null, to: profileId },
          },
        },
      })

      return null
    }

    // Update path: detect changes so a no-op save writes nothing.
    const columnMapChanged =
      JSON.stringify(args.columnMap) !== JSON.stringify(existing.columnMap)
    const parseRulesChanged =
      JSON.stringify(args.parseRules ?? null) !==
      JSON.stringify(existing.parseRules ?? null)

    if (!columnMapChanged && !parseRulesChanged) return null

    const updatedAt = Date.now()
    const patch: Record<string, unknown> = { updatedAt }
    if (columnMapChanged) patch.columnMap = args.columnMap
    if (parseRulesChanged) {
      if (args.parseRules !== undefined) {
        patch.parseRules = args.parseRules
      } else {
        patch.parseRules = undefined
      }
    }

    await ctx.db.patch(existing._id, patch)

    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.mappingProfileSaved,
      actorId: args.actorId,
      payload: {
        orgId: args.orgId,
        changes: {
          profileId: { from: existing._id, to: existing._id },
        },
      },
    })

    return null
  },
})

// Returns the org's active import-mapping profile, or null when none exists.
export const getImportMappingProfile = orgQuery({
  args: {},
  returns: v.union(profileShape, v.null()),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("importMappingProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .first()

    if (profile === null) return null

    return {
      profileId: profile._id,
      columnMap: profile.columnMap,
      parseRules: profile.parseRules ?? null,
      updatedAt: profile.updatedAt,
    }
  },
})
