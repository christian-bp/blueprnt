import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  DIMENSION_WEIGHT_WARNING_SHARE,
  type DimensionKey,
  dimensionWeightShares,
  isDimensionKey,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
} from "./dimensions"
import { assertUniqueCriteria } from "./scoring"
import { budgetDelta, isWeightPoints, type WeightPoints } from "./weighting"
import {
  LEVEL_COUNT,
  SCORE_SCALE_MAX,
  type LevelRule,
  PROFILE_WEIGHT_FLOOR,
  ZONE_KEYS,
  type ZoneProfileRule,
} from "./zones"

// The pre-approval checklist and the weighting warnings as one pure rule
// set. Both the approval mutation (blockers refuse) and the builder UI (live
// checklist) consume the same results, so the two can never disagree. The
// engine returns structured findings only; the frontend translates.

// The twelve checks, in the order validateMethod returns them. Exported as a
// const array (not just the union type) so a Convex wire validator can be
// built from it with a compile-time drift guard, the same pattern DIMENSION_KEYS
// and ZONE_KEYS already use.
export const METHOD_CHECK_KEYS = [
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
] as const
export type MethodCheckKey = (typeof METHOD_CHECK_KEYS)[number]

export interface MethodCheckCriterion {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: WeightPoints
  hasRequiredAnchors: boolean
  // Kriterieurvalsprotokoll documented and approved.
  documented: boolean
  hasWeightMotivation: boolean
  // The org's overlapNotes protokoll field, projected to a boolean: has this
  // criterion's overlap against its library pairs been reviewed and noted.
  hasOverlapNotes: boolean
  libraryKey?: string
}

export interface MethodCheckInput {
  criteria: MethodCheckCriterion[]
  workingConditions: {
    status: "active" | "testedNotMaterial"
    hasMotivation: boolean
  } | null
  overlapPairs: readonly (readonly [string, string])[]
  levelRules: LevelRule[]
  zoneProfileRules: ZoneProfileRule[]
}

export interface MethodCheck {
  key: MethodCheckKey
  level: "blocker" | "warning"
  ok: boolean
  criterionIds?: string[]
  dimensions?: DimensionKey[]
  pairs?: [string, string][]
  count?: number
  // Whether this check's obligation EXISTS for this model at all, as opposed
  // to being satisfied. Only a check whose subject can be absent carries it:
  // peopleLeadershipWeight has nothing to ask of a model that selected no
  // people-leadership criterion, and reports ok there for the same reason it
  // reports ok when the obligation is met. A surface counting obligations
  // needs the two told apart, and the engine is the only place that knows.
  applies?: boolean
}

export const PEOPLE_LEADERSHIP_LIBRARY_KEY = "people-leadership"

// Twelve entries, levels exactly 1-12 with no duplicates, minScore strictly
// decreasing as level ascends (level 1 highest), level 12 flooring at 0, and
// the top entry at or below 100.
function levelRulesAreValid(levelRules: readonly LevelRule[]): boolean {
  if (levelRules.length !== LEVEL_COUNT) return false
  const sorted = [...levelRules].sort((a, b) => a.level - b.level)
  let previousMinScore: number | undefined
  for (const [index, rule] of sorted.entries()) {
    if (rule.level !== index + 1) return false
    if (previousMinScore !== undefined && rule.minScore >= previousMinScore) {
      return false
    }
    previousMinScore = rule.minScore
  }
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === undefined || last === undefined) return false
  return last.minScore === 0 && first.minScore <= SCORE_SCALE_MAX
}

// Walking configured zones A -> D, a zone's minStep must never exceed an
// earlier (higher) zone's: a higher zone is never gated more leniently than
// a lower one. Zones without a rule are skipped; an empty list is ok.
function zoneProfileIsMonotonic(rules: readonly ZoneProfileRule[]): boolean {
  const minStepByZone = new Map(rules.map((rule) => [rule.zone, rule.minStep]))
  let previous: number | undefined
  for (const zone of ZONE_KEYS) {
    const minStep = minStepByZone.get(zone)
    if (minStep === undefined) continue
    if (previous !== undefined && minStep > previous) return false
    previous = minStep
  }
  return true
}

