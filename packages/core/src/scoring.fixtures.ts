import type {
  CriterionWeight,
  LevelThreshold,
  RatingInput,
  RatingValue,
} from "./types"

// A synthetic allocation for exercising the scoring arithmetic: 9 criteria,
// point budget 27, exactly balanced. Deliberately NOT the product's own model,
// which ADR-0021 caps at 8 criteria; the engine imposes no count of its own, so
// a wider spread makes the share and rounding goldens more revealing.
// dimensionKey is a plausible constitutional-dimension tag for each generic
// criterion name; scoreRole/criterionShares never read it, only placeRole's
// profile gating does (results.test.ts exercises that path separately).
export const FIXTURE_CRITERIA: CriterionWeight[] = [
  { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 5 },
  { criterionId: "complexity", dimensionKey: "effort", weightPoints: 4 },
  { criterionId: "autonomy", dimensionKey: "responsibility", weightPoints: 4 },
  { criterionId: "risk", dimensionKey: "responsibility", weightPoints: 3 },
  { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
  { criterionId: "stakeholders", dimensionKey: "effort", weightPoints: 3 },
  { criterionId: "financial", dimensionKey: "responsibility", weightPoints: 2 },
  { criterionId: "people", dimensionKey: "responsibility", weightPoints: 2 },
  { criterionId: "formal", dimensionKey: "competence", weightPoints: 1 },
]

// A synthetic ladder on the normalized 0-100 scale, for exercising assignLevel
// and computeResults. Deliberately NOT the product's ladder, which ADR-0022
// fixes at twelve levels in four zones: the engine takes any strictly
// decreasing set floored at 0, and a shorter one keeps these goldens readable.
// The real defaults are DEFAULT_LEVEL_RULES (zones.ts), covered in
// scoring.test.ts against their own boundaries.
export const FIXTURE_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minScore: 98 },
  { level: 2, minScore: 83 },
  { level: 3, minScore: 74 },
  { level: 4, minScore: 63 },
  { level: 5, minScore: 53 },
  { level: 6, minScore: 41 },
  { level: 7, minScore: 0 },
]

export function allRated(value: RatingValue): RatingInput[] {
  return FIXTURE_CRITERIA.map((criterion) => ({
    criterionId: criterion.criterionId,
    value,
  }))
}
