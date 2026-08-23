"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// The app's one "show me more" control.
//
// Four surfaces grew their own copy of this within a single phase (the rating
// stepper's context and scale panels, the library picker's per-criterion depth,
// the audit log's story row), and a fifth predated them with the chevron on the
// other side at a different size. That is the drift a named component exists to
// stop: a reader who learns the gesture on one surface should meet the same
// control everywhere.
//
// LABEL FIRST, chevron after. The label is what the reader is looking for; the
// chevron only says which way it will go. `aria-expanded` carries the state, so
// the chevron is decorative and rotates rather than swapping glyphs, which
// keeps the control's width fixed and its box from jogging as it opens.
//
// The caller owns the panel and the animation: this is the trigger only, so a
// surface can reveal in place, inside a table cell, or through AnimatePresence
// without this component knowing which.
export function DisclosureToggle({
  label,
  open,
  panelId,
  onToggle,
  className,
}: {
  label: string
  open: boolean
  // Present when the caller renders a panel this trigger controls; omitted for
  // a trigger whose panel is not a separately identified region (a table row
  // that expands into sibling rows).
  panelId?: string
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      {...(panelId !== undefined ? { "aria-controls": panelId } : {})}
      className={cn(
        "flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground",
        className
      )}
      onClick={onToggle}
    >
      {label}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className={cn(
          "size-3.5 transition-transform motion-reduce:transition-none",
          open && "rotate-180"
        )}
      />
    </button>
  )
}
