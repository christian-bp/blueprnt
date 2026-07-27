// Pure derivation of the overview's workforce trend chart: one point per
// pay-mapping run's reference date and headcount, oldest first (so the area
// chart's x-axis reads left-to-right chronologically), from the same
// listPayMappingRuns rows use-pay-mapping-headline.ts already subscribes to
// (Convex dedupes the identical query, no extra fetch). Each point carries the
// run's own label so the chart can name the pay mapping a headcount came from:
// two runs can share a reference date, and the date alone reads as a workforce
// number over time rather than one pay mapping's population.
export type HeadcountPoint = { date: number; runLabel: string; value: number }

export type HeadcountTrendRun = {
  label: string
  referenceDate: number
  populationCount: number
}

export function buildHeadcountTrend(
  runs: HeadcountTrendRun[]
): HeadcountPoint[] {
  return [...runs]
    .sort((a, b) => a.referenceDate - b.referenceDate)
    .map((r) => ({
      date: r.referenceDate,
      runLabel: r.label,
      value: r.populationCount,
    }))
}

// The y-axis window for the trend's area chart. A headcount series sits in a
// narrow band far above zero (118 then 121), so a zero-anchored axis flattens
// the curve into a straight line: 3 people out of a 0-140 axis is one pixel in
// a 56px chart. Anchoring the window on the data instead lets the real change
// use the chart's height, while the skirt below the lowest point keeps a
// visible area under the curve. A flat or single-point series has no span to
// scale to, so it falls back to a window proportional to its own value.
export function headcountTrendDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const pad = span > 0 ? span * 0.6 : Math.max(max * 0.1, 1)
  return [Math.max(0, min - pad), max + pad * 0.4]
}
