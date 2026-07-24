"use client"

import { AGE_BUCKETS } from "@workspace/core"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { WidgetCard } from "@/components/widget-card"
import { EqualityClock, EqualityClockSkeleton } from "./equality-clock"
import { MeanComparisonBars } from "./mean-comparison-bars"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"
import { PayMappingJourneyCard } from "./pay-mapping-journey-card"
import type {
  GenderTally,
  OrgAggregate,
  PayMappingGapResult,
} from "./pay-mapping-gap-types"
import { percentText } from "@/lib/percent"

// A legend/stat row keyed by gender: a color swatch, a muted label, and a
// right-aligned value. Shared by the donut's side rows so the gender-row
// anatomy lives once.
function GenderStatRow({
  colorVar,
  label,
  value,
}: {
  colorVar: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: colorVar }}
      />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto tabular-nums">{value}</dd>
    </div>
  )
}

// The unadjusted org-level gap, sentence-first: a plain-language finding
// (unsigned percent, direction spelled out in the word, same convention and
// dashboard.payMapping.review.finding namespace as the review journey's own
// per-group findings; see review-group-step.tsx's equalWorkFindingVariant)
// over the two gender means as the shared MeanComparisonBars widget, so the
// reader gets the story before the chart.
// The severity flag itself moves to the WidgetCard header (see
// PayMappingOverview below), which is why it is not rendered here.
function GapStat({
  org,
  currency,
}: {
  org: OrgAggregate | undefined
  currency: string | null
}) {
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tFinding = useTranslations("dashboard.payMapping.review.finding")
  const format = useFormatter()

  if (org === undefined) {
    // Mirrors the loaded layout: two sentence-line bars over two bar-chart
    // rows, so nothing shifts when the data lands.
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex min-h-5 items-center">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="flex min-h-5 items-center">
            <Skeleton className="h-4 w-2/3 max-w-md" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    )
  }
  if (org.flag === "insufficient" || org.gapPct === null) {
    return (
      <p className="text-muted-foreground text-sm">
        {tOverview("insufficient")}
      </p>
    )
  }
  const sentence =
    org.gapPct > 0
      ? tFinding("orgLess", { gap: percentText(org.gapPct, format) })
      : org.gapPct < 0
        ? tFinding("orgMore", { gap: percentText(org.gapPct, format) })
        : tFinding("orgNone")
  const { womenMeanComp, menMeanComp } = org

  return (
    <div className="space-y-4">
      <p className="text-sm">{sentence}</p>
      {womenMeanComp !== null && menMeanComp !== null && currency !== null && (
        <MeanComparisonBars
          womenMean={womenMeanComp}
          menMean={menMeanComp}
          currency={currency}
        />
      )}
    </div>
  )
}

// The equality clock widget: digit boxes only when a real gap is computed, so
// it never claims "no measurable gap" while loading or on insufficient data.
function ClockStat({ org }: { org: OrgAggregate | undefined }) {
  const tOverview = useTranslations("dashboard.payMapping.overview")
  if (org === undefined) {
    // The clock's own skeleton (exported beside it) keeps the digit boxes,
    // colons, and unit labels pixel-identical across the two states.
    return <EqualityClockSkeleton />
  }
  if (org.flag === "insufficient" || org.gapPct === null) {
    return (
      <p className="text-muted-foreground text-sm">
        {tOverview("insufficient")}
      </p>
    )
  }
  return <EqualityClock gapPct={org.gapPct} />
}

