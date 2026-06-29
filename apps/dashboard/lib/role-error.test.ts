import { describe, expect, it } from "vitest"
import { isDuplicateRoleError } from "./role-error"

describe("isDuplicateRoleError", () => {
  it("recognizes the serialized roleExists code", () => {
    expect(
      isDuplicateRoleError(new Error("ConvexError: errors.roleExists at ..."))
    ).toBe(true)
  })

  it("does not match the family duplicate code", () => {
    expect(
      isDuplicateRoleError(
        new Error("ConvexError: errors.roleFamilyExists at ...")
      )
    ).toBe(false)
  })

  it("treats other failures as generic", () => {
    expect(isDuplicateRoleError(new Error("network down"))).toBe(false)
    expect(isDuplicateRoleError("not an error")).toBe(false)
    expect(isDuplicateRoleError(null)).toBe(false)
  })
})
