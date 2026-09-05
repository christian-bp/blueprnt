"use client"

import { ChartTooltipContent } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { useId } from "react"
import { CHART_TOOLTIP_TEXT, TOOLTIP_APPEAR } from "@/lib/chart-style"
import { ChartKeyRow, ChartLegend } from "./chart-legend"
import { PointMark, PointShapeIcon } from "./point-mark"
import type { ComponentProps, CSSProperties, ReactNode } from "react"

// The two series every gender chart draws.
export type GenderSeries = "women" | "men"

// The one place the women/men encoding is defined. Two channels, but not the
// same two on every family.
//
// AREA marks (bars, arcs, bands) are told apart by HUE alone: violet for
// women, sky for men, each drawn as a pale wash of its ink under a 1px
// contour in the ink itself. The men's diagonal hatch used to be the second
// channel here and is off by decision, so these marks no longer survive
// greyscale or print on their own. That is only safe because every surface
// drawing them names its series in a legend, a stat row or the tooltip, and
// each of them does.
//
// POINT marks keep two channels: shape as well as hue (women a triangle, men
// a square), because two overlapping dots differing only in colour cannot be
// counted, and a plot of individuals is exactly where that matters.
//
// The ink and the wash are separate tokens on purpose. A saturated fill is
// heavy once it covers a bar or an arc, so large areas take the wash; a wash
// at 8px is a smudge, so point marks and every stroke take the ink.
//
// Identity is never left to fill or hue alone. Every surface using these
// marks also names the series, in a legend, a stat row, or the tooltip.

// A 4x4 tile rotated -45deg: the series' own wash with a thin line of its INK
// across it, the same ink the contour is drawn in. It is what carries the two
// series apart where hue cannot go, in greyscale, in print, and for a reader
// who cannot separate violet from sky.
//
// The women's series wears it. The men's did once, on the reasoning that the
// group whose disadvantage the product measures should not be the marked
// case; that is an owner decision and it is now the other way round.
export function GenderHatch({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      x="0"
      y="0"
      width="4"
      height="4"
      patternUnits="userSpaceOnUse"
      // +45, not -45: a vertical line rotated the other way runs "\\" while
      // the CSS bars (repeating-linear-gradient at -45deg) and the key chip's
      // hand-placed lines both run "/". One direction everywhere, or the same
      // series reads as two different textures on one page.
      patternTransform="rotate(45)"
    >
      <rect width="4" height="4" fill="var(--gender-woman-fill)" />
      {/* Held under full strength: at full ink the stripes read as the mark's
          colour rather than as a texture on it, and the contour stops being
          the darkest line in the shape. */}
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="4"
        stroke="var(--gender-woman)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
    </pattern>
  )
}

// Paints for an area/bar/arc mark: the women's hatch, the men's flat wash.
// `hatchId` is unique per chart instance, so render <GenderHatch id={hatchId} />
// inside that chart's own <defs>: an SVG paint server referenced by a chart
// that has unmounted stops resolving.
//
// The men's series was hatched here, so the pair survived greyscale and print
// on texture alone. That texture is off by decision: the two hues are far
// enough apart to read at a glance and under the two common dichromacies
// (violet to denim, ΔE 54.8 normal and 18.3 worst-case), and the marks now
// differ only in colour. What that costs is the third channel: printed in
// black and white the two fills are one grey (ΔE 4.3, contrast 1.16), so a
// surface using them keeps naming its series in a legend, a stat row or the
// tooltip, which every one of them already does.
//
// A hook rather than a constant so the call sites do not change shape if the
// paints ever need per-chart state again (they did, for the hatch's id).
export function useGenderMarks() {
  const hatchId = `gender-hatch-${useId().replace(/:/g, "")}`
  return {
    hatchId,
    women: `url(#${hatchId})`,
    men: "var(--gender-man-fill)",
  }
}

