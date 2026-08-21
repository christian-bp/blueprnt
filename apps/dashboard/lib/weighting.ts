// The same derivation as a fraction, for the surfaces that render it through
// NumberFlow (which needs the number, not a formatted string) rather than as
// text. One source, so a criterion's own share and its dimension's share can
// never be computed two different ways.
export function shareFraction(points: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0
  return points / totalPoints
}

// The Intl options EVERY share is formatted with, kept here beside
// shareFraction so the figure and its rounding come from one place.
//
// Whole percent, at both levels. A share is a balance reading ("is one
// dimension dominating?", "how much does this criterion count?"), not a figure
// anyone reconciles: the decimal it used to carry on the criterion line
// invited exactly that reconciling, and it read as a different KIND of number
// from the whole percent in the dimension heading directly above it.
//
// Rounded shares need not sum to exactly 100, and that is accepted: the
// allocation itself is the weight POINTS, which always sum to the budget
// exactly (ADR-0004), and the percent is a derived display value on top of
// them. Never present these figures as an audited total.
export const SHARE_FORMAT = {
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
