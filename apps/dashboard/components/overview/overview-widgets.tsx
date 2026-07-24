"use client"

import type { ChartConfig } from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { OverviewWidgetCard } from "@/components/overview/widget-card"
import {
  BandBars,
  HeadcountArea,
  QuartileSplitBars,
} from "@/components/overview/widget-viz"
import { PayGapFlagBadge } from "@/components/pay-mapping/pay-gap-flag-badge"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import type { BandOverview } from "@/lib/band-overview"
import type { HeadcountPoint } from "@/lib/headcount-trend"
import { percentText } from "@/lib/percent"
import type { OverviewStats } from "@/lib/todo"

// Shared loading placeholder for a single OverviewWidgetCard slot: the same
// chrome (title, skeleton headline, real action link) used both for the
// initial three-up load (stats undefined) and for a single card whose own
// independent query (bandOverview, payMappingHeadline) resolves after
// stats, so every loading state in this grid measures identically and
// there is one source of truth for the skeleton card. The viz area itself
// stays empty (no shimmer bar) rather than a skeleton, reserving the exact
// h-14 the loaded chart occupies so the card does not change height when
// the chart appears.
function renderSkeletonCard(label: string, viewLabel: string, href: string) {
  return (
    <OverviewWidgetCard
      title={label}
      headline={<Skeleton className="h-6 w-24" />}
      action={{ label: viewLabel, href }}
      viz={<div className="h-14 w-full" />}
    />
  )
}

