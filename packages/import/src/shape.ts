// Value-shape heuristics: classify a column of raw CSV strings into a ValueShape.

import { type ValueShape, fold } from "./fields.js"
import { parseDate, parseMoney, parsePercent } from "./parse.js"

// Detectors operate on a single trimmed cell string.

/** Money (ADR-0010): matches exactly what parseMoney accepts, so the detector
 *  and parser can never disagree, WHILE preserving Plan A's postal-code / small
 *  grouped-id protection (SC-05, SC-02). A bare integer with no grouping and no
 *  currency marker is deliberately NOT money here (it falls through to id);
 *  a salary-header column of bare integers is upgraded by detect.ts via the
 *  header match, not by this shape. Accepts space/NBSP/thin-space grouping,
 *  comma-decimal, dot-decimal, dot-thousands, and currency prefix/suffix incl.
 *  the euro symbol and run-on suffixes.
 *
 *  IMPORTANT: widening parseMoney to strip space grouping means parseMoney("114 55")
 *  now succeeds (-> 11455). To keep "114 55"/"114 77" classified as `id`, this
 *  carries forward Plan A's postal-code / small-grouped-id protection: after
 *  confirming parseMoney succeeds, a SPACE-grouped value with no currency marker
 *  and no decimal must ALSO be a true thousands pattern (groups of exactly three
 *  after the first) to count as money; otherwise it stays `id`. This is a LOCK,
 *  not a delta: SC-05 and SC-02 must still resolve to `id` after this rewrite.
 */
function isMoney(cell: string): boolean {
  const t = cell.trim()
  if (!t) return false
  // A currency marker OR grouping OR a decimal tail is required; a bare integer
  // is left to id (so postal codes and employee numbers are not money).
  const hasCurrency =
    /(^(kr|sek|nok|dkk|eur|gbp|usd|€))|((kr|sek|nok|dkk|eur|gbp|usd|€)$)/i.test(
      t
    )
  // \s covers regular space, NBSP, thin-space; also match literal . and ,
  const hasGroupingOrDecimal = /[\s.,]/.test(t)
  if (!hasCurrency && !hasGroupingOrDecimal) return false

  // Must be parseMoney-parseable so detector and parser never disagree.
  if (parseMoney(t) === null) return false

  // Currency-marked values are unconditionally money.
  if (hasCurrency) return true

  // Carry forward Plan A's postal-code / small-grouped-id protection (SC-05, SC-02).
  // A SPACE-grouped value with NO dot/comma is money ONLY when it is a TRUE
  // thousands pattern: 1-3 digits, then one or more groups of EXACTLY three
  // separated by whitespace, tested against the space-grouped string. "114 55"
  // has a 2-digit second group so it is NOT a thousands pattern and stays `id`;
  // "52 000" and "1 234 567" match and stay money. A non-thousands space-grouped
  // value is rejected outright: a Swedish 3+2 postal code ungroups to 11455, so a
  // simple >10000 value floor alone cannot tell it from a salary; the thousands
  // PATTERN is the discriminator. (This corrects a latent gap in Plan A's isMoney,
  // whose floor branch would have wrongly rescued "114 55"; the SC-05/SC-02 LOCK
  // tests pin it.) (\s also matches NBSP/thin-space.)
  const hasSpaceGroup = /\d\s+\d/.test(t)
  const hasDotOrComma = /[.,]/.test(t)
  if (hasSpaceGroup && !hasDotOrComma) {
    // Pure space-grouped: money only in a true thousands pattern (1-3 lead, groups
    // of exactly 3). A 3+2 postal code fails this test and stays id (SC-05, SC-02).
    return /^\d{1,3}(\s\d{3})+$/.test(t)
  }

  if (hasSpaceGroup && hasDotOrComma) {
    // Space grouping + decimal tail (e.g. "45 000,00", "52 000.50"): money.
    return true
  }

  // No currency, no space group. Only a dot separator remains. A comma-only value
  // (e.g. "87,5", "62,5") without currency or space grouping is ambiguous with
  // percent/text and must NOT be classified as money (pp-16 non-fraction LOCK):
  // without a clear grouping or currency signal, a small comma-decimal is not
  // distinguishable from a percentage. Only a dot-thousands pattern (1-3 leading
  // digits followed by exactly 3 trailing digits, e.g. "52.000") is money here;
  // a pure dot-decimal (e.g. "52000.50") without currency has already been
  // flagged by `hasGroupingOrDecimal` and passes parseMoney, but without a
  // currency or space signal it is equally ambiguous. Restrict to dot-thousands.
  if (/[.,]/.test(t) && !/\s/.test(t) && !hasCurrency) {
    // Only dot-thousands patterns are unambiguously money without a currency marker
    // (e.g. "52.000" or "52.000,50"). The optional comma-decimal tail is covered by
    // the single pattern below; the separate noDecimal pre-strip is unnecessary.
    return /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)
  }

  return false
}

