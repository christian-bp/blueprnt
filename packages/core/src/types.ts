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
