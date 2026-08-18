import { describe, expect, it } from "vitest"

import { moneyAxisWidth } from "./chart-style"

// A money tick is the widest label a chart draws, and recharts CLIPS an
// overflowing one instead of widening the axis. Sizing the axis to a constant
// meant choosing which way to be wrong: wide enough for a seven-digit amount
// left a Swedish monthly salary sitting 33px inside the card, and narrow
// enough for that salary ate a character off the first six-figure one.
const sek = (value: number) =>
  `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`

describe("moneyAxisWidth", () => {
  it("clears the label it will draw, at the larger of the two type sizes", () => {
    // "63 000 kr" measures 44.7px at 12px and ~52px at the expanded 14px, and
    // the axis needs its own gap on top of whichever it renders at.
    const width = moneyAxisWidth([63_000, 91_000], sek)
    expect(width).toBeGreaterThan(52 + 10)
    expect(width).toBeLessThan(90)
  })

  // The bug this exists to prevent: an axis sized to the salaries in front of
  // you, then a customer with a six-figure one.
  it("grows with the numbers, so a bigger amount is never clipped", () => {
    const small = moneyAxisWidth([40_000, 63_000], sek)
    const large = moneyAxisWidth([40_000, 1_240_000], sek)
    expect(large).toBeGreaterThan(small)
  })

  // The tick above the data can carry a digit the data never does.
  it("leaves headroom for a tick that rounds past the data", () => {
    expect(moneyAxisWidth([99_500], sek)).toBeGreaterThanOrEqual(
      moneyAxisWidth([100_000], sek) - 6
    )
  })

  it("keeps a floor, so an axis of small values still reads as an axis", () => {
    expect(moneyAxisWidth([0, 5], sek)).toBe(44)
  })

  // A chart whose data has not arrived must still lay out.
  it("falls back to the floor when there is nothing to measure", () => {
    expect(moneyAxisWidth([], sek)).toBe(44)
    expect(moneyAxisWidth([Number.NaN, Number.POSITIVE_INFINITY], sek)).toBe(44)
  })

  // Negative values are formatted with a sign, which is a character like any
  // other: the extreme that matters is whichever formats longer.
  it("measures both ends, not just the largest number", () => {
    expect(moneyAxisWidth([-1_240_000, 5_000], sek)).toBeGreaterThan(
      moneyAxisWidth([-5_000, 5_000], sek)
    )
  })
})
