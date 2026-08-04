"use client"

import { motion, useReducedMotion } from "motion/react"

// Shared success badge for one-off completion screens (2FA setup, change
// email, import done): a filled circle springs in, and the moment it lands a
// soft ring pulses out from behind it and throws a burst of confetti with it,
// while the tick DRAWS itself across the circle (stroke pathLength) through
// the confetti's flight.
// Static under reduced motion (appears fully drawn, no pulse, no burst).
// Decorative (aria-hidden); the heading beside it carries the meaning.
// Brand-colored: this is a one-off celebratory confirmation, not a judgement
// value, so the brand accent is appropriate here.

// One hue, five steps. Confetti reaches for multiple hues by convention, but
// the only hue this app gives meaning to is the brand rose, so the pieces vary
// in lightness and chroma instead of wandering off the palette. Literal oklch
// rather than the --brand token because there are five of them and the token
// holds one; --brand is identical in light and dark, so these need no theme
// branch either.
// The lightest step stops at 0.82: pale rose on the white completion screens
// is already close to invisible, and going lighter drops those pieces out of
// the burst in light mode while leaving them fine in dark.
const CONFETTI_COLORS = [
  "oklch(0.6289 0.2079 15.74)",
  "oklch(0.71 0.175 14)",
  "oklch(0.76 0.145 16.5)",
  "oklch(0.55 0.195 12)",
  "oklch(0.82 0.105 18)",
]

const PIECES_PER_COLOR = 9
// The moment the badge lands: the spring below (stiffness 360, damping 18)
// first reaches full size at ~0.12s and peaks its overshoot just after. The
// ripple and the burst both hang off this one constant so they can never drift
// apart, because they are one event: the badge hits, and the shockwave throws
// the confetti with it. Firing them separately read as two celebrations, and a
// ripple at t=0 expanded out of a badge that was still scaled to nothing.
const IMPACT_DELAY = 0.12
const RIPPLE_DURATION = 0.9
// Outlives the ripple on purpose. The shockwave dissipates; the debris it threw
// keeps going.
const BURST_DURATION = 1.7
// Fast out, long tail: the pieces scatter immediately and thin out, instead of
// drifting to a visible stop.
const BURST_EASE = [0.22, 0.61, 0.36, 1] as const

type ConfettiPiece = {
  id: string
  color: string
  size: number
  x: number
  y: number
  rotate: number
  delay: number
  round: boolean
}

// Deterministic on purpose: the pieces are generated once at module load so the
// server and the client render the same burst. Math.random() during render
// would hydrate mismatched, and deferring to an effect would cost the animation
// a frame at exactly the moment it starts.
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Built per color so every step of the palette gets an equal share; only the
// geometry is random, which is what keeps the burst from clumping into one
// tint. Exported so the test can assert that distribution: happy-dom drops
// oklch() from the style attribute, so the colors never reach the test DOM.
export const CONFETTI: ConfettiPiece[] = (() => {
  const random = seededRandom(0x5eed)
  const total = CONFETTI_COLORS.length * PIECES_PER_COLOR
  return CONFETTI_COLORS.flatMap((color, colorIndex) =>
    Array.from({ length: PIECES_PER_COLOR }, (_, index): ConfettiPiece => {
      // Each piece owns one wedge of the circle and is jittered inside it,
      // rather than drawing a free angle: 45 free draws clump badly, and a
      // burst that leaves one side of the badge bare reads as a mistake. The
      // wedges are interleaved across colors (every fifth wedge per color) so
      // an even spread does not turn into five colored quadrants.
      const wedge = index * CONFETTI_COLORS.length + colorIndex
      const angle = ((wedge + random()) / total) * Math.PI * 2
      const distance = 70 + random() * 80
      return {
        id: `${colorIndex}-${index}`,
        color,
        size: 4 + random() * 5,
        x: Math.cos(angle) * distance,
        // Stretched vertically so the burst reads as thrown, rather than as an
        // even ring sitting around the badge.
        y: Math.sin(angle) * distance * 1.25,
        rotate: (random() - 0.5) * 480,
        delay: random() * 0.12,
        round: random() < 0.45,
      }
    })
  )
})()

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
          <span
            data-testid="success-confetti"
            className="pointer-events-none absolute inset-0"
          >
            {CONFETTI.map((piece) => (
              <motion.span
                key={piece.id}
                className="absolute top-1/2 left-1/2"
                style={{
                  // Rectangles are the same height but narrower, so the two
                  // shapes read as one set of pieces seen at different angles.
                  width: piece.round ? piece.size : piece.size * 0.55,
                  height: piece.size,
                  marginLeft: piece.round
                    ? -piece.size / 2
                    : -piece.size * 0.28,
                  marginTop: -piece.size / 2,
                  borderRadius: piece.round ? "50%" : 1,
                  background: piece.color,
                }}
                // Opacity is a keyframe array so the piece stays invisible
                // through its stagger delay and then snaps in at launch: a
                // plain target would hold it at full opacity, parked at the
                // center, until its turn came.
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [1, 0],
                  x: piece.x,
                  y: piece.y,
                  rotate: piece.rotate,
                  scale: 0.65,
                }}
                transition={{
                  duration: BURST_DURATION,
                  delay: IMPACT_DELAY + piece.delay,
                  ease: BURST_EASE,
                }}
              />
            ))}
          </span>
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
