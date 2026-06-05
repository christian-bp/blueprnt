import { describe, expect, it } from "vitest"
import { organizationSlug } from "./slug"

describe("organizationSlug", () => {
  it("lowercases, strips diacritics, and dashes the name", () => {
    expect(organizationSlug("Åke & Söner AB")).toMatch(
      /^ake-soner-ab-[a-z0-9]{4}$/
    )
  })

  it("falls back to organization for empty or all-symbol names", () => {
    expect(organizationSlug("")).toMatch(/^organization-[a-z0-9]{4}$/)
    expect(organizationSlug("!!!")).toMatch(/^organization-[a-z0-9]{4}$/)
  })

  it("bounds the base at 40 characters", () => {
    const slug = organizationSlug("x".repeat(100))
    expect(slug.length).toBeLessThanOrEqual(45)
  })
})
