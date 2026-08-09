// The y-axis window shared by the overview's trend lines.
//
// Not zero-based. Both trends plot one line whose movement is small next to
// its own magnitude: a headcount goes 118 -> 121, an annual pay gap 4.3 ->
// 4.1. Anchored at zero either would render as a flat line, and an area
// chart (which must sit on zero, because a filled shape encodes magnitude)
// is the wrong mark for the same reason. A window padded around the values
// is sized to the movement instead, which is the reading.
//
// The low end is never clamped above the smallest value, so a negative pay
// gap (women ahead) still fits.
export function trendDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const pad = span > 0 ? span * 0.6 : Math.max(Math.abs(max) * 0.05, 1)
  return [min - pad, max + pad * 0.4]
}
