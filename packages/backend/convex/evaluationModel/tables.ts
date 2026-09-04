import {
  DIMENSION_KEYS,
  type DimensionKey,
  METHOD_CHECK_KEYS,
  type MethodCheckKey,
  ZONE_KEYS,
} from "@workspace/core"
import type { ZoneKey } from "@workspace/core"
import { defineTable } from "convex/server"
import type { Infer } from "convex/values"
import { v } from "convex/values"
import {
  CRITERIA_LIBRARY_KEYS,
  type CriteriaLibraryKey,
} from "./criteriaLibrary"

// The fixed V1 track schema as a validator (ADR-0006): tracks are constants,
// not rows. MUST stay in sync with TRACK_KEYS in trackSchema.ts
// (trackSchema.test.ts asserts the bijection). Used by roles.trackKey
// and by getModel's wire shape.
export const trackKeyValidator = v.union(
  v.literal("IC"),
  v.literal("Lead"),
  v.literal("M")
)

// The 22 criteria library keys as a validator. MUST stay in sync with
// CRITERIA_LIBRARY_KEYS in criteriaLibrary.ts (compile-time guard below asserts
// the bijection). Built from the key list so drift is impossible.
export const libraryKeyValidator = v.union(
  ...CRITERIA_LIBRARY_KEYS.map((k) => v.literal(k))
)

// Compile-time drift guard: the validator's members must exactly match
// CriteriaLibraryKey, so the two cannot silently diverge.
type LibraryKeyFromValidator = Infer<typeof libraryKeyValidator>
type _LibraryKeysExact = LibraryKeyFromValidator extends CriteriaLibraryKey
  ? CriteriaLibraryKey extends LibraryKeyFromValidator
    ? true
    : never
  : never
const _assertLibraryKeysMatch: _LibraryKeysExact = true
void _assertLibraryKeysMatch

// The four fixed evaluation dimensions (ADR-0021) as a validator. MUST stay in
// sync with DIMENSION_KEYS in @workspace/core (compile-time guard below).
// Used by getModel/getMethodModel's wire shape and the audit payloads.
export const dimensionKeyValidator = v.union(
  ...DIMENSION_KEYS.map((k) => v.literal(k))
)
type DimensionKeyFromValidator = Infer<typeof dimensionKeyValidator>
type _DimensionKeysExact = DimensionKeyFromValidator extends DimensionKey
  ? DimensionKey extends DimensionKeyFromValidator
    ? true
    : never
  : never
const _assertDimensionKeysMatch: _DimensionKeysExact = true
void _assertDimensionKeysMatch

// The four fixed zones (ADR-0022) as a validator. MUST stay in sync with
// ZONE_KEYS in @workspace/core (compile-time guard below).
export const zoneKeyValidator = v.union(...ZONE_KEYS.map((k) => v.literal(k)))
type ZoneKeyFromValidator = Infer<typeof zoneKeyValidator>
type _ZoneKeysExact = ZoneKeyFromValidator extends ZoneKey
  ? ZoneKey extends ZoneKeyFromValidator
    ? true
    : never
  : never
const _assertZoneKeysMatch: _ZoneKeysExact = true
void _assertZoneKeysMatch

// The twelve method-check keys (packages/core method-checks.ts) as a
// validator, for getMethodChecks' wire shape. MUST stay in sync with
// METHOD_CHECK_KEYS (compile-time guard below).
export const methodCheckKeyValidator = v.union(
  ...METHOD_CHECK_KEYS.map((k) => v.literal(k))
)
type MethodCheckKeyFromValidator = Infer<typeof methodCheckKeyValidator>
type _MethodCheckKeysExact = MethodCheckKeyFromValidator extends MethodCheckKey
  ? MethodCheckKey extends MethodCheckKeyFromValidator
    ? true
    : never
  : never
const _assertMethodCheckKeysMatch: _MethodCheckKeysExact = true
void _assertMethodCheckKeysMatch

// The three-literal bias-risk scale of a criterion's bias review. Declared here
// (with every other stored shape) rather than inside method.ts, so the criteria
// table, the compliance mutation's args, and the model-evidence shape below all
// read from one union.
export const biasRiskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
)

// The model's own rule shapes and its two decision stamps, declared once and
// reused by the models table, the model-evidence shape below, and the
// mutations that write them (evaluationModel/approval.ts).
export const levelRuleShape = v.object({
  level: v.number(),
  minScore: v.number(),
})

export const zoneProfileRuleShape = v.object({
  zone: zoneKeyValidator,
  minStep: v.number(),
})

export const workingConditionsShape = v.object({
  status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
  motivation: v.string(),
  decidedBy: v.string(),
  decidedAt: v.number(),
})

export const modelApprovalShape = v.object({
  approvedBy: v.string(),
  approvedAt: v.number(),
})

