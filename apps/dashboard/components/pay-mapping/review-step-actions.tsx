"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"

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
  primaryLabel: string
  onPrimary: () => void
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
          <Button type="button" disabled={primaryDisabled} onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
