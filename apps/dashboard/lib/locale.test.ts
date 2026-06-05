import { afterEach, describe, expect, it, vi } from "vitest"
import { detectBrowserLocale, resolveUiLocale } from "./locale"

describe("resolveUiLocale", () => {
  it("returns a supported locale unchanged", () => {
    expect(resolveUiLocale("sv", "en")).toBe("sv")
    expect(resolveUiLocale("fi", "en")).toBe("fi")
  })

  it("falls back for an unsupported locale", () => {
    expect(resolveUiLocale("de", "en")).toBe("en")
    expect(resolveUiLocale("EN", "sv")).toBe("sv") // case-sensitive on purpose
  })

  it("falls back for null and undefined", () => {
    expect(resolveUiLocale(null, "en")).toBe("en")
    expect(resolveUiLocale(undefined, "nb")).toBe("nb")
  })

  it("falls back for an empty string", () => {
    expect(resolveUiLocale("", "da")).toBe("da")
  })
})

describe("detectBrowserLocale", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("strips the region suffix and returns the matching supported locale", () => {
    vi.stubGlobal("navigator", { language: "sv-SE" })
    expect(detectBrowserLocale("en")).toBe("sv")
  })

  it("works for a bare language tag without region", () => {
    vi.stubGlobal("navigator", { language: "nb" })
    expect(detectBrowserLocale("en")).toBe("nb")
  })

  it("falls back to the provided fallback for an unsupported language", () => {
    vi.stubGlobal("navigator", { language: "de-DE" })
    expect(detectBrowserLocale("en")).toBe("en")
  })

  it("falls back when navigator is undefined (SSR guard)", () => {
    vi.stubGlobal("navigator", undefined)
    expect(detectBrowserLocale("sv")).toBe("sv")
  })
})
