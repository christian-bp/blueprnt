import { describe, expect, it } from "vitest"
import { ROW_ISSUE_SEVERITY } from "./validate"
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

  it("every row code has a severity (the Record type enforces coverage)", () => {
    for (const code of ROW_CODES) {
      expect(["error", "notice"]).toContain(ROW_ISSUE_SEVERITY[code])
    }
  })

  it("interpretation heuristics are notices, unreadable values are errors", () => {
    // Notices never block: the source file may already be correct.
    expect(ROW_ISSUE_SEVERITY.fractionScaled).toBe("notice")
    expect(ROW_ISSUE_SEVERITY.ambiguousDate).toBe("notice")
    expect(ROW_ISSUE_SEVERITY.genderNameMismatch).toBe("notice")
    // Errors block until the file is fixed (or the value assigned in-app).
    expect(ROW_ISSUE_SEVERITY.duplicateId).toBe("error")
    expect(ROW_ISSUE_SEVERITY.unparsableMoney).toBe("error")
    expect(ROW_ISSUE_SEVERITY.negativeValue).toBe("error")
    expect(ROW_ISSUE_SEVERITY.nonNumericCode).toBe("error")
    expect(ROW_ISSUE_SEVERITY.raggedRow).toBe("error")
    expect(ROW_ISSUE_SEVERITY.unresolvedGender).toBe("error")
  })
})
