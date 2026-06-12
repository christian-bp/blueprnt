"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

// The marketing site's one motion primitive (MOTION_INTENSITY 5): a gentle
// rise-and-fade, either on load (hero entrance) or when scrolled into view
// (section reveals, once). Animates transform and opacity only, and
// collapses to static markup under prefers-reduced-motion. Server sections
// pass children through this client leaf, so they stay server components.
export function Reveal({
  children,
  mode = "view",
  delay = 0,
  className,
}: {
  children: ReactNode
  mode?: "load" | "view"
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>

  const transition = {
    duration: 0.6,
    delay,
    ease: [0.16, 1, 0.3, 1] as const,
  }
  if (mode === "load") {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        {children}
      </motion.div>
    )
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
