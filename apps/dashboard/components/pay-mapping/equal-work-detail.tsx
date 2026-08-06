"use client"

import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import { GroupMemberTable } from "./group-member-table"
import { PayGapDotPlot } from "./pay-gap-dot-plot"
import {
  type GapGroup,
  type GapMetric,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// One metric's compact "Kv. medel · M. medel · gap" line for the summary
// strip; null means when a side is missing render nothing (the entry
// conditions make that unreachable for shown groups, kept total anyway).
function MetricLine({
  metric,
  currency,
  muted = false,
  prefix,
}: {
  metric: GapMetric
  currency: string
  muted?: boolean
  prefix?: string
}) {
  const t = useTranslations("dashboard.payMapping.detail.summary")
  const format = useFormatter()
  const money = useMoney()
  if (metric.womenMean === null || metric.menMean === null) return null
  const gap =
    metric.gapKr !== null && metric.gapPct !== null
      ? t("gap", {
          kr: money(-metric.gapKr, currency, { signed: true }),
          pct: percentText(metric.gapPct, format),
        })
      : null
  return (
    <p
      className={
        muted
          ? "text-muted-foreground text-xs"
          : "text-muted-foreground text-sm"
      }
    >
      {prefix !== undefined && <span>{prefix} </span>}
      {t("womenMean", { value: money(metric.womenMean, currency) })}
      {" · "}
      {t("menMean", { value: money(metric.menMean, currency) })}
      {gap !== null && (
        <>
          {" · "}
          <span className={muted ? undefined : "font-medium text-foreground"}>
            {gap}
          </span>
        </>
      )}
    </p>
  )
}

// The equal-work detail view (Iteration 2 note 3): a compact summary strip
// (counts, per-gender means, the gap in kr and %), the swimlane dot plot as
// the first visual, then the individual member table. The group's primary
// metric leads (base salary, or total comp for a tccDriven group); the
// other metric rides along as a muted parallel line, and the table always
// carries both columns.
export function EqualWorkDetail({
  group,
  rows,
  currency,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.detail")
  const tGapRoot = useTranslations("dashboard.payMapping.gap")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const tHelp = useTranslations("dashboard.help")

  const primary = primaryGapMetric(group)
  const secondary = group.tccDriven ? group.base : group.tcc
  const secondaryPrefix = group.tccDriven
    ? t("summary.baseLabel")
    : t("summary.tccLabel")

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-sm">
          {tGap("women")}:{" "}
          <span className="tabular-nums">{group.womenCount}</span>
          {" · "}
          {tGap("men")}: <span className="tabular-nums">{group.menCount}</span>
        </p>
        <MetricLine metric={primary} currency={currency} />
        <MetricLine
          metric={secondary}
          currency={currency}
          muted
          prefix={secondaryPrefix}
        />
      </div>
      <PayGapDotPlot group={group} rows={rows} currency={currency} />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{tGapRoot("groupMembers")}</h4>
          <HelpMorphButton label={tHelp("payGapMemberDiffLabel")}>
            {tHelp("payGapMemberDiffBody")}
          </HelpMorphButton>
        </div>
        <GroupMemberTable group={group} rows={rows} currency={currency} />
      </div>
    </div>
  )
}
