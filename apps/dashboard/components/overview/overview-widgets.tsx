"use client"

import {
  Briefcase01Icon,
  ChartHistogramIcon,
  JusticeScale01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import type { ChartConfig } from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { GenderMenIcon } from "@/components/gender-mark"
import { HeadcountTrend, PayGapTrend } from "@/components/overview/widget-viz"
import { PanelCard } from "@/components/panel-card"
import { WidgetCard } from "@/components/widget-card"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import { WIDGET_CHART_HEIGHT } from "@/lib/chart-style"
import { type HeadcountPoint, headcountTotal } from "@/lib/headcount-trend"
import { hasTrendShape, type PayGapPoint } from "@/lib/pay-gap-trend"
import type { LevelOverview } from "@/lib/level-overview"
import { percentText } from "@/lib/percent"
import type { OverviewStats } from "@/lib/todo"

// A skeleton bar centred in its own line, so the slot measures whatever the
// surrounding type would have measured rather than the bar's own height.
function StatBar({ className }: { className: string }) {
  return (
    <span className="flex items-center">
      <Skeleton className={className} />
    </span>
  )
}

// One tile of the stat strip: the label, the figure it labels, and the line
// that qualifies it, in that order down the card. A figure that has not
// resolved yet renders as a bar in the same slot, so a tile never changes
// height between its two states.
function StatTile({
  label,
  icon,
  href,
  value,
  caption,
}: {
  label: string
  icon: IconSvgElement
  href: string
  value: ReactNode | undefined
  caption: ReactNode
}) {
  return (
    <WidgetCard
      title={label}
      icon={icon}
      href={href}
      // The bars sit in the SAME line boxes the loaded type creates, not at
      // their own heights: CardTitle is leading-normal at text-2xl/text-3xl
      // (36-45px) and the footer is text-sm (20px), so bare h-8/h-4 bars left
      // each tile short and the whole strip grew on arrival.
      value={value ?? <StatBar className="h-7 w-16" />}
      footer={value === undefined ? <StatBar className="h-4 w-24" /> : caption}
    />
  )
}

// The dashboard's stat strip: four figures that say where the organization
// stands, each one line, each linking to its own surface. The charts that
// used to live inside these cards moved to the panels below: a tile carries
// one number, a panel carries a shape.
export function OverviewWidgets({
  stats,
  levelOverview,
  payMappingHeadline,
}: {
  stats: OverviewStats | undefined
  levelOverview: LevelOverview | undefined | null
  payMappingHeadline: PayMappingHeadline | undefined | null
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const format = useFormatter()

  const gapValue =
    payMappingHeadline === undefined
      ? undefined
      : payMappingHeadline === null
        ? t("gap.notStarted")
        : payMappingHeadline.gapPct === null ||
            payMappingHeadline.flag === "insufficient"
          ? t("gap.insufficientValue")
          : percentText(payMappingHeadline.gapPct, format)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label={t("workforce.label")}
        icon={UserGroupIcon}
        href="/people"
        value={stats?.totalPeople}
        caption={
          stats === undefined
            ? ""
            : stats.totalPeople === 0
              ? t("workforce.importPrompt")
              : stats.unclassifiedCount > 0
                ? t("workforce.unclassified", {
                    count: stats.unclassifiedCount,
                  })
                : t("workforce.allClassified")
        }
      />
      <StatTile
        label={t("roles.label")}
        icon={Briefcase01Icon}
        href="/roles"
        value={
          levelOverview === undefined
            ? undefined
            : (levelOverview?.totalRoles ?? 0)
        }
        caption={
          levelOverview === undefined || levelOverview === null
            ? t("roles.empty")
            : t("roles.caption", { count: levelOverview.levelCount })
        }
      />
      <StatTile
        label={t("gap.label")}
        icon={JusticeScale01Icon}
        href={
          payMappingHeadline === undefined || payMappingHeadline === null
            ? "/pay-mappings"
            : `/pay-mappings/${payMappingHeadline.slug}`
        }
        value={gapValue}
        caption={
          payMappingHeadline === undefined || payMappingHeadline === null
            ? t("gap.prompt")
            : payMappingHeadline.label
        }
      />
      <StatTile
        label={t("levels.label")}
        icon={ChartHistogramIcon}
        href="/work"
        value={
          levelOverview === undefined
            ? undefined
            : (levelOverview?.levelCount ?? 0)
        }
        caption={
          levelOverview === undefined || levelOverview === null
            ? t("levels.empty")
            : t("levels.caption", { count: levelOverview.totalRoles })
        }
      />
    </div>
  )
}

type TrendState = "loading" | "empty" | "ready"

// What a trend panel shows when it has no line to draw, in the exact height
// the chart will occupy so the panel never changes size.
//
// While the data is still loading it shows a placeholder line, NOT the empty
// sentence: "you need two pay mappings" is a claim about the org, and a
// surface that has not heard back yet cannot make it.
//
// The sentence is deliberately not aria-hidden, unlike the charts it stands
// in for. A chart is decorative here (the tiles above carry its numbers in
// words) but this sentence IS the content: it is the only thing telling a
// reader why the panel is blank.
function TrendBody({ state, empty }: { state: TrendState; empty: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        WIDGET_CHART_HEIGHT
      )}
    >
      {state === "loading" ? (
        <Skeleton className="h-4 w-48 max-w-full" />
      ) : (
        <p className="max-w-64 text-balance text-center text-muted-foreground text-sm">
          {empty}
        </p>
      )}
    </div>
  )
}

