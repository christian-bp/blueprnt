import { describe, expect, it } from "vitest"
import {
  EMBED_BASE_DELAY_MS,
  EMBED_MAX_ATTEMPTS,
  EMBED_MAX_DELAY_MS,
  EMBED_MAX_TOTAL_WAIT_MS,
  isRetryableStatus,
  nextRetryDelayMs,
  retryAfterMs,
} from "./embedRetry"

const NOW = 1_700_000_000_000

const decide = (over: Partial<Parameters<typeof nextRetryDelayMs>[0]> = {}) =>
  nextRetryDelayMs({
    status: 429,
    retryAfter: null,
    attempt: 1,
    waited: 0,
    now: NOW,
    ...over,
  })

describe("isRetryableStatus", () => {
  it("retries a rate limit and a failing provider, nothing else", () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    // A rejected key, a bad request, or an unknown model repeats identically,
    // so retrying only delays the error the caller needs to see.
    expect(isRetryableStatus(200)).toBe(false)
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
  })
})

describe("retryAfterMs", () => {
  it("reads the delta-seconds form", () => {
    expect(retryAfterMs("2", NOW)).toBe(2000)
    expect(retryAfterMs(" 30 ", NOW)).toBe(30_000)
  })

  it("reads the HTTP-date form relative to now", () => {
    expect(retryAfterMs(new Date(NOW + 5000).toUTCString(), NOW)).toBe(5000)
  })

  it("never returns a negative wait for a date already past", () => {
    expect(retryAfterMs(new Date(NOW - 60_000).toUTCString(), NOW)).toBe(0)
  })

  // Number("") is 0, so an absent or blank header must be ruled out before
  // the numeric branch or it reads as "retry immediately" and burns an
  // attempt against the very limit that is being backed off.
  it("treats an absent, blank, or unparseable header as no instruction", () => {
    expect(retryAfterMs(null, NOW)).toBeNull()
    expect(retryAfterMs("", NOW)).toBeNull()
    expect(retryAfterMs("   ", NOW)).toBeNull()
    expect(retryAfterMs("soon", NOW)).toBeNull()
  })
})

describe("nextRetryDelayMs", () => {
  it("does not retry a status that is not retryable", () => {
    expect(decide({ status: 200 })).toBeNull()
    expect(decide({ status: 401 })).toBeNull()
  })

  it("backs off exponentially across attempts", () => {
    expect(decide({ attempt: 1 })).toBe(EMBED_BASE_DELAY_MS)
    expect(decide({ attempt: 2 })).toBe(EMBED_BASE_DELAY_MS * 2)
    expect(decide({ attempt: 3 })).toBe(EMBED_BASE_DELAY_MS * 4)
  })

  it("stops once the attempt ceiling is reached", () => {
    expect(decide({ attempt: EMBED_MAX_ATTEMPTS })).toBeNull()
    expect(decide({ attempt: EMBED_MAX_ATTEMPTS + 1 })).toBeNull()
  })

  it("prefers the provider's Retry-After over its own backoff", () => {
    expect(decide({ attempt: 1, retryAfter: "3" })).toBe(3000)
  })

  it("clamps a Retry-After longer than the per-wait ceiling", () => {
    expect(decide({ retryAfter: "600" })).toBe(EMBED_MAX_DELAY_MS)
  })

  // The ceiling exists because this provider is also on the user-facing
  // documentation search: a long retry chain there is a stalled assistant,
  // not a rescued call.
  it("stops rather than exceeding the total wait budget", () => {
    expect(decide({ waited: EMBED_MAX_TOTAL_WAIT_MS })).toBeNull()
    expect(decide({ waited: EMBED_MAX_TOTAL_WAIT_MS - 1 })).toBeNull()
    expect(
      decide({ waited: EMBED_MAX_TOTAL_WAIT_MS - EMBED_BASE_DELAY_MS })
    ).toBe(EMBED_BASE_DELAY_MS)
  })

  it("keeps every delay within the per-wait ceiling", () => {
    for (let attempt = 1; attempt < EMBED_MAX_ATTEMPTS; attempt += 1) {
      const delay = decide({ attempt })
      expect(delay).not.toBeNull()
      expect(delay ?? 0).toBeLessThanOrEqual(EMBED_MAX_DELAY_MS)
    }
  })
})
