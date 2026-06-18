import { MAX_STARTER_IMPORT_TEXT, SUGGESTION_KINDS } from "@workspace/constants"
import { isWeightPoints } from "@workspace/core"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { MutationCtx } from "../_generated/server"
import { deriveResults, logBandShifts } from "../assessment/compute"
import { PROFILE_TEXT_FIELDS, type ProfileTextField } from "../assessment/roles"
import { insertStarterSet, starterFamilyShape } from "../assessment/starters"
import {
  clampLocale,
  isCriterionKey,
  promptLocale,
} from "../evaluationModel/localize"
import {
  TRACK_KEYS,
  templateContent,
} from "../evaluationModel/standardTemplate"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"
import { AI_MODEL_ID, AI_PROFILE_MODEL_ID, AI_PROVIDER } from "./config"
import { repairDraftWeights } from "./weights"

interface SettingsContext {
  locale: string
  industry: string
  employeeCount: number | undefined
  country: string
}

async function requireCompleteSettings(
  ctx: MutationCtx,
  orgId: string
): Promise<SettingsContext> {
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
  // Deliberately requires a SUBSET of getOnboardingStatus's settingsComplete:
  // currency is omitted because the AI prompts never use it. The onboarding
  // gate guarantees full settings are complete before the AI panels are
  // reachable, so the looser check here is safe and intentional.
  // All string fields are non-empty after the guard above.
  // employeeCount is optional: never asked in onboarding (decided 2026-06-05).
  const { country, language, industry, employeeCount } = settings
  return {
    locale: language,
    industry,
    employeeCount,
    country,
  }
}

export const requestModelDraft = adminMutation({
  args: { description: v.optional(v.string()), locale: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { description, locale }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: SUGGESTION_KINDS.modelDraft, modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
    // Spread optional fields only when defined: explicit undefined values are
    // not valid Convex values and would fail scheduler arg serialization.
    await ctx.scheduler.runAfter(0, internal.ai.generate.generateModelDraft, {
      suggestionId,
      locale: promptLocale(locale, settings.locale),
      industry: settings.industry,
      country: settings.country,
      ...(settings.employeeCount !== undefined
        ? { employeeCount: settings.employeeCount }
        : {}),
      ...(description !== undefined ? { description } : {}),
    })
    return suggestionId
  },
})

export const requestWeightReview = adminMutation({
  args: { locale: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { locale }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    if (criteria.length === 0) throw appError(ERROR_CODES.invalidInput)
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: SUGGESTION_KINDS.weightReview, modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
    const resolvedLocale = promptLocale(locale, settings.locale)
    // The AI quotes criterion names in its motivations: send the names the
    // requester actually SEES. Pristine template rows localize by key (the
    // same rule as getModel); custom and edited rows use their stored names.
    const content = templateContent(clampLocale(resolvedLocale))
    await ctx.scheduler.runAfter(0, internal.ai.generate.reviewWeights, {
      suggestionId,
      locale: resolvedLocale,
      industry: settings.industry,
      country: settings.country,
      ...(settings.employeeCount !== undefined
        ? { employeeCount: settings.employeeCount }
        : {}),
      criteria: criteria.map((criterion) => ({
        criterionId: criterion._id as string,
        name:
          criterion.templateKey !== undefined &&
          isCriterionKey(criterion.templateKey)
            ? content.criteria[criterion.templateKey].name
            : criterion.name,
        weightPoints: criterion.weightPoints,
      })),
    })
    return suggestionId
  },
})

interface DraftCriterion {
  name: string
  description: string
  helpText: string
  weightPoints: number
  anchors: string[]
}

