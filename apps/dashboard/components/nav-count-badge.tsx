"use client"

import NumberFlow from "@number-flow/react"
import { Badge } from "@workspace/ui/components/badge"
import { AnimatePresence, motion } from "motion/react"
import { SPRING } from "@/lib/motion"

// Notification count on an inner-sidebar nav row (Classify's people left to
// classify, Roles' roles left to evaluate): the brand Badge with a
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
    // No initial={false}: the parent tab mounts this only once its query has
    // loaded, so the badge's first render already carries the count, and
    // suppressing initial would swallow the enter animation entirely. Letting
    // the mount animate is the point: the badge springs in when the section
    // appears and whenever the count crosses zero.
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={SPRING}
          // ml-auto: the counter sits at the row's right edge, clear of the
          // label, like a notification count in any sidebar.
          className="ml-auto inline-flex"
        >
          <Badge
            aria-label={label}
            // Round, not the pill: a circle for one or two digits, easing
            // into a rounded capsule only when a third digit needs the room.
            className="h-5 min-w-5 justify-center rounded-full px-1 tabular-nums"
          >
            <NumberFlow value={count} />
          </Badge>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
