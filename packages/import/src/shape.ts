// Value-shape heuristics: classify a column of raw CSV strings into a ValueShape.

import { type ValueShape, fold } from "./fields.js"

// Detectors operate on a single trimmed cell string.

/** Money: a currency-marked number, OR a space-grouped number in a true thousands
 *  pattern (groups of exactly three after the first). A 3+2 group (postal code
 *  "114 55") or a small grouped id ("114 77") is NOT money without a currency
 *  marker (SC-05, SC-02). The thousands pattern is the SOLE discriminator for
 *  space-grouped values: a value floor cannot separate a 3+2 postal code (11455)
 *  from a salary, so there is no floor branch.
 *  Note: comma/dot-decimal number bodies are Plan B; this keeps the integer body.
 */
function isMoney(cell: string): boolean {
  const t = cell.trim()
  const currencySuffix = /\s*(kr|sek|nok|dkk|eur)$/i
  const hasCurrency = currencySuffix.test(t)
  const numberPart = t.replace(currencySuffix, "").trim()

  // Body must be digits with optional space groups and an optional dot-decimal tail.
  if (!/^\d[\d\s]*(\.\d+)?$/.test(numberPart)) return false

  if (hasCurrency) return true

  const hasGroups = /\d\s+\d/.test(numberPart)
  if (!hasGroups) return false

  // A space-grouped number is money only in a true thousands pattern: 1-3 digits,
  // then one or more groups of exactly three. A 3+2 group (postal code) is not,
  // and no value floor is applied (11455 must not rescue "114 55").
  return /^\d{1,3}(\s\d{3})+(\.\d+)?$/.test(numberPart)
}

/** Percent: integer 0-100, optional % sign. */
function isPercent(cell: string): boolean {
  const m = /^(\d{1,3})%?$/.exec(cell.trim())
  if (!m) return false
  const n = Number(m[1])
  return n >= 0 && n <= 100
}

/** Date: strict YYYY-MM-DD. */
function isDate(cell: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(cell.trim())
}

const GENDER_VALUES = new Set([
  "man",
  "kvinna",
  "m",
  "k",
  "f",
  "male",
  "female",
  "woman",
  "mann", // nb
  "kvinne", // nb
  "mand", // da
  "kvinde", // da
  "mies", // fi
  "nainen", // fi
])

/** Gender: folded cell must be in the canonical gender set. */
function isGender(cell: string): boolean {
  return GENDER_VALUES.has(fold(cell.trim()))
}

const BOOLEAN_VALUES = new Set([
  "ja",
  "nej",
  "nei", // nb
  "kylla", // fi (folds from "kyllä")
  "ei", // fi
  "yes",
  "no",
  "true",
  "false",
])

/** Boolean: folded cell must be in the canonical boolean set. */
function isBoolean(cell: string): boolean {
  return BOOLEAN_VALUES.has(fold(cell.trim()))
}

/** Id: pure integer (any length), short alphanumeric code with a digit, a
 *  Swedish/Nordic personnummer (\d{8}-\d{4} or \d{6}-\d{4}) (id-03, id-04),
 *  or a space-grouped digit string that is NOT a thousands pattern (e.g. Swedish
 *  postal codes "114 55", grouped employee numbers "114 77"). Space-grouped values
 *  in a true thousands pattern are handled by isMoney instead.
 *  Pure-letter strings are NOT ids; they fall to text.
 */
function isId(cell: string): boolean {
  const t = cell.trim()
  if (/^\d+$/.test(t)) return true
  if (/^\d{8}-\d{4}$/.test(t)) return true
  if (/^\d{6}-\d{4}$/.test(t)) return true
  // Space-grouped digit-only strings that are NOT a thousands pattern (SC-05, SC-02).
  // Thousands pattern ^\d{1,3}(\s\d{3})+$ is money; anything else with spaces is an id.
  if (
    /^[\d\s]+$/.test(t) &&
    /\d\s+\d/.test(t) &&
    !/^\d{1,3}(\s\d{3})+$/.test(t)
  )
    return true
  if (/^[a-zA-Z0-9]{1,20}$/.test(t) && /\d/.test(t)) return true
  return false
}

type Detector = { shape: ValueShape; fn: (cell: string) => boolean }

// Priority order: gender > boolean > money > percent > date > id.
// A shape earlier in the list beats a later one only if its ratio is strictly higher.
// But since we pick highest-ratio above 0.6, priority only breaks strict ties.
const DETECTORS: Detector[] = [
  { shape: "gender", fn: isGender },
  { shape: "boolean", fn: isBoolean },
  { shape: "money", fn: isMoney },
  { shape: "percent", fn: isPercent },
  { shape: "date", fn: isDate },
  { shape: "id", fn: isId },
]

const CONFIDENCE_FLOOR = 0.6

/**
 * Classify a column of raw CSV cell strings into a ValueShape.
 * Confidence = share of non-blank cells matching the winning shape (0..1).
 * fillRate = share of non-blank cells over total (0..1).
 * sampleSize = count of non-blank cells.
 * Returns `{ shape: "text", confidence: 0, fillRate: 0, sampleSize: 0 }` when
 * the column is all-blank, or `{ shape: "text", ... }` when no detector clears
 * the confidence floor.
 */
export function classifyColumn(values: string[]): {
  shape: ValueShape
  confidence: number
  fillRate: number
  sampleSize: number
} {
  const nonBlank = values.map((v) => v.trim()).filter((v) => v.length > 0)
  const total = values.length
  const sampleSize = nonBlank.length
  const fillRate = total === 0 ? 0 : sampleSize / total

  if (nonBlank.length === 0) {
    return { shape: "text", confidence: 0, fillRate, sampleSize }
  }

  let best: { shape: ValueShape; confidence: number } = {
    shape: "text",
    confidence: 0,
  }

  for (const { shape, fn } of DETECTORS) {
    const matched = nonBlank.filter(fn).length
    const ratio = matched / nonBlank.length
    if (ratio > best.confidence) {
      best = { shape, confidence: ratio }
    }
  }

  if (best.confidence < CONFIDENCE_FLOOR) {
    return { shape: "text", confidence: best.confidence, fillRate, sampleSize }
  }

  return { ...best, fillRate, sampleSize }
}
