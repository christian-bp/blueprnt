import { describe, expect, it } from "vitest"
import { initialsOf } from "./initials"

describe("initialsOf", () => {
  it("takes the first letter of the first two name parts, uppercased", () => {
    expect(initialsOf("Anna Svensson")).toBe("AS")
    expect(initialsOf("anna svensson")).toBe("AS")
  })

  it("uses a single initial for a one-part name", () => {
    expect(initialsOf("Anna")).toBe("A")
  })

  it("ignores name parts beyond the first two", () => {
    expect(initialsOf("Anna Maria Svensson")).toBe("AM")
  })

  it("survives extra whitespace between and around parts", () => {
    expect(initialsOf("  Anna   Svensson  ")).toBe("AS")
  })

  it("falls back to the fallback text's first letter for an empty name", () => {
    expect(initialsOf("", "anna@acme.se")).toBe("A")
    expect(initialsOf("   ", "anna@acme.se")).toBe("A")
  })

  it("returns ? when neither name nor fallback is present", () => {
    expect(initialsOf("")).toBe("?")
    expect(initialsOf("", "")).toBe("?")
  })
})
