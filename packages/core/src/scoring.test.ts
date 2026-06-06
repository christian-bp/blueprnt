import { describe, expect, it } from "vitest"
import { assignBand, computeResults, scoreRole } from "./scoring"
import {
  STANDARD_CRITERIA,
  STANDARD_THRESHOLDS,
  allRated,
} from "./scoring.fixtures"
import type { CriterionWeight, RatingInput, RoleRatings } from "./types"

describe("scoreRole", () => {
  it("scores the standardmall all-5 anchor at 540", () => {
    expect(scoreRole(allRated(5), STANDARD_CRITERIA)).toBe(540)
  })

  it("scores all-0 at 0", () => {
    expect(scoreRole(allRated(0), STANDARD_CRITERIA)).toBe(0)
  })

  it("changes by exactly rating * weight delta when importance changes", () => {
    // scope importance 7 -> 6 is weight 18 -> 14; with rating 4 the score
    // must drop by exactly 16.
    const ratings: RatingInput[] = [{ criterionId: "scope", value: 4 }]
    const at7 = scoreRole(ratings, STANDARD_CRITERIA)
    const adjusted = STANDARD_CRITERIA.map((criterion) =>
      criterion.criterionId === "scope"
        ? { ...criterion, importanceLevel: 6 as const }
        : criterion
    )
    const at6 = scoreRole(ratings, adjusted)
    expect(at7 - at6).toBe(16)
  })

  it("ignores ratings for criteria not in the model", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 5 },
      { criterionId: "ghost", value: 5 },
    ]
    expect(scoreRole(ratings, STANDARD_CRITERIA)).toBe(90)
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
      { criterionId: "scope", importanceLevel: 7 },
      { criterionId: "scope", importanceLevel: 1 },
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
})

describe("assignBand", () => {
  it("maps the standardmall anchors with inclusive lower bounds", () => {
    expect(assignBand(540, STANDARD_THRESHOLDS)).toBe(1)
    expect(assignBand(530, STANDARD_THRESHOLDS)).toBe(1)
    expect(assignBand(529, STANDARD_THRESHOLDS)).toBe(2)
    expect(assignBand(450, STANDARD_THRESHOLDS)).toBe(2)
    expect(assignBand(449, STANDARD_THRESHOLDS)).toBe(3)
    expect(assignBand(0, STANDARD_THRESHOLDS)).toBe(7)
  })

  it("breaks minScore ties toward the lowest band number (highest band)", () => {
    const thresholds = [
      { band: 2, minScore: 100 },
      { band: 1, minScore: 100 },
      { band: 3, minScore: 0 },
    ]
    expect(assignBand(150, thresholds)).toBe(1)
  })

  it("throws on an empty threshold list", () => {
    expect(() => assignBand(10, [])).toThrow(/no band thresholds/)
  })

  it("throws when no threshold matches (missing floor)", () => {
    expect(() => assignBand(10, [{ band: 1, minScore: 100 }])).toThrow(
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
        score: 540,
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
