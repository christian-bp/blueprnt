"use client"

import { motion, useReducedMotion } from "motion/react"

// Soft drifting "aurora" for the light brand panel: a few large, heavily blurred,
// brand-tinted blobs that slowly drift, an abstract light-mode take on a living
// background (the spirit of midday's video, not polyform's dot-network).
// Decorative (aria-hidden), GPU-cheap (transform + blur only, no layout
// animation), clipped by the parent's overflow-hidden, and STATIC under reduced
// motion (no drift). Reads the global MotionConfig via useReducedMotion.
const BLOBS = [
  {
    className: "top-[-15%] left-[-10%] size-[28rem] bg-brand/20",
    drift: { x: [0, 40, 0], y: [0, 30, 0] },
    duration: 22,
  },
  {
    className: "top-[25%] right-[-15%] size-[24rem] bg-rose-300/25",
    drift: { x: [0, -32, 0], y: [0, 36, 0] },
    duration: 27,
  },
  {
    className: "bottom-[-15%] left-[12%] size-[26rem] bg-brand/15",
    drift: { x: [0, 28, 0], y: [0, -24, 0] },
    duration: 31,
  },
]

export function BackgroundAurora() {
  const reduce = useReducedMotion()
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {BLOBS.map((blob, i) => (
        <motion.div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative blobs
          key={i}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          animate={reduce ? undefined : blob.drift}
          transition={
            reduce
              ? undefined
              : {
                  duration: blob.duration,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }
          }
        />
      ))}
    </div>
  )
}