// The whole frozen population: the standard shadcn gender donut with the
// prominent headcount and count/share rows beside it. Every frozen row has a
// gender, so the donut total IS the survey population.
function WholeSurveyStat({
  population,
  countLabel,
  expanded = false,
}: {
  population: GenderTally | undefined
  countLabel: string
  expanded?: boolean
}) {
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  if (population === undefined) {
    return <Skeleton className="h-40 w-full" />
  }
  const women = population.women
  const men = population.men
  const total = women + men
  const config = {
    women: { label: tGap("women"), color: "var(--gender-woman)" },
    men: { label: tGap("men"), color: "var(--gender-man)" },
  } satisfies ChartConfig
  const data = [
    {
      key: "women",
      label: tGap("women"),
      value: women,
      fill: "var(--gender-woman)",
    },
    { key: "men", label: tGap("men"), value: men, fill: "var(--gender-man)" },
  ]
  const share = (value: number) =>
    total > 0 ? `${value} (${Math.round((value / total) * 100)}%)` : `${value}`
  return (
    <div className="flex items-center gap-6">
      <ChartContainer
        config={config}
        className={expanded ? "aspect-square h-80" : "aspect-square h-40"}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={expanded ? 80 : 40}
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-muted-foreground text-sm">{countLabel}</p>
          <p className="font-semibold text-3xl tabular-nums">{total}</p>
        </div>
        <dl className="space-y-1 text-sm">
          {data.map((d) => (
            <GenderStatRow
              key={d.key}
              colorVar={d.fill}
              label={d.label}
              value={share(d.value)}
            />
          ))}
        </dl>
      </div>
    </div>
  )
}

