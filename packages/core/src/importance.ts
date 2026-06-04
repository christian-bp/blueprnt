// The fixed 7-level importance scale (betydelseskala). HR always picks a
// label on this scale; the numeric weight is internal and never shown to
// users. See docs/contexts/evaluation-model/standardmall.md.
export const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const

export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number]

export const IMPORTANCE_SCALE: Readonly<Record<ImportanceLevel, number>> = {
  1: 8,
  2: 10,
  3: 11,
  4: 12,
  5: 13,
  6: 14,
  7: 18,
}

export function weightForImportance(level: ImportanceLevel): number {
  return IMPORTANCE_SCALE[level]
}
