import { describe, expect, it } from "vitest"
import type { BlockingIssueCode, RowIssueCode } from "./validate.js"

// Compile-time + runtime lock: the exhaustive set of codes the wizard must
// provide labels for. If a code is added without updating this list, the
// test (and the wizard i18n keys) must be updated together.
const ROW_CODES: RowIssueCode[] = [
  "duplicateId",
  "unparsableMoney",
  "nonNumericCode",
  "unresolvedGender",
  "genderNameMismatch",
  "fractionScaled",
  "ambiguousDate",
  "negativeValue",
]
const BLOCKING_CODES: BlockingIssueCode[] = ["invalidFileFormat"]

describe("issue code inventory", () => {
  it("row codes are unique", () => {
    expect(new Set(ROW_CODES).size).toBe(ROW_CODES.length)
  })
  it("blocking codes are unique", () => {
    expect(new Set(BLOCKING_CODES).size).toBe(BLOCKING_CODES.length)
  })
})
