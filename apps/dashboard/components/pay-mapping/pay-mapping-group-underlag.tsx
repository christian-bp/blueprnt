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
import type {
  GapGroup,
  PayMappingSnapshotRow,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayMappingScatter } from "./pay-mapping-scatter"

// A group's own frozen, priced members: rows matching its roleTitle/level/
// band identity (the same identity the engine keys a group on). Shared by
// the equal-work member table and both scopes' scatter embeds below, so
// member matching never drifts between callers. This is its one home,
// module-private since no other file resolves members directly.
function groupMembers(
  rows: PayMappingSnapshotRow[] | undefined,
  group: { roleTitle: string | null; level: string | null; band: number | null }
): PayMappingSnapshotRow[] | undefined {
  return rows?.filter(
    (row) =>
      row.roleTitle === group.roleTitle &&
      row.level === group.level &&
      row.band === group.band &&
      row.basicMonthly !== null
  )
}

// The shared role+level label for an equal-work group, a women-dominated
// group, or one of its comparators. Exported because review-group-step.tsx
// needs the exact same label for its heading and finding sentences.
export function groupLabel(group: {
  roleTitle: string | null
  level: string | null
}): string {
  return [group.roleTitle, group.level]
    .filter((part) => part !== null)
    .join(" · ")
}

// Maps a snapshot row back to whichever group (the dominated group itself,
// or one of its comparators) it belongs to, by the same roleTitle/level/band
// identity groupMembers matches on.
function womenDominatedGroupLabelFor(
  group: WomenDominatedGroupWire
): (row: PayMappingSnapshotRow) => string {
  const entries = [
    {
      roleTitle: group.roleTitle,
      level: group.level,
      band: group.band,
      label: groupLabel(group),
    },
    ...group.comparisons.map((comparison) => ({
      roleTitle: comparison.roleTitle,
      level: comparison.level,
      band: comparison.band,
      label: groupLabel(comparison),
    })),
  ]
  return (row) =>
    entries.find(
      (entry) =>
        entry.roleTitle === row.roleTitle &&
        entry.level === row.level &&
        entry.band === row.band
    )?.label ?? ""
}

type PayMappingGroupUnderlagProps =
  | {
      scope: "equalWork"
      group: GapGroup
      rows: PayMappingSnapshotRow[]
      currency: string
      referenceDateMs: number
    }
  | {
      scope: "equivalentWork"
      group: WomenDominatedGroupWire
      equivalentWork: GapGroup[]
      rows: PayMappingSnapshotRow[]
      currency: string
      referenceDateMs: number
    }

// The equal-work scope's underlying data: the group's own frozen members
// (the priced rows its figures cover) and the scatter scoped to exactly
// those rows.
function EqualWorkUnderlag({
  group,
  rows,
  currency,
  referenceDateMs,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
}) {
  const t = useTranslations("dashboard.payMapping")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tScatter = useTranslations("dashboard.payMapping.scatter")
  const tPeople = useTranslations("dashboard.people")
  const money = useMoney()
  const members = groupMembers(rows, group) ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium text-sm">{tGap("groupMembers")}</h4>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.columns.name")}</TableHead>
              <TableHead className="w-28">
                {t("detail.columns.gender")}
              </TableHead>
              <TableHead className="w-36">
                {t("detail.columns.salary")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Index keys: the frozen member list never reorders, and the
                rows carry no id (erased rows all share one tombstone name, so
                a name-based key would collide and could drop a row). */}
            {members.map((member, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: frozen order, no stable id on the wire
              <TableRow key={index}>
                <TableCell className="truncate font-medium">
                  {member.erased ? t("detail.erased") : member.displayName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tPeople(`gender.${member.gender}`)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {member.basicMonthly !== null && member.currency !== undefined
                    ? money(member.basicMonthly, member.currency)
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PayMappingScatter
        rows={members}
        currency={currency}
        referenceDateMs={referenceDateMs}
        title={tScatter("titleEqualWork")}
      />
    </div>
  )
}

// The equivalentWork scope's underlying data: the full cross-level
// comparison table (or the compliance-positive "nothing out-earns it"
// message), the band's own women-men gap for context, and the scatter over
// the comparison set (the dominated group's members plus every
// comparator's, each labeled with its owning group).
function EquivalentWorkUnderlag({
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
  const bandRow = equivalentWork.find(
    (candidate) => candidate.band === group.band
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
                  {tCols("band")}
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
                      {comparison.band}
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
      {bandRow !== undefined && (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            {bandRow.gapPct === null || bandRow.gapPct === 0
              ? tGap("bandContextNone", { band: group.band })
              : tGap(
                  bandRow.gapPct > 0 ? "bandContext" : "bandContextWomenAhead",
                  {
                    band: group.band,
                    gap: format.number(Math.abs(bandRow.gapPct) / 100, {
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

// The group step's disclosure for the data behind a group's figures: closed
// by default (the primary task is documenting the reason, not re-reading the
// underlying rows) and expandable on demand via a chevron-rotating trigger.
export function PayMappingGroupUnderlag(props: PayMappingGroupUnderlagProps) {
  const t = useTranslations("dashboard.payMapping.review")
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
        {t("showUnderlag")}
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
          {props.scope === "equalWork" ? (
            <EqualWorkUnderlag {...props} />
          ) : (
            <EquivalentWorkUnderlag {...props} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
