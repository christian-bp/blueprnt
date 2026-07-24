// Pure derivation of the overview's workforce trend chart: one point per
// pay-mapping run's reference date and headcount, oldest first (so the area
// chart's x-axis reads left-to-right chronologically), from the same
// listPayMappingRuns rows use-pay-mapping-headline.ts already subscribes to
// (Convex dedupes the identical query, no extra fetch).
export type HeadcountPoint = { date: number; value: number }

export type HeadcountTrendRun = {
  referenceDate: number
  populationCount: number
}

export function buildHeadcountTrend(
  runs: HeadcountTrendRun[]
): HeadcountPoint[] {
  return [...runs]
    .sort((a, b) => a.referenceDate - b.referenceDate)
    .map((r) => ({ date: r.referenceDate, value: r.populationCount }))
}
