import { describe, expect, it } from "vitest"
import {
  assertValidRatingValue,
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
  dimensionWeightShares,
  isDimensionKey,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
} from "./dimensions"

describe("dimension constants", () => {
  it("defines the four dimensions in constitution order", () => {
    expect(DIMENSION_KEYS).toEqual([
      "competence",
      "effort",
      "responsibility",
      "workingConditions",
    ])
  })

  it("caps active criteria per dimension at 2/2/3/1 within a 6-8 model", () => {
    expect(DIMENSION_MAX_ACTIVE).toEqual({
      competence: 2,
      effort: 2,
      responsibility: 3,
      workingConditions: 1,
    })
    expect(MODEL_MIN_CRITERIA).toBe(6)
    expect(MODEL_MAX_CRITERIA).toBe(8)
  })

  // The per-dimension caps sum to exactly the model's own ceiling, so a full
  // model is always four full dimensions and the bound that binds is always a
  // dimension's own. Asserted rather than assumed: raising a cap or lowering
  // MODEL_MAX_CRITERIA makes the model ceiling start binding first on a
  // dimension that still has room, which changes what the builder can offer
  // and has to be a deliberate engine decision rather than a side effect.
  it("keeps the dimension caps summing to the model's own ceiling", () => {
    const capped = DIMENSION_KEYS.reduce(
      (sum, key) => sum + DIMENSION_MAX_ACTIVE[key],
      0
    )
    expect(capped).toBe(MODEL_MAX_CRITERIA)
  })

  it("narrows dimension keys", () => {
    expect(isDimensionKey("effort")).toBe(true)
    expect(isDimensionKey("Effort")).toBe(false)
    expect(isDimensionKey("")).toBe(false)
  })
})

describe("assertValidRatingValue", () => {
  it("accepts 1-5 for every dimension", () => {
    for (const dimension of DIMENSION_KEYS) {
      for (const value of [1, 2, 3, 4, 5]) {
        expect(() => assertValidRatingValue(value, dimension)).not.toThrow()
      }
    }
  })

  it("accepts 0 only for workingConditions", () => {
    expect(() => assertValidRatingValue(0, "workingConditions")).not.toThrow()
    expect(() => assertValidRatingValue(0, "competence")).toThrow()
    expect(() => assertValidRatingValue(0, "effort")).toThrow()
    expect(() => assertValidRatingValue(0, "responsibility")).toThrow()
  })

  it("rejects out-of-range and non-integer values", () => {
    expect(() => assertValidRatingValue(6, "competence")).toThrow()
    expect(() => assertValidRatingValue(-1, "workingConditions")).toThrow()
    expect(() => assertValidRatingValue(2.5, "effort")).toThrow()
    expect(() => assertValidRatingValue(Number.NaN, "effort")).toThrow()
  })
})

describe("dimensionWeightShares", () => {
  it("computes each dimension's share of total weight", () => {
    const shares = dimensionWeightShares([
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 4 },
      { criterionId: "c", dimensionKey: "responsibility", weightPoints: 5 },
      { criterionId: "d", dimensionKey: "responsibility", weightPoints: 3 },
    ])
    expect(shares.competence).toBeCloseTo(3 / 15)
    expect(shares.effort).toBeCloseTo(4 / 15)
    expect(shares.responsibility).toBeCloseTo(8 / 15)
    expect(shares.workingConditions).toBe(0)
  })

  it("returns all zeros for an empty model", () => {
    expect(dimensionWeightShares([])).toEqual({
      competence: 0,
      effort: 0,
      responsibility: 0,
      workingConditions: 0,
    })
  })

  it("throws on an invalid dimension key smuggled via a cast", () => {
    expect(() =>
      dimensionWeightShares([
        {
          criterionId: "x",
          dimensionKey: "bogus" as DimensionKey,
          weightPoints: 3,
        },
      ])
    ).toThrow()
  })
})
