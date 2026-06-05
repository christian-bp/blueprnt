import { IMPORTANCE_LEVELS, type ImportanceLevel } from "@workspace/core"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import { AI_MODEL_ID, AI_PROVIDER } from "./config"

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
  args: { description: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { description }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.draft", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
    // Spread optional fields only when defined: explicit undefined values are
    // not valid Convex values and would fail scheduler arg serialization.
    await ctx.scheduler.runAfter(0, internal.ai.generate.generateModelDraft, {
      suggestionId,
      locale: settings.locale,
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

export const requestImportanceReview = adminMutation({
  args: {},
  returns: v.id("suggestions"),
  handler: async (ctx) => {
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
      target: { kind: "model.importanceReview", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
    await ctx.scheduler.runAfter(0, internal.ai.generate.reviewImportances, {
      suggestionId,
      locale: settings.locale,
      industry: settings.industry,
      country: settings.country,
      ...(settings.employeeCount !== undefined
        ? { employeeCount: settings.employeeCount }
        : {}),
      criteria: criteria.map((criterion) => ({
        criterionId: criterion._id as string,
        name: criterion.name,
        importanceLevel: criterion.importanceLevel,
      })),
    })
    return suggestionId
  },
})

interface DraftCriterion {
  name: string
  description: string
  helpText: string
  importanceLevel: number
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
      suggestion.target.kind !== "model.draft" ||
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
    // Count criteria actually inserted: an accepted index whose criterion fails
    // the trust-boundary checks below is skipped and must not count as applied.
    let insertedCount = 0
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
        !IMPORTANCE_LEVELS.includes(
          criterion.importanceLevel as ImportanceLevel
        )
      ) {
        continue
      }
      order += 1
      const criterionId = await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId: model._id,
        name,
        description: criterion.description,
        helpText: criterion.helpText,
        importanceLevel: criterion.importanceLevel,
        order,
        isCustom: true,
      })
      for (const [level, text] of criterion.anchors.entries()) {
        await ctx.db.insert("criterionAnchors", { criterionId, level, text })
      }
      insertedCount += 1
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
        kind: "model.draft",
        acceptedCount: insertedCount,
      },
    })
    return null
  },
})

export const confirmImportanceReview = adminMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedCriterionIds: v.array(v.id("criteria")),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedCriterionIds }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== "model.importanceReview" ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const value = suggestion.suggestedValue as {
      adjustments: {
        criterionId: string
        suggestedImportanceLevel: number
        motivation: string
      }[]
    }
    const acceptedSet = new Set<string>(acceptedCriterionIds)
    let appliedCount = 0
    for (const adjustment of value.adjustments) {
      if (!acceptedSet.has(adjustment.criterionId)) continue
      if (
        !IMPORTANCE_LEVELS.includes(
          adjustment.suggestedImportanceLevel as ImportanceLevel
        )
      ) {
        continue
      }
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        adjustment.criterionId
      )
      if (criterionDocId === null) continue
      const criterion = await ctx.db.get(criterionDocId)
      if (criterion === null || criterion.orgId !== ctx.orgId) continue
      await ctx.db.patch(criterionDocId, {
        importanceLevel: adjustment.suggestedImportanceLevel,
      })
      appliedCount += 1
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
        kind: "model.importanceReview",
        appliedCount,
      },
    })
    return null
  },
})

export const rejectSuggestion = adminMutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (suggestion === null || suggestion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    await ctx.db.patch(suggestionId, {
      status: "rejected",
      confirmedBy: ctx.authUserId,
    })
    return null
  },
})

// Open suggestions drive the reactive AI panels (spinner on "generating",
// review list on "suggested", translated error on "failed").
export const getOpenSuggestions = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      suggestionId: v.id("suggestions"),
      kind: v.string(),
      status: v.string(),
      suggestedValue: v.any(),
      errorCode: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const open = []
    for (const status of ["generating", "suggested", "failed"] as const) {
      // A crashed action never reaches markFailed; the panel treats generating
      // rows older than ~90s as retryable (createdAt drives that).
      const rows = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", ctx.orgId).eq("status", status)
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
    }))
  },
})
