import {
  DIMENSION_MAX_ACTIVE,
  isBalanced,
  isWeightPoints,
  MODEL_MAX_CRITERIA,
  NEUTRAL_WEIGHT_POINTS,
} from "@workspace/core"
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { repairDraftWeights } from "../ai/weights"
import { deriveResults } from "../assessment/compute"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation } from "../lib/functions"
import { reopenApprovalIfSet } from "./approval"
import { criteriaLibraryContent, LIBRARY_DIMENSION } from "./criteriaLibrary"
import { resolveContentLocale } from "./model"
import { libraryKeyValidator } from "./tables"

// The criterion selector: activate (from the library) and deactivate, plus
// reweighting. Library-only, fixed texts (ADR-0021 addendum, decision 8):
// there is no create/edit-text path left, only a selection to turn on or off.
//
// Weighting invariant (ADR-0004): the persisted allocation is ALWAYS exactly
// balanced against the point budget (criteria count x 3). The mutations
// uphold it from different angles: activateCriterion enters at the neutral 3
// (the budget grows by 3 at the same time), rebalanceWeights swaps the whole
// allocation atomically and validates the exact sum, and deactivateCriterion
// deterministically redistributes the removed criterion's surplus or deficit
// across the survivors.
export const activateCriterion = orgMutation({
  args: { libraryKey: libraryKeyValidator },
  returns: v.id("criteria"),
  handler: async (ctx, { libraryKey }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)

    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    if (existing.some((criterion) => criterion.libraryKey === libraryKey)) {
      throw appError(ERROR_CODES.criterionAlreadySelected)
    }
    if (existing.length >= MODEL_MAX_CRITERIA) {
      throw appError(ERROR_CODES.tooManyCriteria)
    }
    const dimensionKey = LIBRARY_DIMENSION[libraryKey]
    const activeInDimension = existing.filter(
      (criterion) => LIBRARY_DIMENSION[criterion.libraryKey] === dimensionKey
    ).length
    if (activeInDimension >= DIMENSION_MAX_ACTIVE[dimensionKey]) {
      throw appError(ERROR_CODES.dimensionCapExceeded)
    }

    // Pre-fills the kriterieurvalsprotokoll's purpose/whyRelevant from the
    // library's own definition/whenSuitable text, in the org's content locale,
    // as an editable documentation START (documentation completes before
    // approval, not at activation time; ADR-0021 addendum).
    const locale = await resolveContentLocale(ctx, ctx.orgId)
    const entry = criteriaLibraryContent(locale).criteria[libraryKey]

    // Gaps after deactivation are intentional; max-based ordering avoids
    // collisions. No manual reorder in this program (selection order only).
    const maxOrder = existing.reduce(
      (max, criterion) => Math.max(max, criterion.order),
      0
    )
    const before = await deriveResults(ctx, ctx.orgId)
    const criterionId = await ctx.db.insert("criteria", {
      orgId: ctx.orgId,
      modelId: model._id,
      libraryKey,
      weightPoints: NEUTRAL_WEIGHT_POINTS,
      order: maxOrder + 1,
      purpose: entry.fullDefinition,
      whyRelevant: entry.whenSuitable,
    })
    // A method-affecting change re-opens approval (ADR-0023).
    await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.criterionActivated)
    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.criterionActivated, criterionId },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.criterionActivated,
      payload: {
        criterionId,
        modelId: model._id,
        libraryKey,
        dimensionKey,
        weightPoints: NEUTRAL_WEIGHT_POINTS,
      },
    })
    return criterionId
  },
})

