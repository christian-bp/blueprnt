import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { internalMutation, internalQuery } from "../_generated/server"
import { estimateCostNanos } from "./pricing"

// UTC "YYYY-MM" bucket for the monthly rollup. Pure, so it is unit-tested with
// fixed timestamps; the mutation passes Date.now().
export function monthKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 7)
}

// One AI call's recorded usage: org/kind/provider/model/actor plus token
// counts. Both the suggestion-derived path (recordAiUsage, which reads these
// off the suggestion) and the context-based path (recordAiUsageDirect, which
// is passed them) fold into the event + monthly rollup through the SAME helper.
interface UsageRecord {
  orgId: string
  kind: string
  provider: string
  model: string
  actorId?: string
  // Set by the suggestion-derived path for provenance back to the row; the
  // batched prefill has no per-role suggestion and leaves it unset.
  suggestionId?: Id<"suggestions">
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedInputTokens: number
}

// Inserts one usage event and folds it into the org's monthly rollup, in the
// caller's transaction. The single home for the write: callers differ only in
// where they SOURCE the attribution (a suggestion row vs. direct args).
async function writeUsage(
  ctx: MutationCtx,
  record: UsageRecord
): Promise<void> {
  const cost = estimateCostNanos(
    record.model,
    record.inputTokens,
    record.outputTokens
  )
  if (cost === null) {
    console.error("ai usage recording: no pricing for model", {
      model: record.model,
    })
  }
  const costNanos = cost ?? 0

  await ctx.db.insert("aiUsageEvents", {
    orgId: record.orgId,
    kind: record.kind,
    provider: record.provider,
    model: record.model,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens: record.totalTokens,
    cachedInputTokens: record.cachedInputTokens,
    estimatedCostNanos: costNanos,
    // Spread the optional fields only when defined: explicit undefined is not a
    // valid Convex value.
    ...(record.actorId !== undefined ? { actorId: record.actorId } : {}),
    ...(record.suggestionId !== undefined
      ? { suggestionId: record.suggestionId }
      : {}),
  })

  const period = monthKey(Date.now())
  // At most one row per (orgId, period). Concurrent first-writes for the same
  // bucket are serialized by Convex OCC (the index-range read conflicts with
  // the other transaction's insert and retries), so .unique() never sees two.
  const existing = await ctx.db
    .query("aiUsageMonthly")
    .withIndex("by_org_period", (q) =>
      q.eq("orgId", record.orgId).eq("period", period)
    )
    .unique()
  if (existing === null) {
    await ctx.db.insert("aiUsageMonthly", {
      orgId: record.orgId,
      period,
      callCount: 1,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      costNanos,
      byKind: { [record.kind]: 1 },
    })
  } else {
    await ctx.db.patch(existing._id, {
      callCount: existing.callCount + 1,
      inputTokens: existing.inputTokens + record.inputTokens,
      outputTokens: existing.outputTokens + record.outputTokens,
      totalTokens: existing.totalTokens + record.totalTokens,
      costNanos: existing.costNanos + costNanos,
      byKind: {
        ...existing.byKind,
        [record.kind]: (existing.byKind[record.kind] ?? 0) + 1,
      },
    })
  }
}

// Records one usage event and folds it into the org's monthly rollup. Called
// best-effort by the generation actions after generateText returns. Derives
// org, feature kind, provider/model, and actor from the suggestion, so the
// caller passes only token counts.
//
// Deliberately writes NO audit row: this is append-only telemetry, not a
// user-initiated change to auditable domain state, and the event table is
// itself the log (see CLAUDE.md audit-invariant scope note).
export const recordAiUsage = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cachedInputTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId)
    if (suggestion === null) {
      // Suggestion vanished between generation and recording; nothing to
      // attribute. Best-effort: log and drop.
      console.error("ai usage recording: suggestion not found", {
        suggestionId: args.suggestionId,
      })
      return null
    }
    await writeUsage(ctx, {
      orgId: suggestion.orgId,
      kind: suggestion.target.kind,
      provider: suggestion.model?.provider ?? "unknown",
      model: suggestion.model?.model ?? "unknown",
      ...(suggestion.requestedBy !== undefined
        ? { actorId: suggestion.requestedBy }
        : {}),
      suggestionId: args.suggestionId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cachedInputTokens: args.cachedInputTokens,
    })
    return null
  },
})

// Context-based usage logging: the caller passes org/kind/provider/model/actor
// and the token counts directly, with no suggestion row to derive them from.
// Used by the batched onboarding prefill (ai/prefill), which makes ONE model
// call for a whole set of roles and logs ONE usage event per call (no per-role
// suggestion rows). Folds into the event + monthly rollup through the same
// helper as recordAiUsage. Append-only telemetry: writes no audit row.
export const recordAiUsageDirect = internalMutation({
  args: {
    orgId: v.string(),
    kind: v.string(),
    provider: v.string(),
    model: v.string(),
    actorId: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cachedInputTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeUsage(ctx, {
      orgId: args.orgId,
      kind: args.kind,
      provider: args.provider,
      model: args.model,
      ...(args.actorId !== undefined ? { actorId: args.actorId } : {}),
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cachedInputTokens: args.cachedInputTokens,
    })
    return null
  },
})

// Internal ops reads (V1: no client-callable usage surface). Used from the
// Convex dashboard to answer "how much has org X spent" and "where is the
// spend concentrated". Full-table scan in getTopOrgsByCost is fine at alpha
// volume; add a by_period index if the rollup ever grows large. Note:
// getTopOrgsByCost without a period ranks (org, period) rows, not org lifetime
// totals; pass a period for the "spend this month" view.
export const getOrgUsage = internalQuery({
  args: { orgId: v.string(), period: v.optional(v.string()) },
  returns: v.array(
    v.object({
      orgId: v.string(),
      period: v.string(),
      callCount: v.number(),
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      costNanos: v.number(),
      byKind: v.record(v.string(), v.number()),
    })
  ),
  handler: async (ctx, { orgId, period }) => {
    const rows = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_org_period", (q) =>
        period === undefined
          ? q.eq("orgId", orgId)
          : q.eq("orgId", orgId).eq("period", period)
      )
      .collect()
    return rows.map((r) => ({
      orgId: r.orgId,
      period: r.period,
      callCount: r.callCount,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      costNanos: r.costNanos,
      byKind: r.byKind,
    }))
  },
})

export const getTopOrgsByCost = internalQuery({
  args: { period: v.optional(v.string()) },
  returns: v.array(
    v.object({
      orgId: v.string(),
      period: v.string(),
      costNanos: v.number(),
      totalTokens: v.number(),
      callCount: v.number(),
    })
  ),
  handler: async (ctx, { period }) => {
    const all = await ctx.db.query("aiUsageMonthly").collect()
    const rows =
      period === undefined ? all : all.filter((r) => r.period === period)
    return rows
      .sort((a, b) => b.costNanos - a.costNanos)
      .map((r) => ({
        orgId: r.orgId,
        period: r.period,
        costNanos: r.costNanos,
        totalTokens: r.totalTokens,
        callCount: r.callCount,
      }))
  },
})
