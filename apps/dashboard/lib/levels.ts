import type { ZoneKey } from "@workspace/core"

// The shape the level Overview components consume. It is a structural subset
// of a getResults row (assessment/results.ts), so rows can be passed straight
// through. Score/level are derived at read time and may be null while a role's
// assessment is incomplete (ADR-0002).
export interface LevelRoleRow {
  roleId: string
  title: string
  slug: string
  trackKey: string
  trackName: string
  score: number | null
  level: number | null
  // The zone the ENGINE placed the role in (placeRole, ADR-0022), null while
  // the role has no placement. Carried on the row rather than derived from the
  // level in the UI: placement is the engine's judgement, and a surface that
  // re-derived it would be a second authority on structural law.
  zone: ZoneKey | null
  ratedCount: number
  totalCriteria: number
  // Complete but not yet locked (lock-as-reveal, spec 2.4/6): the row has no
  // level yet not because it is unrated, but because its result has not been
  // revealed. PendingRoles uses this to tell the two apart.
  readyToLock: boolean
  familyId: string | null
  familyName: string | null
  anchor: { expectedLevel: number; status: "active" | "underReview" } | null
}

export interface LevelRange {
  level: number
  min: number
  max: number
}

// The closed [min,max] weighting range each level covers, derived from the
// model's level thresholds (minScore is the inclusive lower bound). Level 1 is
// the highest level and tops out at 100; every other level's max is one below
// the next-higher level's minScore. Pure so it stays unit-testable.
export function levelRanges(
  levels: { level: number; minScore: number }[]
): LevelRange[] {
  const sorted = [...levels].sort((a, b) => a.level - b.level)
  return sorted.map((threshold, index) => {
    const prevLevel = sorted[index - 1]
    return {
      level: threshold.level,
      min: threshold.minScore,
      max: prevLevel ? prevLevel.minScore - 1 : 100,
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
