"use client"

// Decorative viz primitives for the overview's data-widget cards: real
// shadcn/recharts bar and area charts (ChartContainer + ChartTooltip +
// ChartTooltipContent) so hovering a bar or the area gets the standard
// shadcn chart tooltip. Every chart stays aria-hidden since the narrative
// sentence next to it already carries the meaning for assistive tech.
// recharts' default tooltip label only falls back to the raw axis value
// when that value is a string (a numeric dataKey resolves through a
// config-label lookup instead), so each bar chart's category axis points at
// a pre-formatted `label` field rather than the raw number (mirrors
// QuartileStat/AgeStat in pay-mapping-overview.tsx); HeadcountArea, whose
// labels can repeat, keys on a synthetic axis value and prints its label
// through a labelFormatter instead.
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  type GenderSeries,
  GENDER_MARK_BORDER,
  GenderHatch,
  GenderMenIcon,
  GenderTooltipContent,
  useGenderMarks,
} from "@/components/gender-mark"
import {
  BAR_RADIUS,
  CHART_TOOLTIP_TEXT,
  WIDGET_CHART_HEIGHT,
} from "@/lib/chart-style"
import { headcountTrendDomain } from "@/lib/headcount-trend"

// Every widget chart sits in the bottom strip of a card that CLIPS its
// overflow (the fill bleeds to the rounded bottom edge), and recharts renders
// the tooltip inside the chart's own wrapper. Left to place itself the tooltip
// opens downward from the cursor and the card cuts it in half, so all three
// charts pin it above the strip, where the card still has room.
const TOOLTIP_ABOVE = { y: -40 }

// A minimal vertical mini bar chart (Midday Profit-card style): one bar per
// configured level, left-to-right ascending (Level 1 first), height scaled to
// the largest count by recharts' own auto domain.
export function LevelBars({
  counts,
}: {
  counts: { level: number; count: number }[]
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const config = {
    count: { label: t("levels.seriesLabel"), color: "var(--brand)" },
  } satisfies ChartConfig
  const data = counts.map((c) => ({
    ...c,
    label: t("levels.barLabel", { level: c.level }),
  }))

  return (
    <ChartContainer
      aria-hidden="true"
      config={config}
      className={cn("aspect-auto w-full", WIDGET_CHART_HEIGHT)}
    >
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" hide />
        <ChartTooltip
          cursor={false}
          position={TOOLTIP_ABOVE}
          content={<ChartTooltipContent className={CHART_TOOLTIP_TEXT} />}
        />
        {/* minPointSize forces a visible sliver even for a level that holds
            zero roles, so every configured level stays present in the chart
            (buildLevelOverview zero-fills them); the tooltip still reads the
            true 0 count. */}
        {/* Top corners only: this strip bleeds to the card's bottom edge, so a
            bottom radius would cut a notch out against it. */}
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
          minPointSize={2}
        />
      </BarChart>
    </ChartContainer>
  )
}

// One stacked column per pay quartile, lower quartile first: women's share
// below men's share of that quartile's headcount. The moving split boundary is
// the reading (the glass-ceiling view); the columns themselves come out the
// same height because quartiles hold near-equal headcounts by construction.
//
// Do NOT normalize this with stackOffset="expand" to force exactly equal
// columns: recharts then resolves an active tooltip index only for the FIRST
// category, so every column but the leftmost goes dead to hover (measured in a
// browser). It buys nothing here anyway, for the reason above.
//
// An all-zero input (no measurable gap yet) still renders the chart at the same
// height with zero-height columns; recharts handles that natively.
export function QuartileSplitBars({
  quartiles,
}: {
  quartiles: { women: number; men: number }[]
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const marks = useGenderMarks()
  const config = {
    women: { label: tGap("women"), color: "var(--gender-woman)" },
    // The icon is what makes the tooltip's key hatched. Without it both series
    // draw the same solid dot, because both colors are the same ink now.
    men: {
      label: tGap("men"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
  } satisfies ChartConfig
  const data = quartiles.map((q, index) => ({
    q: index + 1,
    ...q,
    label: t("gap.quartileLabel", { index: index + 1 }),
  }))

  return (
    <ChartContainer
      aria-hidden="true"
      config={config}
      className={cn("aspect-auto w-full", WIDGET_CHART_HEIGHT)}
    >
      <BarChart
        data={data}
        barCategoryGap="18%"
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <defs>
          <GenderHatch id={marks.hatchId} />
        </defs>
        <XAxis dataKey="label" hide />
        <ChartTooltip
          cursor={false}
          position={TOOLTIP_ABOVE}
          content={
            <GenderTooltipContent
              labels={{ women: tGap("women"), men: tGap("men") }}
            />
          }
        />
        <Bar
          dataKey="women"
          stackId="a"
          fill={marks.women}
          {...GENDER_MARK_BORDER}
        />
        <Bar
          dataKey="men"
          stackId="a"
          fill={marks.men}
          {...GENDER_MARK_BORDER}
          radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}

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
        CHART_TOOLTIP_TEXT
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
        <span className="font-semibold text-base tabular-nums">{total}</span>
      </div>
      {/* Indented past the swatch so the split hangs off the total it breaks
          down rather than starting a new column of its own. */}
      <div className="pl-[calc(0.625rem+0.5rem)] text-muted-foreground text-xs tabular-nums">
        {labels.women} {row.women} · {labels.men} {row.men}
      </div>
    </div>
  )
}

// The workforce over pay-mapping runs, as ONE line of total headcount bleeding
// to the card's bottom edge. The hover breaks that total into women and men.
//
// One line, not two, and not the stacked areas this started as. An area encodes
// magnitude so it must sit on zero, which draws a 118 -> 121 change as about a
// pixel. A line per gender does not fix it either: the two series sit ~20 apart
// while each moves by 1-2, and no single axis can both fit that gap and magnify
// that movement. A single total line is sized to its own movement, so the
// change is finally legible, and the split moves to the hover where it costs
// nothing. That also leaves the mark free of the gender encoding, which is why
// this chart no longer needs the hatch.
//
// No axis chrome (both axes hidden); the caller passes each point's heading
// (`label`, the pay mapping's name) and sub-heading (`caption`, its formatted
// reference date) so this stays i18n-free, plus the series labels for the hover.
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
    <ChartContainer
      aria-hidden="true"
      config={config}
      className={cn("aspect-auto w-full", WIDGET_CHART_HEIGHT)}
    >
      <LineChart data={rows} margin={{ top: 8, left: 0, right: 0, bottom: 8 }}>
        <XAxis dataKey="key" hide />
        <YAxis hide domain={headcountTrendDomain(rows.map((r) => r.total))} />
        <ChartTooltip
          cursor={false}
          position={TOOLTIP_ABOVE}
          content={
            <TrendTooltipContent labels={labels} totalLabel={totalLabel} />
          }
        />
        {/* Dots on every point: with as few as two runs the line alone gives no
            sense of where the readings actually are. */}
        <Line
          dataKey="total"
          type="monotone"
          stroke="var(--brand)"
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: "var(--brand)" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
