"use client"

import NumberFlow from "@number-flow/react"
import { Badge } from "@workspace/ui/components/badge"
import { AnimatePresence, motion } from "motion/react"
import { SPRING } from "@/lib/motion"

// Notification count on a header nav tab (the Classify tab's people left to
// classify, the Roles tab's roles left to evaluate): the brand Badge with a
// NumberFlow value so count changes roll digit-by-digit instead of swapping,
// and a spring scale-in/out so the badge enters and leaves smoothly when the
// count crosses zero. Hidden entirely at zero (nothing left is not a
// notification). NumberFlow and the spring both respect reduced motion
// (NumberFlow's default; MotionConfig reducedMotion="user" app-wide).
export function NavCountBadge({
  count,
  label,
}: {
  count: number
  label: string
}) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={SPRING}
          className="ml-1.5 inline-flex"
        >
          <Badge aria-label={label}>
            <NumberFlow value={count} />
          </Badge>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