export const confirmModelDraft = adminMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedIndexes: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedIndexes }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== SUGGESTION_KINDS.modelDraft ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const draft = suggestion.suggestedValue as { criteria: DraftCriterion[] }
    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    // Gaps after removal are intentional; max-based ordering avoids collisions.
    let order = existing.reduce(
      (max, criterion) => Math.max(max, criterion.order),
      0
    )
    const accepted = [...new Set(acceptedIndexes)].filter(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < draft.criteria.length
    )
    // Two passes: validate and collect first, then repair the accepted
    // subset's weight points to its own budget before inserting. The stored
    // draft is balanced as a WHOLE; a partial accept is generally not, and
    // the persisted allocation must stay exactly balanced (ADR-0004). The
    // pre-insert model is balanced, so repairing the inserted subset to
    // 3 x (inserted count) keeps the whole model balanced; accepting the
    // full draft passes through unchanged.
    const toInsert: { name: string; criterion: DraftCriterion }[] = []
    for (const index of accepted) {
      const criterion = draft.criteria[index]
      if (criterion === undefined) continue
      // LLM output crosses a trust boundary here: enforce the editor's input
      // contract plus length bounds before anything is persisted.
      const name = criterion.name?.trim() ?? ""
      if (
        name.length === 0 ||
        name.length > 200 ||
        criterion.description.length > 2000 ||
        criterion.helpText.length > 2000 ||
        criterion.anchors.length !== 6 ||
        criterion.anchors.some(
          (text) => text.trim().length === 0 || text.length > 1000
        ) ||
        !isWeightPoints(criterion.weightPoints)
      ) {
        continue
      }
      toInsert.push({ name, criterion })
    }
    const repairedPoints = repairDraftWeights(
      toInsert.map((entry) => entry.criterion.weightPoints)
    )
    const before = await deriveResults(ctx, ctx.orgId)
    for (const [position, entry] of toInsert.entries()) {
      order += 1
      await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId: model._id,
        name: entry.name,
        description: entry.criterion.description,
        helpText: entry.criterion.helpText,
        anchors: entry.criterion.anchors.map((text, level) => ({
          level,
          text,
        })),
        weightPoints: repairedPoints[position] ?? entry.criterion.weightPoints,
        order,
        isCustom: true,
      })
    }
    const insertedCount = toInsert.length
    if (insertedCount > 0) {
      // New criteria flip fully rated roles to incomplete: log the shifts.
      const after = await deriveResults(ctx, ctx.orgId)
      await logBandShifts(ctx, {
        orgId: ctx.orgId,
        actorId: ctx.authUserId,
        before: before.results,
        after: after.results,
      })
    }
    await ctx.db.patch(suggestionId, {
      status: insertedCount > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: SUGGESTION_KINDS.modelDraft,
        acceptedCount: insertedCount,
      },
    })
    return null
  },
})

// Applies the accepted weight-review MOVES. Every move is zero-sum (take N
// points from one criterion, give them to another), so any accepted subset
// keeps the allocation exactly balanced (ADR-0004). Bounds are re-checked
// cumulatively at apply time: moves stacking on the same criterion can be
// individually valid but jointly breach the 1-5 scale, and the breaching
// move is skipped, not clamped.
export const confirmWeightReview = adminMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedMoveIndexes: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedMoveIndexes }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== SUGGESTION_KINDS.weightReview ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const value = suggestion.suggestedValue as {
      moves: {
        fromCriterionId: string
        toCriterionId: string
        points: number
        motivation: string
      }[]
    }
    const accepted = [...new Set(acceptedMoveIndexes)]
      .filter(
        (index) =>
          Number.isInteger(index) && index >= 0 && index < value.moves.length
      )
      .sort((a, b) => a - b)
    const before = await deriveResults(ctx, ctx.orgId)
    let appliedCount = 0
    for (const index of accepted) {
      const move = value.moves[index]
      if (move === undefined) continue
      if (!Number.isInteger(move.points) || move.points < 1) continue
      const fromDocId = ctx.db.normalizeId("criteria", move.fromCriterionId)
      const toDocId = ctx.db.normalizeId("criteria", move.toCriterionId)
      if (fromDocId === null || toDocId === null || fromDocId === toDocId) {
        continue
      }
      // Re-reading per move sees the previous moves' patches (transactional
      // read-your-writes), which is exactly the cumulative bound check.
      const from = await ctx.db.get(fromDocId)
      const to = await ctx.db.get(toDocId)
      if (from === null || from.orgId !== ctx.orgId) continue
      if (to === null || to.orgId !== ctx.orgId) continue
      if (
        !isWeightPoints(from.weightPoints - move.points) ||
        !isWeightPoints(to.weightPoints + move.points)
      ) {
        continue
      }
      await ctx.db.patch(fromDocId, {
        weightPoints: from.weightPoints - move.points,
      })
      await ctx.db.patch(toDocId, {
        weightPoints: to.weightPoints + move.points,
      })
      appliedCount += 1
    }
    if (appliedCount > 0) {
      const after = await deriveResults(ctx, ctx.orgId)
      await logBandShifts(ctx, {
        orgId: ctx.orgId,
        actorId: ctx.authUserId,
        before: before.results,
        after: after.results,
      })
    }
    await ctx.db.patch(suggestionId, {
      status: appliedCount > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: SUGGESTION_KINDS.weightReview,
        appliedCount,
      },
    })
    return null
  },
})

