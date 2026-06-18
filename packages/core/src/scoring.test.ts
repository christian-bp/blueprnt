import { describe, expect, it } from "vitest"
import {
  assignBand,
  computeResults,
  criterionShares,
  scoreRole,
} from "./scoring"
import {
  STANDARD_CRITERIA,
  STANDARD_THRESHOLDS,
  allRated,
} from "./scoring.fixtures"
import type { CriterionWeight, RatingInput, RoleRatings } from "./types"
import type { WeightPoints } from "./weighting"

describe("scoreRole", () => {
  it("scores uniform ratings at exactly 20 x rating, regardless of allocation", () => {
    // raw = r * sum(points), so the normalization cancels the allocation.
    expect(scoreRole(allRated(5), STANDARD_CRITERIA)).toBe(100)
    expect(scoreRole(allRated(4), STANDARD_CRITERIA)).toBe(80)
    expect(scoreRole(allRated(3), STANDARD_CRITERIA)).toBe(60)
    expect(scoreRole(allRated(0), STANDARD_CRITERIA)).toBe(0)
  })

  it("scores a mixed standardmall role to the hand-computed golden", () => {
    // raw = 4*5 + 3*4 + 3*4 + 3*3 + 2*3 + 2*3 + 1*2 + 1*2 + 0*1 = 69
    // 20 * 69 / 27 = 51.11 -> floored to 51.
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 4 },
      { criterionId: "complexity", value: 3 },
      { criterionId: "autonomy", value: 3 },
      { criterionId: "risk", value: 3 },
      { criterionId: "knowledge", value: 2 },
      { criterionId: "stakeholders", value: 2 },
      { criterionId: "financial", value: 1 },
      { criterionId: "people", value: 1 },
      { criterionId: "formal", value: 0 },
    ]
    expect(scoreRole(ratings, STANDARD_CRITERIA)).toBe(51)
  })

  it("floors the normalized score (never rounds up past a threshold)", () => {
    // Three criteria at 4/3/2 (balanced, sum 9): raw 34 -> 75.55 -> 75,
    // raw 33 -> 73.33 -> 73. The floor keeps integer-threshold comparison
    // exact on both sides of 74.
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 4 },
      { criterionId: "b", weightPoints: 3 },
      { criterionId: "c", weightPoints: 2 },
    ]
    expect(
      scoreRole(
        [
          { criterionId: "a", value: 5 },
          { criterionId: "b", value: 4 },
          { criterionId: "c", value: 1 },
        ],
        criteria
      )
    ).toBe(75)
    expect(
      scoreRole(
        [
          { criterionId: "a", value: 4 },
          { criterionId: "b", value: 5 },
          { criterionId: "c", value: 1 },
        ],
        criteria
      )
    ).toBe(73)
  })

  it("uniform point inflation does not change the score (normalization)", () => {
    const ratings: RatingInput[] = [
      { criterionId: "a", value: 4 },
      { criterionId: "b", value: 2 },
      { criterionId: "c", value: 1 },
    ]
    const allThrees: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
      { criterionId: "c", weightPoints: 3 },
    ]
    const allFives: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 5 },
      { criterionId: "b", weightPoints: 5 },
      { criterionId: "c", weightPoints: 5 },
    ]
    expect(scoreRole(ratings, allThrees)).toBe(scoreRole(ratings, allFives))
  })

  it("ignores ratings for criteria not in the model", () => {
    const only: RatingInput[] = [{ criterionId: "scope", value: 5 }]
    const withGhost: RatingInput[] = [
      { criterionId: "scope", value: 5 },
      { criterionId: "ghost", value: 5 },
    ]
    // raw = 25, total points 27: 20 * 25 / 27 = 18.51 -> 18.
    expect(scoreRole(only, STANDARD_CRITERIA)).toBe(18)
    expect(scoreRole(withGhost, STANDARD_CRITERIA)).toBe(18)
  })

  it("throws on a duplicate rating for the same criterion", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 2 },
      { criterionId: "scope", value: 3 },
    ]
    expect(() => scoreRole(ratings, STANDARD_CRITERIA)).toThrow(/duplicate/)
  })

  it("throws on a duplicate criterion in the model", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "scope", weightPoints: 5 },
      { criterionId: "scope", weightPoints: 1 },
    ]
    expect(() => scoreRole([], criteria)).toThrow(/duplicate/)
  })

  it("throws when a rating value is outside 0-5", () => {
    const bad = [{ criterionId: "scope", value: 6 }] as unknown as RatingInput[]
    expect(() => scoreRole(bad, STANDARD_CRITERIA)).toThrow(/out of range/)
    const negative = [
      { criterionId: "scope", value: -1 },
    ] as unknown as RatingInput[]
    expect(() => scoreRole(negative, STANDARD_CRITERIA)).toThrow(/out of range/)
  })

  it("throws on weight points outside the 1-5 scale", () => {
    const criteria = [
      { criterionId: "scope", weightPoints: 7 },
    ] as unknown as CriterionWeight[]
    expect(() => scoreRole([], criteria)).toThrow(/invalid weight points/)
  })

  it("throws on an empty criteria list", () => {
    expect(() => scoreRole([], [])).toThrow(/no criteria/)
  })
})

