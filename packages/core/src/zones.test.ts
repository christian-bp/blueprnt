import { describe, expect, it } from "vitest"
import type { DimensionKey } from "./dimensions"
import type { LevelRule, PlacementCriterion } from "./zones"
import {
  DEFAULT_LEVEL_RULES,
  DEFAULT_ZONE_PROFILE_RULES,
  LEVEL_COUNT,
  placeRole,
  profileCriteria,
  ZONE_KEYS,
  ZONE_LEVEL_RANGES,
  zoneForLevel,
} from "./zones"

describe("zone structure", () => {
  it("maps the twelve levels onto four zones", () => {
    expect(ZONE_LEVEL_RANGES).toEqual({
      A: { from: 1, to: 3 },
      B: { from: 4, to: 6 },
      C: { from: 7, to: 9 },
      D: { from: 10, to: 12 },
    })
    expect(zoneForLevel(1)).toBe("A")
    expect(zoneForLevel(3)).toBe("A")
    expect(zoneForLevel(4)).toBe("B")
    expect(zoneForLevel(9)).toBe("C")
    expect(zoneForLevel(12)).toBe("D")
  })

  it("throws outside 1-12", () => {
    expect(() => zoneForLevel(0)).toThrow()
    expect(() => zoneForLevel(13)).toThrow()
    expect(() => zoneForLevel(1.5)).toThrow()
  })

  it("ships twelve default level rules, strictly ordered, floored at zero", () => {
    expect(DEFAULT_LEVEL_RULES).toHaveLength(LEVEL_COUNT)
    expect(DEFAULT_LEVEL_RULES.map((rule) => rule.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    for (let i = 1; i < DEFAULT_LEVEL_RULES.length; i++) {
      expect((DEFAULT_LEVEL_RULES[i] as LevelRule).minScore).toBeLessThan(
        (DEFAULT_LEVEL_RULES[i - 1] as LevelRule).minScore
      )
    }
    expect((DEFAULT_LEVEL_RULES[11] as LevelRule).minScore).toBe(0)
    expect((DEFAULT_LEVEL_RULES[0] as LevelRule).minScore).toBeLessThanOrEqual(
      100
    )
  })

  it("ships default profile rules for the two upper zones only", () => {
    expect(DEFAULT_ZONE_PROFILE_RULES).toEqual([
      { zone: "A", minStep: 4 },
      { zone: "B", minStep: 3 },
    ])
  })
})

describe("zone level ranges", () => {
  it("partitions 1..12 across the four zones with no gap or overlap", () => {
    const covered = new Set<number>()
    for (const zone of ZONE_KEYS) {
      const { from, to } = ZONE_LEVEL_RANGES[zone]
      for (let level = from; level <= to; level++) {
        expect(covered.has(level)).toBe(false)
        covered.add(level)
      }
    }
    expect([...covered].sort((a, b) => a - b)).toEqual(
      Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
    )
  })

  it("ends zone D at the last level", () => {
    expect(ZONE_LEVEL_RANGES.D.to).toBe(LEVEL_COUNT)
  })

  it("agrees with zoneForLevel for every level 1-12", () => {
    for (const zone of ZONE_KEYS) {
      const { from, to } = ZONE_LEVEL_RANGES[zone]
      for (let level = from; level <= to; level++) {
        expect(zoneForLevel(level)).toBe(zone)
      }
    }
  })
})

describe("profileCriteria", () => {
  it("selects criteria with weight 4 or 5, excluding working conditions", () => {
    const criteria: Array<{
      criterionId: string
      dimensionKey: DimensionKey
      weightPoints: number
    }> = [
      { criterionId: "a", dimensionKey: "responsibility", weightPoints: 5 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 4 },
      { criterionId: "c", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "d", dimensionKey: "competence", weightPoints: 1 },
      {
        criterionId: "e",
        dimensionKey: "workingConditions",
        weightPoints: 5,
      },
    ]
    expect(profileCriteria(criteria).map((c) => c.criterionId)).toEqual([
      "a",
      "b",
    ])
  })
})

function criteria(): PlacementCriterion[] {
  return [
    { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 5 },
    { criterionId: "complexity", dimensionKey: "effort", weightPoints: 4 },
    { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
  ]
}

// Level rules built for readable tests: level 1 needs 90, then 80, 70, ...
// level 12 needs 0 (score 85 implies level 2, zone A).
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

describe("placeRole", () => {
  it("keeps the score-implied placement when the profile holds", () => {
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 5 },
        { criterionId: "complexity", value: 4 },
        { criterionId: "knowledge", value: 3 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement).toEqual({
      level: 2,
      zone: "A",
      profileLimited: false,
      profileFailures: [],
    })
  })

  it("caps into the highest zone whose profile the role meets", () => {
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 3 },
        { criterionId: "complexity", value: 3 },
        { criterionId: "knowledge", value: 5 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement.zone).toBe("B")
    expect(placement.level).toBe(4)
    expect(placement.profileLimited).toBe(true)
    expect(placement.profileFailures).toEqual([
      { criterionId: "scope", required: 4, actual: 3 },
      { criterionId: "complexity", required: 4, actual: 3 },
    ])
  })

  it("places without gating when no profile criteria exist", () => {
    const flat = criteria().map(
      (c): PlacementCriterion => ({ ...c, weightPoints: 3 })
    )
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 1 },
        { criterionId: "complexity", value: 1 },
        { criterionId: "knowledge", value: 1 },
      ],
      criteria: flat,
      levelRules: levelRules(),
      zoneProfileRules: [{ zone: "A", minStep: 4 }],
    })
    expect(placement.profileLimited).toBe(false)
    expect(placement.zone).toBe("A")
  })

  it("treats a missing rating on a profile criterion as 0", () => {
    const placement = placeRole({
      score: 85,
      ratings: [{ criterionId: "knowledge", value: 5 }],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
        { zone: "C", minStep: 2 },
      ],
    })
    expect(placement.zone).toBe("D")
    expect(placement.level).toBe(10)
    expect(placement.profileLimited).toBe(true)
  })

  it("keeps the score level when the role fails its own zone D rule", () => {
    const placement = placeRole({
      score: 15,
      ratings: [
        { criterionId: "scope", value: 1 },
        { criterionId: "complexity", value: 1 },
        { criterionId: "knowledge", value: 1 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [{ zone: "D", minStep: 2 }],
    })
    expect(placement.zone).toBe("D")
    expect(placement.level).toBe(11)
    expect(placement.profileLimited).toBe(true)
    expect(placement.profileFailures).toHaveLength(2)
  })

  it("never lifts a role above its score-implied zone", () => {
    const placement = placeRole({
      score: 35,
      ratings: [
        { criterionId: "scope", value: 5 },
        { criterionId: "complexity", value: 5 },
        { criterionId: "knowledge", value: 5 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement).toEqual({
      level: 8,
      zone: "C",
      profileLimited: false,
      profileFailures: [],
    })
  })

  it("never lets a working-conditions criterion gate a zone even at weight 5", () => {
    const wcCriteria: PlacementCriterion[] = [
      { criterionId: "wc", dimensionKey: "workingConditions", weightPoints: 5 },
      { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
    ]
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "wc", value: 0 },
        { criterionId: "knowledge", value: 3 },
      ],
      criteria: wcCriteria,
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement.zone).toBe("A")
    expect(placement.profileLimited).toBe(false)
  })

  it("throws on a duplicated criterion id", () => {
    const dup: PlacementCriterion[] = [
      ...criteria(),
      { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 2 },
    ]
    expect(() =>
      placeRole({
        score: 85,
        ratings: [],
        criteria: dup,
        levelRules: levelRules(),
        zoneProfileRules: [{ zone: "A", minStep: 4 }],
      })
    ).toThrow()
  })
})
