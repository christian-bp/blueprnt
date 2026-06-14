import { SUGGESTION_KINDS } from "@workspace/constants"
import { v } from "convex/values"
import { components } from "../_generated/api"
import { internalMutation, internalQuery } from "../_generated/server"
import { PROFILE_TEXT_FIELDS, isProfileComplete } from "../assessment/roles"
import { clampLocale } from "../evaluationModel/localize"
import { templateContent } from "../evaluationModel/standardTemplate"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { AI_MODEL_ID, AI_PROVIDER } from "./config"

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
  args: { orgId: v.string(), userId: v.string() },
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
      })
    ),
  }),
  handler: async (ctx, { orgId, userId }) => {
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
    // (currency is never used by the prompts). The prefill has no client UI
    // locale, so the org's saved language is the generation locale.
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

    const trackNames = templateContent(
      clampLocale(settings.language)
    ).trackNames

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const targets = roles
      .filter(
        (role) => role.archivedAt === undefined && !isProfileComplete(role)
      )
      .map((role) => ({
        roleId: role._id,
        title: role.title,
        trackName: trackNames[role.trackKey],
        roleFunction: role.function,
        team: role.team,
      }))

    return {
      actorId: userId,
      context: {
        locale: settings.language,
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

// Opens the per-role suggestion row that anchors usage logging and provenance,
// exactly like requestRoleProfileDraft's insert but stamped requestedBy with
// the prefill caller. recordAiUsage derives org/kind/actor/model from this row.
export const openPrefillSuggestion = internalMutation({
  args: {
    orgId: v.string(),
    roleId: v.id("roles"),
    requestedBy: v.string(),
  },
  returns: v.id("suggestions"),
  handler: async (ctx, { orgId, roleId, requestedBy }) => {
    return await ctx.db.insert("suggestions", {
      orgId,
      target: { kind: SUGGESTION_KINDS.roleProfile, roleId },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy,
    })
  },
})

// Auto-applies a generated profile to its role and closes the suggestion as
// confirmed. The LLM output crosses a trust boundary here (same gate as
// confirmRoleProfileDraft): require strings, trim, enforce the length bounds.
// A role concurrently archived/approved between collect and apply is skipped
// without an error; the suggestion still closes (rejected) so no row is left
// dangling. Org scope is re-checked against the stored role.
export const applyPrefill = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    orgId: v.string(),
    roleId: v.id("roles"),
    actorId: v.string(),
    profile: profileShape,
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, orgId, roleId, actorId, profile }) => {
    const role = await ctx.db.get(roleId)
    const locked =
      role === null ||
      role.orgId !== orgId ||
      role.archivedAt !== undefined ||
      role.status === "approved"

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

    if (appliedFields.length > 0) {
      await ctx.db.patch(roleId, patch)
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleUpdated,
        actorId,
        payload: { roleId, fields: appliedFields },
      })
    }

    await ctx.db.patch(suggestionId, {
      // suggestedValue records WHAT was applied (provenance), matching the
      // draft flow's saved shape; status is the auto-apply confirmation.
      suggestedValue: { profile },
      status: appliedFields.length > 0 ? "confirmed" : "rejected",
      confirmedBy: actorId,
    })
    return null
  },
})
