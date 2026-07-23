import { describe, expect, it } from "vitest"
import {
  AGE_BUCKETS,
  ageAt,
  ageGenderTallies,
  classifyPayGap,
  type ComparableGroup,
  computeGenderGap,
  equalWorkGroupRequiresDocumentation,
  isWomenDominated,
  quartileGenderTallies,
  womenDominatedComparisons,
  womenDominatedGroupRequiresDocumentation,
} from "./pay-gap"

describe("quartileGenderTallies", () => {
  it("splits ranked comps into four quartiles with per-gender counts", () => {
    // 8 people: the 4 lowest-paid are women, the 4 highest-paid are men.
    const entries = [
      { comp: 10, woman: true },
      { comp: 20, woman: true },
      { comp: 30, woman: true },
      { comp: 40, woman: true },
      { comp: 50, woman: false },
      { comp: 60, woman: false },
      { comp: 70, woman: false },
      { comp: 80, woman: false },
    ]
    expect(quartileGenderTallies(entries)).toEqual([
      { women: 2, men: 0 }, // lower quartile
      { women: 2, men: 0 },
      { women: 0, men: 2 },
      { women: 0, men: 2 }, // upper quartile
    ])
  })

  it("assigns every person exactly once when the count is not divisible by 4", () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      comp: i * 10,
      woman: i % 2 === 0,
    }))
    const tallies = quartileGenderTallies(entries)
    const total = tallies.reduce((sum, t) => sum + t.women + t.men, 0)
    expect(total).toBe(6)
    expect(tallies).toHaveLength(4)
  })

  it("returns zero tallies for an empty population", () => {
    expect(quartileGenderTallies([])).toEqual([
      { women: 0, men: 0 },
      { women: 0, men: 0 },
      { women: 0, men: 0 },
      { women: 0, men: 0 },
    ])
  })
})

describe("ageGenderTallies", () => {
  // 2023-11-14 (a fixed reference instant, never the clock).
  const AS_OF = 1_700_000_000_000

  it("buckets ages at the reference instant, aligned with AGE_BUCKETS", () => {
    const result = ageGenderTallies(
      [
        { birthDate: "1990-01-01", woman: true }, // 33 -> 30-39
        { birthDate: "1990-12-31", woman: false }, // 32 (birthday pending) -> 30-39
        { birthDate: "1955-06-01", woman: false }, // 68 -> 60-69
        { birthDate: "1950-01-01", woman: true }, // 73 -> 70+
      ],
      AS_OF
    )
    expect(AGE_BUCKETS[2]).toBe("30-39")
    expect(result.buckets[2]).toEqual({ women: 1, men: 1 })
    expect(result.buckets[5]).toEqual({ women: 0, men: 1 })
    expect(result.buckets[6]).toEqual({ women: 1, men: 0 })
    expect(result.unknown).toBe(0)
  })

  it("counts missing or unparseable birth dates as unknown", () => {
    const result = ageGenderTallies(
      [
        { birthDate: undefined, woman: true },
        { birthDate: "not-a-date", woman: false },
        { birthDate: "1990-01-01", woman: true },
      ],
      AS_OF
    )
    expect(result.unknown).toBe(2)
    expect(result.buckets[2]).toEqual({ women: 1, men: 0 })
  })
})

describe("classifyPayGap", () => {
  it("is insufficient only when a gender is missing", () => {
    expect(classifyPayGap(0, 5, 0)).toBe("insufficient")
    expect(classifyPayGap(5, 0, 0)).toBe("insufficient")
    // One of each is a real comparison (ADR-0012 amendment): the small-cell
    // minimums apply at the export boundary, not in-app.
    expect(classifyPayGap(1, 1, 3)).toBe("ok")
    expect(classifyPayGap(1, 2, 0)).toBe("ok")
  })

  it("is insufficient when the gap is null", () => {
    expect(classifyPayGap(5, 5, null)).toBe("insufficient")
  })

  it("is critical above 10%", () => {
    expect(classifyPayGap(5, 5, 10.1)).toBe("critical")
    expect(classifyPayGap(5, 5, -10.1)).toBe("critical") // magnitude
    expect(classifyPayGap(1, 3, 12)).toBe("critical") // small mixed group
  })

  it("is elevated from 5% up to and including 10%", () => {
    expect(classifyPayGap(5, 5, 5)).toBe("elevated")
    expect(classifyPayGap(5, 5, 10)).toBe("elevated")
    expect(classifyPayGap(5, 5, -7)).toBe("elevated")
  })

  it("is ok below 5%", () => {
    expect(classifyPayGap(5, 5, 4.9)).toBe("ok")
    expect(classifyPayGap(5, 5, 0)).toBe("ok")
    expect(classifyPayGap(5, 5, -4.9)).toBe("ok")
  })
})

