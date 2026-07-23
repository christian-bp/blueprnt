// The "jämställdhetsklocka": the gender pay gap expressed as time. Unpaid daily
// time = |gap%| of an 8-hour working day. Pure and locale-free; the component
// wraps this with translated copy. No I/O, no clock reads.
const WORKDAY_SECONDS = 8 * 3600

// Not exported: only equalityClock (below) constructs a value, and only
// this file's own callers (the equality-clock component) consume it, always
// through equalityClock's return type rather than importing this directly.
type EqualityClockDirection = "womenBehind" | "menBehind" | "none"

interface EqualityClockValue {
  seconds: number
  direction: EqualityClockDirection
  display: string // HH:MM:SS
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// Splits a (possibly fractional, animated) second count into padded two-digit
// clock units. Exported for the clock component's digit boxes so the HH/MM/SS
// math lives once.
export function clockUnits(total: number): {
  hours: string
  minutes: string
  seconds: string
} {
  const t = Math.max(0, Math.round(total))
  return {
    hours: pad(Math.floor(t / 3600)),
    minutes: pad(Math.floor((t % 3600) / 60)),
    seconds: pad(t % 60),
  }
}

// Formats a second count as HH:MM:SS (the sentence form of the units).
function formatClock(total: number): string {
  const u = clockUnits(total)
  return `${u.hours}:${u.minutes}:${u.seconds}`
}

export function equalityClock(gapPct: number | null): EqualityClockValue {
  if (gapPct === null) {
    return { seconds: 0, direction: "none", display: formatClock(0) }
  }
  const seconds = Math.round((Math.abs(gapPct) / 100) * WORKDAY_SECONDS)
  const direction: EqualityClockDirection =
    seconds === 0 ? "none" : gapPct > 0 ? "womenBehind" : "menBehind"
  return { seconds, direction, display: formatClock(seconds) }
}
