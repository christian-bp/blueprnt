import {
  LEVEL_RULES,
  ZONE_PROFILE_RULES,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
  placeRole,
  type RatingValue,
  scoreRole,
  type WeightPoints,
  ZONE_LEVEL_RANGES,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import {
  DEMO_ANCHOR_ROLES,
  DEMO_SELECTED_KEYS,
  DEMO_WEIGHT_POINTS,
  DEV_COMPANY,
  RATINGS_BY_TITLE,
} from "./devCompany"

const THRESHOLDS = LEVEL_RULES.map((t) => ({
  level: t.level,
  minScore: t.minScore,
}))
const ZONE_RULES = ZONE_PROFILE_RULES.map((rule) => ({
  zone: rule.zone,
  minStep: rule.minStep,
}))

// Score and place one role's rating vector under a weight map (libraryKey ->
// points), routing through the same scoreRole + placeRole pipeline
// deriveResults uses (zone profile capping included, not just the raw
// score-implied level), so this mirrors what getResults derives live.
function evaluate(ratings: readonly number[], weights: Record<string, number>) {
  const criteria = DEMO_SELECTED_KEYS.map((key) => ({
    criterionId: key as string,
    dimensionKey: LIBRARY_DIMENSION[key],
    weightPoints: (weights[key] ?? 0) as WeightPoints,
  }))
  const ratingInputs = DEMO_SELECTED_KEYS.map((key, i) => ({
    criterionId: key as string,
    value: (ratings[i] ?? 0) as RatingValue,
  }))
  const score = scoreRole(ratingInputs, criteria)
  const placement = placeRole({
    score,
    ratings: ratingInputs,
    criteria,
    levelRules: THRESHOLDS,
    zoneProfileRules: ZONE_RULES,
  })
  return {
    score,
    level: placement.level,
    zone: placement.zone,
    profileLimited: placement.profileLimited,
  }
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
    // The CEO tops the flat-weighted ladder, and at an ABSOLUTE level, not
    // merely at whichever level happens to be the highest occupied one. The
    // absolute pin is what catches a threshold retune moving the ceiling; a
    // top-occupied comparison derives the ceiling from the same distribution
    // it is checking and therefore holds no matter where the ladder moves.
    const topLevel = Math.min(...Object.keys(dist).map(Number))
    expect(levelByTitle.CEO).toBe(topLevel)
    expect(topLevel).toBe(2)
  })

  it("agrees with the engine on every anchor role's level", () => {
    // An anchor role's agreed level IS the calibration reference, so a seeded
    // demo whose own anchor deviates opens with an amber deviation badge and
    // the three-act anchor panel on a model nobody has touched. The agreed
    // level is a human judgement and the derived one moves with the ladder,
    // so the two can only stay together by being checked: a LEVEL_RULES
    // retune fails here and the fixture is re-agreed in the same change.
    const anchors = Object.entries(DEMO_ANCHOR_ROLES)
    expect(anchors.length).toBeGreaterThan(0)
    for (const [title, anchor] of anchors) {
      expect(ALL_TITLES, title).toContain(title)
      const { level } = evaluate(RATINGS_BY_TITLE[title] ?? [], DEMO_WEIGHTS)
      expect(anchor.expectedLevel, title).toBe(level)
    }
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
      2: 2,
      4: 6,
      5: 7,
      6: 3,
      7: 5,
      8: 8,
      9: 5,
      10: 2,
      11: 2,
    })
    expect(levelByTitle.CEO).toBe(2)
    expect(levelByTitle["Content Delivery Manager"]).toBe(5)
    expect(levelByTitle["Software Developer"]).toBe(8)
  })

  it("caps exactly the titles whose profile falls short of their weighting", () => {
    // complexity-ambiguity and scope-impact are the demo's only profile
    // criteria (weight >= 4, non-workingConditions) under DEMO_WEIGHT_POINTS;
    // zone A demands step 4 on both and zone B step 3. The three functional
    // heads share one rating vector: scope-impact 5 carries them to a
    // weighting of 82, which reaches zone A, while their complexity-ambiguity
    // of 3 does not, so placeRole holds them at zone B's top level. Head of
    // Finance is a functional head too and is NOT capped: its own vector
    // rates complexity 4, so zone A admits it. Account Manager is the zone-B
    // case of the same rule: 57 reaches zone B, its complexity-ambiguity of 2
    // does not, and it is held at zone C's top. That is the profile rule
    // doing its job (a high total alone must not buy a zone), and it is the
    // demo org's worked example of a placement a person is asked to look at.
    // Pinned by name so a rating or weight edit that silently starts or stops
    // capping a title is caught.
    const capped = ALL_TITLES.filter(
      (title) =>
        evaluate(RATINGS_BY_TITLE[title] ?? [], DEMO_WEIGHTS).profileLimited
    )
    expect(capped.sort()).toEqual([
      "Account Manager",
      "Head of HR",
      "Head of Product",
      "Head of Sales & Marketing",
    ])
    const heads = capped.filter((title) => title.startsWith("Head of"))
    for (const title of heads) {
      const { score, zone, level } = evaluate(
        RATINGS_BY_TITLE[title] ?? [],
        DEMO_WEIGHTS
      )
      expect(score, title).toBe(82)
      expect(zone, title).toBe("B")
      expect(level, title).toBe(4)
    }
    expect(
      evaluate(RATINGS_BY_TITLE["Account Manager"] ?? [], DEMO_WEIGHTS)
    ).toMatchObject({ score: 57, zone: "C", level: 7 })
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
    // Technical weighting taxes the CEO on both channels. On the total,
    // because knowledge-breadth is the CEO's one non-max rating and the
    // technical weighting puts weight 5 on it. On the profile, because the
    // flat baseline has no profile criteria at all while the technical
    // weighting makes all three knowledge/complexity criteria weight 5, and
    // zone A's step 4 then refuses that same non-max rating, so the CEO lands
    // at zone B's top. The architect's technical peak meanwhile lifts the
    // total enough to climb a level outright.
    expect(ceoTech.score).toBeLessThan(ceoBase.score)
    expect(ceoBase.profileLimited).toBe(false)
    expect(ceoTech.profileLimited).toBe(true)
    expect(ceoTech.level).toBe(ZONE_LEVEL_RANGES.B.from)
    expect(ceoTech.level).toBeGreaterThan(ceoBase.level)
    expect(archTech.score).toBeGreaterThan(archBase.score)
    expect(archTech.level).toBeLessThan(archBase.level)
    expect(archTech.score - archBase.score).toBeGreaterThan(
      ceoTech.score - ceoBase.score
    )
    // A developer climbs at least one level under technical weighting.
    expect(devTech.level).toBeLessThan(devBase.level)
  })
})
