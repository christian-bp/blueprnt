"use client"

import { useWidgetExpanded } from "@/components/widget-card"

// The shapes a point chart draws, and the one place their geometry lives.
// Which ENCODING a shape carries is the chart's business; what belongs here
// is that all three at one size cover the same ink, so no two surfaces can
// drift into differently weighted marks for the same size.
export type PointShape = "circle" | "triangle" | "square"

// A point mark's AREA, in square pixels, matching d3-shape's own convention
// (recharts draws its symbols through it), so every shape at this size
// carries the same weight of ink.
//
// Sized for a plot that overlaps: bigger marks read more easily on their own
// and hide their neighbours in a cluster, and these charts exist to show
// where INDIVIDUALS sit. Pointing at one is solved by the hit area rather
// than by ink.
export const POINT_MARK_SIZE = 90

// The same mark inside an expanded widget dialog. Kept in proportion to the
// canvas rather than to the card: a dot sized for a 256px plot is a speck on
// a 544px one, and the plot stops reading as the same chart made bigger.
export const EXPANDED_POINT_MARK_SIZE = 150

// One mark, drawn at (cx, cy) in SVG, at equal area across the three shapes.
// The thin ring is the card's own colour: it separates two marks that overlap
// without adding an ink of its own.
export function PointMark({
  cx,
  cy,
  shape,
  fill,
  size,
}: {
  cx: number
  cy: number
  shape: PointShape
  fill: string
  // Left unset, the mark takes the size its canvas calls for. A caller only
  // passes one to draw a mark OUTSIDE a plot (a test, a key at its own
  // scale).
  size?: number
}) {
  const expanded = useWidgetExpanded()
  const resolved =
    size ?? (expanded ? EXPANDED_POINT_MARK_SIZE : POINT_MARK_SIZE)
  const stroke = { stroke: "var(--card)", strokeWidth: 1 }
  if (shape === "circle") {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={Math.sqrt(resolved / Math.PI)}
        fill={fill}
        {...stroke}
      />
    )
  }
  if (shape === "square") {
    const side = Math.sqrt(resolved)
    return (
      <rect
        x={cx - side / 2}
        y={cy - side / 2}
        width={side}
        height={side}
        fill={fill}
        {...stroke}
      />
    )
  }
  // Equilateral triangle of the same area: side = sqrt(4 * area / sqrt(3)),
  // centred on its centroid so it sits on the same baseline as the others.
  const side = Math.sqrt((4 * resolved) / Math.sqrt(3))
  const height = (side * Math.sqrt(3)) / 2
  return (
    <path
      d={`M ${cx} ${cy - (height * 2) / 3} L ${cx + side / 2} ${cy + height / 3} L ${cx - side / 2} ${cy + height / 3} Z`}
      fill={fill}
      {...stroke}
    />
  )
}

// The same shape at key size: a 12x12 box for a legend chip or a tooltip
// swatch. The three are balanced BY EYE inside the box rather than by exact
// area, because a triangle of the circle's area does not fit a 12px square at
// all; what matters at this size is that no shape reads as the odd small one.
export function PointShapeIcon({
  shape,
  fill,
}: {
  shape: PointShape
  fill: string
}) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {shape === "circle" && <circle cx="6" cy="6" r="4.6" fill={fill} />}
      {shape === "square" && (
        <rect x="2" y="2" width="8" height="8" fill={fill} />
      )}
      {shape === "triangle" && (
        <path d="M6 1.2 L11.2 10.4 L0.8 10.4 Z" fill={fill} />
      )}
    </svg>
  )
}
