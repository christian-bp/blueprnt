import { describe, expect, it } from "vitest"
import type { MethodCheckCriterion, MethodCheckInput } from "./method-checks"
import {
  methodBlockersPass,
  validateMethod,
  weightWarnings,
} from "./method-checks"

function criterion(
  overrides: Partial<MethodCheckCriterion> & { criterionId: string }
): MethodCheckCriterion {
  return {
    dimensionKey: "responsibility",
    weightPoints: 3,
    hasRequiredAnchors: true,
    documented: true,
    hasWeightMotivation: false,
    ...overrides,
  }
}

// A minimal healthy 6-criterion model: 2 competence, 1 effort, 3
// responsibility, working conditions tested not material.
function healthyInput(): MethodCheckInput {
  return {
    criteria: [
      criterion({
        criterionId: "a",
        dimensionKey: "competence",
        hasWeightMotivation: true,
      }),
      criterion({
        criterionId: "b",
        dimensionKey: "competence",
        hasWeightMotivation: true,
      }),
      criterion({
        criterionId: "c",
        dimensionKey: "effort",
        hasWeightMotivation: true,
      }),
      criterion({ criterionId: "d", hasWeightMotivation: true }),
      criterion({ criterionId: "e", hasWeightMotivation: true }),
      criterion({ criterionId: "f", hasWeightMotivation: true }),
    ],
    workingConditions: { status: "testedNotMaterial", hasMotivation: true },
    overlapPairs: [],
  }
}

describe("validateMethod", () => {
  it("passes a healthy model and returns all nine checks", () => {
    const checks = validateMethod(healthyInput())
    expect(checks).toHaveLength(9)
    expect(checks.every((check) => check.ok)).toBe(true)
    expect(methodBlockersPass(checks)).toBe(true)
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
      ...input.criteria.slice(0, 5),
      criterion({ criterionId: "wc", dimensionKey: "workingConditions" }),
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

  it("warns on a dimension above 40 percent without motivation and clears with it", () => {
    const input = healthyInput()
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

    input.criteria = input.criteria.map((item) =>
      item.dimensionKey === "responsibility"
        ? { ...item, hasWeightMotivation: true }
        : item
    )
    expect(
      validateMethod(input).find((c) => c.key === "dimensionWeightBalance")?.ok
    ).toBe(true)
  })

  it("warns on people-leadership at weight 4 without motivation", () => {
    const input = healthyInput()
    input.criteria[3] = criterion({
      criterionId: "d",
      libraryKey: "people-leadership",
      weightPoints: 4,
    })
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(false)
    input.criteria[3] = { ...input.criteria[3], hasWeightMotivation: true }
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(true)
  })

  it("surfaces selected overlap pairs", () => {
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
