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
