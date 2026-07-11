import { describe, expect, it } from "vitest"
import { formatMoney } from "./currency"

describe("formatMoney", () => {
  it("renders SEK as kronor for the Swedish locale, never the code", () => {
    const out = formatMoney(50000, "SEK", "sv")
    expect(out).toContain("kr")
    expect(out).not.toContain("SEK")
  })

  it("renders USD and EUR with their symbols for English (not kr)", () => {
    expect(formatMoney(50000, "USD", "en")).toBe("$50,000")
    expect(formatMoney(50000, "EUR", "en")).toBe("€50,000")
  })

  it("shows whole units only (comp figures carry no minor units)", () => {
    expect(formatMoney(1234, "USD", "en")).toBe("$1,234")
  })

  it("adds an explicit sign for deltas when signed, and none for zero", () => {
    expect(formatMoney(8000, "USD", "en", { signed: true })).toBe("+$8,000")
    expect(formatMoney(-8000, "USD", "en", { signed: true })).toBe("-$8,000")
    expect(formatMoney(0, "USD", "en", { signed: true })).toBe("$0")
  })

  it("falls back to the raw pair for an invalid currency code", () => {
    // Imported currency codes are not schema-constrained, so this must not throw.
    expect(formatMoney(500, "NOTACODE", "en")).toBe("500 NOTACODE")
  })
})
