# Import Robustness Plan C: Validate Codes, Gender-Flag Emission, i18n Labels, End-to-End Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax.

**Goal:** Wire the new data-quality signals (invalidFileFormat, unresolvedGender, fractionScaled, ambiguousDate, negativeValue, plus optional mojibake/raggedRow/noDelimiter) through `validate.ts`, ship a localized label for every new code in all five locales, and prove the composed `tokenize -> detect -> validate` pipeline against real-shaped Nordic payroll fixtures.

**Architecture:** `packages/import` is a pure, deterministic engine that emits machine-readable codes only; the wizard (`apps/dashboard`) translates them. Plan C extends `validateImport` with new `RowIssueCode`s and warning-carrying signals derived from the flags Plans A and B added (the tokenizer's `ImportFormatError` + ragged/no-delimiter signals, the parser's fraction flag and date-ambiguity signal, the broadened `parseGender`). The engine caller boundary that turns the tokenizer's typed error into the `invalidFileFormat` blocking signal lives at the wizard's upload step; Plan C adds the engine-side code and the minimal upload-step wiring, and explicitly defers the per-row assign-gender UI to Plan 5.

**Tech Stack:** TypeScript, Vitest 4, `@workspace/import` (pure engine), `@workspace/i18n` (`next-intl` message files), `apps/dashboard` import wizard (React, `next-intl`).

## Global Constraints

- The engine (`packages/import/src`) is pure and deterministic: no clock (`Date.now()`), no network, no randomness in logic; any date heuristic needing a current year takes an explicit reference-year parameter from the caller, never the clock.
- Locale parity is a hard requirement: every new code ships a label in en, sv, nb, da, fi; the `packages/i18n` parity test fails if any locale's key set differs from `en.json`.
- Value parsers stay total: they return `null` on bad input and never throw. The one exception is the binary-signature guard in `tokenizeCsv` (added in Plan A), which throws a typed `ImportFormatError` by design.
- All tests run with Vitest 4 via `cd packages/import && bunx vitest run <file>` (or `bun run test` at package root); never `bun test`.
- New code ships with tests in the same commit.
- English identifiers, English code comments, no em dashes anywhere.
- The engine emits only codes, never display text; the frontend translates.

---

### Task 1: `invalidFileFormat` typed signal + caller boundary contract

**Files:**
- Modify: `packages/import/src/validate.ts`
- Modify: `packages/import/src/index.ts`
- Test: `packages/import/src/validate.test.ts`

**Interfaces:**

Consumes (from Plan A, merged before this plan runs):
- `class ImportFormatError extends Error { readonly kind: "binary"; readonly signature: "zip" | "ole2"; name: string }` exported from `packages/import/src/tokenize.js` and re-exported from `index.js`. Thrown by `tokenizeCsv(text: string)` when the decoded input begins with a binary spreadsheet signature (`PK\x03\x04` for XLSX/ODS -> `signature: "zip"`, `\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1` for legacy XLS -> `signature: "ole2"`). Plan C only branches on `err instanceof ImportFormatError`; it does not read any field off the error, so no code change follows from the exact field set (the earlier `detail?` field does not exist and is not used).
- `tokenizeCsv(text: string): { headers: string[]; rows: string[][]; signals: TokenizeSignals }` where `TokenizeSignals` (Plan A) is the ALWAYS-PRESENT `{ preambleRowsSkipped: number; raggedRows: number[]; duplicateHeaders: string[]; blankHeaderColumns: number[]; noDelimiter: boolean }`. The `signals` object is never undefined (zero/empty when nothing was detected). Plan C reads `signals.raggedRows` and `signals.noDelimiter` (Task 6); it does not depend on the others.

Consumes (from existing code, unchanged): `validateImport(input, mapping, opts): ImportValidation`; `ImportValidation = { readiness, blocking, warnings, issues }`; `DetectedMapping`; `CanonicalFieldKey`.

Produces (later plans / the wizard consume these exact signatures):
- `type BlockingIssueCode = "invalidFileFormat"` exported from `validate.js`.
- `function validateFile(text: string, mapping: DetectedMapping, opts: ValidateOpts, tokenized?: TokenizeResult): ImportValidation`, a thin wrapper that calls `tokenizeCsv(text)` inside a try/catch: on `ImportFormatError` it returns a validation whose `blocking` includes the sentinel and whose `fileFormatError` flag is set; otherwise it delegates to `validateImport`. The `tokenized` param, when passed, is the full `TokenizeResult` (headers, rows, and the always-present `signals`); Task 6 threads `signals` from it into `validateImport`. Exact return shape defined below.
- `ImportValidation` gains an optional field `fileFormatError?: BlockingIssueCode` (present and equal to `"invalidFileFormat"` only when the input was a binary file). All existing fields are unchanged.

**Decision (recorded here so the plan is exact):** `invalidFileFormat` is surfaced as BOTH a dedicated top-level typed flag (`fileFormatError`) AND a sentinel string appended to the `blocking` array, so the wizard can (a) branch on the typed flag to render the "export as CSV" screen and (b) keep its existing `blocking.length > 0` gate working unchanged. Because `blocking` is currently typed `CanonicalFieldKey[]`, we widen it to `(CanonicalFieldKey | BlockingIssueCode)[]`. `invalidFileFormat` is never a canonical field, so no existing `blocking` consumer that iterates canonical-field keys can be fed a binary file (the wrapper returns early with an empty readiness list and only the sentinel in `blocking`).

- [ ] **Step 1: Write the failing test for the `invalidFileFormat` typed signal (A4).**

  Append to `packages/import/src/validate.test.ts`:

  ```ts
  import { ImportFormatError } from "./tokenize.js"
  import { validateFile } from "./validate.js"

  describe("validateFile — invalidFileFormat (A1, A4)", () => {
    // XLSX / ODS ZIP local-file header.
    const XLSX_MAGIC = "PK\x03\x04\x14\x00\x06\x00"
    // Legacy XLS OLE2 compound-file header.
    const XLS_MAGIC = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"

    const EMPTY_MAPPING: DetectedMapping = { map: {}, unmappedColumns: [] }

    it("returns fileFormatError and the sentinel in blocking for XLSX magic bytes", () => {
      const result = validateFile(XLSX_MAGIC, EMPTY_MAPPING, {})
      expect(result.fileFormatError).toBe("invalidFileFormat")
      expect(result.blocking).toContain("invalidFileFormat")
      // It must NOT masquerade as missing canonical fields.
      expect(result.blocking).not.toContain("basicMonthly")
      expect(result.blocking).not.toContain("gender")
    })

    it("returns fileFormatError for legacy XLS magic bytes", () => {
      const result = validateFile(XLS_MAGIC, EMPTY_MAPPING, {})
      expect(result.fileFormatError).toBe("invalidFileFormat")
      expect(result.blocking).toContain("invalidFileFormat")
    })

    it("throwing tokenizeCsv is the only path to invalidFileFormat", () => {
      // Sanity: a plain CSV text through validateFile has no fileFormatError.
      const csv = "name,salary\nAnna,52000\n"
      const tokenized = tokenizeCsv(csv)
      const result = validateFile(csv, EMPTY_MAPPING, {}, tokenized)
      expect(result.fileFormatError).toBeUndefined()
    })
  })
  ```

  Add the `tokenizeCsv` import to the test file's existing import block if not already present.

- [ ] **Step 2: Run the test and confirm it FAILS.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: FAIL. `validateFile` is not exported, and `ImportValidation` has no `fileFormatError`.

