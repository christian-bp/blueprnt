"use client"

import type { PraxisAreaKey } from "@workspace/constants"
import { Accordion } from "@workspace/ui/components/accordion"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import type { useFormatter } from "next-intl"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AccordionSection } from "@/components/accordion-section"
import { TableSearchField } from "@/components/table-search-field"
import type {
  GroupAnalysis,
  PayMappingGapResult,
} from "./pay-mapping-gap-types"
import { groupLabel } from "./pay-mapping-group-underlag"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
} from "./review-checklist"
import {
  isStepDone,
  type ReviewQueue,
  type ReviewQueueInput,
  type ReviewStep,
} from "./review-queue"

// A step's own done-state for an ARBITRARY step, not just the wizard's
// current one: both this jump menu (every praxis area and every
// equalWork/equivalentWork group, queue member or not) and the finish
// screen need to look up a specific step's done row without walking the
// wizard. Goes through review-queue.ts's own isStepDone (the single source
// of the done rule) rather than re-deriving the analyses lookup here:
// collaboration and hasPreviousCompletedRun are irrelevant filler because
// neither caller ever asks isStepDone about a "start" step this way (the
// start row's own done-state comes from queue.progress.collaborationDone
// instead, which already carries the real collaboration check).
export function stepDoneFor(
  step: Extract<ReviewStep, { kind: "praxis" | "group" }>,
  gap: PayMappingGapResult,
  analyses: GroupAnalysis[]
): boolean {
  const input: ReviewQueueInput = {
    gap,
    analyses,
    collaboration: null,
    hasPreviousCompletedRun: false,
  }
  return isStepDone(step, input)
}

// Unsigned percent text, shared by every review surface that shows a gap
// number: never a signed percent (the direction is carried by a word next
// to it, e.g. the overview's org-level finding sentence).
export function percentText(
  pct: number,
  format: ReturnType<typeof useFormatter>
): string {
  return format.number(Math.abs(pct) / 100, {
    style: "percent",
    maximumFractionDigits: 1,
  })
}

// A sheet row: the shared checklist presentation (done icon + label +
// sr-only state) plus this menu's own selection closure (jump by queue
// index, or open a non-queue group as the wizard's extra step).
interface JumpRow extends ChecklistRowBase {
  onSelect: () => void
}

