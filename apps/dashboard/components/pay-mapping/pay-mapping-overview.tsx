"use client"

import {
  ChartAverageIcon,
  Clock01Icon,
  JusticeScale01Icon,
} from "@hugeicons/core-free-icons"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
  GenderHatch,
  GenderMenIcon,
  genderMarkBorder,
  GenderLegend,
  GenderTooltipContent,
  useGenderMarks,
} from "@/components/gender-mark"
import { PanelCard } from "@/components/panel-card"
import { WidgetCard } from "@/components/widget-card"
import {
  EqualityClock,
  equalityClockDirection,
  EqualityClockSkeleton,
} from "./equality-clock"
import { MeanComparisonBars } from "./mean-comparison-bars"
import { PayMappingPopulationCard } from "./pay-mapping-population-card"
import type {
  GenderTally,
  OrgAggregate,
  PayMappingGapResult,
} from "./pay-mapping-gap-types"
import { BAR_RADIUS, CHART_AXIS_FONT_SIZE } from "@/lib/chart-style"
import { percentText } from "@/lib/percent"

// The unadjusted org-level gap as a KPI figure: the unsigned percent, and
// nothing else. The severity flag used to sit beside it as a chip, which put
// a second reading on a tile whose whole job is one number; the flag still
// rides on every group in the analysis, where it decides what has to be
// documented. The direction and the two means live in the finding card below
// the strip.
// An org too small to measure has no figure at all, so the tile says so in
// words where the figure would be.
function gapStat(
  org: OrgAggregate | undefined,
  tOverview: ReturnType<
    typeof useTranslations<"dashboard.payMapping.overview">
  >,
  format: ReturnType<typeof useFormatter>
): { value: ReactNode; footer?: ReactNode } {
  if (org === undefined) {
    // Centred in the figure's own line box; a bare bar leaves the tile
    // shorter than it will be once the percent lands.
    return {
      value: (
        <span className="flex items-center">
          <Skeleton className="h-7 w-20" />
        </span>
      ),
    }
  }
  if (org.flag === "insufficient" || org.gapPct === null) {
    return {
      value: (
        <span className="font-normal text-base text-muted-foreground">
          {tOverview("insufficient")}
        </span>
      ),
    }
  }
  return { value: percentText(org.gapPct, format) }
}

