"use client"

import type { AssistantChartKind } from "@workspace/backend/convex/assistant/tables"
import { useFormatter, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { HeadcountTrend, PayGapTrend } from "@/components/assistant/widget-viz"
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

// A chart part renders LIVE, through the same two hooks (both subscribe to
// the same listPayMappingRuns query use-pay-mapping-headline.ts already
// reads; Convex dedupes identical subscriptions, so calling both here costs
// nothing extra even though only one is shown). Reusing the overview's own
// title/empty strings and chart config (gender-trend-chart-config.ts) means
// this chart can never disagree with the overview about what it is called.
//
// The chart is never aria-hidden: chat has no stat tile stating the same
// figures in words, so the chart IS the content a screen reader needs to
// reach.

// The reference design's chart-card recipe (one plain 1px border, no ring,
// no shadow, content inset by the card's padding): the border must be the
// ONLY frame stroke. The Card's default ring and shadow are box-shadows,
// and inside MessageScrollerViewport (contain: content, composited
// scrolling) box-shadows paint patchily, mostly at the corners (verified
// empirically: a solid red 2px test box-shadow lost its straight edges in
// place while border and outline painted whole). Leaving them under a real
// border reads as an uneven, sometimes-double line; removing them leaves
// one even border that always paints.
const CHART_CARD_FRAME_CLASS = "border border-border ring-0 shadow-none"

export function AssistantChartPart(props: { chart: AssistantChartKind }) {
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
        className={CHART_CARD_FRAME_CLASS}
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
  // hasTrendShape is what tells "no runs yet" apart from "runs exist but
  // none is measurable", which get different empty text below.
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
      className={CHART_CARD_FRAME_CLASS}
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
