// Per-track level ladders (standardmall.md:65, ADR-0005). The keys are the
// literal trackKey values from the evaluationModel. V1 levels are reference
// data for person-to-role placement; the lists are ordered lowest to highest.
export const TRACK_LEVELS: Record<"IC" | "Lead" | "M", readonly string[]> = {
  IC: ["IC1", "IC2", "IC3", "IC4", "IC5"],
  Lead: ["Lead-1", "Lead-2", "Lead-3"],
  M: ["M1", "M2", "M3"],
} as const

// Returns true when `level` is a valid level for the given `trackKey`.
// Both arguments are plain strings so callers do not need the Convex
// union type at the call site. An unknown trackKey is always false.
export function isValidLevelForTrack(trackKey: string, level: string): boolean {
  const levels = TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS]
  if (levels === undefined) return false
  return (levels as readonly string[]).includes(level)
}

// The track a level code belongs to ("M2" -> "M", "Lead-2" -> "Lead"),
// resolved against the ladders above so display surfaces can tint a level
// by its track without carrying the track alongside it. Undefined for a
// level no ladder contains.
export function trackKeyForLevel(
  level: string
): keyof typeof TRACK_LEVELS | undefined {
  for (const key of Object.keys(
    TRACK_LEVELS
  ) as (keyof typeof TRACK_LEVELS)[]) {
    if (TRACK_LEVELS[key].includes(level)) return key
  }
  return undefined
}
