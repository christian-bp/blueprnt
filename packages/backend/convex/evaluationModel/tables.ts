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

// The 21 criteria library keys as a validator. MUST stay in sync with
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

// One living model per organization (V1: no versioning, ADR-0002). Score and
// level are NEVER stored; they are derived by packages/core.
export const models = defineTable({
  orgId: v.string(),
  name: v.string(),
  // Model approval: denormalized approval grant from the model author (ADR-0023).
  approval: v.optional(
    v.object({ approvedBy: v.string(), approvedAt: v.number() })
  ),
  // Working conditions rules: status and rationale for whether workingConditions
  // is material in this model (ADR-0022); only one workingConditions criterion
  // can be active per model (section 6.1).
  workingConditions: v.optional(
    v.object({
      status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
      motivation: v.string(),
      decidedBy: v.string(),
      decidedAt: v.number(),
    })
  ),
  // Level rules: an aggregate of the model (ADR-0006), always exactly 12
  // entries (level 1-12, Level 1 = highest; ADR-0022's four zones derive from
  // this range and are never stored). minScore is the lowest inclusive score
  // on the normalized 0-100 scale (ADR-0004/ADR-0021).
  levelRules: v.array(v.object({ level: v.number(), minScore: v.number() })),
  // Zone profile rules: each zone's minimum profile-criterion step for a role
  // to place there (ADR-0022); zones with no rule (C, D) admit unconditionally.
  zoneProfileRules: v.array(
    v.object({ zone: zoneKeyValidator, minStep: v.number() })
  ),
}).index("by_org", ["orgId"])

// A pure selection row (ADR-0021 addendum, decision 8): no stored texts at
// all. name/description/measures/notMeasures/anchors/the assessment question
// always render localized from criteriaLibraryContent via libraryKey; the
// dimension is always derived from LIBRARY_DIMENSION[libraryKey], never
// stored. One row per (modelId, libraryKey), enforced in activateCriterion.
export const criteria = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  // Which of the 21 library criteria this row instantiates. Required: every
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
  biasRisk: v.optional(
    v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
  ),
  biasComment: v.optional(v.string()),
  biasAction: v.optional(v.string()),
  approved: v.optional(v.boolean()),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
})
  .index("by_model", ["modelId"])
  .index("by_org", ["orgId"])
