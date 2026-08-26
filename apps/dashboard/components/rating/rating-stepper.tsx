"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  criteriaLibraryContent,
  MIDPOINT_STEPS,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import type { DimensionKey } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Kbd } from "@workspace/ui/components/kbd"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useEffect, useId, useRef, useState } from "react"
import { assessmentErrorMessage } from "@/lib/assessment-error"
import { SPRING } from "@/lib/motion"
import { toast } from "@/lib/toast"

// The "omfattas inte" step: valid only for a workingConditions criterion,
// never one of the five graded anchor steps.
const NOT_COVERED_STEP = 0

export interface StepperCriterion {
  criterionId: Id<"criteria">
  name: string
  question: string
  measures: string
  notMeasures: string
  dimensionKey: DimensionKey
  // Always five entries (steps 1-5); the caller resolves any anchor the
  // library leaves undefined (2/4) against the model's shared midpoint copy.
  anchors: { step: number; text: string }[]
}

// Step transition: slide in the travel direction, quick fade out. mode="wait"
// keeps exactly one step mounted, so no absolute positioning or height games
// are needed (see docs/ui-animation.md on box-model clamping).
const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0, transition: SPRING },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -24,
    transition: { duration: 0.12 },
  }),
}

// The blind rating flow (assessment glossary): one criterion at a time, the
// anchor texts are the selectable options, with a motivation that becomes
// required at 1, 4, or 5. NEVER renders score, level, weights, or other
// criteria's values.
//
// COMPLETING THE ASSESSMENT IS THIS FLOW'S OWN ENDING (decision 14). The last
// step's button saves its rating and completes the assessment in one gesture,
// and the reveal takes the screen the moment the result turns readable. The
// completion used to be a second errand on a screen of its own after the
// stepper finished, which made finishing an assessment two trips: the same
// shape the criterion-compliance dialog was corrected for when its sign-off
// stopped being a button after the save and became part of it.
export function RatingStepper({
  orgId,
  roleId,
  criteria,
  ratings,
}: {
  orgId: string
  roleId: Id<"roles">
  criteria: StepperCriterion[]
  ratings: { criterionId: string; value: number; motivation: string | null }[]
}) {
  const locale = useLocale()
  const libraryContent = criteriaLibraryContent(locale)
  const t = useTranslations("dashboard.rating")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const setRating = useMutation(api.assessment.ratings.setRating)
  const completeAssessment = useMutation(
    api.assessment.completion.completeAssessment
  )
  const contextPanelId = useId()
  const notCoveredExplanationId = useId()
  const motivationErrorId = useId()

  // THE SCALE COMES FROM THE LIBRARY, which is its only home.
  //
  // The five grade names and meanings lived twice: here as message keys, and
  // in the library's own sharedScale, which is what the method surfaces and
  // the frozen method evidence read. The two had drifted apart in English and
  // in Finnish, and a reader met one wording on the step and the other in the
  // docs page that quotes them. Reading the library is what makes that
  // impossible rather than merely detectable.
  //
  // criteriaLibraryContent is a locale-keyed constant, already read
  // client-side by the model surfaces (check-remedy, method-panel), so this
  // costs no query and no wait. It carries content only: no weight, no budget,
  // no outcome, so the assessor firewall is untouched by construction.
  //
  // "Step" is the glossary's word for a position on this scale; "grade" is
  // listed there as the term to avoid.
  const scaleSteps = ([1, 2, 3, 4, 5] as const).map((step) => ({
    step,
    name: libraryContent.sharedScale[`${step}`].name,
    meaning: libraryContent.sharedScale[`${step}`].meaning,
  }))

  // THE FLOW OPENS AT ITS BEGINNING, every time (owner ruling 2026-08-25).
  //
  // It used to resume "where the work is": the first unanswered criterion, or
  // the LAST one when everything was answered, on the reasoning that a fully
  // rated assessment is one press from its own ending. What that produced is a
  // reader who opens an assessment and is shown the final question, which is
  // not where anyone reads from. Opening an assessment is opening it, not
  // returning to a bookmark.
  //
  // ONE rule rather than two, deliberately. The alternative kept the first
  // gap for a half-done draft and only changed the all-answered case, but the
  // old code was a single ternary conflating "resume at the gap" with "jump
  // to the end", and a position that is sometimes the start and sometimes not
  // is a behaviour nobody can predict from outside. A partly rated draft opens
  // on step 1 with its own saved answer already selected, so nothing is lost
  // on the way forward; the last step still carries the completion.
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [values, setValues] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(
      ratings.map((rating) => [rating.criterionId, rating.value])
    )
  )
  const [motivations, setMotivations] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ratings.map((rating) => [rating.criterionId, rating.motivation ?? ""])
    )
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // The completion's own failure, separate from `failed` (a rating that would
  // not save): its causes are another operator's edits and each one has words
  // of its own, so a shared "could not save" line would hide which of them
  // happened.
  const [completeError, setCompleteError] = useState<string | null>(null)
  // Which criterion's context panel is expanded / has a shown
  // motivation-required message, compared against the current criterion at
  // render time rather than reset with an effect: a fresh step's id can
  // never match the remembered one, so both start closed automatically on
  // every step change, including Back.
  const [contextOpenFor, setContextOpenFor] = useState<string | null>(null)
  const [motivationErrorFor, setMotivationErrorFor] = useState<string | null>(
    null
  )

  // The latest keyboard-relevant state and actions, read by the document key
  // handler below so it can bind once and never read stale values.
  const keysRef = useRef<{
    anchors: { step: number; text: string }[]
    selected: number | undefined
    pending: boolean
    select: (step: number) => void
    advance: () => void
  } | null>(null)

  // Keyboard shortcuts for the blind rating flow: press a digit (an anchor
  // step, 1-5, or 0 on a workingConditions criterion) to choose it, Enter to
  // save and continue. Editable fields (the motivation textarea)
  // keep their own typing, and Enter on a focused button (Next/Back/anchor)
  // is left to that button's native activation so we never advance twice.
  // The Next button carries the matching Enter hint (Kbd).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const keys = keysRef.current
      if (keys === null) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      if (event.key === "Enter") {
        if (
          target instanceof HTMLElement &&
          target.closest("button") !== null
        ) {
          return
        }
        if (keys.selected !== undefined && !keys.pending) {
          event.preventDefault()
          keys.advance()
        }
        return
      }
      if (/^[0-9]$/.test(event.key)) {
        // Not while saving: the in-flight save already captured the step it is
        // writing, so accepting another digit here would leave the UI showing a
        // value the server never received (see handleNext).
        if (keys.pending) return
        const step = Number(event.key)
        if (keys.anchors.some((anchor) => anchor.step === step)) {
          event.preventDefault()
          keys.select(step)
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const current = criteria[index]
  if (current === undefined) return null
  const selected = values[current.criterionId]
  const isWorkingConditions = current.dimensionKey === "workingConditions"
  // The graded 1-5 ladder, plus "omfattas inte" appended last for a
  // workingConditions criterion: a qualitatively different answer from the
  // graded steps, not a sixth degree of them.
  const displayAnchors = isWorkingConditions
    ? [
        ...current.anchors,
        { step: NOT_COVERED_STEP, text: t("notCoveredOption") },
      ]
    : current.anchors
  const trimmedMotivation = (motivations[current.criterionId] ?? "").trim()
  const motivationRequired = selected === 1 || selected === 4 || selected === 5
  const motivationMissing = motivationRequired && trimmedMotivation === ""
  const contextOpen = contextOpenFor === current.criterionId
  const showMotivationError = motivationErrorFor === current.criterionId

  // Reads the step and motivation ONCE, up front, then awaits. Everything that
  // can change either one is frozen while this runs (the anchors, the digit
  // shortcut, the motivation field), because a change landing mid-save would
  // not reach the server and would then be carried to the next criterion as
  // local state the save never wrote.
  async function handleNext() {
    if (current === undefined || selected === undefined) return
    // A second submit cannot start while one is in flight. The Next button is
    // disabled and the Enter shortcut checks pending, so this is the backstop
    // for two activations landing before the re-render publishes pending.
    if (pending) return
    // Motivation required at 1/4/5 (spec 2.5/17.3): refuse the advance and
    // surface the inline message instead of calling the mutation (which
    // would refuse it anyway, but blind round-trip is worse UX).
    if (motivationMissing) {
      setMotivationErrorFor(current.criterionId)
      return
    }
    setPending(true)
    setFailed(false)
    setCompleteError(null)
    try {
      await setRating({
        orgId,
        roleId,
        criterionId: current.criterionId,
        value: selected,
        ...(trimmedMotivation !== "" ? { motivation: trimmedMotivation } : {}),
      })
      if (index === criteria.length - 1) {
        // The flow's ending: the same gesture that saved the last rating
        // completes the assessment. Sequential rather than concurrent, because
        // the completion is refused unless every rating is already stored.
        try {
          // Nothing here re-guards the button, and nothing needs to. A
          // Convex mutation does not resolve when its response arrives: the
          // client stores the resolver and only settles it from the
          // Transition handler, once it has applied the query updates at or
          // past the mutation's own timestamp. So by the time this await
          // returns, the parent's getRoleResult already reads completed, and
          // the `pending` reset in the finally below lands in the SAME render
          // that swaps this stepper out for the reveal. The button is never
          // live on a completed assessment, which is why a second press
          // cannot call setRating and paint "could not be saved" over a
          // completion that worked.
          //
          // Written down because the retired onCompleted() made this obvious
          // by swapping React state synchronously, and the merged flow rests
          // on a platform property instead. A future reader who does not know
          // it will either "fix" a bug that cannot happen or remove the await
          // ordering that makes it true.
          await completeAssessment({ orgId, roleId })
          toast.success(tToast("assessmentCompleted"))
        } catch (error) {
          setCompleteError(
            assessmentErrorMessage(error, tErrors, t("completeError"))
          )
        }
      } else {
        setDirection(1)
        setIndex(index + 1)
      }
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  function handleBack() {
    if (index === 0) return
    setDirection(-1)
    setIndex(index - 1)
  }

  // Publish the latest state/actions for the document key handler. Set during
  // render so it always reflects the current criterion and selection.
  keysRef.current = {
    anchors: displayAnchors,
    selected,
    pending,
    select: (step) =>
      setValues((currentValues) => ({
        ...currentValues,
        [current.criterionId]: step,
      })),
    advance: () => {
      void handleNext()
    },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
          {t("progress", { current: index + 1, total: criteria.length })}
          <HelpMorphButton label={tHelp("blindRatingLabel")}>
            {tHelp("blindRatingBody")}
          </HelpMorphButton>
        </span>
        <div className="flex gap-1" aria-hidden>
          {criteria.map((criterion, dotIndex) => (
            <span
              key={criterion.criterionId}
              className={cn(
                "size-1.5 rounded-full",
                dotIndex < index
                  ? "bg-brand"
                  : dotIndex === index
                    ? "bg-brand/60"
                    : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={current.criterionId}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <Card>
            <CardHeader>
              <CardTitle>{current.name}</CardTitle>
              <CardDescription>{current.question}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Collapsible measures/notMeasures context: the trigger is
                  always present (no layout shift from hover/state), and
                  expanding animates new content below it, a legitimate enter
                  (docs/ui-animation.md). */}
              <div>
                <DisclosureToggle
                  label={t("contextToggleLabel")}
                  open={contextOpen}
                  panelId={contextPanelId}
                  onToggle={() =>
                    setContextOpenFor((openFor) =>
                      openFor === current.criterionId
                        ? null
                        : current.criterionId
                    )
                  }
                />
                <AnimatePresence initial={false}>
                  {contextOpen && (
                    <motion.div
                      id={contextPanelId}
                      key="context"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 pt-2 text-muted-foreground text-sm leading-relaxed">
                        <p>
                          <span className="font-medium text-foreground">
                            {`${t("measuresLabel")}: `}
                          </span>
                          {current.measures}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            {`${t("notMeasuresLabel")}: `}
                          </span>
                          {current.notMeasures}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* The shared scale names itself before its steps: the same
                  1-5 steps frame every criterion, and the criterion's own
                  anchors say what each step means here.

                  THE MEANINGS LIVE IN THE HELP, not in a disclosure of their
                  own. They were a standing toggle beside this title, which
                  made the scale the one concept on the surface explained in
                  two places: a morph for what the scale IS and a panel for
                  what its steps mean. The morph layer is where this app puts
                  read-only depth, so the panel folds into it.

                  Structured content rather than a prose wall, on the zone
                  morph's precedent (a bolded name, then its lines). Spans
                  rather than divs because the panel wraps its children in a
                  paragraph. */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-medium text-sm">{t("scale.title")}</h3>
                  <HelpMorphButton label={tHelp("sharedScaleLabel")}>
                    <span className="space-y-2">
                      <span className="block">{tHelp("sharedScaleBody")}</span>
                      <span className="block space-y-1.5">
                        {scaleSteps.map((entry) => (
                          <span key={entry.step} className="block">
                            <span className="font-medium text-foreground">
                              {`${entry.step}. ${entry.name}. `}
                            </span>
                            {entry.meaning}
                            {MIDPOINT_STEPS.includes(entry.step) ? (
                              <span className="block">
                                {t("scale.midpointExplanation")}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </span>
                    </span>
                  </HelpMorphButton>
                </div>

                <div
                  role="radiogroup"
                  aria-label={t("anchorGroupLabel", { name: current.name })}
                  className="space-y-2"
                >
                  {displayAnchors.map((anchor) => {
                    const isSelected = selected === anchor.step
                    const isNotCovered = anchor.step === NOT_COVERED_STEP
                    const scaleStep = scaleSteps.find(
                      (entry) => entry.step === anchor.step
                    )
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: the anchor text is the option label; full-width styled cards with rich text use the radiogroup/radio ARIA pattern, not a native radio input
                      <button
                        key={anchor.step}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-describedby={
                          isNotCovered ? notCoveredExplanationId : undefined
                        }
                        // Frozen while the step is saving, so a click cannot
                        // change the selection out from under the in-flight
                        // write. Deliberately no disabled styling: the save is
                        // brief, and greying every anchor for it would flash.
                        // enabled: keeps the hover cue off while locked, so a
                        // locked anchor never looks clickable.
                        disabled={pending}
                        className={cn(
                          "flex w-full items-baseline gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                          isSelected
                            ? "border-brand bg-brand/5"
                            : "enabled:hover:bg-muted/50"
                        )}
                        onClick={() =>
                          setValues((currentValues) => ({
                            ...currentValues,
                            [current.criterionId]: anchor.step,
                          }))
                        }
                      >
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            isSelected ? "text-brand" : "text-muted-foreground"
                          )}
                        >
                          {anchor.step}
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* The app's scanned-label treatment: uppercase,
                              text-xs, tracked, which is the reading floor's
                              own eyebrow exception. Written out here like the
                              app's other scanned labels (the approval card,
                              the compliance dialog, the level-rules panel);
                              it briefly lived in a shared constant beside the
                              stage eyebrows, and outlived them. */}
                          {scaleStep === undefined ? null : (
                            <span className="mb-0.5 block font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              {scaleStep.name}
                            </span>
                          )}
                          <span className="block">{anchor.text}</span>
                        </span>
                      </button>
                    )
                  })}
                  {isWorkingConditions ? (
                    <p
                      id={notCoveredExplanationId}
                      className="text-muted-foreground text-sm"
                    >
                      {t("notCoveredExplanation")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating-motivation">
                  {t("motivationLabel")}
                </Label>
                <Textarea
                  id="rating-motivation"
                  value={motivations[current.criterionId] ?? ""}
                  placeholder={t("motivationPlaceholder")}
                  rows={2}
                  aria-invalid={showMotivationError && motivationMissing}
                  aria-describedby={
                    showMotivationError && motivationMissing
                      ? motivationErrorId
                      : undefined
                  }
                  // readOnly, not disabled: the motivation is read once when
                  // Next fires, so text typed after that would be dropped
                  // silently. readOnly stops the edit without greying the
                  // field or dropping focus for the moment the save takes.
                  readOnly={pending}
                  onChange={(event) =>
                    setMotivations((currentMotivations) => ({
                      ...currentMotivations,
                      [current.criterionId]: event.target.value,
                    }))
                  }
                />
                {showMotivationError && motivationMissing && (
                  <p
                    id={motivationErrorId}
                    role="alert"
                    className="text-destructive text-sm"
                  >
                    {t("motivationRequiredError")}
                  </p>
                )}
              </div>

              {failed && (
                <p role="alert" className="text-destructive text-sm">
                  {t("saveError")}
                </p>
              )}

              {completeError !== null && (
                <p role="alert" className="text-destructive text-sm">
                  {completeError}
                </p>
              )}

              {/* What the ending DOES, in one sentence, where the ending is.
                  It is not framing prose: it states the consequence of the
                  press the reader is about to make, on the one step that
                  carries it, which is the guidance the flow owes them. The
                  sentence used to live on a completion screen of its own; the
                  screen went, the sentence had to stay. */}
              {index === criteria.length - 1 && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("completeExplanation")}
                </p>
              )}

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === 0 || pending}
                  onClick={handleBack}
                >
                  {t("backCta")}
                </Button>
                <Button
                  type="button"
                  disabled={selected === undefined || pending}
                  onClick={handleNext}
                >
                  {index === criteria.length - 1
                    ? t("completeCta")
                    : t("nextCta")}
                  {/* Smaller than the shared default at THIS call site: the
                      keycap sits inside a filled primary button, where the
                      default 20px block reads as a second label beside a
                      36px button's own. It is a hint that Enter does this,
                      so it steps down rather than competing. */}
                  <Kbd
                    data-icon="inline-end"
                    aria-hidden="true"
                    className="h-4 min-w-4 translate-x-0.5 px-1"
                  >
                    ⏎
                  </Kbd>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
