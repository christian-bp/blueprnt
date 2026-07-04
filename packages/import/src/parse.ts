// Value parsers / normalizers for the salary import engine.
// All functions are total: they return null on unparseable input and never throw.

import { fold } from "./fields.js"

// Known currency markers that may appear as a prefix or suffix in a money cell.
// The suffix match uses \s* (not \s+) so a run-on suffix like "52000kr" parses (M41).
// The set includes the non-ASCII euro symbol (M40). Any OTHER trailing word makes
// the value unparseable.
const CURRENCY_SUFFIX = /\s*(kr|sek|nok|dkk|eur|gbp|usd|€)$/i
const CURRENCY_PREFIX = /^(kr|sek|nok|dkk|eur|gbp|usd|€)\s*/i
// A trailing alphabetic run that is NOT a known currency word (used to reject e.g. "94 500 bad").
const TRAILING_WORD = /[a-z]+$/i

/**
 * Normalize the numeric core of a money string (grouping + decimal already
 * stripped of currency markers) to a finite JS number, or null.
 *
 * Rules (ADR-0010, replaces the old integer-only contract):
 *   - Space / NBSP / thin-space grouping is stripped (all Unicode whitespace).
 *   - Comma is the decimal separator for sv/nb/da/fi ("52000,50" -> 52000.5).
 *   - A dot is a THOUSANDS separator when it precedes exactly three digits that
 *     are themselves followed by more digits or a comma-decimal ("52.000",
 *     "52.000,50"); a dot is a DECIMAL point when it precedes one or two
 *     trailing digits at the end of the number ("52000.50", "52000.00").
 *   - Negatives and parenthesized-negatives are out of scope for V1 and return
 *     null; Plan C surfaces them via the negativeValue row-issue code.
 */
function normalizeMoneyNumber(input: string): number | null {
  // Strip all whitespace grouping (regular space, NBSP U+00A0, thin space U+2009,
  // narrow NBSP U+202F are all matched by \s under the u-less regex except the
  // narrow ones, so strip explicitly too).
  const noGroups = input.replace(/[\s   ]/g, "")
  if (!noGroups) return null

  const hasComma = noGroups.includes(",")
  const hasDot = noGroups.includes(".")

  let normalized: string
  if (hasComma) {
    // Comma is always the decimal separator; any dots are thousands separators.
    // Reject more than one comma.
    if ((noGroups.match(/,/g) ?? []).length > 1) return null
    normalized = noGroups.replace(/\./g, "").replace(",", ".")
  } else if (hasDot) {
    const dotCount = (noGroups.match(/\./g) ?? []).length
    if (dotCount > 1) {
      // Multiple dots with no comma: treat every dot as a thousands separator
      // only if the shape is a strict thousands grouping (1-3 lead, groups of 3).
      if (!/^\d{1,3}(\.\d{3})+$/.test(noGroups)) return null
      normalized = noGroups.replace(/\./g, "")
    } else {
      // Exactly one dot. Thousands if it precedes exactly 3 trailing digits and
      // the lead is 1-3 digits ("52.000"); decimal if it precedes 1 or 2 digits.
      if (/^\d{1,3}\.\d{3}$/.test(noGroups)) {
        normalized = noGroups.replace(".", "")
      } else if (/^\d+\.\d{1,2}$/.test(noGroups)) {
        normalized = noGroups
      } else {
        return null
      }
    }
  } else {
    normalized = noGroups
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse a raw money string to a finite JS number.
 *
 * ADR-0010 (import format expansion): accepts space/NBSP/thin-space grouping,
 * comma-decimal ("52000,50"), dot-decimal ("52000.50"), dot-thousands
 * ("52.000", "52.000,50"), and a leading OR trailing currency marker
 * (kr/sek/nok/dkk/eur/gbp/usd word or the euro symbol), including run-on
 * suffixes ("52000kr"). Decimals are preserved to at least two fractional
 * digits. Returns null for unknown trailing words, interleaved letters, an
 * empty result after stripping, a malformed number, and (for V1) negative
 * and parenthesized-negative values.
 * Examples: "94 500 kr" -> 94500, "45 250,75 kr" -> 45250.75,
 *   "SEK 52000" -> 52000, "52.000,50" -> 52000.5, "52000kr" -> 52000.
 */
export function parseMoney(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Strip a leading currency marker if present (M35, P3).
  let working = trimmed.replace(CURRENCY_PREFIX, "")

  // Strip a trailing currency marker if present; reject any OTHER trailing word.
  if (CURRENCY_SUFFIX.test(working)) {
    working = working.replace(CURRENCY_SUFFIX, "")
  } else if (TRAILING_WORD.test(working)) {
    return null
  }

  working = working.trim()
  if (!working) return null

  return normalizeMoneyNumber(working)
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
 * Parse a percentage / FTE string to a number in [0, 100].
 *
 * ADR-0010 (import format expansion): accepts dot- OR comma-decimal, an
 * optional trailing "%" with an optional leading space ("80 %", "87,5%").
 * The "%" is stripped first, then a comma is normalized to a dot.
 *
 * Fraction mode is a COLUMN-LEVEL decision made by the shape detector, not by
 * a single cell: when the caller passes { fraction: true } (because every
 * non-blank cell in the column was <= 1.0), the parsed value is multiplied by
 * 100 ("0.8" -> 80, "1.0" -> 100, "0,8" -> 80) before the range check. The
 * range [0, 100] is enforced after any scaling.
 * Returns null if out of range or unparseable.
 */
export function parsePercent(
  v: string,
  opts?: { fraction?: boolean }
): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Strip a trailing "%" (with optional leading space), then comma-to-dot.
  const cleaned = trimmed.replace(/\s*%$/, "").trim().replace(",", ".")
  if (!cleaned) return null
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null

  let n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  if (opts?.fraction) n = n * 100
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
 * or \d{6}-\d{4}), or a short alphanumeric code containing a digit.
 * Intentionally stricter than shape.ts isId: this function does NOT accept
 * space-grouped non-thousands digit strings (e.g. "114 77") that shape.ts
 * isId accepts for shape classification. The parser requires a fully
 * id-shaped token; ambiguous space-grouped values are rejected here.
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
