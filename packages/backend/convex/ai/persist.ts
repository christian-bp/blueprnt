import { isBalanced } from "@workspace/core"
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { appError, ERROR_CODES } from "../lib/errors"

export const saveDraft = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    criteria: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        helpText: v.string(),
        weightPoints: v.number(),
        // Convex has no length validator; the handler guards anchors.length.
        anchors: v.array(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, criteria }) => {
    if (criteria.some((criterion) => criterion.anchors.length !== 6)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    // The action repairs the allocation before calling; this gate keeps an
    // unbalanced draft from ever reaching the suggestion store (ADR-0004).
    if (!isBalanced(criteria.map((criterion) => criterion.weightPoints))) {
      throw appError(ERROR_CODES.weightsUnbalanced)
    }
    await ctx.db.patch(suggestionId, {
      suggestedValue: { criteria },
      status: "suggested",
    })
    return null
  },
})

export const saveWeightReview = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    // Criterion ids stay strings here: they are LLM-echoed values, and the
    // confirm path re-validates them with ctx.db.normalizeId + an org check
    // before anything is patched.
    moves: v.array(
      v.object({
        fromCriterionId: v.string(),
        toCriterionId: v.string(),
        points: v.number(),
        motivation: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, moves }) => {
    await ctx.db.patch(suggestionId, {
      suggestedValue: { moves },
      status: "suggested",
    })
    return null
  },
})

export const saveRoleProfileDraft = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    profile: v.object({
      purpose: v.string(),
      responsibilities: v.string(),
      decisionMandate: v.optional(v.string()),
      stakeholders: v.optional(v.string()),
      knowledge: v.optional(v.string()),
      financial: v.optional(v.string()),
      people: v.optional(v.string()),
      risk: v.optional(v.string()),
      deliverables: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, profile }) => {
    await ctx.db.patch(suggestionId, {
      suggestedValue: { profile },
      status: "suggested",
    })
    return null
  },
})

// Failures persist a machine-readable errors.* code; the frontend translates.
export const markFailed = internalMutation({
  args: { suggestionId: v.id("suggestions"), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, { suggestionId, errorCode }) => {
    await ctx.db.patch(suggestionId, { status: "failed", errorCode })
    return null
  },
})
