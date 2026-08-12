import { ERROR_CODES } from "../lib/errors"

// The ways generate.ts's stream loop and its surrounding try/catch can end,
// once streamText() has actually started (a model-unavailable or
// personal-data-flagged rejection happens earlier and never reaches this
// classifier). "completed" covers both a stream that ran out of parts on its
// own and one that broke out early because flush() reported a requested
// stop; the two are told apart by `stopped`, exactly as generate.ts's own
// state tracks it.
export type StreamTerminalCondition =
  | { terminal: "completed"; stopped: boolean; hasContent: boolean }
  | { terminal: "abortPart"; stopped: boolean }
  | { terminal: "errorPart" }
  | { terminal: "exception"; stopped: boolean }

export interface StreamOutcome {
  status: "complete" | "stopped" | "failed"
  errorCode?: string
  recordUsage: boolean
}

// Pure classification of one terminal condition into the message status to
// finalize with, the error code to attach (only ever set alongside
// "failed"), and whether the caller should attempt to record usage. Usage is
// always recorded once streamText() has started, because tokens may already
// be billed on every one of these paths; the flag still travels with the
// result so a future terminal condition that must skip recording (an input
// rejected before any model call) stays a conscious choice at the call site
// instead of a silent default.
export function classifyStreamOutcome(
  condition: StreamTerminalCondition
): StreamOutcome {
  switch (condition.terminal) {
    case "completed":
      // A stream that ran to completion with no user-requested stop and no
      // text or parts produced is a blank successful bubble: the model
      // exhausted its tool-step budget with no prose step left. Treated as a
      // failure rather than "complete" so the UI never shows an empty reply.
      if (!condition.stopped && !condition.hasContent) {
        return {
          status: "failed",
          errorCode: ERROR_CODES.aiGenerationFailed,
          recordUsage: true,
        }
      }
      return {
        status: condition.stopped ? "stopped" : "complete",
        recordUsage: true,
      }
    case "abortPart":
      // The SDK enqueues an abort part rather than throwing. `stopped` is
      // only ever true here because our own flush() already reported a
      // user-requested stop; any other abort (the generation timeout firing)
      // is a failure, not a user stop.
      return condition.stopped
        ? { status: "stopped", recordUsage: true }
        : {
            status: "failed",
            errorCode: ERROR_CODES.aiGenerationFailed,
            recordUsage: true,
          }
    case "errorPart":
      return {
        status: "failed",
        errorCode: ERROR_CODES.aiGenerationFailed,
        recordUsage: true,
      }
    case "exception":
      return condition.stopped
        ? { status: "stopped", recordUsage: true }
        : {
            status: "failed",
            errorCode: ERROR_CODES.aiGenerationFailed,
            recordUsage: true,
          }
  }
}
