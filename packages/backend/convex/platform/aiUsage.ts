import { v } from "convex/values"
import { isValidPeriod, previousPeriod } from "../ai/usage"
import { ERROR_CODES, appError } from "../lib/errors"
import { platformQuery } from "../lib/functions"
import { orgNameMap } from "../lib/organizations"

// Per-org AI usage for one billing period, plus the previous period's cost for
// a month-over-month delta. Org-level aggregates only (byKind is a call-count
// record keyed by feature kind, e.g. "model.draft"): no person, no prompt
// content, no PII of any kind.
const vUsageRow = v.object({
  orgId: v.string(),
  orgName: v.string(),
  costNanos: v.number(),
  callCount: v.number(),
  totalTokens: v.number(),
  byKind: v.record(v.string(), v.number()),
  prevCostNanos: v.number(),
})

// One row per org that has usage in EITHER `period` or its predecessor, so an
// org that used AI last period and stopped still shows (cost 0, prevCostNanos
// > 0), making a drop to zero visible instead of the org just disappearing.
export const usageByOrg = platformQuery({
  args: { period: v.string() },
  returns: v.array(vUsageRow),
  handler: async (ctx, { period }) => {
    if (!isValidPeriod(period)) throw appError(ERROR_CODES.invalidInput)
    const prev = previousPeriod(period)

    const currentRows = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_period", (q) => q.eq("period", period))
      .collect()
    const prevRows = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_period", (q) => q.eq("period", prev))
      .collect()

    const currentByOrg = new Map(currentRows.map((r) => [r.orgId, r]))
    const prevCostByOrg = new Map(prevRows.map((r) => [r.orgId, r.costNanos]))
    const orgIds = new Set([...currentByOrg.keys(), ...prevCostByOrg.keys()])

    const orgLabel = await orgNameMap(ctx)

    return [...orgIds].map((orgId) => {
      const current = currentByOrg.get(orgId)
      return {
        orgId,
        // Falls back to the raw id for a usage row whose org no longer
        // resolves (deleted since), so the row never goes display-text-less.
        orgName: orgLabel.get(orgId) ?? orgId,
        costNanos: current?.costNanos ?? 0,
        callCount: current?.callCount ?? 0,
        totalTokens: current?.totalTokens ?? 0,
        byKind: current?.byKind ?? {},
        prevCostNanos: prevCostByOrg.get(orgId) ?? 0,
      }
    })
  },
})
