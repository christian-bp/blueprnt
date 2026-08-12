// Pure derivation of the assistant's workforce trend chart: one point per
// pay-mapping run's reference date and headcount, oldest first (so the area
// chart's x-axis reads left-to-right chronologically), from the same
// listPayMappingRuns rows use-pay-mapping-headline.ts already subscribes to
// (Convex dedupes the identical query, no extra fetch). Each point carries the
// run's own label so the chart can name the pay mapping a headcount came from:
// two runs can share a reference date, and the date alone reads as a workforce
// number over time rather than one pay mapping's population.
export type HeadcountPoint = {
  date: number
  runLabel: string
  women: number
  men: number
}

export type HeadcountTrendRun = {
  label: string
  referenceDate: number
  womenCount: number
  menCount: number
}

export function buildHeadcountTrend(
  runs: HeadcountTrendRun[]
): HeadcountPoint[] {
  return [...runs]
    .sort((a, b) => a.referenceDate - b.referenceDate)
    .map((r) => ({
      date: r.referenceDate,
      runLabel: r.label,
      women: r.womenCount,
      men: r.menCount,
    }))
}
