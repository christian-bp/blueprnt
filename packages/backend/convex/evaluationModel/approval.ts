import {
  dimensionWeightShares,
  type LevelRule,
  type MethodCheckCriterion,
  type MethodCheckInput,
  methodBlockersPass,
  validateMethod,
  type WeightPoints,
  type ZoneProfileRule,
} from "@workspace/core"
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { deriveResults } from "../assessment/compute"
import {
  AUDIT_EVENTS,
  type AuditEvent,
  buildChanges,
  logAudit,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, adminQuery, type AuditWriter } from "../lib/functions"
import { LIBRARY_DIMENSION, LIBRARY_OVERLAP_PAIRS } from "./criteriaLibrary"
import { filled } from "./method"
import {
  dimensionKeyValidator,
  methodCheckKeyValidator,
  zoneKeyValidator,
} from "./tables"

// The model approval lifecycle and the materiality decision (ADR-0023): a
// living model carries a `draft | approved` status; approval runs the
// §17.2/spec-3.4 twelve-check gate (packages/core's validateMethod is the
// ONLY rule set, never re-implemented here) and is the sole precondition for
// rating a role (assessment/ratings.ts). A method-affecting change falls the
// status back to draft (reopenApprovalIfSet), so every approval event in the
// audit log is a de facto version boundary without a version table.

const workingConditionsShape = v.object({
  status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
  motivation: v.string(),
  decidedBy: v.string(),
  decidedAt: v.number(),
})

// Builds the engine's MethodCheckInput from a model row: criteria rows mapped
// with their derived dimension (never stored), the org's kriterieurvalsprotokoll
// completion, and the model's own rules. Consumed by BOTH approveModel and
// getMethodChecks so the gate and the checklist UI can never disagree, and by
// updateLevelRules/updateZoneProfileRules to re-validate a candidate change.
export async function buildMethodCheckInput(
  ctx: QueryCtx | MutationCtx,
  model: Doc<"models">
): Promise<MethodCheckInput> {
  const rows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const criteria: MethodCheckCriterion[] = rows.map((row) => ({
    criterionId: row._id,
    dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
    weightPoints: row.weightPoints as WeightPoints,
    // Anchors are library-guaranteed under decision 8: every library entry
    // ships complete step 1/3/5 anchors, with 2/4 filled from the model's
    // shared midpoints when the entry has none, so there is no per-criterion
    // anchor gap left to check (spec §17.2 items 5-6 need no check).
    hasRequiredAnchors: true,
    // Kriterieurvalsprotokoll documented AND approved collapse into this one
    // stored flag (evaluationModel/method.ts's setCriterionApproval already
    // requires the documented subset before it can be set).
    documented: row.approved === true,
    hasWeightMotivation: filled(row.weightMotivation),
    hasOverlapNotes: filled(row.overlapNotes),
    libraryKey: row.libraryKey,
  }))
  const workingConditions = model.workingConditions
    ? {
        status: model.workingConditions.status,
        hasMotivation: filled(model.workingConditions.motivation),
      }
    : null
  return {
    criteria,
    workingConditions,
    overlapPairs: LIBRARY_OVERLAP_PAIRS,
    levelRules: model.levelRules,
    zoneProfileRules: model.zoneProfileRules,
  }
}

// Compact technical summaries for a level/zone-profile rules diff's from/to
// values, not localized prose: an array-valued changes entry renders as an
// opaque complexValue placeholder (formatChanges/changeEntries), which would
// make every rules edit read identically in the audit log ("Level thresholds:
// ..."). Level 1 is the highest (house convention), so "top" is its minScore.
function summarizeLevelRules(rules: readonly LevelRule[]): string {
  const top = rules.find((rule) => rule.level === 1)?.minScore
  return `${rules.length} rules, top ${top ?? 0}`
}

function summarizeZoneProfileRules(rules: readonly ZoneProfileRule[]): string {
  if (rules.length === 0) return "0 rules"
  const detail = rules.map((rule) => `${rule.zone}>=${rule.minStep}`).join(", ")
  return `${rules.length} rules: ${detail}`
}

// The model.approved audit payload, shared by approveModel and
// approveSeededModel so the two can never drift. Dimension shares come from
// the engine's own dimensionWeightShares over the SAME criteria input the
// checklist just validated (fractions of 1), rounded to whole percentage
// points and flattened onto the payload as four scalar fields (never a
// nested object: the flat-stats renderer, payloadStats in the dashboard,
// only picks up top-level string/number fields). Each field's value is the
// bare integer (e.g. 33), matching the house convention for a percentage
// audit field (see ftePercent): the field LABEL carries the "%", not the
// stored value.
function approvedPayload(
  model: Doc<"models">,
  input: MethodCheckInput,
  checksPassed: number
) {
  const shares = dimensionWeightShares(input.criteria)
  const pct = (fraction: number) => Math.round(fraction * 100)
  return {
    modelId: model._id,
    criteriaCount: input.criteria.length,
    checksPassed,
    competenceShare: pct(shares.competence),
    effortShare: pct(shares.effort),
    responsibilityShare: pct(shares.responsibility),
    workingConditionsShare: pct(shares.workingConditions),
  }
}

