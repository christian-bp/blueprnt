import { isWeightPoints } from "./weighting"
import type {
  BandThreshold,
  ComputeInput,
  CriterionWeight,
  RatingInput,
  RoleResult,
} from "./types"

// Pure scoring engine (ADR-0002): score and band are always derived, never
// stored. No Convex imports, no side effects, fully deterministic.

export function assertUniqueCriteria(criteria: CriterionWeight[]): void {
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
// criterion count, so band thresholds stay meaningful when criteria are
// added or removed. Flooring keeps the comparison against integer band
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

// Band 1 is highest; minScore is the inclusive lower bound of a band. Picks
// the threshold with the highest minScore the score reaches (tie-break:
// lowest band number). Callers always seed a floor threshold at minScore 0,
// so a no-match is an invariant violation, not a normal case.
export function assignBand(score: number, thresholds: BandThreshold[]): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error(`invalid score: ${score}`)
  }
  if (thresholds.length === 0) throw new Error("no band thresholds")
  const sorted = [...thresholds].sort(
    (a, b) => b.minScore - a.minScore || a.band - b.band
  )
  for (const threshold of sorted) {
    if (score >= threshold.minScore) return threshold.band
  }
  throw new Error(`no band threshold matches score ${score}`)
}

// Derives the full result set. A role has a score and band only when EVERY
// model criterion is rated; partial ratings yield null score/band plus the
// rated/total counters. Output order follows input order.
export function computeResults(input: ComputeInput): RoleResult[] {
  assertUniqueCriteria(input.criteria)
  const criterionIds = new Set(
    input.criteria.map((criterion) => criterion.criterionId)
  )
  const totalCriteria = input.criteria.length
  return input.roles.map((role) => {
    const relevant = role.ratings.filter((rating) =>
      criterionIds.has(rating.criterionId)
    )
    // Completeness is distinct coverage: a duplicate must never let a role
    // pass the gate (or block it) by inflating the raw length.
    const ratedCount = countUnique(relevant)
    const complete = totalCriteria > 0 && ratedCount === totalCriteria
    const score = complete ? scoreRole(relevant, input.criteria) : null
    return {
      roleId: role.roleId,
      ratedCount,
      totalCriteria,
      complete,
      score,
      band: score === null ? null : assignBand(score, input.thresholds),
    }
  })
}

// Counts distinct criterion ids in a partial rating set. scoreRole already
// throws on duplicates for complete sets; partial sets must not over-count a
// duplicate either.
function countUnique(ratings: RatingInput[]): number {
  return new Set(ratings.map((rating) => rating.criterionId)).size
}
