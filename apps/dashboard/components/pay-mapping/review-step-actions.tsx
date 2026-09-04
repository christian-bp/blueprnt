"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"

// A review step's free-text field, sized once for every step that has one
// (samverkan's two fields, a praxis finding, a group's motivation).
//
// The vendored Textarea auto-sizes on field-sizing-content, which is right
// for a composer but wrong here: this field sits ABOVE the step's action row,
// so the box grows as the reader types and shrinks again when a step with a
// saved note is followed by an empty one, and the primary button moves under
// the cursor either way. A fixed height keeps the whole card still and lets
// the field scroll instead, which is what a form in a stepper needs. h-24 is
// three lines of the field's own text, up from the vendored two-line floor.
export const REVIEW_NOTE_FIELD_CLASS = "field-sizing-fixed h-24"

// Whether a step's action row would draw anything. A step whose work is
// finished can end up with no primary, no undo and no hint, and an empty
// row still occupies its footer's height: callers pass the footer only when
// this says there is something in it.
export function hasStepActions(props: {
  onPrevious?: () => void
  onSkip?: () => void
  primaryLabel?: string
  hint?: string
  onUndo?: () => void
}): boolean {
  return (
    props.onPrevious !== undefined ||
    props.onSkip !== undefined ||
    props.primaryLabel !== undefined ||
    props.hint !== undefined ||
    props.onUndo !== undefined
  )
}

// The review journey's shared action row: every step card (start, praxis,
// group, chapter intro, finish) ends with this same anatomy, so the wizard
// reads consistently across chapters. Previous/Skip are optional and hidden
// (not merely disabled) when the step has nowhere to go: the start step has
// no previous, and the finish step has nothing to skip. The primary action
// and its label are always the caller's: "Continue" (never disabled, the
// start step) vs. "Mark done and continue" (gated, the praxis/group steps).
// The hint sits above the buttons, muted, so the gating requirement is
// stated in words rather than a silently disabled button (the app's
// guidance rule): the caller passes it only while the primary is pending.

export function ReviewStepActions({
  onPrevious,
  onSkip,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  hint,
  onUndo,
}: {
  onPrevious?: () => void
  onSkip?: () => void
  // Omitted once the step's own work is finished and its only remaining act
  // is to move on: the chapter's continuation below the card already offers
  // that, and two buttons for one destination read as two decisions.
  primaryLabel?: string
  onPrimary?: () => void
  primaryDisabled?: boolean
  hint?: string
  // Un-marks a done step: a ghost button right beside the primary, passed
  // only while the step IS done and editable.
  onUndo?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.review")

  return (
    <div className="flex w-full flex-col gap-2">
      {hint !== undefined && (
        <p className="text-muted-foreground text-sm">{hint}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onPrevious && (
            <Button type="button" variant="outline" onClick={onPrevious}>
              {t("previous")}
            </Button>
          )}
          {onSkip && (
            <Button type="button" variant="ghost" onClick={onSkip}>
              {t("skip")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onUndo && (
            <Button type="button" variant="ghost" onClick={onUndo}>
              {t("undoDone")}
            </Button>
          )}
          {primaryLabel !== undefined && onPrimary !== undefined && (
            <Button
              type="button"
              disabled={primaryDisabled}
              onClick={onPrimary}
            >
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
