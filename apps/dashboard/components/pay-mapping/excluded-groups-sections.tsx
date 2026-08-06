"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { type GenderStats, genderStats } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { LevelBadge } from "@/components/level-badge"
import { TrackBadge } from "@/components/track-badge"
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
  fteBaseMonthly,
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
  return (groupMembers(rows, group) ?? []).map(fteBaseMonthly)
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
// outliers are still worth understanding. The opt-in that guards it is the
// supplementary drawer's own accordion (Iteration 3), which is why this
// component carries no heading, count or open control of its own.
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("lead")}</p>
        <HelpMorphButton label={tHelp("genderPureLabel")}>
          {tHelp("genderPureBody")}
        </HelpMorphButton>
      </div>
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
                {/* Track is constant within a group (one role); frozen
                        data carries only the key, so the badge shows it. */}
                {members[0] !== undefined && (
                  <TrackBadge
                    trackKey={members[0].trackKey}
                    name={members[0].trackKey}
                    short
                  />
                )}
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
                            {money(fteBaseMonthly(member), currency)}
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
    </div>
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("lead")}</p>
        <HelpMorphButton label={tHelp("womenAheadLabel")}>
          {tHelp("womenAheadBody")}
        </HelpMorphButton>
      </div>
      <div className="overflow-x-auto pt-2">
        <Table className="min-w-[40rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>{tGap("group")}</TableHead>
              <TableHead className="w-20 text-right">{tGap("women")}</TableHead>
              <TableHead className="w-20 text-right">{tGap("men")}</TableHead>
              <TableHead className="w-32 text-right">
                {t("womenMean")}
              </TableHead>
              <TableHead className="w-32 text-right">{t("menMean")}</TableHead>
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
    </div>
  )
}

// The silently dropped singletons: why they carry no comparison, stated in
// words. The count itself lives in the drawer item's own meta slot
// (Iteration 2 note 1 drops them from every comparison surface; the number
// itself was never a secret).
export function SingletonNote() {
  const t = useTranslations("dashboard.payMapping.supplementary")
  return <p className="text-muted-foreground text-sm">{t("body.singletons")}</p>
}
