"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"
import { ConfettiBurst } from "@/components/confetti-burst"

// The small-scale celebration: a soft confetti burst thrown from the edges of
// whatever it wraps, for a moment that matters but is not the whole screen
// (SuccessCheck's ripple + full burst is for that; a one-off completion
// screen has earned it). Extracted from the overview to-do row so a work card
// arriving and a progress chapter completing throw the same burst rather than
// two that drift apart. "soft" + "edges" is the tuned recipe for celebrating
// a piece of a busier page, not a fresh one to pick per call site.
//
// The burst renders BEFORE `children` on purpose: an opaque child then paints
// over the portion of the burst that overlaps it, so no piece is ever visible
// sandwiched behind the content it celebrates. This only works with the
// "edges" origin (a piece starts outside the child from its first frame, so
// only the half still overlapping is hidden); do not reorder these two, and
// do not swap the origin without moving this too. See confetti-burst.tsx's
// own edge-origin note for the mechanism.
export function CelebrationBurst({
  active,
  delay = 0,
  className,
  children,
}: {
  active: boolean
  delay?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <ConfettiBurst
        active={active}
        delay={delay}
        spread={0.45}
        origin="edges"
        intensity="soft"
      />
      {children}
    </div>
  )
}
