import { describe, expect, it } from "vitest"
import {
  buildPayGapTrend,
  hasTrendShape,
  type PayGapTrendRun,
} from "./pay-gap-trend"

const run = (
  label: string,
  year: number,
  gap: Pick<PayGapTrendRun, "orgGapPct" | "orgGapFlag"> = {
    orgGapPct: null,
    orgGapFlag: "insufficient",
  }
): PayGapTrendRun => ({
  label,
  referenceDate: Date.UTC(year, 0, 1),
  ...gap,
})

describe("buildPayGapTrend", () => {
  it("returns an empty array for no runs", () => {
    expect(buildPayGapTrend([])).toEqual([])
  })

  // The chart reads left to right, but listPayMappingRuns hands back newest
  // first.
  it("orders points oldest first, whatever order the runs arrive in", () => {
    const trend = buildPayGapTrend([
      run("2026", 2026, { orgGapPct: 4.1, orgGapFlag: "ok" }),
      run("2024", 2024, { orgGapPct: 6.2, orgGapFlag: "elevated" }),
      run("2025", 2025, { orgGapPct: 5.2, orgGapFlag: "elevated" }),
    ])
    expect(trend.map((p) => p.runLabel)).toEqual(["2024", "2025", "2026"])
    expect(trend.map((p) => p.gapPct)).toEqual([6.2, 5.2, 4.1])
  })

  // A mapping that could not be measured is part of the history: the line
  // breaks there rather than dropping to zero.
  it("keeps an unmeasurable mapping as a null point", () => {
    const trend = buildPayGapTrend([
      run("2025", 2025, { orgGapPct: null, orgGapFlag: "insufficient" }),
    ])
    expect(trend).toHaveLength(1)
    expect(trend[0]?.gapPct).toBeNull()
    expect(trend[0]?.flag).toBe("insufficient")
  })

  it("does not mutate the caller's array", () => {
    const runs = [
      run("2026", 2026, { orgGapPct: 4.1, orgGapFlag: "ok" }),
      run("2024", 2024, { orgGapPct: 6.2, orgGapFlag: "elevated" }),
    ]
    buildPayGapTrend(runs)
    expect(runs.map((r) => r.label)).toEqual(["2026", "2024"])
  })
})

describe("hasTrendShape", () => {
  it("needs two readings before a line is a trend", () => {
    expect(hasTrendShape([])).toBe(false)
    expect(hasTrendShape([1])).toBe(false)
    expect(hasTrendShape([1, 2])).toBe(true)
  })
})
