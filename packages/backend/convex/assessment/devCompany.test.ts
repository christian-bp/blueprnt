import {
  assignLevel,
  type RatingValue,
  scoreRole,
  type WeightPoints,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERION_KEYS,
  DEFAULT_LEVEL_THRESHOLDS,
  DEFAULT_WEIGHT_POINTS,
} from "../evaluationModel/standardTemplate"
import { DEV_COMPANY, RATINGS_BY_TITLE } from "./devCompany"

const THRESHOLDS = DEFAULT_LEVEL_THRESHOLDS.map((t) => ({
  level: t.level,
  minScore: t.minScore,
}))

// Score one role's rating vector under a weight map (criterionKey -> points),
// using the real engine so this mirrors what getResults derives live.
function evaluate(ratings: readonly number[], weights: Record<string, number>) {
  const criteria = CRITERION_KEYS.map((key) => ({
    criterionId: key as string,
    weightPoints: (weights[key] ?? 0) as WeightPoints,
  }))
  const ratingInputs = CRITERION_KEYS.map((key, i) => ({
    criterionId: key as string,
    value: (ratings[i] ?? 0) as RatingValue,
  }))
  const score = scoreRole(ratingInputs, criteria)
  return { score, level: assignLevel(score, THRESHOLDS) }
}

const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(
  CRITERION_KEYS.map((key) => [key, DEFAULT_WEIGHT_POINTS[key]])
)

// A technical-heavy reweighting within the fixed point budget (sum 27):
// complexity + knowledge maxed, the rest trimmed.
const TECH_WEIGHTS: Record<string, number> = {
  scope: 3,
  complexity: 5,
  autonomy: 3,
  risk: 2,
  knowledge: 5,
  stakeholders: 2,
  financial: 2,
  people: 2,
  formal: 3,
}

const ALL_TITLES = DEV_COMPANY.flatMap((f) => f.roles.map((r) => r.title))

describe("devCompany ratings", () => {
  it("has a 0-5 ratings vector of length 9 for every role", () => {
    // Both directions: every title has a vector, no orphan vectors linger for
    // renamed/removed titles, and duplicate titles would break the equality.
    expect(Object.keys(RATINGS_BY_TITLE).sort()).toEqual([...ALL_TITLES].sort())
    for (const title of ALL_TITLES) {
      const vector = RATINGS_BY_TITLE[title]
      expect(vector, `ratings for ${title}`).toBeDefined()
      expect(vector?.length).toBe(CRITERION_KEYS.length)
      for (const value of vector ?? []) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(5)
      }
    }
  })

  it("produces a real default-weight level spread with leadership on top", () => {
    const dist: Record<number, number> = {}
    const levelByTitle: Record<string, number> = {}
    for (const title of ALL_TITLES) {
      const { level } = evaluate(RATINGS_BY_TITLE[title] ?? [], DEFAULT_WEIGHTS)
      dist[level] = (dist[level] ?? 0) + 1
      levelByTitle[title] = level
    }
    // Spread across several levels, not all clustered in one.
    expect(Object.keys(dist).length).toBeGreaterThanOrEqual(4)
    // The demo reaches the actual top level, and the CEO is what sits there;
    // pinning the absolute level (not just "top occupied") catches a retune
    // that silently empties level 1.
    expect(levelByTitle.CEO).toBe(1)
    expect(dist[1]).toBeGreaterThanOrEqual(1)
  })

  it("re-weighting toward technical criteria moves the levels", () => {
    const ceoBase = evaluate(RATINGS_BY_TITLE.CEO ?? [], DEFAULT_WEIGHTS)
    const ceoTech = evaluate(RATINGS_BY_TITLE.CEO ?? [], TECH_WEIGHTS)
    const archBase = evaluate(
      RATINGS_BY_TITLE["Cloud Architect"] ?? [],
      DEFAULT_WEIGHTS
    )
    const archTech = evaluate(
      RATINGS_BY_TITLE["Cloud Architect"] ?? [],
      TECH_WEIGHTS
    )
    const devBase = evaluate(
      RATINGS_BY_TITLE["Software Developer"] ?? [],
      DEFAULT_WEIGHTS
    )
    const devTech = evaluate(
      RATINGS_BY_TITLE["Software Developer"] ?? [],
      TECH_WEIGHTS
    )
    // Default: the CEO outranks the complexity/knowledge-peaked architect.
    expect(ceoBase.score).toBeGreaterThan(archBase.score)
    // Technical weighting moves the two in opposite directions: the CEO dips
    // (extra weight lands on formal, the CEO's single non-max criterion) while
    // the architect's technical peak rises.
    expect(ceoTech.score).toBeLessThan(ceoBase.score)
    expect(archTech.score).toBeGreaterThan(archBase.score)
    // A developer climbs at least one level under technical weighting.
    expect(devTech.level).toBeLessThan(devBase.level)
  })
})
