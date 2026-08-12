"use client"

import type { ChartConfig } from "@workspace/ui/components/chart"
import { useFormatter, useTranslations } from "next-intl"
import { GenderMenIcon } from "@/components/gender-mark"
import { useOrganization } from "@/components/org-context"
import { HeadcountTrend, PayGapTrend } from "@/components/overview/widget-viz"
import { TrendPanel, type TrendPanelState } from "@/components/trend-panel"
import { useHeadcountTrend } from "@/hooks/use-headcount-trend"
import { usePayGapTrend } from "@/hooks/use-pay-gap-trend"

// A chart part renders LIVE, through the same hooks and chart components the
// overview page reads (both hooks subscribe to the same listPayMappingRuns
// query use-pay-mapping-headline.ts already reads; Convex dedupes identical
// subscriptions, so calling both here costs nothing extra even though only
// one is shown). Reusing the overview's own title/empty strings and chart
// components means the two surfaces can never disagree about what a chart is
// called or how it is drawn.
//
// Unlike the overview's instances, this chart is never aria-hidden: the
// overview hides its charts because the stat tiles above already state the
// same figures in words, and in chat there is no such tile, so the chart IS
// the content a screen reader needs to reach.
//
// The chart config mirrors OverviewCharts' own (overview-widgets.tsx) rather
// than importing it, so this stays a leaf on the shared chart components
// only, not on the overview page module.
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
  const trendConfig = {
    women: { label: genderLabels.women, color: "var(--gender-woman)" },
    men: {
      label: genderLabels.men,
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
  } satisfies ChartConfig
  const gapConfig = {
    gapPct: { label: t("gap.label"), color: "var(--brand)" },
  } satisfies ChartConfig

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
            data={headcount.map((point) => ({
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
        ) : null}
      </TrendPanel>
    )
  }

  const state: TrendPanelState =
    gap === undefined ? "loading" : gap === null ? "empty" : "ready"
  return (
    <TrendPanel
      title={t("gapTrend.title")}
      state={state}
      emptyText={t("trendEmpty")}
    >
      {gap ? (
        <PayGapTrend
          data={gap.map((point) => ({
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
      ) : null}
    </TrendPanel>
  )
}
