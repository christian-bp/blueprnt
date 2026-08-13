// Pure derivations for the platform-admin AI usage overview
// (apps/dashboard/app/(app)/admin/ai-usage). Consumes
// api.platform.aiUsage.usageByOrg's rows (Task 51) and turns them into the
// page's KPI totals, the chart's outlier flags, and each table row's derived
// figures. No Convex/React imports here, so every rule is unit-tested without
// a DOM or a mocked query.

// One org's AI usage for a period, mirroring usageByOrg's row shape as a
// local structural type (same precedent as level-overview.ts's
// LevelOverviewInput): the page passes the query result straight through
// rather than this file importing the Convex-generated return type.
export interface AiUsageOrgRow {
  orgId: string
  orgName: string
  costNanos: number
  callCount: number
  totalTokens: number
  byKind: Record<string, number>
  prevCostNanos: number
}

// ---- Period keys ----

export const PERIODS_SHOWN = 6

// Generates the last `count` "YYYY-MM" period keys, newest first, ending at
// the UTC month containing `referenceMs`. Integer month arithmetic only (no
// Date object crosses a year boundary), so it is unit-tested with a fixed
// timestamp; the section passes Date.now() itself, never this file.
export function recentPeriods(
  referenceMs: number,
  count: number = PERIODS_SHOWN
): string[] {
  const ref = new Date(referenceMs)
  const startMonths = ref.getUTCFullYear() * 12 + ref.getUTCMonth()
  return Array.from({ length: count }, (_, i) => {
    const totalMonths = startMonths - i
    const year = Math.floor(totalMonths / 12)
    const month = totalMonths % 12
    return `${year}-${String(month + 1).padStart(2, "0")}`
  })
}

// The first-of-month UTC Date for a "YYYY-MM" period key, for a localized
// month/year label (format.dateTime). Display only; recentPeriods above
// never routes through Date arithmetic for its own math.
export function periodToDate(period: string): Date {
  const [yearStr, monthStr] = period.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  return new Date(Date.UTC(year, month - 1, 1))
}

// ---- Money ----

export const NANOS_PER_USD = 1_000_000_000

export function nanosToUsd(nanos: number): number {
  return nanos / NANOS_PER_USD
}

// A USD amount, to the cent rather than formatMoney's whole-unit rounding
// (lib/currency.ts): a single AI call typically costs a fraction of a cent,
// and rounding to whole dollars would show "$0" for nearly every org on this
// page, whose entire purpose is showing spend accurately. Locale-aware via
// Intl directly (matching formatMoney's own approach) rather than
// next-intl's useFormatter, so it is unit-tested the same plain way.
export function formatUsd(usd: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usd)
  } catch {
    return `${usd.toFixed(2)} USD`
  }
}

// Same, taking nano-USD (the row/query unit) instead of USD.
export function formatUsdCost(costNanos: number, locale: string): string {
  return formatUsd(nanosToUsd(costNanos), locale)
}

// ---- Totals across every org row for the period ----

export interface AiUsageTotals {
  costNanos: number
  prevCostNanos: number
  callCount: number
  totalTokens: number
  // Orgs with at least one call THIS period; excludes a row that appears
  // only because it had usage last period and none this one.
  activeOrgCount: number
}

export function computeTotals(rows: AiUsageOrgRow[]): AiUsageTotals {
  return rows.reduce<AiUsageTotals>(
    (totals, row) => ({
      costNanos: totals.costNanos + row.costNanos,
      prevCostNanos: totals.prevCostNanos + row.prevCostNanos,
      callCount: totals.callCount + row.callCount,
      totalTokens: totals.totalTokens + row.totalTokens,
      activeOrgCount: totals.activeOrgCount + (row.callCount > 0 ? 1 : 0),
    }),
    {
      costNanos: 0,
      prevCostNanos: 0,
      callCount: 0,
      totalTokens: 0,
      activeOrgCount: 0,
    }
  )
}

// Month-over-month cost change, as a signed percent of the previous period's
// total cost. Null when there is no previous baseline (a change against zero
// is undefined, not "infinite"), so the KPI tile can show its own
// no-comparison state instead of a fabricated number.
export function momChangePct(totals: AiUsageTotals): number | null {
  if (totals.prevCostNanos === 0) return null
  return (
    ((totals.costNanos - totals.prevCostNanos) / totals.prevCostNanos) * 100
  )
}

// ---- Outlier rule ----

// $1 in nano-USD (1e-9 USD; packages/backend/convex/ai/pricing.ts): the
// absolute floor below which no org is ever flagged, whatever the median is,
// so a quiet period with two $0.02 orgs never flags the one that spent
// $0.03. A sensible whole-dollar amount per the design; not derived from any
// real spend distribution, since there is none yet.
export const OUTLIER_FLOOR_NANOS = 1_000_000_000

