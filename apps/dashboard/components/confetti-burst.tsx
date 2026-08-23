"use client"

import { motion, useReducedMotion } from "motion/react"

// The app's confetti: a burst of brand-tinted pieces thrown out from a point.
//
// Extracted from SuccessCheck so the completion badge and the dashboard's
// to-do row throw the same burst rather than two that drift apart. The badge
// owns the ripple and the tick; this owns only the debris.
//
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
// Fast out, long tail: the pieces scatter immediately and thin out, instead of
// drifting to a visible stop.
const BURST_EASE = [0.22, 0.61, 0.36, 1] as const

// How loud the burst is. A completion screen is the only thing on the page and
// has earned a full one; a burst that fires on arrival, over a dashboard the
// reader is trying to read, has not. "soft" thins the pieces, shrinks them,
// stops short of full opacity and clears sooner, rather than being the same
// burst scaled down: fewer, smaller, fainter pieces read as a shimmer, while
// forty-five smaller ones still read as a party.
//
// A recipe here rather than four numbers at the call site: the next tuning
// pass should move these together, and "slightly more subtle" is a property of
// the effect, not of whoever is using it.
const INTENSITY = {
  full: { keepEvery: 1, sizeScale: 1, peakOpacity: 1, duration: 1.7 },
  soft: { keepEvery: 2, sizeScale: 0.7, peakOpacity: 0.7, duration: 1.2 },
} as const

// The soft burst's play time, exported for surfaces that hold something on
// screen exactly until its celebration finishes (the sidebar's to-do rows),
// so a tuning pass here can never leave a hold shorter than its burst.
export const SOFT_BURST_DURATION_S = INTENSITY.soft.duration

type ConfettiPiece = {
  id: string
  color: string
  size: number
  x: number
  y: number
  // Where the piece starts in "edges" mode, as a percentage of the burst
  // box: the point where its own ray leaves that box. Stored normalized, so
  // one generated set lands on the border of a card of any size or aspect.
  edgeX: number
  edgeY: number
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

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
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
      // burst that leaves one side bare reads as a mistake. The wedges are
      // interleaved across colors (every fifth wedge per color) so an even
      // spread does not turn into five colored quadrants.
      const wedge = index * CONFETTI_COLORS.length + colorIndex
      const angle = ((wedge + random()) / total) * Math.PI * 2
      const distance = 70 + random() * 80
      // Where this piece's ray crosses the box's border, in normalized
      // coordinates. Scaling by the LARGER of |cos| and |sin| is what puts
      // the point on the rectangle rather than on its inscribed circle: the
      // dominant axis is driven to the edge and the other follows.
      const reach =
        1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)))
      return {
        id: `${colorIndex}-${index}`,
        color,
        size: 4 + random() * 5,
        // Clamped: the dominant axis is +/-1 in real arithmetic but lands a
        // rounding error outside it in floating point, and a percentage of
        // -7e-15 is a value no one should have to reason about later.
        edgeX: clampPercent(50 + 50 * Math.cos(angle) * reach),
        edgeY: clampPercent(50 + 50 * Math.sin(angle) * reach),
        x: Math.cos(angle) * distance,
        // Stretched vertically so the burst reads as thrown, rather than as an
        // even ring sitting around the origin.
        y: Math.sin(angle) * distance * 1.25,
        rotate: (random() - 0.5) * 480,
        delay: random() * 0.12,
        round: random() < 0.45,
      }
    })
  )
})()

// Throws the burst across its positioned parent, from that parent's center or
// from its perimeter. Renders nothing under reduced motion, and nothing at all
// when `active` is false, so a caller can mount it and decide later.
export function ConfettiBurst({
  active = true,
  delay = 0,
  // Scales the throw distance. The default suits a 72px badge on a page of
  // its own; a burst inside a dashboard row needs a fraction of that, or the
  // pieces fly past everything around them.
  spread = 1,
  // Where the pieces start. "center" is right for a badge, which IS the thing
  // celebrating and is small enough that its middle reads as one point.
  // "edges" starts each piece where its own ray leaves the box, so a card-
  // sized target throws from its whole perimeter instead of erupting through
  // its own label.
  origin = "center",
  intensity = "full",
}: {
  active?: boolean
  delay?: number
  spread?: number
  origin?: "center" | "edges"
  intensity?: keyof typeof INTENSITY
}) {
  const reduce = useReducedMotion()
  if (reduce || !active) return null

  const { keepEvery, sizeScale, peakOpacity, duration } = INTENSITY[intensity]
  // Thinned by index, not by slicing the front of the list: the pieces are
  // generated color-major with interleaved wedges, so taking every Nth keeps
  // both the palette and the spread even. Slicing would drop whole colors and
  // leave a bare arc.
  const pieces = CONFETTI.filter((_, index) => index % keepEvery === 0)

  return (
    <span
      aria-hidden="true"
      data-testid="success-confetti"
      className="pointer-events-none absolute inset-0"
    >
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute"
          style={{
            left: origin === "edges" ? `${piece.edgeX}%` : "50%",
            top: origin === "edges" ? `${piece.edgeY}%` : "50%",
            // Rectangles are the same height but narrower, so the two shapes
            // read as one set of pieces seen at different angles.
            width: piece.round
              ? piece.size * sizeScale
              : piece.size * sizeScale * 0.55,
            height: piece.size * sizeScale,
            marginLeft: piece.round
              ? (-piece.size * sizeScale) / 2
              : -piece.size * sizeScale * 0.28,
            marginTop: (-piece.size * sizeScale) / 2,
            borderRadius: piece.round ? "50%" : 1,
            background: piece.color,
          }}
          // Opacity is a keyframe array so the piece stays invisible through
          // its stagger delay and then snaps in at launch: a plain target
          // would hold it at full opacity, parked at the center, until its
          // turn came.
          initial={{ opacity: 0 }}
          animate={{
            opacity: [peakOpacity, 0],
            x: piece.x * spread,
            y: piece.y * spread,
            rotate: piece.rotate,
            scale: 0.65,
          }}
          transition={{
            duration,
            delay: delay + piece.delay,
            ease: BURST_EASE,
          }}
        />
      ))}
    </span>
  )
}