export function validateMethod(input: MethodCheckInput): MethodCheck[] {
  // Boundary guards: a cast at the storage edge must never reach the
  // computations below as a live invariant violation instead of a thrown
  // error.
  for (const criterion of input.criteria) {
    if (!isDimensionKey(criterion.dimensionKey)) {
      throw new Error(`invalid dimension key: ${criterion.dimensionKey}`)
    }
  }
  assertUniqueCriteria(input.criteria)

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
      : (workingConditions.status === "testedNotMaterial" &&
          workingConditions.hasMotivation &&
          count("workingConditions") === 0) ||
        (workingConditions.status === "active" &&
          count("workingConditions") === 1)

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

  // Guards non-UI write paths: every weight an integer 1-5, and the sum
  // exactly the criteria-count x 3 budget (ADR-0004).
  const weightsValid = input.criteria.every((criterion) =>
    isWeightPoints(criterion.weightPoints)
  )
  const budgetExact =
    weightsValid &&
    budgetDelta(input.criteria.map((criterion) => criterion.weightPoints)) === 0

  const levelRulesOk = levelRulesAreValid(input.levelRules)
  const zoneProfileOk = zoneProfileIsMonotonic(input.zoneProfileRules)

  const shares = dimensionWeightShares(input.criteria)
  const unbalanced = DIMENSION_KEYS.filter(
    (key) =>
      shares[key] > DIMENSION_WEIGHT_WARNING_SHARE &&
      !(byDimension.get(key) ?? []).some(
        (criterion) => criterion.hasWeightMotivation
      )
  )

  const peopleLeadership = input.criteria.find(
    (criterion) => criterion.libraryKey === PEOPLE_LEADERSHIP_LIBRARY_KEY
  )
  const peopleLeadershipOk =
    peopleLeadership === undefined ||
    peopleLeadership.weightPoints < PROFILE_WEIGHT_FLOOR ||
    peopleLeadership.hasWeightMotivation

  const selectedLibraryKeys = new Set(
    input.criteria
      .map((criterion) => criterion.libraryKey)
      .filter((key): key is string => key !== undefined)
  )
  // A matched pair reads acknowledged once EITHER member carries the org's
  // overlapNotes: §17.2 item 7 requires the check to have been performed,
  // not that the overlap was resolved away.
  const hasOverlapNotesFor = (libraryKey: string): boolean =>
    input.criteria.some(
      (criterion) =>
        criterion.libraryKey === libraryKey && criterion.hasOverlapNotes
    )
  const unacknowledgedPairs = input.overlapPairs
    .filter(
      ([left, right]) =>
        selectedLibraryKeys.has(left) && selectedLibraryKeys.has(right)
    )
    .filter(
      ([left, right]) =>
        !(hasOverlapNotesFor(left) || hasOverlapNotesFor(right))
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
      key: "weightBudget",
      level: "blocker",
      ok: budgetExact,
      count: total,
    },
    {
      key: "levelRulesValid",
      level: "blocker",
      ok: levelRulesOk,
    },
    {
      key: "zoneProfileMonotonic",
      level: "blocker",
      ok: zoneProfileOk,
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
      applies: peopleLeadership !== undefined,
    },
    {
      key: "overlapPairs",
      level: "warning",
      ok: unacknowledgedPairs.length === 0,
      pairs: unacknowledgedPairs.length > 0 ? unacknowledgedPairs : undefined,
    },
  ]
}

export function weightWarnings(input: MethodCheckInput): MethodCheck[] {
  return validateMethod(input).filter((check) => check.level === "warning")
}

export function methodBlockersPass(checks: MethodCheck[]): boolean {
  return checks.every((check) => check.level !== "blocker" || check.ok)
}
