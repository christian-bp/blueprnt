# Import Robustness Plan A: Pure Bug/Parity Fixes, Tokenizer Overhaul, Binary Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax.

**Goal:** Fix the confirmed pure bugs and locale-parity gaps in the `@workspace/import` CSV engine (fold, `lon` landmine, nb/da/fi gender/boolean words, shape-only false positives, id preservation) and overhaul the tokenizer with a typed binary-signature guard, unblocking Norwegian and Danish end to end without touching any documented spec choice.

**Architecture:** `packages/import` is a pure, deterministic engine (ADR-0002): `fold`/synonyms (`fields.ts`) feed `classifyColumn` (`shape.ts`) and `detectColumns` (`detect.ts`); total value parsers live in `parse.ts`; `tokenizeCsv` (`tokenize.ts`) turns raw text into headers + rows. This plan changes only the non-spec-conflicting parts: it does NOT expand `parseMoney`/`parseDate`/`parsePercent` number or date formats (that is Plan B), and it does NOT wire new validate signals (that is Plan C). It introduces one deliberate throwing path: the binary-signature guard in `tokenizeCsv`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), papaparse, Vitest 4.

## Global Constraints

- The engine stays pure and deterministic: no clock (`Date.now()`), no network, no randomness in its logic; identical on client and server; any date heuristic needing a "current year" takes an explicit reference-year parameter from the caller, never the clock (no such heuristic ships in Plan A).
- Locale parity across en/sv/nb/da/fi is a hard requirement: every parser/detector change must behave correctly in all five locales; a format that works in sv but not nb/da/fi does not meet the contract.
- Value parsers stay total: they return `null` on unparseable input and never throw. The SOLE exception is the new binary-signature guard in `tokenizeCsv`, which throws a typed `ImportFormatError` by design.
- Tests run with Vitest 4 via `cd packages/import && bunx vitest run <file>` (never `bun test`).
- New code ships with tests in the same commit.
- English identifiers and comments only; no em dashes in any text we write.
- Plan A must not touch `parseMoney`/`parseDate`/`parsePercent` number/date FORMAT rules (Plan B owns the format expansion) and must not modify `validate.ts` (Plan C owns the new codes).

---

### Task 1: `fields.ts` fold pre-NFD substitution, remove `lon` landmine, add nb/da/fi/SAP/Workday synonyms

