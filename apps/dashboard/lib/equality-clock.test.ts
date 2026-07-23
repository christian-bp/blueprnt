import { describe, expect, it } from "vitest"
import { clockUnits, equalityClock } from "./equality-clock"

describe("clockUnits", () => {
  it("splits a second count into padded two-digit units", () => {
    expect(clockUnits(2880)).toEqual({
      hours: "00",
      minutes: "48",
      seconds: "00",
    })
    expect(clockUnits(7325)).toEqual({
      hours: "02",
      minutes: "02",
      seconds: "05",
    })
  })

  it("rounds fractional (animated) values and clamps below zero", () => {
    expect(clockUnits(59.6).seconds).toBe("00")
    expect(clockUnits(59.6).minutes).toBe("01")
    expect(clockUnits(-5)).toEqual({
      hours: "00",
      minutes: "00",
      seconds: "00",
    })
  })
})

describe("equalityClock", () => {
  it("expresses a positive gap as women-behind daily unpaid time (8h workday)", () => {
    // 10% of 8h = 48 min.
    const r = equalityClock(10)
    expect(r.seconds).toBe(2880)
    expect(r.direction).toBe("womenBehind")
    expect(r.display).toBe("00:48:00")
  })

  it("expresses a negative gap as men-behind", () => {
    const r = equalityClock(-5)
    expect(r.direction).toBe("menBehind")
    expect(r.display).toBe("00:24:00") // magnitude
  })

  it("formats past one hour", () => {
    const r = equalityClock(25) // 25% of 8h = 2h
    expect(r.display).toBe("02:00:00")
  })

  it("reports no gap for null or a zero-second gap", () => {
    expect(equalityClock(null).direction).toBe("none")
    expect(equalityClock(0).direction).toBe("none")
    expect(equalityClock(0).display).toBe("00:00:00")
  })
})
