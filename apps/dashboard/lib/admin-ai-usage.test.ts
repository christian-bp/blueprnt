import { describe, expect, it } from "vitest"
import {
  type AiUsageOrgRow,
  computeOutlierOrgIds,
  computeTotals,
  formatUsd,
  formatUsdCost,
  kindCounts,
  median,
  momChangePct,
  nanosToUsd,
  OUTLIER_FLOOR_NANOS,
  periodToDate,
  recentPeriods,
  rowChange,
  sharePct,
} from "./admin-ai-usage"

function row(overrides: Partial<AiUsageOrgRow> = {}): AiUsageOrgRow {
  return {
    orgId: "org-1",
    orgName: "Acme",
    costNanos: 0,
    callCount: 0,
    totalTokens: 0,
    byKind: {},
    prevCostNanos: 0,
    ...overrides,
  }
}

describe("recentPeriods", () => {
  it("returns 6 months by default, newest first, ending at the reference month", () => {
    const ref = Date.UTC(2026, 7, 12) // August 2026 (0-based month)
    expect(recentPeriods(ref)).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
    ])
  })

  it("crosses a year boundary without touching Date arithmetic", () => {
    const ref = Date.UTC(2026, 1, 1) // February 2026
    expect(recentPeriods(ref, 3)).toEqual(["2026-02", "2026-01", "2025-12"])
  })

  it("honors a custom count", () => {
    const ref = Date.UTC(2026, 0, 1) // January 2026
    expect(recentPeriods(ref, 1)).toEqual(["2026-01"])
  })
})

describe("periodToDate", () => {
  it("parses a period key into the first of that UTC month", () => {
    const date = periodToDate("2026-03")
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(2)
    expect(date.getUTCDate()).toBe(1)
  })
})

describe("nanosToUsd / formatUsdCost", () => {
  it("converts nano-USD to USD", () => {
    expect(nanosToUsd(1_000_000_000)).toBe(1)
    expect(nanosToUsd(500_000_000)).toBe(0.5)
  })

  it("formats to the cent, not the whole dollar", () => {
    expect(formatUsdCost(1_230_000, "en")).toBe("$0.00")
    expect(formatUsdCost(500_000_000, "en")).toBe("$0.50")
    expect(formatUsdCost(1_000_000_000, "en")).toBe("$1.00")
  })

  it("falls back to a plain string for a malformed locale tag", () => {
    expect(formatUsdCost(1_000_000_000, "")).toBe("1.00 USD")
  })
})

describe("formatUsd", () => {
  it("formats a USD amount for the given locale", () => {
    expect(formatUsd(1.5, "en")).toBe("$1.50")
  })

  it("falls back to a plain string for a malformed locale tag", () => {
    expect(formatUsd(1.5, "")).toBe("1.50 USD")
  })
})

describe("computeTotals", () => {
  it("sums every figure across rows and counts orgs with a call this period", () => {
    const rows = [
      row({
        orgId: "a",
        costNanos: 100,
        prevCostNanos: 50,
        callCount: 2,
        totalTokens: 10,
      }),
      row({
        orgId: "b",
        costNanos: 0,
        prevCostNanos: 30,
        callCount: 0,
        totalTokens: 0,
      }),
      row({
        orgId: "c",
        costNanos: 200,
        prevCostNanos: 0,
        callCount: 3,
        totalTokens: 20,
      }),
    ]
    expect(computeTotals(rows)).toEqual({
      costNanos: 300,
      prevCostNanos: 80,
      callCount: 5,
      totalTokens: 30,
      activeOrgCount: 2,
    })
  })

  it("returns all-zero totals for no rows", () => {
    expect(computeTotals([])).toEqual({
      costNanos: 0,
      prevCostNanos: 0,
      callCount: 0,
      totalTokens: 0,
      activeOrgCount: 0,
    })
  })
})

describe("momChangePct", () => {
  it("is null when there is no previous-period baseline", () => {
    expect(
      momChangePct({
        costNanos: 500,
        prevCostNanos: 0,
        callCount: 0,
        totalTokens: 0,
        activeOrgCount: 0,
      })
    ).toBeNull()
  })

  it("computes a signed percent change against the previous total", () => {
    expect(
      momChangePct({
        costNanos: 150,
        prevCostNanos: 100,
        callCount: 0,
        totalTokens: 0,
        activeOrgCount: 0,
      })
    ).toBe(50)
    expect(
      momChangePct({
        costNanos: 50,
        prevCostNanos: 100,
        callCount: 0,
        totalTokens: 0,
        activeOrgCount: 0,
      })
    ).toBe(-50)
  })
})

