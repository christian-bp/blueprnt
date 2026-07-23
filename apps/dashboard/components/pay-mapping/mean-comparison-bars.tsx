"use client"

import { useTranslations } from "next-intl"
import { useMoney } from "@/hooks/use-money"

// One gender's row: fixed-width label and amount columns so the two tracks
// in between get identical geometry (the gap markers below must align
// vertically across the rows to read as one line), the bar scaled to its
// share of the larger mean, and a dashed marker at the LOWER mean's
// position. On the shorter bar the marker sits at its end; on the longer it
// cuts through, pointing out the tail beyond it as the gap. The visual is
// aria-hidden decoration: the label + money value carry the meaning, so
// color is never the only signal.
function MeanBarRow({
  label,
  value,
  currency,
  widthPct,
  markerPct,
  colorVar,
}: {
  label: string
  value: number
  currency: string
  widthPct: number
  markerPct: number | null
  colorVar: string
}) {
  const money = useMoney()
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-muted-foreground text-sm">
        {label}
      </span>
      <div aria-hidden className="relative flex-1">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            data-testid="mean-bar"
            className="h-full rounded-full"
            style={{ width: `${widthPct}%`, backgroundColor: colorVar }}
          />
        </div>
        {markerPct !== null && (
          <div
            data-testid="mean-marker"
            className="absolute -inset-y-1 border-foreground/50 border-l-2 border-dashed"
            style={{ left: `${markerPct}%` }}
          />
        )}
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
    <div className="space-y-2">
      <MeanBarRow
        label={tColumns("women")}
        value={womenMean}
        currency={currency}
        widthPct={widthPct(womenMean)}
        markerPct={markerPct}
        colorVar="var(--gender-woman)"
      />
      <MeanBarRow
        label={tColumns("men")}
        value={menMean}
        currency={currency}
        widthPct={widthPct(menMean)}
        markerPct={markerPct}
        colorVar="var(--gender-man)"
      />
    </div>
  )
}
