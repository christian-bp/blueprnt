# Import robustness design: `@workspace/import` CSV salary-import engine

**Date:** 2026-07-03

**Status:** design spec (drives implementation plans; no code in this document)

## Purpose

The discovery audit (see the [import robustness catalog](./2026-07-03-import-robustness-catalog.md), 166 scenarios across 10 dimensions) found that the pure CSV salary-import engine silently drops or mangles a large share of real Nordic payroll exports. Comma-decimal money, non-ISO dates, and the Norwegian/Danish folding bug together make two of the four in-scope locales effectively unusable, and binary spreadsheet files fail with a misleading "missing columns" message.

This spec turns the catalog's findings and the product owner's three decisions into testable per-module contracts, so implementation plans can be written against exact behavior. It does not restate all 166 rows; each contract references the catalog scenario ids that justify it (e.g. M14, DC-15, pp-07).

Scope is fixed by three product decisions:

1. **Fix all + spec ADR.** Fix every confirmed bug AND broaden the number/date/FTE format rules. The broadening contradicts today's documented integer-only-money and ISO-only-date choices, so it is backed by [ADR-0010](../../adr/0010-import-format-expansion-csv-only.md). Then build an exhaustive test suite so every discovered scenario is either locked (correct today) or fixed-and-tested.
2. **Require CSV + clear guard.** No binary spreadsheet parser. Add a binary-signature guard that raises a typed format error and a distinct blocking code, so the wizard can say "wrong file format, export as CSV" instead of "missing columns". A future `.xlsx` parser is a documented future option only, out of scope here.
3. **Gender stays binary, flag-and-assign.** Exactly two canonical genders (`Man`, `Kvinna`). Do NOT add a third value. Instead, broaden `parseGender` so more inputs resolve to `Man`/`Kvinna`, and when a person's gender is still blank or unrecognized, FLAG that row as a data-quality issue for the wizard's downstream "assign gender" UI. Ambiguous numeric codes are flagged, not guessed.

The engine stays **pure and deterministic** (ADR-0002): no clock, network, or randomness in its logic, identical on client and server, no framework coupling. It carries **no PII to any AI** (it never calls AI at all) and never touches the deterministic score/band path. Everything it produces must work in **en, sv, nb, da, fi** (the locales `routing.ts` lists).

## Determinism and locale constraints (apply to every contract below)

- **No non-determinism.** No `Date.now()`, no locale of the host environment, no randomness. Where a date parse needs a "current year" (two-digit-year century expansion, birth-year range), the reference year is an explicit parameter passed by the caller, never read from the clock. If a caller does not pass it, the affected heuristic is disabled (returns null) rather than guessing.
- **Locale parity is a hard requirement, not a nice-to-have.** Every parser/detector change must behave correctly for en/sv/nb/da/fi. The `fold` fix and the nb/da/fi word additions exist precisely because the engine today is English/Swedish-only in practice. A contract is not met if a format works in sv but not in nb/da/fi. See the dedicated "Locale parity" section.
- **Totality preserved.** Value parsers remain total: they return `null` on unparseable input and never throw. The one new throwing path is the binary-signature guard in `tokenizeCsv`, which throws a typed error by design (a wrong-format file is not a value to parse).

---

## Module contracts

### `tokenize.ts` (`tokenizeCsv`)

Today: strips a leading UTF-8 BOM, auto-detects the delimiter via papaparse, drops blank rows, row 0 becomes headers. It does not normalize line endings, does not handle `sep=` directives, does not trim headers, does not skip preamble/metadata rows, does not normalize ragged rows, and does not guard against binary input. Catalog dimension: Tokenizer / file structure, plus ENC-02/16/17 and A1-A3.

**Contracts:**

1. **Binary-signature guard (typed error).** Before any papaparse call, inspect the raw input's leading bytes/characters. If the input begins with a known binary spreadsheet signature, throw a typed `ImportFormatError` carrying a machine-readable kind, do not attempt to tokenize.
   - `PK\x03\x04` (ZIP local-file header) covers XLSX and ODS (A1, A3). When the ZIP payload contains an ODS `mimetype` marker near the start, the error detail may note ODS specifically, but the kind is the same "binary" family.
   - `\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1` (OLE2 compound-file) covers legacy XLS (A2).
   - The error is typed (a named error class or a discriminated result, decided in the plan) so the wizard maps it to the `invalidFileFormat` blocking code (see `validate.ts`) and shows "export as CSV", never "missing columns" (A4).
   - The guard runs on the decoded string the caller passes. Byte-level encoding recovery (UTF-16 re-decode, Windows-1252) stays the caller's responsibility (ENC-03/04/22, upstream verdicts); the guard only needs the signature bytes, which survive as leading code units in the common cases.

2. **Line-ending normalization.** Normalize all `\r\n` and then all lone `\r` to `\n` before parsing (T08, T09, T10, T11). After this, no cell value may contain a stray `\r`, and mixed-ending files (CRLF header + LF data, or the reverse) produce clean rows. Pure-CRLF and lone-CR baselines (T10, T11) must remain correct.