// The finding itself, sentence-first: a plain-language reading of the same
// gap (direction spelled out in the word, same convention and
// dashboard.payMapping.review.finding namespace as the review journey's own
// per-group findings; see review-group-step.tsx's equalWorkFindingVariant)
// over the two gender means as the shared MeanComparisonBars widget, so the
// reader gets the story before the chart.
//
// Full width under the KPI strip rather than inside the gap tile: a
// three-line sentence and two labelled bars are not a stat, and they would
// have set the height of every tile on the row.
function GapFinding({
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
  const marks = useGenderMarks()
  if (population === undefined) {
    return <Skeleton className="h-40 w-full" />
  }
  const women = population.women
  const men = population.men
  const total = women + men
  const config = {
    women: { label: tGap("women"), color: "var(--gender-woman)" },
    men: {
      label: tGap("men"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
  } satisfies ChartConfig
  const data = [
    {
      key: "women",
      label: tGap("women"),
      value: women,
      fill: marks.women,
      swatch: "women" as const,
    },
    {
      key: "men",
      label: tGap("men"),
      value: men,
      fill: marks.men,
      swatch: "men" as const,
    },
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
          <defs>
            <GenderHatch id={marks.hatchId} />
          </defs>
          {/* nameKey is the config key, NOT the translated label:
              ChartTooltipContent resolves a series' key by name, so naming
              slices "Man" found no config entry, fell back to a swatch whose
              colour was the hatch's url(...) paint, and drew nothing. */}
          <ChartTooltip
            content={
              <GenderTooltipContent
                hideLabel
                labels={{ women: tGap("women"), men: tGap("men") }}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={expanded ? 80 : 40}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} {...genderMarkBorder(d.swatch)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-muted-foreground text-sm">{countLabel}</p>
          <p className="font-semibold text-3xl tabular-nums">{total}</p>
        </div>
        <GenderLegend
          items={data.map((d) => ({
            series: d.swatch,
            label: d.label,
            value: share(d.value),
          }))}
        />
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
  const marks = useGenderMarks()
  if (quartiles === undefined) {
    return <Skeleton className="h-40 w-full" />
  }
  const config = {
    men: {
      label: tGap("men"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
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
    <div className="space-y-2">
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
            width={expanded ? 148 : 100}
            fontSize={CHART_AXIS_FONT_SIZE}
          />
          <defs>
            <GenderHatch id={marks.hatchId} />
          </defs>
          <ChartTooltip
            content={
              <GenderTooltipContent
                labels={{ women: tGap("women"), men: tGap("men") }}
              />
            }
          />
          {/* Outer corners rounded on each end of the stack: the base (men)
            segment carries the left radius, the top (women) segment the
            right (recharts radius order: [tl, tr, br, bl]). */}
          <Bar
            dataKey="men"
            stackId="a"
            fill={marks.men}
            {...genderMarkBorder("men")}
            radius={[BAR_RADIUS, 0, 0, BAR_RADIUS]}
          />
          <Bar
            dataKey="women"
            stackId="a"
            fill={marks.women}
            {...genderMarkBorder("women")}
            radius={[0, BAR_RADIUS, BAR_RADIUS, 0]}
          />
        </BarChart>
      </ChartContainer>
      <GenderLegend
        items={[
          { series: "women", label: tGap("women") },
          { series: "men", label: tGap("men") },
        ]}
      />
    </div>
  )
}

// The survey Overview, shaped as a guided hub (ADR-0012): a KPI strip of
// three stat tiles (population, gap, equality clock) over the finding
// itself, sentence-first with the two gender means, over "Statistics", a row
// of expandable standard shadcn charts (a donut and stacked bars) with their
// normal tooltip + legend anatomy.
// Everything derives from the gap aggregate (the population figure
// included). Each widget renders its real title while loading and owns its
// content bars, so the page needs no separate skeleton component; `gap` is
// undefined while the query loads. The adjusted gap + adjusted clock join
// the strip later.
export function PayMappingOverview({
  gap,
}: {
  gap: PayMappingGapResult | undefined
}) {
  const t = useTranslations("dashboard.payMapping")
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tClock = useTranslations("dashboard.payMapping.clock")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const org = gap?.org

  return (
    <div className="space-y-4">
      {/* The KPI strip: how big this mapping is, what it found, and what
          that costs in time. The population tile reads the run shell's
          context itself (self-contained, like the header components), so
          this component's own `gap` prop stays untouched. Finishing the run
          is not here: it belongs at the end of the analysis flow, not on a
          dashboard tile beside the figures. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PayMappingPopulationCard />
        <WidgetCard
          title={tOverview("headlineGapLabel")}
          icon={JusticeScale01Icon}
          help={{
            label: tHelp("headlineGapLabel"),
            body: tHelp("headlineGapBody"),
          }}
          {...gapStat(org, tOverview, format)}
        />
        <WidgetCard
          title={tClock("label")}
          icon={Clock01Icon}
          help={{
            label: tHelp("equalityClockLabel"),
            body: tHelp("equalityClockBody"),
          }}
          // Which way the reading goes. Without it the tile is identical for
          // two orgs with mirrored gaps.
          footer={
            org === undefined || org.gapPct === null
              ? undefined
              : tClock(equalityClockDirection(org.gapPct))
          }
        >
          <ClockStat org={org} />
        </WidgetCard>
      </div>
      {/* The finding in words, under the numbers it explains. */}
      <PanelCard
        title={tOverview("meanComparisonTitle")}
        icon={ChartAverageIcon}
      >
        <GapFinding org={org} currency={gap?.currency ?? null} />
      </PanelCard>
      <h2 className="font-semibold text-lg">
        {tOverview("statisticsHeading")}
      </h2>
      {/* Distribution charts, each expandable to a large dialog: the donut
          keeps a single column, the quartile chart takes the remaining two. */}
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
      </div>
    </div>
  )
}
