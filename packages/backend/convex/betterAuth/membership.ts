import { v } from "convex/values"
import { query } from "./_generated/server"

// Component function: never internet-exposed, called from the app via
// ctx.runQuery(components.betterAuth.membership.getMembership, ...).
// Cross-component calls require an explicit return validator.
export const getMembership = query({
  args: { organizationId: v.string(), userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      organizationId: v.string(),
      userId: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { organizationId, userId }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    return {
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
    }
  },
})

// Lists every organization the user belongs to, with the org display name.
// Component function: never internet-exposed; called from the app via
// ctx.runQuery(components.betterAuth.membership.listMembershipsForUser, ...).
export const listMembershipsForUser = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      organizationId: v.string(),
      organizationName: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { userId }) => {
    // Bounded read: V1 expects one organization per user; 20 is a generous guard.
    const members = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(20)
    const result: {
      organizationId: string
      organizationName: string
      role: string
    }[] = []
    for (const member of members) {
      const orgDocId = ctx.db.normalizeId("organization", member.organizationId)
      if (orgDocId === null) continue
      const org = await ctx.db.get(orgDocId)
      if (org === null) continue
      result.push({
        organizationId: member.organizationId,
        organizationName: org.name,
        role: member.role,
      })
    }
    return result
  },
})
