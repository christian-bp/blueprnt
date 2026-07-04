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
 * Build a calendar-validated YYYY-MM-DD string from numeric parts, or null.
 * Month must be 1..12 and the day must exist in that month (no Feb 30).
 */
function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

/**
 * Resolve a two-part day/month pair (slash or dot date) to [day, month] using
 * the Nordic day-first ambiguity policy (ADR-0010):
 *   - first component > 12  -> first is the day (day-first, unambiguous).
 *   - second component > 12 -> second is the day (US MM/DD reading).
 *   - both <= 12            -> day-first (a=day, b=month); ambiguous, flagged by
 *                             isAmbiguousDate so validate can warn.
 * Returns null when neither reading is a valid day/month split.
 */
function resolveDayMonth(a: number, b: number): [number, number] | null {
  if (a > 12 && b > 12) return null
  if (b > 12) return [b, a] // US MM/DD: a is month, b is day
  return [a, b] // Nordic day-first: a is day, b is month
}

// Excel date serials use the 1899-12-30 epoch. The plausible range keeps a
// salary-magnitude integer from being read as a date; ~40000-50000 spans
// roughly 2009-2036. Header-gated (only tried when the column header matched a
// date field) so a bare integer elsewhere stays an id.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const EXCEL_SERIAL_MIN = 40000
const EXCEL_SERIAL_MAX = 50000

/**
 * Parse a raw date string to a calendar-validated YYYY-MM-DD string.
 *
 * ADR-0010 (import format expansion, replaces the old ISO-8601-only contract):
 * accepts ISO YYYY-MM-DD, DD.MM.YYYY / D.M.YYYY, DD/MM/YYYY, YYYY/MM/DD, a
 * datetime with a space- or T-separated time suffix, a full personnummer prefix
 * (YYYYMMDD-NNNN), and (header-gated via opts.headerGated) the compact YYYYMMDD
 * and Excel serial forms, and (with opts.referenceYear) short personnummer
 * century expansion. Slash/dot dates default to Nordic day-first; see
 * resolveDayMonth. The engine never reads the clock: without referenceYear the
 * short-personnummer branch is disabled and returns null.
 */
export function parseDate(
  v: string,
  opts?: { headerGated?: boolean; referenceYear?: number }
): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Full personnummer prefix: YYYYMMDD-NNNN (no century expansion needed).
  const pnFull = /^(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(trimmed)
  if (pnFull) {
    return toIsoDate(Number(pnFull[1]), Number(pnFull[2]), Number(pnFull[3]))
  }

  // Short personnummer YYMMDD-NNNN with caller reference-year century expansion.
  // The engine never reads the clock; without referenceYear this branch is off.
  const pnShort = /^(\d{2})(\d{2})(\d{2})-\d{4}$/.exec(trimmed)
  if (pnShort) {
    if (opts?.referenceYear === undefined) return null
    const yy = Number(pnShort[1])
    const refCentury = Math.floor(opts.referenceYear / 100) * 100
    const refYY = opts.referenceYear % 100
    // A two-digit year in the future (relative to the reference) belongs to the
    // previous century (a birth year cannot be in the future).
    const year = yy > refYY ? refCentury - 100 + yy : refCentury + yy
    return toIsoDate(year, Number(pnShort[2]), Number(pnShort[3]))
  }

  if (opts?.headerGated) {
    // Compact YYYYMMDD (8 digits, no separators).
    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed)
    if (compact) {
      return toIsoDate(
        Number(compact[1]),
        Number(compact[2]),
        Number(compact[3])
      )
    }
    // Excel serial: a plausible-range integer -> date via the Excel epoch.
    if (/^\d+$/.test(trimmed)) {
      const serial = Number(trimmed)
      if (serial >= EXCEL_SERIAL_MIN && serial <= EXCEL_SERIAL_MAX) {
        const ms = EXCEL_EPOCH_UTC + serial * 86400000
        const d = new Date(ms)
        return toIsoDate(
          d.getUTCFullYear(),
          d.getUTCMonth() + 1,
          d.getUTCDate()
        )
      }
      return null
    }
  }

  // Strip a trailing time part (space- or T-separated) before ISO/year-first.
  const dateOnly = trimmed.replace(/[ T]\d{2}:\d{2}(:\d{2})?$/, "")

  // ISO YYYY-MM-DD.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  // Year-first slash YYYY/MM/DD.
  const yearFirst = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(dateOnly)
  if (yearFirst) {
    return toIsoDate(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3])
    )
  }

  // Dot date DD.MM.YYYY / D.M.YYYY.
  const dot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateOnly)
  if (dot) {
    const dm = resolveDayMonth(Number(dot[1]), Number(dot[2]))
    if (!dm) return null
    return toIsoDate(Number(dot[3]), dm[1], dm[0])
  }

  // Slash date DD/MM/YYYY.
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateOnly)
  if (slash) {
    const dm = resolveDayMonth(Number(slash[1]), Number(slash[2]))
    if (!dm) return null
    return toIsoDate(Number(slash[3]), dm[1], dm[0])
  }

  return null
}

/**
 * Report whether a slash/dot date is ambiguous under the Nordic day-first
 * policy: both day and month components are <= 12, so the US MM/DD reading was
 * also calendar-valid (ADR-0010). Plan C turns a true result into the
 * ambiguousDate validate warning. Returns false for ISO dates, unambiguous
 * slash/dot dates (a component > 12), and any value parseDate rejects.
 */
export function isAmbiguousDate(v: string): boolean {
  const trimmed = v.trim()
  const m = /^(\d{1,2})[./](\d{1,2})[./]\d{4}$/.exec(trimmed)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a > 12 || b > 12) return false
  // Both <= 12: ambiguous only if it actually parses to a valid date.
  return parseDate(trimmed) !== null
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
