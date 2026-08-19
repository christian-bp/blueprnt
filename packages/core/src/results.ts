import { assertUniqueCriteria, scoreRole } from "./scoring"
import type { ComputeInput, RatingInput, RoleResult } from "./types"
import { placeRole } from "./zones"

// Derives the full result set. A role has a score, level, and zone only when
// EVERY model criterion is rated; partial ratings yield null score/level/
// zone/profileLimited/profileFailures plus the rated/total counters. Output
// order follows input order. Level and zone always come from placeRole
// (zones.ts): the profile rules may only ever cap a placement, never lift it
// above the score-implied level.
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
    if (!complete) {
      return {
        roleId: role.roleId,
        ratedCount,
        totalCriteria,
        complete,
        score: null,
        level: null,
        zone: null,
        profileLimited: null,
        profileFailures: null,
      }
    }
    const score = scoreRole(relevant, input.criteria)
    const placement = placeRole({
      score,
      ratings: relevant,
      criteria: input.criteria,
      levelRules: input.thresholds,
      zoneProfileRules: input.zoneProfileRules,
    })
    return {
      roleId: role.roleId,
      ratedCount,
      totalCriteria,
      complete,
      score,
      level: placement.level,
      zone: placement.zone,
      profileLimited: placement.profileLimited,
      profileFailures: placement.profileFailures,
    }
  })
}

// Counts distinct criterion ids in a partial rating set. scoreRole already
// throws on duplicates for complete sets; partial sets must not over-count a
// duplicate either.
function countUnique(ratings: RatingInput[]): number {
  return new Set(ratings.map((rating) => rating.criterionId)).size
}
