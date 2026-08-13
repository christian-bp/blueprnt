"use client"

import { BarChartHorizontalIcon } from "@hugeicons/core-free-icons"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import { PanelCard } from "@/components/panel-card"
import {
  type AiUsageOrgRow,
  formatUsd,
  kindCounts,
  nanosToUsd,
} from "@/lib/admin-ai-usage"
import {
  BAR_RADIUS,
  CHART_AXIS_FONT_SIZE,
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  RANKED_BAR_ROW_HEIGHT_PX,
  TOOLTIP_APPEAR,
} from "@/lib/chart-style"

// Rows sized to a fixed number of "empty" bar-heights while loading or empty,
// so the panel holds one height across all three states (loading, empty,
// ready) instead of resizing once the row count is known.
const PLACEHOLDER_ROWS = 3

interface ChartRow {
  orgId: string
  orgName: string
  costNanos: number
  costUsd: number
  callCount: number
  totalTokens: number
  byKind: Record<string, number>
  isOutlier: boolean
}

type ChartT = ReturnType<
  typeof useTranslations<"dashboard.admin.aiUsage.chart">
>

// The chart's custom hover: one org's cost, calls, tokens, and kind split.
// ChartTooltipContent's anatomy is a legend row per SERIES; this chart draws
// one bar per ORG, so there is no series to label and every figure instead
// gets its own row. Styled to match ChartTooltipContent's own container
// (border/background/shadow, CHART_TOOLTIP_TEXT, TOOLTIP_APPEAR) so every
// chart's hover still reads as the same hover, only the content differs.
function UsageTooltip({
  active,
  payload,
  locale,
  t,
  format,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
  locale: string
  t: ChartT
  format: ReturnType<typeof useFormatter>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const kinds = kindCounts(row.byKind)

  return (
    <div
      className={cn(
        "min-w-48 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 shadow-xl",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      <div className="font-medium">{row.orgName}</div>
      <div className="mt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("tooltipCost")}</span>
          <span className="font-mono tabular-nums">
            {formatUsd(row.costUsd, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("tooltipCalls")}</span>
          <span className="font-mono tabular-nums">
            {format.number(row.callCount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("tooltipTokens")}</span>
          <span className="font-mono tabular-nums">
            {format.number(row.totalTokens)}
          </span>
        </div>
      </div>
      {kinds.length > 0 && (
        <div className="mt-1.5 border-border/50 border-t pt-1.5 text-muted-foreground">
          {kinds.map((k) => `${k.kind} ${format.number(k.count)}`).join(" · ")}
        </div>
      )}
    </div>
  )
}

// The overview's big chart: one horizontal bar per org, sorted by cost
// descending, full-width PanelCard (design doc item 2). An outlier bar
// (`outliers`, computed once by the section from lib/admin-ai-usage.ts so
// this chart and the table below it can never disagree) renders in
// --flag-elevated instead of the house --chart-1 ink; the caption under the
// chart states the rule in words so the flag is never a mystery. Sizes
// itself to the row count (RANKED_BAR_ROW_HEIGHT_PX) rather than a single
// fixed height, so two orgs and fifty both stay legible.
export function AiUsageChart({
  rows,
  outliers,
}: {
  rows: AiUsageOrgRow[] | undefined
  outliers: Set<string>
}) {
  const t = useTranslations("dashboard.admin.aiUsage.chart")
  const tPage = useTranslations("dashboard.admin.aiUsage")
  const format = useFormatter()
  const locale = useLocale()

  const config = { cost: { label: t("costSeries") } } satisfies ChartConfig

  const data: ChartRow[] = (rows ?? [])
    .slice()
    .sort((a, b) => b.costNanos - a.costNanos)
    .map((row) => ({
      orgId: row.orgId,
      orgName: row.orgName,
      costNanos: row.costNanos,
      costUsd: nanosToUsd(row.costNanos),
      callCount: row.callCount,
      totalTokens: row.totalTokens,
      byKind: row.byKind,
      isOutlier: outliers.has(row.orgId),
    }))

  const loading = rows === undefined
  const empty = !loading && data.length === 0
  const placeholderHeight = PLACEHOLDER_ROWS * RANKED_BAR_ROW_HEIGHT_PX
  const chartHeight =
    Math.max(data.length, PLACEHOLDER_ROWS) * RANKED_BAR_ROW_HEIGHT_PX

  return (
    <PanelCard title={t("title")} icon={BarChartHorizontalIcon}>
      <div className="space-y-2">
        {loading ? (
          <div
            className="flex w-full items-center justify-center"
            style={{ height: placeholderHeight }}
          >
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        ) : empty ? (
          <div
            className="flex w-full items-center justify-center"
            style={{ height: placeholderHeight }}
          >
            <p className="max-w-64 text-balance text-center text-muted-foreground text-sm">
              {tPage("empty")}
            </p>
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: chartHeight }}
          >
            <BarChart accessibilityLayer layout="vertical" data={data}>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                fontSize={CHART_AXIS_FONT_SIZE}
                tickFormatter={(value: number) => formatUsd(value, locale)}
              />
              <YAxis
                type="category"
                dataKey="orgName"
                tickLine={false}
                axisLine={false}
                width={160}
                fontSize={CHART_AXIS_FONT_SIZE}
              />
              <ChartTooltip
                {...CHART_TOOLTIP_MOTION}
                cursor={{ fill: "var(--muted)" }}
                content={<UsageTooltip locale={locale} t={t} format={format} />}
              />
              <Bar dataKey="costUsd" radius={BAR_RADIUS}>
                {data.map((row) => (
                  <Cell
                    key={row.orgId}
                    fill={
                      row.isOutlier ? "var(--flag-elevated)" : "var(--chart-1)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
        {!loading && !empty && (
          <p className="text-muted-foreground text-xs">{t("caption")}</p>
        )}
      </div>
    </PanelCard>
  )
}