// Every gender mark carries a border in a DARKER step of ITS OWN ink. The
// border is what gives a filled shape a silhouette against the card, and it
// doubles as the separator between stacked segments, so they no longer need a
// card-colored spacer to stop reading as one mass. A fill outlined in its own
// colour has no visible edge at all, which is why each series has an -edge
// token rather than reusing the fill.
//
// Per series, not one constant. While both series shared the brand ink this
// was a single value and every call site spread the same object onto both
// bars. With two hues that would outline the women's bar in the men's blue,
// which is worse than no border at all: it states the wrong series.
export function genderMarkBorder(series: GenderSeries) {
  return {
    stroke: series === "women" ? "var(--gender-woman)" : "var(--gender-man)",
    // A notch heavier than a hairline: at 1px the contour reads as an
    // artifact of the fill rather than as a drawn edge, and it is what the
    // pale wash leans on for its boundary against the card.
    strokeWidth: 1.5,
  } as const
}

// A point mark encodes gender by SHAPE as well as hue: a triangle is women,
// a square is men, everywhere in the app.
//
// Neither of them is a CIRCLE, and that is deliberate. The circle is the
// app's ungendered point: a plot that encodes something else on the same
// marks (the equivalent-work scatter's role mode) draws circles, and if one
// gender owned that shape, its points would keep reading as that gender on a
// chart where gender is not encoded at all.
//
// The shape is not decoration on top of the colour. Two overlapping marks
// that differ only in fill cannot be counted, and a dot plot's whole job is
// showing where individuals sit, so the shape is what makes a cluster
// readable even for someone who sees both hues perfectly. A texture cannot do
// it here at all: the pattern tile is wider than the mark, which is why area
// marks (bars, bands) carry no shape of their own to vary.
//
// Both marks stay solid. A hollow one reads fainter than the solid beside it,
// so the two series stop looking like one dataset, and it was the harder
// hover target. Solid-vs-outlined also made one series the "unmarked" case,
// which the encoding deliberately avoids.
//
// The two shapes carry equal visual weight: recharts draws symbols through
// d3-shape, where `size` is AREA in square pixels, so a triangle and a
// square at the same size cover the same amount of ink.
//
// Every scatter in the app draws at ONE size (POINT_MARK_SIZE); two of them
// had already drifted to 64 and 78, which is a difference you cannot see side
// by side but which makes the same person a different size on two surfaces.

// Radius of each mark's invisible pointer target: 24px across, the minimum
// WCAG 2.2 asks of a pointer target, against the ~11px the visible mark
// covers.
const GENDER_POINT_HIT_RADIUS = 12

// A point's pointer target: invisible, and much larger than the mark it
// stands for. SVG hit-testing follows the PAINT, so a 10px mark is a 10px
// target, and landing on one takes aim.
//
// It is a SEPARATE element from the mark on purpose, and every chart drawing
// these has to paint the whole hit LAYER before any mark (see the scatter's
// series order). Drawn together with its own mark, a target 24px wide covers
// the neighbours in a cluster: two people a few pixels apart, and whichever
// is drawn second buries the first under its target, so the point behind
// becomes unhoverable. Under all the marks, a target can only ever claim
// EMPTY space, and every pixel of visible ink still answers for its own
// point.
//
// `transparent`, never `none`: they look identical and only the former is
// painted, so `none` would leave this catching nothing at all.
export function GenderPointHitArea({ cx, cy }: { cx: number; cy: number }) {
  return (
    <circle cx={cx} cy={cy} r={GENDER_POINT_HIT_RADIUS} fill="transparent" />
  )
}

// One point mark, drawn at (cx, cy) in SVG. Every gender scatter draws
// through this, whether recharts places the symbol or the chart places its
// own (to add a selection ring, say), so no two of them can drift into
// different shapes or sizes for the same series.
export function GenderPointMark({
  cx,
  cy,
  series,
  size,
}: {
  cx: number
  cy: number
  series: GenderSeries
  // Left unset, PointMark takes the size its canvas calls for.
  size?: number
}) {
  return (
    <PointMark
      cx={cx}
      cy={cy}
      shape={series === "men" ? "square" : "triangle"}
      fill={series === "men" ? "var(--gender-man)" : "var(--gender-woman)"}
      {...(size === undefined ? {} : { size })}
    />
  )
}

