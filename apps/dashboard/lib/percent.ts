import type { useFormatter } from "next-intl"

// Unsigned percent text, shared by every surface that shows a gap number:
// never a signed percent (the direction is carried by a word next to it,
// e.g. the pay-mapping overview's org-level finding sentence).
export function percentText(
  pct: number,
  format: ReturnType<typeof useFormatter>
): string {
  return format.number(Math.abs(pct) / 100, {
    style: "percent",
    maximumFractionDigits: 1,
  })
}

// The same figure with its sign kept: a pay-gap trend plots signed readings
// (a negative gap means women are ahead), so the unsigned form above would
// draw two opposite years identically. Locale-formatted like its sibling,
// because "4.1%" is "4,1 %" in every Nordic locale this app ships.
export function signedPercentText(
  pct: number,
  format: ReturnType<typeof useFormatter>
): string {
  return format.number(pct / 100, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })
}

// A movement BETWEEN two percentages, which is a step in percentage points
// and not a percentage of anything: a gap that went from 14.2% to 13.7% moved
// 0.5 points, and printing that as "0.5%" would say it shrank by a twentieth
// of itself.
//
// Unsigned, and without its unit: both belong to the sentence around it. The
// direction is a word there ("Down 0.5 pp since the last one"), which reads
// where a minus sign has to be decoded, and what a percentage point is called
// differs per locale ("pp", "%-enheter", "%-yksikköä").
export function pointAmount(
  delta: number,
  format: ReturnType<typeof useFormatter>
): string {
  return format.number(Math.abs(delta), { maximumFractionDigits: 1 })
}

// The figure as the reader sees it: percentText prints one decimal, so a
// comparison BETWEEN two of them has to be computed on the same rounding or
// the tile contradicts itself (14.2 minus 13.7 is 0.5 on screen whatever the
// raw readings were).
export function shownPercent(pct: number): number {
  return Math.round(pct * 10) / 10
}
