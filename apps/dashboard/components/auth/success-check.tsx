"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion } from "motion/react"

// Success badge for the 2FA completion screen: a filled circle with a white tick
// that springs in, with a soft ring pulsing out once behind it for a moment of
// delight. Static under reduced motion (appears in place, no pulse). Decorative
// (aria-hidden); the heading beside it carries the meaning. Emerald reads as
// "secured" here; we have no success token and this is a one-off confirmation
// affordance, not a judgement value.
export function SuccessCheck() {
  const reduce = useReducedMotion()
  return (
    <div
      aria-hidden
      className="relative flex size-16 items-center justify-center"
    >
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-emerald-500/30"
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
      <motion.span
        className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          reduce ? undefined : { type: "spring", stiffness: 360, damping: 18 }
        }
      >
        <HugeiconsIcon icon={Tick02Icon} className="size-8" strokeWidth={3} />
      </motion.span>
    </div>
  )
}
