import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { PLATFORM_AUDIT_EVENTS, logPlatformAudit } from "../lib/audit"

// Out-of-band sentinel actor: there is no authenticated principal on the
// CLI/dashboard path, so the admin-log row is attributed to "system:cli"
// (no users mirror matches it, so actorName snapshots as "unknown").
const CLI_ACTOR_ID = "system:cli"

// Out-of-band platform-admin granting. Run from the Convex CLI/dashboard only
// (internalMutation = never internet-exposed). Resolves the mirror row by the
// by_email index (email uniqueness is enforced in Better Auth, not the mirror).
// Returns whether a matching mirror row was found and updated, and writes a
// platform.adminGranted admin-log row only on a successful grant.
export const grantPlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: true })
    await logPlatformAudit(ctx, {
      actorId: CLI_ACTOR_ID,
      type: PLATFORM_AUDIT_EVENTS.adminGranted,
      targetUserId: user.authId,
      payload: {},
    })
    return true
  },
})

export const revokePlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: false })
    await logPlatformAudit(ctx, {
      actorId: CLI_ACTOR_ID,
      type: PLATFORM_AUDIT_EVENTS.adminRevoked,
      targetUserId: user.authId,
      payload: {},
    })
    return true
  },
})
