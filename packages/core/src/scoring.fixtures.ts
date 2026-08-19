import type {
  CriterionWeight,
  LevelThreshold,
  RatingInput,
  RatingValue,
} from "./types"

// The standard template allocation (standardmall.md): 9 criteria, point
// budget 27, exactly balanced. Order matches the template's display order.
// dimensionKey is a plausible constitutional-dimension tag for each generic
// criterion name; scoreRole/criterionShares never read it, only placeRole's
// profile gating does (results.test.ts exercises that path separately).
export const STANDARD_CRITERIA: CriterionWeight[] = [
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

// Default thresholds on the normalized 0-100 scale (standardmall.md).
export const STANDARD_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minScore: 98 },
  { level: 2, minScore: 83 },
  { level: 3, minScore: 74 },
  { level: 4, minScore: 63 },
  { level: 5, minScore: 53 },
  { level: 6, minScore: 41 },
  { level: 7, minScore: 0 },
]

export function allRated(value: RatingValue): RatingInput[] {
  return STANDARD_CRITERIA.map((criterion) => ({
    criterionId: criterion.criterionId,
    value,
  }))
}