describe("computeGenderGap", () => {
  it("computes means and a signed gap (positive = women earn less)", () => {
    const result = computeGenderGap([90, 90], [100, 100])
    expect(result.womenCount).toBe(2)
    expect(result.menCount).toBe(2)
    expect(result.womenMeanComp).toBe(90)
    expect(result.menMeanComp).toBe(100)
    expect(result.gapPct).toBeCloseTo(10, 5)
    expect(result.flag).toBe("elevated")
  })

  it("produces a negative gap when women earn more", () => {
    const result = computeGenderGap([110, 110], [100, 100])
    expect(result.gapPct).toBeCloseTo(-10, 5)
    expect(result.flag).toBe("elevated") // flagged by magnitude
  })

  it("returns null means for an empty gender and is insufficient", () => {
    const result = computeGenderGap([], [100, 100, 100, 100])
    expect(result.womenMeanComp).toBeNull()
    expect(result.menMeanComp).toBe(100)
    expect(result.gapPct).toBeNull()
    expect(result.flag).toBe("insufficient")
  })

  it("returns a null gap when the men mean is zero (no divide by zero)", () => {
    const result = computeGenderGap([0, 0], [0, 0])
    expect(result.menMeanComp).toBe(0)
    expect(result.gapPct).toBeNull()
    expect(result.flag).toBe("insufficient") // gapPct null
  })

  it("computes an unmasked gap whenever both genders are present (ADR-0012 amendment)", () => {
    // In-app there is no size floor: 1 woman + 1 man is a real comparison.
    // The small-cell minimums (4 total, 2 per gender) apply at the export
    // boundary instead (see docs/go-live-checklist.md).
    const result = computeGenderGap([90000], [100000])
    expect(result.womenCount).toBe(1)
    expect(result.menCount).toBe(1)
    expect(result.womenMeanComp).toBe(90000)
    expect(result.gapPct).toBeCloseTo(10, 5)
    expect(result.flag).toBe("elevated")
  })
})

describe("isWomenDominated", () => {
  it("uses the 60 % DO-praxis threshold inclusively", () => {
    expect(isWomenDominated(3, 2)).toBe(true) // 60 % exactly
    expect(isWomenDominated(59, 41)).toBe(false) // 59 %
    expect(isWomenDominated(0, 0)).toBe(false) // empty is never dominated
    expect(isWomenDominated(2, 0)).toBe(true)
  })
})

function comparable(overrides: Partial<ComparableGroup>): ComparableGroup {
  return {
    key: "k",
    roleTitle: "SWE",
    level: "Mid",
    band: 3,
    womenCount: 1,
    menCount: 3,
    meanComp: 40000,
    ...overrides,
  }
}

