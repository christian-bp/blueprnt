"use client"

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
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type AnalysisChapter, chapterHref } from "./analysis-chapters"
import { PayMappingCompletionPanel } from "./pay-mapping-completion-panel"
import { ChapterBar } from "./chapter-bar"
import { ChapterWorklist, type WorklistRow } from "./chapter-worklist"
import { TableSearchField } from "@/components/table-search-field"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
  stepDoneFor,
} from "./review-checklist"
import { groupLabel, primaryGapMetric } from "./pay-mapping-gap-types"
import { usePayMappingRun } from "./pay-mapping-run-context"
import { ReviewGroupStep } from "./review-group-step"
import { ReviewPraxisStep } from "./review-praxis-step"
import { type ReviewQueue, type ReviewStep, stepKey } from "./review-queue"
import { ReviewStartStep } from "./review-start-step"

// The pane's own open target: a real queue step (its group's real
// requiresDocumentation applies) or a non-queue group looked up by scope+key
// (an "ok"-flag equalWork group or a zero-comparator equivalentWork group,
// neither of which occupies a queue index). Only "start" |
// "praxis" | "group" | "extraGroup" are ever SET below: "chapterIntro" and
// "finish" are part of ReviewStep's own type (so the switch in
// renderOpenStep stays exhaustive over it) but the checklist has no intro or
// finale row to open either from.
type OpenStep =
  | ReviewStep
  | { kind: "extraGroup"; scope: "equalWork" | "equivalentWork"; key: string }
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

// Finds a group's OWN queue step by scope+key, if it has one (an
// equalWork/equivalentWork group that requires documentation and therefore
// occupies a queue index); a group without one is a non-queue row, opened as
// an "extraGroup" instead (see OpenStep above).
function findQueueGroupStep(
  queue: ReviewQueue,
  scope: "equalWork" | "equivalentWork",
  key: string
): ReviewStep | undefined {
  return queue.steps.find(
    (step) =>
      step.kind === "group" && step.scope === scope && step.group.key === key
  )
}

