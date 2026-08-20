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
