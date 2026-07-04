import { describe, expect, it } from "vitest"
import type {
  BlockingIssueCode,
  FileWarningCode,
  RowIssueCode,
} from "./validate"

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
  "raggedRow",
]
const BLOCKING_CODES: BlockingIssueCode[] = ["invalidFileFormat"]
const FILE_WARNING_CODES: FileWarningCode[] = ["noDelimiter", "mojibake"]

describe("issue code inventory", () => {
  it("row codes are unique", () => {
    expect(new Set(ROW_CODES).size).toBe(ROW_CODES.length)
  })
  it("blocking codes are unique", () => {
    expect(new Set(BLOCKING_CODES).size).toBe(BLOCKING_CODES.length)
  })
  it("file warning codes are unique", () => {
    expect(new Set(FILE_WARNING_CODES).size).toBe(FILE_WARNING_CODES.length)
  })
})
