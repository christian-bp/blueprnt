import type { WeightPoints } from "./weighting"

// A rating is the raw 0-5 an assessor gives a role on a criterion.
export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5

// Band 1 is the HIGHEST band. Higher band number = lower weight.
export type Band = number

export const TRACK_KEYS = ["IC", "Lead", "M"] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

export interface CriterionWeight {
  criterionId: string
  weightPoints: WeightPoints
}

// A single hand-entered rating for one criterion. criterionId stays an opaque
// string (Convex ids stringify into it); never tighten to a Convex type.
export interface RatingInput {
  criterionId: string
  value: RatingValue
}

// Inclusive lower bound of a band on the normalized 0-100 score scale, as an
// integer (ADR-0004). Band 1 is highest.
export interface BandThreshold {
  band: number
  minScore: number
}

// One role's ratings, grouped for computeResults.
export interface RoleRatings {
  roleId: string
  ratings: RatingInput[]
}

// Derived result for one role. score/band are non-null only when EVERY model
// criterion has a rating (complete). score is the normalized 0-100 integer.
export interface RoleResult {
  roleId: string
  ratedCount: number
  totalCriteria: number
  complete: boolean
  score: number | null
  band: number | null
}

export interface ComputeInput {
  criteria: CriterionWeight[]
  thresholds: BandThreshold[]
  roles: RoleRatings[]
}
