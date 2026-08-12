"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { HeadcountTrend, PayGapTrend } from "@/components/overview/widget-viz"
import { TrendPanel, type TrendPanelState } from "@/components/trend-panel"
import { useHeadcountTrend } from "@/hooks/use-headcount-trend"
import { usePayGapTrend } from "@/hooks/use-pay-gap-trend"
import {
  gapChartConfig,
  headcountChartConfig,
  toGapTrendRows,
  toHeadcountTrendRows,
} from "@/lib/gender-trend-chart-config"
import { hasTrendShape } from "@/lib/pay-gap-trend"

// A chart part renders LIVE, through the same hooks and chart components the
// overview page reads (both hooks subscribe to the same listPayMappingRuns
// query use-pay-mapping-headline.ts already reads; Convex dedupes identical
// subscriptions, so calling both here costs nothing extra even though only
// one is shown). Reusing the overview's own title/empty strings, chart
// components, and chart config (gender-trend-chart-config.ts, shared with
// OverviewCharts) means the two surfaces can never disagree about what a
// chart is called or how it is drawn.
//
// Unlike the overview's instances, this chart is never aria-hidden: the
// overview hides its charts because the stat tiles above already state the
// same figures in words, and in chat there is no such tile, so the chart IS
// the content a screen reader needs to reach.
export function AssistantChartPart(props: {
  chart: "headcountTrend" | "payGapTrend"
}) {
  const { orgId } = useOrganization()
  const headcount = useHeadcountTrend(orgId)
  const gap = usePayGapTrend(orgId)
  const format = useFormatter()
  const t = useTranslations("dashboard.overview.widgets")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")

  const genderLabels = { women: tGap("women"), men: tGap("men") }

  if (props.chart === "headcountTrend") {
    const state: TrendPanelState =
      headcount === undefined
        ? "loading"
        : headcount === null
          ? "empty"
          : "ready"
    return (
      <TrendPanel
        title={t("workforce.trendTitle")}
        state={state}
        emptyText={t("trendEmpty")}
      >
        {headcount ? (
          <HeadcountTrend
            data={toHeadcountTrendRows(headcount, format.dateTime)}
            config={headcountChartConfig(genderLabels)}
            labels={genderLabels}
            totalLabel={t("workforce.trendLabel")}
          />
        ) : null}
      </TrendPanel>
    )
  }

  // A run with no measurable gap (a gender absent among its priced rows)
  // contributes no reading at all: without this gate, one run whose only
  // point is null rendered a titled "ready" panel with an invisible chart.
  // Mirrors OverviewCharts' own gate (and its "only one is measurable" empty
  // text) for this exact case, via the same hasTrendShape predicate.
  const measuredGap = gap?.filter((point) => point.gapPct !== null) ?? []
  const gapReady =
    gap !== undefined && gap !== null && hasTrendShape(measuredGap)
  const gapState: TrendPanelState =
    gap === undefined ? "loading" : gapReady ? "ready" : "empty"
  const gapEmptyText =
    gap !== undefined &&
    gap !== null &&
    hasTrendShape(gap) &&
    !hasTrendShape(measuredGap)
      ? t("gapTrend.unmeasuredEmpty")
      : t("trendEmpty")

  return (
    <TrendPanel
      title={t("gapTrend.title")}
      state={gapState}
      emptyText={gapEmptyText}
    >
      {gap && gapReady ? (
        <PayGapTrend
          data={toGapTrendRows(gap, format.dateTime)}
          config={gapChartConfig(t("gap.label"))}
          seriesLabel={t("gap.label")}
          unmeasuredLabel={t("gapTrend.unmeasured")}
        />
      ) : null}
    </TrendPanel>
  )
}
