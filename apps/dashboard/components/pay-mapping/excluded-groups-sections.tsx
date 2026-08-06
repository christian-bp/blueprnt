"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { fteTotalMonthlyComp } from "@workspace/constants"
import { type GenderStats, genderStats } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { LevelBadge } from "@/components/level-badge"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import {
  type ActionTargetWire,
  type ExcludedGroupsWire,
  type GapGroup,
  type GenderPureGroupWire,
  groupLabel,
  groupMembers,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// FTE-adjusted base salaries of a group's frozen members: the deep-dive's
// own measure, the same primary metric the shown groups use (ADR-0015).
function groupBaseValues(
  rows: PayMappingSnapshotRow[],
  group: {
    roleTitle: string | null
    seniority: string | null
    level: number | null
  }
): number[] {
  return (groupMembers(rows, group) ?? []).map((row) =>
    fteTotalMonthlyComp(row.basicMonthly ?? 0, [], row.ftePercent)
  )
}

// Pure: a gender-pure group's own descriptive statistics. Exported for
// direct unit testing.
export function genderPureStats(
  rows: PayMappingSnapshotRow[],
  group: GenderPureGroupWire
): GenderStats | null {
  return genderStats(groupBaseValues(rows, group))
}

function StatsRow({
  stats,
  currency,
}: {
  stats: GenderStats
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.deepDive")
  const money = useMoney()
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-sm">
      {(
        [
          ["min", stats.min],
          ["median", stats.median],
          ["mean", stats.mean],
          ["max", stats.max],
          ["spread", stats.stdDev],
        ] as const
      ).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1.5">
          <dt>{t(`stats.${key}`)}</dt>
          <dd className="text-foreground tabular-nums">
            {money(value, currency)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// The gender-pure deep-dive (Iteration 2 note 2, part B): groups where every
// member shares a gender. They carry no woman-man comparison, so they sit
// outside the statutory flow entirely (no flag, no documentation duty, not
// in the report). Kept available because internal pay dispersion and
// outliers are still worth understanding, behind an explicit opt-in that
// says exactly that.
export function GenderPureDeepDive({
  excluded,
  rows,
  currency,
  documentation,
}: {
  excluded: ExcludedGroupsWire
  rows: PayMappingSnapshotRow[]
  currency: string
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.deepDive")
  const tDetail = useTranslations("dashboard.payMapping.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const tHelp = useTranslations("dashboard.help")
  const money = useMoney()
  const [open, setOpen] = useState(false)

  if (excluded.genderPure.length === 0) return null

  return (
    <section className="space-y-3 rounded-md border border-dashed px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-sm">
          {t("title", { count: excluded.genderPure.length })}
        </h3>
        <HelpMorphButton label={tHelp("genderPureLabel")}>
          {tHelp("genderPureBody")}
        </HelpMorphButton>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setOpen((shown) => !shown)}
        >
          {open ? t("hide") : t("show")}
        </Button>
      </div>
      {/* The opt-in's own explanation, always visible: the user must know
          what this is BEFORE deciding to open it (Iteration 2 note 2). */}
      <p className="text-muted-foreground text-sm">{t("lead")}</p>

      {open && (
        <div className="space-y-2">
          {excluded.genderPure.map((group) => {
            const stats = genderPureStats(rows, group)
            const members = groupMembers(rows, group) ?? []
            const target: ActionTargetWire = {
              kind: "group",
              scope: "equalWork",
              groupKey: group.key,
            }
            const own = documentationFor(
              target,
              documentation?.actions,
              documentation?.notes
            )
            return (
              <div key={group.key} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{groupLabel(group)}</span>
                  {group.level !== null && <LevelBadge level={group.level} />}
                  <Badge variant="secondary">
                    {t("onlyGender", {
                      gender: tGender(group.gender),
                      count: group.count,
                    })}
                  </Badge>
                  {documentation !== undefined && (
                    <span className="ml-auto flex h-9 items-center gap-1">
                      <DocumentationBadges
                        actions={own.actions}
                        notes={own.notes}
                      />
                      {/* Notes only: a group with no woman-man comparison
                          carries no statutory finding, so it takes no formal
                          action (the backend rejects one). */}
                      <DocumentationMenu
                        runId={documentation.runId}
                        target={target}
                        targetLabel={groupLabel(group)}
                        actions={own.actions}
                        notes={own.notes}
                        currency={currency}
                        locked={documentation.locked}
                        notesOnly
                      />
                    </span>
                  )}
                </div>
                {stats !== null && (
                  <div className="pt-2">
                    <StatsRow stats={stats} currency={currency} />
                  </div>
                )}
                {members.length > 0 && (
                  <div className="overflow-x-auto pt-2">
                    <Table className="min-w-[24rem] table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tDetail("columns.name")}</TableHead>
                          <TableHead className="w-32 text-right">
                            {tDetail("columns.basePay")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.personPublicId}>
                            <TableCell className="truncate">
                              {member.erased
                                ? tDetail("erased")
                                : member.displayName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {money(
                                fteTotalMonthlyComp(
                                  member.basicMonthly ?? 0,
                                  [],
                                  member.ftePercent
                                ),
                                currency
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// The women-ahead info view (Iteration 2 note 3): groups with both genders
// where the women are not behind. They leave the standard flow (the
// statutory duty targets differences to women's disadvantage), but the
// figures stay available as analytical information: no flags, no
// documentation duty, no place in the report.
export function WomenAheadGroups({
  excluded,
  currency,
}: {
  excluded: ExcludedGroupsWire
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.womenAhead")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const money = useMoney()

  if (excluded.reverse.length === 0) return null

  return (
    <Collapsible>
      <section className="space-y-2 rounded-md border border-dashed px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-sm">
            {t("title", { count: excluded.reverse.length })}
          </h3>
          <HelpMorphButton label={tHelp("womenAheadLabel")}>
            {tHelp("womenAheadBody")}
          </HelpMorphButton>
          <CollapsibleTrigger className="group ml-auto flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
            {t("show")}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              aria-hidden="true"
              className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
        </div>
        <p className="text-muted-foreground text-sm">{t("lead")}</p>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="overflow-x-auto pt-2">
            <Table className="min-w-[40rem] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{tGap("group")}</TableHead>
                  <TableHead className="w-20 text-right">
                    {tGap("women")}
                  </TableHead>
                  <TableHead className="w-20 text-right">
                    {tGap("men")}
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    {t("womenMean")}
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    {t("menMean")}
                  </TableHead>
                  <TableHead className="w-28 text-right">
                    {t("womenLead")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excluded.reverse.map((group: GapGroup) => {
                  const metric = primaryGapMetric(group)
                  return (
                    <TableRow key={group.key}>
                      <TableCell className="truncate font-medium">
                        {groupLabel(group)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {group.womenCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {group.menCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {metric.womenMean === null
                          ? "-"
                          : money(metric.womenMean, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {metric.menMean === null
                          ? "-"
                          : money(metric.menMean, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {metric.gapPct === null
                          ? "-"
                          : percentText(metric.gapPct, format)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}

// The silently dropped singletons, stated as a plain count so the analysis
// never looks like it lost groups without saying so (Iteration 2 note 1
// drops them from every surface; the number itself is not a secret).
export function SingletonNote({ excluded }: { excluded: ExcludedGroupsWire }) {
  const t = useTranslations("dashboard.payMapping.deepDive")
  if (excluded.singletonCount === 0) return null
  return (
    <p className="text-muted-foreground text-sm">
      {t("singletons", { count: excluded.singletonCount })}
    </p>
  )
}
