import {
  DIMENSION_KEYS,
  dimensionWeightShares,
  type MethodCheckCriterion,
  type MethodCheckInput,
  methodBlockersPass,
  SCORE_SCALE_MAX,
  validateMethod,
  type WeightPoints,
} from "@workspace/core"
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { deriveResults } from "../assessment/compute"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
import type { AuditItem } from "../lib/auditPayloads"
import { appError, ERROR_CODES } from "../lib/errors"
import { type AuditWriter, orgMutation, orgQuery } from "../lib/functions"
import type { ApprovalReopenCause } from "./approvalCauses"
import { LIBRARY_DIMENSION, LIBRARY_OVERLAP_PAIRS } from "./criteriaLibrary"
import {
  buildModelEvidence,
  buildModelRestoreDiff,
  modelRestoreDiffShape,
  type RestorableCriterion,
  restorableCriteria,
  restoreWouldChange,
  summarizeLevelRules,
  summarizeZoneProfileRules,
} from "./evidence"
import { clampLocale } from "./localize"
import { filled } from "./method"
import { resolveContentLocale } from "./model"
import {
  dimensionKeyValidator,
  levelRuleShape,
  methodCheckKeyValidator,
  workingConditionsShape,
  zoneProfileRuleShape,
} from "./tables"

// The model approval lifecycle and the materiality decision (ADR-0023): a
// living model carries a `draft | approved` status; approval runs the
// §17.2/spec-3.4 twelve-check gate (packages/core's validateMethod is the
// ONLY rule set, never re-implemented here) and is the sole precondition for
// rating a role (assessment/ratings.ts). A method-affecting change falls the
// status back to draft (reopenApprovalIfSet), so every approval event in the
// audit log is a de facto version boundary without a version table.

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
// already-draft model never writes a spurious reopen row, and calling it on a
// no-op transition (e.g. un-approving a criterion that was never approved)
// costs nothing either.
//
// The governing rule: a mutation that can change a BLOCKER input (one of the
// nine non-warning entries in validateMethod's checklist) reopens approval,
// because leaving model.approval set while a blocker it was granted under no
// longer holds would let startPayMappingRun freeze unapproved evidence as if
// it were reviewed. Wired into every mutation that qualifies:
// activateCriterion, deactivateCriterion, rebalanceWeights,
// setWorkingConditionsDecision, updateLevelRules, updateZoneProfileRules
// (method.ts's) setCriterionApproval on the UN-APPROVE direction only (it
// flips this criterion's `documented` blocker input from true to false; the
// approve direction only ever helps a blocker, never breaks one, so it does
// not need to), and saveCriterionCompliance (defense in depth: it is only
// reachable on a criterion setCriterionApproval already un-approved, so its
// own call is normally a no-op, but it must not rely on being called after
// setCriterionApproval to stay correct). The ONE deliberate exclusion:
// setCriterionWeightMotivation only ever clears a WARNING
// (dimensionWeightBalance/peopleLeadershipWeight) in the safe direction
// (filling in a motivation cannot make either warning MORE unmet), so it can
// never un-satisfy a check approval depended on, and reopening there would
// un-approve a model for writing down why it was approved.
export async function reopenApprovalIfSet(
  ctx: MutationCtx & { audit: AuditWriter },
  model: Doc<"models">,
  cause: ApprovalReopenCause
): Promise<void> {
  if (model.approval === undefined) return
  await ctx.db.patch(model._id, { approval: undefined })
  await ctx.audit.log({
    type: AUDIT_EVENTS.modelApprovalReopened,
    payload: { modelId: model._id, causeEvent: cause },
  })
}

