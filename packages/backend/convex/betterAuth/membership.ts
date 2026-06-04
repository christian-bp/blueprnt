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
