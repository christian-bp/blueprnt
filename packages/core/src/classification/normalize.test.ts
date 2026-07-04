import { describe, expect, it } from "vitest"
import { normalizeTitleString } from "./normalize"

describe("normalizeTitleString", () => {
  it("lowercases", () => {
    expect(normalizeTitleString("Senior Engineer")).toBe("senior engineer")
  })

  it("strips diacritics via canonical decomposition", () => {
    expect(normalizeTitleString("Utvecklingschef")).toBe("utvecklingschef")
    expect(normalizeTitleString("Chefsjurist")).toBe("chefsjurist")
    expect(normalizeTitleString("Söker Ärende Öl")).toBe("soker arende ol")
  })

  it("strips punctuation to spaces", () => {
    expect(normalizeTitleString("Sr. Back-end / Dev")).toBe("sr back end dev")
  })

  it("collapses whitespace including leading and trailing", () => {
    expect(normalizeTitleString("   Team   Lead  ")).toBe("team lead")
  })

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeTitleString("--- / ---")).toBe("")
  })

  it("is deterministic (same input, same output)", () => {
    const input = "Senior Fullstack-Utvecklare"
    expect(normalizeTitleString(input)).toBe(normalizeTitleString(input))
  })
})