// The last-approved buffer, built by the SHARED evidence builder (the same one
// a pay-mapping run freezes with) and stamped with the approval being granted:
// the model row's own `approval` field is still the pre-patch value when this
// runs, so passing the grant explicitly is what keeps the buffer self-describing
// ("this is the state, and this is when it was approved"). Shared by both
// approval paths so the interactive and the seeded approval write the same
// buffer.
async function buildApprovedEvidence(
  ctx: MutationCtx,
  model: Doc<"models">,
  approval: { approvedBy: string; approvedAt: number }
) {
  const locale = await resolveContentLocale(ctx, model.orgId)
  const evidence = await buildModelEvidence(ctx, model, locale)
  return { ...evidence, approval }
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
//
// It also carries every dimension's SHARE of the weighting, because a checklist
// row that only states a verdict is a dead end: "no dimension dominates the
// weighting unexplained" leaves the reader with no way to tell which dimension,
// or by how much. The remedy line under the row names both, and the Viktning
// chapter's own note uses the same numbers, so the two surfaces cannot disagree
// with each other or with the gate.
//
// An orgQuery, not an adminQuery: the model section's layout reads this on
// every one of its four chapters to draw the progress spine, so an admin gate
// here throws in render for an editor and takes the whole section down. It
// carries method-check results and approval metadata only: no person data, no
// salary, nothing outside the model itself, and the Model destination is
// deliberately visible to every member (navigation.ts, adminOnly: false).
// Every write in this file is member-level too (the ruling: admin means org
// administration and the audit log); read access is not write access.
export const getMethodChecks = orgQuery({
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
          // Whether the check's obligation EXISTS for this model, as opposed
          // to being satisfied (packages/core MethodCheck.applies). The
          // Viktning chapter counts obligations, so it needs "nothing to ask"
          // told apart from "asked and answered".
          applies: v.optional(v.boolean()),
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
      // When the last-approved buffer was approved, or null when the model
      // carries no buffer (never approved, or last approved before the buffer
      // existed). The Godkännande chapter needs only this scalar to decide
      // whether to offer the restore control and what date to name on it; the
      // change list itself is a separate query the confirm dialog runs when it
      // opens, so the chapter never pays for the diff it may not show.
      lastApprovedAt: v.union(v.number(), v.null()),
      // Whether restoring the buffer would change anything at all. The
      // Godkännande chapter offers its restore control on this, not on the
      // buffer's mere existence: a model edited and manually reverted back to
      // its approved state reopens approval while having nothing to restore,
      // and a control promising a change it will not make is worse than no
      // control. Read-only extension of an existing query (the dimensionShares
      // pattern), so the chapter costs no second subscription.
      restoreWouldChange: v.boolean(),
      // Whether a human has ever SAVED a weighting on this model. The Viktning
      // chapter's progress counts the act, not its arithmetic: a fresh
      // selection is already balanced, so every check of it passes before
      // anyone has weighed anything. Read-only extension of an existing query
      // (the dimensionShares pattern), so the section costs no second
      // subscription.
      weightsSaved: v.boolean(),
      workingConditions: v.union(workingConditionsShape, v.null()),
      // Every dimension's share of the model's total weight, from the engine's
      // own dimensionWeightShares over the SAME criteria the checks above were
      // validated from. All four dimensions, always, in DIMENSION_KEYS order, so
      // a reader can see the balance rather than only the dimension that broke
      // it.
      //
      // A FRACTION (0..1), never a rounded percent: a surface compares it
      // against DIMENSION_WEIGHT_WARNING_SHARE to reach exactly the verdict the
      // dimensionWeightBalance check reached, and a share of 0.404 rounds to 40
      // and would read as "not over 40%" while the engine flags it. Rounding is
      // the frontend's, at display time.
      dimensionShares: v.array(
        v.object({ key: dimensionKeyValidator, share: v.number() })
      ),
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
    const shares = dimensionWeightShares(input.criteria)
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
        applies: check.applies,
      })),
      approval:
        model.approval === undefined
          ? null
          : {
              approvedBy: model.approval.approvedBy,
              approvedByName,
              approvedAt: model.approval.approvedAt,
            },
      lastApprovedAt: model.lastApprovedModel?.approval?.approvedAt ?? null,
      weightsSaved: model.weightsSavedAt !== undefined,
      restoreWouldChange: await restoreWouldChange(
        ctx,
        model,
        model.lastApprovedModel
      ),
      workingConditions: model.workingConditions ?? null,
      dimensionShares: DIMENSION_KEYS.map((key) => ({
        key,
        share: shares[key],
      })),
    }
  },
})

