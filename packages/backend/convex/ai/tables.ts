import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only AI usage telemetry: one row per successful AI generation,
// capturing the token usage the Vercel AI SDK reports (result.totalUsage).
// orgId, kind, provider, model, and actorId are derived from the suggestion
// the generation belongs to. estimatedCostNanos is a snapshot (ai/pricing.ts);
// raw token counts are the source of truth.
export const aiUsageEvents = defineTable({
  orgId: v.string(),
  // The suggestion target.kind: "model.draft" | "model.weightReview" | "role.profile".
  kind: v.string(),
  provider: v.string(),
  model: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
  cachedInputTokens: v.number(),
  estimatedCostNanos: v.number(),
  actorId: v.optional(v.string()),
  suggestionId: v.optional(v.id("suggestions")),
})
  .index("by_org", ["orgId"])
  .index("by_org_kind", ["orgId", "kind"])

// Per-org-per-month rollup, patched in the same transaction as each event so
// "spend per org" and a future per-org quota are a single-row read. period is
// a UTC "YYYY-MM" bucket; byKind holds the per-feature call count.
export const aiUsageMonthly = defineTable({
  orgId: v.string(),
  period: v.string(),
  callCount: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
  costNanos: v.number(),
  byKind: v.record(v.string(), v.number()),
}).index("by_org_period", ["orgId", "period"])
