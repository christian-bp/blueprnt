import type { DimensionKey } from "./dimensions"
import type { WeightPoints } from "./weighting"
import type { ProfileFailure, ZoneKey, ZoneProfileRule } from "./zones"

// A rating is the raw 1-5 an assessor gives a role on a criterion; 0 is valid
// only for a workingConditions criterion (assertValidRatingValue).
export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5

// Level 1 is the HIGHEST level. Higher level number = lower weight.
export type Level = number

export interface CriterionWeight {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: WeightPoints
}

// Per-criterion contribution to a role's score. contribution = value *
// weightPoints; share is its fraction (0..1) of the role's total
// contribution. Derived for display (ADR-0002), never stored.
export interface CriterionShare {
  criterionId: string
  contribution: number
  share: number
}

// A single hand-entered rating for one criterion. criterionId stays an opaque
// string (Convex ids stringify into it); never tighten to a Convex type.
export interface RatingInput {
  criterionId: string
  value: RatingValue
}

// Inclusive lower bound of a level on the normalized 0-100 score scale, as an
// integer (ADR-0004). Level 1 is highest.
export interface LevelThreshold {
  level: number
  minScore: number
}

// One role's ratings, grouped for computeResults.
export interface RoleRatings {
  roleId: string
  ratings: RatingInput[]
}

// Derived result for one role. score/level are non-null only when EVERY model
// criterion has a rating (complete). score is the normalized 0-100 integer.
// zone/profileLimited/profileFailures are placeRole's outcome (zones.ts):
// null together with level whenever the role is incomplete.
export interface RoleResult {
  roleId: string
  ratedCount: number
  totalCriteria: number
  complete: boolean
  score: number | null
  level: number | null
  zone: ZoneKey | null
  profileLimited: boolean | null
  profileFailures: ProfileFailure[] | null
}

export interface ComputeInput {
  criteria: CriterionWeight[]
  thresholds: LevelThreshold[]
  zoneProfileRules: ZoneProfileRule[]
  roles: RoleRatings[]
}
