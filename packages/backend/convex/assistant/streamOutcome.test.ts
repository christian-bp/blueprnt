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
    expect(classifyStreamOutcome({ terminal: "errorPart" })).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })

  it("reports stopped for an exception after a user-requested stop", () => {
    expect(
      classifyStreamOutcome({ terminal: "exception", stopped: true })
    ).toEqual({ status: "stopped", recordUsage: true })
  })

  it("fails an exception with no user-requested stop", () => {
    expect(
      classifyStreamOutcome({ terminal: "exception", stopped: false })
    ).toEqual({
      status: "failed",
      errorCode: ERROR_CODES.aiGenerationFailed,
      recordUsage: true,
    })
  })
})