describe("assignBand", () => {
  it("maps the 0-100 default thresholds with inclusive lower bounds", () => {
    expect(assignBand(100, STANDARD_THRESHOLDS)).toBe(1)
    expect(assignBand(98, STANDARD_THRESHOLDS)).toBe(1)
    expect(assignBand(97, STANDARD_THRESHOLDS)).toBe(2)
    expect(assignBand(83, STANDARD_THRESHOLDS)).toBe(2)
    expect(assignBand(82, STANDARD_THRESHOLDS)).toBe(3)
    expect(assignBand(0, STANDARD_THRESHOLDS)).toBe(7)
  })

  it("breaks minScore ties toward the lowest band number (highest band)", () => {
    const thresholds = [
      { band: 2, minScore: 50 },
      { band: 1, minScore: 50 },
      { band: 3, minScore: 0 },
    ]
    expect(assignBand(75, thresholds)).toBe(1)
  })

  it("throws on an empty threshold list", () => {
    expect(() => assignBand(10, [])).toThrow(/no band thresholds/)
  })

  it("throws when no threshold matches (missing floor)", () => {
    expect(() => assignBand(10, [{ band: 1, minScore: 50 }])).toThrow(
      /no band threshold matches/
    )
  })

  it("throws on a negative or non-finite score", () => {
    expect(() => assignBand(-1, STANDARD_THRESHOLDS)).toThrow(/invalid score/)
    expect(() =>
      assignBand(Number.POSITIVE_INFINITY, STANDARD_THRESHOLDS)
    ).toThrow(/invalid score/)
  })
})

describe("computeResults", () => {
  it("derives score and band only for fully rated roles", () => {
    const roles: RoleRatings[] = [
      { roleId: "r-full", ratings: allRated(5) },
      { roleId: "r-partial", ratings: allRated(5).slice(0, 4) },
      { roleId: "r-none", ratings: [] },
    ]
    const results = computeResults({
      criteria: STANDARD_CRITERIA,
      thresholds: STANDARD_THRESHOLDS,
      roles,
    })
    expect(results).toEqual([
      {
        roleId: "r-full",
        ratedCount: 9,
        totalCriteria: 9,
        complete: true,
        score: 100,
        band: 1,
      },
      {
        roleId: "r-partial",
        ratedCount: 4,
        totalCriteria: 9,
        complete: false,
        score: null,
        band: null,
      },
      {
        roleId: "r-none",
        ratedCount: 0,
        totalCriteria: 9,
        complete: false,
        score: null,
        band: null,
      },
    ])
  })

  it("never treats a zero-criteria model as complete", () => {
    const results = computeResults({
      criteria: [],
      thresholds: STANDARD_THRESHOLDS,
      roles: [{ roleId: "r1", ratings: [] }],
    })
    expect(results[0]).toEqual({
      roleId: "r1",
      ratedCount: 0,
      totalCriteria: 0,
      complete: false,
      score: null,
      band: null,
    })
  })

  it("does not count orphan ratings toward completeness", () => {
    const ratings = [
      ...allRated(5).slice(0, 8),
      { criterionId: "ghost", value: 5 as const },
    ]
    const results = computeResults({
      criteria: STANDARD_CRITERIA,
      thresholds: STANDARD_THRESHOLDS,
      roles: [{ roleId: "r1", ratings }],
    })
    expect(results[0]?.ratedCount).toBe(8)
    expect(results[0]?.complete).toBe(false)
  })

  it("does not let a duplicate rating inflate completeness", () => {
    // 8 distinct criteria plus a duplicate of one of them: raw length is 9
    // (equal to totalCriteria) but distinct coverage is only 8.
    const ratings = [
      ...allRated(3).slice(0, 8),
      { criterionId: "scope", value: 3 as const },
    ]
    const results = computeResults({
      criteria: STANDARD_CRITERIA,
      thresholds: STANDARD_THRESHOLDS,
      roles: [{ roleId: "r1", ratings }],
    })
    expect(results[0]).toMatchObject({
      ratedCount: 8,
      complete: false,
      score: null,
      band: null,
    })
  })
})

