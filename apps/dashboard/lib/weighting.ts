// The same derivation as a fraction, for the surfaces that render it through
// NumberFlow (which needs the number, not a formatted string) rather than as
// text. One source, so a criterion's own share and its dimension's share can
// never be computed two different ways.
export function shareFraction(points: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0
  return points / totalPoints
}

// The Intl options the shares are formatted with wherever they render, kept
// here beside shareFraction so every NumberFlow surface rounds the same way.
// One decimal matches the source document's tables (18,5 % etc.).
export const SHARE_FORMAT = {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const

// The dimension headings round to whole points: a heading is a balance
// reading ("is one dimension dominating?"), not a figure anyone reconciles.
export const DIMENSION_SHARE_FORMAT = {
  style: "percent",
  maximumFractionDigits: 0,
} as const

// Which criterion a DIMENSION's weight motivation is written on.
//
// The engine stores no model-level motivation: validateMethod clears
// dimensionWeightBalance for a dimension as soon as any criterion in it carries
// a weightMotivation, so a surface answering a warning about the dimension has
// to choose one of its criteria to carry the text. The heaviest is the honest
// choice: the share being questioned mostly consists of it, so the sentence
// explaining that share belongs on it and reads correctly in the method
// appendix, where the motivation appears under its criterion's name.
//
// Ties go to display order, which is the order the reader sees the column in,
// so the same click always writes to the same criterion. Weights are the STORED
// ones, never an unsaved draft: the warning is about the allocation the engine
// validated, and picking a target from a draft could land the text on a
// criterion that is not the heaviest once the draft is saved (or discarded).
export function weightMotivationTarget<
  T extends { weightPoints: number; order: number },
>(criteria: readonly T[]): T | undefined {
  return criteria.reduce<T | undefined>((heaviest, criterion) => {
    if (heaviest === undefined) return criterion
    if (criterion.weightPoints > heaviest.weightPoints) return criterion
    if (
      criterion.weightPoints === heaviest.weightPoints &&
      criterion.order < heaviest.order
    ) {
      return criterion
    }
    return heaviest
  }, undefined)
}
