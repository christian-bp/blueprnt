"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { LevelBadge } from "@/components/level-badge"
import { buildCrossLevelCases } from "./cross-level-section"
import { MetricLine } from "./equal-work-detail"
import { GroupMemberTable, type MemberRow } from "./group-member-table"
import { PayGapDotPlot } from "./pay-gap-dot-plot"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"
import {
  type ActionTargetWire,
  type GapGroup,
  meetsEntryConditions,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
  shownEqualWorkKeyFor,
} from "./pay-mapping-gap-types"

// The per-level likvärdigt analysis (Iteration 2 note 4): for every level
// that meets the equal-work entry conditions (both genders present, the
// women trailing), a summary line, the swimlane dot plot, and the member
// table with track, role, and tvärnivå columns. An analytical complement to
// the statutory women-dominated comparison, never a gate input, and
// collapsed by default so the analysis page gains one line, not a wall
// (the Iteration 3 direction). A member's documentation anchors to their
// own SHOWN equal-work group, so the record is the same one the equal-work
// detail shows; members of excluded groups get no formal-documentation
// affordance here (ADR-0015).
export function EquivalentWorkLevelAnalysis({
  equivalentWork,
  equalWork,
  rows,
  currency,
  documentation,
}: {
  equivalentWork: GapGroup[]
  equalWork: GapGroup[]
  rows: PayMappingSnapshotRow[]
  currency: string
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.levelAnalysis")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const tHelp = useTranslations("dashboard.help")

  const qualifying = equivalentWork.filter(meetsEntryConditions)

  // The tvärnivå flag set: women with at least one lower-level man
  // out-earning them. Memoized on rows (O(women x men) over the frozen
  // population), shared by every level's table.
  const crossLevelFlagged = useMemo(
    () =>
      new Set(buildCrossLevelCases(rows).map((item) => item.personPublicId)),
    [rows]
  )

  // Anchors a member's documentation to their own shown equal-work group;
  // null hides the menu for members of excluded groups. The level comes
  // from the section the table renders in (levelMembers selected on it).
  const targetForLevel =
    (level: number | null) =>
    (row: MemberRow): ActionTargetWire | null => {
      const groupKey = shownEqualWorkKeyFor(
        { roleTitle: row.roleTitle, seniority: row.seniority, level },
        equalWork
      )
      return groupKey === null
        ? null
        : {
            kind: "person",
            scope: "equalWork",
            groupKey,
            personPublicId: row.personPublicId,
          }
    }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("lead")}</p>
        <HelpMorphButton label={tHelp("levelAnalysisLabel")}>
          {tHelp("levelAnalysisBody")}
        </HelpMorphButton>
      </div>
      <div className="space-y-6 pt-1">
        {qualifying.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {group.level !== null && <LevelBadge level={group.level} />}
              <span className="text-muted-foreground text-sm">
                {tGap("women")}:{" "}
                <span className="tabular-nums">{group.womenCount}</span>
                {" · "}
                {tGap("men")}:{" "}
                <span className="tabular-nums">{group.menCount}</span>
              </span>
              <PayGapFlagBadge flag={group.flag} />
            </div>
            <MetricLine metric={primaryGapMetric(group)} currency={currency} />
            <PayGapDotPlot group={group} rows={rows} currency={currency} />
            <GroupMemberTable
              group={group}
              rows={rows}
              currency={currency}
              variant="level"
              crossLevelFlagged={crossLevelFlagged}
              memberTarget={targetForLevel(group.level)}
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
          </section>
        ))}
      </div>
    </div>
  )
}