// Reopens approval if the model currently carries one: a method-affecting
// change falls the status back to draft (ADR-0023 decision 3). Deletes the
// field and audits model.approvalReopened once, naming the domain event that
// caused it. No-op (no audit row) when approval was not set, so an edit to an
// already-draft model never writes a spurious reopen row. Wired into every
// method-affecting mutation: activateCriterion, deactivateCriterion,
// rebalanceWeights, setWorkingConditionsDecision, updateLevelRules,
// updateZoneProfileRules. Compliance saves (purpose/whyRelevant/bias fields)
// do NOT reset approval (spec §2.3) and never call this helper.
export async function reopenApprovalIfSet(
  ctx: MutationCtx & { audit: AuditWriter },
  model: Doc<"models">,
  cause: AuditEvent
): Promise<void> {
  if (model.approval === undefined) return
  await ctx.db.patch(model._id, { approval: undefined })
  await ctx.audit.log({
    type: AUDIT_EVENTS.modelApprovalReopened,
    payload: { modelId: model._id, causeEvent: cause },
  })
}

async function requireModel(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<Doc<"models">> {
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (model === null) throw appError(ERROR_CODES.notFound)
  return model
}

// The twelve checks over the wire (wire-safe shapes: criterionIds already
// strings, pairs as two-string-tuple arrays) plus the current approval and
// working-conditions decision state, so the dashboard's approval card and its
// working-conditions control never need a second query.
export const getMethodChecks = adminQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      checks: v.array(
        v.object({
          key: methodCheckKeyValidator,
          level: v.union(v.literal("blocker"), v.literal("warning")),
          ok: v.boolean(),
          criterionIds: v.optional(v.array(v.string())),
          dimensions: v.optional(v.array(dimensionKeyValidator)),
          pairs: v.optional(v.array(v.array(v.string()))),
          count: v.optional(v.number()),
        })
      ),
      approval: v.union(
        v.object({
          approvedBy: v.string(),
          approvedByName: v.union(v.string(), v.null()),
          approvedAt: v.number(),
        }),
        v.null()
      ),
      workingConditions: v.union(workingConditionsShape, v.null()),
    })
  ),
  handler: async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null
    const input = await buildMethodCheckInput(ctx, model)
    const checks = validateMethod(input)
    // Resolves the approver's Better Auth id to a display name (users
    // mirror), the same lookup getMethodModel already does for
    // decidedBy/decidedAt, so the card never shows a raw auth id.
    let approvedByName: string | null = null
    const approval = model.approval
    if (approval !== undefined) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", approval.approvedBy))
        .first()
      approvedByName = user?.name ?? null
    }
    return {
      checks: checks.map((check) => ({
        key: check.key,
        level: check.level,
        ok: check.ok,
        criterionIds: check.criterionIds,
        dimensions: check.dimensions,
        pairs: check.pairs,
        count: check.count,
      })),
      approval:
        model.approval === undefined
          ? null
          : {
              approvedBy: model.approval.approvedBy,
              approvedByName,
              approvedAt: model.approval.approvedAt,
            },
      workingConditions: model.workingConditions ?? null,
    }
  },
})

// Runs the twelve checks; any blocker not ok refuses with methodBlocked.
// Already-approved refuses with invalidTransition (re-approving is not a
// no-op: it would silently re-stamp approvedBy/approvedAt without a method
// change, and every genuine method change already reopens approval via
// reopenApprovalIfSet, so the only way to see this error is calling approve
// twice, a client-state bug worth surfacing rather than swallowing).
export const approveModel = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const model = await requireModel(ctx, ctx.orgId)
    if (model.approval !== undefined) {
      throw appError(ERROR_CODES.invalidTransition)
    }
    const input = await buildMethodCheckInput(ctx, model)
    const checks = validateMethod(input)
    if (!methodBlockersPass(checks)) {
      throw appError(ERROR_CODES.methodBlocked)
    }
    await ctx.db.patch(model._id, {
      approval: { approvedBy: ctx.authUserId, approvedAt: Date.now() },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelApproved,
      payload: approvedPayload(
        model,
        input,
        checks.filter((check) => check.ok).length
      ),
    })
    return null
  },
})

// Dev/seed-only twin of approveModel: takes an explicit actorId instead of an
// auth context (the seed runs as a "use node" action with no identity, the
// same reason seedDefaultModel exists alongside createDefaultModel). Seed data
// completes its own compliance fields (assessment/seed.ts) before calling
// this, so the checklist is genuinely all-green, not bypassed; if it is not
// (a seed-data regression), this throws loudly rather than silently
// half-approving a model whose checklist would read as incomplete in the UI.
export const approveSeededModel = internalMutation({
  args: { orgId: v.string(), actorId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId, actorId }) => {
    const model = await requireModel(ctx, orgId)
    if (model.approval !== undefined) return null
    const input = await buildMethodCheckInput(ctx, model)
    const checks = validateMethod(input)
    if (!methodBlockersPass(checks)) {
      throw new Error(
        "approveSeededModel: the seeded model's checklist is not all-green"
      )
    }
    await ctx.db.patch(model._id, {
      approval: { approvedBy: actorId, approvedAt: Date.now() },
    })
    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.modelApproved,
      actorId,
      payload: approvedPayload(
        model,
        input,
        checks.filter((check) => check.ok).length
      ),
    })
    return null
  },
})

