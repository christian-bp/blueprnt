// The shape the band Overview components consume. It is a structural subset
// of a getResults row (assessment/results.ts), so rows can be passed straight
// through. Score/band are derived at read time and may be null while a role's
// assessment is incomplete (ADR-0002).
export interface BandRoleRow {
  roleId: string
  title: string
  slug: string
  trackKey: string
  trackName: string
  score: number | null
  band: number | null
  ratedCount: number
  totalCriteria: number
  familyId: string | null
  familyName: string | null
  anchor: { expectedBand: number; status: "active" | "underReview" } | null
}

export interface BandRange {
  band: number
  min: number
  max: number
}

// The closed [min,max] weighting range each band covers, derived from the
// model's band thresholds (minScore is the inclusive lower bound). Band 1 is
// the highest band and tops out at 100; every other band's max is one below
// the next-higher band's minScore. Pure so it stays unit-testable.
export function bandRanges(
  bands: { band: number; minScore: number }[]
): BandRange[] {
  const sorted = [...bands].sort((a, b) => a.band - b.band)
  return sorted.map((threshold, index) => {
    const prevBand = sorted[index - 1]
    return {
      band: threshold.band,
      min: threshold.minScore,
      max: prevBand ? prevBand.minScore - 1 : 100,
    }
  })
}

// Fixed V1 track order (ADR-0006); unknown future keys sort last.
const TRACK_ORDER: Record<string, number> = { IC: 0, Lead: 1, M: 2 }

// The matrix track columns, as { key, name }, sorted by the fixed track order.
// Derive these from the UNFILTERED roles so the grid stays stable while the
// family filter changes: hidden families leave hatched empty cells instead of
// collapsing the column set (and an all-hidden filter still shows the full
// hatched grid rather than nothing). Pure so it stays unit-testable.
export function trackColumns(
  rows: { trackKey: string; trackName: string }[]
): { key: string; name: string }[] {
  return [
    ...new Map(rows.map((row) => [row.trackKey, row.trackName])).entries(),
  ]
    .sort((a, b) => (TRACK_ORDER[a[0]] ?? 99) - (TRACK_ORDER[b[0]] ?? 99))
    .map(([key, name]) => ({ key, name }))
}
