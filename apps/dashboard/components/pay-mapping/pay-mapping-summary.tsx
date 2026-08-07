"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Accordion } from "@workspace/ui/components/accordion"
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
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { AccordionSection } from "@/components/accordion-section"
import { AnalysisSpine } from "./analysis-spine"
import { ChapterBar } from "./chapter-bar"
import { ChapterWorklist, type WorklistRow } from "./chapter-worklist"
import { type AnalysisChapter, NextStepPanel } from "./next-step-panel"
import { ContinueReviewItem } from "./continue-review-item"
import {
  SUPPLEMENTARY_ITEMS,
  SupplementaryAnalysis,
  type SupplementaryItemKey,
} from "./supplementary-analysis"
import { useOrganization } from "@/components/org-context"
import { TableSearchField } from "@/components/table-search-field"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
} from "./review-checklist"
import { groupLabel, primaryGapMetric } from "./pay-mapping-gap-types"
import { usePayMappingRun } from "./pay-mapping-run-context"
import { isGateUnmetError } from "./review-finish"
import { ReviewGroupStep } from "./review-group-step"
import { stepDoneFor } from "./review-jump-menu"
import { ReviewPraxisStep } from "./review-praxis-step"
import {
  buildReviewQueue,
  type ReviewQueue,
  type ReviewStep,
  stepKey,
} from "./review-queue"
import { ReviewStartStep } from "./review-start-step"
import { ReviewStepActions } from "./review-step-actions"

// The pane's own open target: a real queue step (its group's real
// requiresDocumentation applies) or a non-queue group looked up by scope+key
// (an "ok"-flag equalWork group or a zero-comparator equivalentWork group,
// neither of which occupies a queue index; mirrors pay-mapping-review.tsx's
// own extraGroup mechanism, openExtraGroup). Only "start" |
// "praxis" | "group" | "extraGroup" are ever SET below: "chapterIntro" and
// "finish" are part of ReviewStep's own type (so the switch in
// renderOpenStep stays exhaustive over it) but the checklist has no intro or
// finale row to open either from.
type OpenStep =
  | ReviewStep
  | { kind: "extraGroup"; scope: "equalWork" | "equivalentWork"; key: string }
  | null

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
// ReviewStep variant (so a queue group's id never drifts from the wizard's
// own); an extraGroup has no ReviewStep counterpart, so it gets the same
// "scope:key" shape by hand.
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