// A POINT mark's key: the same triangle/square the scatter draws, so the
// legend and the hover show the object the chart shows. An area chart's key
// stays the filled square (genderKeyStyle); using that one beside a scatter
// was the bug this replaces, where the legend showed a square chip for a
// series drawn as a hollow ring.
//
// Sized and inset like GenderMenIcon so both keys occupy the same 12x12 box
// and neither series reads as the smaller one.
export function GenderDotIcon({ series }: { series: GenderSeries }) {
  return (
    <PointShapeIcon
      shape={series === "women" ? "triangle" : "square"}
      fill={series === "women" ? "var(--gender-woman)" : "var(--gender-man)"}
    />
  )
}

// The women series' key: the same wash under the same stripes the chart's
// own marks carry, so a legend or a hover never shows a flat swatch for a
// series the chart draws textured.
//
// Hand-placed lines rather than a <pattern>: this renders many times per
// page, and a pattern (or a clip path) would need a document-unique id on
// every instance. The stripes run heavier than the in-chart hatch, because at
// the chart's own weight a 10px chip washes out beside the flat one it has to
// contrast with.
export function GenderWomenIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect width="12" height="12" rx="2.4" fill="var(--gender-woman-fill)" />
      {[
        [0, 4, 4, 0],
        [0, 8, 8, 0],
        [0, 12, 12, 0],
        [4, 12, 12, 4],
        [8, 12, 12, 8],
      ].map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--gender-woman)"
          strokeWidth="1.4"
          strokeOpacity="0.55"
        />
      ))}
      <rect
        x="0.75"
        y="0.75"
        width="10.5"
        height="10.5"
        rx="1.9"
        fill="none"
        stroke="var(--gender-woman)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

// The men series' key inside a chart TOOLTIP. Goes in ChartConfig's `icon`
// slot, which ChartTooltipContent renders in place of its default colour
// swatch, so the hover shows the same chip the chart's own marks are built
// from: the ink with its darker edge.
//
// It fills its box edge to edge: ChartTooltipContent sizes an icon and its
// default swatch identically (both 10px), so anything inset here would render
// the men key visibly smaller than the women key sitting under it.
export function GenderMenIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect width="12" height="12" rx="2.4" fill="var(--gender-man-fill)" />
      {/* Drawn inset by half the stroke so the outline is not clipped by the
          viewBox edge, matching the border on the chart's own marks. */}
      <rect
        x="0.75"
        y="0.75"
        width="10.5"
        height="10.5"
        rx="1.9"
        fill="none"
        stroke="var(--gender-man)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function orderGenderPayload<T extends { dataKey?: unknown }>(
  payload: readonly T[]
): T[] {
  // recharts types dataKey as string | number | accessor; only the string form
  // names a series here.
  const rank = (item: T) =>
    item.dataKey === "women" || item.dataKey === "woman" ? 0 : 1
  return [...payload].sort((a, b) => rank(a) - rank(b))
}

export function GenderTooltipContent({
  className,
  labels,
  ...props
}: ComponentProps<typeof ChartTooltipContent> & {
  labels: Record<GenderSeries, string>
}) {
  const payload = props.payload
    ? orderGenderPayload(props.payload)
    : props.payload
  return (
    <ChartTooltipContent
      {...props}
      payload={payload}
      className={cn(CHART_TOOLTIP_TEXT, TOOLTIP_APPEAR, className)}
      // The `formatter` slot replaces ChartTooltipContent's whole row, which is
      // the only way to get the hover and the legend byte-identical: matching
      // the vendor row's own classes from outside is impossible, because it
      // carries `leading-none` on an inner element no override reaches, giving
      // it a tighter line box than the legend beside it.
      formatter={(value, name) => (
        <GenderKeyRow
          series={name === "women" || name === "woman" ? "women" : "men"}
          label={labels[name === "women" || name === "woman" ? "women" : "men"]}
          value={typeof value === "number" ? value.toLocaleString() : undefined}
        />
      )}
    />
  )
}