describe("criterionShares", () => {
  it("splits an all-equal rating purely by weight points", () => {
    // every value 3 => contribution_i = 3 * w_i => share_i = w_i / sum(w).
    const shares = criterionShares(allRated(3), STANDARD_CRITERIA)
    const byId = new Map(shares.map((s) => [s.criterionId, s]))
    expect(byId.get("scope")?.share).toBeCloseTo(5 / 27, 10)
    expect(byId.get("formal")?.share).toBeCloseTo(1 / 27, 10)
    const total = shares.reduce((sum, s) => sum + s.share, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it("returns one entry per criterion, in input order", () => {
    const shares = criterionShares(allRated(4), STANDARD_CRITERIA)
    expect(shares.map((s) => s.criterionId)).toEqual(
      STANDARD_CRITERIA.map((c) => c.criterionId)
    )
  })

  it("gives a higher share to a higher value * weight", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 2 },
      { criterionId: "b", weightPoints: 4 },
    ]
    const ratings: RatingInput[] = [
      { criterionId: "a", value: 5 }, // contribution 10
      { criterionId: "b", value: 5 }, // contribution 20
    ]
    const byId = new Map(
      criterionShares(ratings, criteria).map((s) => [s.criterionId, s])
    )
    expect(byId.get("a")?.share).toBeCloseTo(10 / 30, 10)
    expect(byId.get("b")?.share).toBeCloseTo(20 / 30, 10)
  })

  it("gives equal shares to equal contributions", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
    ]
    const shares = criterionShares(
      [
        { criterionId: "a", value: 4 },
        { criterionId: "b", value: 4 },
      ],
      criteria
    )
    expect(shares[0]?.share).toBeCloseTo(0.5, 10)
    expect(shares[1]?.share).toBeCloseTo(0.5, 10)
  })

  it("zeroes a zero rating's share and leaves the rest summing to 1", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
      { criterionId: "c", weightPoints: 3 },
    ]
    const byId = new Map(
      criterionShares(
        [
          { criterionId: "a", value: 0 },
          { criterionId: "b", value: 4 },
          { criterionId: "c", value: 4 },
        ],
        criteria
      ).map((s) => [s.criterionId, s])
    )
    expect(byId.get("a")?.share).toBe(0)
    expect(byId.get("b")?.share).toBeCloseTo(0.5, 10)
    expect(byId.get("c")?.share).toBeCloseTo(0.5, 10)
  })

  it("returns all-zero shares (no division by zero) when every rating is 0", () => {
    const shares = criterionShares(allRated(0), STANDARD_CRITERIA)
    expect(shares.every((s) => s.share === 0)).toBe(true)
    expect(shares.every((s) => s.contribution === 0)).toBe(true)
  })

  it("treats a criterion with no rating as a zero contribution", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
    ]
    const byId = new Map(
      criterionShares([{ criterionId: "a", value: 4 }], criteria).map((s) => [
        s.criterionId,
        s,
      ])
    )
    expect(byId.get("a")?.share).toBe(1)
    expect(byId.get("b")?.share).toBe(0)
  })

  it("throws on weight points outside the 1-5 scale", () => {
    expect(() =>
      criterionShares(
        [{ criterionId: "a", value: 3 }],
        [{ criterionId: "a", weightPoints: 0 as WeightPoints }]
      )
    ).toThrow(/invalid weight points/)
  })

  it("gives a single rated criterion a 100% share", () => {
    const byId = new Map(
      criterionShares(
        [{ criterionId: "a", value: 4 }],
        [{ criterionId: "a", weightPoints: 3 }]
      ).map((s) => [s.criterionId, s])
    )
    expect(byId.get("a")?.contribution).toBe(12)
    expect(byId.get("a")?.share).toBe(1)
  })

  it("keeps the last value on a duplicated rating (display leniency)", () => {
    const shares = criterionShares(
      [
        { criterionId: "a", value: 1 },
        { criterionId: "a", value: 5 },
      ],
      [{ criterionId: "a", weightPoints: 3 }]
    )
    expect(shares).toHaveLength(1)
    expect(shares[0]?.contribution).toBe(15)
    expect(shares[0]?.share).toBe(1)
  })
})
