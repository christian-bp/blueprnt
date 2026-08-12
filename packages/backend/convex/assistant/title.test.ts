import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai"
import type { LanguageModelUsage } from "ai"
import { describe, expect, it } from "vitest"
import { usageFromTitleFailure } from "./title"

function fakeUsage(): LanguageModelUsage {
  return {
    inputTokens: 12,
    inputTokenDetails: {
      noCacheTokens: 12,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokens: 4,
    outputTokenDetails: { textTokens: 4, reasoningTokens: 0 },
    totalTokens: 16,
  }
}

function fakeResponse() {
  return {
    id: "resp-1",
    timestamp: new Date(0),
    modelId: "mistral-small-latest",
  }
}

describe("usageFromTitleFailure", () => {
  it("reads usage off a NoObjectGeneratedError (thrown inside the awaited call, before any result exists)", () => {
    const usage = fakeUsage()
    const error = new NoObjectGeneratedError({
      response: fakeResponse(),
      usage,
      finishReason: "stop",
    })
    expect(usageFromTitleFailure(error)).toBe(usage)
  })

  it("returns null when a NoObjectGeneratedError carries no usage", () => {
    const error = new NoObjectGeneratedError({
      response: fakeResponse(),
      usage: undefined as unknown as LanguageModelUsage,
      finishReason: "stop",
    })
    expect(usageFromTitleFailure(error)).toBeNull()
  })

  it("returns null for a NoOutputGeneratedError (the caller already holds the resolved result's own usage in that case)", () => {
    expect(usageFromTitleFailure(new NoOutputGeneratedError())).toBeNull()
  })

  it("returns null for an unrelated error", () => {
    expect(usageFromTitleFailure(new Error("network error"))).toBeNull()
  })

  it("returns null for a non-Error throw value", () => {
    expect(usageFromTitleFailure("boom")).toBeNull()
  })
})
