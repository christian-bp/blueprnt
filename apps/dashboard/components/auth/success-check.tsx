"use client"

import { motion, useReducedMotion } from "motion/react"

// Animated success checkmark: the ring draws itself in, then the tick (pathLength),
// a brief, satisfying confirmation. Static under reduced motion (appears fully
// drawn, no animation). Decorative (aria-hidden); the heading beside it carries
// the meaning. Emerald reads as "secured" here; we have no success token and this
// is a one-off confirmation affordance, not a judgement value.
export function SuccessCheck() {
  const reduce = useReducedMotion()
  return (
    <motion.svg
      viewBox="0 0 52 52"
      className="size-16 text-emerald-600"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <motion.circle
        cx="26"
        cy="26"
        r="23"
        strokeWidth="2"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? undefined : { duration: 0.5, ease: "easeInOut" }}
      />
      <motion.path
        d="M15 27 L23 35 L38 17"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reduce ? undefined : { delay: 0.4, duration: 0.3, ease: "easeOut" }
        }
      />
    </motion.svg>
  )
}