// The Analysis tab's steady state: a two-column master-detail on lg+
// screens -- a searchable checklist of every step on the left (chapters as
// collapsible sections), the selected step's own card in the right pane, a
// row click swapping the pane directly with no back round-trip -- with an
// in-place overlay kept only as the SMALL-SCREEN fallback (the list alone;
// an EXPLICIT row selection swaps the whole view to the card via
// backToSummary). The pane's landing default (nothing picked yet) is the
// gate panel (the actions note + the Complete section) once the gate is
// met, else the first REMAINING step. "Mark done and continue" on any
// opened step advances the pane to the next REMAINING row in the
// checklist's own order (see advanceAfter below), landing back on the gate
// panel once nothing remains. Self-contained (usePayMappingRun + its own
// listPayMappingRuns subscription, mirroring pay-mapping-review.tsx's own
// hasPreviousCompletedRun derivation byte for byte), so the route that
// mounts it stays thin.
export function PayMappingSummary() {
  const t = useTranslations("dashboard.payMapping.review")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
  const tTabs = useTranslations("dashboard.payMapping.tabs")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const tSupplementary = useTranslations("dashboard.payMapping.supplementary")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { run, gap, analyses, actions, notes } = usePayMappingRun()
  const runsList = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const completePayMappingRun = useMutation(
    api.payMapping.runs.completePayMappingRun
  )
  const [completing, setCompleting] = useState(false)
  // undefined = the user has not picked anything yet, so the pane falls back
  // to its landing default (the first REMAINING step, or the gate panel when
  // nothing remains). null = an explicit "nothing
  // open" (an advance that found nothing left, or the small-screen back
  // control). The distinction also drives the small-screen fallback: only an
  // EXPLICIT selection hides the checklist below lg (the landing default
  // must never swap a phone straight into a card with no list in sight).
  const [selected, setSelected] = useState<OpenStep | undefined>(undefined)
  const [query, setQuery] = useState("")
  // The supplementary drawer's own single-open state, lifted here so the
  // checklist's search results can open and scroll to one of its items.
  const [openSupplementary, setOpenSupplementary] =
    useState<SupplementaryItemKey | null>(null)
  // The checklist's own two controls (rung 1). The chapter override is
  // undefined until the user opens a chapter themselves; until then the
  // open chapter follows the current or next step, so the list always
  // shows where the work is. The row filter defaults to All: a default
  // that hid documented rows would make the evidence record invisible on
  // arrival, which is the opposite of what an auditor needs.
  const [chapterOverride, setChapterOverride] = useState<string | undefined>(
    undefined
  )
  const [rowFilter, setRowFilter] = useState<"all" | "remaining">("all")
  // The chapter whose whole worklist is open in the pane, if any: the
  // all-at-once view the 320px column cannot give at scale.
  const [worklistChapter, setWorklistChapter] = useState<
    "equalWork" | "equivalentWork" | null
  >(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Skips the pane's own mount-focus (below) exactly once: never on the
  // page's initial mount (hasMountedPaneRef), and never right after
  // handleBackToSummary's own explicit heading-focus (suppressPaneFocusRef),
  // so that manual "close" doesn't get its focus immediately stolen back
  // when the gate panel remounts in the pane a moment later.
  const hasMountedPaneRef = useRef(false)
  const suppressPaneFocusRef = useRef(false)

  // Same derivation as pay-mapping-review.tsx:63-70, byte for byte: whether
  // an EARLIER run was completed decides whether the "previous actions"
  // praxis area belongs in this run's own queue.
  const collaboration = run?.collaboration ?? null
  const hasPreviousCompletedRun =
    run !== undefined &&
    (runsList?.some(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.referenceDate < run.referenceDate
    ) ??
      false)

  const queue: ReviewQueue | null =
    run !== undefined &&
    gap !== undefined &&
    analyses !== undefined &&
    runsList !== undefined &&
    gap.currency !== null
      ? buildReviewQueue({
          gap,
          analyses,
          collaboration,
          hasPreviousCompletedRun,
        })
      : null

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
    setChapterOverride(scope)
    setSelected(groupOpenStep(queue, scope, key))
  }, [queue, gap])

  // Moves focus onto the right pane the moment its content actually
  // changes: a different checklist row selected, "mark done and continue"
  // advancing to the next remaining step, or landing back on the gate
  // panel. AnimatePresence's mode="wait" (below) defers mounting the
  // INCOMING pane until the outgoing one's exit finishes, so this callback
  // ref fires exactly when the new content lands.
  const focusPaneContainer = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return
    if (!hasMountedPaneRef.current) {
      hasMountedPaneRef.current = true
      return
    }
    if (suppressPaneFocusRef.current) {
      suppressPaneFocusRef.current = false
      return
    }
    node.focus()
    // Steps differ in height by hundreds of pixels (a praxis step is three
    // lines, an equivalent-work step carries a table and a chart), so
    // advancing without this leaves the user mid-pane on the next step.
    node.scrollIntoView({ block: "start" })
  }, [])

  // The small-screen fallback's own "close" affordance (the button rendered
  // alongside the opened card below, hidden at lg+ where there is no
  // equivalent "back" concept): a manual step-away, so focus returns to the
  // summary heading exactly like the pre-master-detail overlay did, rather
  // than to the gate panel that is about to remount in the pane.
  function handleBackToSummary() {
    suppressPaneFocusRef.current = true
    setSelected(null)
    headingRef.current?.focus()
  }

  if (
    run === undefined ||
    gap === undefined ||
    analyses === undefined ||
    runsList === undefined
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
          <p className="text-muted-foreground text-sm">{tAnalysis("lead")}</p>
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

  if (queue === null) {
    // Unreachable (every condition above already guarantees `queue` is
    // built), kept only so TypeScript can see it here too.
    return null
  }

  // Re-bound to their own, non-optional consts: narrowing from the guards
  // above does not carry into the nested render helper below, mirroring
  // pay-mapping-review.tsx's own identical rebinding and its doc comment.
  const currentRun = run
  const currentGap = gap
  const currency: string = gap.currency
  const currentAnalyses = analyses
  const currentQueue = queue
  const locked = currentRun.status === "completed"

  const collaborationFilled =
    collaboration !== null &&
    collaboration.participants.trim() !== "" &&
    collaboration.description.trim() !== ""

  const praxisSteps = currentQueue.steps.filter(
    (step): step is Extract<ReviewStep, { kind: "praxis" }> =>
      step.kind === "praxis"
  )

  const gateMet =
    currentQueue.progress.overall.done === currentQueue.progress.overall.total
  const remaining =
    currentQueue.progress.overall.total - currentQueue.progress.overall.done
  const showBanner = remaining > 0 && currentRun.status === "active"

  // The run's own overview and the wizard's takeover route both sit at the
  // analysis sub-page's sibling routes, same derivation as
  // review-finish.tsx's overviewHref (minus/plus the trailing segment).
  const [, slug] = pathname.split("/").filter(Boolean)
  const overviewHref = `/pay-mappings/${slug}`
  const reviewHref = `/pay-mappings/${slug}/review`

  async function handleComplete() {
    setCompleting(true)
    try {
      await completePayMappingRun({ orgId, runId: currentRun.runId })
      toast.success(tToast("payMappingCompleted"))
    } catch (error) {
      toast.error(
        isGateUnmetError(error)
          ? tErrors("payMappingGateUnmet")
          : tToast("error")
      )
    } finally {
      setCompleting(false)
    }
  }

  // The checklist's own rows, built once per render: every step (queue or
  // not) the summary has always listed, each with its done state (stepDoneFor
  // from review-jump-menu.tsx, mirrored as sr-only text) and its own
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

  // The pane's landing default until the user picks something themselves
  // (see `selected`'s own comment above): the gate panel once the gate is
  // met, else the first REMAINING step in the checklist's flat order. Gates
  // on `gateMet` (queue.progress, required steps only), not on every
  // flatRow being done: an untouched free-klarmarkering row must never keep
  // a gate-met run off the gate panel. A completed run always lands on the
  // gate panel (its completedNote + overview link): the run is closed, so a
  // leftover free-klarmarkering row is history, not "what's next". Derived
  // during render, never via an effect: the first pane mount IS the
  // auto-opened card, so focusPaneContainer's own first-mount guard applies
  // and the landing never steals focus.
  const firstUndone = flatRows.find((row) => !row.done)
  // Nothing opens by itself any more (Iteration 3, rung 2): the landing is
  // NextStepPanel, which names the next undone step and offers one button.
  // Auto-opening it put a chart, a 25-row table and a form on screen before
  // the user had asked for anything. A completed or gate-met run still
  // lands on the completion panel: the run is closed (or closable), so an
  // untouched free-klarmarkering row is history, not "what's next".
  const showNextStep = !locked && !gateMet && firstUndone !== undefined
  const openStep: OpenStep = selected !== undefined ? selected : null
  const explicitCardOpen = openStep !== null && selected !== undefined

  const sections: {
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
    if (next === undefined) {
      setSelected(null)
      return
    }
    setChapterOverride(chapterKeyForRowId(next.id))
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

  // The right pane's own landing state (nothing selected): the completion
  // gate (the actions note, then Complete when the gate is unmet/met, or
  // the completedNote + a plain link back to the overview on a completed
  // run).
  function renderGatePanel(): ReactNode {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("finishActionsNote")}
        </p>
        {currentRun.status === "completed" ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {tDoc("completedNote")}
            </p>
            <Link
              href={overviewHref}
              className="text-sm underline underline-offset-4"
            >
              {tTabs("overview")}
            </Link>
          </div>
        ) : (
          <ReviewStepActions
            primaryLabel={tDoc("complete")}
            onPrimary={handleComplete}
            primaryDisabled={!gateMet || completing}
            hint={gateMet ? undefined : tDoc("remaining", { count: remaining })}
          />
        )}
      </div>
    )
  }

  const currentRowId = openStep === null ? null : openStepId(openStep)
  const paneKey =
    openStep !== null
      ? openStepId(openStep)
      : worklistChapter !== null
        ? `worklist:${worklistChapter}`
        : showNextStep && selected === undefined
          ? "next"
          : "gate"
  // The section that holds a row is the authority on which chapter it
  // belongs to, rather than a second parse of the row id.
  const chapterKeyForRowId = (rowId: string | undefined) =>
    sections.find((section) => section.rows.some((row) => row.id === rowId))
      ?.key

  // The open step's own chapter, for the bar above it.
  const openChapterForStep = (
    openStep === null ? undefined : chapterKeyForRowId(openStepId(openStep))
  ) as AnalysisChapter | undefined
  // The chapter the next undone row belongs to, for the landing panel's
  // "chapter N of 4" line.
  const nextChapter: AnalysisChapter =
    (chapterKeyForRowId(firstUndone?.id) as AnalysisChapter | undefined) ??
    "start"
  const remainingAfterNext = Math.max(0, remaining - 1)

  // Opening a step pins the checklist to that step's own chapter, so it
  // stays where the user is working: closing the step again (or advancing
  // to the next one) must not jump the list back to some other chapter.
  function selectRow(step: OpenStep) {
    if (step !== null) setChapterOverride(chapterKeyForRowId(openStepId(step)))
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

  // Until the user has opened anything, the checklist opens the chapter
  // holding the next undone step: the list shows where the work is.
  const openChapter =
    chapterOverride ?? chapterKeyForRowId(firstUndone?.id) ?? sections[0]?.key

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
  // The drawer's own items as checklist rows: they carry no done state (they
  // carry no obligation either), so the icon reads as remaining and the
  // sr-only status says so.
  const supplementaryRows = SUPPLEMENTARY_ITEMS.map((item) => ({
    id: `supplementary:${item}`,
    label: tSupplementary(`items.${item}`),
    srStatus: srStatusFor(false),
    done: false,
    item,
  })).filter((row) => row.label.toLowerCase().includes(trimmedQuery))

  return (
    <div className="space-y-4">
      {/* Rung 0: where the whole mapping stands, above everything else.
          headingRef is the return target for focus once the small-screen
          fallback's back control closes an opened card (see
          handleBackToSummary above); it is never part of either
          AnimatePresence swap, so it stays a stable anchor above both
          columns. */}
      <AnalysisSpine
        done={currentQueue.progress.overall.done}
        total={currentQueue.progress.overall.total}
        collaboration={collaboration}
        onOpenCollaboration={() => setSelected(startRow.openStep)}
        headingRef={headingRef}
        right={
          showBanner ? (
            <ContinueReviewItem href={reviewHref} remaining={remaining} />
          ) : undefined
        }
      />
      {/* The two-column master-detail (lg+): the left column always carries
          the checklist and is hidden below lg only while a card is open (the
          small-screen fallback's own "swap the whole view" behavior); the
          right pane always carries the gate panel or the opened card and is
          never hidden, so on small screens it simply stacks below the
          checklist when nothing is selected -- the same information the old
          single listing card showed together, just as two cards instead of
          one. lg:sticky keeps the checklist beside the pane without
          reflowing on selection; the scroll region lives INSIDE the Card
          (max-h on the Card, overflow on its content), never on this
          wrapper: the Card's elevation is a ring (a box-shadow, painted
          outside its border box), and an overflow on the wrapper clips it
          to nothing along the straight edges. The 14rem in the cap is the
          measured chrome around the card (site header + page padding +
          the two heading rows above + the bottom padding), so the whole
          page fits the viewport with no scroll. Hidden below lg only on an
          EXPLICIT selection (see `selected`). */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <div
          className={cn(
            "lg:sticky lg:top-6 lg:self-start",
            explicitCardOpen && "hidden lg:block"
          )}
        >
          <Card className="lg:max-h-[calc(100svh_-_14rem)]">
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
                <>
                  {filteredSections.map((section) => (
                    <ChecklistSearchSection
                      key={section.key}
                      title={section.title}
                      meta={section.meta}
                      rows={section.rows}
                      currentId={currentRowId}
                      onSelect={(row) => selectRow(row.openStep)}
                    />
                  ))}
                  {/* A sixth, virtual section so a search reaches the five
                      analyses in the drawer too: before this, a query that
                      matched one of them returned nothing at all. */}
                  <ChecklistSearchSection
                    title={tSupplementary("heading")}
                    meta={undefined}
                    rows={supplementaryRows}
                    currentId={null}
                    onSelect={(row) => {
                      setOpenSupplementary(row.item)
                      document
                        .getElementById(`supplementary-${row.item}`)
                        ?.scrollIntoView({ block: "start" })
                    }}
                  />
                </>
              ) : (
                <>
                  {/* Single-open (rung 1): one chapter at a time, following
                      the open or next step until the user opens another
                      themselves. A collapsed chapter always shows its own
                      count, so folding never hides an obligation. */}
                  <Accordion
                    value={openChapter === undefined ? [] : [openChapter]}
                    onValueChange={(value) =>
                      setChapterOverride(value[0] ?? "")
                    }
                  >
                    {listedSections
                      .filter((section) => section.rows.length > 0)
                      .map((section) => (
                        <AccordionSection
                          key={section.key}
                          value={section.key}
                          title={section.title}
                          meta={section.meta}
                          // No divider between chapters: the checklist sits in
                          // one Card already (drop the vendor item's own
                          // not-last:border-b, matched on the same variant so
                          // tailwind-merge dedupes it).
                          className="not-last:border-b-0"
                        >
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
                        </AccordionSection>
                      ))}
                  </Accordion>
                  {/* The end of the ladder, always reachable: the run's own
                      completion, with its state stated rather than only
                      implied by a disabled button somewhere else. */}
                  <button
                    type="button"
                    onClick={() => selectRow(null)}
                    aria-current={openStep === null ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border-t px-2 pt-3 pb-1.5 text-left text-sm transition-colors",
                      openStep === null && selected !== undefined
                        ? "font-medium"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span>{tAnalysis("completeRow")}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {gateMet
                        ? tAnalysis("completeReady")
                        : tAnalysis("completeLocked", { count: remaining })}
                    </span>
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={handleBackToSummary}
                >
                  {t("backToSummary")}
                </Button>
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
                  ) : showNextStep && selected === undefined ? (
                    <NextStepPanel
                      chapter={nextChapter}
                      label={firstUndone?.label ?? ""}
                      remainingAfter={remainingAfterNext}
                      onOpen={() => selectRow(firstUndone?.openStep ?? null)}
                    />
                  ) : (
                    renderGatePanel()
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Rung 4: everything outside the statutory flow (ADR-0015) in ONE
          drawer, under a heading that says it does not affect completion.
          Five sections with five different expand controls used to sit
          above and below the checklist with nothing saying which of them
          carried an obligation. */}
      <SupplementaryAnalysis
        excluded={currentGap.excluded}
        equivalentWork={currentGap.equivalentWork}
        equalWork={currentGap.equalWork}
        rows={currentRun.rows}
        currency={currency}
        openItem={openSupplementary}
        onOpenItemChange={setOpenSupplementary}
        documentation={{
          runId: currentRun.runId,
          actions,
          notes,
          locked,
        }}
      />
    </div>
  )
}
