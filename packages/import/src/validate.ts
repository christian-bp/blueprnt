// Data-quality and readiness validation for the salary import engine.
// Consumes the output of detectColumns and the raw parsed rows.

import type { DetectedMapping } from "./detect.js"
import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  type FieldTier,
} from "./fields.js"
import { parseGender, parseMoney } from "./parse.js"
import { ImportFormatError, tokenizeCsv } from "./tokenize.js"
import type { TokenizeResult } from "./tokenize.js"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RowIssueCode =
  | "duplicateId"
  | "unparsableMoney"
  | "nonNumericCode"
  | "unresolvedGender"
  | "genderNameMismatch"
  | "fractionScaled"
  | "ambiguousDate"
  | "negativeValue"

export type RowIssue = {
  /** 0-based index into the data rows array. */
  row: number
  code: RowIssueCode
  detail: string
}

export type ReadinessEntry = {
  key: CanonicalFieldKey
  tier: FieldTier
  mapped: boolean
}

/** A blocking signal that is not a missing canonical field. */
export type BlockingIssueCode = "invalidFileFormat"

export type ImportValidation = {
  /** One entry per canonical field: its tier and whether it is mapped. */
  readiness: ReadinessEntry[]
  /** Required fields absent from the mapping, plus blocking non-field signals. */
  blocking: (CanonicalFieldKey | BlockingIssueCode)[]
  /** Recommended fields absent from the mapping — soft warnings. */
  warnings: CanonicalFieldKey[]
  /** Per-row data-quality issues. */
  issues: RowIssue[]
  /**
   * Set to "invalidFileFormat" when the raw input was a binary spreadsheet
   * (tokenizeCsv threw ImportFormatError). Undefined for well-formed CSV.
   */
  fileFormatError?: BlockingIssueCode
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Optional heuristics for the gender/name mismatch check.
 * knownNames maps a first name (exact, case-sensitive) to the expected
 * canonical gender label ("Man" | "Kvinna"). When provided, a mismatch
 * between the cell's parsed gender and the name's expected gender is
 * reported as a soft genderNameMismatch issue. The list must remain short
 * and conservative — the heuristic must never hard-block.
 */
export type ValidateOpts = {
  knownNames?: Record<string, "Man" | "Kvinna">
}

// ---------------------------------------------------------------------------
// Pure helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * A money cell is negative when it starts with a minus or is fully
 * parenthesized (accounting convention). Negative money is unsupported
 * for V1 (parseMoney returns null); this lets validate name it instead
 * of reporting an opaque unparsableMoney.
 */
function isNegativeMoney(raw: string): boolean {
  const t = raw.trim()
  if (t === "") return false
  if (/^\(\s*\d[\d\s.,]*\)$/.test(t)) return true
  return /^-\s*\d/.test(t)
}

/**
 * A slash/dot date is ambiguous when both the first and second numeric
 * components are in 1..12 (either DD/MM or MM/DD is a valid calendar day).
 * Deterministic and reference-year-free: ambiguity depends only on the
 * two components, not the year.
 */
function isAmbiguousSlashDotDate(raw: string): boolean {
  const m = raw.trim().match(/^(\d{1,2})[./](\d{1,2})[./]\d{4}$/)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return a >= 1 && a <= 12 && b >= 1 && b <= 12
}

/**
 * A column is fractional when it has at least one non-blank cell and every
 * non-blank cell parses to a finite number <= 1.0 (comma or dot decimal).
 * Mirrors the fraction heuristic Plan B applies in classifyColumn/parsePercent.
 */
function isFractionColumn(rows: string[][], col: number): boolean {
  let sawValue = false
  for (const row of rows) {
    const raw = (row[col] ?? "").trim()
    if (raw === "") continue
    const n = Number(raw.replace(",", "."))
    if (!Number.isFinite(n)) return false
    if (n > 1) return false
    sawValue = true
  }
  return sawValue
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Validate a parsed CSV import against the detected column mapping.
 *
 * @param input   - The tokenized CSV (headers + data rows).
 * @param mapping - Output of detectColumns for the same input.
 * @param opts    - Optional heuristics (see ValidateOpts).
 * @returns       - Readiness summary and per-row data-quality issues.
 */
export function validateImport(
  input: { headers: string[]; rows: string[][] },
  mapping: DetectedMapping,
  opts: ValidateOpts
): ImportValidation {
  const { rows } = input
  const { map } = mapping

  // Build readiness: one entry per canonical field.
  const readiness: ReadinessEntry[] = CANONICAL_FIELDS.map((field) => ({
    key: field.key,
    tier: field.tier,
    mapped: field.key in map && map[field.key] !== undefined,
  }))

  // blocking: required fields not present in the mapping.
  const blocking: CanonicalFieldKey[] = readiness
    .filter((r) => r.tier === "required" && !r.mapped)
    .map((r) => r.key)

  // warnings: recommended fields not present in the mapping.
  const warnings: CanonicalFieldKey[] = readiness
    .filter((r) => r.tier === "recommended" && !r.mapped)
    .map((r) => r.key)

  // Per-row issues.
  const issues: RowIssue[] = []

  // Column indices for each field we will inspect (undefined if not mapped).
  const colOf = (key: CanonicalFieldKey): number | undefined =>
    map[key]?.columnIndex

  const externalRefCol = colOf("externalRef")
  const basicMonthlyCol = colOf("basicMonthly")
  const statisticalCodeCol = colOf("statisticalCode")
  const genderCol = colOf("gender")
  const firstNameCol = colOf("firstName")
  const ftePercentCol = colOf("ftePercent")
  const employmentStartDateCol = colOf("employmentStartDate")
  const birthDateCol = colOf("birthDate")

  // Determine once whether the ftePercent column is a fraction (0..1) column.
  const fteIsFraction =
    ftePercentCol !== undefined && isFractionColumn(rows, ftePercentCol)

  // Track seen externalRef values for duplicate detection.
  const seenRefs = new Map<string, number>() // value -> first row index

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] ?? []
    const cell = (col: number | undefined): string =>
      col !== undefined ? (row[col] ?? "").trim() : ""

    // duplicateId: same externalRef value within the batch.
    if (externalRefCol !== undefined) {
      const ref = cell(externalRefCol)
      if (ref !== "") {
        const firstSeen = seenRefs.get(ref)
        if (firstSeen !== undefined) {
          // Report the first occurrence too (if not already reported).
          const alreadyReported = issues.some(
            (i) => i.code === "duplicateId" && i.row === firstSeen
          )
          if (!alreadyReported) {
            issues.push({
              row: firstSeen,
              code: "duplicateId",
              detail: `externalRef "${ref}" appears more than once (first at row ${firstSeen})`,
            })
          }
          issues.push({
            row: rowIdx,
            code: "duplicateId",
            detail: `externalRef "${ref}" is a duplicate of row ${firstSeen}`,
          })
        } else {
          seenRefs.set(ref, rowIdx)
        }
      }
    }

    // unparsableMoney / negativeValue: non-blank basicMonthly cell.
    if (basicMonthlyCol !== undefined) {
      const raw = cell(basicMonthlyCol)
      if (raw !== "") {
        if (isNegativeMoney(raw)) {
          issues.push({
            row: rowIdx,
            code: "negativeValue",
            detail: `basicMonthly cell "${raw}" is a negative or parenthesized value`,
          })
        } else if (parseMoney(raw) === null) {
          issues.push({
            row: rowIdx,
            code: "unparsableMoney",
            detail: `basicMonthly cell "${raw}" is not a parseable money value`,
          })
        }
      }
    }

    // nonNumericCode: statisticalCode cell that is non-numeric when the field is mapped.
    if (statisticalCodeCol !== undefined) {
      const raw = cell(statisticalCodeCol)
      if (raw !== "" && !/^\d+$/.test(raw)) {
        issues.push({
          row: rowIdx,
          code: "nonNumericCode",
          detail: `statisticalCode cell "${raw}" is not numeric`,
        })
      }
    }

    // unresolvedGender: blank, unrecognized, non-binary, or ambiguous-numeric
    // gender cell when gender is mapped. The mapped column IS the gender column,
    // so numeric SCB/SAP codes 1/2 are allowed to resolve (allowNumericCodes:
    // true); parseGender still returns null for blank, unrecognized, non-binary,
    // and ambiguous numeric codes (0, 3, ...), which flag. The wizard collects a
    // manual Man/Kvinna assignment for the flagged rows downstream.
    if (genderCol !== undefined) {
      const raw = cell(genderCol)
      if (parseGender(raw, { allowNumericCodes: true }) === null) {
        issues.push({
          row: rowIdx,
          code: "unresolvedGender",
          detail: `gender cell "${raw}" is blank, unrecognized, or ambiguous`,
        })
      }
    }

    // genderNameMismatch: conservative soft heuristic, only when opts.knownNames is provided.
    if (
      opts.knownNames &&
      genderCol !== undefined &&
      firstNameCol !== undefined
    ) {
      const firstName = cell(firstNameCol)
      const parsedGender = parseGender(cell(genderCol))
      if (firstName && parsedGender !== null) {
        const expectedGender = opts.knownNames[firstName]
        if (expectedGender !== undefined && expectedGender !== parsedGender) {
          issues.push({
            row: rowIdx,
            code: "genderNameMismatch",
            detail: `firstName "${firstName}" is typically "${expectedGender}" but gender cell is "${parsedGender}"`,
          })
        }
      }
    }

    // fractionScaled: FTE column normalized x100 by the fraction heuristic.
    if (fteIsFraction && ftePercentCol !== undefined) {
      const raw = cell(ftePercentCol)
      if (raw !== "") {
        issues.push({
          row: rowIdx,
          code: "fractionScaled",
          detail: `ftePercent cell "${raw}" was scaled x100 (fraction column)`,
        })
      }
    }

    // ambiguousDate: slash/dot date parsed DD/MM while MM/DD was also valid.
    for (const dateCol of [employmentStartDateCol, birthDateCol]) {
      if (dateCol === undefined) continue
      const raw = cell(dateCol)
      if (raw !== "" && isAmbiguousSlashDotDate(raw)) {
        issues.push({
          row: rowIdx,
          code: "ambiguousDate",
          detail: `date cell "${raw}" is ambiguous (DD/MM assumed)`,
        })
      }
    }
  }

  return { readiness, blocking, warnings, issues }
}

/**
 * Tokenize-then-validate boundary. This is the single place where the
 * tokenizer's typed ImportFormatError is caught and turned into the
 * invalidFileFormat blocking signal, so the wizard can show
 * "export as CSV" instead of "missing columns".
 *
 * @param text      - Raw (already-decoded) CSV text.
 * @param mapping   - Detected mapping for the same input.
 * @param opts      - Validate options.
 * @param tokenized - Optional pre-tokenized TokenizeResult. When omitted, this
 *                    calls tokenizeCsv(text) and catches ImportFormatError.
 */
export function validateFile(
  text: string,
  mapping: DetectedMapping,
  opts: ValidateOpts,
  tokenized?: TokenizeResult
): ImportValidation {
  let input = tokenized
  if (input === undefined) {
    try {
      input = tokenizeCsv(text)
    } catch (err) {
      if (err instanceof ImportFormatError) {
        return {
          readiness: [],
          blocking: ["invalidFileFormat"],
          warnings: [],
          issues: [],
          fileFormatError: "invalidFileFormat",
        }
      }
      throw err
    }
  }
  // Task 6 widens this to `validateImport(input, mapping, opts, input.signals)`;
  // in this task validateImport still takes three args (signals optional).
  return validateImport(input, mapping, opts)
}
