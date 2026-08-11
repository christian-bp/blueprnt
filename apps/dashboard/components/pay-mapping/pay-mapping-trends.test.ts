import { describe, expect, it } from "vitest"
import { gapTrend, populationTrend, previousRun } from "./pay-mapping-trends"
import type { PayMappingRunSummary } from "./pay-mapping-run-context"

function run(
  year: number,
  populationCount: number,
  orgGapPct: number | null = 0,
  status = "completed"
): PayMappingRunSummary {
  return {
    status,
    referenceDate: Date.UTC(year, 0, 1),
    label: String(year),
    populationCount,
    orgGapPct,
  }
}

const CURRENT = { referenceDate: Date.UTC(2026, 0, 1), populationCount: 121 }

describe("previousRun", () => {
  it("picks the most recent earlier mapping", () => {
    const previous = previousRun(CURRENT, [
      run(2024, 100),
      run(2025, 118),
      run(2026, 121),
    ])
    expect(previous?.label).toBe("2025")
  })

  it("ignores later mappings and the run itself", () => {
    expect(previousRun(CURRENT, [run(2027, 200), run(2026, 121)])).toBeNull()
  })
})

describe("populationTrend", () => {
  it("measures against the most recent earlier mapping", () => {
    const trend = populationTrend(CURRENT, [
      run(2024, 100),
      run(2025, 118),
      run(2026, 121),
    ])
    expect(trend.previous).toEqual({ label: "2025", count: 118 })
    expect(trend.delta).toBe(3)
  })

  it("reports no previous run on the org's first mapping", () => {
    const trend = populationTrend(CURRENT, [run(2026, 121)])
    expect(trend.previous).toBeNull()
    expect(trend.delta).toBeNull()
  })

  it("ignores later mappings", () => {
    const trend = populationTrend(CURRENT, [run(2027, 200), run(2026, 121)])
    expect(trend.previous).toBeNull()
  })

  // A run's headcount is frozen with its snapshot, so a mapping still being
  // documented is a valid comparison and the one the reader means.
  it("compares against an unfinished earlier mapping", () => {
    const trend = populationTrend(CURRENT, [run(2025, 130, 0, "active")])
    expect(trend.previous).toEqual({ label: "2025", count: 130 })
    expect(trend.delta).toBe(-9)
  })

  it("reports a zero delta distinctly from no previous run", () => {
    const trend = populationTrend(CURRENT, [run(2025, 121)])
    expect(trend.previous).not.toBeNull()
    expect(trend.delta).toBe(0)
  })
})

describe("gapTrend", () => {
  const current = (gapPct: number | null) => ({
    referenceDate: Date.UTC(2026, 0, 1),
    gapPct,
  })

  it("reports a narrowing gap as a negative delta, quoting the earlier gap", () => {
    const trend = gapTrend(current(3.5), [run(2025, 118, 4.1)])
    expect(trend.previous).toEqual({ label: "2025", gapPct: 4.1 })
    // Floating point: 3.5 - 4.1 is not exactly -0.6.
    expect(trend.delta).toBeCloseTo(-0.6, 10)
  })

  it("reports a widening gap as a positive delta", () => {
    const trend = gapTrend(current(4.1), [run(2025, 118, 3.5)])
    expect(trend.delta).toBeCloseTo(0.6, 10)
  })

  it("reports an unchanged gap as a zero delta, distinctly from no comparison", () => {
    const trend = gapTrend(current(3.5), [run(2025, 118, 3.5)])
    expect(trend.previous).not.toBeNull()
    expect(trend.delta).toBe(0)
  })

  it("has no comparison on the org's first mapping", () => {
    const trend = gapTrend(current(3.5), [])
    expect(trend.previous).toBeNull()
    expect(trend.delta).toBeNull()
  })

  // A mapping whose gap could not be measured is part of the history but is
  // not a number this run can be compared against.
  it("has no comparison when the earlier mapping had no measurable gap", () => {
    const trend = gapTrend(current(3.5), [run(2025, 118, null)])
    expect(trend.previous).toBeNull()
    expect(trend.delta).toBeNull()
  })

  it("has no comparison when this mapping has no measurable gap", () => {
    const trend = gapTrend(current(null), [run(2025, 118, 4.1)])
    expect(trend.previous).toBeNull()
    expect(trend.delta).toBeNull()
  })

  it("measures against the most recent earlier mapping", () => {
    const trend = gapTrend(current(3.5), [
      run(2024, 100, 8),
      run(2025, 118, 4.1),
    ])
    expect(trend.previous?.label).toBe("2025")
  })
})
