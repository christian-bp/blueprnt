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
import { useTranslations } from "next-intl"
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts"
import { headcountTrendDomain } from "@/lib/headcount-trend"

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
      className="aspect-auto h-14 w-full"
    >
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        {/* minPointSize forces a visible sliver even for a band that holds
            zero roles, so every configured band stays present in the chart
            (buildBandOverview zero-fills them); the tooltip still reads the
            true 0 count. */}
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={2}
          minPointSize={2}
        />
      </BarChart>
    </ChartContainer>
  )
}

// One stacked column per pay quartile, lower quartile first: women's share
// stacked below men's share of that quartile's headcount. An all-zero input
// (no measurable gap yet) still renders the chart at the same height with
// zero-height bars; recharts handles that natively, no special-casing.
export function QuartileSplitBars({
  quartiles,
}: {
  quartiles: { women: number; men: number }[]
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const config = {
    women: { label: tGap("women"), color: "var(--gender-woman)" },
    men: { label: tGap("men"), color: "var(--gender-man)" },
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
      className="aspect-auto h-14 w-full"
    >
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="women" stackId="a" fill="var(--color-women)" />
        <Bar dataKey="men" stackId="a" fill="var(--color-men)" radius={2} />
      </BarChart>
    </ChartContainer>
  )
}

// The Polyform stat-card diagonal-hatch fill pattern for an area chart:
// a 4x4 tile rotated -45deg holding a faint fill and a thin line, so the
// area under the curve reads as a hatch rather than a flat block.
function DiagonalPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      x="0"
      y="0"
      width="4"
      height="4"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(-45)"
    >
      <rect width="4" height="4" fill={color} fillOpacity="0.08" />
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="4"
        stroke={color}
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />
    </pattern>
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

// A smooth, monotone area chart of a value over time with a diagonal-hatch
// fill and a thin brand stroke bleeding to the card's bottom edge (Polyform
// stat-card style). No axis chrome (both axes hidden); the caller passes each
// point's heading (`label`, the pay mapping's name) and sub-heading
// (`caption`, its formatted reference date) so this stays i18n-free, and a
// pre-built ChartConfig so the series label and color come from the caller.
export function HeadcountArea({
  data,
  config,
}: {
  data: { label: string; caption: string; value: number }[]
  config: ChartConfig
}) {
  // Two pay-mapping runs can carry the same reference date and even the same
  // name, which would give the category axis two identical values; recharts
  // then resolves no active tooltip index at all and hovering does nothing. So
  // the axis keys on a per-point value that is unique by construction, and the
  // tooltip heading comes from the row. jsdom/happy-dom give recharts no
  // layout, so this only reproduces in a real browser.
  const rows = data.map((point, index) => ({ ...point, key: String(index) }))

  return (
    <ChartContainer
      aria-hidden="true"
      config={config}
      className="aspect-auto h-14 w-full"
    >
      <AreaChart data={rows} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <DiagonalPattern id="workforceHatch" color="var(--brand)" />
        </defs>
        <XAxis dataKey="key" hide />
        <YAxis hide domain={headcountTrendDomain(data.map((p) => p.value))} />
        <ChartTooltip
          cursor={false}
          position={{ y: -40 }}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_axisValue, items) => (
                <TrendHeading items={items} />
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          fill="url(#workforceHatch)"
          stroke="var(--color-value)"
          strokeWidth={1}
        />
      </AreaChart>
    </ChartContainer>
  )
}
