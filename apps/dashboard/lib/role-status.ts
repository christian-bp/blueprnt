// Badge variant per role status: approved reads as settled, inReview as
// attention, draft as neutral.
export function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" {
  if (status === "approved") return "default"
  if (status === "inReview") return "secondary"
  return "outline"
}
