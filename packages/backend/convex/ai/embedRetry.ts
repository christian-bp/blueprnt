// The retry DECISION for the embedding transport, kept apart from
// ai/provider.ts (which is "use node" and constructs the AI SDK provider) so
// the branch-dense part is testable on its own: attempt ceiling, backoff,
// both Retry-After forms, and the total-wait ceiling.

// Bounded on both axes: at most EMBED_MAX_ATTEMPTS requests and at most
// EMBED_MAX_TOTAL_WAIT_MS of sleeping across them, because this provider is
// also on the user-facing documentation search, where a long retry chain is a
// stalled assistant rather than a rescued call.
export const EMBED_MAX_ATTEMPTS = 4
export const EMBED_BASE_DELAY_MS = 500
export const EMBED_MAX_DELAY_MS = 8_000
export const EMBED_MAX_TOTAL_WAIT_MS = 15_000

// 429 is the rate limit; 5xx is the provider failing in a way a second
// request can survive. Anything else (401, 400, a rejected model id) repeats
// identically, so retrying it only delays the error.
export const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500

// Retry-After comes in two forms: delta-seconds or an HTTP date. `now` is a
// parameter rather than a Date.now() call so the date form is testable.
export function retryAfterMs(
  header: string | null,
  now: number
): number | null {
  const value = header?.trim()
  if (value === undefined || value === "") return null
  // Number("") is 0, so an empty header has to be ruled out above or it would
  // read as "retry immediately" and burn an attempt on the same limit.
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(value)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - now)
}

// How long to wait before the next attempt, or null to stop and return the
// response as it stands. `attempt` is 1-based and counts the request that has
// just completed; `waited` is the total slept so far.
export function nextRetryDelayMs(args: {
  status: number
  retryAfter: string | null
  attempt: number
  waited: number
  now: number
}): number | null {
  if (!isRetryableStatus(args.status)) return null
  if (args.attempt >= EMBED_MAX_ATTEMPTS) return null
  const backoff = Math.min(
    EMBED_BASE_DELAY_MS * 2 ** (args.attempt - 1),
    EMBED_MAX_DELAY_MS
  )
  // A Retry-After longer than the cap is clamped, which can retry earlier
  // than the provider asked. The caller reports the failure per page and
  // keeps going, so the cheap early retry beats holding a request open.
  const delay = Math.min(
    retryAfterMs(args.retryAfter, args.now) ?? backoff,
    EMBED_MAX_DELAY_MS
  )
  if (args.waited + delay > EMBED_MAX_TOTAL_WAIT_MS) return null
  return delay
}
