import { v } from "convex/values"
import { AUDIT_EVENTS } from "../lib/audit"
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
export const saveImportMappingProfile = orgMutation({
  args: {
    columnMap: v.record(v.string(), v.string()),
    parseRules: v.optional(parseRulesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("importMappingProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .first()

    if (existing === null) {
      // Insert path.
      const profileId = await ctx.db.insert("importMappingProfiles", {
        orgId: ctx.orgId,
        columnMap: args.columnMap,
        ...(args.parseRules !== undefined
          ? { parseRules: args.parseRules }
          : {}),
        updatedAt: Date.now(),
      })

      await ctx.audit.log({
        type: AUDIT_EVENTS.mappingProfileSaved,
        payload: {
          orgId: ctx.orgId,
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

    // No changes: return without writing or auditing.
    if (!columnMapChanged && !parseRulesChanged) return null

    const updatedAt = Date.now()
    const patch: Record<string, unknown> = { updatedAt }
    if (columnMapChanged) patch.columnMap = args.columnMap
    if (parseRulesChanged) {
      if (args.parseRules !== undefined) {
        patch.parseRules = args.parseRules
      } else {
        // Field was cleared; remove it via undefined (Convex drops the field).
        patch.parseRules = undefined
      }
    }

    await ctx.db.patch(existing._id, patch)

    await ctx.audit.log({
      type: AUDIT_EVENTS.mappingProfileSaved,
      payload: {
        orgId: ctx.orgId,
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
