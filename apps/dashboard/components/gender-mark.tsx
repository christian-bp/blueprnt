"use client"

import { ChartTooltipContent } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { CHART_TOOLTIP_TEXT } from "@/lib/chart-style"
import type { ComponentProps, CSSProperties } from "react"
import { useId } from "react"

// The two series every gender chart draws.
export type GenderSeries = "women" | "men"

// The one place the women/men encoding is defined. Every chart that splits
// people by gender draws both series in the SAME ink (--gender-woman and
// --gender-man both resolve to the brand) and separates them by FILL TEXTURE:
// women solid, men a diagonal hatch. Hue carries no meaning, so the split
// survives colorblind vision, greyscale and print, and the charts stay inside
// the brand instead of importing two foreign hues.
//
// Two marks cannot be told apart without being drawn differently, and solid
// reads as the primary mark, so the solid is deliberately the WOMEN series:
// the group whose pay disadvantage the product measures is not the one drawn
// as the marked case.
//
// Identity is never left to the fill alone. Every surface using these marks
// also names the series, in a legend, a stat row, or the tooltip.

// A 4x4 tile rotated -45deg holding a faint wash and a thin line, matching the
// hatch the workforce area chart already uses so the two read as one language.
export function GenderHatch({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      x="0"
      y="0"
      width="4"
      height="4"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(-45)"
    >
      <rect width="4" height="4" fill="var(--gender-man)" fillOpacity="0.16" />
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="4"
        stroke="var(--gender-man)"
        strokeWidth="1"
        strokeOpacity="0.6"
      />
    </pattern>
  )
}

// Paints for an area/bar/arc mark. `hatchId` is unique per chart instance, so
// render <GenderHatch id={hatchId} /> inside that chart's own <defs>: an SVG
// paint server referenced by a chart that has unmounted stops resolving.
export function useGenderMarks() {
  const hatchId = `gender-hatch-${useId().replace(/:/g, "")}`
  return {
    hatchId,
    women: "var(--gender-woman)",
    men: `url(#${hatchId})`,
  }
}

// Every gender mark carries a border in the same ink. A hatch is stripes with
// no edge of its own, so a hatched shape without one reads as a smudge that
// fades into the card rather than as a bounded area; the border is what gives
// it a silhouette. It doubles as the separator between stacked segments, so
// they no longer need a card-colored spacer to stop reading as one mass.
export const GENDER_MARK_BORDER = {
  stroke: "var(--gender-man)",
  strokeWidth: 1,
} as const

// A point mark encodes gender by SHAPE ALONE: a triangle is women, a circle
// is men, everywhere in the app. Both are solid, in the same ink.
//
// Shape rather than fill, because two overlapping marks that differ only in
// fill cannot be counted, and a dot plot's whole job is showing where
// individuals sit. A hatch cannot do it at all here: the pattern tile is
// wider than the mark, which is why area marks (bars, bands) keep the hatch
// and point marks do not.
//
// Once the shape carries the meaning, outlining one series is redundant and
// costs twice: a hollow mark reads fainter than the solid one beside it, so
// the two series stop looking like one dataset, and the hollow one was the
// harder hover target. Solid-vs-outlined also made the men's series the
// "unmarked" case, which the encoding deliberately avoids.
//
// The two shapes carry equal visual weight: recharts draws symbols through
// d3-shape, where `size` is AREA in square pixels, so a triangle and a
// circle at the same size cover the same amount of ink.
//
// Each mark carries a hairline stroke in the CARD's colour, not the ink.
// Solid marks in one colour merge into a single blob where they overlap,
// and a dot plot of 22 salaries overlaps constantly; a background-coloured
// edge separates neighbours without adding a second visual channel. This is
// the point family's counterpart to GENDER_MARK_BORDER, which gives a
// hatched AREA the silhouette it otherwise lacks.
export const GENDER_DOT = {
  women: {
    shape: "triangle",
    fill: "var(--gender-woman)",
    stroke: "var(--card)",
    strokeWidth: 1,
  },
  men: {
    shape: "circle",
    fill: "var(--gender-man)",
    stroke: "var(--card)",
    strokeWidth: 1,
  },
} as const

