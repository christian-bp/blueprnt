import { describe, expect, it } from "vitest"
import { capitalizeFirst } from "./capitalize"

describe("capitalizeFirst", () => {
  it("uppercases a lowercase first letter", () => {
    expect(capitalizeFirst("acme's model", "en")).toBe("Acme's model")
  })

  it("leaves an already capitalized heading untouched", () => {
    expect(capitalizeFirst("Modellen för Acme", "sv")).toBe("Modellen för Acme")
  })

  it("uppercases Nordic letters by locale", () => {
    expect(capitalizeFirst("örnen ab", "sv")).toBe("Örnen ab")
  })

  it("leaves a non-letter lead unchanged", () => {
    expect(capitalizeFirst("4human's model", "en")).toBe("4human's model")
  })

  it("returns the empty string unchanged", () => {
    expect(capitalizeFirst("", "en")).toBe("")
  })
})