// AI-writable job profile fields: the shared list from the role register.
// Title, function, and team are HR context the model cannot know; they are
// prompt INPUT only. Ratings are never AI territory (ADR-0003).
const ROLE_PROFILE_FIELDS = PROFILE_TEXT_FIELDS

function maxLengthFor(field: ProfileTextField): number {
  return field === "responsibilities" ? 2000 : 1000
}

// Role profile work is member scope (unlike model configuration): editors
// register and describe roles, so request/confirm use orgMutation.
export const requestRoleProfileDraft = orgMutation({
  args: {
    roleId: v.id("roles"),
    description: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  returns: v.id("suggestions"),
  handler: async (ctx, { roleId, description, locale }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.archivedAt !== undefined) {
      throw appError(ERROR_CODES.roleLocked)
    }
    // Tracks are fixed constants (ADR-0006): the prompt's track name is a
    // content lookup in the generation locale, no row to fetch.
    const resolvedLocale = promptLocale(locale, settings.locale)
    const trackName = templateContent(clampLocale(resolvedLocale)).trackNames[
      role.trackKey
    ]
    // Resolve the role's family NAME (the user-entered grouping) so the prompt
    // reflects it. One role -> a direct get is fine (no map needed). The role's
    // familyId always points to a same-org family (enforced at create/update),
    // so no extra org check is required. Undefined when the role has no family,
    // in which case the family arg is omitted and the prompt is unchanged.
    const family =
      role.familyId !== undefined
        ? (await ctx.db.get(role.familyId))?.name
        : undefined
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: SUGGESTION_KINDS.roleProfile, roleId },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      // Role-profile drafting runs on the faster profile model (the other
      // three suggestion kinds stay on the quality-defining default).
      model: { provider: AI_PROVIDER, model: AI_PROFILE_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
    await ctx.scheduler.runAfter(
      0,
      internal.ai.generate.generateRoleProfileDraft,
      {
        suggestionId,
        locale: resolvedLocale,
        industry: settings.industry,
        country: settings.country,
        ...(settings.employeeCount !== undefined
          ? { employeeCount: settings.employeeCount }
          : {}),
        title: role.title,
        trackName,
        roleFunction: role.function,
        team: role.team,
        ...(family !== undefined ? { family } : {}),
        ...(description !== undefined ? { description } : {}),
      }
    )
    return suggestionId
  },
})

