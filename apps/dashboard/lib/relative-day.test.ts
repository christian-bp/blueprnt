import { describe, expect, it } from "vitest"
import { relativeDayBucket } from "./relative-day"

describe("relativeDayBucket", () => {
  it("buckets any time on the same calendar day as today", () => {
    const now = new Date(2026, 7, 13, 9, 0)
    expect(relativeDayBucket(new Date(2026, 7, 13, 0, 0), now)).toBe("today")
    expect(relativeDayBucket(new Date(2026, 7, 13, 23, 59), now)).toBe("today")
  })

  it("buckets the calendar day before as yesterday", () => {
    const now = new Date(2026, 7, 13, 9, 0)
    expect(relativeDayBucket(new Date(2026, 7, 12, 9, 0), now)).toBe(
      "yesterday"
    )
  })

  // The bug a rolling 24h window would introduce: a thread from 23:50 the
  // day before is only 20 minutes old at 00:10, so a duration-based check
  // would call it "today". Calendar-day comparison correctly calls it
  // "yesterday" the moment the wall clock crosses local midnight.
  it("keeps a late-night thread as yesterday just after midnight", () => {
    const lastMessageAt = new Date(2026, 7, 12, 23, 50)
    const now = new Date(2026, 7, 13, 0, 10)
    expect(relativeDayBucket(lastMessageAt, now)).toBe("yesterday")
  })

  it("buckets two or more calendar days back as older", () => {
    const now = new Date(2026, 7, 13, 9, 0)
    expect(relativeDayBucket(new Date(2026, 7, 11, 9, 0), now)).toBe("older")
    expect(relativeDayBucket(new Date(2020, 0, 1), now)).toBe("older")
  })

  it("crosses a month boundary correctly", () => {
    const now = new Date(2026, 8, 1, 9, 0) // Sep 1
    expect(relativeDayBucket(new Date(2026, 7, 31, 9, 0), now)).toBe(
      "yesterday"
    ) // Aug 31
  })

  it("treats a future timestamp as older rather than today", () => {
    const now = new Date(2026, 7, 13, 9, 0)
    expect(relativeDayBucket(new Date(2026, 7, 14, 9, 0), now)).toBe("older")
  })
})
