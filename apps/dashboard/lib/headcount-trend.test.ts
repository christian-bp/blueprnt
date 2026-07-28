import { describe, expect, it } from "vitest"
import {
  buildHeadcountTrend,
  headcountTotal,
  headcountTrendDomain,
  type HeadcountTrendRun,
} from "./headcount-trend"

const run = (
  label: string,
  referenceDate: number,
  womenCount: number,
  menCount: number
): HeadcountTrendRun => ({ label, referenceDate, womenCount, menCount })

describe("buildHeadcountTrend", () => {
  it("returns an empty array for no runs", () => {
    expect(buildHeadcountTrend([])).toEqual([])
  })

  it("maps a run's label, reference date and gender split to a point", () => {
    const result = buildHeadcountTrend([
      run("Lönekartläggning 2026", 100, 2, 3),
    ])
    expect(result).toEqual([
      { date: 100, runLabel: "Lönekartläggning 2026", women: 2, men: 3 },
    ])
  })

  it("sorts ascending by reference date regardless of input order", () => {
    const result = buildHeadcountTrend([
      run("Third", 300, 6, 6),
      run("First", 100, 2, 3),
      run("Second", 200, 4, 4),
    ])
    expect(result.map((p) => p.runLabel)).toEqual(["First", "Second", "Third"])
    expect(result.map(headcountTotal)).toEqual([5, 8, 12])
  })

  it("does not mutate the input array", () => {
    const runs = [run("Third", 300, 6, 6), run("First", 100, 2, 3)]
    buildHeadcountTrend(runs)
    expect(runs[0]?.referenceDate).toBe(300)
  })
})

describe("headcountTotal", () => {
  it("sums the two series", () => {
    expect(headcountTotal({ date: 1, runLabel: "x", women: 49, men: 72 })).toBe(
      121
    )
  })

  it("is zero for an empty population", () => {
    expect(headcountTotal({ date: 1, runLabel: "x", women: 0, men: 0 })).toBe(0)
  })
})

describe("headcountTrendDomain", () => {
  it("returns a valid window for no points", () => {
    const [low, high] = headcountTrendDomain([])
    expect(low).toBeLessThan(high)
  })

  it("does not anchor at zero", () => {
    // The whole reason the trend is lines and not stacked areas: on a
    // zero-based axis 118 -> 121 is about one pixel.
    const [low] = headcountTrendDomain([118, 121])
    expect(low).toBeGreaterThan(100)
  })

  it("keeps every total inside the window", () => {
    const [low, high] = headcountTrendDomain([118, 121])
    expect(low).toBeLessThan(118)
    expect(high).toBeGreaterThan(121)
  })

  it("gives the change most of the window", () => {
    // The point of the padded window: a 3-person move has to be legible.
    const [low, high] = headcountTrendDomain([118, 121])
    expect(3 / (high - low)).toBeGreaterThan(0.4)
  })

  it("brackets a flat pair instead of collapsing to a point", () => {
    const [low, high] = headcountTrendDomain([120, 120])
    expect(low).toBeLessThan(120)
    expect(high).toBeGreaterThan(120)
  })

  it("never drops below zero", () => {
    const [low] = headcountTrendDomain([1, 2])
    expect(low).toBeGreaterThanOrEqual(0)
  })
})
