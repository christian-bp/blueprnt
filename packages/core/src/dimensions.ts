import type { WeightPoints } from "./weighting"

// The four mandatory evaluation dimensions (the model's constitution, EU
// 2023/970): fixed method law, ordered A-D. Companies choose criteria WITHIN
// dimensions; the dimensions themselves are never configurable.
export const DIMENSION_KEYS = [
  "competence",
  "effort",
  "responsibility",
  "workingConditions",
] as const
export type DimensionKey = (typeof DIMENSION_KEYS)[number]

const DIMENSION_KEY_SET = new Set<string>(DIMENSION_KEYS)

export function isDimensionKey(value: string): value is DimensionKey {
  return DIMENSION_KEY_SET.has(value)
}

// Max active criteria per dimension without special decision, and the hard
// 6-8 bounds for the whole model. Responsibility gets more room because it is
// the broadest dimension, but a ceiling so leadership roles cannot collect
// several parallel point paths.
export const DIMENSION_MAX_ACTIVE: Record<DimensionKey, number> = {
  competence: 2,
  effort: 2,
  responsibility: 3,
  workingConditions: 1,
}
export const MODEL_MIN_CRITERIA = 6
export const MODEL_MAX_CRITERIA = 8

// A dimension carrying more than this share of total weight needs a
// documented motivation before approval.
export const DIMENSION_WEIGHT_WARNING_SHARE = 0.4

// Ratings are 1-5. The value 0 exists only for a working-conditions
// criterion and means "the role is not covered by the defined condition".
export function assertValidRatingValue(
  value: number,
  dimensionKey: DimensionKey
): void {
  const min = dimensionKey === "workingConditions" ? 0 : 1
  if (!Number.isInteger(value) || value < min || value > 5) {
    throw new Error(`rating out of range for ${dimensionKey}: ${value}`)
  }
}

export interface DimensionCriterionInput {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: WeightPoints
}

// Share of the model's total weight per dimension; all zeros when the model
// has no criteria (no division by zero).
export function dimensionWeightShares(
  criteria: DimensionCriterionInput[]
): Record<DimensionKey, number> {
  // Guard before accumulating: a boundary cast (stored data read back as
  // DimensionKey) must never silently siphon weight out of the totals below.
  for (const criterion of criteria) {
    if (!isDimensionKey(criterion.dimensionKey)) {
      throw new Error(`invalid dimension key: ${criterion.dimensionKey}`)
    }
  }
  const totals: Record<DimensionKey, number> = {
    competence: 0,
    effort: 0,
    responsibility: 0,
    workingConditions: 0,
  }
  let total = 0
  for (const criterion of criteria) {
    totals[criterion.dimensionKey] += criterion.weightPoints
    total += criterion.weightPoints
  }
  if (total === 0) return totals
  for (const key of DIMENSION_KEYS) {
    totals[key] = totals[key] / total
  }
  return totals
}
