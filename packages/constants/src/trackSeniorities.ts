// Per-track seniority ladders (standardmall.md:65, ADR-0005). The keys are the
// literal trackKey values from the evaluationModel. V1 seniorities are reference
// data for person-to-role placement; the lists are ordered lowest to highest.
export const TRACK_SENIORITIES: Record<"IC" | "Lead" | "M", readonly string[]> =
  {
    IC: ["IC1", "IC2", "IC3", "IC4", "IC5"],
    Lead: ["Lead-1", "Lead-2", "Lead-3"],
    M: ["M1", "M2", "M3"],
  } as const

// Returns true when `seniority` is a valid seniority for the given `trackKey`.
// Both arguments are plain strings so callers do not need the Convex
// union type at the call site. An unknown trackKey is always false.
export function isValidSeniorityForTrack(
  trackKey: string,
  seniority: string
): boolean {
  const seniorities =
    TRACK_SENIORITIES[trackKey as keyof typeof TRACK_SENIORITIES]
  if (seniorities === undefined) return false
  return (seniorities as readonly string[]).includes(seniority)
}

// The track a seniority code belongs to ("M2" -> "M", "Lead-2" -> "Lead"),
// resolved against the ladders above so display surfaces can tint a seniority
// by its track without carrying the track alongside it. Undefined for a
// seniority no ladder contains.
export function trackKeyForSeniority(
  seniority: string
): keyof typeof TRACK_SENIORITIES | undefined {
  for (const key of Object.keys(
    TRACK_SENIORITIES
  ) as (keyof typeof TRACK_SENIORITIES)[]) {
    if (TRACK_SENIORITIES[key].includes(seniority)) return key
  }
  return undefined
}
