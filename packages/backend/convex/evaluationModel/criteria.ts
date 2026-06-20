import {
  isBalanced,
  isWeightPoints,
  MIN_CRITERIA,
  NEUTRAL_WEIGHT_POINTS,
} from "@workspace/core"
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { repairDraftWeights } from "../ai/weights"
import { deriveResults, logBandShifts } from "../assessment/compute"
import {
  anchorDiff,
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  buildDeleteChanges,
  CRITERION_AUDIT_FIELDS,
  logAudit,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

// The criterion editor: add, text update, reweight, remove. E2 extends this
// surface further (rationale, bias review).
//
// Weighting invariant (ADR-0004): the persisted allocation is ALWAYS exactly
// balanced against the point budget (criteria count x 3). The mutations
// uphold it from different angles: addCriterion enters at the neutral 3 (the
// budget grows by 3 at the same time), rebalanceWeights swaps the whole
// allocation atomically and validates the exact sum, removeCriterion
// deterministically redistributes the removed criterion's surplus or deficit
// across the survivors, and updateCriterion deliberately never touches
// weightPoints (texts only).
export const addCriterion = adminMutation({
  args: {
    name: v.string(),
    description: v.string(),
    helpText: v.string(),
    anchors: v.array(v.string()),
  },
  returns: v.id("criteria"),
  handler: async (ctx, args) => {
    if (args.name.trim().length === 0 || args.anchors.length !== 6) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const before = await deriveResults(ctx, ctx.orgId)
    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    // Gaps after removal are intentional; E2 owns renumber/reorder.
    const maxOrder = existing.reduce(
      (max, criterion) => Math.max(max, criterion.order),
      0
    )
    const criterionId = await ctx.db.insert("criteria", {
      orgId: ctx.orgId,
      modelId: model._id,
      name: args.name.trim(),
      description: args.description,
      helpText: args.helpText,
      anchors: args.anchors.map((text, level) => ({ level, text })),
      weightPoints: NEUTRAL_WEIGHT_POINTS,
      order: maxOrder + 1,
      isCustom: true,
    })
    const after = await deriveResults(ctx, ctx.orgId)
    await logBandShifts(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.modelUpdated, criterionId },
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: {
        change: "criterion.added",
        criterionId,
        modelId: model._id,
        // A freshly created criterion: every field is a from:null -> to:value
        // create-change, including the anchors array and the neutral weight.
        changes: buildCreateChanges(
          {
            name: args.name.trim(),
            description: args.description,
            helpText: args.helpText,
            anchors: args.anchors.map((text, level) => ({ level, text })),
            weightPoints: NEUTRAL_WEIGHT_POINTS,
            order: maxOrder + 1,
            isCustom: true,
          },
          // The full criterion field set; templateKey is absent from `after`
          // here (a fresh custom criterion has none) so buildCreateChanges skips
          // it, yielding the same change set as the 7-field inline list did.
          CRITERION_AUDIT_FIELDS
        ),
      },
    })
    return criterionId
  },
})

// Edits a criterion's texts: name, description, help text, and the six
// assessment anchors. Weights are NOT edited here (rebalanceWeights owns the
// zero-sum flow), and a text change can never move a score, so there is no
// band-shift diff. Editing a template-seeded criterion materializes the
// texts as organization content: templateKey is cleared, so getModel stops
// localizing the row and renders it as stored (see localize.ts). This is the
// "start from the standard model, then adapt" path.
export const updateCriterion = adminMutation({
  args: {
    criterionId: v.id("criteria"),
    name: v.string(),
    description: v.string(),
    helpText: v.string(),
    anchors: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.name.trim().length === 0 || args.anchors.length !== 6) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const criterion = await ctx.db.get(args.criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const newAnchors = args.anchors.map((text, level) => ({ level, text }))
    // `criterion` is the pre-patch in-memory doc: Convex patch does not mutate
    // the already-read object, so it is safe to diff against the new values.
    await ctx.db.patch(args.criterionId, {
      name: args.name.trim(),
      description: args.description,
      helpText: args.helpText,
      anchors: newAnchors,
      templateKey: undefined,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: {
        change: "criterion.updated",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        // Only changed text fields are recorded. `templateKey: undefined` in
        // `after` makes buildChanges emit key -> null when a custom edit
        // detaches a template-seeded criterion; anchorDiff adds the anchors
        // entry only when the level-ordered texts actually differ.
        changes: {
          ...buildChanges(
            criterion,
            {
              name: args.name.trim(),
              description: args.description,
              helpText: args.helpText,
              templateKey: undefined,
            },
            ["name", "description", "helpText", "templateKey"]
          ),
          ...anchorDiff(criterion.anchors, newAnchors),
        },
      },
    })
    return null
  },
})

