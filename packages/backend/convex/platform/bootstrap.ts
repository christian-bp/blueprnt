import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

// Out-of-band platform-admin granting. Run from the Convex CLI/dashboard only
// (internalMutation = never internet-exposed). The users mirror has no email
// index (email uniqueness is enforced in Better Auth, not the mirror), so this
// rare, operator-run path filters. Returns whether a matching mirror row was
// found and updated.
export const grantPlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: true })
    return true
  },
})

export const revokePlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: false })
    return true
  },
})