**Files:**
- Modify: `packages/import/src/fields.ts`
- Test: `packages/import/src/fields.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `fold(s: string): string` (unchanged signature; new behavior: `o-slash` U+00F8/U+00D8 folds to `"o"`, `ae` ligature U+00E6/U+00C6 folds to `"ae"`, applied before NFD).
  - `CANONICAL_FIELDS: readonly FieldDef[]` (unchanged type; new synonyms per contract; bare `lon` removed from `basicMonthly`).

- [ ] **Step 1: Write the failing fold test (ENC-05, DC-13, DC-14).**
  Add to `packages/import/src/fields.test.ts` inside the existing `describe("fold", ...)`:
  ```ts
  it("folds Norwegian o-slash to o so nb headers survive (ENC-05, DC-13)", () => {
    expect(fold("Kjønn")).toBe("kjonn")
    expect(fold("Grunnlønn")).toBe("grunnlonn")
    expect(fold("Fødselsdato")).toBe("fodselsdato")
  })

  it("folds Danish ae ligature to ae so da headers survive (ENC-05, DC-14)", () => {
    expect(fold("Køn")).toBe("koen")
    expect(fold("Beskæftigelsesgrad")).toBe("beskaeftigelsesgrad")
  })

  it("uppercase o-slash and AE ligature fold identically", () => {
    expect(fold("KJØNN")).toBe("kjonn")
    expect(fold("ÆRE")).toBe("aere")
  })
  ```
- [ ] **Step 2: Run the test, expect FAIL.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: the three new tests fail (`fold("Kjønn")` currently returns `"kjnn"` because NFD does not decompose `ø`).
- [ ] **Step 3: Implement the pre-NFD substitution table in `fold`.**
  Replace the `fold` function in `packages/import/src/fields.ts` with:
  ```ts
  // Letters that NFD does not decompose to a base ASCII letter. Substituted
  // before NFD so they survive the combining-diacritic and non-alphanumeric
  // strips below. Fixed table, locale-independent, keeps fold pure.
  const PRE_NFD_SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
    [/[øØ]/g, "o"], // o-slash (Norwegian/Danish) -> o
    [/[æÆ]/g, "ae"], // ae ligature (Danish/Norwegian) -> ae
  ]

  /**
   * Normalize a raw CSV header for synonym lookup:
   * pre-NFD substitute the letters NFD cannot decompose (o-slash, ae ligature),
   * then lowercase, NFD-decompose, strip combining diacritics, strip non-alphanumerics.
   */
  export function fold(s: string): string {
    let out = s
    for (const [pattern, replacement] of PRE_NFD_SUBSTITUTIONS) {
      out = out.replace(pattern, replacement)
    }
    return out
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
  }
  ```
  Note: the existing `.replace(/[̀-ͯ]/g, "")` is the combining-diacritic range written literally; keep it as the explicit `̀-ͯ` escape shown above so the range is unambiguous.
- [ ] **Step 4: Run the fold test, expect PASS.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: all `fold` tests pass, including the existing `fold("Kön")` -> `"kon"` (unaffected, `ö` still decomposes via NFD).
- [ ] **Step 5: Write the failing synonym test (DC-15, DC-25, DC-03, DC-06, DC-13, DC-14, DC-17, DC-23, D3, D4, D7).**
  Add a new `describe` block to `packages/import/src/fields.test.ts`:
  ```ts
  describe("CANONICAL_FIELDS synonyms after Plan A additions", () => {
    const byKey = Object.fromEntries(
      CANONICAL_FIELDS.map((f) => [f.key, f.synonyms])
    )

    it("removes the bare lon substring landmine from basicMonthly (DC-25)", () => {
      expect(byKey.basicMonthly).not.toContain("lon")
    })

    it("adds Finnish person-number and SAP pernr to externalRef (DC-15, D7)", () => {
      expect(byKey.externalRef).toContain("henkilonro")
      expect(byKey.externalRef).toContain("pernr")
    })

    it("adds fi/nb/da/Workday/SAP salary synonyms to basicMonthly (DC-15, DC-13, DC-14, DC-17, D5, D7)", () => {
      for (const syn of [
        "peruspalkka",
        "kuukausipalkka",
        "grunnlonn",
        "grundlonn",
        "manadsarvode",
        "arvode",
        "basepay",
        "salary",
        "annualsalary",
        "grosssalary",
        "ansal",
      ]) {
        expect(byKey.basicMonthly, `basicMonthly missing ${syn}`).toContain(syn)
      }
    })

    it("adds fi/Personec/SAP title synonyms (DC-15, DC-17, D7)", () => {
      for (const syn of ["tehtavanimike", "nimike", "tjanstebenamning", "benamning", "plans"]) {
        expect(byKey.title, `title missing ${syn}`).toContain(syn)
      }
    })

    it("adds SAP gesch header synonym to gender (D7)", () => {
      expect(byKey.gender).toContain("gesch")
    })

    it("adds Agda tj.grad synonyms to ftePercent (DC-03)", () => {
      for (const syn of ["tjgrad", "tjgradprocent", "tjanstggrad"]) {
        expect(byKey.ftePercent, `ftePercent missing ${syn}`).toContain(syn)
      }
    })

    it("adds Norwegian fodselsdato to birthDate (D3, B4)", () => {
      expect(byKey.birthDate).toContain("fodselsdato")
    })

    it("adds Norwegian first/last name synonyms (D3)", () => {
      expect(byKey.firstName).toContain("fornavn")
      expect(byKey.lastName).toContain("etternavn")
    })

    it("adds Agda/Personec employment-start synonyms (DC-06, DC-23)", () => {
      for (const syn of ["anstdag", "anstdatum", "mandag"]) {
        expect(byKey.employmentStartDate, `employmentStartDate missing ${syn}`).toContain(syn)
      }
    })
  })
  ```
- [ ] **Step 6: Run the synonym test, expect FAIL.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: the new block fails (bare `lon` still present; nb/da/fi/SAP synonyms absent).
- [ ] **Step 7: Edit the `FIELDS` synonym lists in `packages/import/src/fields.ts`.**
  In `externalRef.synonyms`, append `"henkilonro"`, `"pernr"`.
  In `title.synonyms`, append `"tehtavanimike"`, `"nimike"`, `"tjanstebenamning"`, `"benamning"`, `"plans"`.
  In `gender.synonyms`, append `"gesch"`.
  In `basicMonthly.synonyms`, DELETE `"lon"`, and append `"peruspalkka"`, `"kuukausipalkka"`, `"grunnlonn"`, `"grundlonn"`, `"manadsarvode"`, `"arvode"`, `"basepay"`, `"salary"`, `"annualsalary"`, `"grosssalary"`, `"ansal"`. (These are already lowercase ASCII; `normalizeSynonyms` re-folds them so they stay valid.)
  In `ftePercent.synonyms`, append `"tjgrad"`, `"tjgradprocent"`, `"tjanstggrad"`.
  In `birthDate.synonyms`, append `"fodselsdato"`.
  In `firstName.synonyms`, append `"fornavn"`.
  In `lastName.synonyms`, append `"etternavn"`.
  In `employmentStartDate.synonyms`, append `"anstdag"`, `"anstdatum"`, `"mandag"`.
  Do NOT add `arslon` to `payYear` or `annualSalary` (the spec defers the distinct annual field; `Grundlon/ar` intentionally lands unmapped per DC-05).
- [ ] **Step 8: Run the fields test, expect PASS.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: all fields tests pass, including the existing "each field's synonym list has no duplicates" and "synonyms are already folded" locks.
- [ ] **Step 9: Commit.**
  `git add packages/import/src/fields.ts packages/import/src/fields.test.ts && git commit -m "fix(import): fold Nordic o-slash/ae and remove lon landmine, add nb/da/fi synonyms"`

---

### Task 2: `fields.ts` minimum-length substring guard for synonym matching

**Files:**
- Modify: `packages/import/src/fields.ts`
- Test: `packages/import/src/fields.test.ts`

**Interfaces:**
- Consumes: `fold(s: string): string`, `CANONICAL_FIELDS` (Task 1).
- Produces:
  - `SUBSTRING_MIN_LENGTH: number` (exported const, value `5`) — the minimum folded synonym length for the substring-contains branch used by `detect.ts` `headerScore`.
  - `matchesSynonym(folded: string, synonyms: readonly string[]): { exact: boolean; substring: boolean }` (exported helper) — returns whether `folded` exactly equals any synonym, and whether it contains any synonym of at least `SUBSTRING_MIN_LENGTH` folded characters. `detect.ts` (Task 3) consumes this so the substring rule and the guard live in one place (DRY).

- [ ] **Step 1: Write the failing guard test (DC-25).**
  Add a new `describe` block to `packages/import/src/fields.test.ts`:
  ```ts
  describe("matchesSynonym substring guard", () => {
    it("exposes a minimum substring length of 5", () => {
      expect(SUBSTRING_MIN_LENGTH).toBe(5)
    })

    it("matches an exact synonym regardless of length", () => {
      const r = matchesSynonym("kon", ["kon", "gender"])
      expect(r.exact).toBe(true)
      expect(r.substring).toBe(false)
    })

    it("matches a long synonym as a substring", () => {
      const r = matchesSynonym("bruttomanadslon", ["manadslon"])
      expect(r.substring).toBe(true)
    })

    it("does NOT substring-match a synonym shorter than 5 chars (guards against future short landmines)", () => {
      // "fte" is 3 chars; must not fire inside "software" or similar.
      const r = matchesSynonym("softe", ["fte"])
      expect(r.exact).toBe(false)
      expect(r.substring).toBe(false)
    })

    it("still exact-matches a short synonym", () => {
      const r = matchesSynonym("fte", ["fte"])
      expect(r.exact).toBe(true)
    })
  })
  ```
  Add `SUBSTRING_MIN_LENGTH` and `matchesSynonym` to the import at the top of `fields.test.ts`:
  ```ts
  import { CANONICAL_FIELDS, fold, matchesSynonym, SUBSTRING_MIN_LENGTH } from "./fields.js"
  ```
- [ ] **Step 2: Run the test, expect FAIL.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: fails to import `matchesSynonym`/`SUBSTRING_MIN_LENGTH` (not yet exported).
- [ ] **Step 3: Implement the guard in `packages/import/src/fields.ts`.**
  Add after the `fold` function:
  ```ts
  /**
   * Minimum folded length for a synonym to participate in the substring-contains
   * branch of header scoring. Short synonyms (< 5 folded chars) match by exact
   * compare only, so they cannot fire inside longer unrelated words (DC-25).
   */
  export const SUBSTRING_MIN_LENGTH = 5

  /**
   * Test a folded header against a synonym list.
   * `exact` is true when the folded header equals a synonym.
   * `substring` is true when the folded header contains a synonym of at least
   * SUBSTRING_MIN_LENGTH folded characters. Short synonyms never contribute to
   * `substring`; they must match exactly.
   */
  export function matchesSynonym(
    folded: string,
    synonyms: readonly string[]
  ): { exact: boolean; substring: boolean } {
    for (const syn of synonyms) {
      if (folded === syn) return { exact: true, substring: false }
    }
    for (const syn of synonyms) {
      if (syn.length >= SUBSTRING_MIN_LENGTH && folded.includes(syn)) {
        return { exact: false, substring: true }
      }
    }
    return { exact: false, substring: false }
  }
  ```
- [ ] **Step 4: Run the test, expect PASS.**
  `cd packages/import && bunx vitest run src/fields.test.ts`
  Expected: all `matchesSynonym` tests pass.
- [ ] **Step 5: Export the new symbols from `index.ts`.**
  In `packages/import/src/index.ts`, extend the first export line:
  ```ts
  export { CANONICAL_FIELDS, fold, matchesSynonym, SUBSTRING_MIN_LENGTH } from "./fields.js"
  ```
- [ ] **Step 6: Commit.**
  `git add packages/import/src/fields.ts packages/import/src/fields.test.ts packages/import/src/index.ts && git commit -m "feat(import): add minimum-length substring guard for synonym matching"`

---

### Task 3: `detect.ts` restrict shape-only fallback, exclude header-losers/blank headers, respect substring guard

**Files:**
- Modify: `packages/import/src/detect.ts`
- Test: `packages/import/src/detect.test.ts`

**Interfaces:**
- Consumes: `matchesSynonym`, `SUBSTRING_MIN_LENGTH`, `CANONICAL_FIELDS`, `fold` (Tasks 1-2); `classifyColumn(values: string[]): { shape: ValueShape; confidence: number; ... }` (Task 5 will extend the return type; Task 3 uses only `.shape`).
- Produces: `detectColumns(input: { headers: string[]; rows: string[][] }): DetectedMapping` (unchanged signature; new behavior: shape-only pass restricted to distinctive shapes, excludes header-candidate losers and blank-header columns, uses `matchesSynonym`).

- [ ] **Step 1: Write the failing detect tests (DC-13, DC-15, DC-09, DC-10, DC-22, DC-25).**
  Add a new `describe` block to `packages/import/src/detect.test.ts`:
  ```ts
  describe("detectColumns — Plan A restrictions and Nordic mappings", () => {
    it("maps a full Norwegian file after the fold fix (DC-13)", () => {
      const headers = ["Ansattnr", "Kjønn", "Grunnlønn", "Stilling"]
      const rows = [
        ["10042", "Mann", "52 000", "Utvikler"],
        ["10043", "Kvinne", "61 000", "Leder"],
      ]
      const result = detectColumns({ headers, rows })
      expect(result.map.externalRef?.columnIndex).toBe(0)
      expect(result.map.gender?.columnIndex).toBe(1)
      expect(result.map.basicMonthly?.columnIndex).toBe(2)
      expect(result.map.title?.columnIndex).toBe(3)
    })

    it("maps a Finnish file without the lon landmine (DC-15, DC-25)", () => {
      const headers = ["Henkilönro", "Peruspalkka", "Tehtävänimike"]
      const rows = [
        ["114 77", "3200", "Insinööri"],
        ["225 88", "3600", "Päällikkö"],
      ]
      const result = detectColumns({ headers, rows })
      expect(result.map.externalRef?.columnIndex).toBe(0)
      expect(result.map.basicMonthly?.columnIndex).toBe(1)
      expect(result.map.title?.columnIndex).toBe(2)
    })

    it("routes unknown text/id/percent columns to unmappedColumns, not shape-only fields (DC-09)", () => {
      const headers = ["Anstnr", "Kostnadskonto", "Hemort", "Lönenivå"]
      const rows = [
        ["10042", "7010", "Stockholm", "3"],
        ["10043", "7020", "Göteborg", "5"],
      ]
      const result = detectColumns({ headers, rows })
      // Only externalRef (Anstnr header) is mapped; the rest are unmapped.
      expect(result.map.externalRef?.columnIndex).toBe(0)
      expect(result.unmappedColumns).toContain(1) // Kostnadskonto (id) not shape-only assigned
      expect(result.unmappedColumns).toContain(2) // Hemort (text) not shape-only assigned
      expect(result.unmappedColumns).toContain(3) // Lönenivå (id) not shape-only assigned
    })

    it("sends a runner-up salary synonym to unmappedColumns instead of stealing it (DC-10)", () => {
      const headers = ["Lön", "Grundlön"]
      const rows = [
        ["52 000", "48 000"],
        ["61 000", "55 000"],
      ]
      const result = detectColumns({ headers, rows })
      // Lön wins basicMonthly; Grundlön (a header-candidate loser) is not stolen into variable.
      expect(result.map.basicMonthly?.columnIndex).toBe(0)
      expect(result.map.variable).toBeUndefined()
      expect(result.unmappedColumns).toContain(1)
    })

    it("routes a blank-header column straight to unmappedColumns (DC-22)", () => {
      const headers = ["Anstnr", "", "Månadslön"]
      const rows = [
        ["10042", "Anna", "52 000"],
        ["10043", "Erik", "61 000"],
      ]
      const result = detectColumns({ headers, rows })
      // The blank-header column (index 1) never earns firstName via shape-only.
      expect(result.map.firstName).toBeUndefined()
      expect(result.unmappedColumns).toContain(1)
    })

    it("still assigns a distinctive gender shape by shape-only when no header matches (DC-12 counter-lock)", () => {
      const headers = ["Anstnr", "Ukjentkolonne"]
      const rows = [
        ["10042", "Mann"],
        ["10043", "Kvinne"],
      ]
      const result = detectColumns({ headers, rows })
      expect(result.map.gender?.columnIndex).toBe(1)
    })
  })
  ```
- [ ] **Step 2: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/detect.test.ts`
  Expected: DC-09/DC-10/DC-22 assertions fail (shape-only currently absorbs text/id columns and reabsorbs header losers); the Norwegian/Finnish mappings may pass already (Task 1 fixed fold+synonyms) but the shape-only restrictions are new.
