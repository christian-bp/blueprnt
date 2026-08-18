"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"
import { Fragment, type ReactNode } from "react"
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

// One wash, for both of the table's marked rows: the baseline at the top and
// whichever comparator the reader has picked. Colour is not what tells them
// apart, and does not need to be: the baseline always leads the table, reads
// bold, and leaves its two difference cells empty, while a picked row sits
// among the comparators with its differences filled in. A second wash was
// tried twice (brand, then a darker step of the same grey) and both spent
// either a colour or a shade comparison on a distinction the row already
// makes.
//
// The hover repeats it on purpose: TableRow hovers to bg-muted/50, so without
// this a marked row LIGHTENS under the cursor and reads as losing its mark.
const MARKED_ROW = "bg-muted hover:bg-muted"

// Level, work, count, women's share, mean, difference in percent and in
// currency, plus the reason and action columns the documentation layer adds.
// The expanded row spans all of them, so it is stated once here rather than
// counted by eye at the call site.
const BASE_COLUMN_COUNT = 7
const DOCUMENTED_COLUMN_COUNT = BASE_COLUMN_COUNT + 2

// One comparison's whole answer, in the table's own 144px column.
//
// A comparison often carries several reasons and a note; spelled out in full
// they ran under the row's action menu and were clipped mid-word. The cell
// therefore states the FIRST reason and counts the rest, and the full answer
// (every reason plus the deepened analysis) lives in a hover card, so the
// collapsed table still says what was concluded for each row.
//
// The trigger is a real button, so the answer is reachable by keyboard and
// not only by a mouse, and it stops the row's own click: opening the answer
// is a different gesture from selecting the comparison.
function ComparisonAnswer({
  reasons,
  note,
  label,
}: {
  reasons: readonly PayGapReason[]
  note: string | null
  // Names the comparison, so the card stands on its own when it opens away
  // from its row.
  label: string
}) {
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tForm = useTranslations("dashboard.payMapping.analysisForm")
  const tReview = useTranslations("dashboard.payMapping.review")
  const [first, ...rest] = reasons
  const hasNote = note !== null && note.trim() !== ""
  if (first === undefined && !hasNote) return null

  // One reason and nothing else needs no card: the cell already says it all.
  if (first !== undefined && rest.length === 0 && !hasNote) {
    return <span className="block truncate text-xs">{tReasons(first)}</span>
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-1 text-left text-xs"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="min-w-0 truncate">
              {first === undefined ? note : tReasons(first)}
            </span>
            {rest.length > 0 && (
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {`+${rest.length}`}
              </span>
            )}
          </button>
        }
      />
      <HoverCardContent className="w-72">
        <p className="font-medium text-sm">{label}</p>
        {/* Each part says what it is. Without the headings the card is two
            runs of text and the reader has to infer which one is the
            deepened analysis, which is exactly the thing they came to read.
            The labels are the ones the form itself uses, so the card and the
            panel name the same things the same way. */}
        {reasons.length > 0 && (
          <>
            <p className="mt-3 text-muted-foreground text-xs">
              {tForm("reasonsTitle")}
            </p>
            <ul className="mt-1 space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="text-sm">
                  {tReasons(reason)}
                </li>
              ))}
            </ul>
          </>
        )}
        {hasNote && (
          <>
            <p className="mt-3 text-muted-foreground text-xs">
              {tReview("comparisonNoteLabel")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{note}</p>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

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
  reasonsByComparison,
  notesByComparison,
  renderExpanded,
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
  // The objective reasons recorded for each comparison, keyed by the
  // comparator's key.
  //
  // Per row, because 3 kap. 9 § asks whether the difference against EACH
  // equally or lower valued job has a connection to sex, and those answers
  // differ: in one real group the differences ran from 3 677 kr to 50 218 kr
  // a month, and one reason for the whole group forces those judgements into
  // one. The column that names them is this table's own progress view: a
  // reader sees at a glance which differences are explained and which still
  // owe an answer.
  reasonsByComparison?: Map<string, PayGapReason[]>
  // The deepened analysis per comparison, keyed the same way as the reasons.
  notesByComparison?: Map<string, string>
  // The answering surface for the SELECTED comparison, rendered in a
  // full-width row directly beneath it. The answer belongs where the finding
  // is: with the panel at the page's bottom instead, the reader had to hold
  // "which row was I answering for" in their head across a chart.
  renderExpanded?: (comparisonKey: string) => ReactNode
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
            {/* The disclosure column. It carries no heading text: the chevron
                says what it does, and a word above it would name a control
                rather than a value. */}
            {renderExpanded !== undefined && (
              <TableHead className="w-8">
                <span className="sr-only">{t("expand")}</span>
              </TableHead>
            )}
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
          {/* The baseline, first and washed, so it reads as the thing the rows
              under it are compared with rather than as another comparator.
              The difference columns name it too, so the wash is a mark rather
              than the only signal. Its two difference cells stay empty on
              purpose: nothing is a difference from itself.

              Muted, not brand: brand is this app's ink for judgements, and the
              baseline is not making one. It is structure, the same row
              whatever the reader does. Its wash is the same one a picked row
              wears (MARKED_ROW), which is why the rest of the row has to keep
              saying what it is. */}
          {/* Semibold, against the comparison rows' normal weight: this row is
              what every row below is measured against, so it has to read as
              the reference rather than as the first comparison.

              The weight is set ONCE, on the row. Each cell used to set its own
              font-medium, which is a class on the cell itself and therefore
              beat the row's semibold outright: the reference row rendered at
              exactly the weight of the rows it is supposed to stand apart
              from, while the comment above it claimed otherwise. */}
          <TableRow className={cn(MARKED_ROW, "font-semibold")}>
            {/* The baseline is what the rows below are compared WITH, not a
                comparison of its own, so it never opens: the slot stays empty
                rather than offering a control that would do nothing. */}
            {renderExpanded !== undefined && <TableCell />}
            <TableCell className="tabular-nums">{baseline.level}</TableCell>
            <TableCell className="truncate">{groupLabel(baseline)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {baseline.headcount}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {percentText(baseline.womenSharePct, format)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
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
            const select =
              onSelect === undefined
                ? undefined
                : () => onSelect(selected ? null : comparison.key)
            const row = (
              <TableRow
                key={comparison.key}
                // The whole row stays clickable, because the row IS the thing
                // being pointed at and a checkbox column would cost width the
                // job titles already need. The row itself carries no role or
                // tabIndex, though: a role on a <tr> replaces its row
                // semantics, which breaks the table for exactly the readers
                // the keyboard path is meant to serve. The real control lives
                // in the Work cell below.
                onClick={select}
                className={cn(
                  onSelect !== undefined && "cursor-pointer",
                  selected && MARKED_ROW
                )}
              >
                {/* Says the row opens. Rotating a chevron 90 degrees is the
                    app's one disclosure idiom (accordion-section.tsx, the
                    guide nav), so this reads the same as every other
                    expandable thing here. Not a control of its own: the row
                    is already the control, and a second one would ask the
                    reader which of the two to press. */}
                {renderExpanded !== undefined && (
                  <TableCell>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={cn(
                        "size-4 text-muted-foreground transition-transform motion-reduce:transition-none",
                        selected && "rotate-90"
                      )}
                    />
                  </TableCell>
                )}
                <TableCell className="tabular-nums">
                  {comparison.level}
                </TableCell>
                <TableCell className="truncate">
                  {/* Selecting lights this job up in the plot below, so it
                      needs to be reachable without a mouse. As a toggle it
                      reports aria-pressed, and its name says what selecting
                      does rather than repeating the title the cell already
                      shows. */}
                  {select === undefined ? (
                    groupLabel(comparison)
                  ) : (
                    <button
                      type="button"
                      aria-label={t("selectRow", {
                        label: groupLabel(comparison),
                      })}
                      aria-pressed={selected}
                      // The row's own onClick would fire a second time and
                      // undo this one.
                      onClick={(event) => {
                        event.stopPropagation()
                        select()
                      }}
                      className="max-w-full cursor-pointer truncate text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                    >
                      {groupLabel(comparison)}
                    </button>
                  )}
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
                        <div className="flex flex-col gap-1">
                          {/* The reasons first: they are the statutory
                              answer for THIS difference. The badges below
                              are the work layer beside it. */}
                          <ComparisonAnswer
                            reasons={
                              reasonsByComparison?.get(comparison.key) ?? []
                            }
                            note={
                              notesByComparison?.get(comparison.key) ?? null
                            }
                            label={groupLabel(comparison)}
                          />
                          {/* No wrapper of its own: the badges are already a
                              flex row and render nothing when there are none,
                              so a wrapper would leave a zero-height child that
                              the column's gap pushes the text off-centre
                              against. */}
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
            const expanded =
              selected && renderExpanded !== undefined
                ? renderExpanded(comparison.key)
                : null
            if (expanded === null) return row
            return (
              <Fragment key={`${comparison.key}-expanded`}>
                {row}
                {/* Its own row spanning every column, so the table's widths
                    are untouched by whatever the panel contains. */}
                {/* Plain: no wash and no rule of its own. Both were tried.
                    MARKED_ROW is the mark for "this row is picked", which on a
                    data row is a thin band and on a working area this tall is
                    a grey slab with the note field sunk into it; a left accent
                    in its place drew a line the panel did not need. The picked
                    row sits directly above wearing the mark, with its chevron
                    turned down, and that is the whole tie. */}
                <TableRow>
                  <TableCell
                    colSpan={
                      (documentation === undefined
                        ? BASE_COLUMN_COUNT
                        : DOCUMENTED_COLUMN_COUNT) + 1
                    }
                    className="p-4"
                  >
                    {expanded}
                  </TableCell>
                </TableRow>
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
