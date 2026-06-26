import { v } from "convex/values"
import { components } from "../_generated/api"
import { appError, ERROR_CODES } from "../lib/errors"
import { authedMutation, authedQuery } from "../lib/functions"

// Pre-launch test affordance: accounts listed in TWO_FACTOR_EXEMPT_EMAILS skip
// mandatory 2FA so the team can sign in to the test deployment without a second
// factor. Removed at go-live (unset the var + delete the test account); see
// docs/go-live-checklist.md. Scoped to known identities, not a guessable code.
function isTwoFactorExempt(email: string): boolean {
  const list = process.env.TWO_FACTOR_EXEMPT_EMAILS
  if (!list) return false
  const exempt = new Set(
    list
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
  )
  return exempt.has(email.trim().toLowerCase())
}

// The caller's account-level 2FA state. confirmed (mfaConfirmedAt set) is the
// app's authoritative "setup complete" signal; the gate keys on it. An exempt
// email reports confirmed so the gate passes (it never enables 2FA, so Better
// Auth signs it in with just email + password).
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
    if (row !== null && isTwoFactorExempt(row.email)) {
      return { confirmed: true, method: null }
    }
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
    return null
  },
})
