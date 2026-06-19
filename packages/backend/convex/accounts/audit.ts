import { v } from "convex/values"
import { adminQuery } from "../lib/functions"

// The organization's own event trail (admin-only). Newest first, capped at 200
// (V1, no pagination, like the other list queries).
export const listAuditLog = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      at: v.number(),
      actorName: v.string(),
      type: v.string(),
      payload: v.any(),
    })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(200)
    return rows.map((r) => ({
      id: r._id.toString(),
      at: r._creationTime,
      actorName: r.actorName,
      type: r.type,
      payload: r.payload,
    }))
  },
})