// One point mark, drawn at (cx, cy) in SVG. Charts that let recharts place
// their symbols get the shape through GENDER_DOT's `shape`; a chart that
// renders its own dots (to add a selection ring, say) uses this, so the two
// paths cannot drift into drawing different shapes for the same series.
//
// `size` is the mark's AREA, matching d3-shape's own convention, so a
// triangle and a circle at one size cover the same ink.
export function GenderPointMark({
  cx,
  cy,
  series,
  size = 64,
}: {
  cx: number
  cy: number
  series: GenderSeries
  size?: number
}) {
  const stroke = { stroke: "var(--card)", strokeWidth: 1 }
  if (series === "men") {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={Math.sqrt(size / Math.PI)}
        fill="var(--gender-man)"
        {...stroke}
      />
    )
  }
  // Equilateral triangle of the same area: side = sqrt(4 * area / sqrt(3)),
  // centred on its centroid so it sits on the same baseline as the circle.
  const side = Math.sqrt((4 * size) / Math.sqrt(3))
  const height = (side * Math.sqrt(3)) / 2
  return (
    <path
      d={`M ${cx} ${cy - (height * 2) / 3} L ${cx + side / 2} ${cy + height / 3} L ${cx - side / 2} ${cy + height / 3} Z`}
      fill="var(--gender-woman)"
      {...stroke}
    />
  )
}

// A POINT mark's key: the same triangle/circle the scatter draws, so the
// legend and the hover show the object the chart shows. An area chart's key
// stays the hatched square (genderKeyStyle); using that one beside a scatter
// was the bug this replaces, where the legend showed a hatched square for a
// series drawn as a hollow ring.
//
// Sized and inset like GenderMenIcon so both keys occupy the same 12x12 box
// and neither series reads as the smaller one.
export function GenderDotIcon({ series }: { series: GenderSeries }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {series === "women" ? (
        // An equilateral triangle inscribed so its area matches the circle
        // below it, mirroring how d3-shape normalises symbol size to area.
        <path d="M6 1.2 L11.2 10.4 L0.8 10.4 Z" fill="var(--gender-woman)" />
      ) : (
        <circle cx="6" cy="6" r="4.6" fill="var(--gender-man)" />
      )}
    </svg>
  )
}

// The men series' key inside a chart TOOLTIP, drawn as a hatched chip so the
// hover never shows a solid swatch for a series the chart draws hatched. Goes
// in ChartConfig's `icon` slot, which ChartTooltipContent renders in place of
// its default color swatch.
//
// It fills its box edge to edge: ChartTooltipContent sizes an icon and its
// default swatch identically (both 10px), so anything inset here would render
// the men key visibly smaller than the women key sitting under it. The stripes
// still run heavier than the in-chart hatch, because at the hatch's own weight
// a 10px chip washes out next to the solid one it must contrast with.
//
// The stripes are hand-placed lines rather than a <pattern>: this renders many
// times per page, and a pattern (or a clip path) would need a document-unique
// id on every instance.
export function GenderMenIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect
        width="12"
        height="12"
        rx="2.4"
        fill="var(--gender-man)"
        fillOpacity="0.18"
      />
      {/* Drawn inset by half the stroke so the outline is not clipped by the
          viewBox edge, matching the border on the chart's own marks. */}
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="var(--gender-man)"
        strokeWidth="1"
      />
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
          stroke="var(--gender-man)"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  )
}

