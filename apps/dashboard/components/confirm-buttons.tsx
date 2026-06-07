"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

// Inline two-step confirm with regular-sized buttons: the MorphConfirmButton
// sibling for footer-scale actions where the compact pill looks out of place
// next to normal buttons.
//
//   Idle:  a ghost trigger button.
//   Armed: a destructive confirm plus an outline cancel animate in over the
//          trigger's spot.
//
// Zero layout shift, same discipline as the label-variant morph: the trigger
// stays mounted but visually hidden (aria-hidden, no pointer events) while
// armed so the wrapper keeps its size, and the armed row is absolutely
// anchored to one edge so it overlays empty space instead of pushing
// neighbors. Focus moves to the confirm button on arm; cancel disarms;
// confirm awaits onConfirm and then disarms.
//
// `align` controls which edge the armed row anchors to ("right" by default;
// "left" lets it grow into empty space to the trigger's right).
export function ConfirmButtons({
  triggerText,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
  align = "right",
  className,
}: {
  triggerText: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  align?: "right" | "left"
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  // Move focus to the confirm button when the row appears so the confirm
  // action is immediately keyboard-reachable.
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (armed) confirmRef.current?.focus()
  }, [armed])

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Trigger: ghost so it stays visually tertiary next to the primary
          forward CTA. While armed it is hidden from sight and the a11y tree
          but stays in the DOM so the wrapper retains its size. */}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-hidden={armed}
        tabIndex={armed ? -1 : undefined}
        className={cn(armed && "pointer-events-none opacity-0")}
        onClick={() => setArmed(true)}
      >
        {triggerText}
      </Button>
      <AnimatePresence initial={false}>
        {armed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={SPRING}
            className={cn(
              // w-max sizes the overlay to its CONTENT: an absolutely
              // positioned box otherwise shrink-wraps to its containing
              // block (the trigger-sized wrapper), which forced the pair
              // onto two rows. The buttons stay side by side (nowrap); the
              // viewport-relative max-width remains as an overflow guard on
              // very narrow screens.
              "absolute top-1/2 z-20 flex w-max max-w-[calc(100vw-4rem)] -translate-y-1/2 flex-nowrap items-center gap-2",
              align === "right" ? "right-0 justify-end" : "left-0"
            )}
          >
            <Button
              ref={confirmRef}
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={async () => {
                await onConfirm()
                setArmed(false)
              }}
            >
              {confirmLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setArmed(false)}
            >
              {cancelLabel}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
