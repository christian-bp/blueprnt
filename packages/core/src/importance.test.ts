import { describe, expect, it } from "vitest"
import {
  IMPORTANCE_LEVELS,
  IMPORTANCE_SCALE,
  weightForImportance,
} from "./importance"

// The importance scale is FIXED (7 levels). Users pick a label; the engine
// resolves the hidden weight. Level 7 = highest importance = weight 18.
describe("IMPORTANCE_SCALE", () => {
  it("has exactly 7 levels, 1 through 7", () => {
    expect(IMPORTANCE_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("maps levels to the fixed Excel weights", () => {
    expect(IMPORTANCE_SCALE).toEqual({
      1: 8,
      2: 10,
      3: 11,
      4: 12,
      5: 13,
      6: 14,
      7: 18,
    })
  })

  it("weights are strictly ascending with importance", () => {
    const weights = IMPORTANCE_LEVELS.map((l) => IMPORTANCE_SCALE[l])
    const sorted = [...weights].sort((a, b) => a - b)
    expect(weights).toEqual(sorted)
    expect(new Set(weights).size).toBe(7)
  })

  it("weightForImportance resolves a level to its weight", () => {
    expect(weightForImportance(7)).toBe(18)
    expect(weightForImportance(1)).toBe(8)
  })

  it("maps every level to its Excel weight", () => {
    expect(IMPORTANCE_LEVELS.map(weightForImportance)).toEqual([
      8, 10, 11, 12, 13, 14, 18,
    ])
  })
})
