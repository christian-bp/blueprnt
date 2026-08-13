// Pure derivation of the assistant's pay-gap trend: one point per pay-mapping
// run's reference date and frozen org-level gap, oldest first (so the chart
// reads left-to-right chronologically), from the same listPayMappingRuns rows
// use-pay-mapping-headline.ts already subscribes to (Convex dedupes the
// identical query, no extra fetch).
//
// The gap is read off the run row, never recomputed here: it is frozen at
// freeze time beside populationCount for exactly this chart, because deriving
// it per visit would scan every snapshot row of every run.
export type PayGapPoint = {
  date: number
  runLabel: string
  // Null when that mapping had no measurable gap (a gender absent among its
  // priced rows). The point is kept: a mapping that could not be measured is
  // part of the history, and the line breaks there rather than dropping to
  // zero.
  gapPct: number | null
}

export type PayGapTrendRun = {
  label: string
  referenceDate: number
  orgGapPct: number | null
}

// Every mapping is a point: the gap is written at freeze, so a run always
// carries one. A mapping whose gap could not be measured is a point with a
// null reading, which the chart draws as a break in the curve rather than
// dropping to zero or omitting the mapping from its own history.
export function buildPayGapTrend(runs: PayGapTrendRun[]): PayGapPoint[] {
  return [...runs]
    .sort((a, b) => a.referenceDate - b.referenceDate)
    .map((run) => ({
      date: run.referenceDate,
      runLabel: run.label,
      gapPct: run.orgGapPct,
    }))
}

// How many points a trend needs before it is a shape rather than a dot. A
// single reading is a dot, and an unmeasurable one contributes no reading at
// all, so both trends gate on the same rule.
export function hasTrendShape(measured: readonly unknown[]): boolean {
  return measured.length >= 2
}
