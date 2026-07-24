import { describe, expect, it } from "vitest"
import { buildHeadcountTrend } from "./headcount-trend"

describe("buildHeadcountTrend", () => {
  it("returns an empty array for no runs", () => {
    expect(buildHeadcountTrend([])).toEqual([])
  })

  it("maps a run's reference date and population count to a point", () => {
    const result = buildHeadcountTrend([
      { referenceDate: 100, populationCount: 5 },
    ])
    expect(result).toEqual([{ date: 100, value: 5 }])
  })

  it("sorts ascending by reference date regardless of input order", () => {
    const result = buildHeadcountTrend([
      { referenceDate: 300, populationCount: 12 },
      { referenceDate: 100, populationCount: 5 },
      { referenceDate: 200, populationCount: 8 },
    ])
    expect(result).toEqual([
      { date: 100, value: 5 },
      { date: 200, value: 8 },
      { date: 300, value: 12 },
    ])
  })

  it("does not mutate the input array", () => {
    const runs = [
      { referenceDate: 300, populationCount: 12 },
      { referenceDate: 100, populationCount: 5 },
    ]
    buildHeadcountTrend(runs)
    expect(runs[0]?.referenceDate).toBe(300)
  })
})
