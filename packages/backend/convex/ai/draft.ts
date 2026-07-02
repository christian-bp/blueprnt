"use node"

import { SUGGESTION_KINDS } from "@workspace/constants"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { action } from "../_generated/server"
import { appError, ERROR_CODES } from "../lib/errors"
import { AI_PROFILE_MODEL_ID, AI_PROVIDER } from "./config"
import {
  generateCriterionComplianceText,
  generateRoleProfileText,
} from "./generate"

// The interactive job-profile draft: generates { purpose, responsibilities }
// from the role's context and RETURNS them to the client (no suggestion row,
// no auto-apply). The client fills the edit form; Save persists via updateRole.
// Usage telemetry is recorded per call, exactly like the onboarding prefill.
// Org scope + auth are re-checked in collectRoleDraftContext before any model
// call (ADR-0003: AI in actions, EU model, role/org content only).
export const draftRoleProfile = action({
  args: {
    orgId: v.string(),
    roleId: v.id("roles"),
    description: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  returns: v.object({ purpose: v.string(), responsibilities: v.string() }),
  handler: async (
    ctx,
    { orgId, roleId, description, locale }
  ): Promise<{ purpose: string; responsibilities: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw appError(ERROR_CODES.notAuthenticated)

    const { actorId, input } = await ctx.runQuery(
      internal.ai.suggest.collectRoleDraftContext,
      {
        orgId,
        userId: identity.subject,
        roleId,
        ...(locale !== undefined ? { locale } : {}),
      }
    )

    let profile: { purpose: string; responsibilities: string }
    let usage: Awaited<ReturnType<typeof generateRoleProfileText>>["usage"]
    try {
      const generated = await generateRoleProfileText({
        ...input,
        ...(description !== undefined && description !== ""
          ? { description }
          : {}),
      })
      profile = generated.profile
      usage = generated.usage
    } catch (error) {
      // The unavailable-model branch keeps its own code; any other failure
      // (generation, schema) is a generation failure for the panel.
      const code =
        error instanceof Error && error.message === ERROR_CODES.aiUnavailable
          ? ERROR_CODES.aiUnavailable
          : ERROR_CODES.aiGenerationFailed
      throw appError(code)
    }

    // Best effort: a usage-write failure must not discard the successful generation.
    try {
      await ctx.runMutation(internal.ai.usage.recordAiUsageDirect, {
        orgId,
        kind: SUGGESTION_KINDS.roleProfile,
        provider: AI_PROVIDER,
        model: AI_PROFILE_MODEL_ID,
        actorId,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      })
    } catch (error) {
      console.error("draft usage recording failed", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // The values are already length-bounded in-process by roleProfileSchema
    // (Zod min/max) inside generateRoleProfileText; trim stray whitespace
    // before returning.
    return {
      purpose: profile.purpose.trim(),
      responsibilities: profile.responsibilities.trim(),
    }
  },
})

// The interactive criterion compliance draft: generates the six rationale +
// bias-review fields from the criterion's context and RETURNS them to the
// client (no suggestion row, no auto-apply). Admin-only (compliance editing is
// admin scope). Usage telemetry is recorded per call. Org scope + admin auth
// are re-checked in collectCriterionComplianceContext before any model call
// (ADR-0003: AI in actions, EU model, criterion/model/org content only).
export const draftCriterionCompliance = action({
  args: {
    orgId: v.string(),
    criterionId: v.id("criteria"),
    locale: v.optional(v.string()),
  },
  returns: v.object({
    purpose: v.string(),
    whyRelevant: v.string(),
    overlapNotes: v.string(),
    biasRisk: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    biasComment: v.string(),
    biasAction: v.string(),
  }),
  handler: async (ctx, { orgId, criterionId, locale }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw appError(ERROR_CODES.notAuthenticated)

    const { actorId, input } = await ctx.runQuery(
      internal.ai.suggest.collectCriterionComplianceContext,
      {
        orgId,
        userId: identity.subject,
        criterionId,
        ...(locale !== undefined ? { locale } : {}),
      }
    )

    let compliance: Awaited<
      ReturnType<typeof generateCriterionComplianceText>
    >["compliance"]
    let usage: Awaited<
      ReturnType<typeof generateCriterionComplianceText>
    >["usage"]
    try {
      const generated = await generateCriterionComplianceText(input)
      compliance = generated.compliance
      usage = generated.usage
    } catch (error) {
      const code =
        error instanceof Error && error.message === ERROR_CODES.aiUnavailable
          ? ERROR_CODES.aiUnavailable
          : ERROR_CODES.aiGenerationFailed
      throw appError(code)
    }

    // Best effort: a usage-write failure must not discard the successful generation.
    try {
      await ctx.runMutation(internal.ai.usage.recordAiUsageDirect, {
        orgId,
        kind: SUGGESTION_KINDS.criterionCompliance,
        provider: AI_PROVIDER,
        model: AI_PROFILE_MODEL_ID,
        actorId,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      })
    } catch (error) {
      console.error("compliance draft usage recording failed", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return {
      purpose: compliance.purpose.trim(),
      whyRelevant: compliance.whyRelevant.trim(),
      overlapNotes: compliance.overlapNotes.trim(),
      biasRisk: compliance.biasRisk,
      biasComment: compliance.biasComment.trim(),
      biasAction: compliance.biasAction.trim(),
    }
  },
})