// Gender split per pay quartile (EU Art. 9 A3, the glass-ceiling view) as
// the standard shadcn horizontal stacked bar chart, the upper quartile on
// top. Headcounts only, so no masking applies; exact counts on hover, the
// concept lives in the widget's help.
function QuartileStat({
  quartiles,
  expanded = false,
}: {
  quartiles: GenderTally[] | undefined
  expanded?: boolean
}) {
  const t = useTranslations("dashboard.payMapping.overview.quartiles")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  if (quartiles === undefined) {
    return <Skeleton className="h-40 w-full" />
  }
  const config = {
    men: { label: tGap("men"), color: "var(--gender-man)" },
    women: { label: tGap("women"), color: "var(--gender-woman)" },
  } satisfies ChartConfig
  // Wire order is lower -> upper; display the upper quartile on top.
  const labels = ["lower", "lowerMiddle", "upperMiddle", "upper"] as const
  const data = quartiles
    .map((tally, index) => ({
      label: t(labels[index] ?? "lower"),
      women: tally.women,
      men: tally.men,
    }))
    .reverse()
  return (
    <ChartContainer
      config={config}
      className={
        expanded ? "aspect-auto h-96 w-full" : "aspect-auto h-40 w-full"
      }
    >
      <BarChart accessibilityLayer layout="vertical" data={data}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={expanded ? 140 : 92}
          fontSize={expanded ? 13 : 11}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* Outer corners rounded on each end of the stack: the base (men)
            segment carries the left radius, the top (women) segment the
            right (recharts radius order: [tl, tr, br, bl]). */}
        <Bar
          dataKey="men"
          stackId="a"
          fill="var(--color-men)"
          radius={[2, 0, 0, 2]}
        />
        <Bar
          dataKey="women"
          stackId="a"
          fill="var(--color-women)"
          radius={[0, 2, 2, 0]}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

// Age distribution by gender over the whole frozen population, as the
// standard shadcn multiple bar chart per age band (digit-only band labels
// render as-is in every locale); exact counts on hover.
function AgeStat({
  age,
  expanded = false,
}: {
  age: { buckets: GenderTally[]; unknown: number } | undefined
  expanded?: boolean
}) {
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  if (age === undefined) {
    return <Skeleton className="h-40 w-full" />
  }
  const config = {
    men: { label: tGap("men"), color: "var(--gender-man)" },
    women: { label: tGap("women"), color: "var(--gender-woman)" },
  } satisfies ChartConfig
  const data = AGE_BUCKETS.map((bucket, index) => ({
    bucket,
    women: age.buckets[index]?.women ?? 0,
    men: age.buckets[index]?.men ?? 0,
  }))
  return (
    <div className="space-y-2">
      <ChartContainer
        config={config}
        className={
          expanded ? "aspect-auto h-96 w-full" : "aspect-auto h-40 w-full"
        }
      >
        <BarChart accessibilityLayer data={data}>
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            fontSize={expanded ? 12 : 10}
            interval={0}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="men" fill="var(--color-men)" radius={2} />
          <Bar dataKey="women" fill="var(--color-women)" radius={2} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
      {age.unknown > 0 && (
        <p className="text-muted-foreground text-xs">
          {tOverview("birthDateUnknown", { count: age.unknown })}
        </p>
      )}
    </div>
  )
}

// The survey Overview, shaped as a guided hub (ADR-0012): the journey card
// (the single progress source and completion gate, superseding the old
// flag-summary KPI and documentation card) over "Läget" (the org-level
// finding, sentence-first, plus the equality clock) over "Statistics", a
// row of expandable standard shadcn charts (donut, stacked bars, grouped
// bars) with their normal tooltip + legend anatomy. Everything derives from
// the gap aggregate (the population figure included). Each widget renders
// its real title while loading and owns its content bars, so the page
// needs no separate skeleton component; `gap` is undefined while the query
// loads. The adjusted gap + adjusted clock join Läget later.
export function PayMappingOverview({
  gap,
}: {
  gap: PayMappingGapResult | undefined
}) {
  const t = useTranslations("dashboard.payMapping")
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tClock = useTranslations("dashboard.payMapping.clock")
  const tHelp = useTranslations("dashboard.help")
  const org = gap?.org

  return (
    <div className="space-y-4">
      {/* The journey card is the Overview's single progress source and
          completion gate (ADR-0012): it reads run/gap/analyses from the run
          shell's context itself (self-contained, like the header
          components), so this component's own `gap` prop stays untouched. */}
      <PayMappingJourneyCard />
      {/* Läget: the org-level finding, sentence-first, with its own severity
          flag beside the heading, next to the equality clock. */}
      <div className="grid gap-4 md:grid-cols-2">
        <WidgetCard
          title={tOverview("headlineGapLabel")}
          help={{
            label: tHelp("headlineGapLabel"),
            body: tHelp("headlineGapBody"),
          }}
          headerExtra={
            org === undefined ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <PayGapFlagBadge flag={org.flag} />
            )
          }
        >
          <GapStat org={org} currency={gap?.currency ?? null} />
        </WidgetCard>
        <WidgetCard
          title={tClock("label")}
          help={{
            label: tHelp("equalityClockLabel"),
            body: tHelp("equalityClockBody"),
          }}
        >
          <ClockStat org={org} />
        </WidgetCard>
      </div>
      <h2 className="font-semibold text-lg">
        {tOverview("statisticsHeading")}
      </h2>
      {/* Distribution charts, each expandable to a large dialog: the donut
          keeps a single column, the quartile chart takes the remaining two,
          the age distribution gets the full row below. */}
      <div className="grid gap-4 md:grid-cols-3">
        <WidgetCard
          title={tOverview("wholeSurveyTitle")}
          expandable
          expandedChildren={
            <WholeSurveyStat
              population={gap?.population}
              countLabel={t("detail.population")}
              expanded
            />
          }
        >
          <WholeSurveyStat
            population={gap?.population}
            countLabel={t("detail.population")}
          />
        </WidgetCard>
        <WidgetCard
          className="md:col-span-2"
          title={tOverview("quartileTitle")}
          help={{
            label: tHelp("payQuartilesLabel"),
            body: tHelp("payQuartilesBody"),
          }}
          expandable
          expandedChildren={
            <QuartileStat quartiles={gap?.quartiles} expanded />
          }
        >
          <QuartileStat quartiles={gap?.quartiles} />
        </WidgetCard>
        <WidgetCard
          className="md:col-span-3"
          title={tOverview("ageTitle")}
          expandable
          expandedChildren={<AgeStat age={gap?.age} expanded />}
        >
          <AgeStat age={gap?.age} />
        </WidgetCard>
      </div>
    </div>
  )
}