// The model's full method evidence as ONE shape, produced by the single builder
// in evidence.ts and stored by BOTH of its consumers: the model's own
// `lastApprovedModel` buffer (ADR-0023 decision 11) and a pay-mapping run's
// `frozenModel` (ADR-0011/ADR-0023 freeze). Declared as a field MAP rather than
// a finished object so payMapping/tables.ts can add its one legacy-tolerance
// field without restating the rest.
//
// libraryKey/dimensionKey stay optional strings rather than the strict
// libraryKeyValidator/dimensionKeyValidator above: a pre-cutover frozen run
// carries the old sparse criterion shape, and frozen evidence is never
// migrated, so the shared validator has to keep tolerating it. Everything
// written from here on (approveModel, startPayMappingRun) is fully populated.
export const modelEvidenceFields = {
  criteria: v.array(
    v.object({
      libraryKey: v.optional(v.string()),
      // The criterion's library display name, localized in the org's content
      // locale at write time and never re-resolved, so a later locale change
      // or content edit cannot alter an already-written evidence copy.
      name: v.string(),
      dimensionKey: v.optional(v.string()),
      weightPoints: v.number(),
      // The number of anchor texts the library carries for this criterion:
      // 5 for a section-13.5 entry, 3 otherwise.
      anchorCount: v.number(),
      // The RESTORE half of the evidence: everything a criteria row carries
      // beyond its selection and weight, so restoring the buffer puts the
      // model's documentation back exactly as it was approved rather than
      // only its weights.
      order: v.optional(v.number()),
      weightMotivation: v.optional(v.string()),
      purpose: v.optional(v.string()),
      whyRelevant: v.optional(v.string()),
      overlapNotes: v.optional(v.string()),
      biasRisk: v.optional(biasRiskValidator),
      biasComment: v.optional(v.string()),
      biasAction: v.optional(v.string()),
      approved: v.optional(v.boolean()),
      decidedBy: v.optional(v.string()),
      decidedAt: v.optional(v.number()),
    })
  ),
  workingConditions: v.optional(workingConditionsShape),
  approval: v.optional(modelApprovalShape),
}

export const modelEvidenceValidator = v.object(modelEvidenceFields)
export type ModelEvidence = Infer<typeof modelEvidenceValidator>

// One living model per organization (V1: no versioning, ADR-0002). Score and
// level are NEVER stored; they are derived by packages/core.
export const models = defineTable({
  orgId: v.string(),
  name: v.string(),
  // Model approval: denormalized approval grant from the model author (ADR-0023).
  approval: v.optional(modelApprovalShape),
  // When the weighting was last SAVED by a human, from the Viktning chapter's
  // own save. It exists because the weighting has no other trace of having
  // been decided: criteria enter at 3 points and the budget is the criteria
  // count times 3, so a fresh selection is already balanced and every
  // validation of it passes without anyone having weighed anything. A progress
  // reading that counted the budget check would show a chapter as begun before
  // it was opened, so it counts THIS instead: the act, not its arithmetic.
  // Absent means nobody has saved a weighting yet.
  weightsSavedAt: v.optional(v.number()),
  // The single last-approved buffer (ADR-0023 decision 11): every approveModel
  // overwrites it with the evidence it just approved, so a model whose approval
  // was reopened by an edit can be restored to that state. ONE buffer, never a
  // history, which is what keeps ADR-0023's no-versioning stand. Optional: a
  // model approved before this field existed simply has none, and its restore
  // control stays hidden until the next approval writes one.
  lastApprovedModel: v.optional(modelEvidenceValidator),
  // Working conditions rules: status and rationale for whether workingConditions
  // is material in this model (ADR-0022); only one workingConditions criterion
  // can be active per model (section 6.1).
  workingConditions: v.optional(workingConditionsShape),
}).index("by_org", ["orgId"])

// A pure selection row (ADR-0021 addendum, decision 8): no stored texts at
// all. name/description/measures/notMeasures/anchors/the assessment question
// always render localized from criteriaLibraryContent via libraryKey; the
// dimension is always derived from LIBRARY_DIMENSION[libraryKey], never
// stored. One row per (modelId, libraryKey), enforced in activateCriterion.
export const criteria = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  // Which of the 22 library criteria this row instantiates. Required: every
  // row is a library selection, never a custom criterion.
  libraryKey: libraryKeyValidator,
  // 1-5 weight points under the point budget (criteria count x 3, exact sum;
  // ADR-0004). Mutations keep the model balanced at all times: activation
  // enters at 3 (the budget grows by 3 at the same time), reweighting is an
  // atomic batch, and deactivation redistributes the removed criterion's
  // points deterministically across the survivors (one-click removal;
  // ADR-0004 2026-06-07 amendment).
  weightPoints: v.number(),
  order: v.number(),
  // Weight motivation: rationale for why this criterion holds its weight
  // points (captured when the section 12.4 warnings trigger).
  weightMotivation: v.optional(v.string()),
  // Criterion rationale (kriterieurvalsprotokoll), pre-filled from library
  // content at activation and editable thereafter.
  purpose: v.optional(v.string()),
  whyRelevant: v.optional(v.string()),
  overlapNotes: v.optional(v.string()),
  // Bias review (bias-granskning).
  biasRisk: v.optional(biasRiskValidator),
  biasComment: v.optional(v.string()),
  biasAction: v.optional(v.string()),
  approved: v.optional(v.boolean()),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
})
  .index("by_model", ["modelId"])
  .index("by_org", ["orgId"])