// The tooltip for a gender chart: ChartTooltipContent with its rows put in the
// same order as GenderLegend, women first.
//
// recharts orders tooltip rows by series name, which sorts "men" above
// "women" and leaves the hover contradicting the legend beside it. Its own
// `itemSorter` prop cannot fix that: only DefaultTooltipContent reads it, and
// this chart family renders custom content. recharts clones the content
// element with the live tooltip props, so reordering the payload on the way
// through is the seam that does not touch vendor code.
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
      className={cn(CHART_TOOLTIP_TEXT, className)}
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
// This replaces recharts' own ChartLegend on these charts rather than styling
// it. recharts renders a small horizontal strip inside the plot area, which
// reads as chart furniture; this list is the same anatomy as the whole-survey
// donut's stat rows, so every gender chart carries one legend, at one size, in
// one place. Women first throughout, matching the gap table's column order.
//
// The swatch is square, not round: an 8px circle cannot hold a legible stripe.
// Both series share the shape so neither reads as the odd one out.
export function GenderKeyRow({
  series,
  label,
  value,
  mark = "area",
}: {
  series: GenderSeries
  label: string
  value?: string
  // Which family of mark this legend belongs to. "area" is the hatched
  // square (bars, bands, arcs); "point" is the scatter's own triangle or
  // circle. A legend must show the object its chart shows.
  mark?: "area" | "point"
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {mark === "point" ? (
        <span className="size-2.5 shrink-0">
          <GenderDotIcon series={series} />
        </span>
      ) : (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={genderKeyStyle(series)}
        />
      )}
      <span className="text-muted-foreground">{label}</span>
      {value !== undefined && (
        <span className="ml-auto font-medium text-foreground tabular-nums">
          {value}
        </span>
      )}
    </div>
  )
}

export function GenderLegend({
  items,
  className,
  mark = "area",
}: {
  items: { series: GenderSeries; label: string; value?: string }[]
  className?: string
  mark?: "area" | "point"
}) {
  // gap-1.5 and text-sm mirror ChartTooltipContent's own list, so the row pitch
  // matches the hover's.
  return (
    <div className={cn("grid gap-1.5 text-sm", className)}>
      {items.map((item) => (
        <GenderKeyRow
          key={item.series}
          series={item.series}
          label={item.label}
          value={item.value}
          mark={mark}
        />
      ))}
    </div>
  )
}

// The same encoding for marks built out of HTML rather than SVG, where a
// `repeating-linear-gradient` stands in for the SVG pattern at the same 4px
// pitch and -45deg angle.
//
// Stripe weight is NOT one value. A 10px key needs heavier stripes than the
// charts use, or it washes out into a pale square next to the solid key beside
// it; a full-width bar at that same weight reads visibly denser than the
// hatched charts around it. So the two sizes are separate calls, and neither
// one is a scaled version of the other.
// A key: a legend chip, a tooltip swatch, anything around 8-10px.
export function genderKeyStyle(series: GenderSeries): CSSProperties {
  // Bordered to match the marks (GENDER_MARK_BORDER): a key that is a bare
  // hatch while the chart's shapes are outlined stops being the same object.
  // box-sizing is border-box, so the border sits inside the swatch's size.
  const border = "1px solid var(--gender-man)"
  if (series === "women") {
    return { backgroundColor: "var(--gender-woman)", border }
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(-45deg, var(--gender-man) 0 1.4px, transparent 1.4px 4px)",
    backgroundColor: "color-mix(in srgb, var(--gender-man) 18%, transparent)",
    border,
  }
}

// A large filled mark: a CSS bar the size of a chart's own bars. Matches
// GenderHatch's weight (a 1px line at 0.6 alpha over a 16% wash) so an HTML
// bar and an SVG bar on the same page carry the same texture.
export function genderFillStyle(series: GenderSeries): CSSProperties {
  // Bordered like every other mark (GENDER_MARK_BORDER). An HTML bar is still
  // a gender mark: without the outline the hatched one has no edge and reads
  // as a smudge next to the solid one. box-sizing is border-box, so the border
  // sits inside the bar rather than growing it.
  const border = "1px solid var(--gender-man)"
  if (series === "women") {
    return { backgroundColor: "var(--gender-woman)", border }
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--gender-man) 60%, transparent) 0 1px, transparent 1px 4px)",
    backgroundColor: "color-mix(in srgb, var(--gender-man) 16%, transparent)",
    border,
  }
}
