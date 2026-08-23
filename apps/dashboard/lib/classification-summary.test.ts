import { describe, expect, it } from "vitest"
import {
  classificationBreakdown,
  countClassified,
} from "@/lib/classification-summary"

const conf = { currentAssignment: { senioritySource: "confirmed" as const } }
const sug = { currentAssignment: { senioritySource: "suggested" as const } }
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

describe("classificationBreakdown", () => {
  it("splits people across the classify surface's three states", () => {
    expect(classificationBreakdown([conf, sug, none, conf, none])).toEqual({
      confirmed: 2,
      pending: 1,
      unclassified: 2,
      total: 5,
    })
  })
  it("agrees with countClassified on what confirmed means", () => {
    const people = [conf, sug, none, conf]
    expect(classificationBreakdown(people).confirmed).toBe(
      countClassified(people).classified
    )
  })
  it("handles an empty list", () => {
    expect(classificationBreakdown([])).toEqual({
      confirmed: 0,
      pending: 0,
      unclassified: 0,
      total: 0,
    })
  })
})
