// Value-shape heuristics: classify a column of raw CSV strings into a ValueShape.

import { type ValueShape, fold } from "./fields.js"

// Detectors operate on a single trimmed cell string.

/** Money: digit groups separated by spaces (grouped number), optional currency suffix.
 *  A bare integer with no spaces and no currency suffix does NOT match (falls through to percent/id).
 *  Accepts: "94 500 kr", "49 788", "1 234 567.00 eur", "50000 sek".
 *  Rejects: "100", "2026" (no space groups, no currency marker).
 */
function isMoney(cell: string): boolean {
  const t = cell.trim()
  const currencySuffix = /\s*(kr|sek|nok|dkk|eur)$/i
  const hasCurrency = currencySuffix.test(t)
  const numberPart = t.replace(currencySuffix, "").trim()
  // Number must contain at least one space (digit grouping) OR have a currency suffix
  const hasGroups = /\d\s+\d/.test(numberPart)
  if (!hasCurrency && !hasGroups) return false
  // Validate number part: digits, spaces, optional decimal
  return /^\d[\d\s]*(\.\d+)?$/.test(numberPart)
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
  "mann",
  "kvinna",
  "kvinde",
  "kvinne",
  "m",
  "k",
  "male",
  "female",
  "woman",
])

/** Gender: folded cell must be in the canonical gender set. */
function isGender(cell: string): boolean {
  return GENDER_VALUES.has(fold(cell.trim()))
}

const BOOLEAN_VALUES = new Set(["ja", "nej", "yes", "no", "true", "false"])

/** Boolean: folded cell must be in the canonical boolean set. */
function isBoolean(cell: string): boolean {
  return BOOLEAN_VALUES.has(fold(cell.trim()))
}

/** Id: pure integer (any length) or short alphanumeric code containing at least one digit.
 *  Pure-letter strings (like "Man", "xyz") are NOT ids; they fall to text.
 */
function isId(cell: string): boolean {
  const t = cell.trim()
  // Pure integer: any length (e.g. employee number, year)
  if (/^\d+$/.test(t)) return true
  // Short alphanumeric CODE: must contain at least one digit (e.g. "EMP001", "A4")
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
 * Returns `{ shape: "text", confidence: 0 }` when no detector clears the floor.
 */
export function classifyColumn(values: string[]): {
  shape: ValueShape
  confidence: number
} {
  const nonBlank = values.map((v) => v.trim()).filter((v) => v.length > 0)

  if (nonBlank.length === 0) {
    return { shape: "text", confidence: 0 }
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
    return { shape: "text", confidence: best.confidence }
  }

  return best
}
