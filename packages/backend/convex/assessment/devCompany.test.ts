import {
  assignBand,
  type RatingValue,
  scoreRole,
  type WeightPoints,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_WEIGHT_POINTS,
} from "../evaluationModel/standardTemplate"
import { DEV_COMPANY, RATINGS_BY_TITLE } from "./devCompany"

const THRESHOLDS = DEFAULT_BAND_THRESHOLDS.map((t) => ({
  band: t.band,
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
  return { score, band: assignBand(score, THRESHOLDS) }
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
    for (const title of ALL_TITLES) {
      const vector = RATINGS_BY_TITLE[title]
      expect(vector, `ratings for ${title}`).toBeDefined()
      expect(vector?.length).toBe(CRITERION_KEYS.length)
      for (const value of vector ?? []) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(5)
      }
    }
  })

  it("produces a real default-weight band spread with leadership on top", () => {
    const dist: Record<number, number> = {}
    const bandByTitle: Record<string, number> = {}
    for (const title of ALL_TITLES) {
      const { band } = evaluate(RATINGS_BY_TITLE[title] ?? [], DEFAULT_WEIGHTS)
      dist[band] = (dist[band] ?? 0) + 1
      bandByTitle[title] = band
    }
    console.log("default band distribution:", dist)
    // Spread across several bands, not all clustered in one.
    expect(Object.keys(dist).length).toBeGreaterThanOrEqual(4)
    // The CEO sits in the top (lowest-numbered) occupied band.
    const topBand = Math.min(...Object.keys(dist).map(Number))
    expect(bandByTitle.CEO).toBe(topBand)
  })

  it("re-weighting toward technical criteria moves the bands", () => {
    const ceoBase = evaluate(RATINGS_BY_TITLE.CEO ?? [], DEFAULT_WEIGHTS)
    const ceoTech = evaluate(RATINGS_BY_TITLE.CEO ?? [], TECH_WEIGHTS)
    const archBase = evaluate(
      RATINGS_BY_TITLE["Technical Solutions Architect"] ?? [],
      DEFAULT_WEIGHTS
    )
    const archTech = evaluate(
      RATINGS_BY_TITLE["Technical Solutions Architect"] ?? [],
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
    console.log("CEO", ceoBase, "->", ceoTech)
    console.log("Architect", archBase, "->", archTech)
    console.log("Developer", devBase, "->", devTech)

    // Default: the CEO outranks the deep-technical architect.
    expect(ceoBase.score).toBeGreaterThan(archBase.score)
    // Technical weighting drops the CEO and lifts the architect, so the
    // architect catches or overtakes the CEO.
    expect(ceoTech.score).toBeLessThan(ceoBase.score)
    expect(archTech.score).toBeGreaterThan(archBase.score)
    expect(archTech.score).toBeGreaterThanOrEqual(ceoTech.score)
    // A developer climbs at least one band under technical weighting.
    expect(devTech.band).toBeLessThan(devBase.band)
  })
})
