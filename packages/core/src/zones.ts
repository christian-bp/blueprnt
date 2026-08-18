import type { DimensionKey } from "./dimensions"
import { assertUniqueCriteria, assignLevel } from "./scoring"
import type { WeightPoints } from "./weighting"
import type { LevelThreshold, RatingInput } from "./types"

// The four-zone, twelve-level architecture. Zone membership is structural
// law, never configuration: A is the highest zone and level 1 the highest
// level. A zone's profile rule gates entry on the model's profile criteria
// (weight 4-5): a role cannot reach a high zone on totals alone.

export const ZONE_KEYS = ["A", "B", "C", "D"] as const
export type ZoneKey = (typeof ZONE_KEYS)[number]

export const LEVEL_COUNT = 12

// from = the zone's highest level, to = its lowest.
export const ZONE_LEVEL_RANGES: Record<ZoneKey, { from: number; to: number }> =
  {
    A: { from: 1, to: 3 },
    B: { from: 4, to: 6 },
    C: { from: 7, to: 9 },
    D: { from: 10, to: 12 },
  }

export function zoneForLevel(level: number): ZoneKey {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) {
    throw new Error(`level out of range: ${level}`)
  }
  for (const zone of ZONE_KEYS) {
    if (level <= ZONE_LEVEL_RANGES[zone].to) return zone
  }
  throw new Error(`level out of range: ${level}`)
}

// Alias, not a duplicate interface: one shape for the level/minScore pair,
// shared with the scoring engine's LevelThreshold.
export type LevelRule = LevelThreshold

export interface ZoneProfileRule {
  zone: ZoneKey
  minStep: number
}

// Starting points to be calibrated against anchor roles before launch; the
// spread is tighter at the top like the previous seven-level defaults.
export const DEFAULT_LEVEL_RULES: readonly LevelRule[] = [
  { level: 1, minScore: 97 },
  { level: 2, minScore: 92 },
  { level: 3, minScore: 87 },
  { level: 4, minScore: 81 },
  { level: 5, minScore: 75 },
  { level: 6, minScore: 69 },
  { level: 7, minScore: 62 },
  { level: 8, minScore: 55 },
  { level: 9, minScore: 48 },
  { level: 10, minScore: 40 },
  { level: 11, minScore: 31 },
  { level: 12, minScore: 0 },
]

export const DEFAULT_ZONE_PROFILE_RULES: readonly ZoneProfileRule[] = [
  { zone: "A", minStep: 4 },
  { zone: "B", minStep: 3 },
]

// Weight points 4-5 are the high-impact weight classes; carrying one makes a
// criterion part of the model's profile.
export const PROFILE_WEIGHT_FLOOR = 4

export function profileCriteria<
  T extends { weightPoints: number; dimensionKey: DimensionKey },
>(criteria: readonly T[]): T[] {
  // A working-conditions criterion is never a profile criterion, regardless
  // of weight: its 0 means "not covered" (a structural zero, not a low
  // requirement), so gating a zone on it would cap every non-exposed role.
  return criteria.filter(
    (criterion) =>
      criterion.weightPoints >= PROFILE_WEIGHT_FLOOR &&
      criterion.dimensionKey !== "workingConditions"
  )
}

export interface PlacementCriterion {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: WeightPoints
}

export interface ProfileFailure {
  criterionId: string
  required: number
  actual: number
}

export interface Placement {
  level: number
  zone: ZoneKey
  profileLimited: boolean
  profileFailures: ProfileFailure[]
}

export function placeRole(input: {
  score: number
  ratings: RatingInput[]
  criteria: PlacementCriterion[]
  levelRules: LevelRule[]
  zoneProfileRules: ZoneProfileRule[]
}): Placement {
  assertUniqueCriteria(input.criteria)
  const scoreLevel = assignLevel(input.score, input.levelRules)
  const candidateZone = zoneForLevel(scoreLevel)

  const profile = profileCriteria(input.criteria)
  const valueById = new Map(
    input.ratings.map((rating) => [rating.criterionId, rating.value])
  )
  const ruleByZone = new Map(
    input.zoneProfileRules.map((rule) => [rule.zone, rule.minStep])
  )

  const failuresAgainst = (zone: ZoneKey): ProfileFailure[] => {
    const minStep = ruleByZone.get(zone)
    if (minStep === undefined || profile.length === 0) return []
    return profile
      .map((criterion) => ({
        criterionId: criterion.criterionId,
        required: minStep,
        actual: valueById.get(criterion.criterionId) ?? 0,
      }))
      .filter((failure) => failure.actual < failure.required)
  }

  // Walk from the score-implied zone downward to the first zone the profile
  // admits; D always admits because every role must place somewhere.
  const startIndex = ZONE_KEYS.indexOf(candidateZone)
  if (startIndex < 0) {
    throw new Error(`invalid zone: ${candidateZone}`)
  }
  let landedZone: ZoneKey = "D"
  for (const zone of ZONE_KEYS.slice(startIndex)) {
    if (zone === "D" || failuresAgainst(zone).length === 0) {
      landedZone = zone
      break
    }
  }

  // The profile may only ever cap a placement, never lift it: a role that
  // fails its own zone's rule with nowhere lower to go keeps its score level
  // and is only flagged.
  const walked = landedZone !== candidateZone
  const profileLimited = walked || failuresAgainst(landedZone).length > 0

  return {
    level: walked ? ZONE_LEVEL_RANGES[landedZone].from : scoreLevel,
    zone: landedZone,
    profileLimited,
    profileFailures: failuresAgainst(candidateZone),
  }
}