// The working-conditions materiality decision (ADR-0022 section 6.1): either
// a workingConditions criterion is active, or the dimension was tested and
// found not material (a required motivation either way). Refuses
// testedNotMaterial while a workingConditions criterion is still selected
// (deactivate it first): the two states are mutually exclusive by
// construction, so the mutation enforces the same invariant the checklist's
// workingConditionsTested check reads.
export const setWorkingConditionsDecision = adminMutation({
  args: {
    status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
    motivation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { status, motivation }) => {
    const model = await requireModel(ctx, ctx.orgId)
    const trimmed = motivation.trim()
    if (trimmed.length === 0) throw appError(ERROR_CODES.motivationRequired)
    if (status === "testedNotMaterial") {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      const hasWorkingConditionsCriterion = criteria.some(
        (criterion) =>
          LIBRARY_DIMENSION[criterion.libraryKey] === "workingConditions"
      )
      if (hasWorkingConditionsCriterion) {
        throw appError(ERROR_CODES.invalidTransition)
      }
    }
    const before = {
      status: model.workingConditions?.status ?? null,
      motivation: model.workingConditions?.motivation ?? null,
    }
    // No-op short-circuit (mirrors rebalanceWeights/setRating): an identical
    // resubmission writes nothing and does not reopen approval.
    if (before.status === status && before.motivation === trimmed) {
      return null
    }
    await ctx.db.patch(model._id, {
      workingConditions: {
        status,
        motivation: trimmed,
        decidedBy: ctx.authUserId,
        decidedAt: Date.now(),
      },
    })
    await reopenApprovalIfSet(
      ctx,
      model,
      AUDIT_EVENTS.modelWorkingConditionsDecided
    )
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelWorkingConditionsDecided,
      payload: {
        modelId: model._id,
        status,
        changes: buildChanges(before, { status, motivation: trimmed }, [
          "status",
          "motivation",
        ]),
      },
    })
    return null
  },
})

const levelRuleShape = v.object({ level: v.number(), minScore: v.number() })
const zoneProfileRuleShape = v.object({
  zone: zoneKeyValidator,
  minStep: v.number(),
})

// Validated by the SAME engine checks the approval gate uses
// (levelRulesValid), run against a candidate input so a bad edit is refused
// before it is ever stored. Reopens approval (a rules change can move
// levels) and wraps a level-shift diff (placeRole/scoreRole depend on
// levelRules).
export const updateLevelRules = adminMutation({
  args: { levelRules: v.array(levelRuleShape) },
  returns: v.null(),
  handler: async (ctx, { levelRules }) => {
    const model = await requireModel(ctx, ctx.orgId)
    const candidate = await buildMethodCheckInput(ctx, model)
    const checks = validateMethod({ ...candidate, levelRules })
    const check = checks.find((c) => c.key === "levelRulesValid")
    if (check === undefined || !check.ok) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const previous = summarizeLevelRules(model.levelRules)
    const before = await deriveResults(ctx, ctx.orgId)
    await ctx.db.patch(model._id, { levelRules })
    await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.modelLevelRulesUpdated)
    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: {
        event: AUDIT_EVENTS.modelLevelRulesUpdated,
        entityId: model._id,
      },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelLevelRulesUpdated,
      payload: {
        modelId: model._id,
        changes: {
          levelRules: { from: previous, to: summarizeLevelRules(levelRules) },
        },
      },
    })
    return null
  },
})

// Mirrors updateLevelRules for the zone-profile rules (zoneProfileMonotonic).
export const updateZoneProfileRules = adminMutation({
  args: { zoneProfileRules: v.array(zoneProfileRuleShape) },
  returns: v.null(),
  handler: async (ctx, { zoneProfileRules }) => {
    const model = await requireModel(ctx, ctx.orgId)
    const candidate = await buildMethodCheckInput(ctx, model)
    const checks = validateMethod({ ...candidate, zoneProfileRules })
    const check = checks.find((c) => c.key === "zoneProfileMonotonic")
    if (check === undefined || !check.ok) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const previous = summarizeZoneProfileRules(model.zoneProfileRules)
    const before = await deriveResults(ctx, ctx.orgId)
    await ctx.db.patch(model._id, { zoneProfileRules })
    await reopenApprovalIfSet(
      ctx,
      model,
      AUDIT_EVENTS.modelZoneProfileRulesUpdated
    )
    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: {
        event: AUDIT_EVENTS.modelZoneProfileRulesUpdated,
        entityId: model._id,
      },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelZoneProfileRulesUpdated,
      payload: {
        modelId: model._id,
        changes: {
          zoneProfileRules: {
            from: previous,
            to: summarizeZoneProfileRules(zoneProfileRules),
          },
        },
      },
    })
    return null
  },
})
