// The 1-5 weight-point scale under a fixed point budget (ADR-0004). HR
// allocates visible integer points per criterion; the budget (criteria
// count x 3) forces zero-sum prioritization. Percent shares are derived
// display values and never an input.
// See docs/contexts/evaluation-model/viktning-poangbudget.md.
export const WEIGHT_POINT_VALUES = [1, 2, 3, 4, 5] as const

export type WeightPoints = (typeof WEIGHT_POINT_VALUES)[number]

// 3 is the scale midpoint: an all-3 allocation is the neutral baseline.
// A new criterion always enters at 3 (the budget grows by 3 at the same
// time, so the balance is preserved).
export const NEUTRAL_WEIGHT_POINTS: WeightPoints = 3

// Model composition floor: a finished model needs at least this many
// criteria. Enforced at the onboarding gates (Next/finish) and on criterion
// removal once onboarding is complete; while a model is still being built
// the count may dip below freely.
export const MIN_CRITERIA = 5

export function isWeightPoints(value: number): value is WeightPoints {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

// Total weight points to distribute: criteria count x 3.
export function pointBudget(criterionCount: number): number {
  if (!Number.isInteger(criterionCount) || criterionCount < 0) {
    throw new Error(`invalid criterion count: ${criterionCount}`)
  }
  return criterionCount * NEUTRAL_WEIGHT_POINTS
}

// Sum minus budget: 0 = balanced, positive = over budget, negative = under.
// Throws on values outside the 1-5 scale so an invalid allocation can never
// read as balanced.
export function budgetDelta(points: readonly number[]): number {
  let sum = 0
  for (const value of points) {
    if (!isWeightPoints(value)) {
      throw new Error(`invalid weight points: ${value}`)
    }
    sum += value
  }
  return sum - pointBudget(points.length)
}

export function isBalanced(points: readonly number[]): boolean {
  return budgetDelta(points) === 0
}
