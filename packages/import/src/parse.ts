// Value parsers / normalizers for the salary import engine.
// All functions are total: they return null on unparseable input and never throw.

import { fold } from "./fields.js"

// Known currency words that may appear as a trailing suffix in a money cell.
// Any other trailing word is treated as an error and makes the value unparseable.
const KNOWN_CURRENCY_WORDS = /\s+(kr|sek|nok|dkk|eur|gbp|usd)$/i

/**
 * Parse a raw money string to a plain number.
 * Strips space group separators and an optional trailing KNOWN currency word
 * (kr, sek, nok, dkk, eur, gbp, usd). An unknown trailing word makes the
 * value unparseable and returns null.
 * Examples: "94 500 kr" -> 94500, "52000" -> 52000
 */
export function parseMoney(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Strip a trailing known currency word, if present.
  // If the input ends with a word that is NOT in the known set, reject it.
  let working = trimmed
  if (/\s+[a-z]+$/i.test(working)) {
    if (!KNOWN_CURRENCY_WORDS.test(working)) return null
    working = working.replace(KNOWN_CURRENCY_WORDS, "")
  }

  // Remove all space separators and try to parse.
  const stripped = working.replace(/\s+/g, "").trim()

  if (!stripped) return null

  // Must consist entirely of digits (no decimals, no signs, per spec).
  if (!/^\d+$/.test(stripped)) return null

  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse a raw currency code to an uppercase string.
 * Example: " SEK " -> "SEK"
 */
export function parseCurrency(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.toUpperCase()
}

/**
 * Parse a percentage string to a number in [0, 100].
 * Accepts an optional trailing "%" character.
 * Decimals are accepted (e.g. "87.5" for a fractional FTE); range [0, 100] is enforced.
 * Returns null if out of range or unparseable.
 */
export function parsePercent(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/%$/, "").trim()
  if (!cleaned) return null

  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 100) return null

  return n
}

/**
 * Parse a gender cell value to the canonical Swedish label.
 * Uses fold() to normalize input before matching. Covers sv/en/nb/da/fi words
 * and English M/F. Numeric SCB/SAP codes (1 -> Man, 2 -> Kvinna) are resolved
 * ONLY when opts.allowNumericCodes is true (set by a gender-column-aware caller);
 * any other numeric code is ambiguous and returns null (flagged downstream).
 * The system stays binary: non-binary tokens and unrecognized values return null.
 * Returns "Man" | "Kvinna" | null.
 */
export function parseGender(
  v: string,
  opts?: { allowNumericCodes?: boolean }
): "Man" | "Kvinna" | null {
  const f = fold(v)
  if (!f) return null

  if (
    f === "man" ||
    f === "male" ||
    f === "m" ||
    f === "mann" || // nb
    f === "mand" || // da
    f === "mies" // fi
  ) {
    return "Man"
  }
  if (
    f === "kvinna" ||
    f === "female" ||
    f === "woman" ||
    f === "k" ||
    f === "f" ||
    f === "kvinne" || // nb
    f === "kvinde" || // da
    f === "nainen" // fi
  ) {
    return "Kvinna"
  }

  if (opts?.allowNumericCodes) {
    if (f === "1") return "Man"
    if (f === "2") return "Kvinna"
  }

  return null
}

/**
 * Parse a date string to a validated YYYY-MM-DD string.
 * Returns null if the format is wrong or the date is not a real calendar date.
 */
export function parseDate(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Strict YYYY-MM-DD format check.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [yearStr, monthStr, dayStr] = trimmed.split("-") as [
    string,
    string,
    string,
  ]
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  // Month must be 1..12.
  if (month < 1 || month > 12) return null

  // Use Date to validate the day-in-month. Month is 0-indexed in Date.
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return trimmed
}

/**
 * Parse a boolean-like string.
 * true:  ja, yes, true, kylla (fi)
 * false: nej, no, false, nei (nb), ei (fi)
 * else null. Input is folded so "Kyllä" matches "kylla".
 */
export function parseBool(v: string): boolean | null {
  const f = fold(v)
  if (!f) return null

  if (f === "ja" || f === "yes" || f === "true" || f === "kylla") return true
  if (f === "nej" || f === "no" || f === "false" || f === "nei" || f === "ei") {
    return false
  }

  return null
}

/**
 * True when v is an id-shaped value: pure integer, personnummer (\d{8}-\d{4}
 * or \d{6}-\d{4}), or a short alphanumeric code containing a digit. Mirrors
 * shape.ts isId so the string parser and the shape detector agree.
 */
function isIdShaped(t: string): boolean {
  if (/^\d+$/.test(t)) return true
  if (/^\d{8}-\d{4}$/.test(t)) return true
  if (/^\d{6}-\d{4}$/.test(t)) return true
  if (/^[a-zA-Z0-9]{1,20}$/.test(t) && /\d/.test(t)) return true
  return false
}

/**
 * Parse an id-shaped value to a verbatim trimmed string, preserving leading
 * zeros (00042 -> "00042"), alphanumeric codes (EMP001 -> "EMP001"), and
 * personnummer strings. Returns null for a non-id value or blank (id-01/03/04/05).
 */
export function parseStringId(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  return isIdShaped(trimmed) ? trimmed : null
}

/**
 * Parse a numeric ID string (e.g. employee number) to a plain integer.
 * Returns null for non-numeric, blank, or an integer beyond Number.isSafeInteger
 * (which would corrupt the value); such ids should be preserved via parseStringId
 * instead (id-07).
 */
export function parseIntId(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  if (!/^\d+$/.test(trimmed)) return null

  const n = Number(trimmed)
  if (!Number.isSafeInteger(n)) return null
  return n
}
