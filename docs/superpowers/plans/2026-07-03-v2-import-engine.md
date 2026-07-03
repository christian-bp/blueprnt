# V2 Salary Import — Plan 1: the import engine (`@workspace/import`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new shared package that ingests a payroll CSV: tokenize it, auto-detect which source column maps to each canonical import field, parse/normalize the messy values, and validate readiness + data quality. This is the load-bearing logic behind the import wizard (client-side preview) and the import mutation (server-side re-validation).

**Architecture:** A new `packages/import` package (`@workspace/import`), imported by both the dashboard client and the Convex backend so detection/validation runs identically in the wizard and in the server-side re-check. It is **pure and deterministic** (no Convex/Next/React imports, no side effects, no clock/network/randomness) so it is safe on both sides, but it **may use well-tested dependencies** — it uses `papaparse` for robust CSV tokenization rather than hand-rolling a parser. `packages/core` (the comp/scoring engine) is untouched; import is a separate domain.

**Tech Stack:** TypeScript, Vitest 4 (`@workspace/vitest-config/base`), `papaparse` (CSV tokenizer).

## Global Constraints

- `@workspace/import` is pure and deterministic: no Convex/Next/React import, no side effects, no `Date.now()`/`Math.random()` in its logic (a "current year" default is passed in by the caller). Dependencies are allowed as long as they are pure/deterministic/side-effect-free; `papaparse` qualifies (string in, rows out).
- Deterministic detection only. The CSV carries salary + identity PII, which must never reach the AI or any external service (GDPR; ADR-0003 extended to the pay path). Column detection is header-synonym + value-shape heuristics, run locally.
- English identifiers and comments. No em dashes in copy/comments.
- New code ships with tests in the same commit; run with `bun run test` (Vitest 4), never `bun test`. Each package with tests has its own `vitest.config.ts` extending `@workspace/vitest-config/base`.
- Canonical field keys are the single source of truth, re-exported from the package index; the later mutation and wizard import them from here.
- Engine functions return data/verdicts; they never throw for bad *input data* (bad rows become validation issues). They may throw only for programmer error.

---

### Task 1: Package scaffold + canonical fields + synonym dictionary

**Files:**
- Create: `packages/import/package.json`, `packages/import/tsconfig.json`, `packages/import/vitest.config.ts`, `packages/import/src/index.ts`
- Create: `packages/import/src/fields.ts`
- Test: `packages/import/src/fields.test.ts`

**Scaffold:** `package.json` name `@workspace/import`, `"exports": { ".": "./src/index.ts" }`, `dependencies`: `papaparse`; `devDependencies`: `@workspace/typescript-config`, `@workspace/vitest-config`, `@types/papaparse`, `typescript`, `vitest` (match the versions used by `packages/core`). `tsconfig.json` extends `@workspace/typescript-config`. `vitest.config.ts` extends `@workspace/vitest-config/base`. `src/index.ts` starts empty and gets its exports in later tasks. Run `bun install` after adding the package.

**Interfaces (produced):** `CANONICAL_FIELDS` (readonly array), `type CanonicalFieldKey`, `type FieldTier = "required" | "recommended" | "optional"`, `type ValueShape = "id" | "text" | "money" | "percent" | "date" | "gender" | "boolean"`, `type FieldDef = { key: CanonicalFieldKey; tier: FieldTier; shape: ValueShape; synonyms: string[] }`, and `fold(s: string): string`.

Canonical fields (required tier = the four the spec §5.4 marks required):

| key | tier | shape |
|---|---|---|
| `externalRef` | required | id |
| `title` | required | text |
| `gender` | required | gender |
| `basicMonthly` | required | money |
| `firstName` | recommended | text |
| `lastName` | recommended | text |
| `ftePercent` | recommended | percent |
| `payYear` | recommended | id |
| `birthDate` | recommended | date |
| `employmentStartDate` | recommended | date |
| `statisticalCode` | recommended | id |
| `variable` | optional | money |
| `benefitInKind` | optional | money |
| `currency` | optional | text |
| `country` | optional | text |
| `department` | optional | text |
| `isManager` | optional | boolean |

Synonyms are folded (lowercased, accent-stripped, non-alphanumerics removed) header candidates across sv/nb/da/fi/en. Seed at least: `externalRef` ← anstnr, anstallningsnummer, employeeid, empno, employeenumber; `gender` ← kon, kön, gender, sex, kjonn, kjønn, koen, køn, sukupuoli; `basicMonthly` ← manadslon, månadslön, grundlon, grundlön, fastmanadslon, monthlysalary, basesalary, lon, lön; `title` ← befattning, titel, roll, jobtitle, position, stilling; `ftePercent` ← sysselsattningsgrad, sysselssattningsgrad, tjanstgoringsgrad, omfattning, fte; `payYear` ← lonear, löneår, salaryyear, year; `birthDate` ← fodelsedatum, födelsedatum, birthdate, dob; `employmentStartDate` ← anstallningsdatum, anställningsdatum, hiredate, startdate; `statisticalCode` ← statistikkod, ssyk, occupationcode; `variable` ← malbonus, målbonus, bonus, variable; `benefitInKind` ← tjanstebil, tjänstebil, formansbil, benefit, carbenefit; `currency` ← valuta, currency; `country` ← land, country; `department` ← avdelning, department, dept; `isManager` ← chef, manager, ismanager; `firstName` ← fornamn, förnamn, firstname; `lastName` ← efternamn, lastname, surname.

