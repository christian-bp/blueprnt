"use client"

import { Delete02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@workspace/ui/lib/utils"
import { MorphConfirmButton } from "@/components/morph-confirm-button"

// The shared inline remove affordance for list rows (family roles, criteria):
// a ghost trashcan in a fixed-size slot with the armed pill absolutely
// anchored right, so arming overlays the row leftwards and never reflows it.
// h-9 + min-w-9 square the pill up to the row's field height (the inner icon
// button centers inside the border).
export function RemoveConfirm({
  triggerLabel,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
  className,
}: {
  triggerLabel: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  className?: string
}) {
  return (
    <span className={cn("relative size-9 shrink-0", className)}>
      <MorphConfirmButton
        idleVariant="ghost"
        triggerIcon={Delete02Icon}
        triggerLabel={triggerLabel}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        className="absolute top-1/2 right-0 z-10 h-9 min-w-9 -translate-y-1/2 justify-center"
        onConfirm={onConfirm}
        disabled={disabled}
      />
    </span>
  )
}
