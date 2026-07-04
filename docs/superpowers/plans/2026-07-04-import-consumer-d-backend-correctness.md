# Import Consumer D: Backend Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `importPayroll` "use node" action consume the overhauled `@workspace/import` engine correctly, so real Nordic payroll exports (fraction FTE, ambiguous dates, numeric SAP gender codes, compact/serial/personnummer dates, binary files) import end-to-end instead of being silently skipped.

**Architecture:** The pure engine (`@workspace/import`) is correct; the bug surface is entirely in the backend consumer `packages/backend/convex/people/import.ts`. This plan (1) narrows row-skipping to a HARD_SKIP set of `RowIssueCode`s so soft issues no longer drop rows, (2) threads the engine's option flags (`allowNumericCodes`, `headerGated`/`referenceYear`, `fraction`) into the per-cell parsers, (3) guards binary input via `validateFile` and surfaces `fileWarnings`/`fileFormatError`, and (4) adds a `genderOverrides` arg so the wizard can supply Man/Kvinna for unresolved-gender rows. Every task is TDD with convex-test against small dedicated backend fixtures.

**Tech Stack:** Convex actions/mutations (object-form, `"use node"`), `@workspace/import` (pure engine), convex-test on `edge-runtime`, Vitest 4 (`bun run test`), Biome.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec.

- **Org-scoped + admin-gated action.** `importPayroll` calls `requireOrgAdminAction(ctx, args.orgId)`; keep that gate first.
- **Deterministic + no AI.** The import path is pure parsing and persistence. No AI calls, no model access.
- **PII/salary stay in the EU deployment and never in audit payloads (counts only).** `logImportCompleted` stays counts-only; `appendSalary` stays amount-free; the person audit diff stays over `nonPiiFields`.
- **Every state-changing mutation already audits.** `upsertPersonByExternalRef`, `appendSalary`, `internalSaveImportMappingProfile`, `setEmployeeCountFromPeople`, and `logImportCompleted` already write their audit rows; this plan does not add auditable operations, so no new `AUDIT_EVENTS` keys or labels are required.
- **New code ships with tests in the same commit** (convex-test, `edge-runtime`; Vitest 4 via `bun run test`, never `bun test`).
- **English only, no em dashes** in code, comments, and copy. Use a period, comma, colon, or parentheses.
- **Conventional commits** (`feat:`, `fix:`, `test:`, `refactor:`).
- **DRY and typed by default.** The HARD_SKIP set is a single typed constant keyed by `RowIssueCode`; no duplicated literal lists across call sites.

---

## File Structure

- `packages/backend/convex/people/import.ts` — the only source file changed. All six tasks modify this action.
- `packages/backend/convex/people/import.test.ts` — the only test file changed. All six tasks add tests here (it already imports `initConvexTest`, `api`, `components`, and the fixture-loading pattern).
- `packages/backend/convex/people/__fixtures__/` — three small new CSV/binary fixtures added here. The backend cannot read `packages/import/fixtures/*` at a stable path (the `@workspace/import` package does not export its `fixtures/` dir and there is no reliable node_modules symlink), so we mirror the shapes we need as tiny local fixtures. This matches the existing pattern (`import-testfil.csv` already lives here).

Column indices, parser option flags, and the skip decision all live inside the single `handler`; there is no new module. The one new exported constant (`HARD_SKIP_CODES`) lives at the top of `import.ts` next to `importResultValidator`.

---

### Task 1: HARD_SKIP row-triage set

The central bug: `skippedRowIndices = new Set(validation.issues.map((i) => i.row))` skips **every** row with **any** issue. `fractionScaled` and `ambiguousDate` are emitted per row, so a fraction-FTE file or an ambiguous-date file imports **nothing**. Fix: skip a row only when it has a HARD issue.

**Files:**
- Modify: `packages/backend/convex/people/import.ts:131-132` (the `skippedRowIndices` construction) and add the `HARD_SKIP_CODES` constant near the top.
- Add fixtures: `packages/backend/convex/people/__fixtures__/personec-fraction.csv`, `packages/backend/convex/people/__fixtures__/sap-numeric-gender.csv`
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes: `RowIssueCode` from `@workspace/import` (union of `"duplicateId" | "unparsableMoney" | "nonNumericCode" | "unresolvedGender" | "genderNameMismatch" | "fractionScaled" | "ambiguousDate" | "negativeValue" | "raggedRow"`); `validation.issues` from `validateImport`.
- Produces: `HARD_SKIP_CODES: ReadonlySet<RowIssueCode>` and a `skippedRowIndices` set that contains only rows with a HARD issue. Consumed by Tasks 2-6 (all downstream skip logic keys off this set).

HARD codes (row cannot be persisted): `duplicateId`, `unparsableMoney`, `unresolvedGender` (cannot insert without a `Man`/`Kvinna` gender: `upsertPersonByExternalRef` requires `v.union(Man, Kvinna)`), `negativeValue` (unusable salary), `raggedRow`. SOFT codes (row is fine, issue is informational): `fractionScaled` (the value was scaled x100, that is a correctness improvement), `ambiguousDate` (DD/MM was assumed and is valid), `nonNumericCode` (`statisticalCode` is optional), `genderNameMismatch` (a conservative heuristic that must never block).

