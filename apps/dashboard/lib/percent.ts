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
