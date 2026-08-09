"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import {
  type ActionTargetWire,
  groupLabel,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type WomenDominatedComparisonWire,
} from "./pay-mapping-gap-types"

// The higher-paid comparators for a women-dominated group, as a table.
//
// This was a bulleted list of sentences, one per comparator, each ending
// "earns N kr more per month on average". At 16 comparators that is the
// same clause sixteen times and the figures never line up, so nothing can
// be scanned or compared: the reader has to parse every row to find the
// biggest difference. A table puts one fact per column and lets the eye run
// down the numbers, which is the whole task here.
//
// Ordered as the engine produced it (largest difference first within each
// level), so the row that most needs an explanation is at the top. No
// sorting controls: the order IS the finding, and 3 kap. 9 § asks about
// work of equal or lower value that pays more, which is what this ordering
// states.
export function ComparatorTable({
  baseline,
  comparisons,
  currency,
  selectedKey,
  onSelect,
  documentation,
}: {
  // The women-dominated group every row below is measured against. It leads
  // the table as its own row: the comparators' whole meaning is "more than
  // THIS", and a difference column with the thing being differed from
  // nowhere on screen asks the reader to hold it in their head.
  baseline: {
    roleTitle: string | null
    seniority: string | null
    level: number
    headcount: number
    womenSharePct: number
    meanComp: number
  }
  comparisons: WomenDominatedComparisonWire[]
  currency: string
  // The row the reader is looking at. Selecting one lights up that job's
  // people in the plot below, so the table's numbers and the individuals
  // behind them are the same object rather than two lists to hold in your
  // head.
  selectedKey?: string | null
  onSelect?: (key: string | null) => void
  // Per-row documentation. 3 kap. 9 § asks whether the difference against
  // EACH equally or lower valued job has a connection to sex, and those
  // answers differ: in one real group the differences ran from 3 677 kr to
  // 50 218 kr a month. One reason for the whole group forces those
  // judgements into one. Optional per row, because most comparisons need
  // nothing and requiring all of them would be unworkable at 21 groups.
  documentation?: {
    runId: Id<"payMappingRuns">
    groupKey: string
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.detail.comparators")

  const format = useFormatter()
  const money = useMoney()

  return (
    // Scrolls inside its own container rather than widening the page: the
    // step sits in a pane that must stay the width of its column.
    <div className="overflow-x-auto">
      {/* table-fixed shares leftover width, so the one flexible column
          (the job title) collapses to nothing if the fixed ones add up to
          more than the minimum. The minimum therefore has to cover every
          fixed column PLUS a readable title. */}
      <Table className="min-w-[56rem] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">{t("level")}</TableHead>
            <TableHead className="min-w-48">{t("work")}</TableHead>
            <TableHead className="w-16 text-right">{t("count")}</TableHead>
            <TableHead className="w-28 text-right">{t("womenShare")}</TableHead>
            <TableHead className="w-32 text-right">{t("mean")}</TableHead>
            {/* Short, and never carrying the baseline's name. A job title is
                free text a customer chooses, so a header holding one cannot
                be given a width: in a table-fixed layout it overprinted the
                two columns beside it. The washed first row, its position and
                its empty difference cells say what the figures are measured
                against. */}
            <TableHead className="w-24 text-right">{t("diffPct")}</TableHead>
            <TableHead className="w-28 text-right">{t("diffSek")}</TableHead>
            {documentation !== undefined && (
              <>
                <TableHead className="w-36">{t("reason")}</TableHead>
                {/* The row's actions get their own trailing column with no
                    heading: a menu is something you DO, not a value the
                    column above it names. */}
                <TableHead className="w-12">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* The baseline, first and washed in brand, so it reads as the
              thing the rows under it are compared with rather than as
              another comparator. The difference columns name it too, so the
              wash is a mark rather than the only signal. Its two difference
              cells stay empty on purpose: nothing is a difference from
              itself. */}
          <TableRow className="bg-brand/8 hover:bg-brand/8">
            <TableCell className="font-medium tabular-nums">
              {baseline.level}
            </TableCell>
            <TableCell className="truncate font-medium">
              {groupLabel(baseline)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {baseline.headcount}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {percentText(baseline.womenSharePct, format)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {money(baseline.meanComp, currency)}
            </TableCell>
            <TableCell />
            <TableCell />
            {documentation !== undefined && (
              <>
                <TableCell />
                <TableCell />
              </>
            )}
          </TableRow>
          {comparisons.map((comparison) => {
            const target: ActionTargetWire | null =
              documentation === undefined
                ? null
                : {
                    kind: "comparison",
                    groupKey: documentation.groupKey,
                    comparisonKey: comparison.key,
                  }
            const docs =
              target === null
                ? null
                : documentationFor(
                    target,
                    documentation?.actions,
                    documentation?.notes
                  )
            const selected = selectedKey === comparison.key
            return (
              <TableRow
                key={comparison.key}
                // Selecting is a plain click on the row, not a control of its
                // own: the row IS the thing being pointed at, and a checkbox
                // column would cost width the job titles already need.
                onClick={
                  onSelect === undefined
                    ? undefined
                    : () => onSelect(selected ? null : comparison.key)
                }
                aria-selected={onSelect === undefined ? undefined : selected}
                className={cn(
                  onSelect !== undefined && "cursor-pointer",
                  selected && "bg-muted"
                )}
              >
                <TableCell className="tabular-nums">
                  {comparison.level}
                </TableCell>
                <TableCell className="truncate">
                  {groupLabel(comparison)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {comparison.headcount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {percentText(comparison.womenSharePct, format)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(comparison.meanComp, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {comparison.diffPct === null
                    ? null
                    : percentText(comparison.diffPct, format)}
                </TableCell>
                {/* The difference is what the documenter is answering for, so
                  it carries the row's emphasis. Signed, so its direction is
                  in the figure rather than in the column name. */}
                <TableCell className="text-right font-medium text-foreground tabular-nums">
                  {money(comparison.diffSek, currency, { signed: true })}
                </TableCell>
                {documentation !== undefined &&
                  target !== null &&
                  docs !== null && (
                    <>
                      {/* What has been documented FOR this comparison.
                          Empty until someone records something. */}
                      <TableCell>
                        <div className="flex items-center">
                          <DocumentationBadges
                            actions={docs.actions}
                            notes={docs.notes}
                          />
                        </div>
                      </TableCell>
                      {/* The row's own actions, in their own trailing
                          column. Stops the row's select handler: opening
                          the menu is not the same gesture as pointing at
                          the row. */}
                      <TableCell
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center">
                          <DocumentationMenu
                            runId={documentation.runId}
                            target={target}
                            targetLabel={groupLabel(comparison)}
                            actions={docs.actions}
                            notes={docs.notes}
                            currency={currency}
                            locked={documentation.locked}
                          />
                        </div>
                      </TableCell>
                    </>
                  )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
