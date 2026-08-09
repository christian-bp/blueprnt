import { describe, expect, it } from "vitest"
import {
  buildHeadcountTrend,
  headcountTotal,
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
