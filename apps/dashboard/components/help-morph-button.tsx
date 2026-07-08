"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

// A discreet round information icon that MORPHS into an explainer panel,
// the product's signature help affordance. Sits next to a heading or a
// field label; `label` doubles as the trigger's accessible name and the
// panel title. There is no close button: outside click and Escape close
// the panel (Base UI dismissal).
//
// The morph follows docs/ui-animation.md and MorphConfirmButton: the panel
// springs open FROM the trigger's measured rect to its full size, the text
// fades in staged after the box has mostly settled, and closing is a
// REVERSE morph back to the trigger's rect before the crossfade.
//
// Positioning is Base UI Popover primitives (portaled to body) rather than
// an in-flow absolute panel: help triggers sit inside arbitrary containers,
// including dialogs and scroll areas, and only a portaled panel escapes
// their overflow clipping while composing with the dialog's focus trap and
// Escape handling. side=bottom + align=start with a negative sideOffset of
// the trigger's own height pins the panel's top-left corner ON the
// trigger's top-left corner, so the panel starts exactly over the button
// and the width/height spring grows right and down out of it (the same
// overlay-and-grow as the original in-flow morph).
export function HelpMorphButton({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // The trigger's size at the moment of opening; the panel morphs from and
  // back to this rect. Falls back to the icon's size before first measure.
  const [fromRect, setFromRect] = useState({ width: 24, height: 24 })

  function handleOpenChange(next: boolean) {
    if (next) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect !== undefined && rect.width > 0) {
        setFromRect({ width: rect.width, height: rect.height })
      }
    }
    setOpen(next)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        ref={triggerRef}
        aria-label={label}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Hidden while open: the panel overlays this exact rect, and the
          // close crossfade reveals the trigger again underneath.
          "data-popup-open:pointer-events-none data-popup-open:opacity-0",
          className
        )}
      >
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
      </PopoverPrimitive.Trigger>
      {/* keepMounted + AnimatePresence: we own mount/unmount so the exit
          morph can play before the portal is removed (the Base UI pattern
          for Motion-driven exits; the exit animates opacity, which Base UI
          watches to delay unmount). */}
      <AnimatePresence initial={false}>
        {open && (
          <PopoverPrimitive.Portal keepMounted>
            <PopoverPrimitive.Positioner
              side="bottom"
              align="start"
              sideOffset={-fromRect.height}
              collisionPadding={8}
              className="isolate z-50"
            >
              <PopoverPrimitive.Popup
                aria-label={label}
                // The animated element carries the panel chrome and ONLY
                // geometry animations (width/height/opacity); the Positioner
                // owns the transform, so the two never fight over styles.
                render={
                  <motion.div
                    initial={{
                      width: fromRect.width,
                      height: fromRect.height,
                      opacity: 1,
                    }}
                    animate={{ width: "auto", height: "auto", opacity: 1 }}
                    exit={{
                      width: fromRect.width,
                      height: fromRect.height,
                      opacity: 0,
                      // Reverse morph: the box visibly shrinks back to the
                      // trigger's rect and only then crossfades away.
                      transition: {
                        width: SPRING,
                        height: SPRING,
                        opacity: { duration: 0.1, delay: 0.18 },
                      },
                    }}
                    transition={SPRING}
                    className="z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md outline-hidden"
                  />
                }
              >
                {/* Fixed content width so text lays out at its final measure
                    while the box morphs; the fade is staged after the box
                    has mostly settled. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.12 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="w-[26rem] max-w-[85vw] space-y-3 p-4"
                >
                  <h3 className="font-medium text-sm">{label}</h3>
                  <p className="text-muted-foreground text-sm">{children}</p>
                </motion.div>
              </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  )
}
