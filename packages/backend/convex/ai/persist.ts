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
        importanceLevel: v.number(),
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
    await ctx.db.patch(suggestionId, {
      suggestedValue: { criteria },
      status: "suggested",
    })
    return null
  },
})

export const saveImportanceReview = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    // criterionId stays a string here: it is an LLM-echoed value, and the
    // confirm path re-validates it with ctx.db.normalizeId + an org check
    // before anything is patched.
    adjustments: v.array(
      v.object({
        criterionId: v.string(),
        suggestedImportanceLevel: v.number(),
        motivation: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, adjustments }) => {
    await ctx.db.patch(suggestionId, {
      suggestedValue: { adjustments },
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
