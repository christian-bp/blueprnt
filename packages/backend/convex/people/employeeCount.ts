import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"

// Sets organizations.employeeCount to the current count of non-archived people
// in the org. Called by the import action (Task 3) after upserts complete.
// No-op (no write, no audit row) when the count has not changed.
// Returns the authoritative count.
export const setEmployeeCountFromPeople = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, { orgId, actorId }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (org === null) {
      throw appError(ERROR_CODES.notFound)
    }

    // Count non-archived people using the by_org index, then filter leavers.
    const allPeople = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const count = allPeople.filter((p) => p.archivedAt === undefined).length

    const before = org.employeeCount ?? null
    const after = count

    // No change: no write, no audit row.
    if (before === after) return count

    await ctx.db.patch(org._id, { employeeCount: count })

    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.organizationSettingsUpdated,
      actorId,
      payload: {
        changes: buildChanges(
          { employeeCount: before },
          { employeeCount: after },
          ["employeeCount"]
        ),
      },
    })

    return count
  },
})