// The overview's three always-present data cards: Workforce, Band
// distribution, and Pay gap. Unlike the previous domain-card grid, no item
// rows live here (they moved to TodoList): each card is a stat headline plus
// a decorative viz on the shared OverviewWidgetCard chrome, and every card
// renders a graceful empty state rather than being omitted, so the 3-card
// grid never reflows as its own data arrives.
export function OverviewWidgets({
  stats,
  bandOverview,
  payMappingHeadline,
  headcountTrend,
}: {
  stats: OverviewStats | undefined
  bandOverview: BandOverview | undefined | null
  payMappingHeadline: PayMappingHeadline | undefined | null
  headcountTrend: HeadcountPoint[] | undefined | null
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const format = useFormatter()

  if (stats === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {renderSkeletonCard(
          t("workforce.label"),
          t("workforce.view"),
          "/people"
        )}
        {renderSkeletonCard(t("bands.label"), t("bands.view"), "/work")}
        {renderSkeletonCard(t("gap.label"), t("gap.view"), "/pay-mappings")}
      </div>
    )
  }

  // --- Workforce: headcount, classified/unclassified split. ---
  const workforceHeadline =
    stats.totalPeople === 0 ? (
      t("workforce.importPrompt")
    ) : (
      <div className="flex flex-col gap-1">
        <span>{t("workforce.headcount", { count: stats.totalPeople })}</span>
        <span className="font-normal text-muted-foreground text-xs">
          {stats.unclassifiedCount > 0
            ? t("workforce.unclassified", { count: stats.unclassifiedCount })
            : t("workforce.allClassified")}
        </span>
      </div>
    )

  // --- Workforce viz: an area chart of headcount per pay-mapping run over
  // time (Polyform stat-card style), reserving the same h-14 the other
  // cards' viz occupies so nothing shifts as headcountTrend's own
  // subscription resolves. No chart while there are no people yet (the
  // import prompt already carries that state), while the trend is still
  // loading, or when there is no run yet whose headcount is measurable
  // (mirrors Polyform's own hasData guard: a single point still counts).
  const trendConfig = {
    value: { label: t("workforce.trendLabel"), color: "var(--brand)" },
  } satisfies ChartConfig
  let workforceViz: ReactNode
  if (
    stats.totalPeople === 0 ||
    headcountTrend === undefined ||
    headcountTrend === null ||
    !headcountTrend.some((p) => p.value > 0)
  ) {
    workforceViz = <div className="h-14 w-full" />
  } else {
    workforceViz = (
      <HeadcountArea
        data={headcountTrend}
        config={trendConfig}
        formatDate={(value) =>
          format.dateTime(new Date(value), { dateStyle: "medium" })
        }
      />
    )
  }

  // --- Band distribution: role/band narrative, empty until a band resolves.
  // bandOverview is its own subscription (getResults) that can still be
  // loading after stats resolves, so its own undefined is a skeleton card,
  // never the null empty state.
  let bandCard: ReactNode
  if (bandOverview === undefined) {
    bandCard = renderSkeletonCard(t("bands.label"), t("bands.view"), "/work")
  } else {
    const bandsHeadline =
      bandOverview === null
        ? t("bands.empty")
        : t("bands.headline", {
            roles: bandOverview.totalRoles,
            bands: bandOverview.bandCount,
          })
    const bandCounts = bandOverview === null ? [] : bandOverview.bandCounts
    bandCard = (
      <OverviewWidgetCard
        title={t("bands.label")}
        headline={bandsHeadline}
        action={{ label: t("bands.view"), href: "/work" }}
        viz={<BandBars counts={bandCounts} />}
      />
    )
  }

  // --- Pay gap: measurable headline once a run's gap resolves; a run that
  // exists but has no measurable gap (too few people, or an "insufficient"
  // flag) gets its own state so it never reads as "Not started"; else the
  // plain not-started text. payMappingHeadline is its own subscription
  // (listPayMappingRuns + getPayMappingGap) that can still be loading after
  // stats resolves, so its own undefined is a skeleton card, never the
  // not-started text.
  let gapCard: ReactNode
  if (payMappingHeadline === undefined) {
    gapCard = renderSkeletonCard(t("gap.label"), t("gap.view"), "/pay-mappings")
  } else if (payMappingHeadline === null) {
    // Four flat, zero-total quartile columns: an empty-but-shaped
    // placeholder, keeping the pay-gap card's viz area the same size before
    // and after a measurable gap resolves.
    const emptyQuartiles = Array.from({ length: 4 }, () => ({
      women: 0,
      men: 0,
    }))
    gapCard = (
      <OverviewWidgetCard
        title={t("gap.label")}
        headline={
          <div className="flex flex-col gap-1">
            <span>{t("gap.notStarted")}</span>
            <span className="font-normal text-muted-foreground text-xs">
              {t("gap.prompt")}
            </span>
          </div>
        }
        action={{ label: t("gap.view"), href: "/pay-mappings" }}
        viz={<QuartileSplitBars quartiles={emptyQuartiles} />}
      />
    )
  } else if (
    payMappingHeadline.gapPct === null ||
    payMappingHeadline.flag === "insufficient"
  ) {
    gapCard = (
      <OverviewWidgetCard
        title={t("gap.label")}
        headline={
          <div className="flex flex-col gap-1">
            <span>{t("gap.insufficientValue")}</span>
            <span className="font-normal text-muted-foreground text-xs">
              {payMappingHeadline.label}
            </span>
          </div>
        }
        action={{
          label: t("gap.view"),
          href: `/pay-mappings/${payMappingHeadline.slug}`,
        }}
        viz={<QuartileSplitBars quartiles={payMappingHeadline.quartiles} />}
      />
    )
  } else {
    gapCard = (
      <OverviewWidgetCard
        title={t("gap.label")}
        headline={
          <div className="flex flex-col gap-1">
            <span>{percentText(payMappingHeadline.gapPct, format)}</span>
            <span className="font-normal text-muted-foreground text-xs">
              {payMappingHeadline.label}
            </span>
          </div>
        }
        badge={<PayGapFlagBadge flag={payMappingHeadline.flag} />}
        action={{
          label: t("gap.view"),
          href: `/pay-mappings/${payMappingHeadline.slug}`,
        }}
        viz={<QuartileSplitBars quartiles={payMappingHeadline.quartiles} />}
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OverviewWidgetCard
        title={t("workforce.label")}
        headline={workforceHeadline}
        action={{ label: t("workforce.view"), href: "/people" }}
        viz={workforceViz}
      />
      {bandCard}
      {gapCard}
    </div>
  )
}
