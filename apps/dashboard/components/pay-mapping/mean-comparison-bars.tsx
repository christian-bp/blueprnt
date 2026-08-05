"use client"

import { useTranslations } from "next-intl"
import { genderFillStyle } from "@/components/gender-mark"
import { useMoney } from "@/hooks/use-money"

// The label and amount columns are fixed so both tracks get identical
// geometry, and so the marker overlay below can be positioned off the same
// two widths. Kept as constants because three places have to agree on them.
const LABEL_W = "5rem" // w-20
const AMOUNT_W = "6rem" // w-24
const COL_GAP = "0.75rem" // gap-3

// One gender's row: the label, the track with its bar scaled to the larger
// mean's share, and the amount. The visual is aria-hidden decoration: the
// label + money value carry the meaning, so color is never the only signal.
function MeanBarRow({
  label,
  value,
  currency,
  widthPct,
  series,
}: {
  label: string
  value: number
  currency: string
  widthPct: number
  series: "women" | "men"
}) {
  const money = useMoney()
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-muted-foreground text-sm">
        {label}
      </span>
      <div
        aria-hidden
        className="h-3 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          data-testid="mean-bar"
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, ...genderFillStyle(series) }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-sm tabular-nums">
        {money(value, currency)}
      </span>
    </div>
  )
}

// Two horizontal bars comparing the women vs men mean, scaled relative to
// the larger of the two (the larger bar is 100% of the track width), with a
// dashed line through both tracks at the lower mean: the longer bar's tail
// past the line IS the gap. Zero-based scale on purpose: a padded domain
// would zoom into and exaggerate the difference, and this renders inside
// statutory documentation. Women renders first, matching the gap table's
// column order. Pure data-render: no loading state of its own, the caller
// only mounts it once the means are known.
//
// The marker is ONE element overlaying both rows, not one drawn per row: per
// row, the gap between them left a break in the middle of a line that has to
// read as continuous. It is an absolute overlay inset to exactly the track
// column rather than a grid cell, because an explicitly placed grid item
// makes the auto-placed row cells flow around it.
export function MeanComparisonBars({
  womenMean,
  menMean,
  currency,
}: {
  womenMean: number
  menMean: number
  currency: string
}) {
  const tColumns = useTranslations("dashboard.payMapping.gap.columns")
  const max = Math.max(womenMean, menMean)
  const widthPct = (value: number) => (max > 0 ? (value / max) * 100 : 0)
  const lo = Math.min(widthPct(womenMean), widthPct(menMean))
  const markerPct = max > 0 && lo < 100 ? lo : null

  return (
    <div className="relative space-y-2">
      <MeanBarRow
        label={tColumns("women")}
        value={womenMean}
        currency={currency}
        widthPct={widthPct(womenMean)}
        series="women"
      />
      <MeanBarRow
        label={tColumns("men")}
        value={menMean}
        currency={currency}
        widthPct={widthPct(menMean)}
        series="men"
      />
      {markerPct !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: `calc(${LABEL_W} + ${COL_GAP})`,
            right: `calc(${AMOUNT_W} + ${COL_GAP})`,
          }}
        >
          {/* A gradient rather than `border-dashed`: CSS gives no control over
              a border's dash rhythm, and the browser default is a heavy,
              coarse pattern that reads as a divider instead of a quiet
              reference line. 3px on, 4px off at 1px wide, in muted ink. */}
          <div
            data-testid="mean-marker"
            className="absolute -inset-y-1.5 w-px text-foreground/40"
            style={{
              left: `${markerPct}%`,
              backgroundImage:
                "repeating-linear-gradient(to bottom, currentColor 0 3px, transparent 3px 7px)",
            }}
          />
        </div>
      )}
    </div>
  )
}
