"use client"

import { ArrowDown01Icon, Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  type CrossLevelPair,
  type CrossLevelWoman,
  crossLevelPairs,
} from "@workspace/core"
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
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { LevelBadge } from "@/components/level-badge"
import { useMoney } from "@/hooks/use-money"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import {
  type ActionTargetWire,
  fteBaseMonthly,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"

// How many cases the section shows before the "show all" control: enough to
// read the worst offenders at a glance without burying the rest of the page.
const PREVIEW_COUNT = 5

// One pair with the man's display values joined in: names stay out of the
// engine (it works on pseudonymous ids), and resolving them here, from the
// id map the builder already holds, keeps the render path free of per-pair
// linear scans.
export interface CrossLevelDisplayPair extends CrossLevelPair {
  manName: string
  manErased: boolean
}

// One rendered cross-level case: the engine's per-woman aggregate plus the
// display values (names, tracks) resolved from the snapshot rows.
export interface CrossLevelCase extends Omit<CrossLevelWoman, "pairs"> {
  womanName: string
  womanErased: boolean
  womanTrackKey: string
  pairs: CrossLevelDisplayPair[]
}

// Pure: frozen rows -> the cross-level cases, FTE-adjusted on base salary
// (the primary measure, ADR-0015). O(women x men) over the whole frozen
// population: callers memoize it on `rows` (the section below does), never
// call it bare in a render body. Exported for direct unit testing.
export function buildCrossLevelCases(
  rows: PayMappingSnapshotRow[]
): CrossLevelCase[] {
  const byId = new Map(rows.map((row) => [row.personPublicId, row]))
  const cases = crossLevelPairs(
    rows.map((row) => ({
      personPublicId: row.personPublicId,
      gender: row.gender,
      level: row.level,
      trackKey: row.trackKey,
      base: row.basicMonthly === null ? null : fteBaseMonthly(row),
    }))
  )
  return cases.map((woman) => {
    const row = byId.get(woman.personPublicId)
    return {
      ...woman,
      womanName: row?.displayName ?? "",
      womanErased: row?.erased ?? false,
      womanTrackKey: row?.trackKey ?? "",
      pairs: woman.pairs.map((pair) => {
        const man = byId.get(pair.manPublicId)
        return {
          ...pair,
          manName: man?.displayName ?? "",
          manErased: man?.erased ?? false,
        }
      }),
    }
  })
}

// One pair's row inside an expanded case: who out-earns her, on which level,
// by how much, and whether it is the same track (which removes the
// "different kind of job" explanation and makes the pair the stronger
// warning sign).
function PairRow({
  pair,
  currency,
  documentation,
  womanPublicId,
}: {
  pair: CrossLevelDisplayPair
  currency: string
  womanPublicId: string
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.crossLevel")
  const tDetail = useTranslations("dashboard.payMapping.detail")
  const money = useMoney()
  const manName = pair.manErased ? tDetail("erased") : pair.manName
  const target: ActionTargetWire = {
    kind: "pair",
    womanPublicId,
    manPublicId: pair.manPublicId,
  }
  const own = documentationFor(
    target,
    documentation?.actions,
    documentation?.notes
  )

  return (
    <TableRow>
      <TableCell className="truncate font-medium">{manName}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <LevelBadge level={pair.manLevel} />
          {pair.sameTrack && (
            <Badge variant="secondary">{t("sameTrack")}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {money(pair.manBase, currency)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {money(-pair.diffKr, currency, { signed: true })}
      </TableCell>
      <TableCell>
        {documentation !== undefined && (
          <div className="flex h-9 items-center justify-between gap-1">
            <DocumentationBadges actions={own.actions} notes={own.notes} />
            <DocumentationMenu
              runId={documentation.runId}
              target={target}
              targetLabel={manName}
              actions={own.actions}
              notes={own.notes}
              currency={currency}
              locked={documentation.locked}
            />
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

// The tvärnivå section (Iteration 2 note 4): every woman on a higher level
// (numerically lower: level 1 is highest) who is out-earned on base salary
// by a man on a lower level. Rendered per WOMAN with her worst pair as the
// headline and the full pair list behind a disclosure, because the raw pair
// count grows quadratically with headcount and would be unreadable (and
// unrenderable) on a large organization. Always shown explicitly when a
// case exists; renders nothing at all when there are none, which is itself
// the compliance-positive result stated in words by the caller.
export function CrossLevelSection({
  rows,
  currency,
  documentation,
  hideWhenEmpty = false,
}: {
  rows: PayMappingSnapshotRow[]
  currency: string
  // The steady-state Analysis tab hides the section entirely when there is
  // nothing to show (it is one section among many); the guided chapter
  // intro keeps the compliance-positive sentence, since a guided step that
  // silently disappears leaves the user unsure whether it ran.
  hideWhenEmpty?: boolean
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.crossLevel")
  const tDetail = useTranslations("dashboard.payMapping.detail")
  const tHelp = useTranslations("dashboard.help")
  const money = useMoney()
  const [expanded, setExpanded] = useState(false)

  // Memoized: O(women x men) over the whole frozen population, and the
  // analysis tab re-renders on every checklist keystroke.
  const cases = useMemo(() => buildCrossLevelCases(rows), [rows])
  // A real organization produces dozens of cases, and an unbounded list
  // pushes everything below it off the screen. The worst few lead (the
  // engine already orders by the largest difference); the rest are one
  // click away.
  const visible = expanded ? cases : cases.slice(0, PREVIEW_COUNT)
  if (cases.length === 0) {
    return hideWhenEmpty ? null : (
      <p className="text-muted-foreground text-sm">{t("none")}</p>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={Alert02Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-4 text-flag-elevated"
        />
        <h4 className="font-medium text-sm">
          {t("title", { count: cases.length })}
        </h4>
        <HelpMorphButton label={tHelp("crossLevelLabel")}>
          {tHelp("crossLevelBody")}
        </HelpMorphButton>
      </div>
      <p className="text-muted-foreground text-sm">{t("lead")}</p>

      <div className="space-y-2">
        {visible.map((item) => (
          <Collapsible key={item.personPublicId}>
            <div className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">
                  {item.womanErased ? tDetail("erased") : item.womanName}
                </span>
                <LevelBadge level={item.level} />
                <span className="text-muted-foreground text-sm tabular-nums">
                  {money(item.base, currency)}
                </span>
                <span className="text-sm">
                  {t("summary", {
                    count: item.outEarnedByCount,
                    diff: money(item.worstPair.diffKr, currency),
                    level: item.worstPair.manLevel,
                  })}
                </span>
                <CollapsibleTrigger className="group ml-auto flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
                  {t("showPairs")}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
                  />
                </CollapsibleTrigger>
              </div>
              {/* Animated geometry only on the panel, spacing on an inner
                  div (docs/ui-animation.md rule 2). */}
              <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
                <div className="overflow-x-auto pt-3">
                  <Table className="min-w-[40rem] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("columns.man")}</TableHead>
                        <TableHead className="w-36">
                          {t("columns.level")}
                        </TableHead>
                        <TableHead className="w-32 text-right">
                          {tDetail("columns.basePay")}
                        </TableHead>
                        <TableHead className="w-32 text-right">
                          {t("columns.diff")}
                        </TableHead>
                        <TableHead className="w-28">
                          {tDetail("columns.documentation")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.pairs.map((pair) => (
                        <PairRow
                          key={pair.manPublicId}
                          pair={pair}
                          currency={currency}
                          womanPublicId={item.personPublicId}
                          {...(documentation === undefined
                            ? {}
                            : { documentation })}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
      {cases.length > PREVIEW_COUNT && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded
            ? t("showFewer")
            : t("showAll", { count: cases.length - PREVIEW_COUNT })}
        </Button>
      )}
    </section>
  )
}
