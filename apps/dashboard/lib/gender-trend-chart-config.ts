import type { ChartConfig } from "@workspace/ui/components/chart"
import type { useFormatter } from "next-intl"
import { GenderMenIcon, type GenderSeries } from "@/components/gender-mark"
import type { HeadcountPoint } from "@/lib/headcount-trend"
import type { PayGapPoint } from "@/lib/pay-gap-trend"

// Shared by OverviewCharts (overview-widgets.tsx) and AssistantChartPart, so
// the dashboard and the in-chat chart can never draw the headcount/gap
// trends with different colors, labels, or date formatting for the same
// underlying rows.
//
// Kept pure and hook-free on purpose: callers pass in their own already
// resolved translations and a date formatter (next-intl's
// `useFormatter().dateTime`) rather than this module calling next-intl
// itself, so it stays a plain, testable function with no provider to set up.
// Typed off useFormatter itself (rather than the global Intl.DateTimeFormatOptions)
// because use-intl's own options type is narrower (e.g. `timeZoneName` drops
// a few of Intl's values), so a plain Intl-typed parameter rejects the real
// `format.dateTime` the callers pass in.
type FormatDate = ReturnType<typeof useFormatter>["dateTime"]

export type HeadcountTrendRow = {
  label: string
  caption: string
  women: number
  men: number
}

export type GapTrendRow = {
  label: string
  caption: string
  gapPct: number | null
}

export function headcountChartConfig(
  labels: Record<GenderSeries, string>
): ChartConfig {
  return {
    women: { label: labels.women, color: "var(--gender-woman)" },
    men: {
      label: labels.men,
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
  } satisfies ChartConfig
}

export function gapChartConfig(gapLabel: string): ChartConfig {
  return {
    gapPct: { label: gapLabel, color: "var(--brand)" },
  } satisfies ChartConfig
}

export function toHeadcountTrendRows(
  points: readonly HeadcountPoint[],
  formatDate: FormatDate
): HeadcountTrendRow[] {
  return points.map((point) => ({
    label: point.runLabel,
    caption: formatDate(new Date(point.date), { dateStyle: "medium" }),
    women: point.women,
    men: point.men,
  }))
}

export function toGapTrendRows(
  points: readonly PayGapPoint[],
  formatDate: FormatDate
): GapTrendRow[] {
  return points.map((point) => ({
    label: point.runLabel,
    caption: formatDate(new Date(point.date), { dateStyle: "medium" }),
    gapPct: point.gapPct,
  }))
}
