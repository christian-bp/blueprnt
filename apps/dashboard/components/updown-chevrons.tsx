import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// The stacked up/down chevron pair that marks a row as a PICKER (this row
// swaps the thing it shows) rather than a link or an actions menu. Hugeicons
// free ships the two chevrons only as separate glyphs, so the pair is composed
// here instead of hand-drawing a third glyph: each chevron renders in its own
// 16px box, nudged out of the shared box by 4px so their ink meets in the
// middle with a small gap and the pair still occupies one normal icon slot.
export function UpDownChevrons({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block size-4 shrink-0", className)}
    >
      <HugeiconsIcon
        icon={ArrowUp01Icon}
        strokeWidth={2}
        className="absolute inset-x-0 -top-1 size-4"
      />
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        className="absolute inset-x-0 -bottom-1 size-4"
      />
    </span>
  )
}
