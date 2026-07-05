"use client"

import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"

// Soft drifting "aurora" for the light brand panel: several large, blurred,
// brand-tinted radial glows that slowly drift, scale, and breathe in opacity, an
// abstract light-mode living background (the spirit of midday's video, not
// polyform's dot-network). Decorative (aria-hidden), GPU-cheap (transform +
// opacity + blur, no layout animation), clipped by the parent's overflow-hidden,
// and STATIC under reduced motion. Radial gradients (not flat circles) give each
// glow a natural edge falloff, so the blobs melt together instead of reading as
// discs. Every keyframe track starts and ends on the same value, so the infinite
// loop is seamless. Reads the global MotionConfig via useReducedMotion.
const BLOBS = [
  {
    className: "top-[-20%] left-[-15%] size-[42rem]",
    color: "rgba(244,63,94,0.20)", // brand rose
    drift: {
      x: [0, 240, 90, 0],
      y: [0, 150, 300, 0],
      scale: [1, 1.3, 1.12, 1],
    },
    duration: 11,
  },
  {
    className: "top-[8%] right-[-20%] size-[38rem]",
    color: "rgba(251,113,133,0.18)", // rose 400
    drift: {
      x: [0, -210, -60, 0],
      y: [0, 190, 70, 0],
      scale: [1, 1.18, 1.34, 1],
    },
    duration: 13,
  },
  {
    className: "bottom-[-25%] left-[8%] size-[40rem]",
    color: "rgba(253,164,175,0.16)", // rose 300
    drift: {
      x: [0, 180, 270, 0],
      y: [0, -160, -60, 0],
      scale: [1, 1.28, 1, 1],
    },
    duration: 15,
  },
  {
    className: "top-[34%] left-[28%] size-[30rem]",
    color: "rgba(255,228,230,0.55)", // rose 50 warm wash
    drift: {
      x: [0, -140, 140, 0],
      y: [0, 120, -90, 0],
      scale: [1, 1.32, 1.14, 1],
    },
    duration: 10,
  },
]

export function BackgroundAurora({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {BLOBS.map((blob, i) => (
        <motion.div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative blobs
          key={i}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          style={{
            background: `radial-gradient(circle at center, ${blob.color} 0%, transparent 70%)`,
          }}
          // Start at the first opacity keyframe so there is no 1 -> 0.7 tween on mount.
          initial={reduce ? undefined : { opacity: 0.45 }}
          animate={
            reduce
              ? undefined
              : { ...blob.drift, opacity: [0.45, 1, 0.7, 0.45] }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: blob.duration,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "loop",
                  ease: "easeInOut",
                }
          }
        />
      ))}
    </div>
  )
}
