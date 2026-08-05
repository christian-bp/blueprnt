import { describe, expect, it } from "vitest"
import {
  TRACK_SENIORITIES,
  isValidSeniorityForTrack,
  trackKeyForSeniority,
} from "./trackSeniorities"

describe("TRACK_SENIORITIES", () => {
  it("IC track has exactly IC1-IC5", () => {
    expect(TRACK_SENIORITIES.IC).toEqual(["IC1", "IC2", "IC3", "IC4", "IC5"])
  })

  it("Lead track has exactly Lead-1, Lead-2, Lead-3", () => {
    expect(TRACK_SENIORITIES.Lead).toEqual(["Lead-1", "Lead-2", "Lead-3"])
  })

  it("M track has exactly M1, M2, M3", () => {
    expect(TRACK_SENIORITIES.M).toEqual(["M1", "M2", "M3"])
  })
})

describe("isValidSeniorityForTrack", () => {
  it("IC3 is valid for IC", () => {
    expect(isValidSeniorityForTrack("IC", "IC3")).toBe(true)
  })

  it("Lead-3 is valid for Lead", () => {
    expect(isValidSeniorityForTrack("Lead", "Lead-3")).toBe(true)
  })

  it("M4 is invalid for M", () => {
    expect(isValidSeniorityForTrack("M", "M4")).toBe(false)
  })

  it("IC1 is invalid for Lead", () => {
    expect(isValidSeniorityForTrack("Lead", "IC1")).toBe(false)
  })

  it("all IC seniorities are valid for IC", () => {
    for (const seniority of TRACK_SENIORITIES.IC) {
      expect(isValidSeniorityForTrack("IC", seniority)).toBe(true)
    }
  })

  it("all Lead seniorities are valid for Lead", () => {
    for (const seniority of TRACK_SENIORITIES.Lead) {
      expect(isValidSeniorityForTrack("Lead", seniority)).toBe(true)
    }
  })

  it("all M seniorities are valid for M", () => {
    for (const seniority of TRACK_SENIORITIES.M) {
      expect(isValidSeniorityForTrack("M", seniority)).toBe(true)
    }
  })

  it("an unknown trackKey always returns false", () => {
    expect(isValidSeniorityForTrack("X", "IC1")).toBe(false)
    expect(isValidSeniorityForTrack("", "M1")).toBe(false)
  })

  it("Lead-2 is valid for Lead but not for IC", () => {
    expect(isValidSeniorityForTrack("Lead", "Lead-2")).toBe(true)
    expect(isValidSeniorityForTrack("IC", "Lead-2")).toBe(false)
  })
})

describe("trackKeyForSeniority", () => {
  it("resolves each ladder's seniorities to its own track", () => {
    expect(trackKeyForSeniority("IC3")).toBe("IC")
    expect(trackKeyForSeniority("Lead-2")).toBe("Lead")
    expect(trackKeyForSeniority("M2")).toBe("M")
  })

  it("returns undefined for a seniority no ladder contains", () => {
    expect(trackKeyForSeniority("Senior")).toBeUndefined()
    expect(trackKeyForSeniority("")).toBeUndefined()
  })
})
