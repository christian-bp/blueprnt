"use client"

import { motion, useReducedMotion } from "motion/react"
import { ConfettiBurst } from "@/components/confetti-burst"

// Shared success badge for one-off completion screens (2FA setup, change
// email, import done): a filled circle springs in, and the moment it lands a
// soft ring pulses out from behind it and throws a ConfettiBurst with it,
// while the tick DRAWS itself across the circle (stroke pathLength) through
// the confetti's flight. The burst itself lives in confetti-burst.tsx, so the
// dashboard's to-do row throws the same one.
// Static under reduced motion (appears fully drawn, no pulse, no burst).
// Decorative (aria-hidden); the heading beside it carries the meaning.
// Brand-colored: this is a one-off celebratory confirmation, not a judgement
// value, so the brand accent is appropriate here.

const IMPACT_DELAY = 0.12
const RIPPLE_DURATION = 0.9

export function SuccessCheck() {
  const reduce = useReducedMotion()
  return (
    <div
      aria-hidden
      className="relative isolate flex size-18 items-center justify-center"
    >
      {!reduce && (
        <>
          <motion.span
            data-testid="success-ripple"
            className="absolute inset-0 rounded-full bg-brand/30"
            // Same keyframe-array trick as the pieces below: opacity snaps to
            // 0.5 when the ripple launches, so it is not a rose disc parked
            // under the badge through the delay.
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.9, opacity: [0.5, 0] }}
            transition={{
              duration: RIPPLE_DURATION,
              delay: IMPACT_DELAY,
              ease: "easeOut",
            }}
          />
          <ConfettiBurst delay={IMPACT_DELAY} />
        </>
      )}
      <motion.span
        className="relative z-10 flex size-18 items-center justify-center rounded-full bg-brand text-brand-foreground"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          reduce ? undefined : { type: "spring", stiffness: 360, damping: 18 }
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-11"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M6 12.5 L10 16.5 L18 7.5"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              reduce
                ? undefined
                : { delay: 0.25, duration: 0.3, ease: "easeOut" }
            }
          />
        </svg>
      </motion.span>
    </div>
  )
}
