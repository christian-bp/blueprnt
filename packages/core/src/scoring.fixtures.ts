import type {
  BandThreshold,
  CriterionWeight,
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
export const STANDARD_THRESHOLDS: BandThreshold[] = [
  { band: 1, minScore: 98 },
  { band: 2, minScore: 83 },
  { band: 3, minScore: 74 },
  { band: 4, minScore: 63 },
  { band: 5, minScore: 53 },
  { band: 6, minScore: 41 },
  { band: 7, minScore: 0 },
]

export function allRated(value: RatingValue): RatingInput[] {
  return STANDARD_CRITERIA.map((criterion) => ({
    criterionId: criterion.criterionId,
    value,
  }))
}
