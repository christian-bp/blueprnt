"use client"

import { motion, useReducedMotion } from "motion/react"

// Success badge for the 2FA completion screen: a filled circle springs in (with
// a soft ring pulsing out once behind it), then the tick DRAWS itself across the
// circle (stroke pathLength). Static under reduced motion (appears fully drawn,
// no pulse). Decorative (aria-hidden); the heading beside it carries the meaning.
// Brand-colored: this is a one-off celebratory confirmation, not a judgement
// value, so the brand accent is appropriate here.
export function SuccessCheck() {
  const reduce = useReducedMotion()
  return (
    <div
      aria-hidden
      className="relative flex size-18 items-center justify-center"
    >
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-brand/30"
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
      <motion.span
        className="flex size-18 items-center justify-center rounded-full bg-brand text-brand-foreground"
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
