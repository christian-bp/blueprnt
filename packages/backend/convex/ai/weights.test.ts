import { describe, expect, it } from "vitest"
import { applicableMoves, distinctMoves, repairDraftWeights } from "./weights"

describe("repairDraftWeights", () => {
  it("passes a balanced allocation through unchanged", () => {
    expect(repairDraftWeights([5, 4, 4, 3, 3, 3, 2, 2, 1])).toEqual([
      5, 4, 4, 3, 3, 3, 2, 2, 1,
    ])
    expect(repairDraftWeights([3, 3, 3])).toEqual([3, 3, 3])
    expect(repairDraftWeights([])).toEqual([])
  })

  it("pulls an over-budget allocation down to the exact budget", () => {
    // All-5 collapses to the neutral all-3 (sum 9 for 3 criteria).
    expect(repairDraftWeights([5, 5, 5])).toEqual([3, 3, 3])
    // One point over with two tied maxima: the FIRST index gives (stable,
    // deterministic).
    expect(repairDraftWeights([4, 4, 2])).toEqual([3, 4, 2])
  })

  it("pushes an under-budget allocation up to the exact budget", () => {
    expect(repairDraftWeights([1, 1, 1])).toEqual([3, 3, 3])
  })

  it("clamps out-of-scale values before walking to the budget", () => {
    // 9 clamps to 5; the remaining deficit lifts the minima.
    expect(repairDraftWeights([9, 1, 1])).toEqual([5, 2, 2])
    expect(repairDraftWeights([0, 3, 3])).toEqual([3, 3, 3])
  })

  it("every repaired value stays within 1-5", () => {
    const repaired = repairDraftWeights([5, 5, 5, 5, 5, 1, 1, 1, 1])
    expect(repaired.reduce((sum, value) => sum + value, 0)).toBe(27)
    for (const value of repaired) {
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(5)
    }
  })
})

describe("applicableMoves", () => {
  const criteria = [
    { criterionId: "a", weightPoints: 5 },
    { criterionId: "b", weightPoints: 3 },
    { criterionId: "c", weightPoints: 1 },
  ]

  it("keeps moves that stay within the 1-5 scale", () => {
    const moves = [
      { fromCriterionId: "a", toCriterionId: "c", points: 2, motivation: "m" },
      { fromCriterionId: "b", toCriterionId: "c", points: 1, motivation: "m" },
    ]
    expect(applicableMoves(moves, criteria)).toEqual(moves)
  })

  it("drops moves that would leave the scale", () => {
    const moves = [
      // c cannot give: 1 - 1 = 0.
      { fromCriterionId: "c", toCriterionId: "b", points: 1, motivation: "m" },
      // a cannot receive: 5 + 1 = 6.
      { fromCriterionId: "b", toCriterionId: "a", points: 1, motivation: "m" },
      // b can give at most 2: 3 - 3 = 0.
      { fromCriterionId: "b", toCriterionId: "c", points: 3, motivation: "m" },
    ]
    expect(applicableMoves(moves, criteria)).toEqual([])
  })

  it("drops self-moves, unknown ids, and non-positive transfers", () => {
    const moves = [
      { fromCriterionId: "a", toCriterionId: "a", points: 1, motivation: "m" },
      {
        fromCriterionId: "ghost",
        toCriterionId: "b",
        points: 1,
        motivation: "m",
      },
      { fromCriterionId: "a", toCriterionId: "b", points: 0, motivation: "m" },
      {
        fromCriterionId: "a",
        toCriterionId: "b",
        points: 1.5,
        motivation: "m",
      },
    ]
    expect(applicableMoves(moves, criteria)).toEqual([])
  })
})

describe("distinctMoves", () => {
  it("keeps disjoint moves untouched", () => {
    const moves = [
      { fromCriterionId: "a", toCriterionId: "b", points: 1, motivation: "m" },
      { fromCriterionId: "c", toCriterionId: "d", points: 2, motivation: "m" },
    ]
    expect(distinctMoves(moves)).toEqual(moves)
  })

  it("drops later moves that reuse a criterion (first wins)", () => {
    const first = {
      fromCriterionId: "a",
      toCriterionId: "b",
      points: 1,
      motivation: "m",
    }
    const moves = [
      first,
      // Reuses "a" as the giver again.
      { fromCriterionId: "a", toCriterionId: "c", points: 1, motivation: "m" },
      // Reuses "b" (a receiver) as the giver.
      { fromCriterionId: "b", toCriterionId: "d", points: 1, motivation: "m" },
      // Reuses "a" as a receiver.
      { fromCriterionId: "e", toCriterionId: "a", points: 1, motivation: "m" },
    ]
    expect(distinctMoves(moves)).toEqual([first])
  })
})
