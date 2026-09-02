import { describe, expect, it } from "vitest"
import { paddedTickDomain } from "./padded-tick-domain"

describe("paddedTickDomain", () => {
  // The reviewer's case: two people, one at each extreme. Fitted to the raw
  // values they sit on the plot's edges under labels like "44 471 kr"; the
  // frame steps outward to a round tick on both sides instead.
  it("frames the extremes one round step inside the window", () => {
    const frame = paddedTickDomain([44_471, 52_442])
    expect(frame.domain).toEqual([42_500, 55_000])
    expect(frame.ticks).toEqual([
      42_500, 45_000, 47_500, 50_000, 52_500, 55_000,
    ])
  })

  // A value that already lands on a round number is still not the edge.
  it("keeps a value on a round number off the edge", () => {
    const frame = paddedTickDomain([40_000, 50_000])
    expect(frame.domain[0]).toBeLessThan(40_000)
    expect(frame.domain[1]).toBeGreaterThan(50_000)
    expect(frame.ticks[0]).toBe(frame.domain[0])
    expect(frame.ticks.at(-1)).toBe(frame.domain[1])
  })

  // Every tick is a multiple of one step, so the axis reads as a scale rather
  // than as the data's own numbers.
  it("spaces the ticks evenly from the low bound to the high bound", () => {
    const { ticks } = paddedTickDomain([31_250, 68_900])
    const step = (ticks[1] ?? 0) - (ticks[0] ?? 0)
    for (let i = 1; i < ticks.length; i += 1) {
      expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBe(step)
    }
  })

  // A flat group (identical pay) has no span to pad; the window is sized
  // from the value itself so the dots sit mid-plot instead of collapsing the
  // axis to a single line.
  it("opens a window around a single repeated value", () => {
    const frame = paddedTickDomain([40_000, 40_000])
    expect(frame.domain[0]).toBeLessThan(40_000)
    expect(frame.domain[1]).toBeGreaterThan(40_000)
    expect(frame.ticks.length).toBeGreaterThanOrEqual(3)
  })

  // Ages and years of service are whole numbers: a half-year tick between 48
  // and 50 is a number nobody is.
  it("uses whole-number steps in integer mode", () => {
    const frame = paddedTickDomain([48, 50], { integer: true })
    expect(frame.domain).toEqual([47, 51])
    expect(frame.ticks).toEqual([47, 48, 49, 50, 51])
  })

  // Neither age nor tenure goes below zero, so the window never shows a
  // negative tick for someone who started this year.
  it("never pads below the floor", () => {
    const frame = paddedTickDomain([0, 3], { integer: true, floor: 0 })
    expect(frame.domain[0]).toBe(0)
    expect(frame.ticks[0]).toBe(0)
    expect(frame.domain[1]).toBeGreaterThan(3)
  })

  it("returns a unit window for no values", () => {
    expect(paddedTickDomain([])).toEqual({ domain: [0, 1], ticks: [0, 1] })
  })
})
