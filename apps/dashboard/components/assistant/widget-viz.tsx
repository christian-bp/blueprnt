"use client"

// The assistant's two trend lines: how the workforce and the pay gap have
// moved across pay mappings. Both are real shadcn/recharts charts
// (ChartContainer + ChartTooltip) with hand-built tooltip content, so a hover
// reads as one composed statement rather than a list of series rows.
//
// Neither chart is aria-hidden here: chat has no stat tile stating the same
// figures in words, so the chart itself is the content a screen reader needs
// to reach, and the hover/summary text is what carries the gender split.
//
// Two mappings can share a name AND a reference date, which would give the
// category axis duplicate values and kill recharts' active-tooltip
// resolution, so both charts key the axis on a synthetic per-point value and
// take the heading from the row.
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter } from "next-intl"
import { type ReactElement, useId } from "react"
import { Area, AreaChart, XAxis, YAxis } from "recharts"
import type { GenderSeries } from "@/components/gender-mark"
import {
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  TOOLTIP_APPEAR,
  WIDGET_CHART_HEIGHT,
} from "@/lib/chart-style"
import { signedPercentText } from "@/lib/percent"
import { trendDomain } from "@/lib/trend-domain"

// recharts renders the tooltip inside the chart's own wrapper, and left to
// place itself it opens downward from the cursor, where the panel's edge cuts
// it. Both charts pin it above the plot instead.
const TOOLTIP_ABOVE = { y: -40 }

