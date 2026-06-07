import { WEIGHT_POINT_VALUES } from "@workspace/core"

// Weight-point options for selects, heaviest first.
export const WEIGHT_POINT_OPTIONS = [...WEIGHT_POINT_VALUES].reverse()

// The derived percent share of one criterion (ADR-0004): weight points over
// the model's point sum. Display only, never an input; one decimal matches
// the source document's tables (18,5 % etc.).
export function formatShare(
  points: number,
  totalPoints: number,
  locale: string
): string {
  if (totalPoints <= 0) return ""
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(points / totalPoints)
}