- [ ] **Step 3: Rewrite `headerScore` to use `matchesSynonym` and update the shape-only pass in `packages/import/src/detect.ts`.**
  Change the imports:
  ```ts
  import { type CanonicalFieldKey, CANONICAL_FIELDS, fold, matchesSynonym } from "./fields.js"
  import { classifyColumn } from "./shape.js"
  ```
  Replace `headerScore` with:
  ```ts
  /**
   * Score a raw header string against a field's synonym list.
   *   1.0 — folded header exactly equals a synonym
   *   0.7 — folded header contains a synonym of at least SUBSTRING_MIN_LENGTH chars
   *   0.0 — no match
   * The minimum-length substring guard lives in matchesSynonym (fields.ts) so
   * short synonyms (e.g. removed bare "lon") never fire inside longer words.
   */
  function headerScore(raw: string, synonyms: readonly string[]): number {
    const { exact, substring } = matchesSynonym(fold(raw), synonyms)
    if (exact) return 1.0
    if (substring) return 0.7
    return 0
  }
  ```
  Add a set of distinctive shapes above `detectColumns`:
  ```ts
  // Shapes distinctive enough to assign on shape alone (no header match).
  // text/id/percent are too common to earn a canonical field by shape only,
  // so a text/id/percent column with no header match lands in unmappedColumns.
  const SHAPE_ONLY_ELIGIBLE: ReadonlySet<string> = new Set(["gender", "boolean"])
  ```
  Inside `detectColumns`, after computing `colShapes`, track blank-header columns:
  ```ts
  // Columns whose folded header is empty are always unmapped (DC-22, ENC-16).
  const blankHeaderCols = new Set<number>()
  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    if (fold(headers[colIdx] ?? "").length === 0) blankHeaderCols.add(colIdx)
  }
  ```
  In the first pass, skip blank-header columns and record every column that produced a header candidate:
  ```ts
  const headerCandidates: Candidate[] = []
  const fieldsWithHeaderCandidate = new Set<CanonicalFieldKey>()
  const headerCandidateCols = new Set<number>()

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    if (blankHeaderCols.has(colIdx)) continue
    for (const [fIdx, field] of CANONICAL_FIELDS.entries()) {
      const hScore = headerScore(headers[colIdx] ?? "", field.synonyms)
      if (hScore === 0) continue

      const shapesMatch = colShapes[colIdx] === field.shape
      const score = shapesMatch ? Math.min(1.0, hScore + 0.2) : hScore
      headerCandidates.push({
        fieldKey: field.key,
        fieldIndex: fIdx,
        columnIndex: colIdx,
        score,
      })
      fieldsWithHeaderCandidate.add(field.key)
      headerCandidateCols.add(colIdx)
    }
  }
  ```
  Replace the second (shape-only) pass so it only emits distinctive shapes and excludes blank-header and header-candidate columns:
  ```ts
  // Second pass: shape-only candidates (score 0.4) for fields with no header
  // candidate. Restricted to distinctive shapes (gender/boolean); text/id/percent
  // never earn a field by shape alone (DC-09, DC-12, DC-21). A column that already
  // produced a header candidate (a runner-up synonym loser) is excluded so it is
  // not re-stolen into another field (DC-10, SC-14, SC-25). Blank-header columns
  // are excluded (DC-22, ENC-16).
  const shapeCandidates: Candidate[] = []
  for (const [fIdx, field] of CANONICAL_FIELDS.entries()) {
    if (fieldsWithHeaderCandidate.has(field.key)) continue
    if (!SHAPE_ONLY_ELIGIBLE.has(field.shape)) continue

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      if (blankHeaderCols.has(colIdx)) continue
      if (headerCandidateCols.has(colIdx)) continue
      if (colShapes[colIdx] === field.shape) {
        shapeCandidates.push({
          fieldKey: field.key,
          fieldIndex: fIdx,
          columnIndex: colIdx,
          score: 0.4,
        })
      }
    }
  }
  ```
  Leave the greedy assignment, tie-break, and `unmappedColumns` construction unchanged.
- [ ] **Step 4: Run the detect tests, expect PASS.**
  `cd packages/import && bunx vitest run src/detect.test.ts`
  Expected: the new block passes and all existing DC baseline locks (DC-01/04/07/08/11/16/18/19/20/24) still pass. Note: birthDate shape-only (DC-02) is now covered because `birthDate.shape === "date"` is not in `SHAPE_ONLY_ELIGIBLE`, so an `Alder` id-shaped column cannot be shape-only assigned to birthDate.
- [ ] **Step 5: Commit.**
  `git add packages/import/src/detect.ts packages/import/src/detect.test.ts && git commit -m "fix(import): restrict shape-only detection to distinctive shapes and exclude header losers"`

---

### Task 4: `shape.ts` postal-code money rule (thousands-pattern, no floor), personnummer id patterns, nb/da/fi gender + boolean values, fillRate signal

**Files:**
- Modify: `packages/import/src/shape.ts`
- Test: `packages/import/src/shape.test.ts`

**Interfaces:**
- Consumes: `fold` (Task 1).
- Produces:
  - `classifyColumn(values: string[]): { shape: ValueShape; confidence: number; fillRate: number; sampleSize: number }` — the return type gains `fillRate` (share of non-blank cells over total, 0..1) and `sampleSize` (count of non-blank cells). `confidence` semantics unchanged (match ratio among non-blank). Plan B extends the money/percent/date detectors on top of this shape; Plan C reads `fillRate`/`sampleSize`.
  - `GENDER_VALUES` gains `mann`, `kvinne` (nb), `mand`, `kvinde` (da), `mies`, `nainen` (fi), and `f` (en). Numeric `1`/`2` are NOT added (indistinguishable from small-int id; resolved only under a gender header in `parse.ts`).
  - `BOOLEAN_VALUES` gains `nei` (nb), `kylla`, `ei` (fi).
  - `isId` additionally accepts personnummer patterns `\d{8}-\d{4}` and `\d{6}-\d{4}`.