// The key for every gender chart: one row per series, a swatch matching the
// mark the chart draws, a muted label, and an optional right-aligned value.
//
// The row itself comes from ChartKeyRow, which every chart key in the app
// shares, so a gender key and a role key can never drift into different
// pitches. What lives here is only which MARK a gender series wears.
//
// The area swatch is square, not round: an 8px circle cannot hold a legible
// stripe. Both series share the shape so neither reads as the odd one out.
export function GenderKeyRow({
  series,
  label,
  value,
  mark = "area",
}: {
  series: GenderSeries
  label: string
  value?: string
  // Which family of mark this legend belongs to. "area" is the filled
  // square (bars, bands, arcs); "point" is the scatter's own triangle or
  // square. A legend must show the object its chart shows.
  mark?: "area" | "point"
}) {
  return (
    <ChartKeyRow
      layout="column"
      item={{
        id: series,
        label,
        ...(value === undefined ? {} : { value }),
        mark: genderKeyMark(series, mark),
      }}
    />
  )
}

// The swatch a gender series wears, by mark family.
function genderKeyMark(
  series: GenderSeries,
  mark: "area" | "point"
): ReactNode {
  if (mark === "point") return <GenderDotIcon series={series} />
  return (
    <span
      aria-hidden
      className="block size-2.5 rounded-[2px]"
      style={genderKeyStyle(series)}
    />
  )
}

export function GenderLegend({
  items,
  className,
  mark = "area",
  layout = "column",
}: {
  items: {
    series: GenderSeries
    label: string
    value?: string
    hidden?: boolean
    onToggle?: () => void
    toggleDisabled?: boolean
  }[]
  className?: string
  mark?: "area" | "point"
  // "row" centres the key under its plot; see ChartLegend.
  layout?: "column" | "row"
}) {
  return (
    <ChartLegend
      layout={layout}
      {...(className === undefined ? {} : { className })}
      items={items.map((item) => ({
        id: item.series,
        label: item.label,
        ...(item.value === undefined ? {} : { value: item.value }),
        ...(item.hidden === undefined ? {} : { hidden: item.hidden }),
        ...(item.onToggle === undefined ? {} : { onToggle: item.onToggle }),
        ...(item.toggleDisabled === undefined
          ? {}
          : { toggleDisabled: item.toggleDisabled }),
        mark: genderKeyMark(item.series, mark),
      }))}
    />
  )
}

// The same encoding for marks built out of HTML rather than SVG: the ink with
// its own darker edge, so a CSS bar and an SVG bar on the same page are the
// same object.
//
// Two calls rather than one, kept because a key and a full-width bar have
// differed before (the men's hatch needed heavier stripes at key size than it
// did at bar size) and may again.
// A key: a legend chip, a tooltip swatch, anything around 8-10px.
export function genderKeyStyle(series: GenderSeries): CSSProperties {
  // Bordered to match the marks (genderMarkBorder), in the series' OWN ink:
  // an unbordered key beside outlined shapes stops being the same object.
  // box-sizing is border-box, so the border sits inside the swatch's size.
  if (series === "women") {
    return {
      backgroundImage:
        "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--gender-woman) 55%, transparent) 0 1.4px, transparent 1.4px 4px)",
      backgroundColor: "var(--gender-woman-fill)",
      border: "1.5px solid var(--gender-woman)",
    }
  }
  return {
    backgroundColor: "var(--gender-man-fill)",
    border: "1.5px solid var(--gender-man)",
  }
}

// A large filled mark: a CSS bar the size of a chart's own bars.
export function genderFillStyle(series: GenderSeries): CSSProperties {
  // Bordered like every other mark (genderMarkBorder), in the series' own
  // ink. An HTML bar is still a gender mark, and a fill with no edge reads as
  // a smudge against the card. box-sizing is border-box, so the border sits
  // inside the bar rather than growing it.
  if (series === "women") {
    return {
      backgroundImage:
        "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--gender-woman) 55%, transparent) 0 1px, transparent 1px 4px)",
      backgroundColor: "var(--gender-woman-fill)",
      border: "1.5px solid var(--gender-woman)",
    }
  }
  return {
    backgroundColor: "var(--gender-man-fill)",
    border: "1.5px solid var(--gender-man)",
  }
}
