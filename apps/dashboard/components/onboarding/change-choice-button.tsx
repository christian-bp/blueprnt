"use client"

import { useTranslations } from "next-intl"
import { ConfirmButtons } from "@/components/confirm-buttons"

// Thin wrapper over ConfirmButtons wired to the model.change.* labels. The
// ghost trigger keeps it visually tertiary so it never competes with the
// Next button. Discarding the model is destructive (deletes the model and
// its children), so the first click only arms the control; the regular-sized
// confirm/cancel pair then animates in over the trigger's spot.
//
// The trigger sits immediately left of the Next button (the wizard's footer
// convention), so the armed row keeps the default right anchor and grows
// leftward into the footer's empty space, staying clear of the Next button.
export function ChangeChoiceButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void | Promise<void>
  disabled?: boolean
}) {
  const t = useTranslations("dashboard.model.change")

  return (
    <ConfirmButtons
      triggerText={t("cta")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  )
}