- [ ] **Step 1: Add the two fixtures**

Create `packages/backend/convex/people/__fixtures__/personec-fraction.csv` (Norwegian Personec shape: semicolon-delimited, `Kjønn` words, dot dates, comma-decimal fraction FTE `0,8`). Add a `Grunnlønn` (basicMonthly) column so the required fields are mapped:

```
Ansattnr;Fornavn;Etternavn;Kjønn;Grunnlønn;Fødselsdato;Stillingsprosent
N1;Ola;Nordmann;Mann;54000;12.05.1987;0,8
N2;Kari;Nordmann;Kvinne;62000;03.11.1990;1,0
```

Create `packages/backend/convex/people/__fixtures__/sap-numeric-gender.csv` (SAP SuccessFactors shape: comma-delimited, numeric `GESCH` gender codes 1/2, an `ANSAL` money column):

```
PERNR,PLANS,GESCH,ANSAL
00010001,Senior Consultant,1,72000
00010002,Consultant,2,54000
```

- [ ] **Step 2: Write the failing tests**

Add to `import.test.ts` (fixtures are loaded with the same `readFileSync`/`join(import.meta.dirname, "__fixtures__", ...)` pattern the file already uses):

```typescript
const PERSONEC_FRACTION_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "personec-fraction.csv"),
  "utf8"
)
const SAP_NUMERIC_GENDER_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "sap-numeric-gender.csv"),
  "utf8"
)

const PERSONEC_COLUMN_MAP: string[][] = [
  ["Ansattnr", "externalRef"],
  ["Fornavn", "firstName"],
  ["Etternavn", "lastName"],
  ["Kjønn", "gender"],
  ["Grunnlønn", "basicMonthly"],
  ["Fødselsdato", "birthDate"],
  ["Stillingsprosent", "ftePercent"],
]

const SAP_COLUMN_MAP: string[][] = [
  ["PERNR", "externalRef"],
  ["PLANS", "title"],
  ["GESCH", "gender"],
  ["ANSAL", "basicMonthly"],
]

describe("importPayroll (row-skip triage)", () => {
  it("does NOT skip fraction-FTE rows (fractionScaled is a soft issue)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: PERSONEC_FRACTION_CSV,
      columnMap: PERSONEC_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(true)
    // Both rows have fractionScaled + ambiguousDate (soft) but no hard issue.
    expect(result.skippedRows).toBe(0)
    expect(result.peopleImported).toBe(2)
    expect(result.salariesImported).toBe(2)
  })

  it("does NOT skip numeric-gender rows (SAP GESCH 1/2)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: SAP_NUMERIC_GENDER_CSV,
      columnMap: SAP_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(true)
    expect(result.skippedRows).toBe(0)
    expect(result.peopleImported).toBe(2)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: both new tests FAIL. The fraction test fails because every row carries `fractionScaled`+`ambiguousDate`, so `skippedRows` is 2 and `peopleImported` is 0. The SAP test fails because Task 2 (numeric gender) is not done yet: `parseGender` returns null so the row is skipped by the defensive `if (parsedGender === null) continue`. (This SAP assertion becomes fully green only after Task 2; it is included here because the triage set already needs `unresolvedGender` classified as HARD. If it is convenient to keep the suite green between tasks, mark the SAP `it` with `it.skip` in this commit and un-skip it in Task 2.)

- [ ] **Step 4: Add the HARD_SKIP_CODES constant**

At the top of `import.ts`, add `RowIssueCode` to the existing `@workspace/import` import and define the set below `importResultValidator`:

```typescript
import {
  CANONICAL_FIELDS,
  type DetectedMapping,
  parseBool,
  parseCurrency,
  parseDate,
  parseGender,
  parseMoney,
  parsePercent,
  type RowIssueCode,
  tokenizeCsv,
  validateImport,
} from "@workspace/import"
```

```typescript
// Row-issue codes that make a row impossible to persist, so the whole row is
// skipped. Soft codes (fractionScaled, ambiguousDate, nonNumericCode,
// genderNameMismatch) are informational: the row still imports.
//   - duplicateId:      the same externalRef twice; second write would collide.
//   - unparsableMoney:  no usable basicMonthly.
//   - negativeValue:    negative/parenthesized money is unsupported for V1.
//   - unresolvedGender: person requires a Man/Kvinna gender to insert.
//   - raggedRow:        the row's columns do not line up with the header.
const HARD_SKIP_CODES: ReadonlySet<RowIssueCode> = new Set<RowIssueCode>([
  "duplicateId",
  "unparsableMoney",
  "negativeValue",
  "unresolvedGender",
  "raggedRow",
])
```

- [ ] **Step 5: Narrow skippedRowIndices to HARD issues**

Replace `import.ts:131-132`:

```typescript
    // Step 4: Identify skipped rows. Only HARD issues skip a row; soft issues
    // (fractionScaled, ambiguousDate, nonNumericCode, genderNameMismatch) are
    // informational and the row still imports.
    const skippedRowIndices = new Set(
      validation.issues
        .filter((i) => HARD_SKIP_CODES.has(i.code as RowIssueCode))
        .map((i) => i.row)
    )
