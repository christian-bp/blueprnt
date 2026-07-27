import { describe, expect, it } from "vitest"
import { buildHeadcountTrend, headcountTrendDomain } from "./headcount-trend"

describe("buildHeadcountTrend", () => {
  it("returns an empty array for no runs", () => {
    expect(buildHeadcountTrend([])).toEqual([])
  })

  it("maps a run's label, reference date and population count to a point", () => {
    const result = buildHeadcountTrend([
      {
        label: "Lönekartläggning 2026",
        referenceDate: 100,
        populationCount: 5,
      },
    ])
    expect(result).toEqual([
      { date: 100, runLabel: "Lönekartläggning 2026", value: 5 },
    ])
  })

  it("sorts ascending by reference date regardless of input order", () => {
    const result = buildHeadcountTrend([
      { label: "Third", referenceDate: 300, populationCount: 12 },
      { label: "First", referenceDate: 100, populationCount: 5 },
      { label: "Second", referenceDate: 200, populationCount: 8 },
    ])
    expect(result.map((p) => p.runLabel)).toEqual(["First", "Second", "Third"])
    expect(result.map((p) => p.value)).toEqual([5, 8, 12])
  })

  it("does not mutate the input array", () => {
    const runs = [
      { label: "Third", referenceDate: 300, populationCount: 12 },
      { label: "First", referenceDate: 100, populationCount: 5 },
    ]
    buildHeadcountTrend(runs)
    expect(runs[0]?.referenceDate).toBe(300)
  })
})

describe("headcountTrendDomain", () => {
  it("returns a valid window for no values", () => {
    const [low, high] = headcountTrendDomain([])
    expect(low).toBeLessThan(high)
  })

  it("does not anchor the window at zero", () => {
    // The bug this guards: a 0-anchored axis drew 118 -> 121 as a flat line.
    const [low] = headcountTrendDomain([118, 121])
    expect(low).toBeGreaterThan(100)
  })

  it("gives the change most of the window", () => {
    const values = [118, 121]
    const [low, high] = headcountTrendDomain(values)
    const span = Math.max(...values) - Math.min(...values)
    expect(span / (high - low)).toBeGreaterThan(0.4)
  })

  it("keeps every value inside the window, with room under the lowest", () => {
    const values = [90, 104, 118, 121]
    const [low, high] = headcountTrendDomain(values)
    expect(low).toBeLessThan(Math.min(...values))
    expect(high).toBeGreaterThan(Math.max(...values))
  })

  it("brackets a flat series instead of collapsing to a point", () => {
    const [low, high] = headcountTrendDomain([120, 120])
    expect(low).toBeLessThan(120)
    expect(high).toBeGreaterThan(120)
  })

  it("never drops below zero", () => {
    const [low] = headcountTrendDomain([1, 2])
    expect(low).toBeGreaterThanOrEqual(0)
  })
})
