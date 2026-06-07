import { isWeightPoints, pointBudget } from "@workspace/core"

// Pure weighting helpers (ADR-0004). LLMs are unreliable at exact-sum
// constraints, so drafted allocations are deterministically repaired to the
// point budget, and weight-review moves are validated as zero-sum transfers
// before they reach the suggestion store. The same repair walk also
// redistributes the difference when a criterion is removed
// (evaluationModel/criteria.ts).

// Clamps every value into the 1-5 scale and walks the sum to the exact
// budget: pull the current maximum down while over budget, push the current
// minimum up while under. When over budget the average exceeds 3, so the
// maximum is at least 4 and never drops below 3 (symmetrically when under),
// keeping every value in range. Ties resolve to the first index (stable,
// deterministic). An already-balanced allocation passes through unchanged.
export function repairDraftWeights(raw: number[]): number[] {
  const points = raw.map((value) => Math.min(5, Math.max(1, Math.round(value))))
  const budget = pointBudget(points.length)
  let delta = points.reduce((sum, value) => sum + value, 0) - budget
  while (delta > 0) {
    const max = Math.max(...points)
    points[points.indexOf(max)] = max - 1
    delta -= 1
  }
  while (delta < 0) {
    const min = Math.min(...points)
    points[points.indexOf(min)] = min + 1
    delta += 1
  }
  return points
}

export interface WeightMove {
  fromCriterionId: string
  toCriterionId: string
  points: number
  motivation: string
}

// Keeps only moves that are individually applicable against the given
// allocation snapshot: both ids exist, the ids differ, and the transfer
// keeps both criteria within 1-5. Moves that stack on the same criterion can
// individually pass here and still jointly breach a bound; the confirm
// mutation re-checks cumulatively at apply time and skips the breaching move.
export function applicableMoves(
  moves: WeightMove[],
  criteria: { criterionId: string; weightPoints: number }[]
): WeightMove[] {
  const pointsById = new Map(
    criteria.map((criterion) => [criterion.criterionId, criterion.weightPoints])
  )
  return moves.filter((move) => {
    if (move.fromCriterionId === move.toCriterionId) return false
    if (!Number.isInteger(move.points) || move.points < 1) return false
    const from = pointsById.get(move.fromCriterionId)
    const to = pointsById.get(move.toCriterionId)
    if (from === undefined || to === undefined) return false
    if (!isWeightPoints(from - move.points)) return false
    if (!isWeightPoints(to + move.points)) return false
    return true
  })
}

// Each criterion may take part in at most ONE move (first wins). Stacked
// moves render misleading numbers (every card shows the same snapshot while
// the truth is cumulative) and read as duplicated suggestions; keeping the
// moves disjoint makes every card's numbers exact regardless of which subset
// the reviewer confirms.
export function distinctMoves(moves: WeightMove[]): WeightMove[] {
  const used = new Set<string>()
  return moves.filter((move) => {
    if (used.has(move.fromCriterionId) || used.has(move.toCriterionId)) {
      return false
    }
    used.add(move.fromCriterionId)
    used.add(move.toCriterionId)
    return true
  })
}
