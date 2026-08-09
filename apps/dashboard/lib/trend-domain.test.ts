import { describe, expect, it } from "vitest"
import { trendDomain } from "./trend-domain"

describe("trendDomain", () => {
  it("returns a valid window for no points", () => {
    const [low, high] = trendDomain([])
    expect(low).toBeLessThan(high)
  })

  it("does not anchor at zero", () => {
    // The whole reason the trends are lines and not stacked areas: on a
    // zero-based axis 118 -> 121 is about one pixel.
    const [low] = trendDomain([118, 121])
    expect(low).toBeGreaterThan(100)
  })

  it("keeps every value inside the window", () => {
    const [low, high] = trendDomain([118, 121])
    expect(low).toBeLessThan(118)
    expect(high).toBeGreaterThan(121)
  })

  it("gives the change most of the window", () => {
    // The point of the padded window: a 3-person move has to be legible.
    const [low, high] = trendDomain([118, 121])
    expect(3 / (high - low)).toBeGreaterThan(0.4)
  })

  it("brackets a flat pair instead of collapsing to a point", () => {
    const [low, high] = trendDomain([120, 120])
    expect(low).toBeLessThan(120)
    expect(high).toBeGreaterThan(120)
  })

  // A pay gap can be negative (women ahead of men), so the window must not
  // clamp its low end at zero the way a headcount window could.
  it("fits negative values", () => {
    const [low, high] = trendDomain([-2.5, 4.1])
    expect(low).toBeLessThan(-2.5)
    expect(high).toBeGreaterThan(4.1)
  })

  it("brackets a single flat negative reading", () => {
    const [low, high] = trendDomain([-3, -3])
    expect(low).toBeLessThan(-3)
    expect(high).toBeGreaterThan(-3)
  })
})
