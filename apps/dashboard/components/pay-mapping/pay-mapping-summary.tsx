"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Accordion } from "@workspace/ui/components/accordion"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { AccordionSection } from "@/components/accordion-section"
import { ContinueReviewItem } from "./continue-review-item"
import { useOrganization } from "@/components/org-context"
import { TableSearchField } from "@/components/table-search-field"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
} from "./review-checklist"
import { groupLabel } from "./pay-mapping-group-underlag"
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
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { run, gap, analyses } = usePayMappingRun()
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
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-base">{t("summaryTitle")}</h3>
        <Card>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
              <div key={index} className="flex min-h-5 items-center">
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-9 w-32 rounded-md" />
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (gap.currency === null) {
    return <p className="text-muted-foreground text-sm">{tGap("empty")}</p>
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
  const openStep: OpenStep =
    selected !== undefined
      ? selected
      : locked || gateMet
        ? null
        : (firstUndone?.openStep ?? null)
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
    setSelected(next?.openStep ?? null)
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
  const paneKey = openStep === null ? "gate" : openStepId(openStep)

  // The checklist filter: label-only matching, same
  // scope the jump menu's own search covers. While a query is active the
  // chapters render as plain filtered sections (no collapse: a collapsed
  // chapter hiding its own hits would make the filter lie).
  const trimmedQuery = query.trim().toLowerCase()
  const searching = trimmedQuery !== ""
  const filteredSections = sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) =>
      row.label.toLowerCase().includes(trimmedQuery)
    ),
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* tabIndex + headingRef: the return target for focus once the
            small-screen fallback's back control closes an opened card (see
            handleBackToSummary above); never itself part of either
            AnimatePresence swap, so it stays a stable anchor above both
            columns. */}
        <h3 ref={headingRef} tabIndex={-1} className="font-semibold text-base">
          {t("summaryTitle")}
        </h3>
        {showBanner && (
          <ContinueReviewItem href={reviewHref} remaining={remaining} />
        )}
      </div>
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
            <CardContent className="lg:shrink-0">
              <TableSearchField
                placeholder={t("searchSteps")}
                value={query}
                onChange={setQuery}
                className="w-full"
              />
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
                    onSelect={(row) => setSelected(row.openStep)}
                  />
                ))
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
                        // No divider between chapters: the checklist sits in
                        // one Card already (drop the vendor item's own
                        // not-last:border-b, matched on the same variant so
                        // tailwind-merge dedupes it).
                        className="not-last:border-b-0"
                      >
                        <ChecklistRows
                          rows={section.rows}
                          currentId={currentRowId}
                          onSelect={(row) => setSelected(row.openStep)}
                        />
                      </AccordionSection>
                    ))}
                </Accordion>
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
              className="space-y-2"
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
                  {openStep === null
                    ? renderGatePanel()
                    : renderOpenStep(openStep)}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
