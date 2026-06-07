"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"

// A trigger button that morphs into a floating panel (used for the AI
// assistance surfaces). The discipline follows docs/ui-animation.md and
// MorphConfirmButton:
//
//   Idle: an in-flow outline button (icon + label).
//   Open: the panel expands FROM the button's measured rect to its full
//         size, absolutely anchored to the trigger's top-right corner, so
//         it overlays the surroundings and neighbors never move. The
//         trigger stays mounted but invisible while open, so the wrapper
//         keeps its size: zero layout shift.
//
// The panel content has a fixed width (so text never rewraps mid-morph)
// and fades in after the box has mostly settled (staged, rule 4). Escape
// and the close button morph it back; focus moves into the panel on open
// and returns to the trigger on close.
export function MorphPopover({
  triggerLabel,
  triggerIcon,
  iconOnly = false,
  anchor = "right",
  title,
  description,
  closeLabel,
  children,
  className,
  panelClassName,
}: {
  triggerLabel: string
  triggerIcon?: IconSvgElement
  // Renders the trigger as a discreet round icon button (triggerLabel
  // becomes its accessible name); used by HelpMorphButton.
  iconOnly?: boolean
  // Which trigger edge the panel anchors to. "right" grows leftward (fits
  // controls at a container's right edge); "left" grows rightward (fits
  // triggers next to left-aligned headings).
  anchor?: "right" | "left"
  title: string
  description?: string
  closeLabel: string
  // Plain content, or a function receiving close() so panel actions (apply,
  // dismiss) can morph the popover back to its button.
  children: ReactNode | ((close: () => void) => ReactNode)
  className?: string
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // The trigger's size at the moment of opening; the panel morphs from and
  // back to this rect. Falls back to a button-ish size before first measure.
  const [fromRect, setFromRect] = useState({ width: 120, height: 36 })

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect !== undefined && rect.width > 0) {
      setFromRect({ width: rect.width, height: rect.height })
    }
    setOpen(true)
  }

  function closePanel() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      {iconOnly ? (
        <button
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel}
          aria-hidden={open}
          tabIndex={open ? -1 : undefined}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "pointer-events-none opacity-0"
          )}
          onClick={openPanel}
        >
          {triggerIcon !== undefined && (
            <HugeiconsIcon
              icon={triggerIcon}
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
        </button>
      ) : (
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="sm"
          aria-hidden={open}
          tabIndex={open ? -1 : undefined}
          className={cn(open && "pointer-events-none opacity-0")}
          onClick={openPanel}
        >
          {triggerIcon !== undefined && (
            <HugeiconsIcon
              icon={triggerIcon}
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          {triggerLabel}
        </Button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            role="dialog"
            aria-label={title}
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
              // The close is a REVERSE morph: the box visibly shrinks back
              // to the trigger's rect and only then crossfades to the real
              // button underneath. Fading on the shared spring made the
              // close read as a plain fade-out.
              transition: {
                width: SPRING,
                height: SPRING,
                opacity: { duration: 0.1, delay: 0.18 },
              },
            }}
            transition={SPRING}
            className={cn(
              "absolute top-0 z-30 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md",
              anchor === "right" ? "right-0" : "left-0",
              panelClassName
            )}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePanel()
            }}
          >
            {/* Fixed content width so text lays out at its final measure
                while the box morphs; the fade is staged after the box has
                mostly settled. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.12 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              className="w-[26rem] max-w-[85vw] space-y-4 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">{title}</h3>
                  {description !== undefined && (
                    <p className="text-muted-foreground text-xs">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={closeLabel}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={closePanel}
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={14}
                    strokeWidth={2}
                  />
                </button>
              </div>
              {typeof children === "function" ? children(closePanel) : children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
