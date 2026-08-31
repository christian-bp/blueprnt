import { describe, expect, it } from "vitest"
import {
  classifyEqualWorkGroup,
  compareMetric,
  diffVsMenMean,
  flagWomenBehind,
  genderStats,
  percentileOf,
} from "./pay-analysis"

describe("genderStats", () => {
  it("returns null for an empty list (no statistics, not zeroes)", () => {
    expect(genderStats([])).toBeNull()
  })

  it("computes count/min/max/mean/median/stdDev on an odd-count list", () => {
    // Hand-computed: mean 30000, median 30000, population variance
    // ((-10000)^2 + 0 + 10000^2) / 3.
    const stats = genderStats([30000, 20000, 40000])
    expect(stats).toEqual({
      count: 3,
      min: 20000,
      max: 40000,
      mean: 30000,
      median: 30000,
      stdDev: Math.sqrt(200_000_000 / 3),
    })
  })

  it("averages the middle two values for an even-count median", () => {
    const stats = genderStats([10, 20, 30, 100])
    expect(stats?.median).toBe(25)
    expect(stats?.mean).toBe(40)
  })

  it("handles a single value (spread 0, all positions equal)", () => {
    const stats = genderStats([42000])
    expect(stats).toEqual({
      count: 1,
      min: 42000,
      max: 42000,
      mean: 42000,
      median: 42000,
      stdDev: 0,
    })
  })

  it("never mutates its input", () => {
    const values = [3, 1, 2]
    genderStats(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe("compareMetric", () => {
  it("computes signed gap in % and kr (positive = women behind)", () => {
    const result = compareMetric([90000, 90000], [100000, 100000])
    expect(result.womenMean).toBe(90000)
    expect(result.menMean).toBe(100000)
    expect(result.gapPct).toBeCloseTo(10, 5)
    expect(result.gapKr).toBe(10000)
  })

  it("nulls the means and gap for a missing gender", () => {
    const result = compareMetric([], [100000])
    expect(result.womenMean).toBeNull()
    expect(result.menMean).toBe(100000)
    expect(result.gapPct).toBeNull()
    expect(result.gapKr).toBeNull()
  })

  it("nulls the pct (undefined ratio) but keeps kr when the men mean is 0", () => {
    const result = compareMetric([1000], [0])
    expect(result.gapPct).toBeNull()
    expect(result.gapKr).toBe(-1000)
  })
})

describe("flagWomenBehind", () => {
  it("is insufficient when a gender is missing", () => {
    expect(flagWomenBehind(0, 3, null)).toBe("insufficient")
    expect(flagWomenBehind(3, 0, null)).toBe("insufficient")
  })

  it("reads ok for a zero or reversed gap (direction rule)", () => {
    expect(flagWomenBehind(2, 2, 0)).toBe("ok")
    expect(flagWomenBehind(2, 2, -12)).toBe("ok")
  })

  it("keeps the ADR-0012 thresholds for a women-behind gap", () => {
    expect(flagWomenBehind(2, 2, 4.9)).toBe("ok")
    expect(flagWomenBehind(2, 2, 5)).toBe("elevated")
    expect(flagWomenBehind(2, 2, 10)).toBe("elevated")
    expect(flagWomenBehind(2, 2, 10.1)).toBe("critical")
  })
})

describe("classifyEqualWorkGroup", () => {
  const group = (input: {
    womenBase: number[]
    menBase: number[]
    womenTcc?: number[]
    menTcc?: number[]
  }) =>
    classifyEqualWorkGroup({
      womenBase: input.womenBase,
      menBase: input.menBase,
      womenTcc: input.womenTcc ?? input.womenBase,
      menTcc: input.menTcc ?? input.menBase,
    })

  it("drops a 1-person group as singleton", () => {
    const result = group({ womenBase: [50000], menBase: [] })
    expect(result.outcome).toBe("singleton")
    expect(result.flag).toBe("insufficient")
  })

  it("routes a 2+ single-gender group to genderPure", () => {
    const women = group({ womenBase: [50000, 52000], menBase: [] })
    expect(women.outcome).toBe("genderPure")
    expect(women.flag).toBe("insufficient")
    const men = group({ womenBase: [], menBase: [50000, 52000] })
    expect(men.outcome).toBe("genderPure")
  })

  it("shows a group where the women trail on base salary", () => {
    const result = group({ womenBase: [90000], menBase: [100000] })
    expect(result.outcome).toBe("shown")
    expect(result.tccDriven).toBe(false)
    expect(result.base.gapPct).toBeCloseTo(10, 5)
    expect(result.flag).toBe("elevated")
  })

  it("hides a group where the women lead on both metrics as reverse", () => {
    const result = group({ womenBase: [110000], menBase: [100000] })
    expect(result.outcome).toBe("reverse")
    // The direction rule: a reversed gap is not a finding.
    expect(result.flag).toBe("ok")
  })

  it("admits a bonus-driven gap as tccDriven (base equal, tcc behind)", () => {
    const result = group({
      womenBase: [50000],
      menBase: [50000],
      womenTcc: [50000],
      menTcc: [60000],
    })
    expect(result.outcome).toBe("shown")
    expect(result.tccDriven).toBe(true)
    expect(result.base.gapPct).toBeCloseTo(0, 5)
    expect(result.tcc.gapPct).toBeCloseTo(16.666, 2)
    // The flag comes from the severest metric: the 16.7% tcc gap.
    expect(result.flag).toBe("critical")
  })

  it("flags on the severest metric even when base admits the group", () => {
    const result = group({
      womenBase: [96000],
      menBase: [100000],
      womenTcc: [96000],
      menTcc: [120000],
    })
    expect(result.outcome).toBe("shown")
    expect(result.tccDriven).toBe(false)
    // base gap 4% would be ok; the 20% tcc gap carries the flag.
    expect(result.flag).toBe("critical")
  })

  it("treats a base-behind, tcc-ahead group as shown on the base gap", () => {
    const result = group({
      womenBase: [90000],
      menBase: [100000],
      womenTcc: [130000],
      menTcc: [110000],
    })
    expect(result.outcome).toBe("shown")
    expect(result.tccDriven).toBe(false)
    expect(result.flag).toBe("elevated")
  })

  // Guards the documentation gate: `shown` requires a positive gap on at
  // least one metric, whose directional flag is then never `insufficient`,
  // so a shown group can never slip past the `flag !== "ok"` gate through a
  // masked metric.
  it("never classifies a shown group as insufficient", () => {
    const gaps = [
      { womenBase: [90000], menBase: [100000] },
      {
        womenBase: [50000],
        menBase: [50000],
        womenTcc: [50000],
        menTcc: [60000],
      },
    ]
    for (const input of gaps) {
      const result = group(input)
      expect(result.outcome).toBe("shown")
      expect(result.flag).not.toBe("insufficient")
    }
  })

  it("keeps the severest real flag when the other metric's gap is undefined", () => {
    // A zero men TCC mean nulls that metric's gapPct (undefined ratio), so
    // its flag is insufficient; the combined flag must stay the base
    // metric's critical, never degrade to insufficient.
    const result = group({
      womenBase: [80000],
      menBase: [100000],
      womenTcc: [0],
      menTcc: [0],
    })
    expect(result.outcome).toBe("shown")
    expect(result.tcc.gapPct).toBeNull()
    expect(result.flag).toBe("critical")
  })
})

describe("diffVsMenMean", () => {
  it("returns signed kr and pct against the men's mean", () => {
    expect(diffVsMenMean(45000, 50000)).toEqual({ kr: -5000, pct: -10 })
    expect(diffVsMenMean(55000, 50000)).toEqual({ kr: 5000, pct: 10 })
  })

  it("nulls the pct when the men mean is 0", () => {
    expect(diffVsMenMean(1000, 0)).toEqual({ kr: 1000, pct: null })
  })
})

describe("percentileOf", () => {
  it("interpolates linearly between ranks", () => {
    const values = [10, 20, 30, 40, 50]
    expect(percentileOf(values, 0)).toBe(10)
    expect(percentileOf(values, 50)).toBe(30)
    expect(percentileOf(values, 100)).toBe(50)
    expect(percentileOf(values, 25)).toBe(20)
    // P10 of five values: rank 0.4 => 10 + 0.4 * (20 - 10).
    expect(percentileOf(values, 10)).toBe(14)
    expect(percentileOf(values, 90)).toBe(46)
  })

  it("matches the median convention for even counts", () => {
    expect(percentileOf([10, 20, 30, 40], 50)).toBe(25)
  })

  it("handles empty and single-value lists", () => {
    expect(percentileOf([], 50)).toBeNull()
    expect(percentileOf([42], 10)).toBe(42)
  })

  it("is order-independent", () => {
    expect(percentileOf([50, 10, 40, 20, 30], 90)).toBe(46)
  })
})
