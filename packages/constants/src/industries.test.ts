import { describe, expect, it } from "vitest"
import { INDUSTRY_KEYS, clampIndustry } from "./industries"

describe("industries", () => {
  it("keeps known industries and clamps unknown ones to other", () => {
    for (const industry of INDUSTRY_KEYS) {
      expect(clampIndustry(industry)).toBe(industry)
    }
    expect(clampIndustry("spaceMining")).toBe("other")
    expect(clampIndustry(undefined)).toBe("other")
  })
})
