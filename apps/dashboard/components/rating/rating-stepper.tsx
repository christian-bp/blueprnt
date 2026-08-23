"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useEffect, useId, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

// The "omfattas inte" step: valid only for a workingConditions criterion,
// never one of the five graded anchor steps.
const NOT_COVERED_STEP = 0

// Steps 2 and 4 carry no anchor of their own in the library: they are the
// considered space between the steps around them, and the model's shared
// midpoint copy is what fills them.
const MIDPOINT_STEPS = [2, 4]

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
// criteria's values; the reveal happens in the result step the parent shows
// after onCompleted.
export function RatingStepper({
  orgId,
  roleId,
  criteria,
  ratings,
  onCompleted,
}: {
  orgId: string
  roleId: Id<"roles">
  criteria: StepperCriterion[]
  ratings: { criterionId: string; value: number; motivation: string | null }[]
  onCompleted: () => void
}) {
  const t = useTranslations("dashboard.rating")
  const tHelp = useTranslations("dashboard.help")
  const setRating = useMutation(api.assessment.ratings.setRating)
  const contextPanelId = useId()
  const notCoveredExplanationId = useId()
  const motivationErrorId = useId()
  const scalePanelId = useId()

  // The 1-5 grades mean the same thing on every criterion, so the table is
  // built once here and read both by the option rows (the name) and by the
  // panel (the meaning).
  const grades = [
    {
      step: 1,
      name: t("scale.step1.name"),
      meaning: t("scale.step1.meaning"),
    },
    {
      step: 2,
      name: t("scale.step2.name"),
      meaning: t("scale.step2.meaning"),
    },
    {
      step: 3,
      name: t("scale.step3.name"),
      meaning: t("scale.step3.meaning"),
    },
    {
      step: 4,
      name: t("scale.step4.name"),
      meaning: t("scale.step4.meaning"),
    },
    {
      step: 5,
      name: t("scale.step5.name"),
      meaning: t("scale.step5.meaning"),
    },
  ]

  const firstUnrated = criteria.findIndex(
    (criterion) =>
      !ratings.some((rating) => rating.criterionId === criterion.criterionId)
  )
  const [index, setIndex] = useState(firstUnrated === -1 ? 0 : firstUnrated)
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
  // Which criterion's context panel is expanded / has a shown
  // motivation-required message, compared against the current criterion at
  // render time rather than reset with an effect: a fresh step's id can
  // never match the remembered one, so both start closed automatically on
  // every step change, including Back.
  const [contextOpenFor, setContextOpenFor] = useState<string | null>(null)
  // The scale is the same on every criterion, so its panel is not reset per
  // step: a reader who opened it keeps it open all the way through.
  const [scaleOpen, setScaleOpen] = useState(false)
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
    try {
      await setRating({
        orgId,
        roleId,
        criterionId: current.criterionId,
        value: selected,
        ...(trimmedMotivation !== "" ? { motivation: trimmedMotivation } : {}),
      })
      if (index === criteria.length - 1) {
        onCompleted()
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
    <div className="w-full max-w-2xl space-y-4">
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
                <button
                  type="button"
                  aria-expanded={contextOpen}
                  aria-controls={contextPanelId}
                  className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                  onClick={() =>
                    setContextOpenFor((openFor) =>
                      openFor === current.criterionId
                        ? null
                        : current.criterionId
                    )
                  }
                >
                  {t("contextToggleLabel")}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform motion-reduce:transition-none",
                      contextOpen && "rotate-180"
                    )}
                  />
                </button>
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
                  1-5 grades frame every criterion, and the criterion's own
                  anchors say what each grade means here. */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-medium text-sm">{t("scale.title")}</h3>
                  <HelpMorphButton label={tHelp("sharedScaleLabel")}>
                    {tHelp("sharedScaleBody")}
                  </HelpMorphButton>
                  <button
                    type="button"
                    aria-expanded={scaleOpen}
                    aria-controls={scalePanelId}
                    className="ms-auto flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                    onClick={() => setScaleOpen((open) => !open)}
                  >
                    {t("scale.meaningsToggle")}
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 transition-transform motion-reduce:transition-none",
                        scaleOpen && "rotate-180"
                      )}
                    />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {scaleOpen ? (
                    <motion.div
                      id={scalePanelId}
                      key="scale"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING}
                      className="overflow-hidden"
                    >
                      <dl className="space-y-2 pb-1">
                        {grades.map((grade) => (
                          <div
                            key={grade.step}
                            className="flex gap-3 text-sm leading-relaxed"
                          >
                            <dt className="w-3 shrink-0 font-medium text-muted-foreground tabular-nums">
                              {grade.step}
                            </dt>
                            <dd className="min-w-0 flex-1">
                              <span className="font-medium">{grade.name}</span>{" "}
                              <span className="text-muted-foreground">
                                {grade.meaning}
                              </span>
                              {MIDPOINT_STEPS.includes(grade.step) ? (
                                <span className="block text-muted-foreground">
                                  {t("scale.midpointExplanation")}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div
                  role="radiogroup"
                  aria-label={t("anchorGroupLabel", { name: current.name })}
                  className="space-y-2"
                >
                  {displayAnchors.map((anchor) => {
                    const isSelected = selected === anchor.step
                    const isNotCovered = anchor.step === NOT_COVERED_STEP
                    const grade = grades.find(
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
                          {grade === undefined ? null : (
                            <span className="mb-0.5 block font-medium text-muted-foreground text-xs uppercase tracking-wide">
                              {grade.name}
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
                    ? t("finishCta")
                    : t("nextCta")}
                  <Kbd
                    data-icon="inline-end"
                    aria-hidden="true"
                    className="translate-x-0.5"
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