// Atomic reweighting: receives the FULL allocation (every model criterion
// exactly once), validates each value against the 1-5 scale and the exact
// point budget, and applies the changes in one transaction. One level-shift
// diff and one audit row per save, with from/to per changed criterion.
export const rebalanceWeights = orgMutation({
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

    const locale = await resolveContentLocale(ctx, ctx.orgId)
    const content = criteriaLibraryContent(locale)

    const before = await deriveResults(ctx, ctx.orgId)
    for (const criterion of changed) {
      const weightPoints = pointsById.get(criterion._id as string)
      if (weightPoints === undefined) continue
      await ctx.db.patch(criterion._id, { weightPoints })
    }
    // A method-affecting change re-opens approval (ADR-0023).
    await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.modelUpdated)
    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.modelUpdated, entityId: model._id },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "weights.rebalanced",
        modelId: model._id,
        budget: criteria.length * 3,
        count: changed.length,
        // Bulk shape: one item per criterion whose weight actually moved. The
        // `from` is the in-memory pre-patch weightPoints (the patch loop does
        // not mutate the already-read docs); the `to` is the new allocation.
        // The label is the criterion's library name in the org's content
        // locale (criteria rows carry no stored text of their own).
        items: changed.map((criterion) => ({
          criterionId: criterion._id,
          label: content.criteria[criterion.libraryKey].name,
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

// The one field a weight motivation diffs. A constant rather than an inline
// literal for the same reason every other *_AUDIT_FIELDS list is one: the
// audit-label coverage test imports it, so a field added here without its
// dashboard.auditLog.fields.* label fails the suite instead of shipping a raw
// payload key.
export const WEIGHT_MOTIVATION_AUDIT_FIELDS = ["weightMotivation"] as const

// Mirrors method.ts's MAX_COMPLIANCE_TEXT for the same reason it exists: an
// unbounded text field on a document is a document-size risk. The client's Zod
// schema carries the same number (lib/weight-motivation-schemas.ts); the
// backend is the one that decides.
const MAX_WEIGHT_MOTIVATION = 2000

// Records WHY a dimension may carry the share of the weighting it does: the
// method evidence behind the model's two weight warnings (spec §17.2 items
// 9-10), and until now the one piece of the checklist with no way to write it
// at all.
//
// Stored PER CRITERION because that is what the engine reads. validateMethod
// clears dimensionWeightBalance for a dimension as soon as ANY criterion in it
// carries a weightMotivation, and clears peopleLeadershipWeight when the
// people-leadership criterion carries one; there is no model-level motivation
// field, so a surface motivating a DIMENSION has to choose the criterion that
// carries the text. The Viktning chapter's note picks the dimension's heaviest
// criterion (ties by display order), because that is the criterion the share
// being questioned mostly consists of, and it names it in the dialog rather
// than writing somewhere the reader cannot see.
//
// Documentation, not a method change: it moves no weight point, so it shifts no
// level, writes no level.shift diff, and deliberately does NOT reopen approval
// (approval.ts's reopenApprovalIfSet governing rule: only a mutation that can
// change a BLOCKER input reopens approval). weightMotivation only ever feeds
// the dimensionWeightBalance/peopleLeadershipWeight WARNINGS, and only ever
// clears them (filling one in cannot make either warning MORE unmet), so it
// can never un-satisfy anything approval depended on. Reopening here would
// un-approve a model for writing down why it was approved. This is now the
// ONE mutation excluded from reopenApprovalIfSet's coverage: compliance saves
// (saveCriterionCompliance) and per-criterion sign-off (setCriterionApproval's
// un-approve direction) both reopen, because both CAN move a blocker.
//
// Nor is it gated on the criterion's own `approved` flag (unlike
// saveCriterionCompliance): that flag signs off the kriterieurvalsprotokoll,
// and locking the weight motivation behind it would mean reopening a
// criterion's protokoll to answer a warning about the weighting.
export const setCriterionWeightMotivation = orgMutation({
  args: { criterionId: v.id("criteria"), motivation: v.string() },
  returns: v.null(),
  handler: async (ctx, { criterionId, motivation }) => {
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (motivation.length > MAX_WEIGHT_MOTIVATION) {
      throw appError(ERROR_CODES.invalidInput)
    }
    // An empty string clears the field (stored as undefined so the optional
    // stays clean), the same normalization saveCriterionCompliance uses.
    const trimmed = motivation.trim()
    const next = trimmed.length === 0 ? undefined : trimmed
    // No-op short-circuit (mirrors rebalanceWeights and
    // setWorkingConditionsDecision): an identical resubmission writes nothing,
    // so a dialog reopened and saved unchanged never adds an audit row.
    if (criterion.weightMotivation === next) return null
    await ctx.db.patch(criterionId, { weightMotivation: next })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.weightMotivationUpdated",
        criterionId,
        modelId: criterion.modelId,
        changes: buildChanges(
          criterion,
          { weightMotivation: next },
          WEIGHT_MOTIVATION_AUDIT_FIELDS
        ),
      },
    })
    return null
  },
})

