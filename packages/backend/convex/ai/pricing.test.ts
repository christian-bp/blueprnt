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

  // Every model the app can call needs an entry, or writeUsage logs an error
  // on every call and stores the row with no cost. The docs search embeds one
  // query per assistant message, so a missing entry here is a per-message
  // error in the logs and a silent hole in the cost rollup.
  it("pins the mistral-embed snapshot price (documentation search)", () => {
    expect(MODEL_PRICING["mistral-embed"]).toEqual({
      inNanosPerToken: 100,
      outNanosPerToken: 0,
    })
    expect(estimateCostNanos("mistral-embed", 1_000_000, 0)).toBe(100_000_000)
  })
})
