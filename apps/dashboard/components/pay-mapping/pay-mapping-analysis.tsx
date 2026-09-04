"use client"

import { Medallion } from "@/components/medallion"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type AnalysisChapter,
  chapterContinuationShown,
  chapterHref,
} from "./analysis-chapters"
import { PayMappingCompletionPanel } from "./pay-mapping-completion-panel"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { TableSearchField } from "@/components/table-search-field"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
  stepDoneFor,
} from "./review-checklist"
import { groupLabel } from "./pay-mapping-gap-types"
import { usePayMappingRun } from "./pay-mapping-run-context"
import { ReviewGroupStep } from "./review-group-step"
import { ReviewPraxisStep } from "./review-praxis-step"
import { type ReviewQueue, type ReviewStep, stepKey } from "./review-queue"
import { ReviewStartStep } from "./review-start-step"

// The pane's own open target: a real queue step (its group's real
// requiresDocumentation applies) or a non-queue equal-work group looked up
// by key (an "ok"-flag group, which is listed and documentable but occupies
// no queue index). Equal work only: a women-dominated group outside the
// queue is one that no equally or lower valued group out-earns, and that is
// not a step at all (the report states it), so the chapter never lists it.
// Only "start" | "praxis" | "group" | "extraGroup" are ever SET below:
// "chapterIntro" and "finish" are part of ReviewStep's own type (so the
// switch in renderOpenStep stays exhaustive over it) but the checklist has
// no intro or finale row to open either from.
type OpenStep =
  | ReviewStep
  | { kind: "extraGroup"; scope: "equalWork"; key: string }
  | null

// Whether opening a step should move the page, given where the pane's top
// landed. It moves ONLY when the new content would otherwise start
// off-screen.
//
// Steps differ in height by hundreds of pixels (a praxis step is three
// lines, an equivalent-work step carries a table and a chart), so submitting
// at the bottom of a tall one and advancing leaves the next step's top far
// above the viewport. But on desktop the checklist sits BESIDE the pane, so
// picking a row must scroll nothing: the user is already looking at what
// they clicked, and moving the page would take the list they are working
// down out of view.
//
// Measured rather than keyed off the lg breakpoint, so the rule states the
// actual intent and cannot drift from the grid's own class.
export function shouldScrollPaneIntoView(
  paneTop: number,
  viewportHeight: number
): boolean {
  return paneTop < 0 || paneTop > viewportHeight
}

// Finds an equal-work group's OWN queue step by key, if it has one (a group
// that requires documentation and therefore occupies a queue index); a group
// without one is a non-queue row, opened as an "extraGroup" instead (see
// OpenStep above).
function findQueueGroupStep(
  queue: ReviewQueue,
  key: string
): ReviewStep | undefined {
  return queue.steps.find(
    (step) =>
      step.kind === "group" &&
      step.scope === "equalWork" &&
      step.group.key === key
  )
}

// An equal-work group row's own OpenStep, whether or not it occupies a queue
// index: pure (takes the queue explicitly, like findQueueGroupStep above) so
// both the checklist's row-building code and its click handlers share one
// derivation.
function groupOpenStep(
  queue: ReviewQueue,
  key: string
): Exclude<OpenStep, null> {
  return (
    findQueueGroupStep(queue, key) ?? {
      kind: "extraGroup",
      scope: "equalWork",
      key,
    }
  )
}

// A stable id for an OpenStep, used both for aria-current comparison and for
// locating the current row in the checklist's own flat order (see
// advanceAfter below). Reuses review-queue.ts's own stepKey for every real
// ReviewStep variant; an extraGroup has no ReviewStep counterpart, so it
// gets the same "scope:key" shape by hand.
function openStepId(open: Exclude<OpenStep, null>): string {
  return open.kind === "extraGroup"
    ? `${open.scope}:${open.key}`
    : stepKey(open)
}

