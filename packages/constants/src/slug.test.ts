import { describe, expect, it } from "vitest"
import { SLUG_PATTERN, isValidSlug, slugify } from "./slug"

describe("isValidSlug", () => {
  it("accepts lowercase, digits, and single hyphen-separated groups", () => {
    expect(isValidSlug("acme")).toBe(true)
    expect(isValidSlug("acme-1")).toBe(true)
    expect(isValidSlug("a1-b2-c3")).toBe(true)
    expect(isValidSlug("123")).toBe(true)
  })

  it("rejects empty, uppercase, spaces, and bad hyphen placement", () => {
    expect(isValidSlug("")).toBe(false)
    expect(isValidSlug("Acme")).toBe(false)
    expect(isValidSlug("acme inc")).toBe(false)
    expect(isValidSlug("-acme")).toBe(false)
    expect(isValidSlug("acme-")).toBe(false)
    expect(isValidSlug("acme--inc")).toBe(false)
    expect(isValidSlug("acme_inc")).toBe(false)
  })

  it("exports the underlying pattern", () => {
    expect(SLUG_PATTERN.test("acme-1")).toBe(true)
    expect(SLUG_PATTERN.test("Acme")).toBe(false)
  })
})

describe("slugify", () => {
  it("lowercases and hyphenates ASCII words", () => {
    expect(slugify("Kanonkula AB")).toBe("kanonkula-ab")
  })

  it("transliterates umlaut letters that decompose under NFD", () => {
    expect(slugify("Känslosam AB")).toBe("kanslosam-ab")
  })

  it("transliterates Nordic letters that do not decompose under NFD", () => {
    expect(slugify("Mørk Æra")).toBe("mork-aera")
  })

  it("strips leading/trailing whitespace and punctuation", () => {
    expect(slugify("  Hej!! ")).toBe("hej")
  })

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("")
  })

  it("non-empty results satisfy SLUG_PATTERN", () => {
    const inputs = ["Kanonkula AB", "Känslosam AB", "Mørk Æra", "  Hej!! "]
    for (const input of inputs) {
      const result = slugify(input)
      if (result !== "") {
        expect(SLUG_PATTERN.test(result)).toBe(true)
      }
    }
  })
})
