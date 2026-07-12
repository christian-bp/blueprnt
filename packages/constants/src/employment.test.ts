import { describe, expect, it } from "vitest"
import { EMPLOYMENT_TYPES, normalizeEmploymentType } from "./employment"

describe("normalizeEmploymentType", () => {
  it("maps Swedish/Nordic/English terms to canonical values", () => {
    expect(normalizeEmploymentType("Tillsvidare")).toBe("permanent")
    expect(normalizeEmploymentType("fast anställning")).toBe("permanent")
    expect(normalizeEmploymentType("Visstid")).toBe("fixedTerm")
    expect(normalizeEmploymentType("Vikariat")).toBe("substitute")
    expect(normalizeEmploymentType("Timanställd")).toBe("hourly")
    expect(normalizeEmploymentType("Permanent")).toBe("permanent")
  })
  it("returns null for blank or unrecognised input", () => {
    expect(normalizeEmploymentType("")).toBeNull()
    expect(normalizeEmploymentType("konsult")).toBeNull()
  })
  it("exposes the four canonical types", () => {
    expect(EMPLOYMENT_TYPES).toEqual([
      "permanent",
      "fixedTerm",
      "substitute",
      "hourly",
    ])
  })
})
