import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { estimateCostNanos } from "./pricing"

// UTC "YYYY-MM" bucket for the monthly rollup. Pure, so it is unit-tested with
// fixed timestamps; the mutation passes Date.now().
export function monthKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 7)
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
    const provider = suggestion.model?.provider ?? "unknown"
    const model = suggestion.model?.model ?? "unknown"
    const kind = suggestion.target.kind
    const cost = estimateCostNanos(model, args.inputTokens, args.outputTokens)
    if (cost === null) {
      console.error("ai usage recording: no pricing for model", { model })
    }
    const costNanos = cost ?? 0

    await ctx.db.insert("aiUsageEvents", {
      orgId: suggestion.orgId,
      kind,
      provider,
      model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cachedInputTokens: args.cachedInputTokens,
      estimatedCostNanos: costNanos,
      // Spread the optional field only when defined: explicit undefined is not
      // a valid Convex value.
      ...(suggestion.requestedBy !== undefined
        ? { actorId: suggestion.requestedBy }
        : {}),
      suggestionId: args.suggestionId,
    })

    const period = monthKey(Date.now())
    // At most one row per (orgId, period). Concurrent first-writes for the same
    // bucket are serialized by Convex OCC (the index-range read conflicts with
    // the other transaction's insert and retries), so .unique() never sees two.
    const existing = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", suggestion.orgId).eq("period", period)
      )
      .unique()
    if (existing === null) {
      await ctx.db.insert("aiUsageMonthly", {
        orgId: suggestion.orgId,
        period,
        callCount: 1,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        totalTokens: args.totalTokens,
        costNanos,
        byKind: { [kind]: 1 },
      })
    } else {
      await ctx.db.patch(existing._id, {
        callCount: existing.callCount + 1,
        inputTokens: existing.inputTokens + args.inputTokens,
        outputTokens: existing.outputTokens + args.outputTokens,
        totalTokens: existing.totalTokens + args.totalTokens,
        costNanos: existing.costNanos + costNanos,
        byKind: {
          ...existing.byKind,
          [kind]: (existing.byKind[kind] ?? 0) + 1,
        },
      })
    }
    return null
  },
})

// Internal ops reads (V1: no client-callable usage surface). Used from the
// Convex dashboard to answer "how much has org X spent" and "where is the
// spend concentrated". Full-table scan in getTopOrgsByCost is fine at alpha
// volume; add a by_period index if the rollup ever grows large.
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
