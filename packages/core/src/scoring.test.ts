import { describe, expect, it } from "vitest"
import { assignLevel, criterionShares, scoreRole } from "./scoring"
import {
  FIXTURE_CRITERIA,
  FIXTURE_THRESHOLDS,
  allRated,
} from "./scoring.fixtures"
import type { CriterionWeight, RatingInput } from "./types"
import type { WeightPoints } from "./weighting"
import { DEFAULT_LEVEL_RULES, LEVEL_COUNT, SCORE_SCALE_MAX } from "./zones"

describe("scoreRole", () => {
  it("scores uniform ratings at exactly 20 x rating, regardless of allocation", () => {
    // raw = r * sum(points), so the normalization cancels the allocation.
    // 1 is the floor for FIXTURE_CRITERIA (none of it is workingConditions);
    // the WC-only 0 floor is covered by its own tests below.
    expect(scoreRole(allRated(5), FIXTURE_CRITERIA)).toBe(100)
    expect(scoreRole(allRated(4), FIXTURE_CRITERIA)).toBe(80)
    expect(scoreRole(allRated(3), FIXTURE_CRITERIA)).toBe(60)
    expect(scoreRole(allRated(1), FIXTURE_CRITERIA)).toBe(20)
  })

  it("scores a mixed standardmall role to the hand-computed golden", () => {
    // raw = 4*5 + 3*4 + 3*4 + 3*3 + 2*3 + 2*3 + 1*2 + 1*2 + 1*1 = 70
    // 20 * 70 / 27 = 51.85 -> floored to 51.
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 4 },
      { criterionId: "complexity", value: 3 },
      { criterionId: "autonomy", value: 3 },
      { criterionId: "risk", value: 3 },
      { criterionId: "knowledge", value: 2 },
      { criterionId: "stakeholders", value: 2 },
      { criterionId: "financial", value: 1 },
      { criterionId: "people", value: 1 },
      { criterionId: "formal", value: 1 },
    ]
    expect(scoreRole(ratings, FIXTURE_CRITERIA)).toBe(51)
  })

  it("floors the normalized score (never rounds up past a threshold)", () => {
    // Three criteria at 4/3/2 (balanced, sum 9): raw 34 -> 75.55 -> 75,
    // raw 33 -> 73.33 -> 73. The floor keeps integer-threshold comparison
    // exact on both sides of 74.
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "responsibility", weightPoints: 4 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
      { criterionId: "c", dimensionKey: "competence", weightPoints: 2 },
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
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
      { criterionId: "c", dimensionKey: "responsibility", weightPoints: 3 },
    ]
    const allFives: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "competence", weightPoints: 5 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 5 },
      { criterionId: "c", dimensionKey: "responsibility", weightPoints: 5 },
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
    expect(scoreRole(only, FIXTURE_CRITERIA)).toBe(18)
    expect(scoreRole(withGhost, FIXTURE_CRITERIA)).toBe(18)
  })

  it("throws on a duplicate rating for the same criterion", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 2 },
      { criterionId: "scope", value: 3 },
    ]
    expect(() => scoreRole(ratings, FIXTURE_CRITERIA)).toThrow(/duplicate/)
  })

  it("throws on a duplicate criterion in the model", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 5 },
      { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 1 },
    ]
    expect(() => scoreRole([], criteria)).toThrow(/duplicate/)
  })

  it("throws when a rating value is outside 0-5", () => {
    const bad = [{ criterionId: "scope", value: 6 }] as unknown as RatingInput[]
    expect(() => scoreRole(bad, FIXTURE_CRITERIA)).toThrow(/out of range/)
    const negative = [
      { criterionId: "scope", value: -1 },
    ] as unknown as RatingInput[]
    expect(() => scoreRole(negative, FIXTURE_CRITERIA)).toThrow(/out of range/)
  })

  it("throws on a 0 rating for a non-working-conditions criterion", () => {
    // "scope" is dimensionKey responsibility in FIXTURE_CRITERIA: 0 is only
    // ever valid for a workingConditions criterion.
    const ratings: RatingInput[] = [{ criterionId: "scope", value: 0 }]
    expect(() => scoreRole(ratings, FIXTURE_CRITERIA)).toThrow(/out of range/)
  })

  it("scores a working-conditions 0 as a real zero contribution, not a rejection", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "wc", dimensionKey: "workingConditions", weightPoints: 3 },
      { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
    ]
    const ratings: RatingInput[] = [
      { criterionId: "wc", value: 0 },
      { criterionId: "knowledge", value: 4 },
    ]
    // raw = 0*3 + 4*3 = 12; totalPoints 6; score = floor(20*12/6) = 40.
    expect(scoreRole(ratings, criteria)).toBe(40)
  })

  it("skips validation for an orphaned rating (unknown criterion id)", () => {
    // "ghost" carries no criterion, hence no dimension to validate against;
    // an out-of-range value on it must be ignored, not thrown, matching the
    // existing orphan-tolerant scoring below it.
    const ratings: RatingInput[] = [
      { criterionId: "ghost", value: 0 },
    ] as unknown as RatingInput[]
    expect(scoreRole(ratings, FIXTURE_CRITERIA)).toBe(0)
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

describe("assignLevel", () => {
  it("reads a minScore as the inclusive lower bound of its level", () => {
    expect(assignLevel(100, FIXTURE_THRESHOLDS)).toBe(1)
    expect(assignLevel(98, FIXTURE_THRESHOLDS)).toBe(1)
    expect(assignLevel(97, FIXTURE_THRESHOLDS)).toBe(2)
    expect(assignLevel(83, FIXTURE_THRESHOLDS)).toBe(2)
    expect(assignLevel(82, FIXTURE_THRESHOLDS)).toBe(3)
    expect(assignLevel(0, FIXTURE_THRESHOLDS)).toBe(7)
  })

  it("places every whole weighting on the shipped default ladder", () => {
    // The synthetic ladder above proves the RULE; this proves the ladder the
    // product actually seeds. Walking 0 to 100 catches the two ways a retune
    // can go wrong and a per-value spot check cannot: a gap (some weighting
    // reaching no level, which would throw) and a level nobody can reach.
    const seen = new Set<number>()
    for (let score = 0; score <= SCORE_SCALE_MAX; score++) {
      const level = assignLevel(score, [...DEFAULT_LEVEL_RULES])
      expect(level, `score ${score}`).toBeGreaterThanOrEqual(1)
      expect(level, `score ${score}`).toBeLessThanOrEqual(LEVEL_COUNT)
      seen.add(level)
    }
    expect(seen.size).toBe(LEVEL_COUNT)
    // Each level opens exactly at its own minScore and not one point below.
    for (const rule of DEFAULT_LEVEL_RULES) {
      expect(
        assignLevel(rule.minScore, [...DEFAULT_LEVEL_RULES]),
        `level ${rule.level}`
      ).toBe(rule.level)
      if (rule.minScore > 0) {
        expect(
          assignLevel(rule.minScore - 1, [...DEFAULT_LEVEL_RULES]),
          `level ${rule.level} floor`
        ).toBe(rule.level + 1)
      }
    }
  })

  it("breaks minScore ties toward the lowest level number (highest level)", () => {
    const thresholds = [
      { level: 2, minScore: 50 },
      { level: 1, minScore: 50 },
      { level: 3, minScore: 0 },
    ]
    expect(assignLevel(75, thresholds)).toBe(1)
  })

  it("throws on an empty threshold list", () => {
    expect(() => assignLevel(10, [])).toThrow(/no level thresholds/)
  })

  it("throws when no threshold matches (missing floor)", () => {
    expect(() => assignLevel(10, [{ level: 1, minScore: 50 }])).toThrow(
      /no level threshold matches/
    )
  })

  it("throws on a negative or non-finite score", () => {
    expect(() => assignLevel(-1, FIXTURE_THRESHOLDS)).toThrow(/invalid score/)
    expect(() =>
      assignLevel(Number.POSITIVE_INFINITY, FIXTURE_THRESHOLDS)
    ).toThrow(/invalid score/)
  })
})

describe("criterionShares", () => {
  it("splits an all-equal rating purely by weight points", () => {
    // every value 3 => contribution_i = 3 * w_i => share_i = w_i / sum(w).
    const shares = criterionShares(allRated(3), FIXTURE_CRITERIA)
    const byId = new Map(shares.map((s) => [s.criterionId, s]))
    expect(byId.get("scope")?.share).toBeCloseTo(5 / 27, 10)
    expect(byId.get("formal")?.share).toBeCloseTo(1 / 27, 10)
    const total = shares.reduce((sum, s) => sum + s.share, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it("returns one entry per criterion, in input order", () => {
    const shares = criterionShares(allRated(4), FIXTURE_CRITERIA)
    expect(shares.map((s) => s.criterionId)).toEqual(
      FIXTURE_CRITERIA.map((c) => c.criterionId)
    )
  })

  it("gives a higher share to a higher value * weight", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "competence", weightPoints: 2 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 4 },
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
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
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
    // "a" is workingConditions: 0 is a real, legal rating there, not a
    // rejection.
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "workingConditions", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
      { criterionId: "c", dimensionKey: "responsibility", weightPoints: 3 },
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
    // Every criterion here is workingConditions purely so an all-0 vector is
    // legal to construct; criterionShares itself has no opinion on how many
    // workingConditions criteria a real model may carry (that cap belongs to
    // method validation, not scoring).
    const criteria: CriterionWeight[] = FIXTURE_CRITERIA.map((criterion) => ({
      ...criterion,
      dimensionKey: "workingConditions",
    }))
    const shares = criterionShares(allRated(0), criteria)
    expect(shares.every((s) => s.share === 0)).toBe(true)
    expect(shares.every((s) => s.contribution === 0)).toBe(true)
  })

  it("throws on a 0 rating for a non-working-conditions criterion", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
    ]
    expect(() =>
      criterionShares([{ criterionId: "a", value: 0 }], criteria)
    ).toThrow(/out of range/)
  })

  it("gives a working-conditions 0 a real (zero) contribution rather than rejecting it", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "wc", dimensionKey: "workingConditions", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
    ]
    const byId = new Map(
      criterionShares(
        [
          { criterionId: "wc", value: 0 },
          { criterionId: "b", value: 4 },
        ],
        criteria
      ).map((s) => [s.criterionId, s])
    )
    expect(byId.get("wc")?.contribution).toBe(0)
    expect(byId.get("wc")?.share).toBe(0)
    expect(byId.get("b")?.share).toBe(1)
  })

  it("skips validation for an orphaned rating (unknown criterion id)", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
    ]
    const shares = criterionShares(
      [{ criterionId: "ghost", value: 0 }] as unknown as RatingInput[],
      criteria
    )
    expect(shares[0]?.share).toBe(0)
  })

  it("treats a criterion with no rating as a zero contribution", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 3 },
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
        [
          {
            criterionId: "a",
            dimensionKey: "competence",
            weightPoints: 0 as WeightPoints,
          },
        ]
      )
    ).toThrow(/invalid weight points/)
  })

  it("gives a single rated criterion a 100% share", () => {
    const byId = new Map(
      criterionShares(
        [{ criterionId: "a", value: 4 }],
        [{ criterionId: "a", dimensionKey: "competence", weightPoints: 3 }]
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
      [{ criterionId: "a", dimensionKey: "competence", weightPoints: 3 }]
    )
    expect(shares).toHaveLength(1)
    expect(shares[0]?.contribution).toBe(15)
    expect(shares[0]?.share).toBe(1)
  })
})
