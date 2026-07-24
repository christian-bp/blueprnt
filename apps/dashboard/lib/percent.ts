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
