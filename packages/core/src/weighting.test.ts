import { describe, expect, it } from "vitest"
import {
  budgetDelta,
  isBalanced,
  isWeightPoints,
  NEUTRAL_WEIGHT_POINTS,
  pointBudget,
  WEIGHT_POINT_VALUES,
} from "./weighting"

// Weight points are 1-5 under a hard point budget (criteria count x 3,
// exact sum). See ADR-0004 and viktning-poangbudget.md.
describe("weight points", () => {
  it("the scale is 1 through 5 with 3 as the neutral midpoint", () => {
    expect(WEIGHT_POINT_VALUES).toEqual([1, 2, 3, 4, 5])
    expect(NEUTRAL_WEIGHT_POINTS).toBe(3)
  })

  it("isWeightPoints accepts exactly the integers 1-5", () => {
    for (const value of WEIGHT_POINT_VALUES) {
      expect(isWeightPoints(value)).toBe(true)
    }
    expect(isWeightPoints(0)).toBe(false)
    expect(isWeightPoints(6)).toBe(false)
    expect(isWeightPoints(3.5)).toBe(false)
    expect(isWeightPoints(Number.NaN)).toBe(false)
  })
})

describe("pointBudget", () => {
  it("is criteria count times 3", () => {
    expect(pointBudget(9)).toBe(27)
    expect(pointBudget(5)).toBe(15)
    expect(pointBudget(0)).toBe(0)
  })

  it("throws on a negative or fractional count", () => {
    expect(() => pointBudget(-1)).toThrow(/invalid criterion count/)
    expect(() => pointBudget(2.5)).toThrow(/invalid criterion count/)
  })
})

describe("budgetDelta", () => {
  it("is zero for the neutral all-3 allocation", () => {
    expect(budgetDelta([3, 3, 3])).toBe(0)
    expect(isBalanced([3, 3, 3])).toBe(true)
  })

  it("is zero for the standard template allocation (sum 27)", () => {
    expect(budgetDelta([5, 4, 4, 3, 3, 3, 2, 2, 1])).toBe(0)
  })

  it("signals over and under budget", () => {
    expect(budgetDelta([4, 3, 3])).toBe(1)
    expect(budgetDelta([2, 3, 3])).toBe(-1)
    expect(isBalanced([4, 3, 3])).toBe(false)
  })

  it("an empty allocation is balanced (budget 0)", () => {
    expect(budgetDelta([])).toBe(0)
  })

  it("throws on out-of-scale values instead of reading them as balanced", () => {
    expect(() => budgetDelta([0, 3, 6])).toThrow(/invalid weight points/)
    expect(() => budgetDelta([3, 2.5])).toThrow(/invalid weight points/)
  })
})