- [ ] **Step 1: Scaffold the package** (the four config/index files); `bun install`.
- [ ] **Step 2: Write the failing test** (`fields.test.ts`): the four required keys are exactly `externalRef`, `title`, `gender`, `basicMonthly`; every field has ≥1 synonym; keys are unique; `fold("Sysselssättningsgrad") === "sysselssattningsgrad"` and `fold("Kön") === "kon"`.
- [ ] **Step 3: Run it, confirm it fails** (`cd packages/import && bunx vitest run src/fields.test.ts`).
- [ ] **Step 4: Implement** `fields.ts` (the table + `fold`: lowercase, NFD-normalize, strip combining marks, strip non-alphanumerics).
- [ ] **Step 5: Run it, confirm it passes.**
- [ ] **Step 6: Commit** (`feat(import): scaffold package + canonical fields and synonym dictionary`).

---

### Task 2: CSV tokenizer (papaparse)

**Files:**
- Create: `packages/import/src/tokenize.ts`
- Test: `packages/import/src/tokenize.test.ts`

**Interfaces:**
- Produces: `tokenizeCsv(text: string): { headers: string[]; rows: string[][] }`.

Use `papaparse` with auto delimiter detection (`delimiter: ""`), `skipEmptyLines: "greedy"`, no header transform. Strip a leading BOM. Row 1 is the header; the rest are `rows`. Trim each cell of surrounding whitespace at the tokenizer boundary is NOT done here (value parsers own trimming) except that papaparse handles quoted fields and embedded delimiters.

- [ ] **Step 1: Write the failing test:** a UTF-8-BOM, `;`-delimited fixture with a quoted field containing a `;`, one blank trailing line, and the real header row. Assert `headers.length === 16`, the header names match, blank trailing line is dropped, and the quoted field is one cell.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** `tokenizeCsv`.
- [ ] **Step 4: Run it, confirm it passes.**
- [ ] **Step 5: Commit** (`feat(import): CSV tokenizer via papaparse`).

---

### Task 3: Value-shape heuristics

**Files:**
- Create: `packages/import/src/shape.ts`
- Test: `packages/import/src/shape.test.ts`

**Interfaces:**
- Consumes: `ValueShape` (Task 1).
- Produces: `classifyColumn(values: string[]): { shape: ValueShape; confidence: number }` (confidence = share of non-blank cells matching the winning shape).

Detectors on trimmed cells: `isMoney` (interior digit-group, spaces allowed, optional `kr|sek|nok|dkk|eur` suffix), `isPercent` (integer 0-100, optional `%`), `isDate` (`YYYY-MM-DD`), `isGender` (folded in {man, kvinna, m, k, male, female, woman}), `isBoolean` (folded in {ja, nej, yes, no, true, false}), `isId` (pure integer or short alphanumeric), else `text`. Priority order [gender, boolean, money, percent, date, id]; pick the highest match-ratio shape above a 0.6 floor, else `text`.

- [ ] **Step 1: Write the failing test** (table): `["94 500 kr","49 788 kr"]`→money; `["100","80","75"]`→percent; `["2026","2026"]`→id (fails the 0-100 percent range); `["1985-01-11"]`→date; `["Man","Kvinna","Man"]`→gender; `["Ja","Nej"]`→boolean; `["Head of Ops","Elektronikkonstruktör"]`→text; mixed `["Man","Man","xyz"]`→gender confidence ≈ 0.67.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** `classifyColumn`.
- [ ] **Step 4: Run it, confirm it passes.**
- [ ] **Step 5: Commit** (`feat(import): value-shape column heuristics`).

---

### Task 4: Column detection (header synonyms + shape)

**Files:**
- Create: `packages/import/src/detect.ts`
- Test: `packages/import/src/detect.test.ts`

**Interfaces:**
- Consumes: `CANONICAL_FIELDS`, `fold` (Task 1); `classifyColumn` (Task 3).
- Produces: `detectColumns(input: { headers: string[]; rows: string[][] }): DetectedMapping` where `DetectedMapping = { map: Partial<Record<CanonicalFieldKey, { columnIndex: number; confidence: number }>>; unmappedColumns: number[] }`.

Per source column: header score per field = 1.0 exact folded-synonym match, 0.7 contains/startsWith, else 0; column shape from a sample of up to 20 rows. Score(field,col) = headerScore boosted `+0.2` when the column shape matches the field's `shape` (cap 1.0); if headerScore is 0 but the shape matches and the field is unassigned, allow a `0.4` shape-only candidate. Assign greedily by descending score, one column per field and one field per column; unmatched columns go to `unmappedColumns`.

