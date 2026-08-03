"use client"

import { cn } from "@workspace/ui/lib/utils"
import { motion } from "motion/react"
import { SPRING } from "@/lib/motion"

export interface DotStep {
  key: string
  label: string
}

// Reusable step indicator: one dot per step, the active dot stretched into a
// pill. The width change animates via the layout prop (no text inside the
// dot, so no FLIP distortion per docs/ui-animation.md); siblings reposition
// with the same spring. Steps up to maxReachedIndex are clickable; future
// steps render disabled. Reduced motion is honoured globally.
export function WizardDots({
  steps,
  activeIndex,
  maxReachedIndex,
  onSelect,
  navLabel,
  // Turns every dot into a plain marker: disabled, with no hover highlight.
  // For a phase that cannot be navigated out of (a confirm on the wire, a
  // finished run), where an enabled dot that does nothing on click is a dead
  // affordance. Deliberately separate from maxReachedIndex, which keeps
  // driving the REACHED styling: lowering that instead would grey out the
  // active dot and misreport which step the user is on.
  interactive = true,
}: {
  steps: DotStep[]
  activeIndex: number
  maxReachedIndex: number
  onSelect: (index: number) => void
  navLabel?: string
  interactive?: boolean
}) {
  return (
    <nav
      aria-label={navLabel}
      className="flex items-center justify-center gap-1"
    >
      {steps.map((step, index) => {
        const reached = index <= maxReachedIndex
        const isActive = index === activeIndex
        const selectable = reached && interactive
        return (
          <button
            key={step.key}
            type="button"
            disabled={!selectable}
            aria-label={step.label}
            aria-current={isActive ? "step" : undefined}
            className="group flex h-6 items-center px-1 disabled:cursor-default"
            onClick={() => {
              if (selectable) onSelect(index)
            }}
          >
            <motion.span
              layout
              transition={SPRING}
              className={cn(
                "block h-2 rounded-full",
                isActive ? "w-6 bg-brand" : "w-2",
                !isActive && reached && "bg-brand/40",
                !isActive && selectable && "group-hover:bg-brand/60",
                !reached && "bg-muted"
              )}
            />
          </button>
        )
      })}
    </nav>
  )
}
