import { describe, expect, it } from "vitest"
import type { DimensionKey } from "./dimensions"
import type { MethodCheckCriterion, MethodCheckInput } from "./method-checks"
import {
  methodBlockersPass,
  PEOPLE_LEADERSHIP_LIBRARY_KEY,
  validateMethod,
  weightWarnings,
} from "./method-checks"
import type { WeightPoints } from "./weighting"
import { DEFAULT_LEVEL_RULES, DEFAULT_ZONE_PROFILE_RULES } from "./zones"

function criterion(
  overrides: Partial<MethodCheckCriterion> & { criterionId: string }
): MethodCheckCriterion {
  return {
    dimensionKey: "responsibility",
    weightPoints: 3,
    hasRequiredAnchors: true,
    documented: true,
    hasWeightMotivation: false,
    hasOverlapNotes: false,
    ...overrides,
  }
}

// A genuinely balanced 6-criterion model: competence 3+3, effort 5,
// responsibility 3+2+2 (sum 18 = 6 x 3, the exact budget). Every dimension
// share stays under the 40 % warning threshold, so no motivation is needed
// anywhere; working conditions tested not material.
function healthyInput(): MethodCheckInput {
  return {
    criteria: [
      criterion({
        criterionId: "a",
        dimensionKey: "competence",
        weightPoints: 3,
      }),
      criterion({
        criterionId: "b",
        dimensionKey: "competence",
        weightPoints: 3,
      }),
      criterion({ criterionId: "c", dimensionKey: "effort", weightPoints: 5 }),
      criterion({
        criterionId: "d",
        dimensionKey: "responsibility",
        weightPoints: 3,
      }),
      criterion({
        criterionId: "e",
        dimensionKey: "responsibility",
        weightPoints: 2,
      }),
      criterion({
        criterionId: "f",
        dimensionKey: "responsibility",
        weightPoints: 2,
      }),
    ],
    workingConditions: { status: "testedNotMaterial", hasMotivation: true },
    overlapPairs: [],
    levelRules: [...DEFAULT_LEVEL_RULES],
    zoneProfileRules: [...DEFAULT_ZONE_PROFILE_RULES],
  }
}

