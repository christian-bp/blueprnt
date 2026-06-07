import { v } from "convex/values"
import { components } from "../_generated/api"
import { mutation, query } from "../_generated/server"
import { ERROR_CODES, appError } from "../lib/errors"

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

// Drives the dashboard UI language: ONLY the per-user override (set from
// the user-menu picker via setUiLocale). The organization's language is an
// org setting (starter sets, invitations) and deliberately never drives the
// UI; with no override the client falls back to the browser language.
// Returns null when signed out or when no override is set.
export const getUiLocale = query({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    return user?.locale ?? null
  },
})

// The five supported UI locales are governed by the i18n routing config
// (packages/i18n routing.ts); the backend mirrors the set to validate
// writes. The client clamps reads regardless (resolveUiLocale).
const SUPPORTED_LOCALES = new Set(["en", "sv", "nb", "da", "fi"])

// Per-user UI language override (the top of the getUiLocale resolution
// chain). NOT org-scoped: the locale belongs to the user, not a tenant.
export const setUiLocale = mutation({
  args: { locale: v.string() },
  returns: v.null(),
  handler: async (ctx, { locale }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
    if (!SUPPORTED_LOCALES.has(locale)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    if (user === null) {
      // The mirror row is normally created by the Better Auth onUserCreate
      // trigger; recover gracefully if it is missing.
      await ctx.db.insert("users", {
        authId: identity.subject,
        name: typeof identity.name === "string" ? identity.name : "",
        email: typeof identity.email === "string" ? identity.email : "",
        locale,
      })
      return null
    }
    await ctx.db.patch(user._id, { locale })
    return null
  },
})
