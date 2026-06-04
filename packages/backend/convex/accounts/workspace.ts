import { v } from "convex/values"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"

const profileShape = v.object({
  orgId: v.string(),
  country: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  language: v.union(v.string(), v.null()),
  employeeCount: v.union(v.number(), v.null()),
  businessType: v.union(v.string(), v.null()),
})

export const getWorkspaceProfile = orgQuery({
  args: {},
  returns: profileShape,
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (profile === null) throw appError(ERROR_CODES.notFound)
    return {
      orgId: profile.orgId,
      country: profile.country ?? null,
      currency: profile.currency ?? null,
      language: profile.language ?? null,
      employeeCount: profile.employeeCount ?? null,
      businessType: profile.businessType ?? null,
    }
  },
})

export const updateWorkspaceProfile = adminMutation({
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    businessType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (profile === null) throw appError(ERROR_CODES.notFound)
    await ctx.db.patch(profile._id, args)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.workspaceProfileUpdated,
      actorId: ctx.authUserId,
      payload: { changed: Object.keys(args) },
    })
    return null
  },
})
