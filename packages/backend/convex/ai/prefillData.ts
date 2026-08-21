import { v } from "convex/values"
import { components } from "../_generated/api"
import { internalMutation, internalQuery } from "../_generated/server"
import { familyNames } from "../assessment/names"
import { PROFILE_TEXT_FIELDS, isProfileComplete } from "../assessment/roles"
import { clampLocale, promptLocale } from "../evaluationModel/localize"
import { trackName } from "../evaluationModel/trackSchema"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
import { assertKnownRole } from "../lib/functions"
import { appError, ERROR_CODES } from "../lib/errors"

// The DB side of the role-profile prefill (ai/prefill). Split out of the
// "use node" action file so the query/mutation work runs on the default V8
// runtime, like the rest of the suggestion persistence (ai/persist).

const profileShape = v.object({
  purpose: v.string(),
  responsibilities: v.string(),
})

// Which surface auto-applied the profile. It is a LABELLED provenance value in
// the audit detail, so it must name the surface that actually ran: an in-app
// import at a two-year-old org attributed to onboarding is a false record in
// the exact row the ADR-0003 auto-apply exception rests on. A literal union
// rather than a string, so a new surface has to add its value here (and its
// label in every locale) instead of writing an unlabelled one.
export const prefillViaValidator = v.union(
  v.literal("onboardingPrefill"),
  v.literal("roleImportPrefill")
)

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
// are filtered out, so the action never spends a generation on them. When
// roleIds is given, the result is further narrowed to that set (still on top
// of the archived/already-complete exclusions), for a caller that only wants
// to draft profiles for a specific batch of roles rather than every empty one.
export const collectPrefillTargets = internalQuery({
  args: {
    orgId: v.string(),
    userId: v.string(),
    locale: v.optional(v.string()),
    // Narrows the prefill to specific roles. Absent means every empty-profile
    // role in the org (onboarding, where the whole register was just created);
    // present means exactly what one in-app import created, so an import never
    // drafts profiles for unrelated roles the user left empty on purpose.
    roleIds: v.optional(v.array(v.id("roles"))),
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
  handler: async (ctx, { orgId, userId, locale, roleIds }) => {
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
    // Known-role denial too, so this re-check cannot be the permissive path
    // beside the wrapper it mirrors.
    assertKnownRole(membership.role, orgId, userId)

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

    const trackLocale = clampLocale(generationLocale)

    // Family names resolved ONCE for the org (one indexed read), then looked up
    // per role below. A role's familyId always points to a same-org family, so
    // a miss only happens if the family was deleted between writes; that role
    // simply omits the family clause.
    const families = await familyNames(ctx, orgId)

    // Absent roleIds -> no scope filter (every empty-profile role in the org,
    // onboarding's behaviour). Present -> only those roles, ON TOP OF the
    // existing archived/already-complete exclusions, never instead of them.
    const scope =
      roleIds === undefined ? null : new Set<string>(roleIds as string[])

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const targets = roles
      .filter(
        (role) =>
          role.archivedAt === undefined &&
          !isProfileComplete(role) &&
          (scope === null || scope.has(role._id as string))
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
          trackName: trackName(trackLocale, role.trackKey),
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
    via: prefillViaValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, { orgId, roleId, actorId, profile, via }) => {
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
    // patch does not mutate the already-read doc). source/via mark this as an
    // AI prefill from the calling surface so the Sheet can attribute it.
    const changes = buildChanges(role, patch, appliedFields)
    await ctx.db.patch(roleId, patch)
    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.roleUpdated,
      actorId,
      payload: { roleId, source: "ai", via, changes },
    })
    return true
  },
})
