import { defineTable } from "convex/server"
import { v } from "convex/values"
import { CRITERIA_LIBRARY_KEYS } from "./criteriaLibrary"

// The fixed V1 track schema as a validator (ADR-0006): tracks are constants,
// not rows. MUST stay in sync with TRACK_KEYS in trackSchema.ts
// (trackSchema.test.ts asserts the bijection). Used by roles.trackKey
// and by getModel's wire shape.
export const trackKeyValidator = v.union(
  v.literal("IC"),
  v.literal("Lead"),
  v.literal("M")
)

// The 21 criteria library keys as a validator (methodcutover phase 2).
// MUST stay in sync with CRITERIA_LIBRARY_KEYS in criteriaLibrary.ts
// (schema.test.ts asserts the bijection). Built from the key list so drift
// is impossible.
export const libraryKeyValidator = v.union(
  ...CRITERIA_LIBRARY_KEYS.map((k) => v.literal(k))
)

// One living model per organization (V1: no versioning, ADR-0002). Score and
// level are NEVER stored; they are derived by packages/core.
export const models = defineTable({
  orgId: v.string(),
  name: v.string(),
  templateKey: v.optional(v.string()),
  // Level thresholds are an aggregate of the model (ADR-0006): always exactly
  // 7 entries (level 1-7, Level 1 = highest), read as a complete set and edited
  // as a set, so they live on the model document. minScore is the lowest
  // inclusive score on the normalized 0-100 scale (ADR-0004).
  levelThresholds: v.array(
    v.object({ level: v.number(), minScore: v.number() })
  ),
  // Model approval (method cutover phase 2): who approved this model and when.
  approval: v.optional(
    v.object({ approvedBy: v.string(), approvedAt: v.number() })
  ),
  // Working conditions rules (method cutover phase 2): configuration for the
  // workingConditions dimension.
  workingConditions: v.optional(
    v.object({
      status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
      motivation: v.string(),
      decidedBy: v.string(),
      decidedAt: v.number(),
    })
  ),
  // Level rules (method cutover phase 2): threshold mapping between levels.
  levelRules: v.optional(
    v.array(v.object({ level: v.number(), minScore: v.number() }))
  ),
  // Zone profile rules (method cutover phase 2): zone-based profile requirements.
  zoneProfileRules: v.optional(
    v.array(
      v.object({
        zone: v.union(
          v.literal("A"),
          v.literal("B"),
          v.literal("C"),
          v.literal("D")
        ),
        minStep: v.number(),
      })
    )
  ),
}).index("by_org", ["orgId"])

export const criteria = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  name: v.string(),
  description: v.string(),
  helpText: v.string(),
  // Anchor texts for scores 0-5, always exactly 6, ordered by step. Anchors
  // are an aggregate of the criterion (ADR-0006): never referenced from
  // elsewhere and never read without it, so they live on its document and
  // cannot outlive it.
  anchors: v.array(v.object({ step: v.number(), text: v.string() })),
  // standard template criterion key ("scope".."formal") set at seed time; display
  // localizes pristine template rows from the content modules. E2 editing MUST
  // clear this key when any text field changes (ownership transfer to the
  // organization).
  templateKey: v.optional(v.string()),
  // 1-5 weight points under the point budget (criteria count x 3, exact sum;
  // ADR-0004). Mutations keep the model balanced at all times: new criteria
  // enter at 3, reweighting is an atomic batch, and removal redistributes the
  // removed criterion's points deterministically across the survivors
  // (one-click removal; ADR-0004 2026-06-07 amendment).
  weightPoints: v.number(),
  order: v.number(),
  isCustom: v.boolean(),
  // Criterion rationale (kriterieurvalsprotokoll), filled in E2.
  purpose: v.optional(v.string()),
  whyRelevant: v.optional(v.string()),
  overlapNotes: v.optional(v.string()),
  // Bias review (bias-granskning), filled in E2.
  biasRisk: v.optional(
    v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
  ),
  biasComment: v.optional(v.string()),
  biasAction: v.optional(v.string()),
  // true once HR edits compliance via saveCriterionCompliance: the row's stored
  // compliance is then authored, not template, so getMethodModel stops
  // re-localizing it. undefined/false = template content (re-localizes at read).
  complianceEdited: v.optional(v.boolean()),
  approved: v.optional(v.boolean()),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
  // Library key (method cutover phase 2): which of the 21 criteria this row came from.
  libraryKey: v.optional(libraryKeyValidator),
  // Weight motivation (method cutover phase 2): rationale for the weight assignment.
  weightMotivation: v.optional(v.string()),
})
  .index("by_model", ["modelId"])
  .index("by_org", ["orgId"])
