import { describe, expect, it } from "vitest"
import type { PayMappingRunSummary } from "./pay-mapping-run-context"
import { populationTrend } from "./pay-mapping-population"

function run(
  year: number,
  populationCount: number,
  status = "completed"
): PayMappingRunSummary {
  return {
    status,
    referenceDate: Date.UTC(year, 0, 1),
    label: String(year),
    populationCount,
  }
}

const CURRENT = { referenceDate: Date.UTC(2026, 0, 1), populationCount: 121 }

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
    const trend = populationTrend(CURRENT, [run(2025, 130, "active")])
    expect(trend.previous).toEqual({ label: "2025", count: 130 })
    expect(trend.delta).toBe(-9)
  })

  it("reports a zero delta distinctly from no previous run", () => {
    const trend = populationTrend(CURRENT, [run(2025, 121)])
    expect(trend.previous).not.toBeNull()
    expect(trend.delta).toBe(0)
  })
})