// One checklist row, built once per render so the same object backs both the
// visible row (the shared review-checklist presentation: done icon + label +
// sr-only state) and the advance-after-mark-done search below. The
// selection payload is the row's own OpenStep.
interface ChecklistRow extends ChecklistRowBase {
  openStep: Exclude<OpenStep, null>
}

// The run's only work surface (ADR-0016), built as a ladder of four rungs
// with exactly one thing open at each (Iteration 3): the spine states where
// the whole mapping stands, the checklist opens one chapter at a time, the
// pane holds one of four states (the next-step landing, a chapter's whole
// worklist, one open step, or the completion panel), and the evidence
// behind a step is collapsed inside it. Everything that does not affect
// completion lives in one drawer below.
//
// "Mark done and continue" advances the pane to the next REMAINING row in
// the checklist's own flat order (see advanceAfter below), landing on the
// completion panel once nothing remains. Self-contained (usePayMappingRun +
// its own listPayMappingRuns subscription), so the route that mounts it
// stays thin.
export function PayMappingAnalysis({
  chapter,
}: {
  // The chapter this page shows. Required: every analysis route IS a
  // chapter now. The section briefly also had an index page ("Läget")
  // carrying what is next and the completion panel, but it listed no steps
  // of its own, and a page with no work on it is where the surface's bugs
  // kept coming from. The spine and the chapter tab row answer "how far
  // along" on every page, and the run's Overview owns finishing.
  chapter: AnalysisChapter
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tTabs = useTranslations("dashboard.payMapping.tabs")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const pathname = usePathname()
  const router = useRouter()
  const { run, gap, analyses, actions, notes, queue, locked } =
    usePayMappingRun()
  // undefined = the user has not picked anything yet, so the pane falls back
  // to its landing default (the first REMAINING step, or the gate panel when
  // nothing remains). null = an explicit "nothing open" (the completion row,
  // or an advance that found nothing left). The distinction also drives the
  // small-screen fallback: only an EXPLICIT selection hides the checklist
  // below lg (the landing default must never swap a phone straight into a
  // card with no list in sight).
  const [selected, setSelected] = useState<OpenStep | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [rowFilter, setRowFilter] = useState<"all" | "remaining">("all")
  // The steps sheet is the phone's checklist; selecting a row closes it.
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false)
  // Armed by the handlers below, consumed by the pane's callback ref: the
  // pane focuses and scrolls ONLY for a selection the user made. It cannot
  // be a mount counter. The run's queries resolve independently, so the
  // landing pane re-keys as each one arrives, and a counter would let the
  // second mount scroll a freshly opened page down past the spine.
  const pendingPaneFocusRef = useRef(false)
  const requestPaneFocus = useCallback(() => {
    pendingPaneFocusRef.current = true
  }, [])
  // Deep link from the actions overview (?step=<scope>:<groupKey>): once
  // the queue exists, pre-select the matching checklist row so the link
  // opens the record's own group, not just the page. Read from
  // window.location exactly once instead of useSearchParams: the value is
  // consumed only at mount (the link always navigates here from another
  // tab), and this avoids the Suspense boundary useSearchParams demands of
  // the whole page. An unknown key is ignored (the run may have changed
  // since the record was written).
  const appliedStepParamRef = useRef(false)
  useEffect(() => {
    if (appliedStepParamRef.current || queue === null || gap === undefined)
      return
    appliedStepParamRef.current = true
    const param = new URLSearchParams(window.location.search).get("step")
    if (param === null) return
    const separator = param.indexOf(":")
    if (separator === -1) return
    const scope = param.slice(0, separator)
    const key = param.slice(separator + 1)
    // An equivalent-work group resolves through the queue alone: a
    // women-dominated group with no step (nothing out-earns it) is not on
    // this surface, so a link to it is ignored like an unknown key.
    const target: OpenStep =
      scope === "equalWork" && gap.equalWork.some((group) => group.key === key)
        ? groupOpenStep(queue, key)
        : scope === "equivalentWork"
          ? (queue.steps.find(
              (step) =>
                step.kind === "group" &&
                step.scope === "equivalentWork" &&
                step.group.key === key
            ) ?? null)
          : scope === "praxis"
            ? (queue.steps.find(
                (step) => step.kind === "praxis" && step.area === key
              ) ?? null)
            : null
    if (target === null) return
    // Open the chapter too, or a deep link would select a row inside a
    // collapsed chapter (rung 1 is single-open).
    requestPaneFocus()
    setSelected(target)
  }, [queue, gap, requestPaneFocus])

  // Moves focus onto the right pane the moment its content actually
  // changes: a different checklist row selected, "mark done and continue"
  // advancing to the next remaining step, or landing back on the gate
  // panel. AnimatePresence's mode="wait" (below) defers mounting the
  // INCOMING pane until the outgoing one's exit finishes, so this callback
  // ref fires exactly when the new content lands. The scroll decision lives
  // in shouldScrollPaneIntoView, which is where the judgement is and is
  // therefore where the test is: this wiring cannot be exercised under
  // happy-dom, because motion never mounts the incoming pane there.
  const focusPaneContainer = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return
    if (!pendingPaneFocusRef.current) return
    pendingPaneFocusRef.current = false
    // preventScroll, then decide for ourselves below: focus() scrolls a
    // partly-offscreen element by its own rule (nearest edge), which is not
    // the rule we want and cannot be turned off any other way.
    node.focus({ preventScroll: true })
    if (
      !shouldScrollPaneIntoView(
        node.getBoundingClientRect().top,
        window.innerHeight
      )
    )
      return
    node.scrollIntoView({ block: "start" })
  }, [])

  if (
    run === undefined ||
    gap === undefined ||
    analyses === undefined ||
    queue === null
  ) {
    // Content-shaped: the two columns in their real proportions, so nothing
    // reflows on arrival. No progress chrome of its own: the section shell
    // above owns the journey's whole reading (the page title's instrument and
    // the chapter row), and a second bar here was a leftover from before it
    // did.
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          <Card>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                <div key={index} className="flex min-h-5 items-center">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          {/* The step's own shape: a frame whose header stands in for the
              kicker and the question, one panel for what the reader fills
              in, and the action row in the foot. A white card here reflowed
              into a muted frame the moment the data landed. */}
          <FrameCard
            size="lg"
            kicker={<Skeleton className="h-4 w-32" />}
            title={<Skeleton className="h-5 w-64 max-w-full" />}
            footer={<Skeleton className="h-8 w-32 rounded-md" />}
          >
            <FrameCardSection>
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-20 w-full" />
            </FrameCardSection>
          </FrameCard>
        </div>
      </div>
    )
  }

  if (gap.currency === null) {
    // The house empty primitive rather than a bare sentence: the frozen
    // snapshot holds no priced rows, so there is nothing to analyse and the
    // only useful move is back to the run's own overview.
    return (
      <Empty className="gap-4">
        <EmptyHeader>
          <EmptyMedia>
            <Medallion icon={Alert02Icon} size="lg" />
          </EmptyMedia>
          <EmptyTitle>{tGap("empty")}</EmptyTitle>
        </EmptyHeader>
        <Link
          href={`/pay-mappings/${pathname.split("/").filter(Boolean)[1] ?? ""}`}
          className="text-sm underline underline-offset-4"
        >
          {tTabs("overview")}
        </Link>
      </Empty>
    )
  }

  // Re-bound to their own, non-optional consts: narrowing from the guards
  // above does not carry into the nested render helper below, mirroring
  // pay-mapping-review.tsx's own identical rebinding and its doc comment.
  const currentRun = run
  const currentGap = gap
  const currency: string = gap.currency
  const currentAnalyses = analyses
  const currentQueue = queue
  const collaboration = currentRun.collaboration ?? null

  const collaborationFilled =
    collaboration !== null &&
    collaboration.participants.trim() !== "" &&
    collaboration.description.trim() !== ""

  const praxisSteps = currentQueue.steps.filter(
    (step): step is Extract<ReviewStep, { kind: "praxis" }> =>
      step.kind === "praxis"
  )

  // The checklist's own rows, built once per render: every step (queue or
  // not) the checklist lists, each with its done state (stepDoneFor from
  // review-checklist.tsx, mirrored as sr-only text) and its own
  // OpenStep, so the same row objects back both the rendered button and the
  // flat order advanceAfter searches below.
  const srStatusFor = (done: boolean) =>
    t(`status.${done ? "done" : "toReview"}`)

  const startRow: ChecklistRow = {
    id: "start",
    label: t("collaborationTitle"),
    srStatus: srStatusFor(collaborationFilled),
    done: collaborationFilled,
    openStep: { kind: "start" },
  }

  const praxisRows: ChecklistRow[] = praxisSteps.map((step) => {
    const done = stepDoneFor(step, currentGap, currentAnalyses)
    return {
      id: openStepId(step),
      label: t(`praxis.${step.area}.title`),
      srStatus: srStatusFor(done),
      done,
      openStep: step,
    }
  })

  const equalWorkRows: ChecklistRow[] = currentGap.equalWork.map((group) => {
    const done = stepDoneFor(
      { kind: "group", scope: "equalWork", group },
      currentGap,
      currentAnalyses
    )
    const openStepForRow = groupOpenStep(currentQueue, group.key)
    return {
      id: openStepId(openStepForRow),
      label: groupLabel(group),
      srStatus: srStatusFor(done),
      done,
      openStep: openStepForRow,
    }
  })

  // The queue's own equivalent-work steps, and only those: a women-dominated
  // group enters the queue exactly when an equally or lower valued group
  // out-earns it, and one that nothing out-earns has no answer to give. It
  // was listed anyway, as a row carrying one sentence and a free "mark
  // done", which is a step that asks for nothing; the report is where that
  // result is stated. Reading the queue rather than filtering the gap again
  // keeps this list and the chapter's "N of M" on one predicate.
  const equivalentWorkRows: ChecklistRow[] = currentQueue.steps.flatMap(
    (step) => {
      if (step.kind !== "group" || step.scope !== "equivalentWork") return []
      const done = stepDoneFor(step, currentGap, currentAnalyses)
      return [
        {
          id: openStepId(step),
          label: groupLabel(step.group),
          srStatus: srStatusFor(done),
          done,
          openStep: step,
        },
      ]
    }
  )

  // The checklist's own flat order (start, then praxis, then every
  // equalWork row, then every equivalentWork row): exactly the row order
  // rendered below, and the order advanceAfter walks forward from. Not
  // buildReviewQueue's own steps array: that array excludes the non-queue
  // equal-work groups (an "ok"-flag group), while the checklist -- and
  // therefore "what's next" -- covers those too.
  const flatRows: ChecklistRow[] = [
    startRow,
    ...praxisRows,
    ...equalWorkRows,
    ...equivalentWorkRows,
  ]

  const allSections: {
    key: string
    title: string
    meta: string | undefined
    rows: ChecklistRow[]
  }[] = [
    {
      key: "start",
      title: t("chapters.start"),
      meta: undefined,
      rows: [startRow],
    },
    {
      key: "praxis",
      title: t("chapters.praxis"),
      meta: chapterMeta(currentQueue.progress.praxis, tJourney),
      rows: praxisRows,
    },
    {
      key: "equalWork",
      title: t("chapters.equalWork"),
      meta: chapterMeta(currentQueue.progress.equalWork, tJourney),
      rows: equalWorkRows,
    },
    {
      key: "equivalentWork",
      title: t("chapters.equivalentWork"),
      meta: chapterMeta(currentQueue.progress.equivalentWork, tJourney),
      rows: equivalentWorkRows,
    },
  ]

  // A page lists only its own chapter; the tab row above is where the
  // others are chosen.
  const sections = allSections.filter((section) => section.key === chapter)
  // The rows this page lists, and the first of them still to document.
  const chapterRows = sections.flatMap((section) => section.rows)
  const chapterFirstUndone = chapterRows.find((row) => !row.done)
  // A chapter page OPENS its own work on arrival. Iteration 3 auto-opened
  // nothing, but that was one surface carrying all four chapters, where
  // landing there was not a choice the user had made. Opening a chapter IS
  // the request, so answering it with a button that repeats what was just
  // asked for is a step backwards.
  //
  // A FINISHED chapter still opens its first step, never a bare "this is
  // done" panel. Documenting a chapter must not lock its own record away:
  // a one-step chapter has no list to click back into, so a done-panel
  // landing made what was written unreachable from anywhere in the app.
  // Being finished is a fact about the work, not a reason to hide it.
  const chapterLanding: OpenStep =
    chapterFirstUndone?.openStep ?? chapterRows[0]?.openStep ?? null
  const openStep: OpenStep = selected !== undefined ? selected : chapterLanding
  // Only an EXPLICIT selection hides the list below lg. An auto-opened
  // landing must not, or a phone would arrive on a chapter with the step
  // filling the screen and no way to see the others.
  const explicitCardOpen = openStep !== null && selected !== undefined
  // A one-step chapter has nothing to choose between, so it renders the
  // step full width with no list beside it.
  // Any chapter that HAS rows keeps the list, including a one-row chapter
  // (samverkan). Hiding it there saved a list nobody needed and cost the
  // whole section its geometry: without the 320px column the step pane grows
  // by that column plus the gap, so every field and every button in the step
  // jumped sideways on the way into and out of that chapter. A one-row list
  // still says where the reader is; a moving form does not.
  //
  // Zero rows still means no list: a chapter can legitimately have none (an
  // equal-work chapter on a run with no comparison groups), and an empty
  // column beside an empty chapter says nothing.
  const showChapterList = chapterRows.length > 0
  // "Mark done and continue" advances the pane to the next REMAINING row
  // after the current one, in the checklist's own flat order above. Never
  // wraps back to an earlier row: this is a wizard-like convenience for
  // "what's next", not a re-derivation of the completion gate (an earlier
  // row can stay undone; the checklist itself is always there for random
  // access to it). Finding nothing undone after the current row lands back
  // on the gate panel (the null landing state).
  function advanceAfter(current: Exclude<OpenStep, null>) {
    const index = flatRows.findIndex((row) => row.id === openStepId(current))
    const next =
      index === -1
        ? undefined
        : flatRows.slice(index + 1).find((row) => !row.done)
    // Through selectRow, so the checklist follows the advance into the next
    // step's chapter rather than staying on the one just finished.
    requestPaneFocus()
    if (next === undefined) {
      setSelected(null)
      return
    }
    // Chapters are pages, so the next remaining row may not be on this one.
    // Opening it in place would leave the tab row and the list showing one
    // chapter while the pane showed another's step.
    const nextChapterKey = allSections.find((section) =>
      section.rows.some((row) => row.id === next.id)
    )?.key
    if (nextChapterKey !== chapter) {
      router.push(chapterHref(pathname, nextChapterKey as AnalysisChapter))
      return
    }
    setSelected(next.openStep)
  }

  function renderOpenStep(open: Exclude<OpenStep, null>): ReactNode {
    if (open.kind === "extraGroup") {
      const group = currentGap.equalWork.find(
        (candidate) => candidate.key === open.key
      )
      if (group === undefined) return null
      const analysis = currentAnalyses.find(
        (a) => a.scope === "equalWork" && a.groupKey === group.key
      )
      return (
        <ReviewGroupStep
          scope="equalWork"
          group={group}
          analysis={analysis}
          runId={currentRun.runId}
          locked={locked}
          continuationShown={continuationShown}
          rows={currentRun.rows}
          currency={currency}
          referenceDateMs={currentRun.referenceDate}
          actions={actions}
          notes={notes}
          requiresDocumentation={equalWorkGroupRequiresDocumentation(
            group.flag
          )}
          headingLevel="h4"
          onNext={() => advanceAfter(open)}
        />
      )
    }
    switch (open.kind) {
      case "start":
        return (
          <ReviewStartStep
            runId={currentRun.runId}
            collaboration={collaboration}
            locked={locked}
            continuationShown={continuationShown}
            headingLevel="h4"
            onNext={() => advanceAfter(open)}
          />
        )
      case "praxis": {
        const analysis = currentAnalyses.find(
          (a) => a.scope === "praxis" && a.groupKey === open.area
        )
        return (
          <ReviewPraxisStep
            area={open.area}
            analysis={analysis}
            actions={actions}
            currency={currency}
            runId={currentRun.runId}
            locked={locked}
            continuationShown={continuationShown}
            headingLevel="h4"
            onNext={() => advanceAfter(open)}
          />
        )
      }
      case "group": {
        // The GROUP's own row, never one of its comparison rows: an
        // equivalent-work group's reasons live per comparison now, so this
        // query matches both kinds and only the row without a comparison key
        // carries the klarmarkering.
        const analysis = currentAnalyses.find(
          (a) =>
            a.scope === open.scope &&
            a.groupKey === open.group.key &&
            a.comparisonKey === null
        )
        const comparisonAnalyses = currentAnalyses.filter(
          (a) =>
            a.scope === "equivalentWork" &&
            a.groupKey === open.group.key &&
            a.comparisonKey !== null
        )
        if (open.scope === "equalWork") {
          return (
            <ReviewGroupStep
              scope="equalWork"
              group={open.group}
              analysis={analysis}
              runId={currentRun.runId}
              locked={locked}
              continuationShown={continuationShown}
              rows={currentRun.rows}
              currency={currency}
              referenceDateMs={currentRun.referenceDate}
              actions={actions}
              notes={notes}
              requiresDocumentation={equalWorkGroupRequiresDocumentation(
                open.group.flag
              )}
              headingLevel="h4"
              onNext={() => advanceAfter(open)}
            />
          )
        }
        return (
          <ReviewGroupStep
            scope="equivalentWork"
            group={open.group}
            equivalentWork={currentGap.equivalentWork}
            analysis={analysis}
            comparisonAnalyses={comparisonAnalyses}
            runId={currentRun.runId}
            locked={locked}
            rows={currentRun.rows}
            currency={currency}
            referenceDateMs={currentRun.referenceDate}
            actions={actions}
            notes={notes}
            requiresDocumentation={womenDominatedGroupRequiresDocumentation(
              open.group.comparisons.length
            )}
            headingLevel="h4"
            onNext={() => advanceAfter(open)}
          />
        )
      }
      // Never opened by a checklist row (no intro/finale row in it): kept
      // so the switch stays exhaustive over ReviewStep's full kind union.
      case "chapterIntro":
      case "finish":
        return null
    }
  }

  const currentRowId = openStep === null ? null : openStepId(openStep)
  const currentRowIndex = flatRows.findIndex((row) => row.id === currentRowId)
  const paneKey = openStep !== null ? openStepId(openStep) : "gate"
  // The section that holds a row is the authority on which chapter it
  // belongs to, rather than a second parse of the row id. Searches ALL
  // sections, never only the one this page shows: "which chapter owns this
  // row" is a fact about the row, and advanceAfter has to recognise a next
  // step that lives on another page.
  const chapterKeyForRowId = (rowId: string | undefined) =>
    allSections.find((section) => section.rows.some((row) => row.id === rowId))
      ?.key

  // The open step's own chapter, for the phone's position line and for the
  // continuation rule below.
  const openChapterForStep = (
    openStep === null ? undefined : chapterKeyForRowId(openStepId(openStep))
  ) as AnalysisChapter | undefined
  // The section already offers the way on once this chapter is finished, so
  // the open step drops its own primary: one destination, one control. The
  // same derivation the section shell uses for the link itself.
  const continuationShown = chapterContinuationShown(
    currentQueue,
    openChapterForStep
  )

  // Opening a step pins the checklist to that step's own chapter, so it
  // stays where the user is working: closing the step again (or advancing
  // to the next one) must not jump the list back to some other chapter.
  function selectRow(step: OpenStep) {
    requestPaneFocus()
    setStepsSheetOpen(false)
    setSelected(step)
  }

  const trimmedQuery = query.trim().toLowerCase()
  const searching = trimmedQuery !== ""
  const filteredSections = sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) =>
      row.label.toLowerCase().includes(trimmedQuery)
    ),
  }))
  // The Remaining filter never hides the row that is currently open: a
  // step you just marked done would otherwise vanish from under the
  // selection you are still looking at.
  const listedSections = sections.map((section) => ({
    ...section,
    rows:
      rowFilter === "all"
        ? section.rows
        : section.rows.filter((row) => !row.done || row.id === currentRowId),
  }))
  // The checklist's own content, rendered both in the sticky column and,
  // below lg while a step is open, inside the steps sheet: one definition,
  // so the phone can never drift from the desktop list.
  const checklistBody = (
    <>
      {/* Its own non-scrolling block (shares the Card's own gap so it
                still aligns with the scrolling block below) so the search
                field stays reachable while the sections list underneath it
                scrolls; only that list, not the field, may leave the
                viewport. */}
      <CardContent className="space-y-2 lg:shrink-0">
        <TableSearchField
          placeholder={t("searchSteps")}
          value={query}
          onChange={setQuery}
          className="w-full"
        />
        {/* Defaults to All: the documented rows ARE the evidence
                  record, so hiding them by default would make the work
                  already done invisible on arrival. */}
        <ToggleGroup
          variant="outline"
          aria-label={tAnalysis("filterLabel")}
          value={[rowFilter]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "all" || next === "remaining") setRowFilter(next)
          }}
        >
          <ToggleGroupItem value="all">
            {tAnalysis("filterAll")}
          </ToggleGroupItem>
          <ToggleGroupItem value="remaining">
            {tAnalysis("filterRemaining")}
          </ToggleGroupItem>
        </ToggleGroup>
      </CardContent>
      <CardContent className="space-y-6 lg:min-h-0 lg:overflow-y-auto">
        {searching ? (
          filteredSections.map((section) => (
            <ChecklistSearchSection
              key={section.key}
              title={section.title}
              meta={section.meta}
              rows={section.rows}
              currentId={currentRowId}
              onSelect={(row) => selectRow(row.openStep)}
            />
          ))
        ) : (
          <>
            {/* A chapter page lists its OWN steps, flat. The chapter tab
                row above already names the chapter and carries its count,
                so a section header here would say both a second time.
                (This replaced Iteration 3's single-open accordion, which
                existed only to keep four chapters on one surface.) */}
            <div className="space-y-6">
              {listedSections
                .filter((section) => section.rows.length > 0)
                .map((section) => (
                  <div key={section.key}>
                    {/* Every row, never a capped list with a "show the rest"
                        escape hatch: the column answers "what is left in this
                        chapter", and a list that stops at eight answers it
                        wrongly for exactly the chapters that need it most.
                        The column scrolls instead. */}
                    <ChecklistRows
                      rows={section.rows}
                      currentId={currentRowId}
                      onSelect={(row) => selectRow(row.openStep)}
                    />
                  </div>
                ))}
            </div>
          </>
        )}
      </CardContent>
    </>
  )

  return (
    <div className="space-y-4">
      {/* A chapter page is a two-column master-detail: the left column
          carries THAT chapter's rows and is hidden below lg only while a card
          is open (the phone's own "swap the whole view" behavior). The column
          is present on every chapter that has rows, one-row chapters
          included, so the step pane keeps one width across the whole
          section. lg:sticky keeps the list beside the
          pane without reflowing on selection; the scroll region lives
          INSIDE the Card (max-h on the Card, overflow on its content),
          never on this wrapper, because the Card's elevation is a ring
          painted outside its border box and an overflow here would clip it
          to nothing along the straight edges. */}
      <div
        className={cn(
          "grid gap-4 lg:items-start",
          showChapterList && "lg:grid-cols-[320px_1fr]"
        )}
      >
        {showChapterList && (
          <div
            className={cn(
              "lg:sticky lg:top-4 lg:self-start",
              explicitCardOpen && "hidden lg:block"
            )}
          >
            <Card className="lg:max-h-[calc(100svh_-_14rem)]">
              {checklistBody}
            </Card>
          </div>
        )}
        <div className="min-w-0">
          {/* Transform+opacity only, per docs/ui-animation.md: a plain
              crossfade each time the pane's own content changes (a
              different row selected, an advance, or landing back on the
              gate panel). mode="wait" defers mounting the incoming content
              until the outgoing side's exit finishes. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={paneKey}
              ref={focusPaneContainer}
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              // outline-none: the container is not keyboard-reachable (it
              // takes focus only programmatically, right after the user's
              // own selection), so the browser's default outline would
              // draw a ring around the whole pane without telling anyone
              // anything. The focus move itself stays: it is what makes a
              // screen reader announce the newly opened step.
              className="space-y-2 outline-none"
            >
              {explicitCardOpen && (
                // The phone's own orientation: the checklist column is
                // hidden while a step is open, so this bar says where the
                // step sits and opens the whole list on demand. It replaces
                // a bare "back" button, which said where you had been
                // rather than where you are. Sticky because a step form is
                // taller than a phone: orientation that scrolls away is
                // orientation you no longer have. It rides inside the
                // pane's own crossfade rather than appearing on its own.
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background py-2 lg:hidden">
                  <span className="text-muted-foreground text-sm">
                    {tAnalysis("stepPosition", {
                      position: currentRowIndex + 1,
                      total: flatRows.length,
                      chapter:
                        openChapterForStep === undefined
                          ? ""
                          : t(`chapters.${openChapterForStep}`),
                    })}
                  </span>
                  <Sheet open={stepsSheetOpen} onOpenChange={setStepsSheetOpen}>
                    <SheetTrigger
                      render={
                        <Button type="button" variant="outline" size="sm" />
                      }
                    >
                      {tAnalysis("stepsSheet")}
                    </SheetTrigger>
                    <SheetContent side="left">
                      <SheetHeader>
                        <SheetTitle>{tAnalysis("stepsSheet")}</SheetTitle>
                      </SheetHeader>
                      {/* The popup clips to its rounded corners, so the BODY
                          is what scrolls. */}
                      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        {checklistBody}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              )}
              {/* Every pane state draws its own FrameCard, whose muted
                  ground is what separates its sections: a white card around
                  that would put a frame inside a card, which is what made
                  the sections read as one undifferentiated field. The
                  chapter each step belongs to is named by the breadcrumb,
                  the sidebar and the progress instrument already; the
                  statutory duty it used to carry rides on the step's own
                  title now, where the duty is actually discharged. */}
              {openStep !== null ? (
                renderOpenStep(openStep)
              ) : (
                // Reached by advancing past the last remaining row in this
                // chapter: the in-flow way to finish, so the user who has
                // just documented the last thing does not have to go looking
                // for the button. The run's Overview carries the same panel
                // as the reliable home, which is where someone who is not
                // mid-flow will look.
                <PayMappingCompletionPanel
                  queue={currentQueue}
                  run={currentRun}
                  // Stated in words, because there is no row to speak for
                  // it: an equivalent-work chapter with nothing to answer is
                  // the compliance-positive result, and a pane holding only
                  // the completion panel would read as a chapter that failed
                  // to load.
                  {...(chapter === "equivalentWork" && chapterRows.length === 0
                    ? { lead: tAnalysis("equivalentWorkClear") }
                    : {})}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
