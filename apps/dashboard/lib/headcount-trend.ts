// Pure derivation of the overview's workforce trend chart: one point per
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

// The population a point represents, for the gates that ask whether there is
// anything to plot.
export function headcountTotal(point: HeadcountPoint): number {
  return point.women + point.men
}

// The y-axis window for the trend chart: one line of TOTAL headcount, so the
// window is sized to that total's own movement.
//
// Not zero-based, and not a line per gender. An area encodes magnitude so it
// has to sit on zero, which renders a 118 -> 121 change as about one pixel. A
// line per gender does not help either: the two series sit ~20 apart while each
// moves by 1-2, and no single axis can both fit that gap and magnify that
// movement. One total line has neither problem, and the hover still carries the
// split.
export function headcountTrendDomain(
  totals: readonly number[]
): [number, number] {
  if (totals.length === 0) return [0, 1]
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = max - min
  const pad = span > 0 ? span * 0.6 : Math.max(max * 0.05, 1)
  return [Math.max(0, min - pad), max + pad * 0.4]
}