- [ ] **Step 3: Implement `validateFile` and the typed signal (minimal code).**

  In `packages/import/src/validate.ts`, add the imports and types near the top (after the existing imports):

  ```ts
  import { ImportFormatError, tokenizeCsv } from "./tokenize.js"
  import type { TokenizeResult } from "./tokenize.js"

  /** A blocking signal that is not a missing canonical field. */
  export type BlockingIssueCode = "invalidFileFormat"
  ```

  Widen the `blocking` field and add `fileFormatError` on `ImportValidation`:

  ```ts
  export type ImportValidation = {
    readiness: ReadinessEntry[]
    /** Required fields absent from the mapping, plus blocking non-field signals. */
    blocking: (CanonicalFieldKey | BlockingIssueCode)[]
    warnings: CanonicalFieldKey[]
    issues: RowIssue[]
    /**
     * Set to "invalidFileFormat" when the raw input was a binary spreadsheet
     * (tokenizeCsv threw ImportFormatError). Undefined for well-formed CSV.
     */
    fileFormatError?: BlockingIssueCode
  }
  ```

  Add the wrapper at the end of the file:

  ```ts
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
  ```

- [ ] **Step 4: Export the new symbols.**

  In `packages/import/src/index.ts`, add `validateFile` to the `validate.js` value export and `BlockingIssueCode` to its type export:

  ```ts
  export { validateFile, validateImport } from "./validate.js"
  export type {
    BlockingIssueCode,
    ImportValidation,
    RowIssue,
    RowIssueCode,
    ReadinessEntry,
    ValidateOpts,
  } from "./validate.js"
  ```

- [ ] **Step 5: Run the test and confirm it PASSES; run the full validate suite to confirm no regression.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: PASS (the three new cases plus every existing validate test unchanged).

- [ ] **Step 6: Commit.**

  ```
  git add packages/import/src/validate.ts packages/import/src/index.ts packages/import/src/validate.test.ts
  git commit -m "feat(import): add invalidFileFormat typed signal via validateFile boundary"
  ```

---

### Task 2: unresolvedGender rename + numeric-ambiguous flag path

**Files:**
- Modify: `packages/import/src/validate.ts`
- Modify: `packages/import/src/index.ts`
- Test: `packages/import/src/validate.test.ts`

**Interfaces:**

Consumes (from Plan A, merged): the broadened `parseGender(v: string, opts?: { allowNumericCodes?: boolean }): "Man" | "Kvinna" | null` that resolves nb/da/fi words and en `f`, and, ONLY under `opts.allowNumericCodes === true`, the SCB/SAP numeric convention `1` -> Man, `2` -> Kvinna. On the validate path the mapped gender column IS the gender column (the header matched gender in detect), so validate MUST pass `{ allowNumericCodes: true }`: a numeric `1`/`2` cell under a mapped gender column resolves and does NOT flag. Every other value still returns `null` (blank, unrecognized, non-binary `Annat`/`Other`/`X`/`Ukjent`/`Muu`, and ambiguous numeric codes like `0`/`3`), so those still flag as `unresolvedGender`.

Produces:
- `RowIssueCode` renamed member: `blankGender` becomes `unresolvedGender`. The full union becomes `"duplicateId" | "unparsableMoney" | "nonNumericCode" | "unresolvedGender" | "genderNameMismatch"`.

**Decision (recorded here):** Rename `blankGender` to `unresolvedGender`. Rationale: after the broadened `parseGender` (Plan A), the flag covers blank AND numeric-ambiguous AND non-binary AND otherwise unrecognized cells, so "blank" undersells it. Per the pre-launch "no legacy" rule, we delete `blankGender` completely (code, wizard reference, i18n key) in the same change rather than keeping an alias. The engine flags every unresolved row; the manual `Man`/`Kvinna` assignment happens downstream in Plan 5. No third canonical value is introduced. Numeric-ambiguous codes flow through this exact same path because `parseGender` returns `null` for them.

