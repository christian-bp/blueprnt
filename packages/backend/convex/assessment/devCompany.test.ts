import {
  assignLevel,
  DEFAULT_LEVEL_RULES,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
  type RatingValue,
  scoreRole,
  type WeightPoints,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import {
  DEMO_SELECTED_KEYS,
  DEMO_WEIGHT_POINTS,
  DEV_COMPANY,
  RATINGS_BY_TITLE,
} from "./devCompany"

const THRESHOLDS = DEFAULT_LEVEL_RULES.map((t) => ({
  level: t.level,
  minScore: t.minScore,
}))

// Score one role's rating vector under a weight map (libraryKey -> points),
// using the real engine so this mirrors what getResults derives live.
function evaluate(ratings: readonly number[], weights: Record<string, number>) {
  const criteria = DEMO_SELECTED_KEYS.map((key) => ({
    criterionId: key as string,
    weightPoints: (weights[key] ?? 0) as WeightPoints,
  }))
  const ratingInputs = DEMO_SELECTED_KEYS.map((key, i) => ({
    criterionId: key as string,
    value: (ratings[i] ?? 0) as RatingValue,
  }))
  const score = scoreRole(ratingInputs, criteria)
  return { score, level: assignLevel(score, THRESHOLDS) }
}

// The neutral baseline: every activated criterion enters at 3 (ADR-0004),
// and this demo fixture never rebalances the baseline scenario itself.
const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(
  DEMO_SELECTED_KEYS.map((key) => [key, 3])
)

// The calibrated weighting the seed applies to the demo org (what the seeded
// results/level view actually renders under).
const DEMO_WEIGHTS: Record<string, number> = Object.fromEntries(
  DEMO_SELECTED_KEYS.map((key) => [key, DEMO_WEIGHT_POINTS[key]])
)

// A technical-heavy reweighting: complexity + both knowledge criteria
// maxed, everything else trimmed to the floor. knowledge-breadth is the
// CEO's one non-max rating (3 vs 5 everywhere else), so weighting it up
// alongside the genuinely technical criteria taxes the CEO specifically
// while lifting technical profiles (Cloud Architect, Software Developer).
const TECH_WEIGHTS: Record<string, number> = {
  "knowledge-depth": 5,
  "knowledge-breadth": 5,
  "complexity-ambiguity": 5,
  "communication-effort": 1,
  "scope-impact": 1,
  "autonomy-mandate": 1,
  "risk-consequence": 1,
  "on-call": 1,
}

const ALL_TITLES = DEV_COMPANY.flatMap((f) => f.roles.map((r) => r.title))

describe("devCompany ratings", () => {
  it("keeps the demo selection within every dimension's cap", () => {
    // The seed writes DEMO_SELECTED_KEYS directly (bypassing
    // activateCriterion's own runtime checks, like every other seed write),
    // so nothing enforces DIMENSION_MAX_ACTIVE or the model-wide 6-8 bound on
    // this fixture except this test. A selection that violates either would
    // still seed successfully (raw insert, no validation) and only surface
    // as a silently-uncappable demo model.
    expect(DEMO_SELECTED_KEYS.length).toBeGreaterThanOrEqual(MODEL_MIN_CRITERIA)
    expect(DEMO_SELECTED_KEYS.length).toBeLessThanOrEqual(MODEL_MAX_CRITERIA)
    const countByDimension: Record<DimensionKey, number> = {
      competence: 0,
      effort: 0,
      responsibility: 0,
      workingConditions: 0,
    }
    for (const key of DEMO_SELECTED_KEYS) {
      countByDimension[LIBRARY_DIMENSION[key]] += 1
    }
    for (const [dimension, count] of Object.entries(countByDimension)) {
      expect(count, dimension).toBeLessThanOrEqual(
        DIMENSION_MAX_ACTIVE[dimension as DimensionKey]
      )
    }
  })

  it("has a 1-5 ratings vector of length 8 for every role", () => {
    // Both directions: every title has a vector, no orphan vectors linger for
    // renamed/removed titles, and duplicate titles would break the equality.
    expect(Object.keys(RATINGS_BY_TITLE).sort()).toEqual([...ALL_TITLES].sort())
    for (const title of ALL_TITLES) {
      const vector = RATINGS_BY_TITLE[title]
      expect(vector, `ratings for ${title}`).toBeDefined()
      expect(vector?.length).toBe(DEMO_SELECTED_KEYS.length)
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
    // The demo reaches its actual top level under flat weighting, and the CEO
    // is what sits there; pinning the absolute level (not just "top
    // occupied") catches a retune that silently moves the ceiling.
    const topLevel = Math.min(...Object.keys(dist).map(Number))
    expect(levelByTitle.CEO).toBe(topLevel)
    expect(dist[topLevel]).toBeGreaterThanOrEqual(1)
  })

  it("keeps the demo weight points on the exact point budget", () => {
    const total = Object.values(DEMO_WEIGHT_POINTS).reduce((s, p) => s + p, 0)
    expect(total).toBe(DEMO_SELECTED_KEYS.length * 3)
  })

  it("reproduces the calibrated demo ladder under the demo weights", () => {
    const dist: Record<number, number> = {}
    const levelByTitle: Record<string, number> = {}
    for (const title of ALL_TITLES) {
      const { level } = evaluate(RATINGS_BY_TITLE[title] ?? [], DEMO_WEIGHTS)
      dist[level] = (dist[level] ?? 0) + 1
      levelByTitle[title] = level
    }
    // The exact ladder the calibrated demo weighting produces on the new
    // 8-criterion, 12-level scale; a drift in any rating vector or weight
    // point breaks this.
    expect(dist).toEqual({
      2: 1,
      4: 1,
      5: 3,
      6: 2,
      7: 6,
      8: 6,
      9: 6,
      10: 11,
      11: 3,
      12: 1,
    })
    expect(levelByTitle.CEO).toBe(2)
    expect(levelByTitle["Content Delivery Manager"]).toBe(7)
    expect(levelByTitle["Software Developer"]).toBe(10)
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
    // Technical weighting narrows the gap rather than inverting it: the CEO
    // is also maxed on two of the three heavily-weighted criteria, so the
    // CEO's score still edges up, but not enough to cross a level boundary,
    // while the architect's technical peak rises far more and climbs a
    // level outright.
    expect(ceoTech.level).toBe(ceoBase.level)
    expect(archTech.score).toBeGreaterThan(archBase.score)
    expect(archTech.level).toBeLessThan(archBase.level)
    expect(archTech.score - archBase.score).toBeGreaterThan(
      ceoTech.score - ceoBase.score
    )
    // A developer climbs at least one level under technical weighting.
    expect(devTech.level).toBeLessThan(devBase.level)
  })
})
