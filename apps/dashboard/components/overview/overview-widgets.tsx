"use client"

import {
  Briefcase01Icon,
  ChartHistogramIcon,
  JusticeScale01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HeadcountTrend, PayGapTrend } from "@/components/overview/widget-viz"
import { TrendPanel, type TrendPanelState } from "@/components/trend-panel"
import { StatBar, WidgetCard } from "@/components/widget-card"
import {
  gapChartConfig,
  headcountChartConfig,
  toGapTrendRows,
  toHeadcountTrendRows,
} from "@/lib/gender-trend-chart-config"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import { type HeadcountPoint, headcountTotal } from "@/lib/headcount-trend"
import { hasTrendShape, type PayGapPoint } from "@/lib/pay-gap-trend"
import type { LevelOverview } from "@/lib/level-overview"
import { percentText } from "@/lib/percent"
import type { OverviewStats } from "@/lib/todo"

// One tile of the stat strip: the label, the figure it labels, then the two
// lines that qualify it, in that order down the card. `caption` is the
// statement (what state the figure is in) and `note` says what the figure
// counts; these tiles have no history to trend against, so the statement
// carries a state rather than a movement. A figure that has not resolved yet
// renders as a bar in the same slot, so a tile never changes height between
// its two states.
function StatTile({
  label,
  icon,
  href,
  value,
  caption,
  note,
}: {
  label: string
  icon: IconSvgElement
  href: string
  value: ReactNode | undefined
  caption: ReactNode
  note: ReactNode
}) {
  return (
    <WidgetCard
      title={label}
      icon={icon}
      href={href}
      // The bars sit in the SAME line boxes the loaded type creates, not at
      // their own heights: CardTitle is leading-normal at text-2xl/text-3xl
      // (36-45px) and the footer lines are text-sm (20px), so bare h-8/h-4
      // bars left each tile short and the whole strip grew on arrival.
      value={value ?? <StatBar className="h-7 w-16" />}
      footer={value === undefined ? <StatBar className="h-4 w-28" /> : caption}
      note={value === undefined ? <StatBar className="h-4 w-24" /> : note}
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        note={t("workforce.note")}
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
        note={t("roles.note")}
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
        note={t("gap.note")}
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
        note={t("levels.note")}
      />
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
  const trendConfig = headcountChartConfig(genderLabels)

  // THREE states, not two. Folding "still loading" into the same branch as
  // "not enough runs" made both panels assert "a trend appears once you have
  // two pay mappings" on first paint, which the app cannot know yet and which
  // was sometimes false a moment later.
  const workforceState: TrendPanelState =
    stats === undefined || headcountTrend === undefined
      ? "loading"
      : stats.totalPeople > 0 &&
          headcountTrend !== null &&
          hasTrendShape(headcountTrend.filter((p) => headcountTotal(p) > 0))
        ? "ready"
        : "empty"

  // Same rule: one mapping is a dot, not a trend, and a mapping with no
  // measurable gap contributes no reading at all.
  const gapState: TrendPanelState =
    gapTrend === undefined
      ? "loading"
      : gapTrend !== null &&
          hasTrendShape(gapTrend.filter((point) => point.gapPct !== null))
        ? "ready"
        : "empty"

  // Why the gap panel is empty, which is not always "you need two mappings":
  // an org can have four and still have fewer than two MEASURABLE gaps (a
  // mapping where one gender is absent among the priced rows produces no
  // reading). Telling that org to run another mapping is both false about
  // their own data and a next step that would not fix anything.
  const gapEmptyText =
    gapTrend !== null &&
    gapTrend !== undefined &&
    hasTrendShape(gapTrend) &&
    !hasTrendShape(gapTrend.filter((point) => point.gapPct !== null))
      ? t("gapTrend.unmeasuredEmpty")
      : t("trendEmpty")

  const gapConfig = gapChartConfig(t("gap.label"))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TrendPanel
        title={t("workforce.trendTitle")}
        icon={UserGroupIcon}
        action={{ label: t("workforce.action"), href: "/people" }}
        state={workforceState}
        emptyText={t("trendEmpty")}
      >
        {/* Decorative: the tiles above already carry these numbers in words.
            Hidden here, at the call site, not inside TrendPanel, because a
            surface with no matching tile (an in-chat chart, say) needs its
            chart to stay in the tree. */}
        <div aria-hidden="true">
          <HeadcountTrend
            data={toHeadcountTrendRows(headcountTrend ?? [], format.dateTime)}
            config={trendConfig}
            labels={genderLabels}
            totalLabel={t("workforce.trendLabel")}
          />
        </div>
      </TrendPanel>
      <TrendPanel
        title={t("gapTrend.title")}
        icon={JusticeScale01Icon}
        action={{ label: t("gapTrend.action"), href: "/pay-mappings" }}
        state={gapState}
        emptyText={gapEmptyText}
      >
        <div aria-hidden="true">
          <PayGapTrend
            data={toGapTrendRows(gapTrend ?? [], format.dateTime)}
            config={gapConfig}
            seriesLabel={t("gap.label")}
            unmeasuredLabel={t("gapTrend.unmeasured")}
          />
        </div>
      </TrendPanel>
    </div>
  )
}