- [ ] **Step 1: Write the failing money-floor test (SC-05, SC-02, SC-24 lock).**
  Add to `packages/import/src/shape.test.ts`:
  ```ts
  describe("classifyColumn money vs postal-code / grouped-number (Plan A)", () => {
    it("classifies Swedish 3+2 postal codes as id, not money (SC-05)", () => {
      const result = classifyColumn(["114 55", "752 28", "211 20"])
      expect(result.shape).toBe("id")
    })

    it("classifies space-grouped employee numbers as id, not money (SC-02)", () => {
      const result = classifyColumn(["114 77", "225 88", "312 90"])
      expect(result.shape).toBe("id")
    })

    it("keeps a true thousands-grouped salary column as money (M05-M07 lock)", () => {
      const result = classifyColumn(["52 000", "61 000", "1 234 567"])
      expect(result.shape).toBe("money")
    })

    it("keeps a currency-suffixed single group as money (SC-24 lock)", () => {
      const result = classifyColumn(["9 500 kr", "8 200 kr"])
      expect(result.shape).toBe("money")
    })
  })
  ```
- [ ] **Step 2: Run the test, expect FAIL.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: the postal-code and grouped-employee-number cases fail (currently classify as money because any space group matches).
- [ ] **Step 3: Rewrite `isMoney` in `packages/import/src/shape.ts` with the thousands-pattern discriminator (no value floor).**
  Replace `isMoney` with:
  ```ts
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
  ```
- [ ] **Step 4: Run the money-floor test, expect PASS.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: postal codes and grouped employee numbers classify as `id`; thousands-grouped salaries and currency-suffixed money still classify as `money`. All existing SC money locks pass.
- [ ] **Step 5: Write the failing gender/boolean/personnummer-id tests (GEN-08/10/17/18, bool-04/05, id-03/04).**
  Add to `packages/import/src/shape.test.ts`:
  ```ts
  describe("classifyColumn Nordic gender / boolean / personnummer (Plan A)", () => {
    it("classifies a Norwegian Mann/Kvinne column as gender (GEN-08)", () => {
      expect(classifyColumn(["Mann", "Kvinne", "Mann"]).shape).toBe("gender")
    })

    it("classifies a Danish Mand/Kvinde column as gender (GEN-08)", () => {
      expect(classifyColumn(["Mand", "Kvinde", "Mand"]).shape).toBe("gender")
    })

    it("classifies a Finnish Mies/Nainen column as gender (GEN-08)", () => {
      expect(classifyColumn(["Mies", "Nainen", "Mies"]).shape).toBe("gender")
    })

    it("classifies an M/F column as gender (GEN-10, GEN-18)", () => {
      expect(classifyColumn(["M", "F", "M", "F"]).shape).toBe("gender")
      expect(classifyColumn(["F", "F", "F", "F"]).shape).toBe("gender")
    })

    it("classifies a Norwegian Ja/Nei column as boolean at full confidence (bool-04)", () => {
      const result = classifyColumn(["Ja", "Nei", "Ja", "Nei"])
      expect(result.shape).toBe("boolean")
      expect(result.confidence).toBe(1)
    })

    it("classifies a Finnish Kyllä/Ei column as boolean (bool-05)", () => {
      expect(classifyColumn(["Kyllä", "Ei", "Kyllä"]).shape).toBe("boolean")
    })

    it("classifies a full personnummer column as id (id-03)", () => {
      expect(classifyColumn(["19850612-1234", "19901130-5678"]).shape).toBe("id")
    })

    it("classifies a short personnummer column as id (id-04)", () => {
      expect(classifyColumn(["850612-1234", "901130-5678"]).shape).toBe("id")
    })
  })
  ```
- [ ] **Step 6: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: nb/da/fi gender, F-only, Finnish boolean, and personnummer id cases fail (values not in the sets / not matched by `isId`).
- [ ] **Step 7: Extend `GENDER_VALUES`, `BOOLEAN_VALUES`, and `isId` in `packages/import/src/shape.ts`.**
  Replace `GENDER_VALUES` with:
  ```ts
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
  ```
  Replace `BOOLEAN_VALUES` with:
  ```ts
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
  ```
  Replace `isId` with:
  ```ts
  /** Id: pure integer (any length), short alphanumeric code with a digit, or a
   *  Swedish/Nordic personnummer (\d{8}-\d{4} or \d{6}-\d{4}) (id-03, id-04).
   *  Pure-letter strings are NOT ids; they fall to text.
   */
  function isId(cell: string): boolean {
    const t = cell.trim()
    if (/^\d+$/.test(t)) return true
    if (/^\d{8}-\d{4}$/.test(t)) return true
    if (/^\d{6}-\d{4}$/.test(t)) return true
    if (/^[a-zA-Z0-9]{1,20}$/.test(t) && /\d/.test(t)) return true
    return false
  }
  ```
- [ ] **Step 8: Run the tests, expect PASS.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: all Nordic gender/boolean/personnummer cases pass.
- [ ] **Step 9: Write the failing fillRate/sampleSize test (SC-09).**
  Add to `packages/import/src/shape.test.ts`:
  ```ts
  describe("classifyColumn fill-rate signal (SC-09)", () => {
    it("reports fillRate and sampleSize alongside confidence for a sparse column", () => {
      const values = ["", "", "", "", "", "", "", "", "52 000", "61 000"]
      const result = classifyColumn(values)
      expect(result.shape).toBe("money")
      expect(result.confidence).toBe(1) // match ratio among the 2 non-blank cells
      expect(result.sampleSize).toBe(2)
      expect(result.fillRate).toBeCloseTo(0.2, 5)
    })

    it("reports fillRate 1 and full sampleSize for a dense column", () => {
      const result = classifyColumn(["Man", "Kvinna", "Man"])
      expect(result.sampleSize).toBe(3)
      expect(result.fillRate).toBe(1)
    })

    it("reports fillRate 0 and sampleSize 0 for an all-blank column", () => {
      const result = classifyColumn(["", "  ", ""])
      expect(result.shape).toBe("text")
      expect(result.confidence).toBe(0)
      expect(result.fillRate).toBe(0)
      expect(result.sampleSize).toBe(0)
    })
  })
  ```
- [ ] **Step 10: Run the test, expect FAIL.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: fails because the return type lacks `fillRate`/`sampleSize`.
- [ ] **Step 11: Extend the `classifyColumn` return in `packages/import/src/shape.ts`.**
  Change the function signature and both return paths:
  ```ts
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
  ```
- [ ] **Step 12: Run the full shape suite, expect PASS.**
  `cd packages/import && bunx vitest run src/shape.test.ts`
  Expected: all shape tests pass. `detect.ts` already reads only `.shape` from `classifyColumn`, so the widened return type does not break it (verify next).
- [ ] **Step 13: Run the detect suite to confirm no regression from the widened return type.**
  `cd packages/import && bunx vitest run src/detect.test.ts`
  Expected: all detect tests still pass.
- [ ] **Step 14: Commit.**
  `git add packages/import/src/shape.ts packages/import/src/shape.test.ts && git commit -m "fix(import): money floor, personnummer ids, Nordic gender/boolean, fillRate signal in classifyColumn"`

---

### Task 5: `parse.ts` broaden parseGender (nb/da/fi/en-F + header-gated numeric), broaden parseBool, add parseStringId + safe-integer guard

**Files:**
- Modify: `packages/import/src/parse.ts`, `packages/import/src/index.ts`
- Test: `packages/import/src/parse.test.ts`

