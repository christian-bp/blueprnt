import { v } from "convex/values"
import { isValidPeriod, periodMonthWindow, previousPeriod } from "../ai/usage"
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

const vUsageDailyRow = v.object({
  orgId: v.string(),
  orgName: v.string(),
  dailyCostNanos: v.array(v.number()),
})

// Per-org daily cost for one billing period: the chart's area-per-org, x axis
// per day series. aiUsageMonthly has no day granularity, so this reads the
// per-call event log instead, scoped to the period's UTC month window via the
// built-in by_creation_time index (never a full table collect) and reduced
// into per-org day sums server-side. Orgs sorted by their period total desc,
// same ordering rule as usageByOrg's chart.
export const usageByOrgDaily = platformQuery({
  args: { period: v.string() },
  returns: v.object({ days: v.number(), rows: v.array(vUsageDailyRow) }),
  handler: async (ctx, { period }) => {
    if (!isValidPeriod(period)) throw appError(ERROR_CODES.invalidInput)
    const { startMs, endMs, days } = periodMonthWindow(period)

    const events = await ctx.db
      .query("aiUsageEvents")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", startMs).lt("_creationTime", endMs)
      )
      .collect()

    const byOrg = new Map<string, number[]>()
    for (const event of events) {
      // The index range already confines every event to this UTC month, so
      // the calendar day of _creationTime is a safe 0-based day-of-month index.
      const dayIndex = new Date(event._creationTime).getUTCDate() - 1
      const dailyCostNanos = byOrg.get(event.orgId) ?? new Array(days).fill(0)
      dailyCostNanos[dayIndex] =
        (dailyCostNanos[dayIndex] ?? 0) + event.estimatedCostNanos
      byOrg.set(event.orgId, dailyCostNanos)
    }

    const orgLabel = await orgNameMap(ctx)
    const rows = [...byOrg.entries()]
      .map(([orgId, dailyCostNanos]) => ({
        orgId,
        orgName: orgLabel.get(orgId) ?? orgId,
        dailyCostNanos,
      }))
      .sort((a, b) => sumOf(b.dailyCostNanos) - sumOf(a.dailyCostNanos))

    return { days, rows }
  },
})

function sumOf(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
