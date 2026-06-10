"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

// Reusable morphing confirm button with one morph behavior and two triggers.
//
// Both variants spring between two states:
//   Idle:  the trigger (an icon button, or a labelled outline button).
//   Armed: a pill expands to show a destructive confirm + a neutral cancel.
//
// The component owns: armed state, the motion.div layout container with the
// solid pill styling, AnimatePresence content swap, focus-to-confirm on arm,
// cancel-to-disarm, confirm-calls-onConfirm-then-disarms.
//
// Variants:
//   "icon" (default) - a neutral icon button that morphs in place into the
//     armed pill. Callers position it absolutely (e.g. a row corner) so the
//     pill's width morph shifts nothing. Behavior is unchanged from the
//     original single-variant component.
//   "label" - an inline labelled trigger (outline/ghost styling). The wrapper
//     is sized by the trigger alone; the armed pill renders absolutely anchored
//     to one edge of the wrapper and overlays the surrounding layout. The
//     trigger stays mounted but visually hidden (aria-hidden, no pointer
//     events) while armed so the wrapper keeps its size: ZERO layout shift, so
//     neighbors never move (per docs/ui-animation.md).
//
// `align` controls which edge the armed pill anchors to ("right" by default;
// "left" lets the pill grow into empty space to the trigger's right).
//
// Common props:
//   confirmLabel  - text of the destructive confirm button
//   cancelLabel   - aria-label for the cancel cross icon button
//   onConfirm     - called when the user confirms; may be async
//   disabled      - in-flight state; disables all inner buttons
//   align         - "right" (default) or "left" anchor edge for the armed pill
//   className     - merged onto the motion container (icon variant) or onto the
//                   wrapper (label variant), for positioning + reveal classes
//
// Icon-variant props:
//   variant       - "icon" (or omitted)
//   triggerLabel  - aria-label for the idle icon button
//   triggerIcon   - idle icon; defaults to the neutral cross (pass a trashcan
//                   where the trigger should read as delete, e.g. list rows)
//
// Label-variant props:
//   variant       - "label"
//   triggerText   - the visible button label (also its accessible name, so no
//                   separate aria-label is needed)
interface MorphConfirmBaseProps {
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  align?: "right" | "left"
  className?: string
}

interface MorphConfirmIconProps extends MorphConfirmBaseProps {
  variant?: "icon"
  triggerLabel: string
  triggerIcon?: IconSvgElement
}

interface MorphConfirmLabelProps extends MorphConfirmBaseProps {
  variant: "label"
  triggerText: string
}

export type MorphConfirmButtonProps =
  | MorphConfirmIconProps
  | MorphConfirmLabelProps

export function MorphConfirmButton(props: MorphConfirmButtonProps) {
  const {
    confirmLabel,
    cancelLabel,
    onConfirm,
    disabled,
    align = "right",
    className,
  } = props
  const [armed, setArmed] = useState(false)

  // Move focus to the confirm button when the pill expands so the confirm
  // action is immediately keyboard-reachable without a visible focus jump.
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (armed) confirmRef.current?.focus()
  }, [armed])

  // The armed pill body is identical across variants: a destructive confirm
  // button and a neutral cancel cross. Focus moves to confirm via the useEffect.
  // Every interactive element is the design-system Button so sizing, focus,
  // hover, and disabled styling come from its variants, not custom CSS.
  const armedContent = (
    <span className="flex items-center gap-1 p-0.5">
      <Button
        ref={confirmRef}
        type="button"
        variant="destructive"
        size="xs"
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
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        aria-label={cancelLabel}
        className="text-muted-foreground"
        onClick={() => setArmed(false)}
      >
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
    </span>
  )

  // LABEL variant: the wrapper is sized by the trigger only. The trigger stays
  // mounted (visually hidden while armed) so the wrapper keeps its width, and
  // the armed pill is absolutely anchored over the wrapper. This guarantees
  // zero layout shift: arming reveals the pill as an overlay; neighbors in the
  // footer never move.
  if (props.variant === "label") {
    return (
      <div className={cn("relative inline-flex", className)}>
        {/* Trigger: ghost button kept visually tertiary so it never competes
            with the back/finish buttons (matching the original change-choice
            trigger). While armed it is hidden from sight and the a11y tree but
            stays in the DOM so the wrapper retains its size. */}
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-hidden={armed}
          tabIndex={armed ? -1 : undefined}
          className={cn(armed && "pointer-events-none opacity-0")}
          onClick={() => setArmed(true)}
        >
          {props.triggerText}
        </Button>
        {/* Armed pill: absolutely positioned over the wrapper, anchored to the
            chosen edge so its width morph grows away from that edge. Same pill
            styling and morph as the icon variant. */}
        <AnimatePresence initial={false}>
          {armed && (
            <motion.div
              // layout so the pill width springs as the content settles.
              layout
              transition={SPRING}
              className={cn(
                "absolute top-1/2 z-20 flex -translate-y-1/2 items-center overflow-hidden rounded-md border bg-background shadow-sm",
                align === "right" ? "right-0" : "left-0"
              )}
            >
              {/* layout="position" scale-corrects the children against the
                  parent's width FLIP animation so the labels never warp. */}
              <motion.div
                layout="position"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={SPRING}
              >
                {armedContent}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ICON variant: an icon button that morphs in place. Callers position the
  // container absolutely so its width morph shifts nothing.
  return (
    // motion.div with `layout` so the pill width springs when content swaps.
    // overflow-hidden clips content during the width animation.
    // Base pill styling is always applied. Caller className is included for
    // positioning and reveal; when armed or disabled we append opacity-100 to
    // force visibility regardless of the caller's hide-at-rest classes.
    <motion.div
      layout
      transition={SPRING}
      className={cn(
        "flex items-center overflow-hidden rounded-md border bg-background shadow-sm",
        className,
        (armed || disabled) && "opacity-100"
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!armed ? (
          // Idle state: neutral cross icon. Destructive color is reserved for
          // the confirm action only.
          <motion.div
            key="idle"
            // layout="position" lets Motion scale-correct this child while the
            // parent FLIP-animates its width; without it the content visually
            // warps during the shrink/grow.
            layout="position"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={props.triggerLabel}
              className="text-muted-foreground"
              onClick={() => setArmed(true)}
            >
              <HugeiconsIcon
                icon={props.triggerIcon ?? Cancel01Icon}
                strokeWidth={2}
              />
            </Button>
          </motion.div>
        ) : (
          // Armed state: destructive confirm + neutral cancel. Focus moves to
          // confirm automatically via the useEffect above.
          <motion.div
            key="armed"
            // See the idle twin: scale-corrects the text against the parent's
            // width animation so the label never distorts on disarm.
            layout="position"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING}
          >
            {armedContent}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
