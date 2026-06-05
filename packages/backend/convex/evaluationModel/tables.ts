import { defineTable } from "convex/server"
import { v } from "convex/values"

// One living model per organization (V1: no versioning, ADR-0002). Score and
// band are NEVER stored; they are derived by packages/core.
export const models = defineTable({
  orgId: v.string(),
  name: v.string(),
  templateKey: v.optional(v.string()),
}).index("by_org", ["orgId"])

export const criteria = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  name: v.string(),
  description: v.string(),
  helpText: v.string(),
  // standardmall criterion key ("scope".."formal") set at seed time; display
  // localizes pristine template rows from the content modules. E2 editing MUST
  // clear this key when any text field changes (ownership transfer to the
  // organization).
  templateKey: v.optional(v.string()),
  importanceLevel: v.number(), // 1-7; weight resolved via @workspace/core
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
  approved: v.optional(v.boolean()),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
})
  .index("by_model", ["modelId"])
  .index("by_org", ["orgId"])

export const criterionAnchors = defineTable({
  criterionId: v.id("criteria"),
  level: v.number(), // 0-5
  text: v.string(),
}).index("by_criterion", ["criterionId"])

export const tracks = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  key: v.string(), // IC | Lead | M
  name: v.string(),
  order: v.number(),
}).index("by_model", ["modelId"])

export const levels = defineTable({
  trackId: v.id("tracks"),
  key: v.string(), // IC1..IC5, Lead1..Lead3, M1..M3
  name: v.string(),
  definition: v.optional(v.string()),
  order: v.number(),
}).index("by_track", ["trackId"])

export const trackGuardrails = defineTable({
  orgId: v.string(),
  levelId: v.id("levels"),
  criterionId: v.id("criteria"),
  min: v.number(),
  max: v.number(),
}).index("by_level", ["levelId"])

export const bandThresholds = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  band: v.number(), // 1-7, Band 1 = highest
  minScore: v.number(),
}).index("by_model", ["modelId"])
