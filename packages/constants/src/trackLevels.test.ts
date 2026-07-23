import { describe, expect, it } from "vitest"
import {
  TRACK_LEVELS,
  isValidLevelForTrack,
  trackKeyForLevel,
} from "./trackLevels"

describe("TRACK_LEVELS", () => {
  it("IC track has exactly IC1-IC5", () => {
    expect(TRACK_LEVELS.IC).toEqual(["IC1", "IC2", "IC3", "IC4", "IC5"])
  })

  it("Lead track has exactly Lead-1, Lead-2, Lead-3", () => {
    expect(TRACK_LEVELS.Lead).toEqual(["Lead-1", "Lead-2", "Lead-3"])
  })

  it("M track has exactly M1, M2, M3", () => {
    expect(TRACK_LEVELS.M).toEqual(["M1", "M2", "M3"])
  })
})

describe("isValidLevelForTrack", () => {
  it("IC3 is valid for IC", () => {
    expect(isValidLevelForTrack("IC", "IC3")).toBe(true)
  })

  it("Lead-3 is valid for Lead", () => {
    expect(isValidLevelForTrack("Lead", "Lead-3")).toBe(true)
  })

  it("M4 is invalid for M", () => {
    expect(isValidLevelForTrack("M", "M4")).toBe(false)
  })

  it("IC1 is invalid for Lead", () => {
    expect(isValidLevelForTrack("Lead", "IC1")).toBe(false)
  })

  it("all IC levels are valid for IC", () => {
    for (const level of TRACK_LEVELS.IC) {
      expect(isValidLevelForTrack("IC", level)).toBe(true)
    }
  })

  it("all Lead levels are valid for Lead", () => {
    for (const level of TRACK_LEVELS.Lead) {
      expect(isValidLevelForTrack("Lead", level)).toBe(true)
    }
  })

  it("all M levels are valid for M", () => {
    for (const level of TRACK_LEVELS.M) {
      expect(isValidLevelForTrack("M", level)).toBe(true)
    }
  })

  it("an unknown trackKey always returns false", () => {
    expect(isValidLevelForTrack("X", "IC1")).toBe(false)
    expect(isValidLevelForTrack("", "M1")).toBe(false)
  })

  it("Lead-2 is valid for Lead but not for IC", () => {
    expect(isValidLevelForTrack("Lead", "Lead-2")).toBe(true)
    expect(isValidLevelForTrack("IC", "Lead-2")).toBe(false)
  })
})

describe("trackKeyForLevel", () => {
  it("resolves each ladder's levels to its own track", () => {
    expect(trackKeyForLevel("IC3")).toBe("IC")
    expect(trackKeyForLevel("Lead-2")).toBe("Lead")
    expect(trackKeyForLevel("M2")).toBe("M")
  })

  it("returns undefined for a level no ladder contains", () => {
    expect(trackKeyForLevel("Senior")).toBeUndefined()
    expect(trackKeyForLevel("")).toBeUndefined()
  })
})
