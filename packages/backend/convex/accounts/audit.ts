import { v } from "convex/values"
import { adminQuery } from "../lib/functions"

// The organization's own event trail (admin-only). Newest first, capped at 200
// (V1, no pagination, like the other list queries). Returns both the rows and a
// `names` map that resolves the Convex ids referenced in payloads (role/family
// ids, member auth ids) to display names, so the frontend can render readable
// details without exposing raw ids.
export const listAuditLog = adminQuery({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.string(),
        at: v.number(),
        actorId: v.string(),
        actorName: v.string(),
        type: v.string(),
        payload: v.any(),
      })
    ),
    names: v.record(v.string(), v.string()),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(200)

    const names: Record<string, string> = {}

    // All org roles (id -> title) and families (id -> name). Both are bounded
    // per org, so including all of them is cheaper than scanning every payload.
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    for (const role of roles) names[role._id.toString()] = role.title
    const families = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    for (const family of families) names[family._id.toString()] = family.name

    // Member identities live in the users mirror (keyed by authId), not the
    // org tables. Resolve only the auth ids actually referenced in payloads.
    const memberIds = new Set<string>()
    for (const row of rows) {
      const memberUserId = (row.payload as Record<string, unknown> | null)
        ?.memberUserId
      if (typeof memberUserId === "string") memberIds.add(memberUserId)
    }
    for (const authId of memberIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .first()
      if (user !== null) names[authId] = user.name || user.email
    }

    return {
      rows: rows.map((r) => ({
        id: r._id.toString(),
        at: r._creationTime,
        actorId: r.actorId,
        actorName: r.actorName,
        type: r.type,
        payload: r.payload,
      })),
      names,
    }
  },
})