describe("womenDominatedComparisons", () => {
  const womenDominated = comparable({
    key: "wd",
    roleTitle: "Marketing",
    level: "Mid",
    band: 3,
    womenCount: 3,
    menCount: 1,
    meanComp: 38000,
  })

  it("compares against non-dominated groups in the same or lower-valued band that earn more", () => {
    const sameBandHigher = comparable({ key: "a", band: 3, meanComp: 42000 })
    const lowerValueHigher = comparable({ key: "b", band: 5, meanComp: 45000 }) // band 5 < band 3 in value
    const higherValueBand = comparable({ key: "c", band: 1, meanComp: 60000 }) // band 1 is HIGHER value: excluded
    const sameBandLowerPaid = comparable({ key: "d", band: 3, meanComp: 30000 }) // earns less: excluded
    // Also women-dominated, so it is excluded as a comparator for "wd" even
    // though its band and pay would otherwise qualify it; it still surfaces
    // as its own entry (banded + dominated), same as the solitary-group and
    // ordering tests below, with zero comparisons of its own.
    const alsoDominated = comparable({
      key: "e",
      band: 3,
      womenCount: 4,
      menCount: 0,
      meanComp: 50000,
    })
    const result = womenDominatedComparisons([
      womenDominated,
      sameBandHigher,
      lowerValueHigher,
      higherValueBand,
      sameBandLowerPaid,
      alsoDominated,
    ])
    expect(result).toHaveLength(2)
    const group = result[0]
    expect(group?.key).toBe("wd")
    expect(group?.womenSharePct).toBeCloseTo(75, 5)
    expect(group?.comparisons.map((c) => c.key)).toEqual(["a", "b"]) // band asc (higher value first)
    expect(group?.comparisons[0]?.diffSek).toBe(4000)
    expect(group?.comparisons[0]?.diffPct).toBeCloseTo((4000 / 38000) * 100, 5)
    expect(result[1]?.key).toBe("e") // fewer comparisons (0) sorts after "wd"
    expect(result[1]?.comparisons).toEqual([])
  })

  it("keeps a dominated group with no comparisons (documentable, not gate-required)", () => {
    const result = womenDominatedComparisons([womenDominated])
    expect(result).toHaveLength(1)
    expect(result[0]?.comparisons).toEqual([])
  })

  it("skips unbanded groups entirely and orders output by comparison count desc, then band", () => {
    const unbanded = comparable({
      key: "u",
      band: null,
      womenCount: 5,
      menCount: 0,
    })
    const rival = comparable({ key: "r", band: 3, meanComp: 50000 })
    const second = comparable({
      key: "wd2",
      band: 4,
      womenCount: 4,
      menCount: 1,
      meanComp: 39000,
    })
    const result = womenDominatedComparisons([
      womenDominated,
      second,
      unbanded,
      rival,
    ])
    // wd (band 3) compares to r; wd2 (band 4) compares to nothing in a same-or-lower band that earns more... r is band 3 = HIGHER value than band 4, so excluded for wd2.
    expect(result.map((g) => g.key)).toEqual(["wd", "wd2"])
    expect(result[1]?.comparisons).toEqual([])
  })

  it("null-guards diffPct when the dominated mean is 0", () => {
    const zero = comparable({
      key: "z",
      band: 3,
      womenCount: 2,
      menCount: 0,
      meanComp: 0,
    })
    const rival = comparable({ key: "r", band: 3, meanComp: 1000 })
    const result = womenDominatedComparisons([zero, rival])
    expect(result[0]?.comparisons[0]?.diffPct).toBeNull()
    expect(result[0]?.comparisons[0]?.diffSek).toBe(1000)
  })
})

describe("documentation predicates", () => {
  it("equal-work groups require documentation unless ok", () => {
    expect(equalWorkGroupRequiresDocumentation("critical")).toBe(true)
    expect(equalWorkGroupRequiresDocumentation("elevated")).toBe(true)
    expect(equalWorkGroupRequiresDocumentation("insufficient")).toBe(true)
    expect(equalWorkGroupRequiresDocumentation("ok")).toBe(false)
  })
  it("women-dominated groups require documentation when compared", () => {
    expect(womenDominatedGroupRequiresDocumentation(0)).toBe(false)
    expect(womenDominatedGroupRequiresDocumentation(2)).toBe(true)
  })
})

describe("ageAt (exported for the scatter's age and tenure axes)", () => {
  it("counts whole years at the reference instant", () => {
    expect(ageAt("1990-07-01", Date.UTC(2026, 6, 1))).toBe(36)
    expect(ageAt("1990-07-02", Date.UTC(2026, 6, 1))).toBe(35)
    expect(ageAt("not-a-date", Date.UTC(2026, 6, 1))).toBeNull()
    expect(ageAt("2030-01-01", Date.UTC(2026, 6, 1))).toBeNull()
  })
})