function TrendTooltipContent({
  active,
  payload,
  labels,
  totalLabel,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  labels: Record<GenderSeries, string>
  totalLabel: string
}) {
  const format = useFormatter()
  if (active !== true) return null
  const row = payload?.[0]?.payload as
    | { label: string; caption: string; women: number; men: number }
    | undefined
  if (row === undefined) return null
  const total = row.women + row.men

  // Composed rather than listed as one row per value. The chart plots a single
  // series, so a row list gave five lines of identical weight with nothing
  // leading, and a lone swatch that keyed nothing. Here the run identifies the
  // reading, the total answers it, and the split is a footnote under it.
  return (
    <div
      className={cn(
        "grid min-w-36 max-w-48 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-2 shadow-xl",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      <div className="grid gap-0.5">
        {/* A pay mapping's name is free text, so it wraps inside the card's
            width instead of widening the tooltip past the card edge. */}
        <span className="break-words font-medium leading-snug">
          {row.label}
        </span>
        <span className="text-muted-foreground text-xs">{row.caption}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        {/* The same key geometry as GenderKeyRow, solid in the line's own ink.
            No border: that rule exists so a hatch reads as a bounded shape,
            and this swatch has no hatched sibling to sit beside. */}
        <span className="flex items-center gap-2 text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px] bg-brand"
          />
          {totalLabel}
        </span>
        <span className="font-semibold text-base tabular-nums">
          {format.number(total)}
        </span>
      </div>
      {/* Indented past the swatch so the split hangs off the total it breaks
          down rather than starting a new column of its own. */}
      <div className="pl-[calc(0.625rem+0.5rem)] text-muted-foreground text-xs tabular-nums">
        {labels.women} {format.number(row.women)} · {labels.men}{" "}
        {format.number(row.men)}
      </div>
    </div>
  )
}

// The one plot both trends draw: a gradient area under a stroked curve,
// bleeding to its card's edges, with both axes hidden and the reading carried
// by the hover.
//
// Shared rather than written twice, because the two sit side by side: a
// difference in fill, margin or dot size between them would read as a
// difference in what is being measured, not in how it was coded.
//
// NOTE, and it is a real trade: an area fill normally has to sit on zero,
// because a filled shape encodes magnitude and a floating baseline overstates
// the change. Neither of these does. A realistic annual move (118 -> 121
// people, 4.3 -> 4.1 percent) against a zero baseline is about one pixel of
// this strip, i.e. a flat line. So the fill is shading under a curve rather
// than a quantity to read off: the figure lives in words on the tile above
// and exactly in the hover, and the gradient fading out downward is what
// keeps the bottom edge from reading as zero.
function TrendArea({
  rows,
  dataKey,
  domainValues,
  config,
  tooltip,
  // A null reading is a BREAK in the curve, not a zero. Only the gap trend
  // has them (a mapping with no measurable gap).
  connectNulls = true,
}: {
  rows: { key: string }[]
  dataKey: string
  domainValues: number[]
  config: ChartConfig
  tooltip: ReactElement
  connectNulls?: boolean
}) {
  // Unique per instance: two charts sharing a gradient id would have the
  // second one paint with the first one's stops.
  const gradientId = useId()

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full", WIDGET_CHART_HEIGHT)}
    >
      {/* No side or bottom margin: the fill runs to the card's own edges,
          which is what makes it read as the card's surface rather than a
          picture sitting on it. The top margin is the stroke's headroom.

          accessibilityLayer on, like every other chart in the app: it puts
          tabIndex=0 and role="application" on the plot surface, which is the
          only way a screen reader user in chat can reach the data at all. */}
      <AreaChart
        accessibilityLayer
        data={rows}
        margin={{ top: 8, left: 0, right: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="key" hide />
        <YAxis hide domain={trendDomain(domainValues)} />
        <ChartTooltip
          {...CHART_TOOLTIP_MOTION}
          cursor={false}
          position={TOOLTIP_ABOVE}
          content={tooltip}
        />
        {/* The stroke is what makes the series read as a curve; the fill is
            shading under it. Dots on every point: with as few as two mappings
            the curve alone gives no sense of where the readings are. */}
        <Area
          dataKey={dataKey}
          type="monotone"
          connectNulls={connectNulls}
          stroke="var(--brand)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 2.5, strokeWidth: 0, fill: "var(--brand)" }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// The workforce over pay-mapping runs, as ONE total headcount. The hover
// breaks that total into women and men.
//
// One series, not two. A line per gender does not work here: the two sit ~20
// apart while each moves by 1-2, and no single axis can both fit that gap and
// magnify that movement. A single total, sized to its own movement, makes the
// change legible, and the split moves to the hover where it costs nothing.
// That also leaves the mark free of the gender encoding, which is why this
// chart needs no hatch.
//
// The caller passes each point's heading (`label`, the pay mapping's name) and
// sub-heading (`caption`, its formatted reference date) so this stays
// i18n-free, plus the series labels for the hover.
export function HeadcountTrend({
  data,
  config,
  labels,
  totalLabel,
}: {
  data: { label: string; caption: string; women: number; men: number }[]
  config: ChartConfig
  labels: Record<GenderSeries, string>
  totalLabel: string
}) {
  // Two pay-mapping runs can carry the same reference date and even the same
  // name, which would give the category axis two identical values; recharts
  // then resolves no active tooltip index at all and hovering does nothing. So
  // the axis keys on a per-point value that is unique by construction, and the
  // tooltip heading comes from the row. jsdom/happy-dom give recharts no
  // layout, so this only reproduces in a real browser.
  const rows = data.map((point, index) => ({
    ...point,
    key: String(index),
    total: point.women + point.men,
  }))

  return (
    <TrendArea
      rows={rows}
      dataKey="total"
      domainValues={rows.map((r) => r.total)}
      config={config}
      tooltip={<TrendTooltipContent labels={labels} totalLabel={totalLabel} />}
    />
  )
}

// The organization's unadjusted gap across its pay mappings, on the same
// TrendArea its neighbour uses: they sit side by side, and a different-looking
// plot would read as a different KIND of measurement.
//
// A gap can be negative (women ahead), which trendDomain handles by never
// clamping the low end above the smallest value.
export function PayGapTrend({
  data,
  config,
  seriesLabel,
  unmeasuredLabel,
}: {
  data: { label: string; caption: string; gapPct: number | null }[]
  config: ChartConfig
  seriesLabel: string
  // What the hover says for a mapping with no measurable gap.
  unmeasuredLabel: string
}) {
  // Same reason as HeadcountTrend: two mappings can share a name and a
  // reference date, and a duplicated category value kills the tooltip.
  const rows = data.map((point, index) => ({ ...point, key: String(index) }))
  const measured = rows
    .map((r) => r.gapPct)
    .filter((value): value is number => value !== null)

  return (
    <TrendArea
      rows={rows}
      dataKey="gapPct"
      domainValues={measured}
      config={config}
      // A mapping with no measurable gap breaks the curve rather than
      // dropping it to zero, which would read as "no gap".
      connectNulls={false}
      tooltip={
        <GapTrendTooltipContent
          seriesLabel={seriesLabel}
          unmeasuredLabel={unmeasuredLabel}
        />
      }
    />
  )
}

function GapTrendTooltipContent({
  active,
  payload,
  seriesLabel,
  unmeasuredLabel,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  seriesLabel: string
  unmeasuredLabel: string
}) {
  const format = useFormatter()
  if (active !== true) return null
  const row = payload?.[0]?.payload as
    | { label: string; caption: string; gapPct: number | null }
    | undefined
  if (row === undefined) return null

  return (
    <div
      className={cn(
        "grid min-w-36 max-w-48 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-2 shadow-xl",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      <div className="grid gap-0.5">
        <span className="break-words font-medium leading-snug">
          {row.label}
        </span>
        <span className="text-muted-foreground text-xs">{row.caption}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px] bg-brand"
          />
          {seriesLabel}
        </span>
        {/* Locale-formatted, and SIGNED: a negative gap means women are
            ahead, and an unsigned figure draws two opposite years the same. */}
        <span className="font-semibold text-base tabular-nums">
          {row.gapPct === null
            ? unmeasuredLabel
            : signedPercentText(row.gapPct, format)}
        </span>
      </div>
    </div>
  )
}
