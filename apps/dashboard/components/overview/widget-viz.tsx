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
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts"
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

// Every widget chart sits in the bottom strip of a card that CLIPS its
// overflow (the fill bleeds to the rounded bottom edge), and recharts renders
// the tooltip inside the chart's own wrapper. Left to place itself the tooltip
// opens downward from the cursor and the card cuts it in half, so all three
// charts pin it above the strip, where the card still has room.
const TOOLTIP_ABOVE = { y: -40 }

// A minimal vertical mini bar chart (Midday Profit-card style): one bar per
// configured band, left-to-right ascending (Band 1 first), height scaled to
// the largest count by recharts' own auto domain.
export function BandBars({
  counts,
}: {
  counts: { band: number; count: number }[]
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const config = {
    count: { label: t("bands.seriesLabel"), color: "var(--brand)" },
  } satisfies ChartConfig
  const data = counts.map((c) => ({
    ...c,
    label: t("bands.barLabel", { band: c.band }),
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
        {/* minPointSize forces a visible sliver even for a band that holds
            zero roles, so every configured band stays present in the chart
            (buildBandOverview zero-fills them); the tooltip still reads the
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

// The category axis keys on a synthetic per-point key (see HeadcountArea), so
// the axis value is not what recharts should print as the tooltip heading; the
// hovered row carries the real one. recharts types a payload row loosely,
// hence the narrowing.
function hoveredPoint(
  items: readonly { payload?: unknown }[] | undefined
): { label: string; caption: string } | null {
  const row = items?.[0]?.payload
  if (
    typeof row === "object" &&
    row !== null &&
    "label" in row &&
    typeof row.label === "string" &&
    "caption" in row &&
    typeof row.caption === "string"
  ) {
    return { label: row.label, caption: row.caption }
  }
  return null
}

// The tooltip's heading: which pay mapping this headcount came from, with its
// reference date underneath. Naming the run is what tells the reader the
// number is a pay mapping's population and not a live workforce count.
function TrendHeading({
  items,
}: {
  items: readonly { payload?: unknown }[] | undefined
}) {
  const point = hoveredPoint(items)
  if (point === null) {
    return null
  }
  return (
    // A pay mapping's name is free text, and the card clips its overflow, so
    // the heading wraps inside a fixed width instead of widening the tooltip
    // past the card edge.
    <div className="grid max-w-40 gap-0.5">
      <span className="break-words">{point.label}</span>
      <span className="font-normal text-muted-foreground">{point.caption}</span>
    </div>
  )
}

// The workforce over pay-mapping runs, as two stacked areas bleeding to the
// card's bottom edge: women solid under men hatched, the same encoding every
// other gender chart uses. It plots the SPLIT rather than a single headcount
// line because the hatch means "men" everywhere else in the app, so a lone
// hatched area read as a gender series when it was really a total.
//
// Stacked areas sit on zero by design: area encodes magnitude, so a padded
// axis window (which a single flat line needed to be readable) would misstate
// the composition.
//
// No axis chrome (both axes hidden); the caller passes each point's heading
// (`label`, the pay mapping's name) and sub-heading (`caption`, its formatted
// reference date) so this stays i18n-free, plus a pre-built ChartConfig for the
// two series labels.
export function HeadcountArea({
  data,
  config,
  labels,
}: {
  data: { label: string; caption: string; women: number; men: number }[]
  config: ChartConfig
  labels: Record<GenderSeries, string>
}) {
  // Two pay-mapping runs can carry the same reference date and even the same
  // name, which would give the category axis two identical values; recharts
  // then resolves no active tooltip index at all and hovering does nothing. So
  // the axis keys on a per-point value that is unique by construction, and the
  // tooltip heading comes from the row. jsdom/happy-dom give recharts no
  // layout, so this only reproduces in a real browser.
  const rows = data.map((point, index) => ({ ...point, key: String(index) }))
  const marks = useGenderMarks()

  return (
    <ChartContainer
      aria-hidden="true"
      config={config}
      className={cn("aspect-auto w-full", WIDGET_CHART_HEIGHT)}
    >
      <AreaChart data={rows} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <GenderHatch id={marks.hatchId} />
        </defs>
        <XAxis dataKey="key" hide />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip
          cursor={false}
          position={TOOLTIP_ABOVE}
          content={
            <GenderTooltipContent
              indicator="dot"
              labels={labels}
              labelFormatter={(_axisValue, items) => (
                <TrendHeading items={items} />
              )}
            />
          }
        />
        {/* Women first so the solid series is the baseline, matching the
            quartile columns. Both fills run at full strength: the encoding is
            solid-vs-hatch in one ink, so lightening the solid band here to
            make the card airier would have made women a different colour than
            in every other chart. The stroke is what makes each band read as a
            curve rather than a slab. */}
        <Area
          dataKey="women"
          stackId="a"
          type="monotone"
          fill={marks.women}
          fillOpacity={1}
          {...GENDER_MARK_BORDER}
          strokeWidth={1.5}
        />
        <Area
          dataKey="men"
          stackId="a"
          type="monotone"
          fill={marks.men}
          fillOpacity={1}
          {...GENDER_MARK_BORDER}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  )
}
