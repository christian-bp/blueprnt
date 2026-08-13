import { startOfDay } from "@/lib/date-bounds"

const DAY_MS = 24 * 60 * 60 * 1000

// A timestamp's date bucket relative to `now`, by CALENDAR day in the
// caller's local time zone, never a rolling 24h window: a thread from 23:50
// yesterday reads as "yesterday" even checked at 00:10 today, because both
// sides collapse to local midnight (startOfDay) before comparing. `now` is a
// caller-supplied Date rather than read internally, so this stays pure and
// deterministic for tests; a stale bucket if `now` is not refreshed across a
// midnight rollover is the caller's tradeoff to make, not this function's.
export type RelativeDayBucket = "today" | "yesterday" | "older"

export function relativeDayBucket(date: Date, now: Date): RelativeDayBucket {
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  return "older"
}
