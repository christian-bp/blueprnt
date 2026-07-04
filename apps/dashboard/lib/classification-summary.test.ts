import { describe, expect, it } from "vitest"
import { countClassified } from "@/lib/classification-summary"

const conf = { currentAssignment: { levelSource: "confirmed" as const } }
const sug = { currentAssignment: { levelSource: "suggested" as const } }
const none = { currentAssignment: null }

describe("countClassified", () => {
  it("counts only confirmed assignments as classified", () => {
    expect(countClassified([conf, sug, none, conf])).toEqual({
      classified: 2,
      total: 4,
    })
  })
  it("handles an empty list", () => {
    expect(countClassified([])).toEqual({ classified: 0, total: 0 })
  })
})
