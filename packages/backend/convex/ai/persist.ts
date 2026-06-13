import { isBalanced } from "@workspace/core"
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { MAX_FAMILIES, MAX_ROLES } from "../assessment/starters"
import { isTrackKey } from "../evaluationModel/localize"
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

// The action sanitizes the import before calling (ai/starterImport); these
// gates keep an out-of-contract grouping from ever reaching the suggestion
// store, so a stored import is always confirmable as-is.
export const saveStarterImport = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    families: v.array(
      v.object({
        name: v.string(),
        roles: v.array(
          v.object({
            title: v.string(),
            trackKey: v.string(),
          })
        ),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, families }) => {
    const totalRoles = families.reduce(
      (sum, family) => sum + family.roles.length,
      0
    )
    if (
      families.length === 0 ||
      families.length > MAX_FAMILIES ||
      totalRoles === 0 ||
      totalRoles > MAX_ROLES ||
      families.some(
        (family) =>
          family.name.trim() === "" ||
          family.roles.some((role) => !isTrackKey(role.trackKey))
      )
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }
    await ctx.db.patch(suggestionId, {
      suggestedValue: { families },
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
