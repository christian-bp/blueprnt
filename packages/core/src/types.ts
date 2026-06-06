import type { ImportanceLevel } from "./importance"

// A rating is the raw 0-5 an assessor gives a role on a criterion.
export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5

// Band 1 is the HIGHEST band. Higher band number = lower weight.
export type Band = number

export const TRACK_KEYS = ["IC", "Lead", "M"] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

export interface CriterionWeight {
  criterionId: string
  importanceLevel: ImportanceLevel
}

// A single hand-entered rating for one criterion. criterionId stays an opaque
// string (Convex ids stringify into it); never tighten to a Convex type.
export interface RatingInput {
  criterionId: string
  value: RatingValue
}

// Inclusive lower bound of a band. Band 1 is highest.
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
// criterion has a rating (complete).
export interface RoleResult {
  roleId: string
  ratedCount: number
  totalCriteria: number
  complete: boolean
  score: number | null
  band: number | null
}

// Advisory per-(level, criterion) rating range.
export interface GuardrailRange {
  criterionId: string
  min: number
  max: number
}

export interface GuardrailWarning {
  criterionId: string
  value: RatingValue
  min: number
  max: number
}

export interface ComputeInput {
  criteria: CriterionWeight[]
  thresholds: BandThreshold[]
  roles: RoleRatings[]
}