- [ ] **Step 1: Write the failing test** using the real 16-column header (incl. the `Sysselssättningsgrad` typo) + 2 sample rows: assert `externalRef`→`Anstnr`, `gender`→`Kon`, `basicMonthly`→`Månadslön`, `title`→`Befattning`, `ftePercent`→`Sysselssättningsgrad`, `payYear`→`Löneår`, `currency`→`Valuta`. Second case: English headers (`EmployeeID;Gender;Base Salary;Job Title`) map correctly. Third: a `Foo`-headed column full of `Man`/`Kvinna` maps to `gender` at low confidence when gender is otherwise unmapped.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** `detectColumns`.
- [ ] **Step 4: Run it, confirm it passes.**
- [ ] **Step 5: Commit** (`feat(import): CSV column auto-detection`).

---

### Task 5: Value parsers / normalizers

**Files:**
- Create: `packages/import/src/parse.ts`
- Test: `packages/import/src/parse.test.ts`

**Interfaces:**
- Produces (all total, return `null` on unparseable, never throw): `parseMoney` (`"94 500 kr"`→94500), `parseCurrency` (`" SEK "`→"SEK"), `parsePercent` (`"80"`→80, `"100%"`→100, out-of-range→null), `parseGender` (→`"Man"|"Kvinna"|null`), `parseDate` (validates `YYYY-MM-DD`), `parseBool` (ja/yes/true→true, nej/no/false→false), `parseIntId` (`"251200"`→251200, `"UX Developer"`→null).

- [ ] **Step 1: Write the failing test** covering each parser incl. the messy real values, blanks, and out-of-range percents.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** the parsers.
- [ ] **Step 4: Run it, confirm it passes.**
- [ ] **Step 5: Commit** (`feat(import): value parsers`).

---

### Task 6: Readiness + data-quality validation + public API

**Files:**
- Create: `packages/import/src/validate.ts`
- Test: `packages/import/src/validate.test.ts`
- Modify: `packages/import/src/index.ts` (re-export the public API: `CANONICAL_FIELDS`, types, `tokenizeCsv`, `detectColumns`, the parsers, `validateImport`).

**Interfaces:**
- Consumes: everything above.
- Produces: `validateImport(input, mapping, opts): ImportValidation` where `ImportValidation = { readiness: { key: CanonicalFieldKey; tier: FieldTier; mapped: boolean }[]; blocking: CanonicalFieldKey[]; warnings: CanonicalFieldKey[]; issues: RowIssue[] }` and `RowIssue = { row: number; code: "duplicateId" | "unparsableMoney" | "nonNumericCode" | "blankGender" | "genderNameMismatch"; detail: string }`.

Rules: `blocking` = required fields not mapped. `warnings` = recommended fields not mapped. `issues`: duplicate `externalRef` in the batch; non-blank `basicMonthly` cell that `parseMoney` returns null for; `statisticalCode` mapped but a cell is non-numeric; blank/unparseable `gender` cell; optional gender/name mismatch (conservative soft heuristic on a short known-name list, never hard-blocks).

- [ ] **Step 1: Write the failing test** with a fixture derived from the test file: a duplicate `Anstnr` (114), a non-numeric `Statistikkod`, a dropped salary mapping (→ `blocking` has `basicMonthly`), a dropped FTE mapping (→ `warnings` has `ftePercent`). Assert `issues` codes at the right row indices.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement** `validateImport`; wire `index.ts`.
- [ ] **Step 4: Run the whole package** (`cd packages/import && bunx vitest run`) and `bun run typecheck` for `@workspace/import`; confirm green.
- [ ] **Step 5: Commit** (`feat(import): readiness + data-quality validation and public API`).

---

## Self-review

- Spec coverage: covers spec §5.2 (tokenize/upload parsing), §5.3 (deterministic detection), §5.4 (required/recommended warnings), §5.5 (parse + data-quality gates). Excludes the schema + persistence mutations and the wizard UI (their own plans).
- Placement: the engine lives in its own `@workspace/import` package (pure, deterministic, shared client+server), free to use `papaparse`. `packages/core` is untouched. This reflects the clarified invariant: purity means no framework coupling / no side effects / determinism, not an empty dependency list.
- Type consistency: `CanonicalFieldKey`/`ValueShape`/`FieldTier` (Task 1) flow unchanged through Tasks 3-6; `detectColumns` output feeds `validateImport`.
- No placeholders: each task's behavior is pinned by test cases drawn from the real anonymized file.

## Follow-on plans (not in this plan)
1. **Persistence:** `people` / `personAssignments` / `importMappingProfile` schema; the `importPeople` upsert mutation (upsert on `externalRef`, archive leavers); authoritative `employeeCount`; person erasure hard-delete. The Convex action calls `@workspace/import` to tokenize + validate server-side. Tests via convex-test.
2. **Import wizard UI:** the `ImportWizard` on the onboarding frame (upload → map → check → review), consuming this package + the mutations.
3. **Classification:** title → V1 role mapping + HR-confirmed level suggestion.
