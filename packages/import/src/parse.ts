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
 * Uses fold() to normalize input before matching synonyms.
 * Returns "Man" | "Kvinna" | null.
 */
export function parseGender(v: string): "Man" | "Kvinna" | null {
  const f = fold(v)
  if (!f) return null

  if (f === "man" || f === "male" || f === "m") return "Man"
  if (f === "kvinna" || f === "female" || f === "woman" || f === "k") {
    return "Kvinna"
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
 * ja/yes/true -> true, nej/no/false -> false, else null.
 */
export function parseBool(v: string): boolean | null {
  const lower = v.trim().toLowerCase()
  if (!lower) return null

  if (lower === "ja" || lower === "yes" || lower === "true") return true
  if (lower === "nej" || lower === "no" || lower === "false") return false

  return null
}

/**
 * Parse a numeric ID string (e.g. employee number) to a plain integer.
 * Returns null for any non-numeric or blank input.
 */
export function parseIntId(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  if (!/^\d+$/.test(trimmed)) return null

  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
