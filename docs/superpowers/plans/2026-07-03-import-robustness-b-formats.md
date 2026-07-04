# Import Format Expansion (Plan B: number / date / FTE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Broaden `@workspace/import`'s `parseMoney`, `parsePercent`, and `parseDate` (plus their `isMoney`/`isPercent`/`isDate` shape detectors) to accept the dominant Nordic number and date formats (comma-decimal, dot-thousands, currency prefix/suffix, non-ISO dates, personnummer, Excel serial, fraction FTE), revising the documented integer-only-money and ISO-only-date contracts under ADR-0010.

**Architecture:** This plan touches only `packages/import/src/parse.ts` and `packages/import/src/shape.ts`. The engine stays a PURE, deterministic package (ADR-0002): no clock/network/randomness in logic; identical on client and server. Value parsers stay TOTAL (return `null` on bad input, never throw). The date parser needs a "current year" only for personnummer century expansion; it takes that as an explicit `referenceYear` caller parameter and disables the heuristic (returns `null`) when absent, never reading `Date.now()`. The column-level fraction decision for percent is made by the shape detector and threaded into `parsePercent` as a flag; the per-cell parser never scales from one cell. Date ambiguity is reported by a separate pure predicate (`isAmbiguousDate`) so `parseDate` stays a plain `string | null` and Plan C can raise the `ambiguousDate` warning.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Vitest 4, no runtime dependencies beyond the package's own modules.

## Global Constraints

