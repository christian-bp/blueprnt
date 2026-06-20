import { describe, expect, it } from "vitest"
import { formatPageTitle, TITLE_SEPARATOR } from "./page-title"

const BRAND = "blueprnt"

describe("formatPageTitle", () => {
  it("joins a single page segment with the brand", () => {
    expect(formatPageTitle(["Roles"], BRAND)).toBe(
      `Roles${TITLE_SEPARATOR}${BRAND}`
    )
  })

  it("joins multiple segments in order before the brand", () => {
    expect(formatPageTitle(["Admin", "Users"], BRAND)).toBe(
      `Admin${TITLE_SEPARATOR}Users${TITLE_SEPARATOR}${BRAND}`
    )
  })

  it("drops undefined and empty segments (a still-loading name)", () => {
    expect(formatPageTitle([undefined, "Users"], BRAND)).toBe(
      `Users${TITLE_SEPARATOR}${BRAND}`
    )
    expect(formatPageTitle(["", undefined], BRAND)).toBe(BRAND)
  })

  it("returns the brand alone when no page segment remains", () => {
    expect(formatPageTitle([], BRAND)).toBe(BRAND)
    expect(formatPageTitle([undefined], BRAND)).toBe(BRAND)
  })
})
