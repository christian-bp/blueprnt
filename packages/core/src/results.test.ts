import { describe, expect, it } from "vitest"
import { computeResults } from "./results"
import {
  STANDARD_CRITERIA,
  STANDARD_THRESHOLDS,
  allRated,
} from "./scoring.fixtures"
import type { CriterionWeight, RoleRatings } from "./types"

describe("computeResults", () => {
  it("derives score, level, and zone only for fully rated roles", () => {
    const roles: RoleRatings[] = [
      { roleId: "r-full", ratings: allRated(5) },
      { roleId: "r-partial", ratings: allRated(5).slice(0, 4) },
      { roleId: "r-none", ratings: [] },
    ]
    const results = computeResults({
      criteria: STANDARD_CRITERIA,
      thresholds: STANDARD_THRESHOLDS,
      zoneProfileRules: [],
      roles,
    })
    // With no zone profile rules, every zone admits unconditionally: the
    // placement is exactly the score-implied level and zone.
    expect(results).toEqual([
      {
        roleId: "r-full",
        ratedCount: 9,
        totalCriteria: 9,
        complete: true,
        score: 100,
        level: 1,
        zone: "A",
        profileLimited: false,
        profileFailures: [],
      },
      {
        roleId: "r-partial",
        ratedCount: 4,
        totalCriteria: 9,
        complete: false,
        score: null,
        level: null,
        zone: null,
        profileLimited: null,
        profileFailures: null,
      },
      {
        roleId: "r-none",
        ratedCount: 0,
        totalCriteria: 9,
        complete: false,
        score: null,
        level: null,
        zone: null,
        profileLimited: null,
        profileFailures: null,
      },
    ])
  })

  it("never treats a zero-criteria model as complete", () => {
    const results = computeResults({
      criteria: [],
      thresholds: STANDARD_THRESHOLDS,
      zoneProfileRules: [],
      roles: [{ roleId: "r1", ratings: [] }],
    })
    expect(results[0]).toEqual({
      roleId: "r1",
      ratedCount: 0,
      totalCriteria: 0,
      complete: false,
      score: null,
      level: null,
      zone: null,
      profileLimited: null,
      profileFailures: null,
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
      zoneProfileRules: [],
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
      zoneProfileRules: [],
      roles: [{ roleId: "r1", ratings }],
    })
    expect(results[0]).toMatchObject({
      ratedCount: 8,
      complete: false,
      score: null,
      level: null,
    })
  })

  // Level rules built for readable zone tests, mirroring zones.test.ts's own
  // placeRole fixture: level 1 needs 90, stepping down to level 12 at 0.
  function levelRules() {
    return [
      { level: 1, minScore: 90 },
      { level: 2, minScore: 80 },
      { level: 3, minScore: 70 },
      { level: 4, minScore: 60 },
      { level: 5, minScore: 50 },
      { level: 6, minScore: 45 },
      { level: 7, minScore: 40 },
      { level: 8, minScore: 35 },
      { level: 9, minScore: 30 },
      { level: 10, minScore: 20 },
      { level: 11, minScore: 10 },
      { level: 12, minScore: 0 },
    ]
  }

  function profileModelCriteria(): CriterionWeight[] {
    return [
      { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 5 },
      { criterionId: "complexity", dimensionKey: "effort", weightPoints: 4 },
      { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
    ]
  }

  it("caps a profile-limited role into the highest zone it actually qualifies for", () => {
    const results = computeResults({
      criteria: profileModelCriteria(),
      thresholds: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
      roles: [
        {
          roleId: "r1",
          ratings: [
            { criterionId: "scope", value: 3 },
            { criterionId: "complexity", value: 3 },
            { criterionId: "knowledge", value: 5 },
          ],
        },
      ],
    })
    // raw = 3*5 + 3*4 + 5*3 = 42; totalPoints 12; score = floor(20*42/12) = 70,
    // which is score-implied level 3 (zone A). scope and complexity are both
    // profile criteria (weight >= 4) and both fail A's step-4 floor, so the
    // role caps into zone B (the next zone down it clears) at B's top level.
    expect(results[0]).toMatchObject({
      complete: true,
      score: 70,
      level: 4,
      zone: "B",
      profileLimited: true,
      profileFailures: [
        { criterionId: "scope", required: 4, actual: 3 },
        { criterionId: "complexity", required: 4, actual: 3 },
      ],
    })
  })

  it("never lets a working-conditions criterion gate zone placement, even carrying most of the model's weight", () => {
    const results = computeResults({
      criteria: [
        {
          criterionId: "wc",
          dimensionKey: "workingConditions",
          weightPoints: 5,
        },
        {
          criterionId: "knowledge",
          dimensionKey: "competence",
          weightPoints: 3,
        },
      ],
      thresholds: [
        { level: 1, minScore: 30 },
        { level: 2, minScore: 20 },
        { level: 3, minScore: 10 },
        { level: 4, minScore: 0 },
      ],
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
      roles: [
        {
          roleId: "r1",
          ratings: [
            { criterionId: "wc", value: 0 },
            { criterionId: "knowledge", value: 5 },
          ],
        },
      ],
    })
    // raw = 0*5 + 5*3 = 15; totalPoints 8; score = floor(20*15/8) = 37, which
    // is level 1 (zone A). wc carries 5 of the model's 8 weight points (the
    // majority) but is always profile-exempt, and knowledge sits under the
    // weight-4 profile floor, so the profile is empty: nothing gates, despite
    // wc's own rating of 0.
    expect(results[0]).toMatchObject({
      complete: true,
      score: 37,
      zone: "A",
      profileLimited: false,
      profileFailures: [],
    })
  })
})
