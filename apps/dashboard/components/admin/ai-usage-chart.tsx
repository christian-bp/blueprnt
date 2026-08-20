"use client"

import { ChartAreaIcon } from "@hugeicons/core-free-icons"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useId } from "react"
import { Area, AreaChart, XAxis, YAxis } from "recharts"
import { PanelCard } from "@/components/panel-card"
import {
  type AiUsageDailyOrgRow,
  CHART_SERIES_CAP,
  capDailySeries,
  chartTickInterval,
  dayDate,
  formatUsd,
  nanosToUsd,
} from "@/lib/admin-ai-usage"
import {
  AI_USAGE_TREND_HEIGHT,
  CHART_AXIS_FONT_SIZE,
  CHART_EDGE_INSET,
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  chartSeriesInk,
  moneyAxisWidth,
  TOOLTIP_APPEAR,
} from "@/lib/chart-style"

const OTHERS_KEY = "others"
const OTHERS_INK = "var(--muted-foreground)"

// One day's stacked-area point: the day of month, a localized date label for
// the tooltip header, and each drawn series' USD cost that day, keyed by
// orgId (or OTHERS_KEY for the folded remainder).
interface ChartPoint {
  day: number
  dateLabel: string
  [seriesKey: string]: number | string
}

// The row both the legend and the tooltip render (chart-anatomy rule: the
// two must draw the same object, not two hand-matched look-alikes). A square
// swatch in the series' own ink, the org name, and an optional right-aligned
// value.
function SeriesKeyRow({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value?: string
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="truncate text-muted-foreground">{label}</span>
      {value !== undefined && (
        <span className="ml-auto shrink-0 font-medium text-foreground tabular-nums">
          {value}
        </span>
      )}
    </div>
  )
}

// The chart's key, outside the plot (never recharts' own ChartLegend, which
// draws chart furniture inside the plot area): every drawn series, top orgs
// first in the backend's period-total-desc order, Others last when present.
function SeriesLegend({
  items,
}: {
  items: { key: string; color: string; label: string }[]
}) {
  return (
    <div className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <SeriesKeyRow key={item.key} color={item.color} label={item.label} />
      ))}
    </div>
  )
}

