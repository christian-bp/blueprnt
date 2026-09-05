"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useId } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  TOOLTIP_APPEAR,
} from "@/lib/chart-style"

// A figure's own history, at the size of a word. It says SHAPE, not value:
// there are no axes, no labels and no hover, because at this size none of
// them can be read; the tile's figure carries the number and the trend
// widget below carries the readable version.
//
// Two forms, both drawn from the same readings, so a surface picks the one
// its tile needs rather than each surface inventing a strip of its own:
//
//   "bars"  a row of rounded bars, plain elements on the same pixel grid as
//           the type beside them. Compact enough to sit on one line with a
//           figure.
//   "area"  a filled curve, the shape a reader recognises as a trend. Light
//           fill under a visible stroke, which is what makes it read as a
//           curve rather than as a block (see the chart rules in CLAUDE.md).
//
// One ink, at one weight, on every strip in the app: the strip is a shape,
// and lifting the last reading made a two-reading strip read as two different
// things rather than as one series. It is also the only place a widget is
// coloured at all, the mark and the type stay neutral.
//
// Drawn from the SERIES' OWN minimum rather than from zero. A gap that moved
// from 14.2 to 13.7 is a flat line against a zero baseline, which is a true
// picture of the magnitude and a useless one of the movement; the trend
// widgets' own domain reasons the same way (lib/trend-domain.ts).
//
// That holds for a PAIR too, which was once drawn from zero instead. It is
// true that every pair then slopes the same way whatever the amount, but a
// pair drawn from zero is a flat line one pixel off horizontal, which reads
// as a broken chart rather than as a small movement. The slope is a shape,
// not a magnitude claim; the amount is on the tile's own line, in words.
//
// Not a ChartCanvas: that owns the height and type scale of a widget's OWN
// chart, which grows when the card is expanded. This strip is a decoration
// beside a figure on a tile that does not expand, and it carries no type at
// all.
// The one ink every strip is drawn in. A strip carries no category (the
// tile's title does), so it takes no per-surface colour: see --spark.
const INK = "var(--spark)"

export function Sparkline({
  values,
  variant = "bars",
  label,
  formatValue,
  className,
  bars = 8,
}: {
  // Oldest first. One reading draws nothing: a single point is a figure with
  // no history, which the tile already prints in full size beside it.
  values: number[]
  // Which form the strip takes: a row of bars, or a filled curve.
  variant?: "bars" | "area"
  // What the series is called, for the hover. Without one the hover shows the
  // reading alone, which on a tile is still unambiguous: the figure it
  // belongs to is the only one on the card.
  label?: string
  // How to print one reading in the hover. The strip holds bare numbers (a
  // percent, a headcount, seconds), and only the caller knows which.
  formatValue?: (value: number) => string
  className?: string
  // How many readings to show. A longer history keeps its most recent ones.
  bars?: number
}) {
  const gradientId = useId()
  const shown = values.slice(-bars)
  if (shown.length < 2) return null

  const max = Math.max(...shown)
  const min = Math.min(...shown)
  const span = max - min

  if (variant === "area") {
    return (
      // aria-hidden even though it answers the pointer: every reading it
      // holds is a number the surface states in text, and a screen reader
      // cannot hover a curve to find them.
      <div
        aria-hidden="true"
        className={cn("relative h-16 w-full max-w-40", className)}
      >
        <ResponsiveContainer width="100%" height="100%">
          {/* The margin is what keeps the stroke inside the box: a curve
              touching the top of its own SVG is clipped along its widest
              point. */}
          <AreaChart
            data={shown.map((value, index) => ({ index, value }))}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INK} stopOpacity={0.3} />
                <stop offset="100%" stopColor={INK} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {/* The series' own range with room around it, so the curve sits
                IN the box rather than along its edges: pinned to the top, the
                highest reading reads as a ceiling the figure hit, and half of
                its own stroke falls outside the plot. More headroom than
                floor, because the fill below the curve carries the eye down
                and an empty band above it does not.

                A flat series has no range at all, so it takes a nominal one
                and draws as a line across the middle instead of as nothing. */}
            <YAxis
              hide
              type="number"
              domain={[min - (span || 1) * 0.25, max + (span || 1) * 0.35]}
            />
            {/* The hover: a dashed rule down the reading under the pointer,
                a dot on the curve where it crosses, and the value in a small
                panel. The strip has no axis and no labels, so this is the
                only way to read one point of it; the dot's ring is the card's
                own background, which is what keeps it legible where the
                curve passes under it. */}
            <XAxis hide dataKey="index" />
            <Tooltip
              {...CHART_TOOLTIP_MOTION}
              cursor={{
                stroke: INK,
                strokeWidth: 1,
                strokeDasharray: "3 3",
                strokeOpacity: 0.6,
              }}
              content={({ active, payload }) => {
                const reading = payload?.[0]?.value
                if (active !== true || typeof reading !== "number") return null
                return (
                  // Tight rather than small: the padding and the leading come
                  // in, the type does not. A chart hover holds the app's
                  // reading size wherever it appears (CHART_TOOLTIP_TEXT), and
                  // one that drops to the vendor default reads visibly
                  // smaller than the card it sits on.
                  <div
                    className={cn(
                      "rounded-lg border bg-popover px-2 py-1 text-popover-foreground shadow-md",
                      CHART_TOOLTIP_TEXT,
                      TOOLTIP_APPEAR
                    )}
                  >
                    {label !== undefined && (
                      <div className="text-muted-foreground leading-tight">
                        {label}
                      </div>
                    )}
                    <div className="font-semibold tabular-nums leading-tight">
                      {formatValue?.(reading) ?? reading}
                    </div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={INK}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: INK,
                stroke: "var(--color-card)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn("flex h-10 items-end gap-0.5", className)}
    >
      {shown.map((value, index) => {
        // A floor of a third of the strip: a bar one pixel tall reads as a
        // hole in the data rather than as the low end of a range. A flat
        // series sits mid-strip, so it reads as "no movement" instead of as
        // a missing chart.
        const ratio = span === 0 ? 0.5 : (value - min) / span
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length series, order is the data
            key={index}
            className="w-1 rounded-full opacity-30"
            style={{
              backgroundColor: INK,
              height: `${(0.35 + ratio * 0.65) * 100}%`,
            }}
          />
        )
      })}
    </div>
  )
}
