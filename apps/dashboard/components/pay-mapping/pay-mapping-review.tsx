"use client"

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { WizardShell } from "@/components/wizard-shell"
import { usePayMappingRun } from "./pay-mapping-run-context"
import { ReviewChapterIntro } from "./review-chapter-intro"
import { ReviewFinish } from "./review-finish"
import { ReviewGroupStep } from "./review-group-step"
import { ReviewJumpMenu } from "./review-jump-menu"
import { ReviewPraxisStep } from "./review-praxis-step"
import { chapterKeyFor, ReviewProgress } from "./review-progress"
import {
  buildReviewQueue,
  type ReviewQueue,
  type ReviewStep,
  stepKey,
} from "./review-queue"
import { ReviewStartStep } from "./review-start-step"

// queue.steps is a plain array (noUncheckedIndexedAccess makes indexed
// access potentially undefined); stepIndex is always kept in range by
// goToIndex below, so an out-of-range read here is a real bug, not a
// reachable UI state -- mirrors review-queue.test.ts's own stepAt helper.
function stepAt(queue: ReviewQueue, index: number): ReviewStep {
  const step = queue.steps[index]
  if (step === undefined) {
    throw new Error(`pay-mapping-review: no step at index ${index}`)
  }
  return step
}

// The review journey's shell (ADR-0012): a single wizard walking start
// (collaboration) -> praxis areas -> the equal-work chapter -> the
// equivalent-work chapter -> finish, composed entirely from
// review-queue.ts's pure derivation and its own step components. Mounted at
// /pay-mappings/<slug>/review as a full-screen WizardShell takeover
// (mirrors app/(app)/people/import/page.tsx's own takeover wrapper), inside
// the [slug] layout's run context (usePayMappingRun), which stays mounted
// underneath the takeover. Exiting (no confirm dialog: every step
// autosaves as it goes) returns to the run's summary at the sibling
// /analysis route (pay-mapping-summary.tsx), which owns the full
// documentation listing this component's own finish step used to render.
export function PayMappingReview() {
  const t = useTranslations("dashboard.payMapping.review")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const { orgId } = useOrganization()
  const { run, gap, analyses } = usePayMappingRun()
  const runsList = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const router = useRouter()
  const pathname = usePathname()

  const collaboration = run?.collaboration ?? null
  const hasPreviousCompletedRun =
    run !== undefined &&
    (runsList?.some(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.referenceDate < run.referenceDate
    ) ??
      false)

  // null while any query is still loading, or the mapping has no salaries
  // yet (gap.currency === null): both branches return early below, before
  // this is ever read for real.
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

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [extraGroup, setExtraGroup] = useState<{
    scope: "equalWork" | "equivalentWork"
    key: string
  } | null>(null)
  // Lags activeKey (below) until the outgoing card's exit fade finishes (the
  // AnimatePresence onExitComplete near the bottom of this component), so
  // WizardShell's own scroll-to-top effect (keyed on contentKey) runs in the
  // blank moment between steps, never while the outgoing card is still
  // visible mid-fade. Mirrors import-wizard.tsx's displayedStep/onExitComplete
  // pair exactly, with one necessary difference: that wizard can seed its lag
  // state with a real constant (STEP_UPLOAD) because it never waits on async
  // data; this component's first-ever render can land during the loading
  // gate above, before activeKey even exists, so it starts as null (the live
  // activeKey stands in during loading) and the resume effect below seeds it
  // with the landing step's key the moment the queue first resolves, so the
  // lag holds from the very first transition.
  const [displayedKey, setDisplayedKey] = useState<string | null>(null)
  // Lands the wizard on the first undone actionable step exactly once, the
  // first time the queue resolves. A later data refresh (an autosave
  // round-tripping, another tab's edit) must never yank the user back to
  // wherever resumeIndex now points.
  const resumedRef = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the queue's own resumeIndex value, not its identity (a fresh object every render)
  useEffect(() => {
    if (resumedRef.current || queue === null) return
    resumedRef.current = true
    setStepIndex(queue.resumeIndex)
    // resumeIndex always points into steps (buildReviewQueue appends the
    // finish step it can fall back to); the guard is for the index signature.
    const resumeStep = queue.steps[queue.resumeIndex]
    if (resumeStep !== undefined) setDisplayedKey(stepKey(resumeStep))
  }, [queue?.resumeIndex])

  // Whether the step container has mounted once already: only step
  // TRANSITIONS (next/previous/skip/jump, or opening/closing an extra
  // group) move focus, never the wizard's own initial page load.
  const hasMountedStepRef = useRef(false)

  // Moves focus onto a freshly mounted step card the moment its DOM node
  // exists, so a transition always lands somewhere announced instead of on
  // <body>. A callback ref, not an effect keyed on stepIndex/extraGroup:
  // AnimatePresence's mode="wait" (below) defers mounting the INCOMING card
  // until the outgoing one's exit animation finishes, so an effect keyed on
  // the state change alone would often fire before the new card exists;
  // this fires exactly when React actually inserts the node, which is also
  // why it needs no special-casing for reduced motion (the mount itself is
  // unconditional either way, only the animation is skipped). tabIndex={-1}
  // on the container (below) makes it a valid, non-tabbable focus target.
  const focusStepContainer = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return
    if (!hasMountedStepRef.current) {
      hasMountedStepRef.current = true
      return
    }
    node.focus()
  }, [])

  function goToIndex(index: number, dir: number) {
    if (queue === null) return
    setExtraGroup(null)
    setDirection(dir)
    setStepIndex(Math.max(0, Math.min(index, queue.steps.length - 1)))
  }

  function goForward() {
    goToIndex(stepIndex + 1, 1)
  }

  function goBack() {
    goToIndex(stepIndex - 1, -1)
  }

  function openExtraGroup(scope: "equalWork" | "equivalentWork", key: string) {
    setExtraGroup({ scope, key })
  }

  function closeExtraGroup() {
    setExtraGroup(null)
  }

  // The takeover's own exit: no confirm dialog (every step autosaves, so
  // there is never unsaved progress to warn about, unlike the import
  // wizard's discard prompt), a plain navigation back to the run's summary.
  // Same slug derivation as review-finish.tsx's own overviewHref: the split
  // reads the slug by position regardless of the trailing segment (/review
  // here, formerly /analysis), so it stays correct wherever this component is
  // mounted.
  const [, slug] = pathname.split("/").filter(Boolean)
  const analysisHref = `/pay-mappings/${slug}/analysis`
  const exitButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => router.push(analysisHref)}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      {t("finish.backToSummary")}
    </Button>
  )

  if (
    run === undefined ||
    gap === undefined ||
    analyses === undefined ||
    runsList === undefined
  ) {
    return (
      <WizardShell
        headerLeft={exitButton}
        headerRight={
          // The queue (and therefore the jump menu's own targets) is not
          // built yet: a plain, harmlessly inert button stands in rather
          // than a real trigger with nothing to open (the load is brief).
          <Button type="button" variant="ghost">
            {t("allSteps")}
          </Button>
        }
        footer={<ReviewProgress loading />}
      >
        <Card className="w-full">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-9 w-40" />
          </CardFooter>
        </Card>
      </WizardShell>
    )
  }

  if (gap.currency === null) {
    return (
      <WizardShell headerLeft={exitButton}>
        <p className="w-full text-muted-foreground text-sm">{tGap("empty")}</p>
      </WizardShell>
    )
  }

  if (queue === null) {
    // Unreachable (every condition above already guarantees `queue` is
    // built), kept only so TypeScript can see it here too.
    return null
  }

  // Re-bound to their own, non-optional consts: TypeScript's narrowing of
  // `run`/`gap`/`analyses`/`queue` from the early-return guards above does
  // not carry into the nested render functions below (a closure is, in
  // general, allowed to run after the enclosing const could theoretically
  // have changed), so each closure would otherwise still see the original
  // `| undefined` / `| null` types. These rebindings have no such caveat:
  // their OWN declared type is already non-optional.
  const currentRun = run
  const currentGap = gap
  const currency: string = gap.currency
  const currentAnalyses = analyses
  const currentQueue = queue

  const locked = currentRun.status === "completed"
  const currentStep = stepAt(currentQueue, stepIndex)
  const previousHandler = stepIndex > 0 ? goBack : undefined

  function renderStep(step: ReviewStep): ReactNode {
    switch (step.kind) {
      case "start":
        return (
          <ReviewStartStep
            runId={currentRun.runId}
            collaboration={collaboration}
            locked={locked}
            animated
            onNext={goForward}
            onPrevious={previousHandler}
          />
        )
      case "praxis": {
        const analysis = currentAnalyses.find(
          (a) => a.scope === "praxis" && a.groupKey === step.area
        )
        return (
          <ReviewPraxisStep
            area={step.area}
            analysis={analysis}
            runId={currentRun.runId}
            locked={locked}
            animated
            onNext={goForward}
            onPrevious={previousHandler}
            onSkip={goForward}
          />
        )
      }
      case "chapterIntro": {
        const groupCount =
          step.chapter === "equalWork"
            ? currentQueue.progress.equalWork.total
            : currentQueue.progress.equivalentWork.total
        return (
          <ReviewChapterIntro
            chapter={step.chapter}
            groupCount={groupCount}
            locked={locked}
            onNext={goForward}
            onPrevious={previousHandler}
          />
        )
      }
      case "group": {
        const analysis = currentAnalyses.find(
          (a) => a.scope === step.scope && a.groupKey === step.group.key
        )
        if (step.scope === "equalWork") {
          return (
            <ReviewGroupStep
              scope="equalWork"
              group={step.group}
              analysis={analysis}
              runId={currentRun.runId}
              locked={locked}
              rows={currentRun.rows}
              currency={currency}
              referenceDateMs={currentRun.referenceDate}
              requiresDocumentation={equalWorkGroupRequiresDocumentation(
                step.group.flag
              )}
              animated
              onNext={goForward}
              onPrevious={previousHandler}
              onSkip={goForward}
            />
          )
        }
        return (
          <ReviewGroupStep
            scope="equivalentWork"
            group={step.group}
            equivalentWork={currentGap.equivalentWork}
            analysis={analysis}
            runId={currentRun.runId}
            locked={locked}
            rows={currentRun.rows}
            currency={currency}
            referenceDateMs={currentRun.referenceDate}
            requiresDocumentation={womenDominatedGroupRequiresDocumentation(
              step.group.comparisons.length
            )}
            animated
            onNext={goForward}
            onPrevious={previousHandler}
            onSkip={goForward}
          />
        )
      }
      case "finish":
        return (
          <ReviewFinish
            queue={currentQueue}
            run={currentRun}
            onPrevious={previousHandler}
          />
        )
    }
  }

  // The jump menu's target for a non-queue group: found by scope+key on the
  // run's own gap result. `requiresDocumentation` still goes through the
  // real predicate (not hardcoded false): non-queue groups always evaluate
  // false today (that is exactly why they aren't in the queue), but the
  // predicate stays the single source of truth rather than a second, silently
  // divergeable copy of the rule.
  function renderExtraGroup(current: {
    scope: "equalWork" | "equivalentWork"
    key: string
  }): ReactNode {
    const closeButton = (
      <Button type="button" variant="ghost" size="sm" onClick={closeExtraGroup}>
        {t("backToJourney")}
      </Button>
    )
    if (current.scope === "equalWork") {
      const group = currentGap.equalWork.find(
        (candidate) => candidate.key === current.key
      )
      if (group === undefined) return null
      const analysis = currentAnalyses.find(
        (a) => a.scope === "equalWork" && a.groupKey === group.key
      )
      return (
        <div className="space-y-2">
          {closeButton}
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
            animated
            onNext={closeExtraGroup}
          />
        </div>
      )
    }
    const group = currentGap.womenDominated.find(
      (candidate) => candidate.key === current.key
    )
    if (group === undefined) return null
    const analysis = currentAnalyses.find(
      (a) => a.scope === "equivalentWork" && a.groupKey === group.key
    )
    return (
      <div className="space-y-2">
        {closeButton}
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
          animated
          onNext={closeExtraGroup}
        />
      </div>
    )
  }

  const activeKey =
    extraGroup !== null
      ? `extra:${extraGroup.scope}:${extraGroup.key}`
      : stepKey(currentStep)

  // Announces a step transition to assistive tech: the chapter name (the
  // footer no longer shows it visibly; each step's own card carries its own
  // heading) plus the same done count ReviewProgress's footer shows, so the
  // two texts can never disagree. Mirrors the currentStep, never the
  // extraGroup overlay: opening/closing an extra group never changes
  // stepIndex, so this announcement and the footer stay in sync rather than
  // the overlay inventing separate copy.
  const announcement = `${t(`chapters.${chapterKeyFor(currentStep)}`)} · ${t(
    "progressDone",
    {
      done: currentQueue.progress.overall.done,
      total: currentQueue.progress.overall.total,
    }
  )}`

  // Every step keeps the shell's default centered reading column (matches
  // the app's other Card-based steps) except a group step (or its
  // extraGroup twin): those carry the underlying-data table/scatter
  // disclosure, which needs real room. Widening WizardShell's OWN
  // contentClassName to fit them and then narrowing everything else back
  // down here (rather than widening the shell for every step) mirrors
  // import-wizard.tsx's identical per-step width split, and for the same
  // reason: doing it on the shell instead would resize the OUTGOING card the
  // moment the step changes, while it is still visible mid-fade.
  const wideStep = extraGroup !== null || currentStep.kind === "group"

  return (
    <WizardShell
      headerLeft={exitButton}
      headerRight={
        <ReviewJumpMenu
          queue={currentQueue}
          gap={currentGap}
          analyses={currentAnalyses}
          currentIndex={stepIndex}
          onJumpToIndex={(index) =>
            goToIndex(index, index > stepIndex ? 1 : -1)
          }
          onOpenExtraGroup={openExtraGroup}
        />
      }
      footer={<ReviewProgress queue={currentQueue} />}
      contentClassName="max-w-4xl"
      contentKey={displayedKey ?? activeKey}
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {/* Transform+opacity only, per docs/ui-animation.md: a plain slide+fade
          between steps, direction-aware (forward vs back). tabIndex={-1} +
          focusStepContainer (above) move focus onto the freshly mounted card
          after every transition, so focus never falls back to <body>.
          onExitComplete below is a separate, order-safe concern from that
          ref: it only sets displayedKey (declared above), never touches
          focus, and fires once the outgoing card has fully exited -- exactly
          the "blank moment" WizardShell's scroll-reset needs, per
          displayedKey's own comment above. */}
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => setDisplayedKey(activeKey)}
      >
        <motion.div
          key={activeKey}
          ref={focusStepContainer}
          tabIndex={-1}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.2 }}
          className={cn("w-full", !wideStep && "mx-auto max-w-2xl")}
        >
          {extraGroup !== null
            ? renderExtraGroup(extraGroup)
            : renderStep(currentStep)}
        </motion.div>
      </AnimatePresence>
    </WizardShell>
  )
}
