import { TRACK_SENIORITIES } from "@workspace/constants"

// One person's dot in the pay-comparison chart, mirroring the point shape the
// getRolePayComparison query returns. Amounts are FTE-adjusted (basic +
// variable = amount); displayName lets the tooltip label the person.
export type PayComparisonPoint = {
  publicId: string
  displayName: string
  gender: "Man" | "Kvinna"
  seniority: string
  basic: number
  variable: number
  amount: number
  payYear: number
  isSelf: boolean
}

// Orders the pay-comparison chart's seniority rows. seniorities[0] is the TOP
// row: the track ladder reversed (TRACK_SENIORITIES is lowest-first), then any
// off-ladder seniority strings (data drift) appended in encounter order so no
// point is silently dropped. Each point gets its row index for the chart's
// numeric y axis. Generic over the point so it stays coupled only to
// `seniority`, not the full point shape.
export function buildPayComparisonRows<T extends { seniority: string }>(
  trackKey: string | undefined,
  points: ReadonlyArray<T>
): { seniorities: string[]; data: Array<T & { row: number }> } {
  const ladder =
    trackKey !== undefined
      ? (TRACK_SENIORITIES[trackKey as keyof typeof TRACK_SENIORITIES] ?? [])
      : []
  const seniorities = [...ladder].reverse()
  for (const point of points) {
    if (!seniorities.includes(point.seniority)) {
      seniorities.push(point.seniority)
    }
  }
  return {
    seniorities,
    data: points.map((point) => ({
      ...point,
      row: seniorities.indexOf(point.seniority),
    })),
  }
}
