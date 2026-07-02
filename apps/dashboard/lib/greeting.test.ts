import { describe, expect, it } from "vitest"
import { greetingBucket } from "./greeting"

describe("greetingBucket", () => {
  it("maps the hour to a bucket at the boundaries", () => {
    expect(greetingBucket(4)).toBe("evening")
    expect(greetingBucket(5)).toBe("morning")
    expect(greetingBucket(11)).toBe("morning")
    expect(greetingBucket(12)).toBe("afternoon")
    expect(greetingBucket(16)).toBe("afternoon")
    expect(greetingBucket(17)).toBe("evening")
    expect(greetingBucket(23)).toBe("evening")
    expect(greetingBucket(0)).toBe("evening")
  })
})
