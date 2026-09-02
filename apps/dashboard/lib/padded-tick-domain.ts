// A numeric axis window that steps OUTWARD from the data to round ticks.
//
// Recharts fits a numeric axis to the data's own extremes: the two most
// extreme people sit on the plot's top and bottom edges, and when the domain
// is pinned (to keep a reference line inside it) the tick labels become the
// raw values themselves ("44 471 kr"). This pads the data range by a share of
// its span, picks a 1/2/2.5/5 step for about `tickCount` ticks over it, and
// rounds both bounds out to that step, so the extremes land at least a part
// of a step inside the window and every label is a round number.
//
// Not the trend window (trend-domain.ts), which is asymmetric and tick-free
// by design: a line's movement is the reading there, and here it is where
// each dot sits against a scale.
const PAD_SHARE = 0.1
// A flat set (identical values) has no span to pad; open a window sized from
// the value itself so the dots sit mid-plot rather than on a collapsed axis.
const FLAT_SHARE = 0.05
const STEP_CANDIDATES = [1, 2, 2.5, 5, 10] as const

export interface TickDomain {
  domain: [number, number]
  ticks: number[]
}

export function paddedTickDomain(
  values: readonly number[],
  options: {
    tickCount?: number
    // Whole-number steps only (ages, years of service).
    integer?: boolean
    // The window never pads below this (a tenure cannot be negative).
    floor?: number
  } = {}
): TickDomain {
  const { tickCount = 5, integer = false, floor } = options
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] }
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low
  const pad =
    span > 0 ? span * PAD_SHARE : Math.max(Math.abs(high) * FLAT_SHARE, 1)
  const paddedLow = floor === undefined ? low - pad : Math.max(floor, low - pad)
  const paddedHigh = high + pad
  const step = niceStep((paddedHigh - paddedLow) / (tickCount - 1), integer)
  const domainLow = Math.floor(paddedLow / step) * step
  const domainHigh = Math.ceil(paddedHigh / step) * step
  const ticks: number[] = []
  for (let value = domainLow; value <= domainHigh; value += step) {
    ticks.push(roundOff(value))
  }
  return { domain: [roundOff(domainLow), roundOff(domainHigh)], ticks }
}

// The smallest 1/2/2.5/5-shaped step at or above the raw one, so the window
// holds at most tickCount ticks before the bounds round outward.
function niceStep(raw: number, integer: boolean): number {
  const base = 10 ** Math.floor(Math.log10(Math.max(raw, Number.EPSILON)))
  const scale = integer ? Math.max(1, base) : base
  for (const candidate of STEP_CANDIDATES) {
    const step = candidate * scale
    if (integer && !Number.isInteger(step)) continue
    if (step >= raw) return step
  }
  return 10 * scale
}

// Accumulated step additions drift in binary (47.5 + 2.5 is exact, 0.1 + 0.2
// is not); settle each tick to a value that prints as the number it is.
function roundOff(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