describe("validateMethod", () => {
  it("passes a healthy model and returns all twelve checks", () => {
    const checks = validateMethod(healthyInput())
    expect(checks).toHaveLength(12)
    expect(checks.every((check) => check.ok)).toBe(true)
    expect(methodBlockersPass(checks)).toBe(true)
  })

  it("returns the twelve checks in a stable order", () => {
    const checks = validateMethod(healthyInput())
    expect(checks.map((check) => check.key)).toEqual([
      "dimensionCoverage",
      "workingConditionsTested",
      "criterionCount",
      "dimensionCaps",
      "anchorsComplete",
      "documentationComplete",
      "weightBudget",
      "levelRulesValid",
      "zoneProfileMonotonic",
      "dimensionWeightBalance",
      "peopleLeadershipWeight",
      "overlapPairs",
    ])
  })

  it("throws on an invalid dimension key smuggled via a cast", () => {
    const input = healthyInput()
    const first = input.criteria[0] as MethodCheckCriterion
    input.criteria[0] = { ...first, dimensionKey: "bogus" as DimensionKey }
    expect(() => validateMethod(input)).toThrow()
  })

  it("throws on a duplicated criterion id", () => {
    const input = healthyInput()
    const first = input.criteria[0] as MethodCheckCriterion
    const second = input.criteria[1] as MethodCheckCriterion
    input.criteria[1] = { ...second, criterionId: first.criterionId }
    expect(() => validateMethod(input)).toThrow()
  })

  it("fails coverage when a mandatory dimension is empty", () => {
    const input = healthyInput()
    input.criteria = input.criteria.filter(
      (item) => item.dimensionKey !== "effort"
    )
    input.criteria.push(
      criterion({ criterionId: "g", dimensionKey: "competence" })
    )
    const check = validateMethod(input).find(
      (c) => c.key === "dimensionCoverage"
    )
    expect(check?.ok).toBe(false)
    expect(check?.dimensions).toEqual(["effort"])
  })

  it("requires the working-conditions materiality decision", () => {
    const input = healthyInput()
    input.workingConditions = null
    const check = validateMethod(input).find(
      (c) => c.key === "workingConditionsTested"
    )
    expect(check?.ok).toBe(false)
    expect(methodBlockersPass(validateMethod(input))).toBe(false)
  })

  it("rejects an active decision without a working-conditions criterion", () => {
    const input = healthyInput()
    input.workingConditions = { status: "active", hasMotivation: true }
    const check = validateMethod(input).find(
      (c) => c.key === "workingConditionsTested"
    )
    expect(check?.ok).toBe(false)
  })

  it("accepts an active decision with exactly one working-conditions criterion", () => {
    const input = healthyInput()
    input.criteria = [
      ...input.criteria.slice(0, 5),
      criterion({ criterionId: "wc", dimensionKey: "workingConditions" }),
    ]
    input.workingConditions = { status: "active", hasMotivation: true }
    const checks = validateMethod(input)
    expect(checks.find((c) => c.key === "workingConditionsTested")?.ok).toBe(
      true
    )
    expect(checks.find((c) => c.key === "dimensionCoverage")?.ok).toBe(true)
  })

  it("does not require motivation on the active branch", () => {
    const input = healthyInput()
    input.criteria = [
      // Drop "f" (weight 2) and add a weight-2 working-conditions
      // criterion in its place, so the budget stays exact and every
      // blocker genuinely passes, not just the one under test.
      ...input.criteria.slice(0, 5),
      criterion({
        criterionId: "wc",
        dimensionKey: "workingConditions",
        weightPoints: 2,
      }),
    ]
    input.workingConditions = { status: "active", hasMotivation: false }
    const checks = validateMethod(input)
    expect(checks.find((c) => c.key === "workingConditionsTested")?.ok).toBe(
      true
    )
    expect(methodBlockersPass(checks)).toBe(true)
  })

  it("rejects tested-not-material without motivation", () => {
    const input = healthyInput()
    input.workingConditions = {
      status: "testedNotMaterial",
      hasMotivation: false,
    }
    expect(
      validateMethod(input).find((c) => c.key === "workingConditionsTested")?.ok
    ).toBe(false)
  })

  it("enforces the 6-8 criterion count", () => {
    const five = healthyInput()
    five.criteria = five.criteria.slice(0, 5)
    const fiveCheck = validateMethod(five).find(
      (c) => c.key === "criterionCount"
    )
    expect(fiveCheck?.ok).toBe(false)
    expect(fiveCheck?.count).toBe(5)

    const nine = healthyInput()
    nine.criteria = [
      ...nine.criteria,
      criterion({ criterionId: "g", dimensionKey: "effort" }),
      criterion({ criterionId: "h", dimensionKey: "competence" }),
      criterion({ criterionId: "i", dimensionKey: "effort" }),
    ]
    expect(
      validateMethod(nine).find((c) => c.key === "criterionCount")?.ok
    ).toBe(false)
  })

  it("enforces per-dimension caps", () => {
    const input = healthyInput()
    input.criteria = [
      ...input.criteria.filter((item) => item.criterionId !== "a"),
      criterion({ criterionId: "g" }),
    ]
    const check = validateMethod(input).find((c) => c.key === "dimensionCaps")
    expect(check?.ok).toBe(false)
    expect(check?.dimensions).toEqual(["responsibility"])
  })

  it("lists criteria missing anchors or documentation", () => {
    const input = healthyInput()
    input.criteria[0] = criterion({
      criterionId: "a",
      dimensionKey: "competence",
      hasRequiredAnchors: false,
    })
    input.criteria[2] = criterion({
      criterionId: "c",
      dimensionKey: "effort",
      documented: false,
    })
    const checks = validateMethod(input)
    expect(
      checks.find((c) => c.key === "anchorsComplete")?.criterionIds
    ).toEqual(["a"])
    expect(
      checks.find((c) => c.key === "documentationComplete")?.criterionIds
    ).toEqual(["c"])
    expect(methodBlockersPass(checks)).toBe(false)
  })

  it("warns on a dimension above 40 percent without motivation and clears once ONE member has it", () => {
    const input = healthyInput()
    // Three responsibility criteria at 5, the other three (2 competence + 1
    // effort) at 1: sum stays 18, the exact budget, while responsibility's
    // share climbs to 15/18 (83 %).
    input.criteria = input.criteria.map((item) =>
      item.dimensionKey === "responsibility"
        ? { ...item, weightPoints: 5, hasWeightMotivation: false }
        : { ...item, weightPoints: 1 }
    )
    const warning = validateMethod(input).find(
      (c) => c.key === "dimensionWeightBalance"
    )
    expect(warning?.ok).toBe(false)
    expect(warning?.dimensions).toEqual(["responsibility"])
    expect(warning?.level).toBe("warning")
    expect(methodBlockersPass(validateMethod(input))).toBe(true)

    // Clearing no longer needs every member motivated: one is enough.
    const firstResponsibility = input.criteria.findIndex(
      (item) => item.dimensionKey === "responsibility"
    )
    const target = input.criteria[firstResponsibility] as MethodCheckCriterion
    input.criteria[firstResponsibility] = {
      ...target,
      hasWeightMotivation: true,
    }
    expect(
      validateMethod(input).find((c) => c.key === "dimensionWeightBalance")?.ok
    ).toBe(true)
  })

  it("warns on people-leadership at weight 4 without motivation", () => {
    const input = healthyInput()
    input.criteria[3] = criterion({
      criterionId: "d",
      libraryKey: PEOPLE_LEADERSHIP_LIBRARY_KEY,
      weightPoints: 4,
    })
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(false)
    const withMotivation = input.criteria[3] as MethodCheckCriterion
    input.criteria[3] = { ...withMotivation, hasWeightMotivation: true }
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(true)
  })

  it("surfaces unacknowledged overlap pairs and clears once one member is acknowledged", () => {
    const input = healthyInput()
    input.criteria[0] = criterion({
      criterionId: "a",
      dimensionKey: "competence",
      libraryKey: "knowledge-depth",
    })
    input.criteria[1] = criterion({
      criterionId: "b",
      dimensionKey: "competence",
      libraryKey: "advisory-judgment",
    })
    input.overlapPairs = [
      ["knowledge-depth", "advisory-judgment"],
      ["complexity-ambiguity", "analytical-effort"],
    ]
    const check = validateMethod(input).find((c) => c.key === "overlapPairs")
    expect(check?.ok).toBe(false)
    expect(check?.pairs).toEqual([["knowledge-depth", "advisory-judgment"]])

    // The org's overlapNotes protokoll field (projected here as
    // hasOverlapNotes) on EITHER matched member is enough: the check is
    // that the overlap was reviewed, not that it was resolved away.
    const acknowledgedFirst = input.criteria[0] as MethodCheckCriterion
    input.criteria[0] = { ...acknowledgedFirst, hasOverlapNotes: true }
    const acknowledged = validateMethod(input).find(
      (c) => c.key === "overlapPairs"
    )
    expect(acknowledged?.ok).toBe(true)
    expect(acknowledged?.pairs).toBeUndefined()
  })

  describe("weightBudget", () => {
    it("blocks when the weights no longer sum to the exact budget", () => {
      const input = healthyInput()
      const first = input.criteria[0] as MethodCheckCriterion
      input.criteria[0] = { ...first, weightPoints: 5 }
      const check = validateMethod(input).find((c) => c.key === "weightBudget")
      expect(check?.ok).toBe(false)
      expect(check?.count).toBe(6)
    })

    it("blocks on a weight outside the 1-5 scale smuggled via a cast", () => {
      const input = healthyInput()
      const first = input.criteria[0] as MethodCheckCriterion
      input.criteria[0] = { ...first, weightPoints: 7 as WeightPoints }
      expect(
        validateMethod(input).find((c) => c.key === "weightBudget")?.ok
      ).toBe(false)
    })
  })

  describe("levelRulesValid", () => {
    it("requires exactly twelve entries", () => {
      const input = healthyInput()
      input.levelRules = input.levelRules.slice(0, 11)
      expect(
        validateMethod(input).find((c) => c.key === "levelRulesValid")?.ok
      ).toBe(false)
    })

    it("rejects a minScore that is not strictly decreasing with level", () => {
      const input = healthyInput()
      input.levelRules = input.levelRules.map((rule, index) =>
        index === 5 ? { ...rule, minScore: 100 } : rule
      )
      expect(
        validateMethod(input).find((c) => c.key === "levelRulesValid")?.ok
      ).toBe(false)
    })

    it("rejects level 12 not flooring at zero", () => {
      const input = healthyInput()
      input.levelRules = input.levelRules.map((rule) =>
        rule.level === 12 ? { ...rule, minScore: 1 } : rule
      )
      expect(
        validateMethod(input).find((c) => c.key === "levelRulesValid")?.ok
      ).toBe(false)
    })
  })

  describe("zoneProfileMonotonic", () => {
    it("is ok with an empty rules list", () => {
      const input = healthyInput()
      input.zoneProfileRules = []
      expect(
        validateMethod(input).find((c) => c.key === "zoneProfileMonotonic")?.ok
      ).toBe(true)
    })

    it("rejects a higher zone gated more leniently than a lower one", () => {
      const input = healthyInput()
      input.zoneProfileRules = [
        { zone: "A", minStep: 2 },
        { zone: "B", minStep: 3 },
      ]
      expect(
        validateMethod(input).find((c) => c.key === "zoneProfileMonotonic")?.ok
      ).toBe(false)
    })
  })
})

describe("weightWarnings", () => {
  it("returns exactly the three warning checks", () => {
    const warnings = weightWarnings(healthyInput())
    expect(warnings.map((w) => w.key).sort()).toEqual([
      "dimensionWeightBalance",
      "overlapPairs",
      "peopleLeadershipWeight",
    ])
    expect(warnings.every((w) => w.level === "warning")).toBe(true)
  })
})
