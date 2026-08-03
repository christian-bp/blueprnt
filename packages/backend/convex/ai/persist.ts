import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import { isBalanced } from "@workspace/core"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../_generated/server"
import { isTrackKey } from "../evaluationModel/localize"
import { appError, ERROR_CODES } from "../lib/errors"

// The closed end of the suggestion lifecycle (ADR-0003). Confirmed and
// rejected are terminal: the human verdict has been recorded, so nothing may
// write over it afterwards, neither a late generation (below) nor a second
// dismissal (rejectSuggestion).
export function isSuggestionClosed(
  status: Doc<"suggestions">["status"]
): boolean {
  return status === "confirmed" || status === "rejected"
}

// Every terminal write a generation makes goes through here. The action runs
// for up to a minute after the request, and the row can be closed while it is
// still in flight: the user dismisses the proposal and walks away. Patching
// unconditionally then flips that rejected row back to "suggested" (or
// "failed"), and the proposal the user dismissed ambushes them on the next
// visit. A late outcome for a closed row is therefore dropped, not written,
// and dropping it is not an error: nobody is waiting for it.
async function patchOpenSuggestion(
  ctx: MutationCtx,
  suggestionId: Id<"suggestions">,
  patch: Partial<Doc<"suggestions">>
): Promise<void> {
  const suggestion = await ctx.db.get(suggestionId)
  if (suggestion === null || isSuggestionClosed(suggestion.status)) return
  await ctx.db.patch(suggestionId, patch)
}

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
    await patchOpenSuggestion(ctx, suggestionId, {
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
    await patchOpenSuggestion(ctx, suggestionId, {
      suggestedValue: { moves },
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
    // Whether the caps cost the user roles the model had returned. Stored with
    // the proposal because the review is the only place that can say so, and
    // it cannot re-derive it: it never sees what was clamped away.
    truncated: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, families, truncated }) => {
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
    await patchOpenSuggestion(ctx, suggestionId, {
      suggestedValue: { families, truncated },
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
    await patchOpenSuggestion(ctx, suggestionId, {
      status: "failed",
      errorCode,
    })
    return null
  },
})
