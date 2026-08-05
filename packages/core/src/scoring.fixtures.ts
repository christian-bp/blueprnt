import type {
  CriterionWeight,
  LevelThreshold,
  RatingInput,
  RatingValue,
} from "./types"

// The standard template allocation (standardmall.md): 9 criteria, point
// budget 27, exactly balanced. Order matches the template's display order.
export const STANDARD_CRITERIA: CriterionWeight[] = [
  { criterionId: "scope", weightPoints: 5 },
  { criterionId: "complexity", weightPoints: 4 },
  { criterionId: "autonomy", weightPoints: 4 },
  { criterionId: "risk", weightPoints: 3 },
  { criterionId: "knowledge", weightPoints: 3 },
  { criterionId: "stakeholders", weightPoints: 3 },
  { criterionId: "financial", weightPoints: 2 },
  { criterionId: "people", weightPoints: 2 },
  { criterionId: "formal", weightPoints: 1 },
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