- [ ] **Step 1: Write the failing test for the renamed code and the numeric-ambiguous path (Decision 3, GEN-22).**

  In `packages/import/src/validate.test.ts`, REPLACE the existing `describe("validateImport — issues: blankGender", ...)` block with:

  ```ts
  describe("validateImport — issues: unresolvedGender", () => {
    it("reports unresolvedGender for a row with a blank gender cell", () => {
      const rows: string[][] = [
        ...ROWS,
        // row 4: blank gender
        "2023-01-01;Test;User;Nej;;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      const bad = result.issues.filter((i) => i.code === "unresolvedGender")
      expect(bad.length).toBeGreaterThanOrEqual(1)
      expect(bad.map((i) => i.row)).toContain(4)
    })

    it("reports unresolvedGender for a non-binary token (Annat), never a third value", () => {
      const rows: string[][] = [
        // row 0: gender cell "Annat" -> parseGender null -> flagged, not mapped
        "2023-01-01;Test;User;Nej;Annat;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      const bad = result.issues.filter((i) => i.code === "unresolvedGender")
      expect(bad.map((i) => i.row)).toContain(0)
    })

    it("does not flag a resolvable gender cell (Man)", () => {
      const rows: string[][] = [
        "2023-01-01;Test;User;Nej;Man;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      expect(
        result.issues.filter((i) => i.code === "unresolvedGender")
      ).toHaveLength(0)
    })

    it("does NOT flag numeric SCB/SAP codes 1 and 2 under a mapped gender column (P6, GEN-09)", () => {
      // The mapped gender column is the gender column, so validate passes
      // { allowNumericCodes: true }: 1 -> Man, 2 -> Kvinna resolve and do not flag.
      const rows: string[][] = [
        "2023-01-01;Test;User;Nej;1;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
        "2023-01-01;Test;User;Nej;2;Sverige;2024;1990-01-01;Analyst;1235;55000;0;0;SEK;119;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      expect(
        result.issues.filter((i) => i.code === "unresolvedGender")
      ).toHaveLength(0)
    })

    it("still flags an ambiguous numeric gender code (3) even with numeric codes allowed", () => {
      const rows: string[][] = [
        "2023-01-01;Test;User;Nej;3;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      const bad = result.issues.filter((i) => i.code === "unresolvedGender")
      expect(bad.map((i) => i.row)).toContain(0)
    })

    it("no blankGender code exists anymore", () => {
      const rows: string[][] = [
        "2023-01-01;Test;User;Nej;;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      // biome-ignore lint/suspicious/noExplicitAny: asserting a removed code
      expect(
        result.issues.some((i) => (i.code as any) === "blankGender")
      ).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run the test and confirm it FAILS.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: FAIL. `unresolvedGender` is not a valid `RowIssueCode` (type error) and the emitted code is still `blankGender`.

- [ ] **Step 3: Rename the code in `validate.ts` (minimal code).**

  In `packages/import/src/validate.ts`, change the union:

  ```ts
  export type RowIssueCode =
    | "duplicateId"
    | "unparsableMoney"
    | "nonNumericCode"
    | "unresolvedGender"
    | "genderNameMismatch"
  ```

  And in the per-row loop, change the gender block's emitted code and detail:

  ```ts
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
  ```

- [ ] **Step 4: Update the wizard reference so the app still type-checks.**

  In `apps/dashboard/components/people/import/check-step.tsx`, no code change is needed for the grouping loop (it iterates `RowIssueCode` generically), but the i18n key it looks up (`issue.${code}`) will change from `blankGender` to `unresolvedGender` in Task 4. Grep to confirm no hard-coded `"blankGender"` string remains in `apps/dashboard`:

  ```
  cd /Volumes/development/blueprnt/frontend && grep -rn "blankGender" apps/dashboard/components packages/import/src
  ```

  Expected after Task 4: zero hits outside `.next/` build artifacts.

- [ ] **Step 5: Run the validate suite and confirm PASS.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: PASS.

- [ ] **Step 6: Commit.**

  ```
  git add packages/import/src/validate.ts packages/import/src/validate.test.ts
  git commit -m "refactor(import): rename blankGender to unresolvedGender for flag-and-assign"
  ```

---

### Task 3: fractionScaled, ambiguousDate, negativeValue row-issue codes

**Files:**
- Modify: `packages/import/src/validate.ts`
- Test: `packages/import/src/validate.test.ts`

**Interfaces:**

Consumes (from Plan B, merged):
- A percent/FTE column fraction detection is available. Plan B's `classifyColumn` return carries `fraction?: boolean` on a percent classification, and `parsePercent(v: string, opts?: { fraction?: boolean }): number | null` scales x100 when `opts.fraction` is set. For validate's per-column check, Plan C needs a way to know a column is fractional WITHOUT re-running detect. We derive it locally from the raw column values (definition below), so Task 3 does not couple to `classifyColumn`'s internal return; it applies the same "all non-blank cells parse to a number <= 1.0" rule the spec pins for the fraction heuristic (pp-15/pp-16/pp-24).
- `parseMoney(v: string): number | null` (Plan B broadened): returns a finite number for comma/dot decimal, dot-thousands, currency prefix/suffix/symbol, run-on suffix; returns `null` for negative and parenthesized-negative money (`-500`, `(500)`) which stay unsupported for V1.

Consumes (existing): `parseMoney`, `parseGender`, the per-row loop scaffold, `colOf(key)`.

Produces:
- `RowIssueCode` gains `"fractionScaled" | "ambiguousDate" | "negativeValue"`. Full union becomes `"duplicateId" | "unparsableMoney" | "nonNumericCode" | "unresolvedGender" | "genderNameMismatch" | "fractionScaled" | "ambiguousDate" | "negativeValue"`.
- Two small pure helpers, not exported: `isFractionColumn(rows: string[][], col: number): boolean` and `isNegativeMoney(raw: string): boolean`.

**Decision (recorded here):**
- `fractionScaled` is emitted once per non-blank cell in a detected-fraction FTE column, matching the per-row `RowIssue` shape the wizard already groups by code (it will show "N rows affected"). A column is fractional when it has at least one non-blank cell and every non-blank cell parses to a finite number `<= 1.0` (comma or dot decimal); this is the deterministic column-level rule, computed from the raw `ftePercent` column values inside `validateImport`.
- **Engine vs consumer boundary for the x100 scaling.** Plan C's job on the fraction path is ONLY to DETECT the fractional column and EMIT the `fractionScaled` warning, so the transform is never silent. Plan C does NOT itself multiply the stored value by 100. The actual x100 scaling at import/preview time is a CONSUMER obligation: the backend import action and the wizard preview call `parsePercent(cell, { fraction: true })` (the flag Plan B added) for a column validate flagged as fractional. Those consumer edits are OUT OF SCOPE for Plans A/B/C (engine-only) and are captured in the "Consumer wiring (follow-on)" note at the end of this plan.
- `ambiguousDate` needs a date-ambiguity signal. Plan B's `parseDate` takes a reference year param and, for slash/dot dates where `MM/DD` was also calendar-valid (day component `<= 12`), the spec pins an `ambiguousDate` warning. Plan C re-derives ambiguity locally with a pure helper on the raw cell string so validate does not need `parseDate` to return a structured object: a cell is ambiguous when it matches `^\d{1,2}[./]\d{1,2}[./]\d{4}$` AND both the first and second numeric components are in `1..12`. This is deterministic and needs no reference year (both readings are valid calendar days only when both parts are `<= 12`, which is exactly the `day <= 12` case).
- `negativeValue` is emitted for a `basicMonthly` (or `variable`/`benefitInKind` if mapped) cell that is a negative or parenthesized-negative money string, so a correction/deduction row surfaces named instead of as an opaque `unparsableMoney`. To avoid double-flagging, when `isNegativeMoney(raw)` is true the row gets `negativeValue` and NOT `unparsableMoney`.

- [ ] **Step 1: Write the failing tests (pp-07 fractionScaled, date-04 ambiguousDate, ENC-24 negativeValue).**

  Append to `packages/import/src/validate.test.ts`:

  ```ts
  describe("validateImport — issues: fractionScaled (pp-07)", () => {
    it("flags every row of a fractional FTE column", () => {
      // ftePercent column (index 15) holds fractions 0.8 / 1.0 / 0,5
      const rows: string[][] = [
        "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;5000;SEK;114;0.8".split(
          ";"
        ),
        "2021-08-15;Erik;Lindqvist;Ja;Man;Sverige;2024;1990-11-30;PM;1232;65000;0;0;SEK;115;1.0".split(
          ";"
        ),
        "2022-01-01;Sara;Berg;Nej;Kvinna;Sverige;2024;1988-04-20;Analyst;1233;52000;0;0;SEK;116;0,5".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      const scaled = result.issues.filter((i) => i.code === "fractionScaled")
      expect(scaled.map((i) => i.row).sort()).toEqual([0, 1, 2])
    })

    it("does not flag a normal 0-100 FTE column", () => {
      // ROWS ftePercent cells are 100 / 80 / 100 / 100 -> not a fraction column
      const result = validateImport(
        { headers: HEADERS, rows: ROWS },
        FULL_MAPPING,
        {}
      )
      expect(
        result.issues.filter((i) => i.code === "fractionScaled")
      ).toHaveLength(0)
    })
  })

  describe("validateImport — issues: ambiguousDate (date-04)", () => {
    it("flags a DD/MM date whose MM/DD reading is also valid (01/06/2023)", () => {
      // employmentStartDate column (index 0) holds an ambiguous slash date.
      const rows: string[][] = [
        "01/06/2023;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;0;SEK;114;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      const amb = result.issues.filter((i) => i.code === "ambiguousDate")
      expect(amb.map((i) => i.row)).toContain(0)
    })

    it("does not flag an unambiguous date (15/06/2023, day > 12)", () => {
      const rows: string[][] = [
        "15/06/2023;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;0;SEK;114;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      expect(
        result.issues.filter((i) => i.code === "ambiguousDate")
      ).toHaveLength(0)
    })
  })

  describe("validateImport — issues: negativeValue (ENC-24)", () => {
    it("flags a negative money cell as negativeValue, not unparsableMoney", () => {
      const rows: string[][] = [
        "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;-45000;0;0;SEK;114;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      expect(result.issues.filter((i) => i.code === "negativeValue").map((i) => i.row)).toContain(0)
      expect(
        result.issues.filter((i) => i.code === "unparsableMoney")
      ).toHaveLength(0)
    })

    it("flags a parenthesized-negative money cell as negativeValue", () => {
      const rows: string[][] = [
        "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;(500);0;0;SEK;114;100".split(
          ";"
        ),
      ]
      const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
      expect(result.issues.filter((i) => i.code === "negativeValue").map((i) => i.row)).toContain(0)
    })
  })
  ```

- [ ] **Step 2: Run the tests and confirm they FAIL.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: FAIL. The three new codes are not valid `RowIssueCode`s and are never emitted.

- [ ] **Step 3: Extend `RowIssueCode` and add the pure helpers (minimal code).**

  In `packages/import/src/validate.ts`, extend the union:

  ```ts
  export type RowIssueCode =
    | "duplicateId"
    | "unparsableMoney"
    | "nonNumericCode"
    | "unresolvedGender"
    | "genderNameMismatch"
    | "fractionScaled"
    | "ambiguousDate"
    | "negativeValue"
  ```

  Add the two helpers above `validateImport`:

  ```ts
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
  ```

- [ ] **Step 4: Wire the three codes into the per-row loop (minimal code).**

  In `packages/import/src/validate.ts`, add column lookups next to the existing ones:

  ```ts
  const ftePercentCol = colOf("ftePercent")
  const employmentStartDateCol = colOf("employmentStartDate")
  const birthDateCol = colOf("birthDate")
  ```

  Compute the fraction flag once, before the row loop:

  ```ts
  const fteIsFraction =
    ftePercentCol !== undefined && isFractionColumn(rows, ftePercentCol)
  ```

  Replace the existing `unparsableMoney` block so it defers to `negativeValue`:

  ```ts
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
  ```

  Add the `fractionScaled` block (uses the pre-computed column flag):

  ```ts
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
  ```

  Add the `ambiguousDate` block (checks both mapped date columns):

  ```ts
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
  ```

- [ ] **Step 5: Run the validate suite and confirm PASS (including the existing unparsableMoney lock).**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: PASS. The existing `unparsableMoney` test (row with `NOT_A_NUMBER`) still passes because that value is not negative and `parseMoney` returns null.

- [ ] **Step 6: Commit.**

  ```
  git add packages/import/src/validate.ts packages/import/src/validate.test.ts
  git commit -m "feat(import): add fractionScaled, ambiguousDate, negativeValue row issues"
  ```

---

### Task 4: i18n labels for every new code in all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/sv.json`
- Modify: `packages/i18n/messages/nb.json`
- Modify: `packages/i18n/messages/da.json`
- Modify: `packages/i18n/messages/fi.json`
- Modify: `apps/dashboard/components/people/import/check-step.tsx`
- Modify: `apps/dashboard/components/people/import/upload-step.tsx`
- Test: `packages/i18n/src/messages.test.ts` (parity, unchanged; must keep passing)

**Interfaces:**

Consumes: the `RowIssueCode` union from Task 3 (`unresolvedGender`, `fractionScaled`, `ambiguousDate`, `negativeValue`) and the `BlockingIssueCode` `invalidFileFormat` from Task 1. The wizard renders `check.issue.<code>` for each `RowIssueCode`, so each needs a matching `dashboard.people.import.check.issue.<code>` key. `invalidFileFormat` is surfaced at the upload boundary, so it needs an `dashboard.people.import.upload.errorInvalidFormat` message.

Produces: no code signatures; produces the exact i18n key paths later plans and the wizard depend on:
- `dashboard.people.import.check.issue.unresolvedGender` (replaces `blankGender`)
- `dashboard.people.import.check.issue.fractionScaled`
- `dashboard.people.import.check.issue.ambiguousDate`
- `dashboard.people.import.check.issue.negativeValue`
- `dashboard.people.import.check.issue.raggedRow` (Task 6)
- `dashboard.people.import.check.issue.noDelimiter` (Task 6)
- `dashboard.people.import.check.issue.mojibake` (Task 6)
- `dashboard.people.import.upload.errorInvalidFormat`

**Decision (recorded here):** sv/nb/da/fi strings are machine-drafted and flagged for native review, per the i18n rules. en is the source. All eight keys ship in this task so the parity test never goes red between tasks (Task 6's three keys are added here up front; if the plan defers Task 6, delete the three `raggedRow`/`noDelimiter`/`mojibake` keys from all five files in the same commit so parity holds).

- [ ] **Step 1: Write a failing engine-vs-i18n coverage test.**

  Create `packages/import/src/issue-codes.test.ts` to lock that every emitted code is a known member (guards against a stray code with no label). This is an engine-side test; the actual i18n label existence is enforced by the parity test plus the wizard's typed key lookup.

  ```ts
  import { describe, expect, it } from "vitest"
  import type { BlockingIssueCode, RowIssueCode } from "./validate.js"

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
  ]
  const BLOCKING_CODES: BlockingIssueCode[] = ["invalidFileFormat"]

  describe("issue code inventory", () => {
    it("row codes are unique", () => {
      expect(new Set(ROW_CODES).size).toBe(ROW_CODES.length)
    })
    it("blocking codes are unique", () => {
      expect(new Set(BLOCKING_CODES).size).toBe(BLOCKING_CODES.length)
    })
  })
  ```

  Run it:

  ```
  cd packages/import && bunx vitest run src/issue-codes.test.ts
  ```

  Expected: PASS once Tasks 1-3 have landed (this is a lock, not a red-first test; its value is catching a future drift). If it fails to typecheck, a code name is wrong.

- [ ] **Step 2: Confirm the parity test is currently GREEN, then edit en.json first.**

  ```
  cd packages/i18n && bunx vitest run src/messages.test.ts
  ```

  Expected: PASS before edits.

  In `packages/i18n/messages/en.json`, under `dashboard.people.import.check.issue`, REPLACE `blankGender` and ADD the new keys:

  ```json
  "issue": {
    "duplicateId": "Duplicate employee ID",
    "unparsableMoney": "Unreadable salary value",
    "nonNumericCode": "Non-numeric statistical code",
    "unresolvedGender": "Gender needs to be assigned",
    "genderNameMismatch": "Gender and name mismatch",
    "fractionScaled": "FTE read as a fraction and scaled to a percentage",
    "ambiguousDate": "Ambiguous date (read as day/month)",
    "negativeValue": "Negative salary value",
    "raggedRow": "Row has the wrong number of columns",
    "noDelimiter": "No column separator detected",
    "mojibake": "Header text looks garbled (wrong file encoding)"
  }
  ```

  In `packages/i18n/messages/en.json`, under `dashboard.people.import.upload`, ADD:

  ```json
  "errorInvalidFormat": "This looks like a spreadsheet file, not a CSV. Open it in Excel or your payroll system and export it as CSV, then upload the CSV."
  ```

- [ ] **Step 3: Mirror the keys into sv, nb, da, fi (machine drafts, flagged for native review).**

  In `packages/i18n/messages/sv.json`, `check.issue`:

  ```json
  "unresolvedGender": "Kön behöver anges",
  "genderNameMismatch": "Kön och namn stämmer inte",
  "fractionScaled": "Sysselsättningsgrad tolkad som andel och skalad till procent",
  "ambiguousDate": "Tvetydigt datum (tolkat som dag/månad)",
  "negativeValue": "Negativt lönevärde",
  "raggedRow": "Raden har fel antal kolumner",
  "noDelimiter": "Ingen kolumnavgränsare hittades",
  "mojibake": "Rubriktexten ser skadad ut (fel filkodning)"
  ```

  and `upload.errorInvalidFormat`:

  ```json
  "errorInvalidFormat": "Det här ser ut som en kalkylbladsfil, inte en CSV. Öppna den i Excel eller ditt lönesystem och exportera som CSV, ladda sedan upp CSV-filen."
  ```

  In `packages/i18n/messages/nb.json`, `check.issue`:

  ```json
  "unresolvedGender": "Kjønn må angis",
  "genderNameMismatch": "Kjønn og navn stemmer ikke",
  "fractionScaled": "Stillingsprosent tolket som andel og skalert til prosent",
  "ambiguousDate": "Tvetydig dato (tolket som dag/måned)",
  "negativeValue": "Negativ lønnsverdi",
  "raggedRow": "Raden har feil antall kolonner",
  "noDelimiter": "Ingen kolonneskiller funnet",
  "mojibake": "Overskriftsteksten ser ødelagt ut (feil filkoding)"
  ```

  and `upload.errorInvalidFormat`:

  ```json
  "errorInvalidFormat": "Dette ser ut som en regnearkfil, ikke en CSV. Åpne den i Excel eller lønnssystemet ditt og eksporter som CSV, last deretter opp CSV-filen."
  ```

  In `packages/i18n/messages/da.json`, `check.issue`:

  ```json
  "unresolvedGender": "Køn skal angives",
  "genderNameMismatch": "Køn og navn stemmer ikke",
  "fractionScaled": "Beskæftigelsesgrad tolket som andel og skaleret til procent",
  "ambiguousDate": "Tvetydig dato (tolket som dag/måned)",
  "negativeValue": "Negativ lønværdi",
  "raggedRow": "Rækken har det forkerte antal kolonner",
  "noDelimiter": "Ingen kolonneadskiller fundet",
  "mojibake": "Overskriftsteksten ser ødelagt ud (forkert filkodning)"
  ```

  and `upload.errorInvalidFormat`:

  ```json
  "errorInvalidFormat": "Dette ligner en regnearksfil, ikke en CSV. Åbn den i Excel eller dit lønsystem og eksporter som CSV, upload derefter CSV-filen."
  ```

  In `packages/i18n/messages/fi.json`, `check.issue`:

  ```json
  "unresolvedGender": "Sukupuoli on määritettävä",
  "genderNameMismatch": "Sukupuoli ja nimi eivät täsmää",
  "fractionScaled": "Työaika tulkittiin osuutena ja skaalattiin prosenteiksi",
  "ambiguousDate": "Monitulkintainen päivämäärä (tulkittu muodossa päivä/kuukausi)",
  "negativeValue": "Negatiivinen palkka-arvo",
  "raggedRow": "Rivillä on väärä määrä sarakkeita",
  "noDelimiter": "Sarake-erotinta ei löytynyt",
  "mojibake": "Otsikkoteksti näyttää vioittuneelta (väärä tiedostokoodaus)"
  ```

  and `upload.errorInvalidFormat`:

  ```json
  "errorInvalidFormat": "Tämä näyttää laskentataulukkotiedostolta, ei CSV-tiedostolta. Avaa se Excelissä tai palkkajärjestelmässäsi ja vie CSV-muodossa, lataa sitten CSV-tiedosto."
  ```

  NOTE: the non-ASCII characters above (å, ä, ö, æ, ø) must be typed as real UTF-8 characters via the Edit tool, NEVER via shell `perl`/`sed`/`echo` (double-encoding risk, per the i18n non-ASCII memory). After editing, grep for mojibake to confirm no double-encoding:

  ```
  cd /Volumes/development/blueprnt/frontend && grep -l "Ã¥\|Ã¶\|Ã¤\|Ã¸\|Ã¦" packages/i18n/messages/*.json && echo "MOJIBAKE FOUND" || echo "clean"
  ```

  Expected: `clean`.

- [ ] **Step 4: Point the wizard at the new keys.**

  In `apps/dashboard/components/people/import/check-step.tsx`, no change is needed to the issue-group rendering loop (it already looks up `issue.${code}` for whatever `RowIssueCode` is present), so the renamed `unresolvedGender` and the three new codes resolve automatically once the keys exist. Verify there is no remaining hard-coded `blankGender`:

  ```
  cd /Volumes/development/blueprnt/frontend && grep -rn "blankGender" apps/dashboard/components
  ```

  Expected: zero hits.

  In `apps/dashboard/components/people/import/upload-step.tsx`, wire the `invalidFileFormat` boundary. Change the error union and the `handleCsvText` catch:

  ```ts
  export function handleCsvText(
    text: string
  ):
    | { ok: true; parsed: ParsedCsv }
    | { ok: false; error: "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" } {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: "errorEmpty" }
    }
    let parsed: ParsedCsv
    try {
      parsed = tokenizeCsv(text)
    } catch (err) {
      if (err instanceof ImportFormatError) {
        return { ok: false, error: "errorInvalidFormat" }
      }
      throw err
    }
    if (parsed.headers.length === 0) {
      return { ok: false, error: "errorEmpty" }
    }
    if (parsed.rows.length === 0) {
      return { ok: false, error: "errorEmpty" }
    }
    return { ok: true, parsed }
  }
  ```

  Add the import at the top of `upload-step.tsx`:

  ```ts
  import { ImportFormatError, tokenizeCsv } from "@workspace/import"
  ```

  Widen the component's error state type:

  ```ts
  const [error, setError] = useState<
    "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" | null
  >(null)
  ```

  The inline error render already does `{t(error)}`, so `errorInvalidFormat` resolves against `dashboard.people.import.upload.errorInvalidFormat` automatically.

- [ ] **Step 5: Run the i18n parity test and the wizard tests; confirm PASS.**

  ```
  cd packages/i18n && bunx vitest run src/messages.test.ts
  cd /Volumes/development/blueprnt/frontend && bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx apps/dashboard/components/people/import/upload-step.test.tsx
  ```

  Expected: PASS. Parity holds because all five files gained the same keys; the upload-step test's `handleCsvText` still returns `errorEmpty`/`errorNotCsv` for existing cases.

- [ ] **Step 6: Commit.**

  ```
  git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json apps/dashboard/components/people/import/upload-step.tsx packages/import/src/issue-codes.test.ts
  git commit -m "feat(import): localized labels for new data-quality codes and invalid-format guard"
  ```

---

### Task 5: End-to-end fixtures + pipeline test

**Files:**
- Create: `packages/import/fixtures/visma-sv.csv`
- Create: `packages/import/fixtures/hogia-sv.csv`
- Create: `packages/import/fixtures/workday-en.csv`
- Create: `packages/import/fixtures/personec-no.csv`
- Create: `packages/import/fixtures/sap-successfactors.csv`
- Create: `packages/import/fixtures/fortnox-sv.csv`
- Create: `packages/import/fixtures/binary.xlsx` (first bytes only, written as raw ZIP magic)
- Test: `packages/import/src/pipeline.test.ts`

**Interfaces:**

Consumes:
- `tokenizeCsv(text)` (Plan A: line-ending, `sep=`, preamble, ragged, binary guard).
- `detectColumns(input): DetectedMapping` where `DetectedMapping = { map: Partial<Record<CanonicalFieldKey, { columnIndex: number; confidence: number }>>; unmappedColumns: number[] }` (existing; Plan A restricts shape-only fallback and adds the fold/synonym fixes).
- `validateImport(input, mapping, opts, signals?: TokenizeSignals): ImportValidation` (Tasks 2-3; the optional `signals` 4th param is added in Task 6 and drives raggedRow/noDelimiter) and `validateFile(text, mapping, opts, tokenized?: TokenizeResult)` (Task 1). The pipeline `runCsv` threads `tokenized.signals` into `validateImport`.
- Broadened parsers from Plans A and B (comma-decimal money, DD.MM dates, nb/da gender, fraction FTE).

Produces: no code signatures. The fixtures and `pipeline.test.ts` are the composed-pipeline regression suite for all three plans.

**Decision (recorded here):** fixtures are read with Node's `readFileSync` (Vitest allows Node builtins in test files; the engine source stays pure). `binary.xlsx` is created by writing the raw ZIP local-file-header bytes plus a short filename so the tokenizer's binary guard fires; it does not need to be a valid archive. The pipeline test runs `tokenizeCsv -> detectColumns -> validateImport` for the CSV fixtures and `validateFile` (which internally calls `tokenizeCsv` and catches) for the binary fixture.

- [ ] **Step 1: Create the CSV fixtures with exact catalog-derived content.**

  `packages/import/fixtures/visma-sv.csv` (NBSP salary as `52 000` with a real NBSP U+00A0, semicolon, Swedish headers; B1-ok LOCK). Type the NBSP as a literal U+00A0 via the Write tool:

  ```
  Anstnr;Fornamn;Efternamn;Kon;Befattning;Manadslon
  114;Anna;Svensson;Kvinna;Senior Analyst;52 000
  115;Erik;Lindqvist;Man;Product Manager;65 000
  ```

  `packages/import/fixtures/hogia-sv.csv` (comma-decimal `41 300,00`, `Grundlon`; B2):

  ```
  Anstnr;Fornamn;Efternamn;Kon;Befattning;Grundlon
  200;Sara;Berg;Kvinna;Analyst;41 300,00
  201;Lars;Ek;Man;Developer;52 000,50
  ```

  `packages/import/fixtures/workday-en.csv` (bare int `72000` under `Base Pay`, `Female`, `Hire Date` `15.03.2019`, NOK; B3, comma-delimited):

  ```
  Employee ID,First Name,Last Name,Gender,Job Title,Base Pay,Currency,Hire Date
  E1001,John,Doe,Male,Engineer,72000,NOK,15.03.2019
  E1002,Jane,Roe,Female,Manager,84000,NOK,01.06.2020
  ```

  `packages/import/fixtures/personec-no.csv` (`Fodselsdato` DD.MM.YYYY with o-slash, `Grunnlonn`, `Mann`/`Kvinne`, fraction FTE `0,8`; B4, D3, D4; semicolon). Type `Fodselsdato`/`Kjonn`/`Grunnlonn` with real o-slash (ø) so Plan A's fold fix is exercised:

  ```
  Ansattnr;Fornavn;Etternavn;Kjønn;Stilling;Grunnlønn;Fødselsdato;Stillingsprosent
  N1;Ola;Nordmann;Mann;Ingeniør;540000;12.05.1987;0,8
  N2;Kari;Nordmann;Kvinne;Leder;620000;03.11.1990;1,0
  ```

  `packages/import/fixtures/sap-successfactors.csv` (`PERNR`/`PLANS`/`GESCH`/`ANSAL`, GESCH `1`/`2`; D7, P6; comma-delimited):

  ```
  PERNR,PLANS,GESCH,ANSAL
  00010001,Senior Consultant,1,720000
  00010002,Consultant,2,540000
  ```

  `packages/import/fixtures/fortnox-sv.csv` (full canonical sv; regression companion to DC-16; semicolon). Use real Swedish letters (ö, å, ä):

  ```
  Anstnr;Fornamn;Efternamn;Kon;Befattning;Manadslon;Fodelsedatum;Anstallningsdatum;Sysselsattningsgrad
  300;Anna;Svensson;Kvinna;Analytiker;49788;1985-06-12;2019-03-01;100
  301;Erik;Lindqvist;Man;Produktchef;65000;1990-11-30;2021-08-15;80
  ```

  NOTE: For any fixture header carrying a non-ASCII letter (ø, å, ä, ö, æ), type it as a real UTF-8 character via the Write tool. After creating all fixtures, verify no mojibake:

  ```
  cd /Volumes/development/blueprnt/frontend && grep -l "Ã" packages/import/fixtures/*.csv && echo "MOJIBAKE" || echo "clean"
  ```

  Expected: `clean`.

- [ ] **Step 2: Create the binary fixture from raw magic bytes.**

  Write `packages/import/fixtures/binary.xlsx` containing exactly the ZIP local-file-header signature followed by a short marker, so the tokenizer's binary guard fires. Use a Node one-liner (this is fixture setup, not engine code):

  ```
  cd /Volumes/development/blueprnt/frontend && node -e 'require("fs").writeFileSync("packages/import/fixtures/binary.xlsx", Buffer.from([0x50,0x4b,0x03,0x04,0x14,0x00,0x06,0x00,0x08,0x00]))'
  ```

  Confirm the first bytes:

  ```
  cd /Volumes/development/blueprnt/frontend && node -e 'const b=require("fs").readFileSync("packages/import/fixtures/binary.xlsx"); console.log([...b.slice(0,4)].map(x=>x.toString(16)))'
  ```

  Expected: `[ '50', '4b', '3', '4' ]`.

- [ ] **Step 3: Write the failing pipeline test.**

  Create `packages/import/src/pipeline.test.ts`:

  ```ts
  import { readFileSync } from "node:fs"
  import { fileURLToPath } from "node:url"
  import { dirname, join } from "node:path"
  import { describe, expect, it } from "vitest"
  import { detectColumns } from "./detect.js"
  import { tokenizeCsv } from "./tokenize.js"
  import { validateFile, validateImport } from "./validate.js"

  const FIXTURES = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures"
  )
  const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8")

  function runCsv(name: string) {
    const text = read(name)
    const tokenized = tokenizeCsv(text)
    const mapping = detectColumns(tokenized)
    // Thread the tokenizer's structural signals into validateImport (always
    // present on a TokenizeResult; drives raggedRow / noDelimiter emission).
    const validation = validateImport(tokenized, mapping, {}, tokenized.signals)
    return { tokenized, mapping, validation }
  }

  const REQUIRED = ["externalRef", "title", "gender", "basicMonthly"] as const

  describe("pipeline: visma-sv (LOCK, B1-ok)", () => {
    it("maps the 4 required fields with no blocking", () => {
      const { mapping, validation } = runCsv("visma-sv.csv")
      for (const key of REQUIRED) {
        expect(mapping.map[key]).toBeDefined()
      }
      expect(validation.blocking).toHaveLength(0)
    })
  })

  describe("pipeline: hogia-sv (B2 comma-decimal Grundlon)", () => {
    it("maps basicMonthly and reports no unparsableMoney", () => {
      const { mapping, validation } = runCsv("hogia-sv.csv")
      expect(mapping.map.basicMonthly).toBeDefined()
      expect(
        validation.issues.filter((i) => i.code === "unparsableMoney")
      ).toHaveLength(0)
    })
  })

  describe("pipeline: workday-en (B3 bare int, Female, DD.MM.YYYY)", () => {
    it("maps basicMonthly and employmentStartDate, no blocking", () => {
      const { mapping, validation } = runCsv("workday-en.csv")
      expect(mapping.map.basicMonthly).toBeDefined()
      expect(mapping.map.employmentStartDate).toBeDefined()
      expect(mapping.map.gender).toBeDefined()
      expect(validation.blocking).toHaveLength(0)
    })
  })

  describe("pipeline: personec-no (B4, D3, D4 fraction FTE + fold fix)", () => {
    it("maps birthDate, basicMonthly, gender and flags fractionScaled", () => {
      const { mapping, validation } = runCsv("personec-no.csv")
      expect(mapping.map.birthDate).toBeDefined()
      expect(mapping.map.basicMonthly).toBeDefined()
      expect(mapping.map.gender).toBeDefined()
      const scaled = validation.issues.filter(
        (i) => i.code === "fractionScaled"
      )
      expect(scaled.length).toBeGreaterThanOrEqual(2)
      // No row should be flagged unresolvedGender (Mann/Kvinne resolve).
      expect(
        validation.issues.filter((i) => i.code === "unresolvedGender")
      ).toHaveLength(0)
    })
  })

  describe("pipeline: sap-successfactors (D7, P6 SAP codes + numeric gender)", () => {
    it("maps externalRef, title, gender, basicMonthly with no blocking", () => {
      const { mapping, validation } = runCsv("sap-successfactors.csv")
      expect(mapping.map.externalRef).toBeDefined()
      expect(mapping.map.title).toBeDefined()
      expect(mapping.map.gender).toBeDefined()
      expect(mapping.map.basicMonthly).toBeDefined()
      expect(validation.blocking).toHaveLength(0)
      // GESCH 1/2 resolve under a gender header -> no unresolvedGender.
      expect(
        validation.issues.filter((i) => i.code === "unresolvedGender")
      ).toHaveLength(0)
    })
  })

  describe("pipeline: fortnox-sv (regression companion to DC-16)", () => {
    it("maps all required fields with no blocking", () => {
      const { mapping, validation } = runCsv("fortnox-sv.csv")
      for (const key of REQUIRED) {
        expect(mapping.map[key]).toBeDefined()
      }
      expect(validation.blocking).toHaveLength(0)
    })
  })

  describe("pipeline: binary.xlsx (A1, A4 invalidFileFormat)", () => {
    it("returns invalidFileFormat blocking, not missing-columns", () => {
      const text = read("binary.xlsx")
      const validation = validateFile(text, { map: {}, unmappedColumns: [] }, {})
      expect(validation.fileFormatError).toBe("invalidFileFormat")
      expect(validation.blocking).toContain("invalidFileFormat")
      expect(validation.blocking).not.toContain("basicMonthly")
    })
  })
  ```

- [ ] **Step 4: Run the pipeline test.**

  ```
  cd packages/import && bunx vitest run src/pipeline.test.ts
  ```

  Expected: the visma-sv LOCK passes; the others PASS only because Plans A and B have merged (comma-decimal money, DD.MM dates, fold fix, fraction FTE, SAP synonyms, numeric gender). If a non-binary fixture fails, the failure names exactly which contract from Plan A or B is missing; treat that as a real integration signal (Plans A and B must have merged before Plan C runs, per the execution ordering). The binary case passes from Task 1.

- [ ] **Step 5: Run the full `packages/import` suite to confirm no regression.**

  ```
  cd packages/import && bunx vitest run
  ```

  Expected: all suites PASS (tokenize, shape, detect, parse, validate, issue-codes, pipeline).

- [ ] **Step 6: Commit.**

  ```
  git add packages/import/fixtures packages/import/src/pipeline.test.ts
  git commit -m "test(import): end-to-end fixtures and tokenize-detect-validate pipeline suite"
  ```

---

### Task 6: Optional mojibake / raggedRow / noDelimiter signals

**Files:**
- Modify: `packages/import/src/validate.ts`
- Test: `packages/import/src/validate.test.ts`

**Interfaces:**

Consumes:
- Plan A's `tokenizeCsv` returns a `TokenizeResult` whose `signals` object is ALWAYS present: `type TokenizeSignals = { preambleRowsSkipped: number; raggedRows: number[]; duplicateHeaders: string[]; blankHeaderColumns: number[]; noDelimiter: boolean }` (every field present, zero/empty when nothing detected). Plan C reads `signals.raggedRows` (0-based data-row indices that were padded/truncated) and `signals.noDelimiter` (true when a single-column file was detected). `validateImport` takes `signals` as an optional param (a direct caller may omit it); when passed via `validateFile`/the pipeline it is always the tokenizer's real object.
- `input.headers` for the mojibake header scan (no tokenizer dependency needed for that one).

Produces:
- `RowIssueCode` gains `"raggedRow"`. Full union becomes the Task 3 union plus `"raggedRow"`.
- A file-level warning list: `ImportValidation` gains `fileWarnings?: ("noDelimiter" | "mojibake")[]`. These are file-scoped (not per-row), so they are NOT `RowIssue`s. The wizard shows them once, not per row.
- `validateImport` gains an optional fourth parameter `signals?: TokenizeSignals` so the caller can pass the tokenizer's signals through. When omitted, `raggedRow`/`noDelimiter` are simply not emitted (backward compatible; existing callers pass three args).

**Decision (recorded here):** These are scoped INTO this plan (not deferred), because they are cheap and the i18n keys already shipped in Task 4. `mojibake` is detected from `input.headers` alone (no tokenizer coupling): a file is flagged when 2 or more headers contain a double-encoding sequence (`Ã¥`, `Ã¶`, `Ã¤`, `Ã¸`, `Ã¦`). `raggedRow` maps each `signals.raggedRows` index to a per-row issue. `noDelimiter` becomes a single `fileWarnings` entry. If a future reviewer wants to defer this task, delete the `raggedRow`/`noDelimiter`/`mojibake` i18n keys from all five locale files in the same commit so parity holds; the union additions and `fileWarnings` field are removed too.

- [ ] **Step 1: Write the failing tests (ENC-04 mojibake, T19/T20 raggedRow, T38 noDelimiter).**

  Append to `packages/import/src/validate.test.ts`:

  ```ts
  describe("validateImport — mojibake / ragged / noDelimiter signals", () => {
    it("flags mojibake when 2+ headers contain double-encoding sequences (ENC-04)", () => {
      const headers = ["KÃ¶n", "LÃ¶n", "Namn"]
      const result = validateImport({ headers, rows: [] }, { map: {}, unmappedColumns: [] }, {})
      expect(result.fileWarnings).toContain("mojibake")
    })

    it("does not flag mojibake for clean headers", () => {
      const result = validateImport(
        { headers: HEADERS, rows: ROWS },
        FULL_MAPPING,
        {}
      )
      expect(result.fileWarnings ?? []).not.toContain("mojibake")
    })

    it("emits raggedRow per index from tokenizer signals (T19/T20)", () => {
      const result = validateImport(
        { headers: HEADERS, rows: ROWS },
        FULL_MAPPING,
        {},
        { raggedRows: [1, 3] }
      )
      const ragged = result.issues.filter((i) => i.code === "raggedRow")
      expect(ragged.map((i) => i.row).sort()).toEqual([1, 3])
    })

    it("emits noDelimiter file warning from tokenizer signal (T38)", () => {
      const result = validateImport(
        { headers: ["employee salary department"], rows: [["a b c"]] },
        { map: {}, unmappedColumns: [] },
        {},
        { noDelimiter: true }
      )
      expect(result.fileWarnings).toContain("noDelimiter")
    })
  })
  ```

- [ ] **Step 2: Run and confirm FAIL.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  ```

  Expected: FAIL. `raggedRow` is not a `RowIssueCode`, `fileWarnings` does not exist, and `validateImport` takes only three args.

- [ ] **Step 3: Implement the signals (minimal code).**

  In `packages/import/src/validate.ts`, add the union member and the `fileWarnings` field:

  ```ts
  export type RowIssueCode =
    | "duplicateId"
    | "unparsableMoney"
    | "nonNumericCode"
    | "unresolvedGender"
    | "genderNameMismatch"
    | "fractionScaled"
    | "ambiguousDate"
    | "negativeValue"
    | "raggedRow"

  export type FileWarningCode = "noDelimiter" | "mojibake"
  ```

  Note: `TokenizeSignals` is DEFINED by Plan A in `tokenize.ts` (always-present fields) and re-exported from `index.ts`. Do NOT redeclare it here. Import the type so `validate.ts` and `index.ts` reference the single Plan A definition:

  ```ts
  import type { TokenizeSignals } from "./tokenize.js"
  ```

  For reference, Plan A's shape is: `{ preambleRowsSkipped: number; raggedRows: number[]; duplicateHeaders: string[]; blankHeaderColumns: number[]; noDelimiter: boolean }` (every field present, zero/empty when nothing detected). Plan C reads only `raggedRows` and `noDelimiter`.

  Add `fileWarnings` to `ImportValidation`:

  ```ts
  export type ImportValidation = {
    readiness: ReadinessEntry[]
    blocking: (CanonicalFieldKey | BlockingIssueCode)[]
    warnings: CanonicalFieldKey[]
    issues: RowIssue[]
    fileFormatError?: BlockingIssueCode
    /** File-scoped warnings (shown once, not per row). */
    fileWarnings?: FileWarningCode[]
  }
  ```

  Change the `validateImport` signature to accept the optional signals:

  ```ts
  export function validateImport(
    input: { headers: string[]; rows: string[][] },
    mapping: DetectedMapping,
    opts: ValidateOpts,
    signals?: TokenizeSignals
  ): ImportValidation {
  ```

  Add a mojibake header scan near the top of the function body (after `const { rows } = input`):

  ```ts
  const { headers } = input
  const MOJIBAKE = /Ã¥|Ã¶|Ã¤|Ã¸|Ã¦/
  const mojibakeCount = headers.filter((h) => MOJIBAKE.test(h)).length
  const fileWarnings: FileWarningCode[] = []
  if (mojibakeCount >= 2) fileWarnings.push("mojibake")
  if (signals?.noDelimiter === true) fileWarnings.push("noDelimiter")
  ```

  After the per-row loop, before `return`, emit the ragged-row issues:

  ```ts
  if (signals?.raggedRows) {
    for (const row of signals.raggedRows) {
      issues.push({
        row,
        code: "raggedRow",
        detail: `row ${row} has the wrong number of columns`,
      })
    }
  }
  ```

  Update the return to include `fileWarnings` only when non-empty (keep the clean-fixture test's `issues`/`blocking`/`warnings` assertions valid; `fileWarnings` is optional):

  ```ts
  return {
    readiness,
    blocking,
    warnings,
    issues,
    ...(fileWarnings.length > 0 ? { fileWarnings } : {}),
  }
  ```

  Also thread `signals` through `validateFile` (now typed as the full `TokenizeResult`, whose `signals` is always present) so the pipeline passes the tokenizer's structural signals into `validateImport`:

  ```ts
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
    // signals is always present on a TokenizeResult (Plan A); thread it through.
    return validateImport(input, mapping, opts, input.signals)
  }
  ```

- [ ] **Step 4: Export the new types.**

  In `packages/import/src/index.ts`, add `FileWarningCode` to the `validate.js` type export. Do NOT re-export `TokenizeSignals` from `./validate.js`: it is Plan A's type, already exported from `./tokenize.js` (Plan A Task 6/7). Re-exporting the same name from two modules is a duplicate-export error.

  ```ts
  export type {
    BlockingIssueCode,
    FileWarningCode,
    ImportValidation,
    RowIssue,
    RowIssueCode,
    ReadinessEntry,
    ValidateOpts,
  } from "./validate.js"
  ```

- [ ] **Step 5: Run the validate suite and the full package suite; confirm PASS.**

  ```
  cd packages/import && bunx vitest run src/validate.test.ts
  cd packages/import && bunx vitest run
  ```

  Expected: PASS. The clean-fixture test still passes because `fileWarnings` is absent (empty) for clean headers and no signals.

- [ ] **Step 6: Commit.**

  ```
  git add packages/import/src/validate.ts packages/import/src/index.ts packages/import/src/validate.test.ts
  git commit -m "feat(import): optional mojibake, raggedRow, and noDelimiter validate signals"
  ```

---

## Boundary note: wizard scope

Plan C touches `apps/dashboard` in exactly one place: the `invalidFileFormat` wiring in `upload-step.tsx` (Task 4, Step 4), because that is the single caller boundary where the tokenizer's typed error becomes the "export as CSV" message (the primary Decision-2 deliverable). Everything else on the wizard side is explicitly OUT of scope for this plan:

- The per-row "assign gender" UI that collects a manual `Man`/`Kvinna` for every `unresolvedGender`-flagged row is **Plan 5**, not this plan. Plan C only emits the per-row flag; the engine does the flagging, the wizard does the assignment later.
- The x100 scaling of a fractional FTE column at import/preview time is a CONSUMER obligation, not an engine one. Plan C only detects the fractional column and emits the `fractionScaled` warning; it never multiplies a stored value. The backend import action and the wizard preview must call `parsePercent(cell, { fraction: true })` for a column validate flagged fractional. This is out of scope here (engine-only) and is captured in the "Consumer wiring (follow-on)" note below.
- Rendering the `fractionScaled` / `ambiguousDate` / `negativeValue` / `raggedRow` / `noDelimiter` / `mojibake` labels in the check step needs no wizard code change: `check-step.tsx` already iterates `RowIssueCode` and renders `check.issue.<code>` generically, so the new codes resolve once the i18n keys exist (Task 4). Surfacing `fileWarnings` (the file-scoped `noDelimiter`/`mojibake`) as a distinct section in the check step is a small wizard enhancement that may be done here or deferred to Plan 5; if deferred, the labels still exist and no engine behavior regresses.
- Byte-level encoding recovery (UTF-16 re-decode, Windows-1252 mojibake fix) stays a wizard/caller responsibility (spec Out of scope); Plan C only warns on mojibake header sequences, it does not re-decode.

## Consumer wiring (follow-on)

The following consumer edits depend on the engine codes/flags Plans A, B, and C produce, but are OUT OF SCOPE for Plans A/B/C (which are engine-only, `packages/import`). They are a SEPARATE follow-on plan (a wizard/backend plan, e.g. Plan 5), listed here so the boundary is explicit and nothing silently lands in `packages/import`:

- **(a) Fractional FTE x100 scaling.** The backend import action `packages/backend/convex/people/import.ts` and the wizard preview must pass `{ fraction: true }` to `parsePercent` for an `ftePercent` column that validate flagged as fractional (the `fractionScaled` warning). The engine exposes the flag (Plan B's `parsePercent(v, { fraction: true })`) and the per-column detection (Plan C's `fractionScaled`); the consumer performs the actual scaling of the stored/previewed value.
- **(b) `invalidFileFormat` "export as CSV" surfacing.** Beyond the minimal `upload-step.tsx` boundary Task 4 wires, the full wizard UX that renders the `invalidFileFormat` blocking signal as an "export as CSV" guidance screen is a consumer concern.
- **(c) Per-row assign-gender UI.** The wizard UI that collects a manual `Man`/`Kvinna` for every `unresolvedGender`-flagged row (Plan C only emits the flag).

None of (a), (b), (c) modify `packages/import`; they consume its typed codes/flags. Do NOT implement them in Plans A/B/C.
