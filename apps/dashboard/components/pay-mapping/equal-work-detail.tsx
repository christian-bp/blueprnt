"use client"

import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import { EvidenceDisclosure } from "./evidence-disclosure"
import { GroupMemberTable } from "./group-member-table"
import { PayGapDotPlot } from "./pay-gap-dot-plot"
import {
  type ActionTargetWire,
  type GapGroup,
  type GapMetric,
  groupLabel,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// One metric's compact "Kv. medel · M. medel · gap" line for the summary
// strip; null means when a side is missing render nothing (the entry
// conditions make that unreachable for shown groups, kept total anyway).
// Exported: the per-level likvärdigt analysis renders the same line.
export function MetricLine({
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
  documentation,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
  // The run's work layer (ADR-0015): present, the group heading and every
  // member row carry their own documentation badge + "..." menu.
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
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

  const groupTarget: ActionTargetWire = {
    kind: "group",
    scope: "equalWork",
    groupKey: group.key,
  }
  const groupDocs = documentationFor(
    groupTarget,
    documentation?.actions,
    documentation?.notes
  )

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        {/* The group's own documentation affordance, in a fixed-height row
            so gaining a badge never shifts the summary beneath. */}
        {documentation !== undefined && (
          // Right-aligned: with no documentation yet the row is a single
          // "..." trigger, which reads as an orphaned icon on the left and
          // as the section's own action on the right.
          <div className="flex h-9 items-center justify-end gap-2">
            <DocumentationBadges
              actions={groupDocs.actions}
              notes={groupDocs.notes}
            />
            <DocumentationMenu
              runId={documentation.runId}
              target={groupTarget}
              targetLabel={groupLabel(group)}
              actions={groupDocs.actions}
              notes={groupDocs.notes}
              currency={currency}
              locked={documentation.locked}
            />
          </div>
        )}
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
      {/* The summary strip and the plot stay visible: they are WHY this
          group is flagged. The per-person table is the evidence behind
          that, collapsed so every opened step starts at roughly the same
          height with the form at the bottom (rung 3). */}
      <EvidenceDisclosure
        label={tGapRoot("groupMembers")}
        count={group.womenCount + group.menCount}
      >
        <div className="space-y-2">
          {/* The caption gives the help button something to sit beside: a
              lone icon at the top of the panel explains nothing. */}
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
            {t("diffCaption")}
            <HelpMorphButton label={tHelp("payGapMemberDiffLabel")}>
              {tHelp("payGapMemberDiffBody")}
            </HelpMorphButton>
          </p>
          <GroupMemberTable
            group={group}
            rows={rows}
            currency={currency}
            {...(documentation === undefined
              ? {}
              : {
                  documentation: {
                    runId: documentation.runId,
                    scope: "equalWork" as const,
                    actions: documentation.actions,
                    notes: documentation.notes,
                    locked: documentation.locked,
                  },
                })}
          />
        </div>
      </EvidenceDisclosure>
    </div>
  )
}