// Deactivates a criterion (deletes its row and its ratings) and redistributes
// its weight points deterministically. The point budget shrinks by 3 while
// the sum shrinks by the criterion's points, so unless the criterion stood at
// the neutral 3 the survivors are off budget by (3 - points); the same
// deterministic walk that repairs AI drafts absorbs the difference (pull the
// heaviest down while over budget, push the lightest up while under; ties
// resolve in display order), and every adjustment is recorded in the
// deactivation's audit payload. Wrapped in a level-shift diff: deactivation
// can change scores or flip roles to complete/incomplete.
//
// No count floor here (unlike the old removeCriterion): a model under
// construction must be freely editable, and the 6-8 range is a checklist item
// enforced at approval time, not at every individual deactivation.
export const deactivateCriterion = orgMutation({
  args: { criterionId: v.id("criteria") },
  returns: v.null(),
  handler: async (ctx, { criterionId }) => {
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const model = await ctx.db.get(criterion.modelId)

    const before = await deriveResults(ctx, ctx.orgId)
    // Roles exist now (E3): deactivating a criterion also deletes its ratings
    // so no orphans linger. The engine additionally ignores strays (defense in
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
    // deactivated criterion stood at 3.
    const remaining = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", criterion.modelId))
      .collect()
    remaining.sort((a, b) => a.order - b.order)
    const repaired = repairDraftWeights(
      remaining.map((row) => row.weightPoints)
    )
    const locale = await resolveContentLocale(ctx, ctx.orgId)
    const content = criteriaLibraryContent(locale)
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
        label: content.criteria[row.libraryKey].name,
        changes: { weightPoints: { from: row.weightPoints, to: weightPoints } },
      })
    }
    // A method-affecting change re-opens approval (ADR-0023).
    if (model !== null) {
      await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.criterionDeactivated)
    }
    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.criterionDeactivated, criterionId },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.criterionDeactivated,
      payload: {
        criterionId,
        modelId: criterion.modelId,
        libraryKey: criterion.libraryKey,
        dimensionKey: LIBRARY_DIMENSION[criterion.libraryKey],
        weightPoints: criterion.weightPoints,
        // Ratings are COUNT-ONLY: never embed a rating value or notes anywhere
        // in the payload (no person/role-rating data on the model trail).
        deletedRatingCount: ratings.length,
        // The budget shrinks by 3 (one criterion fewer), in `changes` so it
        // renders as the before->after arrow the house style prefers. It sat
        // at the TOP LEVEL as an object once, which reached no surface at all:
        // changeEntries walks only `changes`, and payloadStats keeps only
        // top-level scalars, so an object between the two renderers fell
        // through both. The shrinking budget is exactly the context that
        // explains why the survivors' weights were repaired.
        changes: {
          budget: {
            from: (remaining.length + 1) * 3,
            to: remaining.length * 3,
          },
        },
        // Survivors whose weight was repaired onto the shrunken budget.
        count: rebalancedSurvivors.length,
        items: rebalancedSurvivors,
      },
    })
    return null
  },
})
