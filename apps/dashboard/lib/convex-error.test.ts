import { ConvexError } from "convex/values"
import { describe, expect, it, vi } from "vitest"
import { translateErrorCode } from "./convex-error"

function t(key: string): string {
  return `translated:${key}`
}

describe("translateErrorCode", () => {
  it("translates a known assistant leaf code", () => {
    const error = new ConvexError({ code: "errors.assistantBusy" })
    expect(translateErrorCode(error, t)).toBe("translated:assistantBusy")
  })

  it("translates every known assistant leaf code", () => {
    const codes = [
      "assistantBusy",
      "assistantRateLimited",
      "assistantInvalidMessage",
      "assistantPersonalData",
    ]
    for (const code of codes) {
      const error = new ConvexError({ code: `errors.${code}` })
      expect(translateErrorCode(error, t)).toBe(`translated:${code}`)
    }
  })

  it("falls back to the generic message for an unknown ConvexError code", () => {
    const error = new ConvexError({ code: "errors.notAMember" })
    expect(translateErrorCode(error, t)).toBe("translated:aiGenerationFailed")
  })

  it("falls back to the generic message for a non-ConvexError failure", () => {
    expect(translateErrorCode(new Error("network down"), t)).toBe(
      "translated:aiGenerationFailed"
    )
    expect(translateErrorCode("not an error", t)).toBe(
      "translated:aiGenerationFailed"
    )
    expect(translateErrorCode(null, t)).toBe("translated:aiGenerationFailed")
  })

  it("never calls t with an unvalidated key", () => {
    const spy = vi.fn(t)
    const error = new ConvexError({ code: "errors.somethingUnexpected" })
    translateErrorCode(error, spy)
    expect(spy).toHaveBeenCalledExactlyOnceWith("aiGenerationFailed")
  })
})
