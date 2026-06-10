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
export function OnboardingDots({
  steps,
  activeIndex,
  maxReachedIndex,
  onSelect,
  navLabel,
}: {
  steps: DotStep[]
  activeIndex: number
  maxReachedIndex: number
  onSelect: (index: number) => void
  navLabel?: string
}) {
  return (
    <nav
      aria-label={navLabel}
      className="flex items-center justify-center gap-1"
    >
      {steps.map((step, index) => {
        const reachable = index <= maxReachedIndex
        const isActive = index === activeIndex
        return (
          <button
            key={step.key}
            type="button"
            disabled={!reachable}
            aria-label={step.label}
            aria-current={isActive ? "step" : undefined}
            className="group flex h-6 items-center px-1 disabled:cursor-default"
            onClick={() => {
              if (reachable) onSelect(index)
            }}
          >
            <motion.span
              layout
              transition={SPRING}
              className={cn(
                "block h-2 rounded-full",
                isActive ? "w-6 bg-primary" : "w-2",
                !isActive &&
                  reachable &&
                  "bg-primary/40 group-hover:bg-primary/60",
                !reachable && "bg-muted"
              )}
            />
          </button>
        )
      })}
    </nav>
  )
}
