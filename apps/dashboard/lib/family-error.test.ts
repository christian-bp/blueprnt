import { describe, expect, it } from "vitest"
import { isDuplicateFamilyError } from "./family-error"

describe("isDuplicateFamilyError", () => {
  it("recognizes the serialized roleFamilyExists code", () => {
    expect(
      isDuplicateFamilyError(
        new Error("ConvexError: errors.roleFamilyExists at ...")
      )
    ).toBe(true)
  })

  it("treats other failures as generic", () => {
    expect(isDuplicateFamilyError(new Error("network down"))).toBe(false)
    expect(isDuplicateFamilyError("not an error")).toBe(false)
    expect(isDuplicateFamilyError(null)).toBe(false)
  })
})