/** Percent / FTE (ADR-0010): matches parsePercent's non-fraction acceptance,
 *  a number in [0, 100] with an optional dot- or comma-decimal and an optional
 *  "%" with optional leading space. Bare small integers without "%" still match
 *  here (e.g. "80"); the fraction sub-case in classifyColumn handles <= 1.0
 *  columns separately.
 */
function isPercent(cell: string): boolean {
  return parsePercent(cell.trim()) !== null
}

/** Date (ADR-0010): matches parseDate's non-header-gated acceptance, plus the
 *  header-gated compact/serial forms when the caller passes headerGated. ISO,
 *  DD.MM.YYYY, DD/MM/YYYY, YYYY/MM/DD, and datetime are always recognized.
 *
 *  Personnummer strings (\d{8}-\d{4}, \d{6}-\d{4}) are intentionally EXCLUDED
 *  from the date shape: they are id-shaped and isId takes them, so a column of
 *  personnummer values classifies as `id`, not `date` (id-03, id-04). parseDate
 *  still accepts them for extraction from an id column; the shape stays `id`.
 */
function isDate(cell: string, headerGated: boolean): boolean {
  const t = cell.trim()
  // Personnummer patterns are id-shaped; exclude them from date classification.
  if (/^\d{8}-\d{4}$/.test(t) || /^\d{6}-\d{4}$/.test(t)) return false
  return parseDate(t, { headerGated }) !== null
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

type Detector = {
  shape: ValueShape
  fn: (cell: string, headerGated: boolean) => boolean
}

// Priority order: gender > boolean > money > percent > date > id.
// A shape earlier in the list beats a later one only if its ratio is strictly higher.
const DETECTORS: Detector[] = [
  { shape: "gender", fn: (c) => isGender(c) },
  { shape: "boolean", fn: (c) => isBoolean(c) },
  { shape: "money", fn: (c) => isMoney(c) },
  { shape: "percent", fn: (c) => isPercent(c) },
  { shape: "date", fn: (c, hg) => isDate(c, hg) },
  { shape: "id", fn: (c) => isId(c) },
]

const CONFIDENCE_FLOOR = 0.6

/**
 * Classify a column of raw CSV cell strings into a ValueShape.
 * Confidence = share of non-blank cells matching the winning shape (0..1).
 * fillRate = share of ALL cells that are non-blank (Plan A signal for sparse
 * columns). sampleSize = count of non-blank cells. When the winning shape is
 * percent and every non-blank cell is a number <= 1.0, the result carries
 * fraction: true so downstream can scale x100 with a fractionScaled warning
 * (ADR-0010). opts.headerGated unlocks the compact/serial/personnummer date
 * shapes for date-headed columns.
 * Returns `{ shape: "text", confidence: 0, fillRate }` when no detector clears
 * the floor.
 */
export function classifyColumn(
  values: string[],
  opts?: { headerGated?: boolean }
): {
  shape: ValueShape
  confidence: number
  fillRate: number
  sampleSize: number
  fraction?: boolean
} {
  const headerGated = opts?.headerGated ?? false
  const trimmed = values.map((v) => v.trim())
  const nonBlank = trimmed.filter((v) => v.length > 0)
  const sampleSize = nonBlank.length
  const fillRate = values.length === 0 ? 0 : sampleSize / values.length

  if (nonBlank.length === 0) {
    return { shape: "text", confidence: 0, fillRate, sampleSize }
  }

  let best: { shape: ValueShape; confidence: number } = {
    shape: "text",
    confidence: 0,
  }

  for (const { shape, fn } of DETECTORS) {
    const matched = nonBlank.filter((c) => fn(c, headerGated)).length
    const ratio = matched / nonBlank.length
    if (ratio > best.confidence) {
      best = { shape, confidence: ratio }
    }
  }

  if (best.confidence < CONFIDENCE_FLOOR) {
    return { shape: "text", confidence: best.confidence, fillRate, sampleSize }
  }

  if (best.shape === "percent") {
    const fraction = nonBlank.every((c) => {
      const n = Number(c.replace(",", "."))
      return Number.isFinite(n) && n <= 1
    })
    if (fraction) {
      return {
        shape: "percent",
        confidence: best.confidence,
        fillRate,
        sampleSize,
        fraction: true,
      }
    }
  }

  return {
    shape: best.shape,
    confidence: best.confidence,
    fillRate,
    sampleSize,
  }
}
