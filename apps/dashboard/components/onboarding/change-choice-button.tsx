"use client"

import { useTranslations } from "next-intl"
import { MorphConfirmButton } from "@/components/morph-confirm-button"

// Thin wrapper over the label-variant MorphConfirmButton wired to the
// model.change.* labels. The ghost trigger keeps it visually tertiary so it
// never competes with back/finish. Discarding the model is destructive
// (deletes the model and its children), so the first click only arms the
// control; the second confirms.
//
// align="left" so the armed pill grows into the empty footer space to the
// trigger's right, never overlapping the back button (to its left) and staying
// clear of the finish button (far right, across the justify-between gap).
export function ChangeChoiceButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void | Promise<void>
  disabled?: boolean
}) {
  const t = useTranslations("dashboard.model.change")

  return (
    <MorphConfirmButton
      variant="label"
      align="left"
      triggerText={t("cta")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  )
}
