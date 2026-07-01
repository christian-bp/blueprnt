import { v } from "convex/values"
import { components } from "../_generated/api"
import { internalMutation, internalQuery } from "../_generated/server"
import { familyNames } from "../assessment/names"
import { PROFILE_TEXT_FIELDS, isProfileComplete } from "../assessment/roles"
import { clampLocale, promptLocale } from "../evaluationModel/localize"
import { templateContent } from "../evaluationModel/standardTemplate"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"

// The DB side of the role-profile prefill (ai/prefill). Split out of the
// "use node" action file so the query/mutation work runs on the default V8
// runtime, like the rest of the suggestion persistence (ai/persist).

const profileShape = v.object({
  purpose: v.string(),
  responsibilities: v.string(),
})

// responsibilities is the wider field; everything else (purpose) is capped
// shorter. Mirrors ai/suggest's maxLengthFor so the trust boundary is the
// same as the confirm path the prefill replaces.
function maxLengthFor(field: (typeof PROFILE_TEXT_FIELDS)[number]): number {
  return field === "responsibilities" ? 2000 : 1000
}

// Resolves the org's empty-profile roles plus the AI company context, in ONE
// org-scoped read. Membership is re-checked here (the action only has the
// caller's identity): a foreign org, or a caller who is not a member, is
// rejected before any model call. Roles that already have a non-empty profile
// are filtered out, so the action never spends a generation on them.
export const collectPrefillTargets = internalQuery({
  args: {
    orgId: v.string(),
    userId: v.string(),
    locale: v.optional(v.string()),
  },
  returns: v.object({
    actorId: v.string(),
    context: v.object({
      locale: v.string(),
      industry: v.string(),
      employeeCount: v.optional(v.number()),
      country: v.string(),
    }),
    targets: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        trackName: v.string(),
        roleFunction: v.string(),
        team: v.string(),
        // The role's family name, present only when the role belongs to a
        // family whose id still resolves (v.optional -> key absent otherwise).
        family: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, { orgId, userId, locale }) => {
    // Membership re-check (fail closed), mirroring resolveOrgContext: the
    // action authenticated the caller, this confirms they belong to THIS org.
    let membership: { role: string } | null
    try {
      membership = await ctx.runQuery(
        components.betterAuth.membership.getMembership,
        { organizationId: orgId, userId }
      )
    } catch (error) {
      console.error("prefill membership lookup failed", {
        orgId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw appError(ERROR_CODES.membershipConflict)
    }
    if (membership === null) throw appError(ERROR_CODES.notAMember)

    // Company context, the same subset of settings the draft flow reads
    // (currency is never used by the prompts).
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (
      settings === null ||
      !settings.country ||
      !settings.language ||
      !settings.industry
    ) {
      throw appError(ERROR_CODES.profileIncomplete)
    }

    // Generate in the caller's CURRENT display locale (the active next-intl
    // locale threaded from the client), falling back to the org's saved
    // language. This drives BOTH the prompt's output-language instruction
    // (context.locale) and the localized track names quoted in the prompt, so
    // an org configured in one language but viewed in another gets profiles in
    // the language the user is actually looking at.
    const generationLocale = promptLocale(locale, settings.language)

    const trackNames = templateContent(clampLocale(generationLocale)).trackNames

    // Family names resolved ONCE for the org (one indexed read), then looked up
    // per role below. A role's familyId always points to a same-org family, so
    // a miss only happens if the family was deleted between writes; that role
    // simply omits the family clause.
    const families = await familyNames(ctx, orgId)

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const targets = roles
      .filter(
        (role) => role.archivedAt === undefined && !isProfileComplete(role)
      )
      .map((role) => {
        // Omit the family key entirely when the role has no family (or its
        // family no longer resolves), so the target is byte-identical to the
        // pre-family shape for unfamilied roles (matching v.optional).
        const familyName =
          role.familyId !== undefined
            ? families.get(role.familyId as string)?.name
            : undefined
        return {
          roleId: role._id,
          title: role.title,
          trackName: trackNames[role.trackKey],
          roleFunction: role.function,
          team: role.team,
          ...(familyName !== undefined ? { family: familyName } : {}),
        }
      })

    return {
      actorId: userId,
      context: {
        locale: generationLocale,
        industry: settings.industry,
        country: settings.country,
        ...(settings.employeeCount !== undefined
          ? { employeeCount: settings.employeeCount }
          : {}),
      },
      targets,
    }
  },
})

// Auto-applies one generated profile to its role. The batched prefill makes
// ONE model call for the whole set and logs usage per call (ai/usage
// recordAiUsageDirect), so there is no per-role suggestion row: provenance is
// the per-call AI usage event plus the role.updated audit row written here.
//
// The LLM output crosses a trust boundary here: whitelist the fields, require
// strings, trim, and enforce the length bounds before applying.
// A role concurrently archived between collect and apply is skipped
// without an error. Org scope is re-checked against the stored role. Returns
// whether the profile was applied so the caller can count it.
export const applyPrefill = internalMutation({
  args: {
    orgId: v.string(),
    roleId: v.id("roles"),
    actorId: v.string(),
    profile: profileShape,
  },
  returns: v.boolean(),
  handler: async (ctx, { orgId, roleId, actorId, profile }) => {
    const role = await ctx.db.get(roleId)
    const locked =
      role === null || role.orgId !== orgId || role.archivedAt !== undefined

    const patch: Record<string, string> = {}
    const appliedFields: string[] = []
    if (!locked) {
      const values: Record<string, string> = {
        purpose: profile.purpose,
        responsibilities: profile.responsibilities,
      }
      for (const field of PROFILE_TEXT_FIELDS) {
        const trimmed = (values[field] ?? "").trim()
        if (trimmed.length === 0 || trimmed.length > maxLengthFor(field)) {
          continue
        }
        patch[field] = trimmed
        appliedFields.push(field)
      }
    }

    if (appliedFields.length === 0 || role === null) return false

    // Structured before->after diff over the applied fields: `role` is the
    // pre-patch in-memory doc read above, `patch` is what we apply (Convex
    // patch does not mutate the already-read doc). source/via mark this as the
    // onboarding AI prefill so the Sheet can attribute it.
    const changes = buildChanges(role, patch, appliedFields)
    await ctx.db.patch(roleId, patch)
    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.roleUpdated,
      actorId,
      payload: { roleId, source: "ai", via: "onboardingPrefill", changes },
    })
    return true
  },
})
