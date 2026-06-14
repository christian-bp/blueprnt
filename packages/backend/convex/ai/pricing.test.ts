import { describe, expect, it } from "vitest"
import { MODEL_PRICING, estimateCostNanos } from "./pricing"

describe("estimateCostNanos", () => {
  it("computes exact integer nano-USD for a known model", () => {
    // mistral-large-latest: 500 nano-USD per input token, 1500 per output token.
    expect(estimateCostNanos("mistral-large-latest", 1000, 200)).toBe(
      1000 * 500 + 200 * 1500
    )
  })

  it("is zero for zero tokens", () => {
    expect(estimateCostNanos("mistral-large-latest", 0, 0)).toBe(0)
  })

  it("returns null for a model with no pricing", () => {
    expect(estimateCostNanos("some-unpriced-model", 100, 100)).toBeNull()
  })

  it("pins the mistral-large-latest snapshot price", () => {
    expect(MODEL_PRICING["mistral-large-latest"]).toEqual({
      inNanosPerToken: 500,
      outNanosPerToken: 1500,
    })
  })

  it("pins the mistral-small-latest snapshot price (the fast profile model)", () => {
    expect(MODEL_PRICING["mistral-small-latest"]).toEqual({
      inNanosPerToken: 100,
      outNanosPerToken: 300,
    })
  })
})
