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

function assertValidRating(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error(`rating out of range: ${value}`)
  }
}

// Normalized weighted score on the fixed 0-100 scale (ADR-0004):
// floor(20 * sum(rating * weightPoints) / sum(weightPoints)). Normalizing
// over the model's own point sum keeps the scale independent of the
// criterion count, so level thresholds stay meaningful when criteria are
// added or removed. Flooring keeps the comparison against integer level
// thresholds exact: floored >= T iff unfloored >= T for integer T. All
// inputs are small integers, so the float quotient is exact whenever the
// true quotient is an integer and the floor is safe.
//
// Ratings for unknown criterion ids are ignored (orphan safety: the backend
// cleans up on criterion removal; the engine tolerates strays).
export function scoreRole(
  ratings: RatingInput[],
  criteria: CriterionWeight[]
): number {
  assertUniqueCriteria(criteria)
  if (criteria.length === 0) {
    throw new Error("no criteria to score against")
  }
  const pointsById = new Map<string, number>()
  let totalPoints = 0
  for (const criterion of criteria) {
    // Runtime guard: the backend casts stored numbers into WeightPoints.
    if (!isWeightPoints(criterion.weightPoints)) {
      throw new Error(`invalid weight points: ${criterion.weightPoints}`)
    }
    pointsById.set(criterion.criterionId, criterion.weightPoints)
    totalPoints += criterion.weightPoints
  }
  const seen = new Set<string>()
  let raw = 0
  for (const rating of ratings) {
    if (seen.has(rating.criterionId)) {
      throw new Error(`duplicate rating: ${rating.criterionId}`)
    }
    seen.add(rating.criterionId)
    assertValidRating(rating.value)
    const points = pointsById.get(rating.criterionId)
    if (points === undefined) continue
    raw += rating.value * points
  }
  return Math.floor((20 * raw) / totalPoints)
}

// Per-criterion share of the weighted total that produces the score (ADR-0002
// derivation; never stored). contribution_i = value_i * weightPoints_i;
// share_i = contribution_i / sum(contribution). When the total is 0 (every
// rating is 0) every share is 0, so there is no division by zero. A criterion
// with no rating contributes 0. Output order follows the criteria order; the
// last value wins for a duplicated rating (display leniency, unlike scoreRole).
export function criterionShares(
  ratings: RatingInput[],
  criteria: Pick<CriterionWeight, "criterionId" | "weightPoints">[]
): CriterionShare[] {
  assertUniqueCriteria(criteria)
  const valueById = new Map<string, number>()
  for (const rating of ratings) {
    assertValidRating(rating.value)
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
