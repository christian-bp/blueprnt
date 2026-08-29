import { assertValidRatingValue, NOT_COVERED } from "./dimensions"
import { isWeightPoints } from "./weighting"
import type {
  CriterionShare,
  CriterionWeight,
  LevelThreshold,
  RatingInput,
} from "./types"

// Pure scoring engine (ADR-0002): score and level are always derived, never
// stored. No Convex imports, no side effects, fully deterministic.

// The minimal shape a duplicate-id check needs: a caller with only ids on
// hand (no weight, no dimension) can still be checked, and callers with the
// full model shape satisfy this structurally for free.
interface CriterionIdentity {
  criterionId: string
}

export function assertUniqueCriteria(criteria: CriterionIdentity[]): void {
  const seen = new Set<string>()
  for (const criterion of criteria) {
    if (seen.has(criterion.criterionId)) {
      throw new Error(`duplicate criterion: ${criterion.criterionId}`)
    }
    seen.add(criterion.criterionId)
  }
}

// Normalized weighted score on the fixed 0-100 scale (ADR-0004):
// floor(20 * sum(rating * weightPoints) / sum(weightPoints)), summed over the
// criteria the role is actually MEASURED on. Normalizing over the point sum
// keeps the scale independent of the criterion count, so level thresholds
// stay meaningful when criteria are added or removed. Flooring keeps the
// comparison against integer level thresholds exact: floored >= T iff
// unfloored >= T for integer T. All inputs are small integers, so the float
// quotient is exact whenever the true quotient is an integer and the floor is
// safe.
//
// A rating of 0 is NOT a low score: it is only legal on a working-conditions
// criterion (assertValidRatingValue) and it means the role is not covered by
// the defined condition. Such a criterion therefore leaves BOTH sides of the
// quotient, so the role is measured only on what applies to it. Counting the
// 0 in the numerator while leaving its weight in the denominator would
// penalize a role for not being exposed, which is the opposite of what the
// criterion's own definition says, and it capped the scale: at a
// working-conditions weight of 3 a role rated 5 on everything it is measured
// on reached 85, so the top two levels were unreachable for it. The excluded
// role now lands on the level its own profile earns, and an exposed role
// moves above or below that depending on how demanding its conditions are.
// Consequence, and it is the intended one: the remaining criteria's shares
// rise proportionally for that role, because a criterion that does not apply
// cannot hold a share of what does.
//
// Ratings for unknown criterion ids are ignored (orphan safety: the backend
// cleans up on criterion removal; the engine tolerates strays), including
// their validation: an orphan's dimension is unknowable, so it is skipped
// rather than checked, while duplicate detection still runs on every rating.
export function scoreRole(
  ratings: RatingInput[],
  criteria: CriterionWeight[]
): number {
  assertUniqueCriteria(criteria)
  if (criteria.length === 0) {
    throw new Error("no criteria to score against")
  }
  const criterionById = new Map<string, CriterionWeight>()
  let totalPoints = 0
  for (const criterion of criteria) {
    // Runtime guard: the backend casts stored numbers into WeightPoints.
    if (!isWeightPoints(criterion.weightPoints)) {
      throw new Error(`invalid weight points: ${criterion.weightPoints}`)
    }
    criterionById.set(criterion.criterionId, criterion)
    totalPoints += criterion.weightPoints
  }
  const seen = new Set<string>()
  let raw = 0
  for (const rating of ratings) {
    if (seen.has(rating.criterionId)) {
      throw new Error(`duplicate rating: ${rating.criterionId}`)
    }
    seen.add(rating.criterionId)
    const criterion = criterionById.get(rating.criterionId)
    if (criterion === undefined) continue
    assertValidRatingValue(rating.value, criterion.dimensionKey)
    if (rating.value === NOT_COVERED) {
      totalPoints -= criterion.weightPoints
      continue
    }
    raw += rating.value * criterion.weightPoints
  }
  // The dimension caps allow at most one working-conditions criterion, so a
  // real model can never lose its whole denominator here. A caller that hands
  // in nothing but an uncovered criterion has asked for the score of a role
  // measured on nothing, which has no answer.
  if (totalPoints === 0) {
    throw new Error("every criterion is uncovered; nothing to score against")
  }
  return Math.floor((20 * raw) / totalPoints)
}

// Per-criterion share of the weighted total that produces the score (ADR-0002
// derivation; never stored). contribution_i = value_i * weightPoints_i;
// share_i = contribution_i / sum(contribution). When the total is 0 (every
// rating is 0) every share is 0, so there is no division by zero. A criterion
// with no rating contributes 0. Output order follows the criteria order; the
// last value wins for a duplicated rating (display leniency, unlike scoreRole).
// Like scoreRole, only ratings tied to a known criterion are validated: an
// orphan rating's dimension is unknowable and it never reaches a share anyway.
export function criterionShares(
  ratings: RatingInput[],
  criteria: Pick<
    CriterionWeight,
    "criterionId" | "weightPoints" | "dimensionKey"
  >[]
): CriterionShare[] {
  assertUniqueCriteria(criteria)
  const criterionById = new Map(criteria.map((c) => [c.criterionId, c]))
  const valueById = new Map<string, number>()
  for (const rating of ratings) {
    const criterion = criterionById.get(rating.criterionId)
    if (criterion === undefined) continue
    assertValidRatingValue(rating.value, criterion.dimensionKey)
    valueById.set(rating.criterionId, rating.value)
  }
  const contributions = criteria.map((criterion) => {
    if (!isWeightPoints(criterion.weightPoints)) {
      throw new Error(`invalid weight points: ${criterion.weightPoints}`)
    }
    const value = valueById.get(criterion.criterionId) ?? 0
    return {
      criterionId: criterion.criterionId,
      contribution: value * criterion.weightPoints,
    }
  })
  const total = contributions.reduce((sum, c) => sum + c.contribution, 0)
  return contributions.map((c) => ({
    criterionId: c.criterionId,
    contribution: c.contribution,
    share: total === 0 ? 0 : c.contribution / total,
  }))
}

// Level 1 is highest; minScore is the inclusive lower bound of a level. Picks
// the threshold with the highest minScore the score reaches (tie-break:
// lowest level number). Callers always seed a floor threshold at minScore 0,
// so a no-match is an invariant violation, not a normal case.
export function assignLevel(
  score: number,
  thresholds: LevelThreshold[]
): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error(`invalid score: ${score}`)
  }
  if (thresholds.length === 0) throw new Error("no level thresholds")
  const sorted = [...thresholds].sort(
    (a, b) => b.minScore - a.minScore || a.level - b.level
  )
  for (const threshold of sorted) {
    if (score >= threshold.minScore) return threshold.level
  }
  throw new Error(`no level threshold matches score ${score}`)
}