**Interfaces:**
- Consumes: `fold` (Task 1).
- Produces (later plans consume these signatures):
  - `parseGender(v: string, opts?: { allowNumericCodes?: boolean }): "Man" | "Kvinna" | null` — resolves nb (`mann`->Man, `kvinne`->Kvinna), da (`mand`->Man, `kvinde`->Kvinna), fi (`mies`->Man, `nainen`->Kvinna), en (`f`->Kvinna), and, ONLY when `opts.allowNumericCodes === true` (set by a gender-column-aware caller), the SCB/SAP convention `1`->Man, `2`->Kvinna. Any other numeric code, non-binary token, or blank returns null. The return type is unchanged, so the existing `validate.ts` call site (`parseGender(raw)`) keeps compiling.
  - `parseBool(v: string): boolean | null` — adds `nei`->false (nb), `kylla`->true, `ei`->false (fi). (`y`/`n`, `x`/blank, `sant`/`falskt`, numeric `1`/`0` are deferred per the spec's "plan decides" latitude; NOT added in Plan A to avoid the percent/id priority coupling, which Plan B/C own.)
  - `parseStringId(v: string): string | null` — returns the trimmed string verbatim for any value `isId` would accept (pure integer, personnummer, short alphanumeric-with-digit), preserving leading zeros and alphanumeric codes; returns null otherwise.
  - `parseIntId(v: string): number | null` — unchanged signature; adds a `Number.isSafeInteger` guard so an integer beyond the safe range returns null instead of corrupting.

- [ ] **Step 1: Write the failing parseGender tests (GEN-04/05/06/07/09, P5/P6).**
  Add to `packages/import/src/parse.test.ts` inside the `parseGender` describe (or a new one):
  ```ts
  describe("parseGender Plan A broadening", () => {
    it("resolves Norwegian mann/kvinne (GEN-05)", () => {
      expect(parseGender("Mann")).toBe("Man")
      expect(parseGender("Kvinne")).toBe("Kvinna")
    })

    it("resolves Danish mand/kvinde (GEN-06)", () => {
      expect(parseGender("Mand")).toBe("Man")
      expect(parseGender("Kvinde")).toBe("Kvinna")
    })

    it("resolves Finnish mies/nainen (GEN-07)", () => {
      expect(parseGender("Mies")).toBe("Man")
      expect(parseGender("Nainen")).toBe("Kvinna")
    })

    it("resolves English F to Kvinna, symmetric with M (GEN-04)", () => {
      expect(parseGender("F")).toBe("Kvinna")
      expect(parseGender("M")).toBe("Man")
    })

    it("does NOT map numeric codes without the opt-in flag (GEN-09 guard)", () => {
      expect(parseGender("1")).toBeNull()
      expect(parseGender("2")).toBeNull()
    })

    it("maps SCB numeric 1/2 only when allowNumericCodes is true (GEN-09, P6)", () => {
      expect(parseGender("1", { allowNumericCodes: true })).toBe("Man")
      expect(parseGender("2", { allowNumericCodes: true })).toBe("Kvinna")
    })

    it("flags ambiguous numeric codes as null even with the flag (Decision 3)", () => {
      expect(parseGender("0", { allowNumericCodes: true })).toBeNull()
      expect(parseGender("3", { allowNumericCodes: true })).toBeNull()
    })

    it("returns null for non-binary tokens (no third value)", () => {
      expect(parseGender("Annat")).toBeNull()
      expect(parseGender("Ukjent")).toBeNull()
      expect(parseGender("X")).toBeNull()
    })
  })
  ```
- [ ] **Step 2: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: nb/da/fi/F and numeric-code cases fail (current `parseGender` handles only sv/en binary and has no options param).
- [ ] **Step 3: Rewrite `parseGender` in `packages/import/src/parse.ts`.**
  Replace `parseGender` with:
  ```ts
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
  ```
- [ ] **Step 4: Run the parseGender tests, expect PASS.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: parseGender tests pass. The existing `validate.ts` call `parseGender(raw)` still compiles (the second arg is optional).
- [ ] **Step 5: Write the failing parseBool tests (bool-01/02/03, P7).**
  Add to `packages/import/src/parse.test.ts`:
  ```ts
  describe("parseBool Plan A broadening", () => {
    it("resolves Norwegian nei to false (bool-01)", () => {
      expect(parseBool("Nei")).toBe(false)
    })

    it("resolves Finnish kyllä to true (bool-02)", () => {
      expect(parseBool("Kyllä")).toBe(true)
    })

    it("resolves Finnish ei to false (bool-03)", () => {
      expect(parseBool("Ei")).toBe(false)
    })

    it("keeps existing ja/nej/yes/no/true/false (lock)", () => {
      expect(parseBool("Ja")).toBe(true)
      expect(parseBool("Nej")).toBe(false)
      expect(parseBool("yes")).toBe(true)
      expect(parseBool("FALSE")).toBe(false)
    })
  })
  ```
- [ ] **Step 6: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: `nei`/`kyllä`/`ei` cases fail.
- [ ] **Step 7: Rewrite `parseBool` in `packages/import/src/parse.ts` to fold the input and cover the Nordic words.**
  Replace `parseBool` with:
  ```ts
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
  ```
- [ ] **Step 8: Run the parseBool tests, expect PASS.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: all parseBool tests pass.
- [ ] **Step 9: Write the failing identifier tests (id-01/03/05/07).**
  Add to `packages/import/src/parse.test.ts`:
  ```ts
  describe("parseStringId and parseIntId safe-integer guard (Plan A)", () => {
    it("preserves leading zeros as a string (id-01)", () => {
      expect(parseStringId("00042")).toBe("00042")
    })

    it("returns an alphanumeric code verbatim (id-05)", () => {
      expect(parseStringId("EMP001")).toBe("EMP001")
    })

    it("returns a full personnummer verbatim (id-03)", () => {
      expect(parseStringId("19850612-1234")).toBe("19850612-1234")
    })

    it("returns a short personnummer verbatim (id-04)", () => {
      expect(parseStringId("850612-1234")).toBe("850612-1234")
    })

    it("trims surrounding whitespace but preserves the value", () => {
      expect(parseStringId("  10042  ")).toBe("10042")
    })

    it("returns null for a non-id value (pure letters)", () => {
      expect(parseStringId("Anna")).toBeNull()
    })

    it("returns null for blank", () => {
      expect(parseStringId("")).toBeNull()
    })

    it("parseIntId returns null for an integer beyond the safe range (id-07)", () => {
      expect(parseIntId("123456789012345678")).toBeNull()
    })

    it("parseIntId still parses a safe integer (lock)", () => {
      expect(parseIntId("10042")).toBe(10042)
    })
  })
  ```
  Add `parseStringId` to the imports at the top of `parse.test.ts`:
  ```ts
  import {
    parseMoney,
    parseCurrency,
    parsePercent,
    parseGender,
    parseDate,
    parseBool,
    parseIntId,
    parseStringId,
  } from "./parse.js"
  ```
- [ ] **Step 10: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: fails to import `parseStringId`; the safe-integer guard case fails (current `parseIntId` corrupts an 18-digit number).
- [ ] **Step 11: Add `parseStringId` and the safe-integer guard in `packages/import/src/parse.ts`.**
  Add a shared id-shape test and the new function above `parseIntId`:
  ```ts
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
  ```
  Replace `parseIntId` with a safe-integer guard:
  ```ts
  /**
   * Parse a pure-integer id string to a number. Returns null for non-numeric,
   * blank, or an integer beyond Number.isSafeInteger (which would corrupt the
   * value); such ids should be preserved via parseStringId instead (id-07).
   */
  export function parseIntId(v: string): number | null {
    const trimmed = v.trim()
    if (!trimmed) return null

    if (!/^\d+$/.test(trimmed)) return null

    const n = Number(trimmed)
    if (!Number.isSafeInteger(n)) return null
    return n
  }
  ```
- [ ] **Step 12: Run the identifier tests, expect PASS.**
  `cd packages/import && bunx vitest run src/parse.test.ts`
  Expected: all parse tests pass, including the existing money/percent/date/gender/bool locks.
- [ ] **Step 13: Export `parseStringId` from `index.ts`.**
  In `packages/import/src/index.ts`, extend the `parse.js` export block:
  ```ts
  export {
    parseMoney,
    parseCurrency,
    parsePercent,
    parseGender,
    parseDate,
    parseBool,
    parseIntId,
    parseStringId,
  } from "./parse.js"
  ```
- [ ] **Step 14: Commit.**
  `git add packages/import/src/parse.ts packages/import/src/parse.test.ts packages/import/src/index.ts && git commit -m "feat(import): broaden parseGender/parseBool for nb/da/fi and add parseStringId with safe-integer guard"`

---

### Task 6: `tokenize.ts` structural normalization (line endings, sep= directive, header trim, preamble skip, ragged rows, duplicate/blank headers, trailing-empty-column, null bytes, single-column signal)

**Files:**
- Modify: `packages/import/src/tokenize.ts`, `packages/import/src/index.ts`
- Test: `packages/import/src/tokenize.test.ts`

**Interfaces:**
- Consumes: nothing new (uses papaparse).
- Produces:
  - `TokenizeSignals` type: `{ preambleRowsSkipped: number; raggedRows: number[]; duplicateHeaders: string[]; blankHeaderColumns: number[]; noDelimiter: boolean }` — always present on the result, with zero/empty values when nothing was detected.
  - `TokenizeResult` type: `{ headers: string[]; rows: string[][]; signals: TokenizeSignals }` — the structural signals are nested under a single always-present `signals` object.
  - `tokenizeCsv(text: string): TokenizeResult` — same first two fields as today (headers, rows) plus the nested `signals`. Every emitted data row has exactly `headers.length` cells. Plan C reads `signals.raggedRows`/`signals.noDelimiter`/`signals.blankHeaderColumns` for optional warnings; `detect.ts` already tolerates a blank-header column (Task 3) and destructures only `{ headers, rows }`, which still compiles against the nested shape.
- Note: the binary-signature guard and `ImportFormatError` are Task 7 (separate task, Plan C depends on the error shape). Task 6 leaves binary input handling untouched.

- [ ] **Step 1: Write the failing structural tests (T08/T09, T12/T13/T14/T39/T40, T15/T16/T34, T18, T19/T20, T21/T22, T23, T35, T38).**
  Add to `packages/import/src/tokenize.test.ts`:
  ```ts
  describe("tokenizeCsv line-ending normalization (T08, T09, T10, T11)", () => {
    it("handles CRLF header then LF data (T08)", () => {
      const { rows } = tokenizeCsv("name,salary\r\nAlice,50000\nBob,60000")
      expect(rows.length).toBe(2)
      expect(rows[0]).toEqual(["Alice", "50000"])
      expect(rows[1]).toEqual(["Bob", "60000"])
    })

    it("handles LF header then CRLF data with no stray CR (T09)", () => {
      const { rows } = tokenizeCsv("name,salary\nAlice,50000\r\nBob,60000")
      expect(rows[0]?.[1]).toBe("50000")
      expect(JSON.stringify(rows)).not.toContain("\\r")
    })

    it("handles lone CR line endings (T11)", () => {
      const { headers, rows } = tokenizeCsv("name,salary\rAlice,50000\rBob,60000")
      expect(headers).toEqual(["name", "salary"])
      expect(rows.length).toBe(2)
    })
  })

  describe("tokenizeCsv sep= directive (T12, T13, T14, T39, T40)", () => {
    it("consumes sep=; and uses the declared delimiter (T12)", () => {
      const { headers, signals } = tokenizeCsv("sep=;\nNamn;Lon\nAnna;52000")
      expect(headers).toEqual(["Namn", "Lon"])
      expect(signals.preambleRowsSkipped).toBe(0) // sep= is a directive, not a preamble row
    })

    it("consumes sep=, (T13)", () => {
      const { headers } = tokenizeCsv("sep=,\nname,salary\nAnna,52000")
      expect(headers).toEqual(["name", "salary"])
    })

    it("consumes sep=<TAB> (T14)", () => {
      const { headers } = tokenizeCsv("sep=\t\nname\tsalary\nAnna\t52000")
      expect(headers).toEqual(["name", "salary"])
    })

    it("strips a BOM then consumes sep=; (T39)", () => {
      const { headers } = tokenizeCsv("﻿sep=;\nNamn;Lon\nAnna;52000")
      expect(headers).toEqual(["Namn", "Lon"])
    })

    it("falls back to auto-detect when the declared delimiter is absent from data (T40)", () => {
      const { headers } = tokenizeCsv("sep=|\nname,salary\nAnna,52000")
      expect(headers).toEqual(["name", "salary"])
    })
  })

  describe("tokenizeCsv preamble / metadata / hash skipping (T15, T16, T34)", () => {
    it("skips a single-cell title preamble row (T15)", () => {
      const { headers, signals } = tokenizeCsv(
        "Lonerapport 2024 Q1\nNamn,Lon,Avd\nAnna,52000,IT\nErik,61000,HR"
      )
      expect(headers).toEqual(["Namn", "Lon", "Avd"])
      expect(signals.preambleRowsSkipped).toBe(1)
    })

    it("skips multi-line metadata preamble (T16)", () => {
      const { headers, signals } = tokenizeCsv(
        "Foretag: Acme AB\nPeriod: 2024-03\nNamn;Lon;Avd\nAnna;52000;IT\nErik;61000;HR"
      )
      expect(headers).toEqual(["Namn", "Lon", "Avd"])
      expect(signals.preambleRowsSkipped).toBe(2)
    })

    it("skips a leading hash-comment row (T34)", () => {
      const { headers, signals } = tokenizeCsv(
        "# Generated by Visma Lon\nNamn,Lon,Avd\nAnna,52000,IT\nErik,61000,HR"
      )
      expect(headers).toEqual(["Namn", "Lon", "Avd"])
      expect(signals.preambleRowsSkipped).toBe(1)
    })

    it("does NOT skip anything in a clean file", () => {
      const { headers, signals } = tokenizeCsv(
        "name,salary\nAlice,50000\nBob,60000"
      )
      expect(headers).toEqual(["name", "salary"])
      expect(signals.preambleRowsSkipped).toBe(0)
    })
  })

  describe("tokenizeCsv trailing empty column strip (T18)", () => {
    it("strips a trailing all-empty column with a blank header", () => {
      const { headers, rows } = tokenizeCsv(
        "name,salary,dept,\nAlice,50000,IT,\nBob,60000,HR,"
      )
      expect(headers).toEqual(["name", "salary", "dept"])
      expect(rows[0]).toEqual(["Alice", "50000", "IT"])
    })
  })

  describe("tokenizeCsv ragged-row normalization (T19, T20)", () => {
    it("pads a short row to header width and records it (T19)", () => {
      const { rows, signals } = tokenizeCsv(
        "id,name,salary,dept\n1,Alice\n2,Bob,60000,HR"
      )
      expect(rows[0]).toEqual(["1", "Alice", "", ""])
      expect(signals.raggedRows).toContain(0)
    })

    it("truncates a long row to header width and records it (T20)", () => {
      const { rows, signals } = tokenizeCsv(
        "id,name\n1,Alice,extra\n2,Bob"
      )
      expect(rows[0]).toEqual(["1", "Alice"])
      expect(signals.raggedRows).toContain(0)
    })
  })

  describe("tokenizeCsv duplicate / blank headers (T21, T22)", () => {
    it("disambiguates duplicate header names and records them (T21)", () => {
      const { headers, signals } = tokenizeCsv(
        "name,salary,salary,dept\nAlice,50000,55000,IT"
      )
      expect(headers).toEqual(["name", "salary", "salary_2", "dept"])
      expect(signals.duplicateHeaders).toContain("salary")
    })

    it("preserves a blank mid-row header as a stable column and records it (T22)", () => {
      const { headers, signals } = tokenizeCsv(
        "name,,salary,dept\nAlice,x,50000,IT"
      )
      expect(headers.length).toBe(4)
      expect(headers[1]).toBe("")
      expect(signals.blankHeaderColumns).toContain(1)
    })
  })

  describe("tokenizeCsv header trimming and null-byte cleanup (T23, T35)", () => {
    it("trims whitespace-padded headers (T23)", () => {
      const { headers } = tokenizeCsv("  name  ,  salary  \nAlice,50000")
      expect(headers).toEqual(["name", "salary"])
    })

    it("strips null bytes from values (T35)", () => {
      const { rows } = tokenizeCsv("name,salary\nAlice ,50000")
      expect(rows[0]?.[0]).toBe("Alice")
    })
  })

  describe("tokenizeCsv single-column signal (T38)", () => {
    it("flags a space-only pseudo-CSV as noDelimiter", () => {
      const { headers, signals } = tokenizeCsv(
        "employee salary department\nAlice 50000 IT"
      )
      expect(headers.length).toBe(1)
      expect(signals.noDelimiter).toBe(true)
    })

    it("does NOT flag a normal multi-column file", () => {
      const { signals } = tokenizeCsv("name,salary\nAlice,50000")
      expect(signals.noDelimiter).toBe(false)
    })
  })
  ```
- [ ] **Step 2: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/tokenize.test.ts`
  Expected: all new blocks fail (structural signals do not exist; `tokenizeCsv` returns only `{ headers, rows }`).
- [ ] **Step 3: Rewrite `packages/import/src/tokenize.ts` with the structural pipeline.**
  Replace the file body (keeping the papaparse import) with:
  ```ts
  // CSV tokenizer for the salary import engine.
  // Wraps papaparse; normalizes line endings, consumes sep= directives, skips
  // preamble rows, trims headers, disambiguates duplicate headers, preserves blank
  // headers, strips a trailing all-empty column, pads/truncates ragged rows,
  // strips null bytes, and signals single-column input. Value cells are NOT trimmed.

  import Papa from "papaparse"

  const UTF8_BOM = "﻿"

  /**
   * Structural signals from tokenization. Always present on the result, with
   * zero/empty values when nothing was detected. Plan C reads raggedRows,
   * noDelimiter, and (via detect) blankHeaderColumns.
   */
  export type TokenizeSignals = {
    /** Count of leading non-tabular rows skipped before the header row. */
    preambleRowsSkipped: number
    /** 0-based data-row indices whose original width differed from headers.length. */
    raggedRows: number[]
    /** Header names that appeared more than once (before _2/_3 disambiguation). */
    duplicateHeaders: string[]
    /** Column indices whose header cell was blank/whitespace-only. */
    blankHeaderColumns: number[]
    /** True when the file parsed as a single column (likely a missing delimiter). */
    noDelimiter: boolean
  }

  export type TokenizeResult = {
    headers: string[]
    rows: string[][]
    /** Structural signals, always present (zero/empty when nothing detected). */
    signals: TokenizeSignals
  }

  // Map a sep=<char> directive body to the actual delimiter character.
  function directiveDelimiter(line: string): string | null {
    const m = /^sep=(.)$/i.exec(line)
    if (m) return m[1] ?? null
    if (/^sep=\t$/i.test(line)) return "\t"
    // Excel writes the literal word TAB in some locales.
    if (/^sep=tab$/i.test(line)) return "\t"
    return null
  }

  /**
   * Parse raw CSV text into headers, data rows, and structural signals.
   * Every emitted data row has exactly headers.length cells.
   */
  export function tokenizeCsv(text: string): TokenizeResult {
    // 1. Strip any leading BOM(s).
    let input = text
    while (input.startsWith(UTF8_BOM)) input = input.slice(1)

    // 2. Normalize line endings: CRLF then lone CR -> LF.
    input = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

    // 3. Consume a leading sep=<char> directive, if present.
    let declaredDelimiter: string | null = null
    const firstNewline = input.indexOf("\n")
    const firstLine = firstNewline === -1 ? input : input.slice(0, firstNewline)
    const sep = directiveDelimiter(firstLine.trim())
    if (sep !== null) {
      declaredDelimiter = sep
      input = firstNewline === -1 ? "" : input.slice(firstNewline + 1)
    }

    // 4. Parse. Use the declared delimiter only if it appears in the body (T40);
    //    otherwise auto-detect.
    const useDeclared =
      declaredDelimiter !== null && input.includes(declaredDelimiter)
    const result = Papa.parse<string[]>(input, {
      delimiter: useDeclared ? (declaredDelimiter as string) : "",
      skipEmptyLines: "greedy",
      header: false,
    })
    const allRows = result.data

    if (allRows.length === 0) {
      return {
        headers: [],
        rows: [],
        signals: {
          preambleRowsSkipped: 0,
          raggedRows: [],
          duplicateHeaders: [],
          blankHeaderColumns: [],
          noDelimiter: false,
        },
      }
    }

    // 5. Preamble skip: the header row is the first row whose cell count equals
    //    the mode of the following rows. Rows above it are preamble. Also skip a
    //    leading single-cell row that starts with "#".
    const headerRowIndex = chooseHeaderRow(allRows)
    const preambleRowsSkipped = headerRowIndex

    const rawHeader = (allRows[headerRowIndex] ?? []).map((c) => cleanCell(c))
    const rawData = allRows.slice(headerRowIndex + 1)

    // 6. Trim headers (value cells stay untrimmed).
    let headers = rawHeader.map((h) => h.trim())

    // 7. Record blank-header columns and disambiguate duplicates.
    const blankHeaderColumns: number[] = []
    headers.forEach((h, i) => {
      if (h.length === 0) blankHeaderColumns.push(i)
    })
    const { headers: dedupedHeaders, duplicateHeaders } =
      disambiguateHeaders(headers)
    headers = dedupedHeaders

    // 8. Clean value cells (null bytes) but do NOT trim.
    const cleanedData = rawData.map((row) => row.map((c) => cleanCell(c)))

    // 9. Ragged-row normalization to headers.length.
    const width = headers.length
    const raggedRows: number[] = []
    const rows: string[][] = cleanedData.map((row, i) => {
      if (row.length === width) return row
      raggedRows.push(i)
      if (row.length < width) {
        return [...row, ...Array(width - row.length).fill("")]
      }
      return row.slice(0, width)
    })

    // 10. Trailing empty column strip: last column with a blank header and all
    //     data cells empty (T18). Do not strip a blank-header column that has data.
    const stripped = stripTrailingEmptyColumn(headers, rows, blankHeaderColumns)

    // 11. Single-column / no-delimiter signal.
    const noDelimiter =
      stripped.headers.length === 1 &&
      stripped.rows.every((r) => r.length === 1)

    return {
      headers: stripped.headers,
      rows: stripped.rows,
      signals: {
        preambleRowsSkipped,
        raggedRows,
        duplicateHeaders,
        blankHeaderColumns: stripped.blankHeaderColumns,
        noDelimiter,
      },
    }
  }

  // Strip null bytes from a cell. Does not trim (value parsers own trimming).
  function cleanCell(c: string): string {
    return c.replace(/ /g, "")
  }

  // Choose the header row index: skip a leading single-cell "#" comment row, then
  // pick the first row whose cell count equals the mode of the following rows.
  function chooseHeaderRow(rows: string[][]): number {
    let start = 0
    // Skip leading single-cell hash-comment rows.
    while (
      start < rows.length &&
      (rows[start]?.length ?? 0) === 1 &&
      (rows[start]?.[0] ?? "").trim().startsWith("#")
    ) {
      start++
    }

    if (start >= rows.length) return 0

    // Mode of cell counts across all rows from `start` onward.
    const counts = new Map<number, number>()
    for (let i = start; i < rows.length; i++) {
      const len = rows[i]?.length ?? 0
      counts.set(len, (counts.get(len) ?? 0) + 1)
    }
    let mode = 0
    let modeFreq = -1
    for (const [len, freq] of counts) {
      if (len <= 1) continue // never treat a single-cell row as the tabular mode
      if (freq > modeFreq || (freq === modeFreq && len > mode)) {
        mode = len
        modeFreq = freq
      }
    }
    if (mode === 0) return start // no multi-cell mode found; use first row

    for (let i = start; i < rows.length; i++) {
      if ((rows[i]?.length ?? 0) === mode) return i
    }
    return start
  }

  // Suffix duplicate header names (_2, _3, ...) so no two columns collapse.
  function disambiguateHeaders(headers: string[]): {
    headers: string[]
    duplicateHeaders: string[]
  } {
    const seen = new Map<string, number>()
    const duplicates = new Set<string>()
    const out = headers.map((h) => {
      if (h.length === 0) return h // blank headers stay blank (not disambiguated)
      const prior = seen.get(h)
      if (prior === undefined) {
        seen.set(h, 1)
        return h
      }
      const next = prior + 1
      seen.set(h, next)
      duplicates.add(h)
      return `${h}_${next}`
    })
    return { headers: out, duplicateHeaders: [...duplicates] }
  }

  // Strip a single trailing column whose header is blank and whose every data
  // cell is empty. Re-index blankHeaderColumns after the strip.
  function stripTrailingEmptyColumn(
    headers: string[],
    rows: string[][],
    blankHeaderColumns: number[]
  ): { headers: string[]; rows: string[][]; blankHeaderColumns: number[] } {
    const last = headers.length - 1
    if (last < 0) return { headers, rows, blankHeaderColumns }
    const headerBlank = (headers[last] ?? "").length === 0
    const allEmpty = rows.every((r) => (r[last] ?? "").trim().length === 0)
    if (!headerBlank || !allEmpty) {
      return { headers, rows, blankHeaderColumns }
    }
    return {
      headers: headers.slice(0, last),
      rows: rows.map((r) => r.slice(0, last)),
      blankHeaderColumns: blankHeaderColumns.filter((i) => i !== last),
    }
  }
  ```
- [ ] **Step 4: Run the tokenize tests, expect PASS.**
  `cd packages/import && bunx vitest run src/tokenize.test.ts`
  Expected: all new blocks pass. Update the existing baseline tests only if their assertions now read extra return fields; the original `{ headers, rows }` destructuring still works because the return type is a superset. Verify the existing FIXTURE test (16-column Swedish header, quoted embedded semicolon) still passes: no `sep=` directive, no preamble (first row is the 16-col header, matching the mode), so `preambleSkipped` is 0 and headers/rows are unchanged.
- [ ] **Step 5: Update `index.ts` to export the new types.**
  In `packages/import/src/index.ts`, extend the tokenize export:
  ```ts
  export { tokenizeCsv } from "./tokenize.js"
  export type { TokenizeResult, TokenizeSignals } from "./tokenize.js"
  ```
- [ ] **Step 6: Run the whole suite to confirm no cross-module regression.**
  `cd packages/import && bunx vitest run`
  Expected: all files green. `detect.ts` and `validate.ts` call `tokenizeCsv` and destructure `{ headers, rows }`, which still resolve on the widened return type.
- [ ] **Step 7: Commit.**
  `git add packages/import/src/tokenize.ts packages/import/src/tokenize.test.ts packages/import/src/index.ts && git commit -m "feat(import): normalize line endings, sep= directives, preamble, ragged rows and header structure in tokenizeCsv"`

---

### Task 7: `tokenize.ts` binary-signature guard and typed `ImportFormatError`

**Files:**
- Modify: `packages/import/src/tokenize.ts`, `packages/import/src/index.ts`
- Test: `packages/import/src/tokenize.test.ts`

**Interfaces:**
- Consumes: `tokenizeCsv` / `TokenizeResult` (Task 6).
- Produces (Plan C consumes this exact shape for its `invalidFileFormat` mapping):
  - `ImportFormatError` — a named error class extending `Error`, with `readonly kind: "binary"`, a `readonly signature: "zip" | "ole2"` discriminator (ZIP covers XLSX/ODS; OLE2 covers legacy XLS), and `readonly name = "ImportFormatError"`. Constructor: `new ImportFormatError(signature: "zip" | "ole2", message?: string)`.
  - `tokenizeCsv(text: string): TokenizeResult` — now THROWS `ImportFormatError` (the sole engine throwing path) when the decoded input begins with a known binary spreadsheet signature, BEFORE any papaparse call. Non-binary input is unaffected.

- [ ] **Step 1: Write the failing binary-guard tests (A1, A2, A3).**
  Add to `packages/import/src/tokenize.test.ts`, and add `ImportFormatError` to the import at the top:
  ```ts
  import { tokenizeCsv, ImportFormatError } from "./tokenize.js"
  ```
  ```ts
  describe("tokenizeCsv binary-signature guard (A1, A2, A3)", () => {
    it("throws ImportFormatError with kind binary and signature zip for XLSX/ODS (A1, A3)", () => {
      const xlsx = "PK" + "rest-of-zip-bytes"
      expect(() => tokenizeCsv(xlsx)).toThrow(ImportFormatError)
      try {
        tokenizeCsv(xlsx)
      } catch (e) {
        expect(e).toBeInstanceOf(ImportFormatError)
        const err = e as ImportFormatError
        expect(err.kind).toBe("binary")
        expect(err.signature).toBe("zip")
        expect(err.name).toBe("ImportFormatError")
      }
    })

    it("throws ImportFormatError with signature ole2 for legacy XLS (A2)", () => {
      const xls =
        "ÐÏà¡±á" + "rest-of-ole2"
      try {
        tokenizeCsv(xls)
        throw new Error("expected tokenizeCsv to throw")
      } catch (e) {
        expect(e).toBeInstanceOf(ImportFormatError)
        expect((e as ImportFormatError).signature).toBe("ole2")
      }
    })

    it("does NOT throw for a normal CSV that merely contains PK later", () => {
      // A CSV value containing "PK" mid-line must not trip the leading-byte guard.
      expect(() =>
        tokenizeCsv("name,code\nAlice,PK1234\nBob,ZZ99")
      ).not.toThrow()
    })

    it("does NOT throw for a CSV whose first field starts with the letters PK", () => {
      // Real header text can start with letters; only the exact PK\x03\x04 magic trips it.
      expect(() =>
        tokenizeCsv("PKlevel,salary\nA,50000")
      ).not.toThrow()
    })
  })
  ```
- [ ] **Step 2: Run the tests, expect FAIL.**
  `cd packages/import && bunx vitest run src/tokenize.test.ts`
  Expected: fails to import `ImportFormatError`; the guard does not exist.
- [ ] **Step 3: Add `ImportFormatError` and the guard to `packages/import/src/tokenize.ts`.**
  Add the class near the top of the file, after the `UTF8_BOM` const:
  ```ts
  /**
   * Thrown by tokenizeCsv when the input is a binary spreadsheet, not CSV.
   * This is the engine's only throwing path (a wrong-format file is not a value
   * to parse). The wizard maps it to the invalidFileFormat blocking code and
   * shows "export as CSV" (Plan C consumes { kind, signature }).
   */
  export class ImportFormatError extends Error {
    readonly kind = "binary" as const
    readonly signature: "zip" | "ole2"

    constructor(signature: "zip" | "ole2", message?: string) {
      super(message ?? `Binary spreadsheet input detected (${signature}); export as CSV`)
      this.name = "ImportFormatError"
      this.signature = signature
    }
  }

  // Leading code units of known binary spreadsheet signatures.
  // ZIP local-file header PK\x03\x04 covers XLSX and ODS; OLE2 compound-file
  // magic covers legacy XLS. These survive as leading code units in the common
  // decoded-string cases; byte-level encoding recovery stays the caller's job.
  const ZIP_SIGNATURE = "PK"
  const OLE2_SIGNATURE = "ÐÏà¡±á"

  function detectBinarySignature(text: string): "zip" | "ole2" | null {
    if (text.startsWith(ZIP_SIGNATURE)) return "zip"
    if (text.startsWith(OLE2_SIGNATURE)) return "ole2"
    return null
  }
  ```
  At the very top of `tokenizeCsv`, BEFORE the BOM strip, add the guard:
  ```ts
  export function tokenizeCsv(text: string): TokenizeResult {
    // Binary-signature guard: reject binary spreadsheets before any parsing.
    const binary = detectBinarySignature(text)
    if (binary !== null) throw new ImportFormatError(binary)

    // 1. Strip any leading BOM(s).
    let input = text
    while (input.startsWith(UTF8_BOM)) input = input.slice(1)
    // ... rest unchanged
  ```
- [ ] **Step 4: Run the binary-guard tests, expect PASS.**
  `cd packages/import && bunx vitest run src/tokenize.test.ts`
  Expected: the binary-guard block passes and every non-binary tokenize test still passes (the guard only fires on the exact leading magic).
- [ ] **Step 5: Export `ImportFormatError` from `index.ts`.**
  In `packages/import/src/index.ts`:
  ```ts
  export { tokenizeCsv, ImportFormatError } from "./tokenize.js"
  export type { TokenizeResult, TokenizeSignals } from "./tokenize.js"
  ```
- [ ] **Step 6: Run the whole suite and typecheck.**
  `cd packages/import && bunx vitest run && bunx tsc --noEmit`
  Expected: all tests green; no type errors. (`validate.ts` does not call `tokenizeCsv` in a try/catch yet; that wiring is Plan C. Task 7 only introduces the throw and the exported error type.)
- [ ] **Step 7: Commit.**
  `git add packages/import/src/tokenize.ts packages/import/src/tokenize.test.ts packages/import/src/index.ts && git commit -m "feat(import): guard binary spreadsheet input with typed ImportFormatError"`

---

## Plan A completion check

Run the full package suite and typecheck one final time:
`cd packages/import && bunx vitest run && bunx tsc --noEmit`

Expected: green across `fields.test.ts`, `shape.test.ts`, `detect.test.ts`, `parse.test.ts`, `tokenize.test.ts`. `validate.test.ts` is untouched by Plan A and must still pass unchanged. Plan B consumes the widened `classifyColumn` return, `parseGender(v, opts)`, and `parseStringId`; Plan C consumes `ImportFormatError { kind: "binary"; signature }`, `TokenizeResult` structural signals, and the `fillRate`/`sampleSize` fields.