// The two things that MOVE, as panels: how the workforce and the pay gap
// have gone across pay mappings. Each chart is decorative in the
// accessibility sense (the tiles above carry the numbers in words), so it is
// aria-hidden inside its own titled panel.
//
// Both are histories, on purpose. A front page's job is "how are we doing",
// and a distribution (roles per level, the gender split per pay quartile)
// answers "how are we arranged" instead: a shape that barely changes between
// visits, already shown full-size on the surface that owns it. The two
// panels that used to draw those distributions were the least useful things
// on the page.
export function OverviewCharts({
  stats,
  headcountTrend,
  gapTrend,
}: {
  stats: OverviewStats | undefined
  headcountTrend: HeadcountPoint[] | undefined | null
  gapTrend: PayGapPoint[] | undefined | null
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const format = useFormatter()

  const genderLabels = { women: tGap("women"), men: tGap("men") }
  const trendConfig = {
    women: { label: genderLabels.women, color: "var(--gender-woman)" },
    men: {
      label: genderLabels.men,
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
  } satisfies ChartConfig

  // THREE states, not two. Folding "still loading" into the same branch as
  // "not enough runs" made both panels assert "a trend appears once you have
  // two pay mappings" on first paint, which the app cannot know yet and which
  // was sometimes false a moment later.
  const workforceState: TrendState =
    stats === undefined || headcountTrend === undefined
      ? "loading"
      : stats.totalPeople > 0 &&
          headcountTrend !== null &&
          hasTrendShape(headcountTrend.filter((p) => headcountTotal(p) > 0))
        ? "ready"
        : "empty"

  // Same rule: one mapping is a dot, not a trend, and a mapping with no
  // measurable gap contributes no reading at all.
  const gapState: TrendState =
    gapTrend === undefined
      ? "loading"
      : gapTrend !== null &&
          hasTrendShape(gapTrend.filter((point) => point.gapPct !== null))
        ? "ready"
        : "empty"

  const gapConfig = {
    gapPct: { label: t("gap.label"), color: "var(--brand)" },
  } satisfies ChartConfig

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <PanelCard
        title={t("workforce.trendTitle")}
        icon={UserGroupIcon}
        action={{ label: t("workforce.action"), href: "/people" }}
        bleed
      >
        {workforceState === "ready" ? (
          <div aria-hidden="true">
            <HeadcountTrend
              data={(headcountTrend ?? []).map((point) => ({
                label: point.runLabel,
                caption: format.dateTime(new Date(point.date), {
                  dateStyle: "medium",
                }),
                women: point.women,
                men: point.men,
              }))}
              config={trendConfig}
              labels={genderLabels}
              totalLabel={t("workforce.trendLabel")}
            />
          </div>
        ) : (
          <TrendBody state={workforceState} empty={t("trendEmpty")} />
        )}
      </PanelCard>
      {/* Bleeds for the same reason its sibling does, and because the row
          sizes to its tallest card: a padded panel beside a bleeding one
          stretches the bleeding one, which then holds its chart 16px above
          its own bottom edge. The two have to agree. */}
      <PanelCard
        title={t("gapTrend.title")}
        icon={JusticeScale01Icon}
        action={{ label: t("gapTrend.action"), href: "/pay-mappings" }}
        bleed
      >
        {gapState === "ready" ? (
          <div aria-hidden="true">
            <PayGapTrend
              data={(gapTrend ?? []).map((point) => ({
                label: point.runLabel,
                caption: format.dateTime(new Date(point.date), {
                  dateStyle: "medium",
                }),
                gapPct: point.gapPct,
              }))}
              config={gapConfig}
              seriesLabel={t("gap.label")}
              unmeasuredLabel={t("gapTrend.unmeasured")}
            />
          </div>
        ) : (
          <TrendBody state={gapState} empty={t("trendEmpty")} />
        )}
      </PanelCard>
    </div>
  )
}
