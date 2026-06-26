import { v } from "convex/values"
import { components } from "../_generated/api"
import { appError, ERROR_CODES } from "../lib/errors"
import { authedMutation, authedQuery } from "../lib/functions"

// The caller's account-level 2FA state. confirmed (mfaConfirmedAt set) is the
// app's authoritative "setup complete" signal; the gate keys on it. Everyone is
// enrolled through real 2FA: there is no exemption (the seeded team accounts use
// real email 2FA to inboxes they control).
export const getMyMfaStatus = authedQuery({
  args: {},
  returns: v.object({
    confirmed: v.boolean(),
    method: v.union(v.literal("totp"), v.literal("email"), v.null()),
  }),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    return {
      confirmed: row?.mfaConfirmedAt != null,
      method: row?.mfaMethod ?? null,
    }
  },
})

// Records that the caller finished 2FA setup with the given method. Backstop:
// only stamp if Better Auth genuinely has 2FA enabled for them (enable() is
// password-gated, so reaching this already required re-authentication).
export const confirmMfaSetup = authedMutation({
  args: { method: v.union(v.literal("totp"), v.literal("email")) },
  returns: v.null(),
  handler: async (ctx, { method }) => {
    const enabled = await ctx.runQuery(
      components.betterAuth.provisioning.hasTwoFactorEnabled,
      { userId: ctx.authUserId }
    )
    if (!enabled) throw appError(ERROR_CODES.invalidInput)
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    if (row === null) throw appError(ERROR_CODES.notFound)
    await ctx.db.patch(row._id, {
      mfaMethod: method,
      mfaConfirmedAt: Date.now(),
    })
    // No audit row: account-security state is per-user, not org-domain,
    // so it stays out of the org-scoped audit log (same carve-out as telemetry).
    return null
  },
})
