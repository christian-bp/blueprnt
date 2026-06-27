import { v } from "convex/values"
import { components } from "../_generated/api"
import { query } from "../_generated/server"
import { authedMutation } from "../lib/functions"

// The caller's account profile: name, email, locale, current 2FA method, and
// the set of orgs where they are the SOLE admin. The sole-admin list drives
// the delete-account guard UI (blocking deletion when it would leave an org
// admin-less).
//
// Deliberately a plain query (not authedQuery): mirrors getMyMfaStatus so a
// token-refresh blip returns null instead of throwing notAuthenticated, which
// would crash the settings page mid-load.
export const getMyAccount = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      email: v.string(),
      locale: v.union(v.string(), v.null()),
      mfaMethod: v.union(v.literal("totp"), v.literal("email"), v.null()),
      lastAdminOrgs: v.array(v.object({ orgId: v.string(), name: v.string() })),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    if (row === null) return null

    // Get all memberships for this user, then find orgs where they are the
    // sole admin. listMembershipsForUser already returns the org display name,
    // so no extra org-name lookup is needed.
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: identity.subject }
    )
    const adminMemberships = memberships.filter((m) => m.role === "admin")

    const lastAdminOrgs: { orgId: string; name: string }[] = []
    for (const m of adminMemberships) {
      // Count the admins in this org. provisioning.listMembers returns all
      // members with their roles; filter to admins only.
      const members = await ctx.runQuery(
        components.betterAuth.provisioning.listMembers,
        { organizationId: m.organizationId }
      )
      const adminCount = members.filter((mem) => mem.role === "admin").length
      if (adminCount === 1) {
        lastAdminOrgs.push({
          orgId: m.organizationId,
          name: m.organizationName,
        })
      }
    }

    return {
      name: row.name,
      email: row.email,
      locale: row.locale ?? null,
      mfaMethod: row.mfaMethod ?? null,
      lastAdminOrgs,
    }
  },
})

// Clears the caller's mfaConfirmedAt stamp. Used when the user initiates a
// "change 2FA method" flow: clearing the stamp forces the 2FA gate to treat
// setup as incomplete again, so the wizard re-runs. The new method is stamped
// by the existing confirmMfaSetup once setup completes.
// No audit row: account-security state is per-user, not org-domain, so it
// stays out of the org-scoped audit log (same carve-out as confirmMfaSetup).
export const clearMfaConfirmed = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    if (row === null) return null
    await ctx.db.patch(row._id, { mfaConfirmedAt: undefined })
    return null
  },
})