export const confirmRoleProfileDraft = orgMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedFields: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedFields }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== SUGGESTION_KINDS.roleProfile ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const roleId = suggestion.target.roleId
    if (roleId === undefined) throw appError(ERROR_CODES.notFound)
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.archivedAt !== undefined) {
      throw appError(ERROR_CODES.roleLocked)
    }
    const value = suggestion.suggestedValue as {
      profile?: Record<string, unknown>
    } | null
    const profile = value?.profile ?? {}
    // LLM output crosses a trust boundary here: whitelist the field names,
    // require strings, trim, and re-enforce length bounds before patching.
    const patch: Record<string, string> = {}
    const appliedFields: string[] = []
    const acceptedSet = new Set(acceptedFields)
    for (const field of ROLE_PROFILE_FIELDS) {
      if (!acceptedSet.has(field)) continue
      const raw = profile[field]
      if (typeof raw !== "string") continue
      const trimmed = raw.trim()
      if (trimmed.length === 0 || trimmed.length > maxLengthFor(field)) {
        continue
      }
      patch[field] = trimmed
      appliedFields.push(field)
    }
    if (appliedFields.length > 0) {
      await ctx.db.patch(roleId, patch)
      await logAudit(ctx, {
        orgId: ctx.orgId,
        type: AUDIT_EVENTS.roleUpdated,
        actorId: ctx.authUserId,
        payload: { roleId, fields: appliedFields },
      })
    }
    await ctx.db.patch(suggestionId, {
      status: appliedFields.length > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: SUGGESTION_KINDS.roleProfile,
        appliedCount: appliedFields.length,
      },
    })
    return null
  },
})

// The onboarding paste-import: the user pastes their roles (optionally
// pre-grouped into families) and the AI organizes them into a starter-set
// proposal. Member scope, like createStarterSet (the role register).
export const requestStarterImport = orgMutation({
  args: { rawText: v.string(), locale: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { rawText, locale }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    // The whole pasted role list is prompt data; anything longer than the
    // shared limit is almost certainly not a role list and would blow the
    // prompt budget. The client Zod gate enforces the same constant.
    const text = rawText.trim()
    if (text.length === 0 || text.length > MAX_STARTER_IMPORT_TEXT) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const resolvedLocale = promptLocale(locale, settings.locale)
    // Tracks are fixed constants (ADR-0006): the prompt's track names are a
    // content lookup in the generation locale, no rows to fetch.
    const trackNames = templateContent(clampLocale(resolvedLocale)).trackNames
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: SUGGESTION_KINDS.starterImport },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
    await ctx.scheduler.runAfter(
      0,
      internal.ai.generate.generateStarterImport,
      {
        suggestionId,
        locale: resolvedLocale,
        industry: settings.industry,
        country: settings.country,
        ...(settings.employeeCount !== undefined
          ? { employeeCount: settings.employeeCount }
          : {}),
        rawText: text,
        tracks: TRACK_KEYS.map((key) => ({ key, name: trackNames[key] })),
      }
    )
    return suggestionId
  },
})

// Confirms the AI import with the user's EDITED list: the suggestion stores
// what the AI proposed, the confirm receives what the human approved after
// review (ADR-0003). Rows insert through the same validated path as
// createStarterSet; an emptied list confirms nothing and closes the
// suggestion as rejected, mirroring the other confirm paths.
export const confirmStarterImport = orgMutation({
  args: {
    suggestionId: v.id("suggestions"),
    families: v.array(starterFamilyShape),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, families }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== SUGGESTION_KINDS.starterImport ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const { familyCount, roleCount } = await insertStarterSet(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      families,
      source: "aiImport",
    })
    await ctx.db.patch(suggestionId, {
      status: familyCount > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: SUGGESTION_KINDS.starterImport,
        familyCount,
        roleCount,
      },
    })
    return null
  },
})

// Member scope: dismissing applies nothing, and editors must be able to
// dismiss their own role-profile drafts. Two guards keep this from becoming a
// backdoor around the confirm paths' scoping (model.* confirms are
// adminMutation, role.profile is orgMutation):
//   1. model.draft / model.weightReview are admin-configuration surfaces, so
//      dismissing them requires admin, mirroring their confirm paths. Editors
//      keep dismiss rights over role.profile only.
//   2. Only the open states (suggested, failed) are dismissible. confirmed and
//      rejected are terminal, so a confirmed suggestion's human-confirmation
//      provenance can never be flipped to rejected and reattributed.
// The dismisser is recorded in rejectedBy, never confirmedBy, and the
// transition writes an audit row like every other state-changing mutation.
export const rejectSuggestion = orgMutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (suggestion === null || suggestion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const isModelTarget =
      suggestion.target.kind === SUGGESTION_KINDS.modelDraft ||
      suggestion.target.kind === SUGGESTION_KINDS.weightReview
    if (isModelTarget && ctx.role !== "admin") {
      throw appError(ERROR_CODES.adminRequired)
    }
    if (suggestion.status !== "suggested" && suggestion.status !== "failed") {
      throw appError(ERROR_CODES.invalidTransition)
    }
    await ctx.db.patch(suggestionId, {
      status: "rejected",
      rejectedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionRejected,
      actorId: ctx.authUserId,
      payload: { suggestionId, kind: suggestion.target.kind },
    })
    return null
  },
})

