import { ERROR_CODES } from "../lib/errors"

// The ways generate.ts's stream loop and its surrounding try/catch can end,
// once streamText() has actually started (a model-unavailable or
// personal-data-flagged rejection happens earlier and never reaches this
// classifier). "completed" covers both a stream that ran out of parts on its
// own and one that broke out early because flush() reported a requested
// stop; the two are told apart by `stopped`, exactly as generate.ts's own
// state tracks it. The failing branches carry the error they failed with so
// a provider rate limit can be told apart from a genuine generation failure.
export type StreamTerminalCondition =
  | { terminal: "completed"; stopped: boolean; hasContent: boolean }
  | { terminal: "abortPart"; stopped: boolean }
  | { terminal: "errorPart"; error: unknown }
  | { terminal: "exception"; stopped: boolean; error: unknown }

export interface StreamOutcome {
  status: "complete" | "stopped" | "failed"
  errorCode?: string
  recordUsage: boolean
}

// A PROVIDER rate limit, which is not the same condition as the reader
// sending too much: it is the model refusing us, on a message that may be
// their first. The two used to share one code, so a 429 from the provider
// told the reader they had sent many messages in a short time. Our own cap
// keeps assistantRateLimited; this path reports assistantOverloaded.
//
// A provider rate limit reaches us in more than one shape: the raw
// AI_APICallError carrying statusCode 429, or an AI_RetryError wrapping it
// after the SDK's attempts are spent, in which case only the wrapper's
// `lastError` (or its `errors` list) holds the status. The message text is
// checked last because a provider that omits the status code still names the
// condition there.
const RATE_LIMIT_STATUS = 429

function hasRateLimitStatus(error: object): boolean {
  return (
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === RATE_LIMIT_STATUS
  )
}

export function isRateLimitError(error: unknown, depth = 0): boolean {
  if (typeof error !== "object" || error === null || depth > 3) return false
  if (hasRateLimitStatus(error)) return true
  if (
    "lastError" in error &&
    isRateLimitError((error as { lastError: unknown }).lastError, depth + 1)
  ) {
    return true
  }
  const nested = (error as { errors?: unknown }).errors
  if (
    Array.isArray(nested) &&
    nested.some((entry) => isRateLimitError(entry, depth + 1))
  ) {
    return true
  }
  const message = (error as { message?: unknown }).message
  return typeof message === "string" && /rate limit/i.test(message)
}

function failure(error: unknown): StreamOutcome {
  return {
    status: "failed",
    errorCode: isRateLimitError(error)
      ? ERROR_CODES.assistantOverloaded
      : ERROR_CODES.aiGenerationFailed,
    recordUsage: true,
  }
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
        return failure(null)
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
        : failure(null)
    case "errorPart":
      return failure(condition.error)
    case "exception":
      return condition.stopped
        ? { status: "stopped", recordUsage: true }
        : failure(condition.error)
  }
}
