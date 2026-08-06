"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import {
  type GapGroup,
  groupLabel,
  groupMembers,
  type PayMappingSnapshotRow,
  type WomenDominatedComparisonWire,
  type WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayMappingScatter } from "./pay-mapping-scatter"

// Maps a snapshot row back to whichever group (the dominated group itself,
// or one of its comparators) it belongs to, by the same roleTitle/seniority/
// level identity groupMembers matches on.
function womenDominatedGroupLabelFor(
  group: WomenDominatedGroupWire
): (row: PayMappingSnapshotRow) => string {
  const entries = [
    {
      roleTitle: group.roleTitle,
      seniority: group.seniority,
      level: group.level,
      label: groupLabel(group),
    },
    ...group.comparisons.map((comparison) => ({
      roleTitle: comparison.roleTitle,
      seniority: comparison.seniority,
      level: comparison.level,
      label: groupLabel(comparison),
    })),
  ]
  return (row) =>
    entries.find(
      (entry) =>
        entry.roleTitle === row.roleTitle &&
        entry.seniority === row.seniority &&
        entry.level === row.level
    )?.label ?? ""
}

// The women-dominated (equivalentWork) scope's underlying data: the full
// cross-level comparison table (or the compliance-positive "nothing
// out-earns it" message), the level's own women-men gap for context, and
// the scatter over the comparison set (the dominated group's members plus
// every comparator's, each labeled with its owning group). The equal-work
// scope no longer discloses underlag here: its detail view (EqualWorkDetail)
// renders the members and plot inline (Iteration 2 note 3).
function UnderlyingDataContent({
  group,
  equivalentWork,
  rows,
  currency,
  referenceDateMs,
}: {
  group: WomenDominatedGroupWire
  equivalentWork: GapGroup[]
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
}) {
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tCols = useTranslations("dashboard.payMapping.gap.columns")
  const tHelp = useTranslations("dashboard.help")
  const tScatter = useTranslations("dashboard.payMapping.scatter")
  const format = useFormatter()
  const money = useMoney()
  const percentText = (pct: number) =>
    format.number(pct / 100, { style: "percent", maximumFractionDigits: 1 })
  const moneyText = (value: number) => money(value, currency)
  const levelRow = equivalentWork.find(
    (candidate) => candidate.level === group.level
  )
  const scatterRows = [
    ...(groupMembers(rows, group) ?? []),
    ...group.comparisons.flatMap(
      (comparison) => groupMembers(rows, comparison) ?? []
    ),
  ]
  const groupLabelFor = womenDominatedGroupLabelFor(group)

  return (
    <div className="space-y-4">
      {group.comparisons.length === 0 ? (
        // Stated in words, not an empty-bodied table: this is the
        // compliance-positive result (nothing out-earns the group).
        <p className="text-muted-foreground text-sm">{tGap("noComparators")}</p>
      ) : (
        <div className="space-y-2">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-right">
                  {tCols("level")}
                </TableHead>
                <TableHead>{tCols("group")}</TableHead>
                <TableHead className="w-20 text-right">
                  {tCols("headcount")}
                </TableHead>
                <TableHead className="w-28 text-right">
                  {tCols("womenShare")}
                </TableHead>
                <TableHead className="w-32 text-right">
                  {tCols("mean")}
                </TableHead>
                <TableHead className="w-24 text-right">
                  {tCols("diffPct")}
                </TableHead>
                <TableHead className="w-32 text-right">
                  {tCols("diffSek")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.comparisons.map(
                (comparison: WomenDominatedComparisonWire) => (
                  <TableRow key={comparison.key}>
                    <TableCell className="text-right tabular-nums">
                      {comparison.level}
                    </TableCell>
                    <TableCell className="truncate font-medium">
                      {groupLabel(comparison)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {comparison.headcount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {percentText(comparison.womenSharePct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyText(comparison.meanComp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {comparison.diffPct === null
                        ? "-"
                        : percentText(comparison.diffPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyText(comparison.diffSek)}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {levelRow !== undefined && (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            {/* The level context reads the BASE metric: grundlön is the
                primary group measure (ADR-0015). */}
            {levelRow.base.gapPct === null || levelRow.base.gapPct === 0
              ? tGap("levelContextNone", { level: group.level })
              : tGap(
                  levelRow.base.gapPct > 0
                    ? "levelContext"
                    : "levelContextWomenAhead",
                  {
                    level: group.level,
                    gap: format.number(Math.abs(levelRow.base.gapPct) / 100, {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }),
                  }
                )}
          </p>
          <HelpMorphButton label={tHelp("payGapEquivalentWorkLabel")}>
            {tHelp("payGapEquivalentWorkBody")}
          </HelpMorphButton>
        </div>
      )}
      <PayMappingScatter
        rows={scatterRows}
        currency={currency}
        referenceDateMs={referenceDateMs}
        groupLabelFor={groupLabelFor}
        title={tScatter("titleEquivalentWork")}
      />
    </div>
  )
}

// The women-dominated group step's disclosure for the data behind its
// figures: closed by default (the primary task is documenting the reason,
// not re-reading the underlying rows) and expandable on demand via a
// chevron-rotating trigger.
export function WomenDominatedUnderlyingData(props: {
  group: WomenDominatedGroupWire
  equivalentWork: GapGroup[]
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
}) {
  const t = useTranslations("dashboard.payMapping.review")
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
        {t("showUnderlyingData")}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      {/* Split per docs/ui-animation.md rule 2: the outer panel carries ONLY
          animated geometry (height, via base-ui's own
          --collapsible-panel-height) and overflow-hidden, no padding/border;
          an inner div carries the spacing, so height:0 truly means zero. */}
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="pt-4">
          <UnderlyingDataContent {...props} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
