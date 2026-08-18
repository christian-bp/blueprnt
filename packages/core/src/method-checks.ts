import type { WeightPoints } from "./weighting"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  DIMENSION_WEIGHT_WARNING_SHARE,
  type DimensionKey,
  dimensionWeightShares,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
} from "./dimensions"

// The pre-approval checklist and the weighting warnings as one pure rule
// set. Both the approval mutation (blockers refuse) and the builder UI (live
// checklist) consume the same results, so the two can never disagree. The
// engine returns structured findings only; the frontend translates.

export type MethodCheckKey =
  | "dimensionCoverage"
  | "workingConditionsTested"
  | "criterionCount"
  | "dimensionCaps"
  | "anchorsComplete"
  | "documentationComplete"
  | "dimensionWeightBalance"
  | "peopleLeadershipWeight"
  | "overlapPairs"

export interface MethodCheckCriterion {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: WeightPoints
  hasRequiredAnchors: boolean
  // Kriterieurvalsprotokoll documented and approved.
  documented: boolean
  hasWeightMotivation: boolean
  libraryKey?: string
}

export interface MethodCheckInput {
  criteria: MethodCheckCriterion[]
  workingConditions: {
    status: "active" | "testedNotMaterial"
    hasMotivation: boolean
  } | null
  overlapPairs: readonly (readonly [string, string])[]
}

export interface MethodCheck {
  key: MethodCheckKey
  level: "blocker" | "warning"
  ok: boolean
  criterionIds?: string[]
  dimensions?: DimensionKey[]
  pairs?: [string, string][]
  count?: number
}

const PEOPLE_LEADERSHIP_KEY = "people-leadership"
const HIGH_WEIGHT_FLOOR = 4

export function validateMethod(input: MethodCheckInput): MethodCheck[] {
  const byDimension = new Map<DimensionKey, MethodCheckCriterion[]>()
  for (const key of DIMENSION_KEYS) byDimension.set(key, [])
  for (const criterion of input.criteria) {
    byDimension.get(criterion.dimensionKey)?.push(criterion)
  }
  const count = (key: DimensionKey) => byDimension.get(key)?.length ?? 0

  const uncoveredMandatory = (
    ["competence", "effort", "responsibility"] as const
  ).filter((key) => count(key) === 0)

  const workingConditions = input.workingConditions
  const workingConditionsOk =
    workingConditions === null
      ? false
      : workingConditions.hasMotivation &&
        ((workingConditions.status === "testedNotMaterial" &&
          count("workingConditions") === 0) ||
          (workingConditions.status === "active" &&
            count("workingConditions") === 1))

  const total = input.criteria.length

  const overCap = DIMENSION_KEYS.filter(
    (key) => count(key) > DIMENSION_MAX_ACTIVE[key]
  )

  const missingAnchors = input.criteria
    .filter((criterion) => !criterion.hasRequiredAnchors)
    .map((criterion) => criterion.criterionId)

  const undocumented = input.criteria
    .filter((criterion) => !criterion.documented)
    .map((criterion) => criterion.criterionId)

  const shares = dimensionWeightShares(input.criteria)
  const unbalanced = DIMENSION_KEYS.filter(
    (key) =>
      shares[key] > DIMENSION_WEIGHT_WARNING_SHARE &&
      (byDimension.get(key) ?? []).some(
        (criterion) => !criterion.hasWeightMotivation
      )
  )

  const peopleLeadership = input.criteria.find(
    (criterion) => criterion.libraryKey === PEOPLE_LEADERSHIP_KEY
  )
  const peopleLeadershipOk =
    peopleLeadership === undefined ||
    peopleLeadership.weightPoints < HIGH_WEIGHT_FLOOR ||
    peopleLeadership.hasWeightMotivation

  const selectedLibraryKeys = new Set(
    input.criteria
      .map((criterion) => criterion.libraryKey)
      .filter((key): key is string => key !== undefined)
  )
  const matchedPairs = input.overlapPairs
    .filter(
      ([left, right]) =>
        selectedLibraryKeys.has(left) && selectedLibraryKeys.has(right)
    )
    .map(([left, right]): [string, string] => [left, right])

  return [
    {
      key: "dimensionCoverage",
      level: "blocker",
      ok: uncoveredMandatory.length === 0,
      dimensions:
        uncoveredMandatory.length > 0 ? uncoveredMandatory : undefined,
    },
    {
      key: "workingConditionsTested",
      level: "blocker",
      ok: workingConditionsOk,
    },
    {
      key: "criterionCount",
      level: "blocker",
      ok: total >= MODEL_MIN_CRITERIA && total <= MODEL_MAX_CRITERIA,
      count: total,
    },
    {
      key: "dimensionCaps",
      level: "blocker",
      ok: overCap.length === 0,
      dimensions: overCap.length > 0 ? [...overCap] : undefined,
    },
    {
      key: "anchorsComplete",
      level: "blocker",
      ok: missingAnchors.length === 0,
      criterionIds: missingAnchors.length > 0 ? missingAnchors : undefined,
    },
    {
      key: "documentationComplete",
      level: "blocker",
      ok: undocumented.length === 0,
      criterionIds: undocumented.length > 0 ? undocumented : undefined,
    },
    {
      key: "dimensionWeightBalance",
      level: "warning",
      ok: unbalanced.length === 0,
      dimensions: unbalanced.length > 0 ? [...unbalanced] : undefined,
    },
    {
      key: "peopleLeadershipWeight",
      level: "warning",
      ok: peopleLeadershipOk,
    },
    {
      key: "overlapPairs",
      level: "warning",
      ok: matchedPairs.length === 0,
      pairs: matchedPairs.length > 0 ? matchedPairs : undefined,
    },
  ]
}

const WARNING_KEYS: readonly MethodCheckKey[] = [
  "dimensionWeightBalance",
  "peopleLeadershipWeight",
  "overlapPairs",
]

export function weightWarnings(input: MethodCheckInput): MethodCheck[] {
  return validateMethod(input).filter((check) =>
    WARNING_KEYS.includes(check.key)
  )
}

export function methodBlockersPass(checks: MethodCheck[]): boolean {
  return checks.every((check) => check.level !== "blocker" || check.ok)
}
