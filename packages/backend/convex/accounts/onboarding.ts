import { v } from "convex/values"
import { components } from "../_generated/api"
import { query } from "../_generated/server"

// First-run gate for the dashboard. NOT org-scoped: it exists precisely to
// find the user's organization (or its absence) before any org-scoped call is
// possible. Returns null when signed out so the client gate can no-op.
// V1 assumption: one organization per user; the first membership wins.
//
// `completed` is explicit, persisted state (onboardingCompletedAt set by
// completeOnboarding when the wizard finishes); the gate trusts it and never
// infers "done" from hasModel. organization/settingsComplete/hasModel still
// drive which step the wizard resumes at.
export const getOnboardingStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      organization: v.union(
        v.null(),
        v.object({
          orgId: v.string(),
          name: v.string(),
          role: v.string(),
        })
      ),
      settingsComplete: v.boolean(),
      hasModel: v.boolean(),
      completed: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: identity.subject }
    )
    const first = memberships[0]
    if (first === undefined) {
      return {
        organization: null,
        settingsComplete: false,
        hasModel: false,
        completed: false,
      }
    }
    const orgId = first.organizationId
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const settingsComplete =
      settings !== null &&
      !!settings.country &&
      !!settings.currency &&
      !!settings.language &&
      !!settings.industry
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    return {
      organization: {
        orgId,
        name: first.organizationName,
        role: first.role,
      },
      settingsComplete,
      hasModel: model !== null,
      completed: typeof settings?.onboardingCompletedAt === "number",
    }
  },
})

// Drives the dashboard UI language. Resolution chain: the per-user locale
// override (set later by a settings UI) wins over the organization default
// language; null when neither is set so the client falls back to "en". Like
// getOnboardingStatus this is NOT org-scoped: it has to find the user's first
// organization before any org-scoped call is possible. Returns null when signed
// out so the client can keep the last-known (cookie) locale.
export const getUiLocale = query({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    // Per-user override wins.
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    if (user?.locale) return user.locale
    // Fall back to the organization default language.
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: identity.subject }
    )
    const first = memberships[0]
    if (first === undefined) return null
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", first.organizationId))
      .unique()
    return settings?.language ?? null
  },
})
