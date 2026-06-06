import type {
  BandThreshold,
  CriterionWeight,
  RatingInput,
  RatingValue,
} from "./types"

// The standard template importance mix (standardmall.md): weights sum to 108,
// so an all-5 role scores 540.
export const STANDARD_CRITERIA: CriterionWeight[] = [
  { criterionId: "scope", importanceLevel: 7 },
  { criterionId: "risk", importanceLevel: 6 },
  { criterionId: "complexity", importanceLevel: 5 },
  { criterionId: "autonomy", importanceLevel: 4 },
  { criterionId: "stakeholders", importanceLevel: 3 },
  { criterionId: "knowledge", importanceLevel: 3 },
  { criterionId: "financial", importanceLevel: 3 },
  { criterionId: "people", importanceLevel: 2 },
  { criterionId: "formal", importanceLevel: 1 },
]

export const STANDARD_THRESHOLDS: BandThreshold[] = [
  { band: 1, minScore: 530 },
  { band: 2, minScore: 450 },
  { band: 3, minScore: 400 },
  { band: 4, minScore: 340 },
  { band: 5, minScore: 285 },
  { band: 6, minScore: 220 },
  { band: 7, minScore: 0 },
]

export function allRated(value: RatingValue): RatingInput[] {
  return STANDARD_CRITERIA.map((criterion) => ({
    criterionId: criterion.criterionId,
    value,
  }))
}
