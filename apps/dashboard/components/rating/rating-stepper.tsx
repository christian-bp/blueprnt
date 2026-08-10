"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
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
import { useEffect, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

export interface StepperCriterion {
  criterionId: Id<"criteria">
  name: string
  description: string
  helpText: string
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
// anchor texts are the selectable options, optional motivation per rating.
// NEVER renders score, level, weights, or other criteria's values; the reveal
// happens in the result step the parent shows after onCompleted.
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
  // step, 0-5) to choose it, Enter to save and continue. Editable fields (the
  // motivation textarea) keep their own typing, and Enter on a focused button
  // (Next/Back/anchor) is left to that button's native activation so we never
  // advance twice. The Next button carries the matching Enter hint (Kbd).
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
    setPending(true)
    setFailed(false)
    try {
      const motivation = (motivations[current.criterionId] ?? "").trim()
      await setRating({
        orgId,
        roleId,
        criterionId: current.criterionId,
        value: selected,
        ...(motivation !== "" ? { motivation } : {}),
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
    anchors: current.anchors,
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
              <CardDescription>{current.description}</CardDescription>
              {current.helpText !== "" && (
                <p className="text-muted-foreground text-sm">
                  {current.helpText}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="radiogroup"
                aria-label={t("anchorGroupLabel", { name: current.name })}
                className="space-y-2"
              >
                {current.anchors.map((anchor) => {
                  const isSelected = selected === anchor.step
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: the anchor text is the option label; full-width styled cards with rich text use the radiogroup/radio ARIA pattern, not a native radio input
                    <button
                      key={anchor.step}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      // Frozen while the step is saving, so a click cannot
                      // change the selection out from under the in-flight
                      // write. Deliberately no disabled styling: the save is
                      // brief, and greying six anchors for it would flash.
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
                      <span className="min-w-0 flex-1">{anchor.text}</span>
                    </button>
                  )
                })}
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