// After a confirmed weight review the allocation IS what the AI just
// reviewed: re-running it immediately would mostly repeat itself and invites
// spamming the button. The lock holds until the weighting actually changes
// again: any model.updated audit row (weights rebalanced, criterion added or
// removed) or a confirmed model draft NEWER than the confirm releases it.
// Dismissed reviews never lock. Alpha-scale data: the full-org collect is
// deliberate and fine.
export const getWeightReviewLock = orgQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const confirmed = await ctx.db
      .query("suggestions")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", ctx.orgId).eq("status", "confirmed")
      )
      .collect()
    let lastReviewAt = 0
    let lastDraftAt = 0
    for (const row of confirmed) {
      if (row.target.kind === SUGGESTION_KINDS.weightReview) {
        lastReviewAt = Math.max(lastReviewAt, row._creationTime)
      }
      if (row.target.kind === SUGGESTION_KINDS.modelDraft) {
        lastDraftAt = Math.max(lastDraftAt, row._creationTime)
      }
    }
    if (lastReviewAt === 0) return false
    const lastUpdate = await ctx.db
      .query("auditLog")
      .withIndex("by_org_type", (q) =>
        q.eq("orgId", ctx.orgId).eq("type", AUDIT_EVENTS.modelUpdated)
      )
      .order("desc")
      .first()
    const lastChangeAt = Math.max(lastUpdate?._creationTime ?? 0, lastDraftAt)
    return lastReviewAt > lastChangeAt
  },
})

// Open suggestions drive the reactive AI panels (spinner on "generating",
// review list on "suggested", translated error on "failed").
export const getOpenSuggestions = orgQuery({
  // kind narrows the read to one suggestion kind via the kind-scoped index:
  // without it, a panel's row can be evicted from the per-status take cap by
  // 20 newer open rows of OTHER kinds and silently disappear from the panel.
  args: { kind: v.optional(v.string()) },
  returns: v.array(
    v.object({
      suggestionId: v.id("suggestions"),
      kind: v.string(),
      status: v.string(),
      suggestedValue: v.any(),
      errorCode: v.union(v.string(), v.null()),
      createdAt: v.number(),
      roleId: v.union(v.id("roles"), v.null()),
    })
  ),
  handler: async (ctx, { kind }) => {
    const open = []
    for (const status of ["generating", "suggested", "failed"] as const) {
      // A crashed action never reaches markFailed; the panel treats generating
      // rows older than ~90s as retryable (createdAt drives that).
      const rows =
        kind === undefined
          ? await ctx.db
              .query("suggestions")
              .withIndex("by_org_status", (q) =>
                q.eq("orgId", ctx.orgId).eq("status", status)
              )
              .order("desc")
              .take(20)
          : await ctx.db
              .query("suggestions")
              .withIndex("by_org_status_kind", (q) =>
                q
                  .eq("orgId", ctx.orgId)
                  .eq("status", status)
                  .eq("target.kind", kind)
              )
              .order("desc")
              .take(20)
      open.push(...rows)
    }
    return open.map((row) => ({
      suggestionId: row._id,
      kind: row.target.kind,
      status: row.status,
      suggestedValue: row.suggestedValue ?? null,
      errorCode: row.errorCode ?? null,
      createdAt: row._creationTime,
      roleId: row.target.roleId ?? null,
    }))
  },
})