// A group row's own OpenStep, whether or not it occupies a queue index: pure
// (takes the queue explicitly, like findQueueGroupStep above) so both the
// checklist's row-building code and its click handlers share one derivation.
function groupOpenStep(
  queue: ReviewQueue,
  scope: "equalWork" | "equivalentWork",
  key: string
): Exclude<OpenStep, null> {
  return (
    findQueueGroupStep(queue, scope, key) ?? { kind: "extraGroup", scope, key }
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

// How many rows a chapter lists inline before the column offers the whole
// chapter as a table instead. Past this the 320px column is a scroll, not a
// list, and it stops answering "where is the worst of it".
const INLINE_ROW_CAP = 8

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
  // The chapter whose whole worklist is open in the pane, if any: the
  // all-at-once view the 320px column cannot give at scale.
  const [worklistChapter, setWorklistChapter] = useState<
    "equalWork" | "equivalentWork" | null
  >(null)
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
    if (scope !== "equalWork" && scope !== "equivalentWork") return
    const exists =
      scope === "equalWork"
        ? gap.equalWork.some((group) => group.key === key)
        : gap.womenDominated.some((group) => group.key === key)
    if (!exists) return
    // Open the chapter too, or a deep link would select a row inside a
    // collapsed chapter (rung 1 is single-open).
    requestPaneFocus()
    setSelected(groupOpenStep(queue, scope, key))
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
    // Content-shaped: the real spine chrome (its heading, its label and its
    // bar) with only the unknown count standing in as a bar, then the two
    // columns in their real proportions, so nothing reflows on arrival.
    return (
      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">
              {tAnalysis("progressLabel")}
            </h3>
            <Skeleton className="h-4 w-12" />
          </div>
          <Progress value={0} aria-label={tAnalysis("progressLabel")} />
        </section>
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
          <Card>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </CardContent>
          </Card>
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
          <EmptyMedia variant="icon">
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
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
    const openStepForRow = groupOpenStep(currentQueue, "equalWork", group.key)
    return {
      id: openStepId(openStepForRow),
      label: groupLabel(group),
      srStatus: srStatusFor(done),
      done,
      openStep: openStepForRow,
    }
  })

  const equivalentWorkRows: ChecklistRow[] = currentGap.womenDominated.map(
    (group) => {
      const done = stepDoneFor(
        { kind: "group", scope: "equivalentWork", group },
        currentGap,
        currentAnalyses
      )
      const openStepForRow = groupOpenStep(
        currentQueue,
        "equivalentWork",
        group.key
      )
      return {
        id: openStepId(openStepForRow),
        label: groupLabel(group),
        srStatus: srStatusFor(done),
        done,
        openStep: openStepForRow,
      }
    }
  )

  // The checklist's own flat order (start, then praxis, then every
  // equalWork row, then every equivalentWork row): exactly the row order
  // rendered below, and the order advanceAfter walks forward from. Not
  // buildReviewQueue's own steps array: that array excludes every non-queue
  // group (an "ok"-flag equalWork group, a zero-comparator equivalentWork
  // group), while the checklist -- and therefore "what's next" -- covers
  // those too.
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
  const openStep: OpenStep =
    selected !== undefined
      ? selected
      : worklistChapter !== null
        ? null
        : chapterLanding
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
      if (open.scope === "equalWork") {
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
            rows={currentRun.rows}
            currency={currency}
            referenceDateMs={currentRun.referenceDate}
            actions={actions}
            notes={notes}
            requiresDocumentation={equalWorkGroupRequiresDocumentation(
              group.flag
            )}
            animated={false}
            headingLevel="h4"
            onNext={() => advanceAfter(open)}
          />
        )
      }
      const group = currentGap.womenDominated.find(
        (candidate) => candidate.key === open.key
      )
      if (group === undefined) return null
      const analysis = currentAnalyses.find(
        (a) => a.scope === "equivalentWork" && a.groupKey === group.key
      )
      return (
        <ReviewGroupStep
          scope="equivalentWork"
          group={group}
          equivalentWork={currentGap.equivalentWork}
          analysis={analysis}
          runId={currentRun.runId}
          locked={locked}
          rows={currentRun.rows}
          currency={currency}
          referenceDateMs={currentRun.referenceDate}
          actions={actions}
          notes={notes}
          requiresDocumentation={womenDominatedGroupRequiresDocumentation(
            group.comparisons.length
          )}
          animated={false}
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
            animated={false}
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
            runId={currentRun.runId}
            locked={locked}
            animated={false}
            headingLevel="h4"
            onNext={() => advanceAfter(open)}
          />
        )
      }
      case "group": {
        const analysis = currentAnalyses.find(
          (a) => a.scope === open.scope && a.groupKey === open.group.key
        )
        if (open.scope === "equalWork") {
          return (
            <ReviewGroupStep
              scope="equalWork"
              group={open.group}
              analysis={analysis}
              runId={currentRun.runId}
              locked={locked}
              rows={currentRun.rows}
              currency={currency}
              referenceDateMs={currentRun.referenceDate}
              actions={actions}
              notes={notes}
              requiresDocumentation={equalWorkGroupRequiresDocumentation(
                open.group.flag
              )}
              animated={false}
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
            animated={false}
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
  const paneKey =
    openStep !== null
      ? openStepId(openStep)
      : worklistChapter !== null
        ? `worklist:${worklistChapter}`
        : "gate"
  // The section that holds a row is the authority on which chapter it
  // belongs to, rather than a second parse of the row id. Searches ALL
  // sections, never only the one this page shows: "which chapter owns this
  // row" is a fact about the row, and advanceAfter has to recognise a next
  // step that lives on another page.
  const chapterKeyForRowId = (rowId: string | undefined) =>
    allSections.find((section) => section.rows.some((row) => row.id === rowId))
      ?.key

  // The open step's own chapter, for the bar above it.
  const openChapterForStep = (
    openStep === null ? undefined : chapterKeyForRowId(openStepId(openStep))
  ) as AnalysisChapter | undefined

  // Opening a step pins the checklist to that step's own chapter, so it
  // stays where the user is working: closing the step again (or advancing
  // to the next one) must not jump the list back to some other chapter.
  function selectRow(step: OpenStep) {
    requestPaneFocus()
    setStepsSheetOpen(false)
    setWorklistChapter(null)
    setSelected(step)
  }

  // The worklist rows for a chapter, built from the SAME checklist rows the
  // column renders, so the two can never disagree about what exists or what
  // is done. Status is the third state ADR-0015 created: a group that is
  // analysed and shown but carries no documentation duty.
  function worklistRowsFor(
    scope: "equalWork" | "equivalentWork"
  ): WorklistRow[] {
    if (scope === "equalWork") {
      return currentGap.equalWork.map((group) => {
        const row = equalWorkRows.find(
          (candidate) =>
            candidate.id ===
            openStepId(groupOpenStep(currentQueue, scope, group.key))
        )
        const required = equalWorkGroupRequiresDocumentation(group.flag)
        return {
          id: row?.id ?? group.key,
          label: groupLabel(group),
          level: group.level,
          status: row?.done
            ? ("documented" as const)
            : required
              ? ("needsDocumenting" as const)
              : ("noDuty" as const),
          women: group.womenCount,
          men: group.menCount,
          gapPct: primaryGapMetric(group).gapPct,
          flag: group.flag,
        }
      })
    }
    return currentGap.womenDominated.map((group) => {
      const row = equivalentWorkRows.find(
        (candidate) =>
          candidate.id ===
          openStepId(groupOpenStep(currentQueue, scope, group.key))
      )
      const required = womenDominatedGroupRequiresDocumentation(
        group.comparisons.length
      )
      return {
        id: row?.id ?? group.key,
        label: groupLabel(group),
        level: group.level,
        status: row?.done
          ? ("documented" as const)
          : required
            ? ("needsDocumenting" as const)
            : ("noDuty" as const),
        headcount: group.headcount,
        womenSharePct: group.womenSharePct,
        comparisons: group.comparisons.length,
      }
    })
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
                    <ChecklistRows
                      rows={section.rows.slice(0, INLINE_ROW_CAP)}
                      currentId={currentRowId}
                      onSelect={(row) => selectRow(row.openStep)}
                    />
                    {/* Past the cap the column stops being a list and
                              starts being a scroll: the whole chapter opens
                              as a sortable table in the pane instead. */}
                    {section.rows.length > INLINE_ROW_CAP &&
                      (section.key === "equalWork" ||
                        section.key === "equivalentWork") && (
                        <button
                          type="button"
                          onClick={() => {
                            requestPaneFocus()
                            setSelected(undefined)
                            setWorklistChapter(
                              section.key === "equalWork"
                                ? "equalWork"
                                : "equivalentWork"
                            )
                          }}
                          className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-muted-foreground text-sm underline-offset-4 hover:bg-muted/50 hover:underline"
                        >
                          {tAnalysis("worklist.showAll", {
                            count: section.rows.length,
                          })}
                        </button>
                      )}
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
              "lg:sticky lg:top-6 lg:self-start",
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
                    <SheetContent
                      side="left"
                      className="w-full overflow-y-auto p-4 sm:max-w-sm"
                    >
                      <SheetHeader className="p-0">
                        <SheetTitle>{tAnalysis("stepsSheet")}</SheetTitle>
                      </SheetHeader>
                      {checklistBody}
                    </SheetContent>
                  </Sheet>
                </div>
              )}
              <Card>
                <CardContent>
                  {openStep !== null ? (
                    <div className="space-y-3">
                      {/* Which chapter this step belongs to, with the
                          statutory duty one click away, restated where the
                          duty is actually discharged. */}
                      {openChapterForStep !== undefined && (
                        <ChapterBar chapter={openChapterForStep} />
                      )}
                      {renderOpenStep(openStep)}
                    </div>
                  ) : worklistChapter !== null ? (
                    <div className="space-y-3">
                      <ChapterBar chapter={worklistChapter} />
                      <ChapterWorklist
                        rows={worklistRowsFor(worklistChapter)}
                        variant={worklistChapter}
                        onOpen={(id) => {
                          const row = flatRows.find(
                            (candidate) => candidate.id === id
                          )
                          if (row !== undefined) selectRow(row.openStep)
                        }}
                        setAside={
                          worklistChapter === "equalWork" ? (
                            <p className="text-muted-foreground text-sm">
                              {tAnalysis("worklist.setAside", {
                                formed:
                                  currentGap.equalWork.length +
                                  currentGap.excluded.singletonCount +
                                  currentGap.excluded.reverse.length +
                                  currentGap.excluded.genderPure.length,
                                compared: currentGap.equalWork.length,
                                singletons: currentGap.excluded.singletonCount,
                                reverse: currentGap.excluded.reverse.length,
                                genderPure:
                                  currentGap.excluded.genderPure.length,
                              })}
                            </p>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : (
                    // Reached by advancing past the last remaining row in
                    // this chapter: the in-flow way to finish, so the user
                    // who has just documented the last thing does not have
                    // to go looking for the button. The run's Overview
                    // carries the same panel as the reliable home, which is
                    // where someone who is not mid-flow will look.
                    <PayMappingCompletionPanel
                      queue={currentQueue}
                      run={currentRun}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
