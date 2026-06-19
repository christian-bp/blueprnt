import { describe, expect, it } from "vitest"
import { SLUG_PATTERN, isValidSlug } from "./slug"

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