// Atomic reweighting: receives the FULL allocation (every model criterion
// exactly once), validates each value against the 1-5 scale and the exact
// point budget, and applies the changes in one transaction. One band-shift
// diff and one audit row per save, with from/to per changed criterion.
// Deliberately does not touch templateKey: template texts stay localized;
// weighting is organization state by design.
export const rebalanceWeights = adminMutation({
  args: {
    allocations: v.array(
      v.object({ criterionId: v.id("criteria"), weightPoints: v.number() })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { allocations }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()

    const pointsById = new Map<string, number>()
    for (const allocation of allocations) {
      if (
        !isWeightPoints(allocation.weightPoints) ||
        pointsById.has(allocation.criterionId as string)
      ) {
        throw appError(ERROR_CODES.invalidInput)
      }
      pointsById.set(allocation.criterionId as string, allocation.weightPoints)
    }
    // Bijection: every model criterion exactly once, nothing extra.
    if (
      pointsById.size !== criteria.length ||
      criteria.some((criterion) => !pointsById.has(criterion._id as string))
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }
    if (!isBalanced(allocations.map((a) => a.weightPoints))) {
      throw appError(ERROR_CODES.weightsUnbalanced)
    }

    const changed = criteria.filter(
      (criterion) =>
        pointsById.get(criterion._id as string) !== criterion.weightPoints
    )
    // No-op when nothing moves; avoids spurious audit rows.
    if (changed.length === 0) return null

    const before = await deriveResults(ctx, ctx.orgId)
    for (const criterion of changed) {
      const weightPoints = pointsById.get(criterion._id as string)
      if (weightPoints === undefined) continue
      await ctx.db.patch(criterion._id, { weightPoints })
    }
    const after = await deriveResults(ctx, ctx.orgId)
    await logBandShifts(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.modelUpdated, entityId: model._id },
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: {
        change: "weights.rebalanced",
        modelId: model._id,
        budget: criteria.length * 3,
        count: changed.length,
        // Bulk shape: one item per criterion whose weight actually moved. The
        // `from` is the in-memory pre-patch weightPoints (the patch loop does
        // not mutate the already-read docs); the `to` is the new allocation.
        items: changed.map((criterion) => ({
          criterionId: criterion._id,
          label: criterion.name,
          changes: {
            weightPoints: {
              from: criterion.weightPoints,
              to: pointsById.get(criterion._id as string),
            },
          },
        })),
      },
    })
    return null
  },
})

// Removes a criterion (its anchors ride along on the document, ADR-0006)
// and its ratings. The point budget
// shrinks by 3 while the sum shrinks by the criterion's points, so unless
// the criterion stood at the neutral 3 the survivors are off budget by
// (3 - points). The same deterministic walk that repairs AI drafts absorbs
// the difference (pull the heaviest down while over budget, push the
// lightest up while under; ties resolve in display order), and every
// adjustment is recorded in the removal's audit payload. One click always
// works; the user never has to pre-stage a removal by reweighting. Wrapped
// in a band-shift diff: removal can change scores or flip roles to
// complete/incomplete.
//
// Composition floor: once onboarding is complete a model never drops below
// MIN_CRITERIA. While still onboarding, removal is free at any count (a
// model under construction must be freely editable); the onboarding gates
// enforce the floor before completion instead.
export const removeCriterion = adminMutation({
  args: { criterionId: v.id("criteria") },
  returns: v.null(),
  handler: async (ctx, { criterionId }) => {
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (typeof settings?.onboardingCompletedAt === "number") {
      const count = (
        await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", criterion.modelId))
          .collect()
      ).length
      if (count - 1 < MIN_CRITERIA) {
        throw appError(ERROR_CODES.tooFewCriteria)
      }
    }
    const before = await deriveResults(ctx, ctx.orgId)
    // Roles exist now (E3): deleting a criterion also deletes its ratings so
    // no orphans linger. The engine additionally ignores strays (defense in
    // depth), but the source of truth stays clean.
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_criterion", (q) => q.eq("criterionId", criterionId))
      .collect()
    for (const rating of ratings) {
      await ctx.db.delete(rating._id)
    }
    await ctx.db.delete(criterionId)
    // Redistribute the freed or missing points across the survivors so the
    // allocation lands exactly on the shrunken budget. No-op when the
    // removed criterion stood at 3.
    const remaining = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", criterion.modelId))
      .collect()
    remaining.sort((a, b) => a.order - b.order)
    const repaired = repairDraftWeights(
      remaining.map((row) => row.weightPoints)
    )
    const rebalancedSurvivors: {
      criterionId: Id<"criteria">
      label: string
      changes: { weightPoints: { from: number; to: number } }
    }[] = []
    for (const [index, row] of remaining.entries()) {
      const weightPoints = repaired[index]
      if (weightPoints === undefined || weightPoints === row.weightPoints) {
        continue
      }
      await ctx.db.patch(row._id, { weightPoints })
      // `row` is the in-memory pre-patch survivor: `row.weightPoints` is the
      // repaired criterion's `from`, `weightPoints` the repaired `to`.
      rebalancedSurvivors.push({
        criterionId: row._id,
        label: row.name,
        changes: { weightPoints: { from: row.weightPoints, to: weightPoints } },
      })
    }
    const after = await deriveResults(ctx, ctx.orgId)
    await logBandShifts(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.modelUpdated, criterionId },
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: {
        change: "criterion.removed",
        modelId: criterion.modelId,
        // Ratings are COUNT-ONLY: never embed a rating value or notes anywhere
        // in the payload (no person/role-rating data on the model trail).
        deletedRatingCount: ratings.length,
        // The budget shrinks by 3 (one criterion fewer).
        budget: { from: (remaining.length + 1) * 3, to: remaining.length * 3 },
        // The removed criterion as a full delete-snapshot (all fields to:null),
        // `criterion` read before the delete.
        changes: buildDeleteChanges(criterion, CRITERION_AUDIT_FIELDS),
        // Survivors whose weight was repaired onto the shrunken budget.
        count: rebalancedSurvivors.length,
        items: rebalancedSurvivors,
      },
    })
    return null
  },
})
