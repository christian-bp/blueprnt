import { ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// The shared "before → after" transition arrow, used wherever the UI shows one
// value changing into another: the audit log (detail-sheet change rows, the AI
// weight-move list, the compact table-cell summaries) and the model
// weight-review panel. It is a true arrow with a shaft (ArrowRight02Icon), not a
// chevron, so it reads as a transition rather than a "next" affordance, and it
// replaces the bare "→" glyph that rendered thin and off the text baseline.
// Inline by default so it drops straight into a line of text or a truncating
// table cell; the horizontal margin gives it the breathing room the glyph's
// surrounding spaces used to. Override via `className` (e.g. `mx-0` at the start
// of a line, or inside a flex row that already has a gap). Decorative
// (aria-hidden): the before and after values carry the meaning.
export function ChangeArrow({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={ArrowRight02Icon}
      size={14}
      strokeWidth={2}
      aria-hidden="true"
      className={cn(
        "mx-1.5 inline-block shrink-0 align-middle text-muted-foreground",
        className
      )}
    />
  )
}
