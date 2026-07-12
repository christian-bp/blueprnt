import { TRACK_LEVELS } from "@workspace/constants"

// One person's dot in the pay-comparison chart, mirroring the point shape the
// getRolePayComparison query returns. Amounts are FTE-adjusted (basic +
// variable = amount); displayName lets the tooltip label the person.
export type PayComparisonPoint = {
  publicId: string
  displayName: string
  gender: "Man" | "Kvinna"
  level: string
  basic: number
  variable: number
  amount: number
  payYear: number
  isSelf: boolean
}

// Orders the pay-comparison chart's level rows. levels[0] is the TOP row:
// the track ladder reversed (TRACK_LEVELS is lowest-first), then any
// off-ladder level strings (data drift) appended in encounter order so no
// point is silently dropped. Each point gets its row index for the chart's
// numeric y axis. Generic over the point so it stays coupled only to `level`,
// not the full point shape.
export function buildPayComparisonRows<T extends { level: string }>(
  trackKey: string | undefined,
  points: ReadonlyArray<T>
): { levels: string[]; data: Array<T & { row: number }> } {
  const ladder =
    trackKey !== undefined
      ? (TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? [])
      : []
  const levels = [...ladder].reverse()
  for (const point of points) {
    if (!levels.includes(point.level)) levels.push(point.level)
  }
  return {
    levels,
    data: points.map((point) => ({
      ...point,
      row: levels.indexOf(point.level),
    })),
  }
}
