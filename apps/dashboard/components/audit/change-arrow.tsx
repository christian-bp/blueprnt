import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// The "before → after" separator used throughout the audit log: the detail
// sheets' change rows, the AI weight-move list, and the compact table-cell
// summaries. It replaces the bare "→" glyph (which rendered thin and sat off
// the text baseline) with the design system's right-arrow icon, matching the
// weight-review panel, so every transition reads the same and aligns with the
// text around it. Inline by default so it drops straight into a line of text or
// a truncating table cell; the horizontal margin gives it the breathing room
// the glyph's surrounding spaces used to. Decorative (aria-hidden): the before
// and after values carry the meaning. Pass `className` to tune spacing per call
// site (e.g. no left margin at the start of a line).
export function ChangeArrow({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
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
