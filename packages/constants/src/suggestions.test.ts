import { describe, expect, it } from "vitest"
import { SUGGESTION_KINDS } from "./suggestions"

describe("SUGGESTION_KINDS", () => {
  it("has unique, non-empty persisted values", () => {
    const values = Object.values(SUGGESTION_KINDS)
    expect(new Set(values).size).toBe(values.length)
    expect(values.every((value) => value.length > 0)).toBe(true)
  })
})