// The chart's hover: every drawn series' cost for the hovered day, ordered by
// size (largest first), each row the same SeriesKeyRow the legend draws.
function ChartPointTooltip({
  active,
  payload,
  seriesLabels,
  seriesColors,
  locale,
}: {
  active?: boolean
  payload?: Array<{
    dataKey?: string | number
    value?: unknown
    payload?: unknown
  }>
  seriesLabels: Record<string, string>
  seriesColors: Record<string, string>
  locale: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as ChartPoint | undefined
  if (point === undefined) return null

  const rows = payload
    .filter(
      (entry): entry is { dataKey: string; value: number } =>
        typeof entry.dataKey === "string" && typeof entry.value === "number"
    )
    .sort((a, b) => b.value - a.value)

  return (
    <div
      className={cn(
        "min-w-48 max-w-64 rounded-lg border border-border/50 bg-background px-2.5 py-2 shadow-xl",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      <div className="font-medium">{point.dateLabel}</div>
      <div className="mt-1 space-y-1">
        {rows.map((row) => (
          <SeriesKeyRow
            key={row.dataKey}
            color={seriesColors[row.dataKey] ?? OTHERS_INK}
            label={seriesLabels[row.dataKey] ?? row.dataKey}
            value={formatUsd(row.value, locale)}
          />
        ))}
      </div>
    </div>
  )
}

// The page's big chart: one stacked area per org, x axis the days of the
// selected month. Outlier flagging lives with the table's flagged column,
// so this panel carries period context only. Orgs beyond CHART_SERIES_CAP fold
// into one muted "Others" band (lib/admin-ai-usage.ts's capDailySeries),
// stated in the caption only when it engages. AI_USAGE_TREND_HEIGHT
// (lib/chart-style.ts) sizes every state (loading, empty, ready) the same,
// so the panel never resizes once real data arrives.
export function AiUsageChart({
  data,
  period,
}: {
  data: { days: number; rows: AiUsageDailyOrgRow[] } | undefined
  period: string
}) {
  const t = useTranslations("dashboard.admin.aiUsage.chart")
  const tPage = useTranslations("dashboard.admin.aiUsage")
  const format = useFormatter()
  const locale = useLocale()
  const gradientBase = useId()

  if (data === undefined) {
    return (
      <PanelCard title={t("title")} icon={ChartAreaIcon}>
        <div
          className={cn(
            "flex w-full items-center justify-center",
            AI_USAGE_TREND_HEIGHT
          )}
        >
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
      </PanelCard>
    )
  }

  if (data.rows.length === 0) {
    return (
      <PanelCard title={t("title")} icon={ChartAreaIcon}>
        <div
          className={cn(
            "flex w-full items-center justify-center",
            AI_USAGE_TREND_HEIGHT
          )}
        >
          <p className="max-w-64 text-balance text-center text-muted-foreground text-sm">
            {tPage("empty")}
          </p>
        </div>
      </PanelCard>
    )
  }

  const capped = capDailySeries(data.rows, data.days)
  const legendItems: { key: string; color: string; label: string }[] =
    capped.series.map((row, index) => ({
      key: row.orgId,
      color: chartSeriesInk(index),
      label: row.orgName,
    }))
  if (capped.others !== null) {
    legendItems.push({
      key: OTHERS_KEY,
      color: OTHERS_INK,
      label: t("othersLabel"),
    })
  }
  const seriesLabels: Record<string, string> = Object.fromEntries(
    legendItems.map((item) => [item.key, item.label])
  )
  const seriesColors: Record<string, string> = Object.fromEntries(
    legendItems.map((item) => [item.key, item.color])
  )

  const points: ChartPoint[] = Array.from({ length: data.days }, (_, i) => {
    const point: ChartPoint = {
      day: i + 1,
      dateLabel: format.dateTime(dayDate(period, i), {
        day: "numeric",
        month: "long",
      }),
    }
    for (const row of capped.series) {
      point[row.orgId] = nanosToUsd(row.dailyCostNanos[i] ?? 0)
    }
    if (capped.others !== null) {
      point[OTHERS_KEY] = nanosToUsd(capped.others.dailyCostNanos[i] ?? 0)
    }
    return point
  })

  // The areas are stacked, so the axis reaches the DAILY TOTAL rather than
  // any one series' value; sizing it to a single org's numbers would clip the
  // label the moment two orgs share a day.
  const usdAxisWidth = moneyAxisWidth(
    points.map((point) =>
      Object.entries(point).reduce(
        (sum, [key, value]) =>
          key === "day" || typeof value !== "number" ? sum : sum + value,
        0
      )
    ),
    (value) => formatUsd(value, locale)
  )

  const config: ChartConfig = Object.fromEntries(
    legendItems.map((item) => [item.key, { label: item.label }])
  )

  return (
    <PanelCard title={t("title")} icon={ChartAreaIcon}>
      <div className="space-y-3">
        <ChartContainer
          config={config}
          className={cn("aspect-auto w-full", AI_USAGE_TREND_HEIGHT)}
        >
          <AreaChart
            accessibilityLayer
            data={points}
            margin={{
              top: 8,
              left: CHART_EDGE_INSET,
              right: CHART_EDGE_INSET,
              bottom: 0,
            }}
          >
            <defs>
              {legendItems.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`${gradientBase}-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.3} />
                  <stop
                    offset="100%"
                    stopColor={item.color}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="day"
              type="category"
              tickLine={false}
              axisLine={false}
              fontSize={CHART_AXIS_FONT_SIZE}
              interval={chartTickInterval(data.days)}
              tickFormatter={(day: number) =>
                format.dateTime(dayDate(period, day - 1), {
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <YAxis
              type="number"
              tickLine={false}
              axisLine={false}
              fontSize={CHART_AXIS_FONT_SIZE}
              width={usdAxisWidth}
              tickFormatter={(value: number) => formatUsd(value, locale)}
            />
            <ChartTooltip
              {...CHART_TOOLTIP_MOTION}
              cursor={{ stroke: "var(--border)" }}
              content={
                <ChartPointTooltip
                  seriesLabels={seriesLabels}
                  seriesColors={seriesColors}
                  locale={locale}
                />
              }
            />
            {capped.series.map((row, index) => (
              <Area
                key={row.orgId}
                dataKey={row.orgId}
                type="monotone"
                stackId="cost"
                stroke={chartSeriesInk(index)}
                strokeWidth={2}
                fill={`url(#${gradientBase}-${row.orgId})`}
              />
            ))}
            {capped.others !== null && (
              <Area
                dataKey={OTHERS_KEY}
                type="monotone"
                stackId="cost"
                stroke={OTHERS_INK}
                strokeWidth={2}
                fill={`url(#${gradientBase}-${OTHERS_KEY})`}
              />
            )}
          </AreaChart>
        </ChartContainer>
        <SeriesLegend items={legendItems} />
        {capped.others !== null && (
          <p className="text-muted-foreground text-sm">
            {t("seriesCap", {
              cap: CHART_SERIES_CAP,
              count: capped.others.count,
              othersLabel: t("othersLabel"),
            })}
          </p>
        )}
      </div>
    </PanelCard>
  )
}