```

- [ ] **Step 6: Run tests to verify the fraction test passes**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: the fraction test PASSES (`skippedRows === 0`, `peopleImported === 2`). The SAP test still fails (or is skipped) pending Task 2. The existing happy-path test still expects `skippedRows === 2` (both `Anstnr=114` rows carry `duplicateId`, which is HARD): confirm it stays green.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts packages/backend/convex/people/__fixtures__/personec-fraction.csv packages/backend/convex/people/__fixtures__/sap-numeric-gender.csv
git commit -m "fix(import): skip only hard row issues, not soft ones"
```

---

### Task 2: Numeric gender codes (SAP GESCH 1/2)

`validateImport` resolves numeric gender via `parseGender(raw, { allowNumericCodes: true })` (validate.ts:259), so a SAP file with `GESCH` 1/2 passes validation with no `unresolvedGender` issue. But the action calls `parseGender(cell(genderCol))` with **no opts** (import.ts:178), returns null, and the defensive `if (parsedGender === null) continue` skips every SAP row. Fix: pass `{ allowNumericCodes: true }` so the action matches validate.

**Files:**
- Modify: `packages/backend/convex/people/import.ts:178`
- Test: `packages/backend/convex/people/import.test.ts` (the `sap-numeric-gender.csv` fixture from Task 1)

**Interfaces:**
- Consumes: `parseGender(v: string, opts?: { allowNumericCodes?: boolean }): "Man" | "Kvinna" | null` from `@workspace/import`; the `SAP_COLUMN_MAP` and `SAP_NUMERIC_GENDER_CSV` defined in Task 1.
- Produces: no signature change; `parsedGender` now resolves 1 -> "Man", 2 -> "Kvinna".

- [ ] **Step 1: Write the failing test (or un-skip Task 1's SAP test)**

If Task 1 marked the SAP test `it.skip`, change it to `it`. Otherwise add the stored-gender assertion:

```typescript
describe("importPayroll (numeric gender)", () => {
  it("resolves SAP GESCH 1 -> Man and 2 -> Kvinna", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: SAP_NUMERIC_GENDER_CSV,
      columnMap: SAP_COLUMN_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(2)

      const p1 = people.find((p) => p.externalRef === "00010001")
      const p2 = people.find((p) => p.externalRef === "00010002")
      expect(p1?.gender).toBe("Man")
      expect(p2?.gender).toBe("Kvinna")
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: FAIL. `people` is empty because both rows are skipped (`parsedGender` is null for "1"/"2").

- [ ] **Step 3: Pass allowNumericCodes in the action**

Replace `import.ts:176-179`:

```typescript
      // gender: parse with numeric-code support so SAP/SCB codes 1/2 resolve,
      // matching validateImport (which uses allowNumericCodes). Rows whose gender
      // still cannot resolve carry the unresolvedGender HARD issue and were
      // already dropped by skippedRowIndices; this null guard is defensive.
      const parsedGender = parseGender(cell(genderCol), {
        allowNumericCodes: true,
      })
      if (parsedGender === null) continue
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: PASS. Both people exist with the mapped genders.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts
git commit -m "fix(import): resolve numeric gender codes in the action"
```

---

### Task 3: Date option flags (compact/serial/personnummer)

`parseDate(birthDateRaw)` / `parseDate(employmentStartDateRaw)` are called with **no opts** (import.ts:190,194). Without `headerGated` the compact `YYYYMMDD` and Excel-serial forms silently return null; without `referenceYear` a short personnummer (`YYMMDD-NNNN`) returns null. These columns ARE the mapped date columns, so header-gating is correct. The reference year is `args.payYear ?? new Date().getFullYear()` (the action may read the clock; the engine may not).

**Files:**
- Modify: `packages/backend/convex/people/import.ts` (compute `referenceYear` once near the row loop; pass opts at both `parseDate` call sites, lines 188-195)
- Add fixture: `packages/backend/convex/people/__fixtures__/date-forms.csv`
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes: `parseDate(v: string, opts?: { headerGated?: boolean; referenceYear?: number }): string | null` from `@workspace/import`. Compact `"19870512"` -> `"1987-05-12"`; Excel serial `"44927"` -> `"2023-01-01"`; short personnummer `"870512-1234"` with `referenceYear` 2026 -> `"1987-05-12"`; plain ISO `"1990-11-03"` -> `"1990-11-03"`.
- Produces: no signature change; `birthDate` and `employmentStartDate` now parse the header-gated and reference-year forms.

- [ ] **Step 1: Add the fixture**

Create `packages/backend/convex/people/__fixtures__/date-forms.csv`. One row per date form so each is asserted independently. `Serial` 44927 is 2023-01-01 under the Excel 1899-12-30 epoch (within the engine's 40000-50000 serial window):

```
Id,Fornamn,Kon,Manadslon,Fodelsedatum
E1,Anna,Kvinna,45000,19870512
E2,Bo,Man,45000,44927
E3,Cecilia,Kvinna,45000,870512-1234
E4,David,Man,45000,1990-11-03
```

- [ ] **Step 2: Write the failing test**

```typescript
const DATE_FORMS_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "date-forms.csv"),
  "utf8"
)

