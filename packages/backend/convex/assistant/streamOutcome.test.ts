import { describe, expect, it } from "vitest"
import { ERROR_CODES } from "../lib/errors"
import { classifyStreamOutcome } from "./streamOutcome"

describe("classifyStreamOutcome", () => {
  it("completes when the stream ran out on its own with content", () => {
    expect(
      classifyStreamOutcome({
        terminal: "completed",
        stopped: false,
        hasContent: true,
      })
    ).toEqual({ status: "complete", recordUsage: true })
  })

  it("fails an unstopped completion that produced no content", () => {
    expect(
      classifyStreamOutcome({
        terminal: "completed",
        stopped: false,
        hasContent: false,
      })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  it("reports stopped for a user-requested stop with content already produced", () => {
    expect(
      classifyStreamOutcome({
        terminal: "completed",
        stopped: true,
        hasContent: true,
      })
    ).toEqual({ status: "stopped", recordUsage: true })
  })

  it("reports stopped for a user-requested stop even with no content yet", () => {
    // The empty-bubble failure check only applies to an unstopped
    // completion: a break triggered by flush()'s stop signal is "stopped"
    // regardless of how much content had landed.
    expect(
      classifyStreamOutcome({
        terminal: "completed",
        stopped: true,
        hasContent: false,
      })
    ).toEqual({ status: "stopped", recordUsage: true })
  })

  it("reports stopped for an abort part following a user-requested stop", () => {
    expect(
      classifyStreamOutcome({ terminal: "abortPart", stopped: true })
    ).toEqual({ status: "stopped", recordUsage: true })
  })

  it("fails an abort part with no user-requested stop (timeout abort)", () => {
    expect(
      classifyStreamOutcome({ terminal: "abortPart", stopped: false })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  it("fails an error part", () => {
    expect(
      classifyStreamOutcome({ terminal: "errorPart", error: null })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  it("reports stopped for an exception after a user-requested stop", () => {
    expect(
      classifyStreamOutcome({
        terminal: "exception",
        stopped: true,
        error: null,
      })
    ).toEqual({ status: "stopped", recordUsage: true })
  })

  it("fails an exception with no user-requested stop", () => {
    expect(
      classifyStreamOutcome({
        terminal: "exception",
        stopped: false,
        error: null,
      })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  // Both shapes were taken from a real Mistral 429 observed in the deployment
  // logs: the SDK surfaces the bare call error when it gives up immediately
  // and an AI_RetryError wrapping it once the retries are spent, which is the
  // shape that actually reached the user as a generic failure.
  it("maps a provider rate limit to the rate-limited code, not a generic failure", () => {
    const apiError = Object.assign(new Error("Rate limit exceeded"), {
      name: "AI_APICallError",
      statusCode: 429,
    })
    expect(
      classifyStreamOutcome({ terminal: "errorPart", error: apiError })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.assistantRateLimited,
      recordUsage: true,
    })

    const retryError = Object.assign(
      new Error("Failed after 3 attempts. Last error: Rate limit exceeded"),
      { name: "AI_RetryError", lastError: apiError, errors: [apiError] }
    )
    expect(
      classifyStreamOutcome({
        terminal: "exception",
        stopped: false,
        error: retryError,
      })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.assistantRateLimited,
      recordUsage: true,
    })
  })

  it("keeps the generic failure code for a non-rate-limit provider error", () => {
    const serverError = Object.assign(new Error("Internal server error"), {
      name: "AI_APICallError",
      statusCode: 500,
    })
    expect(
      classifyStreamOutcome({ terminal: "errorPart", error: serverError })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  it("does not recurse forever on a self-referencing error chain", () => {
    const looping: { name: string; lastError?: unknown; message: string } = {
      name: "AI_RetryError",
      message: "wrapped",
    }
    looping.lastError = looping
    expect(
      classifyStreamOutcome({ terminal: "errorPart", error: looping })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })
})