// Runs the twelve checks; any blocker not ok refuses with methodBlocked.
// Already-approved refuses with invalidTransition (re-approving is not a
// no-op: it would silently re-stamp approvedBy/approvedAt without a method
// change, and every genuine method change already reopens approval via
// reopenApprovalIfSet, so the only way to see this error is calling approve
// twice, a client-state bug worth surfacing rather than swallowing).
export const approveModel = orgMutation({
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
    const approval = { approvedBy: ctx.authUserId, approvedAt: Date.now() }
    await ctx.db.patch(model._id, {
      approval,
      // The single last-approved buffer (ADR-0023 decision 11), overwritten on
      // every approval so it always names the state the model is approved IN,
      // approval stamp included. No history: one buffer is what keeps the
      // no-versioning decision standing.
      lastApprovedModel: await buildApprovedEvidence(ctx, model, approval),
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
    const approval = { approvedBy: actorId, approvedAt: Date.now() }
    await ctx.db.patch(model._id, {
      approval,
      lastApprovedModel: await buildApprovedEvidence(ctx, model, approval),
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
export const setWorkingConditionsDecision = orgMutation({
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

// Validated by the SAME engine checks the approval gate uses
// (levelRulesValid), run against a candidate input so a bad edit is refused
// before it is ever stored. Reopens approval (a rules change can move
// levels) and wraps a level-shift diff (placeRole/scoreRole depend on
// levelRules).
// A minScore is a point on the normalized 0-100 weighting scale, and a minStep
// a point on the 1-5 rating scale. The engine's own checks constrain the SHAPE
// of each list (twelve levels, strictly decreasing, bottom at 0; zone steps
// non-increasing A -> D) but not the range of an individual number, so a value
// outside its scale would be stored and then be permanently unsatisfiable: a
// zone gated at step 9 admits nobody, and no check would ever say why. Bounded
// here, matching the client's own gate, with the client staying the
// convenience and this the authority.
const MIN_SCORE_FLOOR = 0
const MIN_SCORE_CEILING = SCORE_SCALE_MAX
const MIN_STEP_FLOOR = 1
const MIN_STEP_CEILING = 5

function assertInRange(
  values: readonly number[],
  floor: number,
  ceiling: number
): void {
  for (const value of values) {
    if (!Number.isInteger(value) || value < floor || value > ceiling) {
      throw appError(ERROR_CODES.invalidInput)
    }
  }
}

export const updateLevelRules = orgMutation({
  args: { levelRules: v.array(levelRuleShape) },
  returns: v.null(),
  handler: async (ctx, { levelRules }) => {
    assertInRange(
      levelRules.map((rule) => rule.minScore),
      MIN_SCORE_FLOOR,
      MIN_SCORE_CEILING
    )
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
export const updateZoneProfileRules = orgMutation({
  args: { zoneProfileRules: v.array(zoneProfileRuleShape) },
  returns: v.null(),
  handler: async (ctx, { zoneProfileRules }) => {
    assertInRange(
      zoneProfileRules.map((rule) => rule.minStep),
      MIN_STEP_FLOOR,
      MIN_STEP_CEILING
    )
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

// The restore preview: what restoring the last-approved buffer would undo, or
// null when no restore is on offer (no model, no buffer, or an approval that is
// still standing, in which case the model already IS its last-approved state).
//
// An orgQuery for the same reason getMethodChecks is one: an admin gate on a
// read the Godkännande chapter renders throws in render for an editor and takes
// the chapter down. It carries model-level method content only. The WRITE below
// is member-level like every other model write.
//
// `locale` is the VIEWER's display language: the criteria are named from the
// library content, and the change list is read by whoever opens the dialog, not
// by the org's default-language reader. The change SET itself comes from the
// same builder the mutation audits with, so preview and trail cannot disagree
// about what happens, only about which language the criteria are named in.
export const getModelRestorePreview = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      approvedAt: v.union(v.number(), v.null()),
      diff: modelRestoreDiffShape,
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null
    const buffer = model.lastApprovedModel
    if (buffer === undefined || model.approval !== undefined) return null
    return {
      approvedAt: buffer.approval?.approvedAt ?? null,
      diff: await buildModelRestoreDiff(
        ctx,
        model,
        buffer,
        clampLocale(locale)
      ),
    }
  },
})

// The stored criterion fields a restore writes back, as ONE patch. Every
// optional field is written explicitly, `undefined` included: db.patch removes a
// field set to undefined, which is what makes this a restore rather than a
// merge (a bias comment written after the approval has to go, not linger).
function restoreCriterionPatch(criterion: RestorableCriterion, index: number) {
  return {
    weightPoints: criterion.weightPoints,
    // Order is display order only, and a pre-cutover buffer may not carry it;
    // the buffer's own array order is the fallback, which is the order the
    // evidence builder wrote it in.
    order: criterion.order ?? index + 1,
    weightMotivation: criterion.weightMotivation,
    purpose: criterion.purpose,
    whyRelevant: criterion.whyRelevant,
    overlapNotes: criterion.overlapNotes,
    biasRisk: criterion.biasRisk,
    biasComment: criterion.biasComment,
    biasAction: criterion.biasAction,
    approved: criterion.approved,
    decidedBy: criterion.decidedBy,
    decidedAt: criterion.decidedAt,
  }
}

// Restores the live model to its last-approved state (ADR-0023 decision 11):
// the criteria selection, their weights, weight motivation, kriterieurvals-
// protokoll and bias documentation with their per-criterion approvals, the
// working-conditions materiality decision, and the level/zone-profile rules.
//
// One transaction, deliberately: the model holds at most 8 criteria
// (MODEL_MAX_CRITERIA), so the write set is bounded well inside Convex's
// document limits and a half-restored model can never exist. The ratings of a
// criterion the restore removes go with it, the same deletion
// deactivateCriterion performs, so no orphans linger.
//
// Approval is deliberately left reopened. Restoring is not a second way to
// become approved: it puts the model back where the checklist is green again
// and the ordinary one-click approveModel closes the loop, so there stays
// exactly ONE approval path and one approval provenance.
export const restoreApprovedModel = orgMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const model = await requireModel(ctx, ctx.orgId)
    // An approved model already IS its last-approved state; restoring it would
    // be a no-op that still rewrote every criterion row and its audit trail.
    if (model.approval !== undefined) {
      throw appError(ERROR_CODES.invalidTransition)
    }
    const buffer = model.lastApprovedModel
    if (buffer === undefined) throw appError(ERROR_CODES.notFound)

    const locale = await resolveContentLocale(ctx, ctx.orgId)
    // The SAME builder the confirm dialog previewed with: what the user was
    // shown and what the trail records are one computation, not two.
    const diff = await buildModelRestoreDiff(ctx, model, buffer, locale)
    // Nothing to undo (the model was edited back by hand, or the edit that
    // reopened approval touched nothing the buffer records): write no rows at
    // all rather than an audit entry with an empty diff.
    if (diff.criteria.length === 0 && Object.keys(diff.changes).length === 0) {
      return null
    }

    const before = await deriveResults(ctx, ctx.orgId)
    const rows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    const rowByKey = new Map(rows.map((row) => [row.libraryKey as string, row]))
    // The SAME predicate buildModelRestoreDiff read the change list from, so
    // the writes below cover exactly the entries the dialog listed. It throws
    // on an entry the library no longer knows rather than skipping it: see
    // restorableCriteria for why a silent skip is the one unacceptable
    // outcome. The diff above already ran it, so reaching here means it passed.
    const buffered = [...restorableCriteria(buffer).values()]
    const keep = new Set(buffered.map((criterion) => criterion.libraryKey))

    for (const row of rows) {
      if (keep.has(row.libraryKey)) continue
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_criterion", (q) => q.eq("criterionId", row._id))
        .collect()
      for (const rating of ratings) {
        await ctx.db.delete(rating._id)
      }
      await ctx.db.delete(row._id)
    }

    for (const [index, criterion] of buffered.entries()) {
      const patch = restoreCriterionPatch(criterion, index)
      const row = rowByKey.get(criterion.libraryKey)
      if (row === undefined) {
        await ctx.db.insert("criteria", {
          orgId: ctx.orgId,
          modelId: model._id,
          libraryKey: criterion.libraryKey,
          ...patch,
        })
      } else {
        await ctx.db.patch(row._id, patch)
      }
    }

    await ctx.db.patch(model._id, {
      workingConditions: buffer.workingConditions,
      levelRules: buffer.levelRules ?? model.levelRules,
      zoneProfileRules: buffer.zoneProfileRules ?? model.zoneProfileRules,
    })

    const after = await deriveResults(ctx, ctx.orgId)
    await ctx.audit.levelShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.modelRestored, entityId: model._id },
    })
    const items: AuditItem[] = diff.criteria.map((criterion) => ({
      // The criterion's identity across the diff: the rows it names are being
      // deleted or created, so a criterionId would dangle or not exist yet.
      libraryKey: criterion.libraryKey,
      label: criterion.name,
      changes: criterion.changes,
    }))
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelRestored,
      payload: {
        modelId: model._id,
        changes: diff.changes,
        count: items.length,
        items,
      },
    })
    return null
  },
})