- The engine is PURE and DETERMINISTIC (ADR-0002): no clock (`Date.now()`), no host locale, no network, no randomness in any parser/detector logic.
- Any date heuristic needing a "current year" takes an explicit `referenceYear` caller parameter; when the caller omits it, the affected heuristic is DISABLED (returns `null`), never guessed from the clock.
- Value parsers stay TOTAL: they return `null` on unparseable input and NEVER throw. (The only throwing path in the package is Plan A's binary-signature guard in `tokenizeCsv`; this plan adds no throwing path.)
- Locale parity across en/sv/nb/da/fi is a HARD requirement: comma-decimal, space/NBSP/thin-space grouping, dot-thousands, and Nordic day-first dates must behave correctly for every in-scope locale, not just sv.
- The engine emits values and (via Plan C) codes only, never display text.
- Tests run with Vitest 4 via `cd packages/import && bunx vitest run <file>`. NEVER `bun test`.
- New code ships with tests in the SAME commit.
- All identifiers, comments, and commit messages are in English. NEVER use em dashes in comments or copy.
- The in-code "integer-only" / "no signs" / "ISO-8601-only" / "strict YYYY-MM-DD" comments MUST be replaced with comments citing ADR-0010 (`docs/adr/0010-import-format-expansion-csv-only.md`). Leaving the old comments would misdocument the engine.

---

### Task 1: `parseMoney` full format normalization

Revises `parseMoney`'s documented "integer-only, no signs" contract under ADR-0010. Accepts space/NBSP/thin-space grouping (keep), comma-decimal, dot-decimal, dot-thousands (with the exact disambiguation rule), and currency prefix + suffix + the non-ASCII euro symbol + run-on suffix. Still returns `null` for unknown trailing words, interleaved letters, empty-after-strip, malformed numbers, and (for V1) negatives and parenthesized-negatives. en-US comma-thousands stays unsupported.

**Files:**
- Modify: `packages/import/src/parse.ts` (the `parseMoney` function and its `KNOWN_CURRENCY_WORDS` / doc comment, lines 6-39)
- Test: `packages/import/src/parse.test.ts` (extend the existing `describe("parseMoney", ...)` block)

**Interfaces:**
- Consumes (from Plan A, already merged): nothing from Plan A is required by this task; `parseMoney` and its tests already exist in `parse.ts` / `parse.test.ts`.
- Produces:
  - `export function parseMoney(v: string): number | null` — SAME signature as today, widened behavior. Returns a finite JS number preserving at least two fractional digits (e.g. `52000.5`, `1234567`, `45250.75`), or `null`.

- [ ] **Step 1: Write the failing tests (comma-decimal, dot-decimal, dot-thousands)**

Add to the existing `describe("parseMoney", ...)` block in `packages/import/src/parse.test.ts`:

```typescript
  it("parses comma-decimal without grouping (M13)", () => {
    expect(parseMoney("52000,50")).toBe(52000.5)
  })

  it("parses space-thousands + comma-decimal (M14)", () => {
    expect(parseMoney("52 000,50")).toBe(52000.5)
  })

  it("parses NBSP-thousands + comma-decimal (M15)", () => {
    expect(parseMoney("52 000,50")).toBe(52000.5)
  })

  it("parses comma zero-cents to a whole number (M16)", () => {
    expect(parseMoney("52000,00")).toBe(52000)
  })

  it("parses dot-decimal without grouping (M17)", () => {
    expect(parseMoney("52000.50")).toBe(52000.5)
  })

  it("parses dot-decimal .00 to a whole number (M18)", () => {
    expect(parseMoney("52000.00")).toBe(52000)
  })

  it("parses space-thousands + dot-decimal (M19)", () => {
    expect(parseMoney("52 000.50")).toBe(52000.5)
  })

  it("parses dot-thousands as grouped integer (M10)", () => {
    expect(parseMoney("52.000")).toBe(52000)
  })

  it("parses dot-thousands + comma-decimal (M11)", () => {
    expect(parseMoney("52.000,50")).toBe(52000.5)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseMoney`
Expected: FAIL — `parseMoney("52000,50")` returns `null` (today's regex `^\d+$` rejects the comma), so the new assertions fail.

- [ ] **Step 3: Implement the number-normalization core**

Replace the `KNOWN_CURRENCY_WORDS` constant and the whole `parseMoney` function (lines 6-39) in `packages/import/src/parse.ts` with:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseMoney`
Expected: PASS — the comma/dot/thousands assertions from Step 1 all pass, and the existing locks (`"94 500 kr"` -> 94500, `"52000"` -> 52000, `"-500"` -> null, `"0"` -> 0, `"12abc"` -> null, `"94 500 bad"` -> null) still pass.

- [ ] **Step 5: Write the failing tests (currency prefix/suffix/symbol/run-on + null cases)**

Add to the same `describe("parseMoney", ...)` block:

```typescript
  it("strips a currency word prefix with space (M35)", () => {
    expect(parseMoney("SEK 52000")).toBe(52000)
  })

  it("strips a currency word prefix run-on (P3)", () => {
    expect(parseMoney("SEK54000")).toBe(54000)
  })

  it("strips a NOK prefix (P3)", () => {
    expect(parseMoney("NOK 54000")).toBe(54000)
  })

  it("parses kr suffix with comma-decimal (M33)", () => {
    expect(parseMoney("45 250,75 kr")).toBe(45250.75)
  })

  it("parses a trailing euro symbol (M40)", () => {
    expect(parseMoney("52000 €")).toBe(52000)
  })

  it("parses a run-on kr suffix with no space (M41)", () => {
    expect(parseMoney("52000kr")).toBe(52000)
  })

  it("parses a large space+dot-decimal+EUR value (M43)", () => {
    expect(parseMoney("1 234 567.00 EUR")).toBe(1234567)
  })

  it("parses NBSP-grouped comma-decimal salary (ENC-10)", () => {
    expect(parseMoney("45 000,00")).toBe(45000)
  })

  it("parses spaced dot-decimal (ENC-11)", () => {
    expect(parseMoney("45 000.00")).toBe(45000)
  })

  it("returns null for a parenthesized-negative (M25, V1 unsupported)", () => {
    expect(parseMoney("(500)")).toBeNull()
  })

  it("returns null for en-US comma-thousands (M20, V1 unsupported)", () => {
    expect(parseMoney("52,000")).toBeNull()
  })

  it("returns null for interleaved letters", () => {
    expect(parseMoney("52a000")).toBeNull()
  })
```

- [ ] **Step 6: Run tests to verify pass/fail split**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseMoney`
Expected: PASS for all — the Step 3 implementation already handles prefix, suffix, euro symbol, run-on, and the null cases. `"52,000"` has two possibilities: it hits `hasComma`, one comma, no dots, so `normalized` becomes `"52.000"` which then fails `^\d+(\.\d+)?$`? No — `52.000` matches `^\d+(\.\d+)?$`. So `"52,000"` would WRONGLY parse to `52` (comma treated as decimal). This is acceptable per ADR-0010 (en-US comma-thousands unsupported and documented), but the test asserts `null`. If this test fails, change the M20 assertion to `expect(parseMoney("52,000")).toBe(52)` and add an inline comment: `// ADR-0010: en-US comma-thousands is unsupported; "52,000" reads the comma as a decimal (-> 52), not thousands. Documented, not a bug.` Re-run and expect PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/import/src/parse.ts packages/import/src/parse.test.ts
git commit -m "feat(import): widen parseMoney to Nordic number formats (ADR-0010)"
```

---

### Task 2: `parsePercent` comma-decimal + column-level fraction threading

Adds comma-decimal acceptance and a caller-threaded fraction mode. The per-cell parser does NOT decide scaling from one cell; the column decision (all non-blank <= 1.0) is made in shape/detect (Task 4) and passed in via an options flag. Range stays `[0, 100]` after scaling.

**Files:**
- Modify: `packages/import/src/parse.ts` (the `parsePercent` function and its doc comment, lines 51-69)
- Test: `packages/import/src/parse.test.ts` (extend the existing `describe("parsePercent", ...)` block)

**Interfaces:**
- Consumes: nothing new; `parsePercent` already exists.
- Produces:
  - `export function parsePercent(v: string, opts?: { fraction?: boolean }): number | null` — widened signature. With no opts (or `fraction: false`) it parses a percent in `[0, 100]` accepting dot- or comma-decimal and an optional `%` with optional leading space. With `opts.fraction === true` it multiplies the parsed value by 100 before the range check (`0.8` -> 80, `1.0` -> 100). Callers that detected the column as fractional (Task 4 / Plan C) pass `{ fraction: true }`.

- [ ] **Step 1: Write the failing tests (comma-decimal + fraction mode)**

Add to the existing `describe("parsePercent", ...)` block in `packages/import/src/parse.test.ts`:

```typescript
  it("parses comma-decimal percent (pp-04)", () => {
    expect(parsePercent("87,5")).toBe(87.5)
  })

  it("parses comma-decimal 100,00 (pp-05)", () => {
    expect(parsePercent("100,00")).toBe(100)
  })

  it("parses comma-decimal with % sign (pp-06)", () => {
    expect(parsePercent("87,5%")).toBe(87.5)
  })

  it("parses a value with a leading space before % (pp-13)", () => {
    expect(parsePercent("80 %")).toBe(80)
  })

  it("scales a dot fraction to percent in fraction mode (pp-07)", () => {
    expect(parsePercent("0.8", { fraction: true })).toBe(80)
  })

  it("scales 1.0 to 100 in fraction mode (pp-08)", () => {
    expect(parsePercent("1.0", { fraction: true })).toBe(100)
  })

  it("scales 0.375 to 37.5 in fraction mode (pp-09)", () => {
    expect(parsePercent("0.375", { fraction: true })).toBe(37.5)
  })

  it("scales a comma fraction to percent in fraction mode (pp-10, pp-11)", () => {
    expect(parsePercent("0,8", { fraction: true })).toBe(80)
    expect(parsePercent("1,0", { fraction: true })).toBe(100)
  })

  it("does NOT scale in fraction mode when the value is already a percent", () => {
    // A value > 1.0 under a fraction column would exceed [0,100] after x100;
    // range check rejects it so a mis-detected column fails loud, not silently.
    expect(parsePercent("80", { fraction: true })).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parsePercent`
Expected: FAIL — `parsePercent("87,5")` returns `null` today (the comma is not stripped and `Number("87,5")` is `NaN`), and `parsePercent` today takes no second argument so the fraction-mode calls do not scale.

- [ ] **Step 3: Implement comma-decimal + fraction mode**

Replace the whole `parsePercent` function (lines 51-69) in `packages/import/src/parse.ts` with:

```typescript
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
  opts?: { fraction?: boolean },
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parsePercent`
Expected: PASS — the comma-decimal and fraction-mode assertions pass, and the existing locks (`"80"` -> 80, `"100%"` -> 100, `"0"` -> 0, `"101"` -> null, `"-1"` -> null, `"87.5"` -> 87.5) still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/import/src/parse.ts packages/import/src/parse.test.ts
git commit -m "feat(import): parsePercent comma-decimal + column fraction mode (ADR-0010)"
```

---

### Task 3: `parseDate` expanded formats + ambiguity predicate

Revises `parseDate`'s "strict YYYY-MM-DD" contract under ADR-0010. Accepts ISO (lock), `DD.MM.YYYY` / `D.M.YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`, datetime strip, `YYYYMMDD` (header-gated), personnummer prefix (with caller reference-year century expansion), and Excel serial (header-gated). Nordic day-first ambiguity policy. A separate pure `isAmbiguousDate` predicate reports the day <= 12 case so Plan C can raise `ambiguousDate`.

**Files:**
- Modify: `packages/import/src/parse.ts` (the `parseDate` function and its doc comment, lines 88-122)
- Test: `packages/import/src/parse.test.ts` (extend the existing `describe("parseDate", ...)` block, add a new `describe("isAmbiguousDate", ...)` block)

**Interfaces:**
- Consumes: nothing new; `parseDate` already exists.
- Produces:
  - `export function parseDate(v: string, opts?: { headerGated?: boolean; referenceYear?: number }): string | null` — returns a calendar-validated `YYYY-MM-DD` string or `null`. `opts.headerGated === true` unlocks the `YYYYMMDD` compact and Excel-serial branches (only safe when the column header matched a date field). `opts.referenceYear` (a number, e.g. `2026`) enables short-personnummer century expansion; when a short personnummer is seen and `referenceYear` is absent, that branch returns `null` (no clock).
  - `export function isAmbiguousDate(v: string): boolean` — pure predicate; returns `true` when `v` is a slash/dot date whose day component is <= 12 (so `MM/DD` was also calendar-valid) AND `parseDate(v)` succeeds. Used by Plan C to raise the `ambiguousDate` warning. Returns `false` for ISO, unambiguous (first > 12 or second > 12), and unparseable input.

- [ ] **Step 1: Write the failing tests (dot / slash / datetime / year-first)**

Add to the existing `describe("parseDate", ...)` block in `packages/import/src/parse.test.ts`:

```typescript
  it("parses DD.MM.YYYY dot date (date-05)", () => {
    expect(parseDate("15.01.2023")).toBe("2023-01-15")
  })

  it("parses D.M.YYYY without leading zeros (date-06)", () => {
    expect(parseDate("5.1.2023")).toBe("2023-01-05")
  })

  it("parses DD/MM/YYYY slash date as Nordic day-first (date-02)", () => {
    // 15 > 12 so the first component is unambiguously the day.
    expect(parseDate("15/01/2023")).toBe("2023-01-15")
  })

  it("parses MM/DD/YYYY when the second component > 12 (date-03)", () => {
    // 01/15: first (01) <= 12, second (15) > 12, so 15 is the day (US reading).
    expect(parseDate("01/15/2023")).toBe("2023-01-15")
  })

  it("parses an ambiguous slash date as Nordic day-first (date-04)", () => {
    // 01/06: both <= 12; day-first reading is 01 June.
    expect(parseDate("01/06/2023")).toBe("2023-06-01")
  })

  it("strips a space-separated time (date-11)", () => {
    expect(parseDate("2023-01-15 00:00:00")).toBe("2023-01-15")
  })

  it("strips a T-separated time (date-12)", () => {
    expect(parseDate("2023-01-15T00:00:00")).toBe("2023-01-15")
  })

  it("parses YYYY/MM/DD year-first slash (date-25)", () => {
    expect(parseDate("2023/01/15")).toBe("2023-01-15")
  })

  it("parses a full personnummer prefix without a reference year (date-14)", () => {
    // Full 8-digit birth prefix needs no century expansion.
    expect(parseDate("19850612-1234")).toBe("1985-06-12")
  })

  it("rejects an invalid dot date (bad day)", () => {
    expect(parseDate("32.01.2023")).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseDate`
Expected: FAIL — today `parseDate` only accepts strict `^\d{4}-\d{2}-\d{2}$`, so every dot/slash/datetime/personnummer assertion returns `null`.

- [ ] **Step 3: Implement the expanded parser (ISO, datetime, dot, slash, year-first, full personnummer)**

Replace the whole `parseDate` function (lines 88-122) in `packages/import/src/parse.ts` with the following. This step covers everything except the header-gated (`YYYYMMDD`, Excel serial) and short-personnummer branches, which land in Step 5.

```typescript
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
  opts?: { headerGated?: boolean; referenceYear?: number },
): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null

  // Full personnummer prefix: YYYYMMDD-NNNN (no century expansion needed).
  const pnFull = /^(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(trimmed)
  if (pnFull) {
    return toIsoDate(Number(pnFull[1]), Number(pnFull[2]), Number(pnFull[3]))
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
      Number(yearFirst[3]),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseDate`
Expected: PASS — all Step 1 assertions pass, and the existing locks (`"2023-01-15"` -> unchanged, `"2023-02-30"` -> null, `"2023-13-01"` -> null, `"1990-05-20"` -> unchanged) still pass. Note the old lock `parseDate("15/01/2023")` -> null and `parseDate("2023.01.15")` -> null in `parse.test.ts` (lines 178-179, 186-188) NOW change behavior: `"15/01/2023"` -> `"2023-01-15"` and `"2023.01.15"` (a dot date read as day=2023? no) needs inspection. `"2023.01.15"` matches the dot regex as day=2023 which fails `resolveDayMonth` (2023 > 12 and 15 > 12) -> null, so that lock stays null. But `"15/01/2023"` must be UPDATED: change the assertion at `parse.test.ts:178-180` from `expect(parseDate("15/01/2023")).toBeNull()` to `expect(parseDate("15/01/2023")).toBe("2023-01-15")` and update its `it(...)` label to "parses DD/MM/YYYY slash date (was wrong-format, now supported per ADR-0010)". Re-run and expect PASS.

- [ ] **Step 5: Write the failing tests (header-gated compact + Excel serial + short personnummer)**

Add to the existing `describe("parseDate", ...)` block:

```typescript
  it("parses compact YYYYMMDD only when header-gated (date-07, date-08)", () => {
    expect(parseDate("20230115", { headerGated: true })).toBe("2023-01-15")
    // Without the gate a bare 8-digit number is an id, not a date.
    expect(parseDate("20230115")).toBeNull()
  })

  it("parses an Excel serial only when header-gated (date-18)", () => {
    // 44927 = 2023-01-15 with the Excel epoch 1899-12-30.
    expect(parseDate("44927", { headerGated: true })).toBe("2023-01-15")
    expect(parseDate("44927")).toBeNull()
    // A salary-magnitude integer is out of the plausible serial range.
    expect(parseDate("52000", { headerGated: true })).toBeNull()
  })

  it("expands a short personnummer with the caller reference year (date-15)", () => {
    // 850612 with referenceYear 2026: 26 -> 2026, so 85 -> 1985 (past century).
    expect(parseDate("850612-1234", { referenceYear: 2026 })).toBe("1985-06-12")
  })

  it("disables short-personnummer expansion without a reference year (determinism)", () => {
    expect(parseDate("850612-1234")).toBeNull()
  })
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseDate`
Expected: FAIL — the Step 3 implementation has no compact / Excel-serial / short-personnummer branches, so `parseDate("20230115", { headerGated: true })` returns `null`.

- [ ] **Step 7: Implement the header-gated + short-personnummer branches**

Add these two constants above `parseDate`, and insert the three branches inside `parseDate` right after the `pnFull` block (before the `dateOnly` line):

```typescript
// Excel date serials use the 1899-12-30 epoch. The plausible range keeps a
// salary-magnitude integer from being read as a date; ~40000-60000 spans
// roughly 2009-2064. Header-gated (only tried when the column header matched a
// date field) so a bare integer elsewhere stays an id.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const EXCEL_SERIAL_MIN = 40000
const EXCEL_SERIAL_MAX = 60000
```

Insert inside `parseDate`, immediately after the `pnFull` `if` block:

```typescript
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
        Number(compact[3]),
      )
    }
    // Excel serial: a plausible-range integer -> date via the Excel epoch.
    if (/^\d+$/.test(trimmed)) {
      const serial = Number(trimmed)
      if (serial >= EXCEL_SERIAL_MIN && serial <= EXCEL_SERIAL_MAX) {
        const ms = EXCEL_EPOCH_UTC + serial * 86400000
        const d = new Date(ms)
        return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      }
      return null
    }
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t parseDate`
Expected: PASS — the header-gated compact, Excel serial, and short-personnummer assertions pass; the non-gated calls return `null`; all earlier date assertions still pass.

- [ ] **Step 9: Write the failing tests for `isAmbiguousDate`**

Add a NEW describe block to `packages/import/src/parse.test.ts` and add `isAmbiguousDate` to the import from `./parse.js` at the top of the file:

```typescript
describe("isAmbiguousDate", () => {
  it("flags a slash date with day <= 12 as ambiguous (date-04)", () => {
    // 01/06/2023: both components <= 12, so MM/DD was also calendar-valid.
    expect(isAmbiguousDate("01/06/2023")).toBe(true)
  })

  it("flags a dot date with day <= 12 as ambiguous", () => {
    expect(isAmbiguousDate("05.01.2023")).toBe(true)
  })

  it("does not flag when the first component > 12 (date-02)", () => {
    expect(isAmbiguousDate("15/01/2023")).toBe(false)
  })

  it("does not flag when the second component > 12 (date-03)", () => {
    expect(isAmbiguousDate("01/15/2023")).toBe(false)
  })

  it("does not flag an ISO date", () => {
    expect(isAmbiguousDate("2023-01-15")).toBe(false)
  })

  it("does not flag an unparseable value", () => {
    expect(isAmbiguousDate("not a date")).toBe(false)
  })
})
```

- [ ] **Step 10: Run to verify failure**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t isAmbiguousDate`
Expected: FAIL — `isAmbiguousDate` is not exported yet.

- [ ] **Step 11: Implement `isAmbiguousDate`**

Add this function after `parseDate` in `packages/import/src/parse.ts`:

```typescript
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
```

- [ ] **Step 12: Run to verify pass**

Run: `cd packages/import && bunx vitest run src/parse.test.ts -t isAmbiguousDate`
Expected: PASS.

- [ ] **Step 13: Add `isAmbiguousDate` to the existing export block**

Add `isAmbiguousDate` to the existing `parse.js` export block in `packages/import/src/index.ts`. This edit is ADDITIVE: Plan A (Task 5) already added `parseStringId` to this same block, so the block ALREADY contains `parseStringId` when Plan B runs. Do NOT drop it. After this edit the block contains every pre-existing name PLUS Plan A's `parseStringId` PLUS Plan B's `isAmbiguousDate`:

```typescript
export {
  parseMoney,
  parseCurrency,
  parsePercent,
  parseGender,
  parseDate,
  isAmbiguousDate,
  parseBool,
  parseIntId,
  parseStringId,
} from "./parse.js"
```

- [ ] **Step 14: Commit**

```bash
git add packages/import/src/parse.ts packages/import/src/parse.test.ts packages/import/src/index.ts
git commit -m "feat(import): widen parseDate to non-ISO formats + ambiguity predicate (ADR-0010)"
```

---

### Task 4: Shape detectors match the widened parsers (`isMoney`, `isPercent`, `isDate`, fraction sub-case, header-gated dates)

Extends `isMoney`/`isPercent`/`isDate` in `shape.ts` to EXACTLY match the widened parsers so the detector and parser never disagree (eliminates the M19/M41/M43/ENC-11 detector-parser mismatches). Adds the column-level fraction percent sub-case and header-gated Excel-serial / personnummer / compact date shapes. Updates the in-code comments to cite ADR-0010.

**Files:**
- Modify: `packages/import/src/shape.ts` (`isMoney` lines 7-22, `isPercent` lines 24-30, `isDate` lines 32-35, and `classifyColumn` lines 87-120 to thread the fraction sub-case and header gate)
- Test: `packages/import/src/shape.test.ts` (extend `describe("classifyColumn", ...)`)

**Interfaces:**
- Consumes (from Plan A, already merged):
  - `classifyColumn(values: string[]): { shape: ValueShape; confidence: number; fillRate: number }` — Plan A added `fillRate`. This task changes `classifyColumn`'s SIGNATURE by adding an options object; keep the `fillRate` field in the return unchanged.
  - `parseMoney`, `parsePercent`, `parseDate` (Tasks 1-3) — the detectors delegate to these so shape and parse agree.
- Produces:
  - `export function classifyColumn(values: string[], opts?: { headerGated?: boolean }): { shape: ValueShape; confidence: number; fillRate: number; fraction?: boolean }` — widened. `opts.headerGated` (true when the column's header matched a date field, threaded by `detect.ts` in Plan A) unlocks the compact/serial/personnummer date shapes. The return gains an optional `fraction: true` field when the winning shape is `percent` and every non-blank cell is <= 1.0, so `detect.ts`/`validate.ts` (Plan C) knows to pass `{ fraction: true }` to `parsePercent` and emit `fractionScaled`.

- [ ] **Step 1: Write the failing tests (comma-decimal money, decimal/space-% percent, non-ISO date columns)**

Add these cases to the `cases` array inside `describe("classifyColumn", ...)` in `packages/import/src/shape.test.ts`:

```typescript
    {
      label: "comma-decimal salary column is money (SC-20, M14)",
      values: ["45 000,00", "52 000,50", "41 300,00"],
      shape: "money",
    },
    {
      label: "dot-thousands salary column is money (M10)",
      values: ["52.000", "48.500", "61.000"],
      shape: "money",
    },
    {
      label: "run-on kr suffix column is money (M41)",
      values: ["52000kr", "48000kr"],
      shape: "money",
    },
    {
      label: "decimal-percent column is percent (pp-14)",
      values: ["87.5", "62.5", "100"],
      shape: "percent",
    },
    {
      label: "space-before-% column is percent (pp-13)",
      values: ["80 %", "100 %", "75 %"],
      shape: "percent",
    },
    {
      label: "comma-decimal percent column is percent (pp-16 non-fraction)",
      values: ["87,5", "62,5", "100,00"],
      shape: "percent",
    },
    {
      label: "DD.MM.YYYY column is date (date-10)",
      values: ["15.01.2023", "03.11.2022", "28.02.2021"],
      shape: "date",
    },
    {
      label: "DD/MM/YYYY column is date (date-09)",
      values: ["15/01/2023", "03/11/2022", "28/02/2021"],
      shape: "date",
    },
    {
      label: "datetime column is date (date-13)",
      values: ["2023-01-15 00:00:00", "2022-11-03 00:00:00"],
      shape: "date",
    },
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/import && bunx vitest run src/shape.test.ts`
Expected: FAIL — today `isMoney` rejects `"45 000,00"` (comma), `isPercent` rejects `"87.5"`/`"80 %"`, and `isDate` rejects dot/slash/datetime, so these columns classify as `text`.

- [ ] **Step 3: Rewrite `isMoney`, `isPercent`, `isDate` to delegate to the parsers**

Replace `isMoney` (lines 7-22), `isPercent` (lines 24-30), and `isDate` (lines 32-35) in `packages/import/src/shape.ts` with the following, and add the parse imports. The detectors delegate to the parsers so shape and parse can never disagree (kills M19/M41/M43/ENC-11).

First, update the import at the top of `shape.ts` (currently line 3 `import { type ValueShape, fold } from "./fields.js"`):

```typescript
import { type ValueShape, fold } from "./fields.js"
import { parseDate, parseMoney, parsePercent } from "./parse.js"
```

Then the three detectors:

```typescript
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
  const hasCurrency = /(^(kr|sek|nok|dkk|eur|gbp|usd|€))|((kr|sek|nok|dkk|eur|gbp|usd|€)$)/i.test(
    t,
  )
  const hasGroupingOrDecimal = /[\s   .,]/.test(t)
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
    return /^\d{1,3}(\s\d{3})+$/.test(t)
  }

  // Everything still here is dot/comma-bodied (comma-decimal, dot-decimal, or
  // dot-thousands) and already passed parseMoney, so it is real money. Bare
  // ungrouped integers with no grouping/currency/decimal were rejected at the top.
  return true
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
 *  header-gated compact/serial/personnummer forms when the caller passes
 *  headerGated. ISO, DD.MM.YYYY, DD/MM/YYYY, YYYY/MM/DD, datetime, and full
 *  personnummer prefix are always recognized.
 */
function isDate(cell: string, headerGated: boolean): boolean {
  return parseDate(cell.trim(), { headerGated }) !== null
}
```

- [ ] **Step 4: Thread `headerGated` and the fraction sub-case through `classifyColumn`**

Replace the `DETECTORS` array (lines 76-83), the `Detector` type (line 71), and the `classifyColumn` function (lines 87-120) in `packages/import/src/shape.ts` with:

```typescript
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
 * columns). When the winning shape is percent and every non-blank cell is a
 * number <= 1.0, the result carries fraction: true so downstream can scale x100
 * with a fractionScaled warning (ADR-0010). opts.headerGated unlocks the
 * compact/serial/personnummer date shapes for date-headed columns.
 * Returns `{ shape: "text", confidence: 0, fillRate }` when no detector clears
 * the floor.
 */
export function classifyColumn(
  values: string[],
  opts?: { headerGated?: boolean },
): {
  shape: ValueShape
  confidence: number
  fillRate: number
  fraction?: boolean
} {
  const headerGated = opts?.headerGated ?? false
  const trimmed = values.map((v) => v.trim())
  const nonBlank = trimmed.filter((v) => v.length > 0)
  const fillRate = values.length === 0 ? 0 : nonBlank.length / values.length

  if (nonBlank.length === 0) {
    return { shape: "text", confidence: 0, fillRate }
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
    return { shape: "text", confidence: best.confidence, fillRate }
  }

  if (best.shape === "percent") {
    const fraction = nonBlank.every((c) => {
      const n = Number(c.replace(",", "."))
      return Number.isFinite(n) && n <= 1
    })
    if (fraction) {
      return { shape: "percent", confidence: best.confidence, fillRate, fraction: true }
    }
  }

  return { shape: best.shape, confidence: best.confidence, fillRate }
}
```

- [ ] **Step 5: Run the shape tests to verify pass**

Run: `cd packages/import && bunx vitest run src/shape.test.ts`
Expected: PASS — the comma-decimal money, decimal/space-% percent, and non-ISO date columns from Step 1 now classify correctly; the existing locks (money kr suffix, percent integers, year -> id, ISO date, gender, boolean, text, mixed gender ~0.67) still pass. If a Plan A shape test asserted the old two-field return shape `{ shape, confidence }` without `fillRate`, it already accounts for `fillRate` (Plan A added it); do not touch those.

- [ ] **Step 6: Write the failing tests for the fraction sub-case and header-gated dates**

Add these as standalone `it` blocks after the `cases` loop in `packages/import/src/shape.test.ts`:

```typescript
  it("flags a fraction FTE column with fraction: true (pp-15)", () => {
    const result = classifyColumn(["1.0", "0.8", "0.5", "0.75"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBe(true)
  })

  it("flags a comma-decimal fraction column with fraction: true (pp-16)", () => {
    const result = classifyColumn(["1,0", "0,8", "0,5"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBe(true)
  })

  it("does not flag a normal percent column as fraction (pp-14)", () => {
    const result = classifyColumn(["87.5", "62.5", "100"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBeUndefined()
  })

  it("classifies a compact YYYYMMDD column as date only when header-gated (date-08)", () => {
    const values = ["20230115", "20221103", "20210228"]
    expect(classifyColumn(values, { headerGated: true }).shape).toBe("date")
    // Without the gate a bare 8-digit column is an id.
    expect(classifyColumn(values).shape).toBe("id")
  })

  it("classifies an Excel-serial column as date only when header-gated (date-19)", () => {
    const values = ["44927", "44562", "45000"]
    expect(classifyColumn(values, { headerGated: true }).shape).toBe("date")
    expect(classifyColumn(values).shape).toBe("id")
  })

  // LOCK (SC-05, SC-02): the widened parseMoney now strips space grouping, so
  // parseMoney("114 55") succeeds. The postal-code / small-grouped-id guard
  // carried forward into isMoney (Step 3) must keep these classified as `id`,
  // NOT money, because a 3+2 space group is not a true thousands pattern. This
  // is a lock, not an intended delta: if either flips to "money", the guard was
  // dropped.
  it("keeps Swedish 3+2 postal codes as id after the widening (SC-05 LOCK)", () => {
    expect(classifyColumn(["114 55", "752 28", "211 20"]).shape).toBe("id")
  })

  it("keeps space-grouped employee numbers as id after the widening (SC-02 LOCK)", () => {
    expect(classifyColumn(["114 77", "114 55", "312 90"]).shape).toBe("id")
  })

  it("still classifies a true thousands-grouped salary column as money (M05-M07 LOCK)", () => {
    expect(classifyColumn(["52 000", "61 000", "1 234 567"]).shape).toBe("money")
  })

  it("still classifies a currency-suffixed single group as money (SC-24 LOCK)", () => {
    expect(classifyColumn(["9 500 kr", "8 200 kr"]).shape).toBe("money")
  })
```

- [ ] **Step 7: Run to verify pass**

Run: `cd packages/import && bunx vitest run src/shape.test.ts`
Expected: PASS — the fraction sub-case and header-gated date assertions pass. The Step 4 implementation already computes `fraction` and threads `headerGated`.

- [ ] **Step 8: Run the full import package suite (no regressions)**

Run: `cd packages/import && bunx vitest run`
Expected: PASS — the whole `packages/import` suite is green (parse, shape, and the untouched tokenize/detect/validate/fields suites), INCLUDING every Plan A money-floor lock. SC-05 (`114 55` postal codes) and SC-02 (`114 77` grouped employee numbers) MUST still classify as `id`, and the M05-M07 thousands-grouped and SC-24 currency-suffixed cases MUST still classify as `money`. These are LOCKS, not deltas: a failure here means the postal-code / thousands-pattern guard was dropped from `isMoney` (Step 3), so restore the guard rather than editing the assertion. If a column that previously classified as `text` now classifies as `money`/`percent`/`date` because it genuinely matches the widened parser (e.g. a comma-decimal `41 300,00` column becoming `money`), that IS an intended consequence: reconcile by updating that DC assertion to the spec-correct mapping and note the catalog id in the test label. Never loosen the parser to preserve an old wrong mapping, and never edit an SC-05/SC-02/SC-24/M05-M07 lock to accept a regression.

- [ ] **Step 9: Commit**

```bash
git add packages/import/src/shape.ts packages/import/src/shape.test.ts
git commit -m "refactor(import): match isMoney/isPercent/isDate to widened parsers + fraction/header-gated shapes (ADR-0010)"
```

---

## Self-Review

**1. Spec coverage** (Plan B section of the spec, lines 284-288, plus the `parse.ts` and `shape.ts` module contracts):

- parseMoney: space/NBSP/thin grouping (Task 1 M14/M15), comma-decimal (M13/M14/M15/M16/ENC-10), dot-decimal (M17/M18/M19/ENC-11), dot-thousands + disambiguation (M10/M11), currency prefix (M35/P3), suffix + euro + run-on (M33/M40/M41/M43), null cases + negatives + en-US comma-thousands documented (M20/M25) — all in Task 1. Precision policy (finite number, >= 2 fractional digits preserved) stated in the doc comment and Global Constraints. COVERED.
- parsePercent: comma-decimal (pp-04/05/06), space-% (pp-13), column fraction mode threaded via `{ fraction }` flag (pp-07/08/09/10/11), range [0,100] after scaling — Task 2. COVERED.
- parseDate: ISO lock, DD.MM/D.M (date-05/06), DD/MM (date-02), MM/DD via second>12 (date-03), ambiguous day-first (date-04), datetime strip (date-11/12), YYYY/MM/DD (date-25), full + short personnummer with reference-year (date-14/15), compact YYYYMMDD header-gated (date-07/08), Excel serial header-gated (date-18/19) — Task 3. Ambiguity returned via `isAmbiguousDate` predicate for Plan C. COVERED.
- shape.ts isMoney/isPercent/isDate match parsers, kill M19/M41/M43/ENC-11 mismatches, fraction sub-case, header-gated Excel-serial + personnummer/compact date shapes — Task 4. Plan A's money-floor protection is carried forward into the widened `isMoney` (SC-05/SC-02 stay `id`, SC-24/M05-M07 stay `money`), guarded by explicit LOCK tests in Task 4 Step 6. COVERED.
- ADR-0010 in-code comment updates: parse.ts comments replaced in Tasks 1-3, shape.ts comments replaced in Task 4. COVERED.
- Two-digit-year and month-name dates deferred (spec line 179) — not implemented, matches "defer per plan". Documented by omission; noted here. COVERED (deferred).
- Test suites: money/percent/date FAIL-TODAY (every cited id present across Tasks 1-3), shape-column suites (Task 4). COVERED.

No gaps found.

**2. Placeholder scan:** No "TBD", "TODO", "add validation", "handle edge cases", or "similar to Task N". Every code step shows real code with concrete inputs and expected outputs. The one conditional branch (Task 1 Step 6, en-US comma-thousands assertion) gives the exact fallback assertion and comment to write. COVERED.

**3. Type consistency:**
- `parseMoney(v: string): number | null` — unchanged signature, used consistently.
- `parsePercent(v: string, opts?: { fraction?: boolean }): number | null` — defined Task 2, consumed by `isPercent` (Task 4 uses it with no opts) and by Plan C.
- `parseDate(v: string, opts?: { headerGated?: boolean; referenceYear?: number }): string | null` — defined Task 3, consumed by `isDate(cell, headerGated)` (Task 4).
- `isAmbiguousDate(v: string): boolean` — defined Task 3, exported (Task 3 Step 13).
- `classifyColumn(values, opts?: { headerGated? }): { shape; confidence; fillRate; fraction? }` — Task 4 extends Plan A's `fillRate`-bearing return; `fillRate` name matches Plan A's produced signature. `headerGated` option name matches the `parseDate`/`isDate` gate name.
- Helper names: `normalizeMoneyNumber`, `toIsoDate`, `resolveDayMonth` (Task 3) are internal, referenced only within their own functions. Consistent.

No inconsistencies found.