// The middle value of a numeric list (the average of the two middle values
// for an even-length list). 0 for an empty list, so callers never special-
// case "no rows" separately from "no outliers".
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? 0
}

// Org ids flagged as spending "too much" this period: cost above 3x the
// median cost of every org WITH cost > 0 this period, or above the absolute
// floor, whichever is higher. The median is computed over spending orgs only
// so a page of quiet orgs plus one real spender does not drag the baseline
// toward zero and flag everyone; a single org is never an outlier of itself,
// since its own cost cannot exceed 3x its own cost.
export function computeOutlierOrgIds(rows: AiUsageOrgRow[]): Set<string> {
  const spending = rows.filter((row) => row.costNanos > 0)
  const threshold = Math.max(
    median(spending.map((row) => row.costNanos)) * 3,
    OUTLIER_FLOOR_NANOS
  )
  return new Set(
    spending.filter((row) => row.costNanos > threshold).map((row) => row.orgId)
  )
}

// ---- Per-row derived figures ----

// This row's share of the period's total cost, as a percent (0 when the
// total is 0, so an all-zero period shows every row at 0% instead of
// dividing by zero).
export function sharePct(costNanos: number, totalCostNanos: number): number {
  if (totalCostNanos === 0) return 0
  return (costNanos / totalCostNanos) * 100
}

// This row's change vs. the previous period: a signed percent, or "new" when
// the org had no cost in the previous period (a percent change against zero
// is undefined, and "the org showed up this period" is the honest reading,
// not a fabricated +Infinity%).
export type AiUsageRowChange = { kind: "new" } | { kind: "pct"; pct: number }

export function rowChange(row: AiUsageOrgRow): AiUsageRowChange {
  if (row.prevCostNanos === 0) return { kind: "new" }
  return {
    kind: "pct",
    pct: ((row.costNanos - row.prevCostNanos) / row.prevCostNanos) * 100,
  }
}

// ---- Daily series (the area-per-org trend chart) ----

// One org's per-day cost for a period, mirroring usageByOrgDaily's row
// shape, the same local-structural-type precedent as AiUsageOrgRow above.
export interface AiUsageDailyOrgRow {
  orgId: string
  orgName: string
  dailyCostNanos: number[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// The calendar Date for one day of a "YYYY-MM" period, for the chart's x-axis
// ticks and tooltip header. dayIndex is 0-based (0 = the 1st). Display only;
// periodMonthWindow (the backend's own period-math helper) never routes
// through this.
export function dayDate(period: string, dayIndex: number): Date {
  return new Date(periodToDate(period).getTime() + dayIndex * MS_PER_DAY)
}

// The chart's series cap: an org beyond the top N by period total folds into
// one "Others" band instead of getting its own area, so the plot stays
// readable how many organizations ever use it.
export const CHART_SERIES_CAP = 8

export interface CappedDailySeries {
  // The top-N orgs, own series, in the order usageByOrgDaily already returns
  // them (period total desc), so this never re-sorts what the backend sorted.
  series: AiUsageDailyOrgRow[]
  // Present only when more orgs exist than the cap: every remaining org's
  // daily cost summed into one series, plus how many orgs it folds together
  // (the caption's ICU count).
  others: { dailyCostNanos: number[]; count: number } | null
}

// Splits usageByOrgDaily's rows into the series the chart draws on their own
// and, when there are more orgs than the cap, one folded "Others" series
// summed day-by-day from everything past it.
export function capDailySeries(
  rows: AiUsageDailyOrgRow[],
  days: number,
  cap: number = CHART_SERIES_CAP
): CappedDailySeries {
  if (rows.length <= cap) return { series: rows, others: null }
  const rest = rows.slice(cap)
  const dailyCostNanos = new Array(days).fill(0)
  for (const row of rest) {
    for (let day = 0; day < days; day++) {
      dailyCostNanos[day] += row.dailyCostNanos[day] ?? 0
    }
  }
  return {
    series: rows.slice(0, cap),
    others: { dailyCostNanos, count: rest.length },
  }
}

// How many ticks the x-axis SKIPS between labeled ones (recharts' `interval`
// prop is a skip count, not a shown-tick count: 0 draws every tick), so a
// 28-31 day month shows roughly `targetTicks` labels instead of one per day.
export function chartTickInterval(days: number, targetTicks = 10): number {
  return Math.max(0, Math.ceil(days / targetTicks) - 1)
}

// ---- byKind chips ----

export interface AiUsageKindCount {
  kind: string
  count: number
}

// byKind entries as a stable, sorted list for the table's chip cell: highest
// call count first, then the kind string itself, so equal counts render in a
// deterministic order instead of Object.entries' insertion order (not part
// of any contract on the backend row).
export function kindCounts(byKind: Record<string, number>): AiUsageKindCount[] {
  return Object.entries(byKind)
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}