const DATE_FORMS_MAP: string[][] = [
  ["Id", "externalRef"],
  ["Fornamn", "firstName"],
  ["Kon", "gender"],
  ["Manadslon", "basicMonthly"],
  ["Fodelsedatum", "birthDate"],
]

describe("importPayroll (date forms)", () => {
  it("parses compact, Excel-serial, short-personnummer, and ISO birth dates", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: DATE_FORMS_CSV,
      columnMap: DATE_FORMS_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const byRef = (ref: string) =>
        people.find((p) => p.externalRef === ref)

      expect(byRef("E1")?.birthDate).toBe("1987-05-12") // compact YYYYMMDD
      expect(byRef("E2")?.birthDate).toBe("2023-01-01") // Excel serial 44927
      expect(byRef("E3")?.birthDate).toBe("1987-05-12") // short personnummer + refYear 2026
      expect(byRef("E4")?.birthDate).toBe("1990-11-03") // plain ISO
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: FAIL. E1/E2/E3 have `birthDate` undefined (`parseDate` returned null without opts); only E4 parses. The assertion on E1 fails first.

- [ ] **Step 4: Compute referenceYear and pass date opts**

Just above the `for (let rowIdx ...)` loop in `import.ts` (after the column indices are computed, before `let peopleImported = 0`), add:

```typescript
    // The engine never reads the clock; the action supplies the reference year
    // for short-personnummer century expansion (explicit payYear arg > now).
    const referenceYear = args.payYear ?? new Date().getFullYear()
```

Replace the `birthDate` / `employmentStartDate` blocks (`import.ts:188-195`):

```typescript
      const birthDateRaw = cell(birthDateCol)
      const birthDate = birthDateRaw
        ? (parseDate(birthDateRaw, { headerGated: true, referenceYear }) ??
          undefined)
        : undefined
      const employmentStartDateRaw = cell(employmentStartDateCol)
      const employmentStartDate = employmentStartDateRaw
        ? (parseDate(employmentStartDateRaw, {
            headerGated: true,
            referenceYear,
          }) ?? undefined)
        : undefined
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: PASS. All four birth dates resolve.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts packages/backend/convex/people/__fixtures__/date-forms.csv
git commit -m "fix(import): header-gate dates and pass the reference year"
```

---

### Task 4: Fraction FTE scaling (0.8 -> 80)

`parsePercent(ftePercentRaw)` is called with **no opts** (import.ts:198), so a fractional column stores `0.8` instead of `80`. Fraction is a COLUMN-level decision: call `classifyColumn` once on the mapped `ftePercent` column's values and, when `.fraction === true`, pass `{ fraction: true }` per cell. This mirrors `validateImport`, which computes `fteIsFraction` the same way (validate.ts:180-181, via `classifyColumn`).

**Files:**
- Modify: `packages/backend/convex/people/import.ts` (add `classifyColumn` to the import; compute `fteIsFraction` once; pass `{ fraction: fteIsFraction }` at the `parsePercent` call, lines 196-199)
- Test: `packages/backend/convex/people/import.test.ts` (the `personec-fraction.csv` fixture from Task 1)

**Interfaces:**
- Consumes: `classifyColumn(values: string[], opts?): { shape; confidence; fillRate; sampleSize; fraction?: boolean }` and `parsePercent(v: string, opts?: { fraction?: boolean }): number | null` from `@workspace/import`. `parsePercent("0,8", { fraction: true })` -> `80`; `parsePercent("1,0", { fraction: true })` -> `100`.
- Produces: no signature change; a fractional `ftePercent` column stores the scaled value (0..100). This changes the stored/audited `ftePercent` (it appears in `nonPiiFields`), which is a correctness improvement, not a GDPR concern.

- [ ] **Step 1: Write the failing test**

```typescript
describe("importPayroll (fraction FTE)", () => {
  it("scales a fractional ftePercent column x100 (0,8 -> 80, 1,0 -> 100)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: PERSONEC_FRACTION_CSV,
      columnMap: PERSONEC_COLUMN_MAP,
      payYear: 2026,
    })

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const ola = people.find((p) => p.externalRef === "N1")
      const kari = people.find((p) => p.externalRef === "N2")
      expect(ola?.ftePercent).toBe(80) // "0,8" scaled x100
      expect(kari?.ftePercent).toBe(100) // "1,0" scaled x100
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: FAIL. `ola.ftePercent` is `0.8` (unscaled), not `80`.

- [ ] **Step 3: Add classifyColumn and compute fteIsFraction once**

Add `classifyColumn` to the `@workspace/import` import (alongside `CANONICAL_FIELDS`). Just above the row loop (near the `referenceYear` line from Task 3), add:

```typescript
    // Fraction is a column-level decision (every non-blank cell <= 1.0). Classify
    // the mapped ftePercent column once, mirroring validateImport, so per-cell
    // parsePercent can scale a fractional column x100 (0.8 -> 80).
    const fteIsFraction =
      ftePercentCol !== undefined &&
      classifyColumn(rows.map((r) => r[ftePercentCol] ?? "")).fraction === true
```

- [ ] **Step 4: Pass { fraction } at the parsePercent call**

Replace `import.ts:196-199`:

```typescript
      const ftePercentRaw = cell(ftePercentCol)
      const ftePercent = ftePercentRaw
        ? (parsePercent(ftePercentRaw, { fraction: fteIsFraction }) ??
          undefined)
        : undefined
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: PASS (`80` and `100`). Confirm the Task 1 fraction test (`skippedRows === 0`) still passes, and a non-fractional FTE file (e.g. the happy-path fixture with `Sysselssättningsgrad` as whole percents) is unaffected because `fteIsFraction` is false there.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts
git commit -m "fix(import): scale fractional FTE columns x100"
```

---

### Task 5: Binary-file guard and file-level warnings

`tokenizeCsv(args.csvText)` (import.ts:80) has no try/catch: a binary spreadsheet throws `ImportFormatError` uncaught, so the action rejects instead of returning a usable `ok:false`. And `normalizedValidation` (import.ts:104-117) drops `fileWarnings` and `fileFormatError`, so the wizard can never surface `noDelimiter`/`mojibake`/`invalidFileFormat`. Fix: route tokenize through the engine's `validateFile` boundary (which catches `ImportFormatError` and threads tokenizer `signals`), and include `fileWarnings` + `fileFormatError` in both the returned validator and `normalizedValidation`.

**Files:**
- Modify: `packages/backend/convex/people/import.ts` — the `importResultValidator` (`validation` object gains two optional fields), the tokenize+validate step (`import.ts:79-101`), and `normalizedValidation` (`import.ts:104-117`).
- Add fixture: `packages/backend/convex/people/__fixtures__/binary.bin`
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes: `validateFile(text: string, mapping: DetectedMapping, opts: ValidateOpts, tokenized?: TokenizeResult): ImportValidation` from `@workspace/import`. On binary input it returns `{ readiness: [], blocking: ["invalidFileFormat"], warnings: [], issues: [], fileFormatError: "invalidFileFormat" }` (no throw). On well-formed CSV it threads `input.signals` so `fileWarnings` (`noDelimiter`/`mojibake`) are populated. Also `tokenizeCsv` (kept: the action still needs `headers`/`rows` for row iteration) and `ImportFormatError`.
- Produces: the `validation` object in the return type gains `fileWarnings?: string[]` and `fileFormatError?: string`, and `normalizedValidation` carries them through. Consumed by Plan E (the wizard reads these to show "export as CSV" and delimiter/mojibake hints). The blocking branch already returns `ok:false` when `blocking.length > 0`, so `invalidFileFormat` (which lands in `blocking`) reuses that branch and persists nothing.

- [ ] **Step 1: Add a binary fixture**

Create a real binary (non-UTF8, no delimiter) fixture. Because the CSV fixtures are read as UTF-8 text, add the binary bytes with a tiny script so the file contains a NUL and high bytes that `tokenizeCsv` rejects:

```bash
printf 'PK\x03\x04\x14\x00\x00\x00\x08\x00\xde\xad\xbe\xef\x00\x00\x00\x00' > packages/backend/convex/people/__fixtures__/binary.bin
```

(`PK\x03\x04` is the ZIP/XLSX magic; the NUL and high bytes make it unmistakably non-CSV, matching what `binary.xlsx` triggers in the engine.)

- [ ] **Step 2: Write the failing test**

The action arg `csvText` is `v.string()`, so read the binary fixture as a Latin-1 string to preserve the raw bytes as a JS string (UTF-8 decoding would mangle them, but `latin1` is byte-for-byte):

```typescript
const BINARY_INPUT = readFileSync(
  join(import.meta.dirname, "__fixtures__", "binary.bin"),
  "latin1"
)

describe("importPayroll (binary / file-level guard)", () => {
  it("returns ok:false with invalidFileFormat instead of throwing on a binary file", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BINARY_INPUT,
      columnMap: FULL_COLUMN_MAP,
      payYear: 2026,
    })

    expect(result.ok).toBe(false)
    expect(result.peopleImported).toBe(0)
    expect(result.validation.blocking).toContain("invalidFileFormat")
    expect(result.validation.fileFormatError).toBe("invalidFileFormat")

    // Nothing persisted.
    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: FAIL. The action throws `ImportFormatError` (uncaught), so the test throws rather than returning `ok:false`, AND `result.validation.fileFormatError` does not exist on the current validator.

- [ ] **Step 4: Widen the return validator**

In `importResultValidator` (`import.ts:28-45`), add the two optional fields to the `validation` object, after `issues`:

```typescript
    issues: v.array(
      v.object({
        row: v.number(),
        code: v.string(),
        detail: v.string(),
      })
    ),
    // File-level signals (Plan C). fileWarnings surfaces delimiter/mojibake
    // hints; fileFormatError marks a binary/unreadable file (also in blocking).
    fileWarnings: v.optional(v.array(v.string())),
    fileFormatError: v.optional(v.string()),
```

- [ ] **Step 5: Route tokenize through the engine's validateFile boundary**

Add `validateFile` and `ImportFormatError` to the `@workspace/import` import (keep `tokenizeCsv` and `validateImport`; the row loop still needs `headers`/`rows`, and the happy path can reuse the already-tokenized result).

Replace `import.ts:79-101` (the tokenize + validate step). The DetectedMapping build needs `headers`, so tokenize first inside a try/catch, then hand the tokenized result to `validateFile` so it threads signals and does not re-tokenize:

```typescript
    // Step 2: Tokenize + validate. A binary/unreadable file makes tokenizeCsv
    // throw ImportFormatError; catch it and return the invalidFileFormat blocking
    // signal (ok:false, nothing persisted) instead of letting the action reject.
    let tokenized: ReturnType<typeof tokenizeCsv>
    try {
      tokenized = tokenizeCsv(args.csvText)
    } catch (err) {
      if (err instanceof ImportFormatError) {
        const fileFormatValidation = {
          readiness: [],
          blocking: ["invalidFileFormat"],
          warnings: [],
          issues: [],
          fileFormatError: "invalidFileFormat",
        }
        return {
          ok: false,
          peopleImported: 0,
          salariesImported: 0,
          skippedRows: 0,
          validation: fileFormatValidation,
        }
      }
      throw err
    }
    const { headers, rows } = tokenized

    // Build a DetectedMapping from the wizard-confirmed columnMap.
    // columnMap is an array of [sourceHeader, canonicalFieldKey] pairs.
    // Invert to { canonicalFieldKey -> { columnIndex, confidence } }.
    const detectedMap: DetectedMapping["map"] = {}
    for (const pair of args.columnMap) {
      const sourceHeader = pair[0]
      const canonicalKey = pair[1]
      if (sourceHeader === undefined || canonicalKey === undefined) continue
      const colIdx = headers.indexOf(sourceHeader)
      if (colIdx === -1) continue
      const isKnown = CANONICAL_FIELDS.some((f) => f.key === canonicalKey)
      if (!isKnown) continue
      detectedMap[canonicalKey as keyof DetectedMapping["map"]] = {
        columnIndex: colIdx,
        confidence: 1,
      }
    }
    const detected: DetectedMapping = { map: detectedMap, unmappedColumns: [] }

    // Reuse the already-tokenized result so validateFile threads the tokenizer
    // signals (noDelimiter, raggedRows) without re-parsing, and populates
    // fileWarnings (noDelimiter/mojibake).
    const validation = validateFile(args.csvText, detected, {}, tokenized)
```

- [ ] **Step 6: Carry fileWarnings + fileFormatError through normalizedValidation**

Replace the `normalizedValidation` block (`import.ts:104-117`) so the file-level fields pass through:

```typescript
    // Normalize validation for return (plain arrays, typed strings). File-level
    // signals (fileWarnings, fileFormatError) are threaded so the wizard can
    // surface delimiter/mojibake hints and the invalid-file-format state.
    const normalizedValidation = {
      readiness: validation.readiness.map((r) => ({
        key: r.key,
        tier: r.tier,
        mapped: r.mapped,
      })),
      blocking: [...validation.blocking],
      warnings: [...validation.warnings],
      issues: validation.issues.map((i) => ({
        row: i.row,
        code: i.code,
        detail: i.detail,
      })),
      ...(validation.fileWarnings !== undefined
        ? { fileWarnings: [...validation.fileWarnings] }
        : {}),
      ...(validation.fileFormatError !== undefined
        ? { fileFormatError: validation.fileFormatError }
        : {}),
    }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: PASS. The binary file returns `ok:false` with `blocking` containing `"invalidFileFormat"` and `fileFormatError === "invalidFileFormat"`; nothing is persisted (the existing `if (validation.blocking.length > 0)` branch handles it). The happy-path test still returns `ok:true` with unchanged counts.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts packages/backend/convex/people/__fixtures__/binary.bin
git commit -m "fix(import): guard binary files and surface file-level warnings"
```

---

### Task 6: genderOverrides arg for unresolved-gender rows

A row whose gender cannot be parsed (blank cell, unrecognized token) carries the `unresolvedGender` HARD issue and is skipped, because `upsertPersonByExternalRef` requires `v.union(Man, Kvinna)`. The wizard collects a manual Man/Kvinna assignment for exactly those rows (see validate.ts:256). Add a `genderOverrides` arg: an array of `[externalRef, "Man" | "Kvinna"]` pairs (mirroring `columnMap`'s array-of-pairs shape, so it survives Convex serialization the same way). When a row's parsed gender is null but its `externalRef` has an override, use the override so the person imports. Overrides must be exactly "Man" or "Kvinna"; an invalid override value is ignored (leaving the row unresolved). A row still null after overrides stays skipped.

**Files:**
- Modify: `packages/backend/convex/people/import.ts` — add the `genderOverrides` arg; build a lookup map; resolve the effective gender before the null guard.
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes: the effective-gender resolution runs before the `if (parsedGender === null) continue` guard from Task 2. `upsertPersonByExternalRef` still receives `gender: "Man" | "Kvinna"`.
- Produces: the FINAL `importPayroll` args signature (consumed by Plan E):

```typescript
args: {
  orgId: v.string(),
  csvText: v.string(),
  columnMap: v.array(v.array(v.string())),
  payYear: v.optional(v.number()),
  effectiveAt: v.optional(v.number()),
  genderOverrides: v.optional(v.array(v.array(v.string()))),
}
```

Each `genderOverrides` entry is `[externalRef, "Man" | "Kvinna"]` (a two-element string pair). Only "Man" and "Kvinna" are honored; any other second value is ignored.

- [ ] **Step 1: Add a fixture with a blank-gender row**

Create `packages/backend/convex/people/__fixtures__/blank-gender.csv`. Row G1 has a resolvable gender; row G2 has a blank gender cell (the wizard would collect an override for G2):

```
Id,Fornamn,Kon,Manadslon
G1,Erik,Man,45000
G2,Frida,,47000
```

- [ ] **Step 2: Write the failing tests (override applied, and skipped without it)**

```typescript
const BLANK_GENDER_CSV = readFileSync(
  join(import.meta.dirname, "__fixtures__", "blank-gender.csv"),
  "utf8"
)

const BLANK_GENDER_MAP: string[][] = [
  ["Id", "externalRef"],
  ["Fornamn", "firstName"],
  ["Kon", "gender"],
  ["Manadslon", "basicMonthly"],
]

describe("importPayroll (gender overrides)", () => {
  it("imports a blank-gender row when a matching override is supplied", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BLANK_GENDER_CSV,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      genderOverrides: [["G2", "Kvinna"]],
    })

    expect(result.ok).toBe(true)
    expect(result.peopleImported).toBe(2)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const frida = people.find((p) => p.externalRef === "G2")
      expect(frida?.gender).toBe("Kvinna")
    })
  })

  it("skips the blank-gender row when no override is supplied", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: BLANK_GENDER_CSV,
      columnMap: BLANK_GENDER_MAP,
      payYear: 2026,
      // no genderOverrides
    })

    expect(result.ok).toBe(true)
    // G2 has unresolvedGender (HARD) so it is skipped; only G1 imports.
    expect(result.peopleImported).toBe(1)
    expect(result.skippedRows).toBe(1)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(people.map((p) => p.externalRef)).not.toContain("G2")
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: the "no override" test PASSES already (G2 is a `unresolvedGender` HARD skip after Task 1). The "with override" test FAILS: `genderOverrides` is not an accepted arg, so convex-test rejects the call (validator error). This is the failing test that drives the change.

- [ ] **Step 4: Add the genderOverrides arg**

Add to the `args` block (`import.ts:67-73`), after `effectiveAt`:

```typescript
    // Manual Man/Kvinna assignments for rows the parser could not resolve.
    // Each entry is [externalRef, "Man"|"Kvinna"], mirroring columnMap's
    // array-of-pairs shape (Convex-serializable without non-ASCII record keys).
    genderOverrides: v.optional(v.array(v.array(v.string()))),
```

- [ ] **Step 5: Build the override lookup and apply it before the null guard**

Just above the row loop (near `referenceYear`), build the lookup, honoring only valid values:

```typescript
    // externalRef -> overridden gender. Only exact "Man"/"Kvinna" values are
    // honored; any other value is ignored (the row stays unresolved).
    const genderOverrideByRef = new Map<string, "Man" | "Kvinna">()
    for (const pair of args.genderOverrides ?? []) {
      const ref = pair[0]
      const value = pair[1]
      if (ref === undefined) continue
      if (value === "Man" || value === "Kvinna") {
        genderOverrideByRef.set(ref, value)
      }
    }
```

Replace the gender block from Task 2 (`parseGender` + null guard) so the override applies when the parse fails. Note `externalRef` is already read just above this block:

```typescript
      // gender: parse (numeric codes allowed, matching validateImport). When the
      // parse fails, fall back to the wizard's manual override for this
      // externalRef. A row still null after the override carries unresolvedGender
      // (HARD) and was already dropped by skippedRowIndices; the guard is defensive.
      const parsedGender =
        parseGender(cell(genderCol), { allowNumericCodes: true }) ??
        genderOverrideByRef.get(externalRef) ??
        null
      if (parsedGender === null) continue
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/backend && bun run test -- import.test.ts`
Expected: BOTH tests PASS. With `[["G2","Kvinna"]]`, `peopleImported === 2` and Frida's gender is "Kvinna"; without it, `peopleImported === 1` and `skippedRows === 1`.

Note on the skip count with an override: G2 still appears in `validation.issues` as `unresolvedGender` (validate runs before overrides), so `skippedRowIndices` includes G2's row index, and the loop's `if (skippedRowIndices.has(rowIdx)) continue` would drop it before the override can apply. Confirm the "with override" test reaches `peopleImported === 2`. If it does not (G2 is skipped by index), also subtract override-satisfied rows from `skippedRowIndices` before the loop:

```typescript
    // Rows whose only blocker is unresolvedGender AND which have a valid override
    // must NOT be pre-skipped; the override supplies the gender in the loop.
    if (externalRefCol !== undefined) {
      for (const issue of validation.issues) {
        if (issue.code !== "unresolvedGender") continue
        const ref = (rows[issue.row]?.[externalRefCol] ?? "").trim()
        const otherHardIssue = validation.issues.some(
          (o) =>
            o.row === issue.row &&
            o.code !== "unresolvedGender" &&
            HARD_SKIP_CODES.has(o.code as RowIssueCode)
        )
        if (!otherHardIssue && genderOverrideByRef.has(ref)) {
          skippedRowIndices.delete(issue.row)
        }
      }
    }
```

Place this block immediately after `skippedRowIndices` is constructed and after `genderOverrideByRef` is built (move the `genderOverrideByRef` build above `skippedRowIndices` if needed so both exist here). Re-run the tests; both must pass, and the `skippedRows` count in the override case must reflect that G2 is no longer skipped (for this two-row fixture, `skippedRows === 0` with the override).

- [ ] **Step 7: Update the action doc comment**

Update the header comment block (`import.ts:48-65`) to document `genderOverrides` alongside the other args:

```typescript
//   genderOverrides - Optional [externalRef, "Man"|"Kvinna"] pairs supplying a
//               manual gender for rows the parser could not resolve, so those
//               rows import instead of being skipped as unresolvedGender.
```

- [ ] **Step 8: Run the full backend suite**

Run: `cd packages/backend && bun run test`
Expected: the whole `people` suite is green, including the happy-path and blocking tests, which are unchanged in behavior.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts packages/backend/convex/people/__fixtures__/blank-gender.csv
git commit -m "feat(import): accept manual gender overrides for unresolved rows"
```

---

## Self-Review

**1. Spec coverage.** All six required tasks are present and each maps to a task: (1) HARD_SKIP triage -> Task 1; (2) numeric gender -> Task 2; (3) date opts headerGated+referenceYear -> Task 3; (4) fraction FTE via classifyColumn -> Task 4; (5) validateFile/ImportFormatError guard + fileWarnings/fileFormatError -> Task 5; (6) genderOverrides arg -> Task 6. The global-constraints header carries the verbatim org-scoped/admin-gated, deterministic/no-AI, PII/EU, audit, testing, English/no-em-dash, and conventional-commit rules. The requested return (final `importPayroll` signature) is stated in Task 6's Interfaces block.

**2. Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N" placeholders. Every code step shows real code; every run step shows the command (`cd packages/backend && bun run test -- import.test.ts`) and the expected result. Fixtures are given as literal file contents.

**3. Type/signature consistency.**
- `HARD_SKIP_CODES: ReadonlySet<RowIssueCode>` (Task 1) is referenced with `HARD_SKIP_CODES.has(i.code as RowIssueCode)` in Tasks 1 and 6 (identical name and cast).
- `parseGender(cell(genderCol), { allowNumericCodes: true })` is written identically in Task 2 and reused (with the override fallback) in Task 6.
- `parseDate(raw, { headerGated: true, referenceYear })` (Task 3) and `referenceYear = args.payYear ?? new Date().getFullYear()` are defined once and reused.
- `classifyColumn(rows.map((r) => r[ftePercentCol] ?? "")).fraction === true` (Task 4) matches the engine signature verified in `shape.ts`, and `parsePercent(raw, { fraction: fteIsFraction })` matches `parse.ts`.
- `validateFile(args.csvText, detected, {}, tokenized)` (Task 5) matches the `validateFile(text, mapping, opts, tokenized?)` signature in `validate.ts`; the returned `fileWarnings`/`fileFormatError` names match `ImportValidation`.
- `genderOverrides: v.optional(v.array(v.array(v.string())))` (Task 6) matches `columnMap`'s array-of-pairs validator shape, and the final signature block lists all six args.

**Cross-task ordering note (fixed inline):** Task 6's pre-skip subtraction requires both `skippedRowIndices` (Task 1) and `genderOverrideByRef` (Task 6) to exist at that point; Step 6 instructs moving the `genderOverrideByRef` build above `skippedRowIndices` if needed. The one behavioral subtlety (validate flags `unresolvedGender` before overrides apply, so an overridden row would otherwise be pre-skipped by index) is called out in Task 6 Step 6 with the corrective block, so the "imports 2 with override" assertion is achievable.

No further issues found.
