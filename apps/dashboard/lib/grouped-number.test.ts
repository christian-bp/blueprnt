import { describe, expect, it } from "vitest"
import {
  caretIndexAfterDigits,
  digitsOnly,
  formatGroupedInteger,
} from "./grouped-number"

describe("digitsOnly", () => {
  it("strips grouping separators and spaces", () => {
    expect(digitsOnly("1,000,000")).toBe("1000000")
    expect(digitsOnly("1 000 000")).toBe("1000000")
    expect(digitsOnly("")).toBe("")
    expect(digitsOnly("abc")).toBe("")
  })
})

describe("formatGroupedInteger", () => {
  it("groups thousands for the locale, no decimals", () => {
    expect(formatGroupedInteger(1000000, "en")).toBe("1,000,000")
    expect(formatGroupedInteger(0, "en")).toBe("0")
    expect(formatGroupedInteger(999, "en")).toBe("999")
  })

  it("uses the locale's separator", () => {
    // sv groups with a space (regular or non-breaking); assert no comma.
    const sv = formatGroupedInteger(1000000, "sv")
    expect(sv).not.toContain(",")
    expect(digitsOnly(sv)).toBe("1000000")
  })
})

describe("caretIndexAfterDigits", () => {
  it("returns 0 for a non-positive digit count", () => {
    expect(caretIndexAfterDigits("1,000", 0)).toBe(0)
  })

  it("lands just after the Nth digit, skipping separators", () => {
    // "1,000,000": digit 1 -> index 1; digit 4 (after first comma) -> index 5.
    expect(caretIndexAfterDigits("1,000,000", 1)).toBe(1)
    expect(caretIndexAfterDigits("1,000,000", 4)).toBe(5)
  })

  it("clamps past the end to the string length", () => {
    expect(caretIndexAfterDigits("1,000", 99)).toBe(5)
  })
})