describe("median", () => {
  it("is 0 for an empty list", () => {
    expect(median([])).toBe(0)
  })

  it("is the single value for a one-item list", () => {
    expect(median([42])).toBe(42)
  })

  it("averages the two middle values for an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it("picks the middle value for an odd-length list, unsorted input", () => {
    expect(median([5, 1, 3])).toBe(3)
  })
})

describe("computeOutlierOrgIds", () => {
  it("flags nothing when there are no orgs", () => {
    expect(computeOutlierOrgIds([])).toEqual(new Set())
  })

  it("never flags a single org against itself", () => {
    const rows = [row({ orgId: "solo", costNanos: 5_000_000_000 })]
    expect(computeOutlierOrgIds(rows)).toEqual(new Set())
  })

  it("flags a clear outlier: far above 3x the median and above the floor", () => {
    const rows = [
      row({ orgId: "a", costNanos: 2_000_000_000 }), // $2
      row({ orgId: "b", costNanos: 2_200_000_000 }), // $2.20
      row({ orgId: "c", costNanos: 20_000_000_000 }), // $20, well over 3x median
    ]
    expect(computeOutlierOrgIds(rows)).toEqual(new Set(["c"]))
  })

  it("flags nothing when every org spends the same amount", () => {
    const rows = [
      row({ orgId: "a", costNanos: 3_000_000_000 }),
      row({ orgId: "b", costNanos: 3_000_000_000 }),
      row({ orgId: "c", costNanos: 3_000_000_000 }),
    ]
    expect(computeOutlierOrgIds(rows)).toEqual(new Set())
  })

  it("never flags spend under the absolute floor even if it dwarfs a tiny median", () => {
    const rows = [
      row({ orgId: "a", costNanos: 1_000_000 }), // $0.001
      row({ orgId: "b", costNanos: 1_000_000 }),
      row({ orgId: "c", costNanos: 900_000_000 }), // $0.90, under the $1 floor
    ]
    expect(computeOutlierOrgIds(rows)).toEqual(new Set())
    expect(OUTLIER_FLOOR_NANOS).toBe(1_000_000_000)
  })

  it("excludes zero-cost rows from the median so they cannot mask a real outlier", () => {
    const rows = [
      row({ orgId: "quiet-1", costNanos: 0, prevCostNanos: 100 }),
      row({ orgId: "quiet-2", costNanos: 0, prevCostNanos: 100 }),
      row({ orgId: "spender", costNanos: 4_000_000_000 }),
    ]
    // Median of spending-only rows ([$4]) is $4; a lone spender is never an
    // outlier of itself, whether or not the zero rows are counted.
    expect(computeOutlierOrgIds(rows)).toEqual(new Set())
  })
})

describe("sharePct", () => {
  it("is the row's percent of the total", () => {
    expect(sharePct(25, 100)).toBe(25)
  })

  it("is 0 when the total is 0", () => {
    expect(sharePct(0, 0)).toBe(0)
  })
})

describe("rowChange", () => {
  it("is 'new' when the org had no cost last period", () => {
    expect(rowChange(row({ costNanos: 500, prevCostNanos: 0 }))).toEqual({
      kind: "new",
    })
  })

  it("is a signed percent otherwise", () => {
    expect(rowChange(row({ costNanos: 150, prevCostNanos: 100 }))).toEqual({
      kind: "pct",
      pct: 50,
    })
    expect(rowChange(row({ costNanos: 0, prevCostNanos: 100 }))).toEqual({
      kind: "pct",
      pct: -100,
    })
  })
})

describe("kindCounts", () => {
  it("sorts by count descending, then kind ascending", () => {
    expect(
      kindCounts({
        "role.profile": 2,
        "model.draft": 5,
        "model.weightReview": 2,
      })
    ).toEqual([
      { kind: "model.draft", count: 5 },
      { kind: "model.weightReview", count: 2 },
      { kind: "role.profile", count: 2 },
    ])
  })

  it("is empty for an empty record", () => {
    expect(kindCounts({})).toEqual([])
  })
})
