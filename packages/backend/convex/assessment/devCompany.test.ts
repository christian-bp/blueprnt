import {
  assignLevel,
  DEFAULT_LEVEL_RULES,
  type RatingValue,
  scoreRole,
  type WeightPoints,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
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
  "people-leadership": 1,
}

const ALL_TITLES = DEV_COMPANY.flatMap((f) => f.roles.map((r) => r.title))

describe("devCompany ratings", () => {
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
      3: 1,
      4: 3,
      6: 2,
      7: 6,
      8: 6,
      9: 4,
      10: 13,
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
    // Technical weighting moves the two in opposite directions: the CEO dips
    // (extra weight lands on knowledge-breadth, the CEO's single non-max
    // criterion) while the architect's technical peak rises.
    expect(ceoTech.score).toBeLessThan(ceoBase.score)
    expect(archTech.score).toBeGreaterThan(archBase.score)
    // A developer climbs at least one level under technical weighting.
    expect(devTech.level).toBeLessThan(devBase.level)
  })
})