3. **`sep=<char>` directive handling.** If the first line (after BOM strip and line-ending normalization) matches `sep=<char>` (Excel's delimiter directive), consume that line and pass the declared delimiter to papaparse instead of auto-detecting (T12, T13, T14). Handle `sep=;`, `sep=,`, and `sep=<TAB>`. When a BOM precedes the directive, strip the BOM first, then consume the directive (T39). If the declared delimiter does not actually appear in the data rows, fall back to auto-detection rather than producing single-cell rows (T40).

4. **Header trimming.** Trim leading/trailing whitespace from each header cell (T23). Cell values are still NOT trimmed here (value parsers own that). This fixes displayed headers and edge matching; note that `fold` already strips internal spaces, so the functional impact is on display and on any exact-compare paths.

5. **Preamble / metadata-row skipping heuristic.** Detect and skip leading non-tabular rows before choosing the header row (T15, T16, T34):
   - Scan from the top. The header row is the first row whose cell count equals the mode (most common cell count) of the following data rows. Rows above it (single-cell titles like `Lonerapport 2024 Q1`, multi-line `Foretag:`/`Period:` metadata, `# ...` comment lines) are skipped.
   - Strip leading rows whose single cell begins with `#` (T34) as part of the same pass.
   - The heuristic must be deterministic and must not misfire on clean files (a normal file's first row already matches the mode, so nothing is skipped). Record how many preamble rows were skipped so the wizard can show it.

6. **Ragged-row normalization.** Pad short rows and record over-long rows against the header width (T19, T20). Every emitted data row has exactly `headers.length` cells (short rows padded with `""`, long rows either truncated or flagged, decided in the plan). Raggedness is recorded so `validate.ts` can surface it. A downstream consumer must never index past the padded width.

7. **Duplicate / blank header handling.** 
   - Duplicate header names are disambiguated deterministically (suffix `_2`, `_3`, ...) OR surfaced as a warning (T21); the plan picks one, but duplicates must not silently collapse to one column.
   - A blank/whitespace-only header cell is preserved as a real (blank) column so its index is stable, and it is marked so detect always routes it to `unmappedColumns` (T22, DC-22, ENC-16).

8. **Trailing empty column strip.** Strip a trailing column whose header is `""` and whose every cell is empty (T18), a common Excel artifact. Do not strip a blank-header column that has data (that is a real unmapped column, per contract 7).

9. **Null-byte and control cleanup.** Strip null bytes (`\0`) from values post-tokenize (T35). Optionally normalize curly quotes to ASCII before parsing (ENC-17) if the plan finds it cheap; otherwise document as unsupported.

10. **Single-column / no-delimiter signal.** When `headers.length === 1` and every row is single-cell, record a "no delimiter detected" signal (T38) that `validate.ts` can turn into a warning, instead of silently treating a space-separated file as one column.

**Locks (must stay correct):** all correct baselines T01-T07, T24-T33, T36-T37, and the double-BOM absorb (T25). The UTF-16-as-Latin1 (T26) and UTF-16 binary blob (ENC-03) cases stay upstream (caller decodes); document, do not attempt recovery in the engine.

### `fields.ts` (`fold` + synonym dictionary)

Today: `fold` lowercases, NFD-decomposes, strips combining diacritics, then strips all non-`[a-z0-9]`. Because Norwegian `o-slash` and Danish `ae` have no base+combining NFD decomposition, they are stripped entirely (`Kjonn` -> `kjnn`, `Kon` -> `kn`, `Grunnlonn` -> `grunnlnn`), so nb/da synonyms never match. The `basicMonthly` synonym list contains the bare substring `lon`, which fires inside `Henkilonro` and `grundlonar`. Catalog: ENC-05, DC-13/14/15/25, DC-05.

**Contracts:**

1. **Pre-NFD substitution in `fold`.** Before NFD decomposition, substitute the letters that NFD does not decompose to a base letter:
   - `o-slash` (U+00F8 / U+00D8) -> `o`
   - `ae` ligature (U+00E6 / U+00C6) -> `ae` (two ASCII letters)
   - Danish/Norwegian `aa` handling: the Swedish `a-ring` already folds to `a` via NFD; keep that. Add `aa`-as-`a-ring` only if the catalog shows a real header needing it; otherwise leave.
   - Result: `Kjonn` -> `kjonn`, `Kon` -> `koen` (folds to match the `koen` synonym already present), `Grunnlonn` -> `grunnlonn`. This one change unblocks nb and da header matching (ENC-05, DC-13, DC-14) and nb/da gender detection via the same fold path.
   - `fold` stays pure and deterministic; the substitution is a fixed table, not locale-dependent.

2. **Remove the bare `lon` substring landmine.** Remove `lon` as a standalone `basicMonthly` synonym (DC-25). Rely on the specific compounds: keep `manadslon`, `grundlon`, `fastmanadslon`; add the explicit Nordic/English compounds below. If a bare `Lon` header must still match, it matches by EXACT compare only, never as a substring (see contract 4).

3. **High-value synonym additions** (surfaced by the catalog; add the folded form to the listed field):
   - `externalRef`: `henkilonro` (Finnish person-number, DC-15), `pernr` (SAP, D7/P6).
   - `basicMonthly`: `peruspalkka`, `kuukausipalkka` (Finnish, DC-15); `grunnlonn`, `grundlonn` (nb/da explicit, D4/DC-13/DC-14); `manadsarvode`, `arvode` (Personec, DC-17); `basepay`, `salary`, `annualsalary`, `grosssalary`, `ansal` (Workday/SAP en, B3/D5/D7).
   - `title`: `tehtavanimike`, `nimike` (Finnish, DC-15); `tjanstebenamning`, `benamning` (Personec, DC-17); `stilling` already present (nb); `plans` (SAP, D7).
   - `gender`: no numeric here (numeric mapping lives in `parseGender`); `gesch` (SAP header, D7) added as a header synonym only.
   - `ftePercent`: `tjgrad`, `tjgradprocent`, `tjanstggrad` (Agda `Tj.grad %`, DC-03).
   - `birthDate`: `fodselsdato` (nb, D3/B4); folds correctly once `o-slash` is fixed.
   - `firstName`/`lastName`: `fornavn`, `etternavn` (nb, D3).
   - `employmentStartDate`: `anstdag`, `anstdatum`, `mandag` (Agda/Personec, DC-06/DC-23).
   - `payYear` / `annualSalary`: only add `arslon` as annual salary if the product wants a distinct annual field; otherwise leave `Grundlon/ar` to land in `unmappedColumns` (DC-05, ambiguity noted, not silently mapped to `payYear`).
   - The exact final list is the plan's to finalize against the catalog; the contract is that every catalog-cited nb/da/fi/SAP/Workday synonym above is covered.

4. **Minimum-length guard for substring matching.** The `0.7` "folded header contains a synonym" rule in `detect.ts` (see below) must not fire for very short synonyms embedded in longer words. Enforce a minimum synonym length (>= 5 folded characters) for the substring branch, OR mark short synonyms as exact-match-only. This is the structural fix that makes removing bare `lon` durable and prevents future short-substring landmines.

**Locks:** all correct Swedish/English mappings continue to match; `payYear` synonyms already pre-folded via `.map(fold)` stay working.

### `shape.ts` (`classifyColumn` + `isMoney`/`isPercent`/`isDate`/`isGender`/`isBoolean`/`isId`)

Today: `isMoney` requires a space group or currency suffix and rejects comma-decimal; `isPercent` is integer-only 0-100; `isDate` is ISO-only; gender/boolean sets miss nb/da/fi and English `f`/numeric; confidence is match-ratio among non-blank with no fill-rate signal; 5-digit grouped postal codes classify as money. Catalog: classifyColumn dimension (SC-*), plus shape rows echoed from M/pp/date/GEN/bool.

**Contracts:**

1. **Money detector must not misclassify postal codes / grouped employee numbers.** A single-group number without a currency marker is money only when it clears a value floor OR carries a currency marker (SC-05, SC-02, SC-13, SC-22).
   - Swedish postal codes (`114 55`, 5 digits as `3+2`) and grouped employee numbers (`114 77`) must classify as `id` (or `text`), not `money`.
   - Rule: without a currency marker (`kr/sek/nok/dkk/eur/gbp/usd` word or `kr`/`€` symbol), a space-grouped number counts as money only if the ungrouped integer value exceeds a floor (proposed ~10000, finalized in the plan) OR the grouping is a true thousands pattern (`\d{1,3}( \d{3})+`, i.e. groups of exactly three after the first). A `3+2` group (`114 55`) is not a thousands pattern and does not qualify.
   - Multi-group thousands numbers (`52 000`, `1 234 567`) stay money (locks M05-M07, SC-24).

2. **Comma-decimal and dot-decimal money shape.** `isMoney` must accept the number formats that `parseMoney` will accept (contract below), so the detector and parser never disagree (SC-20, M14, M15, M17, M19, ENC-10, ENC-11, B2). Concretely, the number part may carry a comma-decimal or dot-decimal tail and space/NBSP/thin-space grouping. Every `isMoney`-true value must be `parseMoney`-parseable and vice versa; the audit's detector/parser mismatches (M19, M41, M43, ENC-11) are eliminated.

3. **Percent / FTE shape with fraction awareness.** `isPercent` accepts an optional decimal (comma or dot) and optional `%` with optional space (pp-13, pp-14, pp-04, SC-03 counter-case). Add a **column-level fraction sub-case**: when every non-blank cell is a number <= 1.0 (`0.8`, `1.0`, `0,8`), the column classifies as `percent` with a fraction flag (pp-15, pp-16, pp-24), which `parsePercent` and `validate.ts` use to normalize x100 with a warning. Bare small integers without `%` (`12`, `7`, `3`) must NOT classify as percent; they are `id` (SC-03) unless the header says otherwise.

4. **Date shape beyond ISO.** `isDate` recognizes the expanded set that `parseDate` accepts (contract below): `DD.MM.YYYY`, `DD/MM/YYYY`, `YYYYMMDD` (8-digit), `YYYY-MM-DD` with an optional time suffix, and `YYYY/MM/DD` (date-08, date-09, date-10, date-13, ENC-21). Excel-serial and personnummer date recognition are header-gated (only when the column header matched a date field), because a bare 5-digit serial or a `NNNNNN-NNNN` string is ambiguous out of context (date-19, date-14/id-03).

5. **Gender shape covers all in-scope words.** `GENDER_VALUES` gains the nb/da/fi words and English `f`, so full-word nb/da/fi columns and M/F columns classify as `gender` (GEN-04, GEN-08, GEN-10, GEN-17, GEN-18). Numeric `1`/`2` gender is NOT auto-classified as gender by shape (it is indistinguishable from a small-int id/percent); it is resolved only when the header matches gender (GEN-09/GEN-21), and ambiguous numeric mappings are flagged, not guessed (see `parse.ts` and Decision 3).

6. **Boolean shape covers Nordic + common codes.** `BOOLEAN_VALUES` gains `nei`, `kylla`, `ei` (nb/fi), and the plan decides on `y`/`n`, `x`/blank, `sant`/`falskt`, `1`/`0` (bool-04..09). `1`/`0` as boolean conflicts with percent/id; give it a header-gated or priority-based resolution so a real `1/0` boolean column is not stolen by percent (bool-06).

7. **Identifier shape preserves current behavior.** `isId` continues to accept pure integers and short alphanumeric codes with a digit. Add personnummer patterns (`\d{8}-\d{4}`, `\d{6}-\d{4}`) so those columns classify as `id` not `text` (id-03, id-04).

8. **Confidence semantics for sparse columns.** Add a `fillRate` and/or `sampleSize` signal to the `classifyColumn` return so a column that is 80% blank does not report a bare confidence of 1.0 from 2 cells (SC-09). Confidence stays "match ratio among non-blank" (do not silently redefine it), but the extra signal lets `detect.ts` and the wizard distinguish a reliable classification from a 2-cell guess. A 2-cell column must not present as fully confident without the fill-rate context.

**Locks:** all correct SC baselines (SC-01, SC-04, SC-06, SC-07, SC-08, SC-10, SC-11, SC-15, SC-16, SC-17, SC-18, SC-19, SC-21, SC-24), the floor/shape-boost mechanics, and NBSP/thin-space money.

### `detect.ts` (`detectColumns` + `headerScore`)

Today: `headerScore` returns 1.0 exact, 0.7 substring-contains, 0.0 none; a shape-only fallback at 0.4 is emitted for any field with no header candidate whose shape matches any column. This absorbs text/id/percent-shaped columns (blank headers, postal codes, cost accounts, pay bands) into real fields and hides genuine unmapped columns, and it lets a header-matched runner-up be re-stolen into another field. Catalog: detectColumns dimension (DC-*) and SC-13/14/22/25.

**Contracts:**

1. **Restrict the shape-only 0.4 fallback to distinctive shapes.** The shape-only pass may only assign columns whose shape is **distinctive**: `gender` and `boolean` (DC-09, DC-12, DC-21). It must NEVER assign `text`, `id`, or `percent` shapes on shape alone. A text/id/percent column with no header match lands in `unmappedColumns`.
   - Consequence: `Kostnadskonto`, `Hemort`, `Bokf.enhet`, `Lonekostnad`, `Totallonekostnad`, and pay-band columns (`Lonenniva`, `Loneklass`) go to `unmappedColumns` (DC-09, DC-12, DC-21) instead of being silently mapped. Money keeps its intended shape-only fallback where a real money value with a salary-ish context exists (SC-23 stays correct), but the postal-code-as-money misclassification is already prevented in `shape.ts` contract 1, so money shape-only can no longer pull in address data (SC-13).

2. **Exclude header-candidate losers and blank-header columns from the shape-only pass.** 
   - Track every column that produced a header-scored candidate in pass 1 (a "header-candidate column"). In pass 2, do not emit a shape-only candidate for any such column (DC-10, SC-14, SC-25). A runner-up synonym column (`Grundlon` when `Lon` won `basicMonthly`) goes to `unmappedColumns`, not stolen into `variable`.
   - Columns whose folded header is empty (blank/whitespace headers, from `tokenize` contract 7) are excluded from both passes and routed straight to `unmappedColumns` (DC-22, ENC-16).

3. **Suppress birthDate shape-only unless a value actually looks like a date.** Do not shape-only-assign `birthDate` from an `id`/year-shaped column (`Alder (ar)`) unless a sampled cell matches a date shape (DC-02). Since contract 1 already forbids id shape-only, this is mostly covered; keep it explicit for the date case.

4. **Header-context money boost for bare-integer salary columns.** When a column's header matches a salary synonym but its values classify as `id` (bare integers like `72000`, `52000`), the header match still wins and the field maps (M01, M44, B3-bareint, D5, ENC-13). This is delivered by the header-score path (the header synonym gives 0.7/1.0 regardless of shape), so the fix is really: make sure the salary synonyms exist (fields contract 3) and that bare integers under a salary header are accepted by `validate`/`parseMoney`. No new shape-only money-for-id rule is introduced (that would reopen SC-02/SC-05).

5. **`headerScore` respects the minimum-length substring guard** from `fields.ts` contract 4: the 0.7 substring branch only fires for synonyms >= 5 folded chars (or exact-only short synonyms), so `Henkilonro` never scores 0.7 for `basicMonthly` (DC-25).

**Locks:** all correct DC baselines (DC-01, DC-04, DC-07, DC-08, DC-11, DC-16, DC-18, DC-19, DC-20, DC-24), the greedy assignment, and the deterministic tie-break (score desc, field index asc, column index asc).

### `parse.ts` (the ADR-backed format expansion)

Today: `parseMoney` is integer-only, no signs, strips space groups and one trailing known currency word; `parsePercent` accepts a dot-decimal 0-100 with optional trailing `%`; `parseDate` is strict ISO-8601; `parseGender` handles sv/en binary only; `parseBool` handles ja/nej/yes/no/true/false; `parseIntId` returns a number and loses leading zeros / corrupts >15-digit ids. The money/date expansions here revise documented spec choices and are backed by [ADR-0010](../../adr/0010-import-format-expansion-csv-only.md). Catalog: Money, Percent/FTE, Dates, Gender, Boolean, Identifiers dimensions.

**`parseMoney` (revises "integer-only, no signs"):**

Accept and normalize to a JS number:
- **Space / NBSP / thin-space grouping** (already works; keep, M05-M07).
- **Comma-decimal**, with or without grouping: `52000,50` -> 52000.5, `52 000,50` -> 52000.5, `52000,00` -> 52000 (M13, M14, M15, M16, ENC-10, B2). The comma is the decimal separator for sv/nb/da/fi.
- **Dot-decimal**, with or without space grouping: `52000.50` -> 52000.5, `52 000.50` -> 52000.5, `52000.00` -> 52000 (M17, M18, M19, ENC-11).
- **Dot-thousands** (nb/da/de grouping): `52.000` -> 52000, and `52.000,50` -> 52000.5 (dot=thousands, comma=decimal) (M10, M11). Disambiguation rule: a dot followed by exactly three digits that are themselves followed by more digits or a comma-decimal is a thousands separator; a dot followed by one or two trailing digits at the end is a decimal point. State the exact regex in the plan and test both `52.000` (thousands) and `52000.50` (decimal).
- **Currency prefix AND suffix**: strip a leading currency code/word (`SEK 52000`, `NOK 54000`, `SEK54000`) (M35, P3) and a trailing currency word or symbol (`45 250,75 kr`, `52000 €`, `52000kr`) (M33, M40, M41, M43). Extend the known-currency set to the non-ASCII `€` symbol. Change the suffix match from `\s+` to `\s*` so run-on `52000kr` parses and matches the detector (M41).
- **What still returns null:** an unknown trailing word (not a known currency), letters interleaved with the number, empty after stripping, or a value that is not a well-formed grouped/decimal number. Negative and parenthesized-negative (`-500`, `(500)`) are **out of scope for V1** (M24, M25 stay unsupported); they return null, but `validate.ts` gains a `negativeValue` row-issue code so correction rows surface named rather than opaque (ENC-24). en-US comma-thousands (`52,000`, `1,234,567.00`) is a column-level heuristic left out of the per-cell parser (M20, M21 stay unsupported for V1; document).
- **Normalization output:** a finite JS number. State the rounding/precision policy explicitly in the plan and ADR: salaries normalize to a number; if the pipeline stores integer minor units or rounds, define it once. Decimal amounts are preserved to at least two fractional digits.

**`parsePercent` / FTE (adds comma-decimal + fraction heuristic):**

- Accept comma-decimal as well as dot-decimal: `87,5` -> 87.5, `100,00` -> 100, `87,5%` -> 87.5, `80 %` -> 80 (pp-04, pp-05, pp-06, pp-13, P4). Strip `%` (with optional space) first, then comma-to-dot.
- **Column-level fraction heuristic** (not a per-cell silent transform): when a percent/FTE column's non-blank cells are all <= 1.0, multiply each by 100 (`0.8` -> 80, `1.0` -> 100, `0.375` -> 37.5, `0,8` -> 80) AND emit a `fractionScaled` warning through `validate.ts` (pp-07, pp-08, pp-09, pp-10, pp-11, pp-15, pp-16, pp-24, B4-fraction-fte). Because the decision to scale depends on the whole column, the per-cell `parsePercent` takes a flag/mode indicating the column was detected as fractional; it does not decide scaling on a single cell. Range stays [0, 100] after scaling.
- Text FTE (`Heltid` -> 100, `Deltid` -> warn/ambiguous) and text-prefixed numbers (`deltid 50%` -> 50) are lower priority (pp-18, pp-19, pp-20); the plan may defer them, but if included they go through the same warning path. FTE > 100 (overtime) stays a decision left null unless the plan opts in (pp-17, pp-23).

**`parseDate` (revises "ISO-8601-only"):**

Accept, all normalizing to `YYYY-MM-DD`, all calendar-validated:
- ISO `YYYY-MM-DD` (locked, date-01).
- **`DD.MM.YYYY` and `D.M.YYYY`** (dot, dominant nb/da/fi) -> ISO (date-05, date-06, date-10, B3-dotdate).
- **`DD/MM/YYYY`** (slash) -> ISO, with the ambiguity policy below (date-02, date-09).
- **`YYYYMMDD`** (8-digit compact) -> ISO, guarded so it is only tried in a date-headed column context (date-07, date-08); a bare 8-digit number elsewhere is an id.
- **Datetime strip**: `YYYY-MM-DD 00:00:00` and `YYYY-MM-DDT00:00:00` -> date part (date-11, date-12, date-13).
- **`YYYY/MM/DD`** year-first slash -> ISO (date-25).
- **Personnummer prefix**: `19850612-1234` -> `1985-06-12`, and short `850612-1234` -> `1985-06-12` with century expansion using the caller-supplied reference year (date-14, date-15). The engine never invents the century from the clock.
- **Excel serial**: a value in a date-headed column within the plausible serial range (~40000-60000, finalized in plan) using the Excel epoch 1899-12-30 -> ISO (date-18, date-19). Header-gated to avoid converting salaries.
- **Two-digit year** `YY-MM-DD` with century expansion + warning, and **month-name** `15 jan 2023` are lower priority (date-20, date-21); defer or include per plan.

**Ambiguity policy (explicit, testable):**
- For slash and dot dates where both interpretations are calendar-valid: **default to Nordic day-first (`DD/MM`, `DD.MM`)** across sv/nb/da/fi/en (date-02, date-04). 
- When the day component is <= 12 (so `MM/DD` is also plausible), still parse as `DD/MM` but emit an `ambiguousDate` warning through `validate.ts` so the wizard can flag it (date-04). When the first component is > 12, it is unambiguously the day (date-02); when the second is > 12, it is unambiguously the month and the US `MM/DD` reading is taken (date-03). This is a deterministic rule, not a locale-of-host guess.

**`parseGender` (Decision 3: broaden, stay binary, flag the rest):**

- Resolve MORE inputs to the existing two values:
  - nb: `mann` -> Man, `kvinne` -> Kvinna (GEN-05, ENC-06, B4-gender-no).
  - da: `mand` -> Man, `kvinde` -> Kvinna (GEN-06, P5).
  - fi: `mies` -> Man, `nainen` -> Kvinna (GEN-07, ENC-07).
  - en: `f` -> Kvinna (symmetric with existing `m` -> Man) (GEN-04, GEN-10, GEN-17, GEN-18).
  - **Numeric statistical codes where unambiguous**: the SCB/SAP convention `1` -> Man, `2` -> Kvinna, applied ONLY when the column header matched gender (GEN-09, GEN-21, P6, D7). 
- **No third canonical value.** The return type stays `"Man" | "Kvinna" | null`. Non-binary tokens (`Annat`, `Other`, `X`, `Ukjent`, `Muu`) and any unrecognized/blank value return `null` (GEN-13, GEN-22 are NOT mapped to a new value).
- **Ambiguous numeric codes are flagged, not guessed.** If a numeric gender code cannot be unambiguously mapped (e.g. a `0`-based code, or a code the SCB `1/2` convention does not cover), `parseGender` returns null and `validate.ts` emits the unresolved-gender flag rather than assigning a value. The 1-vs-2 mapping is only applied for exactly `1` and `2` under a gender header.

**`parseBool`:** add `nei` (nb, bool-01), `kylla`, `ei` (fi, bool-02, bool-03, P7). The plan decides on `y`/`n` (bool-07), `x`/blank (bool-08), `sant`/`falskt` (bool-09), and numeric `1`/`0` (bool-06, with the percent/id priority resolution from shape contract 6).

**Identifiers (`parseIntId` + new `parseStringId`):**

- Add **`parseStringId`** that returns the trimmed string verbatim for any `isId`-accepted value, preserving leading zeros (`00042` -> `"00042"`) and alphanumeric codes (`EMP001` -> `"EMP001"`) (id-01, id-05). Id-shaped fields use `parseStringId` so identity is preserved; `externalRef` and `statisticalCode` keep their string identity.
- **Safe-integer guard** on `parseIntId`: an integer beyond `Number.isSafeInteger` (`123456789012345678`) returns null (and the string path preserves it) rather than corrupting to `...680` (id-07).
- Personnummer strings (`19850612-1234`, `850612-1234`, `8506121234`) are preserved as strings by `parseStringId` (id-03, id-04, id-09). The date extraction for a birthDate field is `parseDate`'s personnummer branch above; the id field keeps the verbatim string. A 10-digit no-hyphen personnummer stays a string with an optional heuristic warning (id-09).
- Space-inside employee numbers (`100 42`) resolve as ids when the header matches an id field (id-08, SC-02); the shape fix (money floor) plus header override handle this.

**Locks:** all correct parse baselines (M01/M05-M07/SC-24 money; pp-01/02/03/12/21/22 percent; date-01/22/23 date; GEN-01/02/03/11/16 gender; bool-10/11 boolean; id-06/10 id).

### `validate.ts` (data-quality codes)

Today: `RowIssueCode` = `duplicateId | unparsableMoney | nonNumericCode | blankGender | genderNameMismatch`; `blocking` is required-fields-not-mapped; the wizard already consumes `unparsableMoney` and `blankGender` (i18n keys exist under `dashboard.people.import.review`). Catalog: validate.test.ts plan rows (A4, ENC-04, ENC-24, pp-07, pp-19, GEN-22).

**Contracts (keep all existing codes; add the following):**

1. **`invalidFileFormat` blocking / typed signal.** When `tokenizeCsv` raises the binary-signature `ImportFormatError`, the pipeline surfaces a distinct blocking signal `invalidFileFormat` (a typed code, decided in plan: either a dedicated blocking entry alongside the missing-required-fields list, or a top-level typed result) so the wizard shows "wrong file format, export as CSV" and NOT "missing columns" (A1-A4). This is the primary Decision-2 deliverable on the validate side.

2. **Unresolved-gender flag (Decision 3).** Rename/repurpose the gender signal so the wizard's per-row "assign gender" UI has a clear per-row flag: keep emitting a per-row issue (today `blankGender`) for every row whose gender cell is blank or unrecognized after the broadened `parseGender`. This is the engine's contribution to flag-and-assign: the engine flags the row; the wizard collects a manual `Man`/`Kvinna` assignment. The code name and detail are finalized in the plan (either keep `blankGender` or introduce `unresolvedGender`), but the contract is: a two-gender system, every unresolved row flagged, no third value, the assignment happening downstream. Numeric-ambiguous gender codes flag through this same path.

3. **`fractionScaled` warning** for a percent/FTE column normalized x100 by the fraction heuristic (pp-07, B4-fraction-fte), so the x100 transform is never silent.

4. **`ambiguousDate` warning** for a slash/dot date parsed as `DD/MM` while `MM/DD` was also calendar-valid (day <= 12) (date-04), per the ambiguity policy.

5. **`negativeValue` row-issue code** for a negative or parenthesized-negative money cell, so correction/deduction rows surface named instead of as an opaque `unparsableMoney` (ENC-24).

6. **Optional `raggedRow` and `noDelimiter` signals** wired from the tokenizer's raggedness and single-column signals (T19/T20, T38), and an optional `mojibake` warning when multiple headers contain the `Ã¥/Ã¶/Ã¤/Ã¸/Ã¦` double-encoding sequence (ENC-04). These are upstream/encoding-adjacent; the plan may scope them to the same commit or defer, but they must not regress existing behavior.

**Every new code ships with:**
- A readable label in `dashboard.people.import.*` (the wizard already namespaces `unparsableMoney`, `blankGender` there) in **every locale** (en source first, then sv/nb/da/fi), per the i18n rules. `invalidFileFormat` in particular needs a clear localized "export as CSV" message.
- The engine emits only the **code**, never display text (backend/engine returns codes, frontend translates).

**Downstream (NOT part of the pure engine, note only):** the wizard's per-row "assign gender" UI, the "export as CSV" guidance screen, and any byte-level encoding re-decode (UTF-16, Windows-1252) are consumers of the engine's typed codes/flags. They live in `apps/dashboard` (the import wizard) and are named here so plans do not accidentally push UI concerns into `packages/import`.

---

## Locale parity

Locale parity is why the fold fix and the nb/da/fi word additions are **required, not optional**. Every parser/detector change must be verified in en, sv, nb, da, fi:

- **`fold`** must let nb `o-slash` and da `ae` survive so nb/da headers and gender words match at all (ENC-05, DC-13, DC-14). Without it, nb and da are broken end to end regardless of any other fix.
- **`parseGender`** must cover sv (Man/Kvinna/M/K), en (Male/Female/Man/Woman/M/F), nb (Mann/Kvinne), da (Mand/Kvinde), fi (Mies/Nainen). A gender column that works in sv but not in nb is a parity failure.
- **`parseBool`** must cover sv (ja/nej), en (yes/no/true/false), nb (ja/nei), fi (kylla/ei).
- **Number formats** (comma-decimal, space/NBSP grouping, dot-thousands) are the shared Nordic reality across sv/nb/da/fi; the money/percent contracts must pass for each locale's dominant export shape.
- **Dates** default to Nordic day-first across all five locales with the documented ambiguity warning.
- **Synonym coverage** must include the fi (`henkilonro`, `peruspalkka`, `tehtavanimike`), nb (`grunnlonn`, `fodselsdato`, `fornavn`, `etternavn`, `stilling`), and da (`grundlon`, `koen`) headers.

Any locale content that is machine-drafted (none is required here, since these are code-level tokens, not UI copy) would be flagged for native review; the new i18n **labels** for the validate codes are drafts in nb/da/fi/sv until native review, per the i18n rules.

---

## Test strategy

The exhaustive suite is organized per module, mirroring the catalog's "Proposed test plan". Each module's tests fall into three kinds:

- **(i) LOCK**: pin correct current behavior so the fixes do not regress it. These pass today and must keep passing.
- **(ii) FAIL-TODAY**: encode a bug/gap; written now, and either land red-then-green in the same change as the fix or as a failing-spec test that the fix turns green. Every catalog `bug`/`unsupported` row in scope gets one.
- **(iii) FIXTURE**: end-to-end real-shaped files run through `tokenize -> detect -> validate`, asserting mapped fields, blocking list, and per-row issues.

Per file (ids reference the catalog):

- **`tokenize.test.ts`**: LOCK the delimiter/quote/BOM/CRLF/Nordic baselines (T01-T07, T10-T11, T24-T33, T36-T37, ENC-18-20). FAIL-TODAY for mixed endings (T08/T09), `sep=` directives (T12-14, T39, T40), preamble/metadata/hash (T15, T16, T34), units row (T17), trailing empty column (T18), ragged rows (T19/T20), duplicate/blank headers (T21/T22), padded headers trimmed (T23), null bytes (T35), single-column signal (T38), UTF-16 BOM strip (ENC-02), and the **binary-signature guard** raising the typed error for XLSX/XLS/ODS (A1-A3).
- **`shape.test.ts`**: LOCK the SC baselines, gender/date columns that already work, NBSP/thin-space money. FAIL-TODAY for postal-code-as-id (SC-05), grouped-employee-number-as-id (SC-02), small-int-not-percent (SC-03), comma/dot-decimal money columns (SC-20, M10, M14, M15, ENC-10), decimal/space-%/fraction percent columns (pp-13/14/15/16/24), expanded date shapes (date-08/09/10/13, ENC-21), nb/da/fi + M/F + pure-F gender columns (GEN-08/10/17/18), numeric gender header-gated (GEN-21), nb/fi boolean columns (bool-04/05) and numeric/Y-N/X boolean (bool-06/07/08), personnummer id shape (id-03/04), and the `fillRate`/sparse-confidence signal (SC-09).
- **`parse.test.ts`**: LOCK the correct parse baselines. FAIL-TODAY across `parseMoney` (comma/dot decimal, dot-thousands, prefix/suffix currency, symbol, run-on: M10/11/13/14/15/17/18/19/33/35/40/41/43, ENC-11, P3), `parsePercent` (comma-decimal + fraction: pp-04/05/06/07/08/09/10/11, P4), `parseDate` (the full expanded set + ambiguity: date-02 through date-21, date-25, B3-dotdate), `parseGender` (nb/da/fi/en-F/numeric: GEN-04/05/06/07/09, ENC-06/07, P5/P6), `parseBool` (nei/kylla/ei/...: bool-01/02/03, P7), and `parseIntId`/`parseStringId` (leading-zero, alphanumeric, safe-integer guard, personnummer: id-01/03/05/07/09).
- **`detect.test.ts`**: LOCK the correct DC baselines and the deterministic tie-break. FAIL-TODAY for nb/da/fi full mappings after the fold + `lon`-removal + synonym fixes (DC-13/14/15/25), shape-only no longer absorbing cost/pay-band/blank columns (DC-09/12/21/22, ENC-16), duplicate-synonym runner-up to unmapped (DC-10, SC-14/25), the new synonyms (DC-03/06/17/23, D3/D4/D7), Alder suppressed from birthDate (DC-02), postal code not stolen into variable (SC-13/22), and bare-integer salary under a salary header (M01/M44, B3-bareint, D5).
- **`validate.test.ts`**: FAIL-TODAY for the `invalidFileFormat` blocking/typed code from binary input (A4), the unresolved-gender flag path (Decision 3), `fractionScaled` (pp-07, B4), `ambiguousDate` (date-04), `negativeValue` (ENC-24), and optional `mojibake`/`raggedRow`/`noDelimiter` (ENC-04, T19/20, T38). Also LOCK that existing `duplicateId`/`unparsableMoney`/`nonNumericCode`/`genderNameMismatch` behavior is unchanged.

**End-to-end fixtures** (`fixtures/` + a pipeline test), each a real-shaped file asserting mapped fields, blocking list, per-row issues:
- LOCK: `visma-sv.csv` (NBSP salary, semicolon, Swedish headers) -> 4 required fields at high confidence, no blocking (B1-ok).
- FIXTURE (fail-today until fixes land): `hogia-sv.csv` (comma-decimal `41 300,00`, `Grundlon`) -> basicMonthly parsed, no `unparsableMoney` (B2); `workday-en.csv` (bare int `72000` under `Base Pay`, `Female`, `Hire Date` `15.03.2019`, NOK) -> basicMonthly + employmentStartDate mapped (B3); `personec-no.csv` (`Fodselsdato` DD.MM.YYYY, `Grunnlonn`, `Mann`/`Kvinne`, fraction FTE `0,8`) -> birthDate + basicMonthly + gender mapped, FTE normalized to 80 with `fractionScaled` (B4, D3, D4); `sap-successfactors.csv` (`PERNR`/`PLANS`/`GESCH`/`ANSAL`, GESCH `1`/`2`) -> externalRef/title/gender/basicMonthly mapped (D7, P6); `fortnox-sv.csv` (full canonical sv) -> all mapped (regression companion to DC-16); `binary.xlsx` (first bytes only) -> typed `ImportFormatError` / `invalidFileFormat` blocking, not missing-columns (A1, A4).

Testing conventions from CLAUDE.md apply: Vitest 4 via `bun run test`, `packages/import` keeps its own `vitest.config.ts`, new code ships with tests in the same commit, i18n parity guarded.

---

## Phased breakdown (proposed implementation plans)

Three plans, each independently testable. Ordering reflects dependency: A unblocks nb/da end to end and is pure bug-fixing; B is the ADR-backed spec expansion; C wires the new signals through validate.

**Plan A: pure bug/parity fixes + tokenizer + binary guard.** No spec conflict; ships first.
- `fields.ts`: `fold` pre-NFD substitution (o-slash, ae); remove bare `lon`; add the nb/da/fi/SAP/Workday synonyms; minimum-length substring guard.
- `shape.ts`: nb/da/fi + English-F gender values; nb/fi boolean values; postal-code/grouped-number money floor + thousands-pattern rule; personnummer id patterns; `fillRate`/`sampleSize` signal.
- `detect.ts`: restrict shape-only fallback to distinctive shapes; exclude header-candidate losers and blank-header columns; respect the min-length substring guard.
- `parse.ts` (non-spec-conflicting parts): broaden `parseGender` words + header-gated numeric 1/2; broaden `parseBool`; add `parseStringId` + safe-integer guard for identifiers.
- `tokenize.ts`: line-ending normalization; `sep=` directive; header trimming; preamble/metadata/hash skip; ragged-row normalization; duplicate/blank header handling; trailing-empty-column strip; null-byte cleanup; single-column signal; **binary-signature guard raising the typed `ImportFormatError`**.
- Tests: all LOCK + the FAIL-TODAY rows above for these modules.

**Plan B: ADR-backed number/date/FTE format expansion.** Depends on ADR-0010; touches the documented spec choices.
- `parse.ts`: `parseMoney` comma-decimal, dot-decimal, dot-thousands, currency prefix+suffix+symbol, run-on suffix, decimal amounts, explicit null cases (revises integer-only); `parsePercent` comma-decimal + column fraction heuristic; `parseDate` DD.MM/DD/MM/YYYYMMDD/datetime/YYYY-first/personnummer-prefix/Excel-serial with the Nordic day-first ambiguity policy (revises ISO-only).
- `shape.ts`: `isMoney`/`isPercent`/`isDate` extended to match the parser exactly (kill the detector/parser mismatches), header-gated Excel-serial and personnummer date shapes, fraction percent sub-case.
- Update the in-code "integer-only"/"ISO-only"/"no signs" comments to reference ADR-0010.
- Tests: the money/percent/date FAIL-TODAY suites, and the shape-column suites for the new number/date shapes.

**Plan C: validate flags + gender-flag emission + fixtures.** Depends on A and B for the codes to be meaningful.
- `validate.ts`: `invalidFileFormat` blocking/typed code from the tokenizer error; the unresolved-gender flag (Decision 3) for the wizard's assign-gender UI; `fractionScaled`, `ambiguousDate`, `negativeValue`, and optional `mojibake`/`raggedRow`/`noDelimiter`.
- i18n: labels for every new code in en (source) + sv/nb/da/fi, flagged for native review; keep the engine emitting codes only.
- End-to-end fixtures + pipeline test (visma/hogia/workday/personec/sap/fortnox/binary).
- Tests: the validate FAIL-TODAY suite and the fixture suite.

Each plan is independently testable: A and B each pass their own module suites without C; C's fixtures assert the composed pipeline once A and B land.

---

## Out of scope

- **A binary `.xlsx`/`.xls`/`.ods` parser.** V1 requires CSV and guards binary input with a typed error and a clear "export as CSV" message. A client-side parser (e.g. SheetJS) is a documented future option only, deferred until a real customer's system cannot export CSV (Decision 2, catalog Decision A).
- **A third gender value.** The system stays exactly two genders (`Man`, `Kvinna`); unresolved rows are flagged for manual assignment, never mapped to `Okant`/`Other`/`X` (Decision 3, and a deliberate departure from catalog Decision C).
- **Any change to the deterministic score/band path.** The import engine feeds people data into the pipeline; it never computes or stores scores/bands (ADR-0002 unchanged).
- **en-US comma-thousands, Swiss apostrophe grouping, continental dot-thousands as the sole format, negative/parenthesized money as parseable values, month-name and two-digit-year dates** are left unsupported for V1 (they return null / land unmapped) unless a plan explicitly opts one in; the audit rows are recorded so a later change is a known, tested delta.
- **Byte-level encoding recovery** (UTF-16 re-decode, Windows-1252 mojibake fix) stays a wizard/caller responsibility; the engine only guards binary signatures and can warn on mojibake sequences.