// The review journey's "All steps" Sheet (ADR-0012): every praxis area and
// EVERY equalWork/women-dominated group, queue member or not, grouped by
// chapter and searchable by label. Selecting a queue step jumps the wizard
// to it by index; selecting a non-queue group (an "ok"-flag equal-work
// group or a zero-comparator women-dominated group) opens it as the
// shell's "extra step" overlay instead (`openExtraGroup`), since those
// groups never occupy a queue index. Either way the sheet closes on
// selection: it is a picker, not a persistent panel.
export function ReviewJumpMenu({
  queue,
  gap,
  analyses,
  currentIndex,
  onJumpToIndex,
  onOpenExtraGroup,
}: {
  queue: ReviewQueue
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  currentIndex: number
  onJumpToIndex: (index: number) => void
  onOpenExtraGroup: (scope: "equalWork" | "equivalentWork", key: string) => void
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  function select(action: () => void) {
    action()
    setOpen(false)
  }

  const srStatusFor = (done: boolean) =>
    t(`status.${done ? "done" : "toReview"}`)

  // The current wizard step's row id, in the rows' own id scheme, so the
  // shared ChecklistRows can mark it aria-current.
  const currentStep = queue.steps[currentIndex]
  const currentRowId =
    currentStep === undefined
      ? null
      : currentStep.kind === "start"
        ? "start"
        : currentStep.kind === "praxis"
          ? `praxis:${currentStep.area}`
          : currentStep.kind === "group"
            ? `${currentStep.scope}:${currentStep.group.key}`
            : null

  const startIndex = queue.steps.findIndex((step) => step.kind === "start")
  const startRows: JumpRow[] = [
    {
      id: "start",
      label: t("collaborationTitle"),
      srStatus: srStatusFor(queue.progress.collaborationDone),
      done: queue.progress.collaborationDone,
      onSelect: () => select(() => onJumpToIndex(startIndex)),
    },
  ]

  const praxisRows: JumpRow[] = []
  queue.steps.forEach((step, index) => {
    if (step.kind !== "praxis") return
    const area: PraxisAreaKey = step.area
    const done = stepDoneFor(step, gap, analyses)
    praxisRows.push({
      id: `praxis:${area}`,
      label: t(`praxis.${area}.title`),
      srStatus: srStatusFor(done),
      done,
      onSelect: () => select(() => onJumpToIndex(index)),
    })
  })

  const equalWorkRows: JumpRow[] = gap.equalWork.map((group) => {
    const done = stepDoneFor(
      { kind: "group", scope: "equalWork", group },
      gap,
      analyses
    )
    const queueIndex = queue.steps.findIndex(
      (step) =>
        step.kind === "group" &&
        step.scope === "equalWork" &&
        step.group.key === group.key
    )
    return {
      id: `equalWork:${group.key}`,
      label: groupLabel(group),
      srStatus: srStatusFor(done),
      done,
      onSelect: () =>
        select(() =>
          queueIndex === -1
            ? onOpenExtraGroup("equalWork", group.key)
            : onJumpToIndex(queueIndex)
        ),
    }
  })

  const equivalentWorkRows: JumpRow[] = gap.womenDominated.map((group) => {
    const done = stepDoneFor(
      { kind: "group", scope: "equivalentWork", group },
      gap,
      analyses
    )
    const queueIndex = queue.steps.findIndex(
      (step) =>
        step.kind === "group" &&
        step.scope === "equivalentWork" &&
        step.group.key === group.key
    )
    return {
      id: `equivalentWork:${group.key}`,
      label: groupLabel(group),
      srStatus: srStatusFor(done),
      done,
      onSelect: () =>
        select(() =>
          queueIndex === -1
            ? onOpenExtraGroup("equivalentWork", group.key)
            : onJumpToIndex(queueIndex)
        ),
    }
  })

  // Same section anatomy as the analysis summary's checklist:
  // AccordionSection chapters with the journey card's "x of y" meta at
  // rest, flattened plain sections while a search query is active.
  const sections: {
    key: string
    title: string
    meta: string | undefined
    rows: JumpRow[]
  }[] = [
    {
      key: "start",
      title: t("chapters.start"),
      meta: undefined,
      rows: startRows,
    },
    {
      key: "praxis",
      title: t("chapters.praxis"),
      meta: chapterMeta(queue.progress.praxis, tJourney),
      rows: praxisRows,
    },
    {
      key: "equalWork",
      title: t("chapters.equalWork"),
      meta: chapterMeta(queue.progress.equalWork, tJourney),
      rows: equalWorkRows,
    },
    {
      key: "equivalentWork",
      title: t("chapters.equivalentWork"),
      meta: chapterMeta(queue.progress.equivalentWork, tJourney),
      rows: equivalentWorkRows,
    },
  ]

  const trimmedQuery = query.trim().toLowerCase()
  const searching = trimmedQuery !== ""
  const filteredSections = sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) =>
      row.label.toLowerCase().includes(trimmedQuery)
    ),
  }))
  const totalMatches = filteredSections.reduce(
    (sum, section) => sum + section.rows.length,
    0
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="ghost" />}>
        {t("allSteps")}
      </SheetTrigger>
      <SheetContent className="gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("allSteps")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-4 pb-4">
          <TableSearchField
            placeholder={t("searchSteps")}
            value={query}
            onChange={setQuery}
            className="w-full"
          />
          {searching ? (
            totalMatches === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noMatches")}</p>
            ) : (
              filteredSections.map((section) => (
                <ChecklistSearchSection
                  key={section.key}
                  title={section.title}
                  meta={section.meta}
                  rows={section.rows}
                  currentId={currentRowId}
                  onSelect={(row) => row.onSelect()}
                />
              ))
            )
          ) : (
            <Accordion
              multiple
              defaultValue={sections.map((section) => section.key)}
            >
              {sections
                .filter((section) => section.rows.length > 0)
                .map((section) => (
                  <AccordionSection
                    key={section.key}
                    value={section.key}
                    title={section.title}
                    meta={section.meta}
                    className="not-last:border-b-0"
                  >
                    <ChecklistRows
                      rows={section.rows}
                      currentId={currentRowId}
                      onSelect={(row) => row.onSelect()}
                    />
                  </AccordionSection>
                ))}
            </Accordion>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
