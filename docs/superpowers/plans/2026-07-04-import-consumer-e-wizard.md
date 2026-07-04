# Import wizard UX improvements (Plan E) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three UX upgrades to the salary-import wizard now that the engine (Plans A/B/C) and the backend correctness plan (Plan D) are in place: a column-first mapping table, a rendered file-warnings section, a per-row assign-gender control that feeds `genderOverrides` into `importPayroll`, and a fractional-FTE preview fix.

**Architecture:** All changes live in `apps/dashboard/components/people/import/*` and the `packages/i18n/messages/*.json` files. No engine or backend code changes here (the engine helpers `detectColumns`, `validateImport`, `classifyColumn`, `parsePercent` and the Plan D `importPayroll` arg already exist). The wizard keeps its existing `mapping: Record<canonicalKey, columnIndex>` state; Task 1 only inverts how the map table renders and writes it. Task 3 adds one new wizard-state field (`genderOverrides`) threaded UploadStep-independent from CheckStep down to ReviewStep. Every task is TDD with @testing-library/react + `NextIntlClientProvider`.

**Tech Stack:** Next.js 16 client components, next-intl (`@workspace/i18n`), `@workspace/import` (pure engine), shadcn `Select`/`Table`/`Alert`/`RadioGroup`/`Button`, Convex `useAction`, Vitest 4 + @testing-library/react.

## Global Constraints

- ALL user-facing text via i18n (all 5 locales en/sv/nb/da/fi; Nordic drafts flagged for native review), no hardcoded strings. English is the source (`packages/i18n/messages/en.json`); mirror every new key into `sv.json`, `nb.json`, `da.json`, `fi.json` in the same commit (the parity test fails otherwise).
- Forms/controls follow shadcn conventions (use design-system components with default variants/sizes/tokens; deviate only with a call-site comment).
- Minimize layout shift: reveal controls with opacity/overlays in pre-reserved fixed-size slots; never insert/remove inline elements that resize neighbors.
- Internal navigation via `Link`/router, never plain `<a>`.
- New code ships with tests in the same commit.
- Tests run with Vitest 4 via `bun run test` (from repo root, cache-backed) or `bunx vitest run <path>` from `apps/dashboard`; NEVER `bun test`.
- English identifiers in code; no em dashes anywhere (UI copy, comments, commits).
- Conventional-commit messages (`feat:`, `fix:`, `refactor:`, ...). No AI attribution. Work on `main`; do NOT push. Leave the work uncommitted for review only if asked; otherwise the final step of each task commits.

## DEPENDENCY: Plan D must be merged first

Task 3 and Task 4 assume Plan D (`packages/backend/convex/people/import.ts`) is already merged:
- `importPayroll` accepts a new optional arg `genderOverrides?: Array<[externalRef: string, "Man" | "Kvinna"]>` (Convex validator `v.optional(v.array(v.array(v.string())))`, same array-of-pairs encoding as `columnMap`). Plan E's ReviewStep passes it.
- Plan D also lands the backend fraction/date fixes so the preview and the persisted values agree.

If Plan D is not yet merged, Task 3's ReviewStep test that asserts the `genderOverrides` arg still passes (it asserts on the mocked `useAction`, not the real backend), but the real import will silently ignore the extra arg. Do not merge Plan E to a branch where Plan D is absent.

## The `genderOverrides` wire shape (used by Task 3)

The wizard collects gender assignments as an ergonomic `Record<externalRef, "Man" | "Kvinna">` in wizard state (dedup by ref, last-wins per ref). At the `importPayroll` call site in ReviewStep it is converted to the Convex array-of-pairs Plan D expects:

```ts
// exact shape passed to importPayroll:
genderOverrides: Object.entries(genderOverrides) as Array<[string, "Man" | "Kvinna"]>
// e.g. [["E001", "Kvinna"], ["E014", "Man"]]
```

When the record is empty the key is omitted from the call payload (spread guard), so a clean import sends no `genderOverrides` arg at all.

---

### Task 1: Column-first map redesign (`map-step.tsx`)

Invert the mapping table so each row is a CSV **column** (one per `parsed.headers` entry) instead of a canonical field. Each column row shows: the source header, 3-5 sample values, the detected canonical field + confidence, and a `Select` to override to any canonical field or "Ignore". The underlying wizard `mapping` state stays `Record<canonicalKey, columnIndex>`; the column-first Select writes it (mapping a column to field X sets `mapping[X] = thatColumnIndex`; "Ignore" removes any field currently pointing at this column). Two columns cannot map to the same field: selecting a field already owned by another column is last-wins (the previous owner column is freed). Still-missing required fields stay surfaced via the existing warning.

**Files:**
- Modify: `apps/dashboard/components/people/import/map-step.tsx` (full re-render of the table body; keep `buildInitialMapping` and `updateMapping` exports unchanged, add `columnToField` + `assignColumnToField` helpers)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `dashboard.people.import.map.{columnHeading,samples,detectedAs,ignore}`; keep existing map keys)
- Test: `apps/dashboard/components/people/import/map-step.test.tsx` (rework the "table rendering" and "Select interaction" describes to column-first; keep `buildInitialMapping`/`updateMapping` pure-helper describes as-is)

**Interfaces:**
- Consumes (unchanged): `detectColumns({ headers, rows })` from `@workspace/import` returns `{ map: Partial<Record<CanonicalFieldKey, { columnIndex, confidence }>>, unmappedColumns: number[] }`; `CANONICAL_FIELDS: readonly FieldDef[]` where `FieldDef = { key, tier, shape, synonyms }`; `buildInitialMapping(parsed): Record<string, number>`; `updateMapping(prev, fieldKey, columnIndex): Record<string, number>` (removes the key when `columnIndex === -1`).
- Produces: `MapStep` still calls `onMappingChange(mapping: Record<string, number>)`. New exported pure helpers:
  - `columnToField(mapping: Record<string, number>, columnIndex: number): CanonicalFieldKey | null` — the canonical field currently pointing at this column, or null.
  - `assignColumnToField(prev: Record<string, number>, columnIndex: number, fieldKey: CanonicalFieldKey | null): Record<string, number>` — set `fieldKey` to point at `columnIndex` (freeing any other field or column that collides); `fieldKey === null` means "Ignore": remove whatever field currently points at `columnIndex`.

- [ ] **Step 1: Write the failing pure-helper tests** (append to `map-step.test.tsx`)

```tsx
import { assignColumnToField, columnToField } from "./map-step"

describe("columnToField", () => {
  it("returns the field whose mapping points at the column", () => {
    const mapping = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    expect(columnToField(mapping, 2)).toBe("gender")
    expect(columnToField(mapping, 0)).toBe("externalRef")
  })

  it("returns null for a column no field points at", () => {
    const mapping = { externalRef: 0 }
    expect(columnToField(mapping, 4)).toBeNull()
  })
})

describe("assignColumnToField", () => {
  it("points the field at the column", () => {
    const next = assignColumnToField({}, 3, "basicMonthly")
    expect(next.basicMonthly).toBe(3)
  })

  it("last-wins: reassigning a field to a new column frees the old column", () => {
    // gender already points at col 2; move gender to col 5.
    const next = assignColumnToField({ gender: 2 }, 5, "gender")
    expect(next.gender).toBe(5)
  })

  it("prevents two columns mapping to the same field (the previous column loses it)", () => {
    // title owns col 1; assign col 4 to title -> col 1 is freed, only col 4 keeps title.
    const next = assignColumnToField({ title: 1 }, 4, "title")
    expect(next.title).toBe(4)
    expect(columnToField(next, 1)).toBeNull()
  })

  it("frees any field previously on the target column before assigning", () => {
    // col 3 currently held by basicMonthly; assign col 3 to variable.
    const next = assignColumnToField({ basicMonthly: 3 }, 3, "variable")
    expect(next.variable).toBe(3)
    expect("basicMonthly" in next).toBe(false)
  })

  it("Ignore (null) removes whatever field points at the column", () => {
    const next = assignColumnToField({ gender: 2, title: 1 }, 2, null)
    expect("gender" in next).toBe(false)
    expect(next.title).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run apps/dashboard/components/people/import/map-step.test.tsx -t "columnToField|assignColumnToField"`
Expected: FAIL — `columnToField`/`assignColumnToField` are not exported from `./map-step`.

- [ ] **Step 3: Implement the two pure helpers** (add to `map-step.tsx`, below `updateMapping`)

```tsx
/**
 * The canonical field currently pointing at this column, or null.
 * The wizard mapping is field -> columnIndex; this inverts a single lookup.
 */
export function columnToField(
  mapping: Record<string, number>,
  columnIndex: number
): CanonicalFieldKey | null {
  for (const [key, idx] of Object.entries(mapping)) {
    if (idx === columnIndex) return key as CanonicalFieldKey
  }
  return null
}

/**
 * Assign a column to a canonical field (column-first). Enforces the two
 * invariants of the flat mapping:
 *   - one field -> one column (reassigning a field frees its old column), and
 *   - one column -> one field (assigning a column frees the field already on it).
 * fieldKey === null means "Ignore": drop whatever field points at this column.
 */
export function assignColumnToField(
  prev: Record<string, number>,
  columnIndex: number,
  fieldKey: CanonicalFieldKey | null
): Record<string, number> {
  const next = { ...prev }
  // Free the field currently on this column (column -> one field).
  const existing = columnToField(next, columnIndex)
  if (existing !== null) delete next[existing]
  if (fieldKey === null) return next
  // Free the target field's old column (field -> one column), then assign.
  delete next[fieldKey]
  next[fieldKey] = columnIndex
  return next
}
```

- [ ] **Step 4: Run the pure-helper tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/map-step.test.tsx -t "columnToField|assignColumnToField"`
Expected: PASS.

- [ ] **Step 5: Write the failing column-first render tests**

Replace the `MapStep — table rendering` describe block in `map-step.test.tsx` with column-first assertions (keep `buildInitialMapping`, `updateMapping`, and the unmapped-required-count describes unchanged):

```tsx
describe("MapStep — column-first rendering", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders one row per CSV column (by header)", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // TEST_HEADERS has 5 columns; each is a column row keyed by index.
    for (let i = 0; i < TEST_HEADERS.length; i++) {
      expect(screen.getByTestId(`map-column-${i}`)).toBeDefined()
    }
    // The source header text appears in its row.
    expect(screen.getByTestId("map-column-0").textContent).toContain(
      "EmployeeID"
    )
    expect(screen.getByTestId("map-column-4").textContent).toContain(
      "Department"
    )
  })

  it("shows up to 5 sample values from the column's cells", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Column 1 (JobTitle) sample values from the two data rows.
    const col1 = screen.getByTestId("map-column-1")
    expect(col1.textContent).toContain("Software Engineer")
    expect(col1.textContent).toContain("Product Manager")
  })

  it("shows the seeded detected canonical field per column", () => {
    renderMapStep({ mapping: null })
    // detectColumns maps col 2 (Gender) -> gender; the detected field label shows.
    const col2 = screen.getByTestId("map-column-2")
    expect(col2.textContent).toContain(m.fields.gender)
  })

  it("changing a column's Select updates the mapping via onMappingChange", () => {
    const onMappingChange = vi.fn()
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
      onMappingChange,
    })
    // Move column 4 (Department) to the "department" canonical field.
    // The Select's native <select> is queried via its accessible name (the header).
    fireEvent.click(screen.getByTestId("map-column-4-trigger"))
    fireEvent.click(screen.getByTestId("map-column-4-option-department"))
    expect(onMappingChange).toHaveBeenCalled()
    const last = onMappingChange.mock.calls.at(-1)?.[0] as Record<string, number>
    expect(last.department).toBe(4)
  })

  it("Ignore unmaps the column (removes its field)", () => {
    const onMappingChange = vi.fn()
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
      onMappingChange,
    })
    fireEvent.click(screen.getByTestId("map-column-2-trigger"))
    fireEvent.click(screen.getByTestId("map-column-2-option-ignore"))
    const last = onMappingChange.mock.calls.at(-1)?.[0] as Record<string, number>
    expect("gender" in last).toBe(false)
  })

  it("still surfaces missing required fields", () => {
    renderMapStep({ mapping: { externalRef: 0 } }) // 3 required missing
    const warning = screen.getByTestId("unmapped-required-warning")
    expect(warning.textContent).toContain("3")
  })
})
```

Add `fireEvent` to the top import: `import { cleanup, fireEvent, render, screen } from "@testing-library/react"`.

- [ ] **Step 6: Run the render tests to verify they fail**

Run: `bunx vitest run apps/dashboard/components/people/import/map-step.test.tsx -t "column-first"`
Expected: FAIL — no `map-column-*` testids exist (the component still renders field-first `map-row-*`).

- [ ] **Step 7: Rewrite `MapStep`'s table body to column-first**

Replace the component body's return (the `<div className="flex w-full flex-col gap-4">...` block) in `map-step.tsx`. Keep the auto-seed `useEffect`, `activeMapping`, and `unmappedRequiredCount` exactly as they are. Add a `detectedByColumn` map and a `Select` that lists every canonical field plus an Ignore option. The Select uses shadcn defaults (`size="sm"`). Sample values are the first up-to-5 cells of the column. The detected field + confidence come from `detectColumns` inverted by column index.

```tsx
  // Detected field + confidence per COLUMN index (inverted from detectColumns).
  const detectedByColumn: Map<number, { key: CanonicalFieldKey; confidence: number }> =
    (() => {
      const { map } = detectColumns({
        headers: parsed.headers,
        rows: parsed.rows,
      })
      const out = new Map<number, { key: CanonicalFieldKey; confidence: number }>()
      for (const [key, entry] of Object.entries(map)) {
        if (entry !== undefined) {
          out.set(entry.columnIndex, {
            key: key as CanonicalFieldKey,
            confidence: entry.confidence,
          })
        }
      }
      return out
    })()

  const SAMPLE_COUNT = 5

  function columnSamples(columnIndex: number): string[] {
    const out: string[] = []
    for (const row of parsed.rows.slice(0, SAMPLE_COUNT)) {
      const cell = (row[columnIndex] ?? "").trim()
      if (cell !== "") out.push(cell)
    }
    return out
  }

  // Value shown in the column's Select: the field currently on it, or Ignore.
  function columnSelectValue(columnIndex: number): string {
    return columnToField(activeMapping, columnIndex) ?? IGNORE_VALUE
  }

  function handleColumnSelect(columnIndex: number, value: string) {
    const fieldKey = value === IGNORE_VALUE ? null : (value as CanonicalFieldKey)
    onMappingChange(assignColumnToField(activeMapping, columnIndex, fieldKey))
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-muted-foreground text-sm">{tMap("description")}</p>

      {unmappedRequiredCount > 0 && (
        <p
          data-testid="unmapped-required-warning"
          role="alert"
          className="font-medium text-destructive text-sm"
        >
          {tMap("unmappedRequired", { count: unmappedRequiredCount })}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tMap("columnHeading")}</TableHead>
              <TableHead>{tMap("samples")}</TableHead>
              <TableHead>{tMap("detectedAs")}</TableHead>
              <TableHead>{tMap("field")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.headers.map((header, columnIndex) => {
              const detected = detectedByColumn.get(columnIndex)
              const samples = columnSamples(columnIndex)
              const displayHeader =
                header.trim() === "" ? tMap("notMapped") : header
              return (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: column index IS the identity here
                  key={columnIndex}
                  data-testid={`map-column-${columnIndex}`}
                >
                  <TableCell>
                    <span className="font-medium text-sm">{displayHeader}</span>
                  </TableCell>
                  <TableCell>
                    {/* Fixed-height sample slot to avoid reflow when values differ. */}
                    <div className="flex min-h-8 flex-wrap items-center gap-1">
                      {samples.map((value, s) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: sample position is stable within a static column
                          key={s}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {detected ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">
                          {tFields(
                            detected.key as Parameters<typeof tFields>[0]
                          )}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {`${Math.round(detected.confidence * 100)}%`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {tMap("notMapped")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={columnSelectValue(columnIndex)}
                      onValueChange={(value) =>
                        handleColumnSelect(columnIndex, value)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="min-w-[180px]"
                        aria-label={displayHeader}
                        data-testid={`map-column-${columnIndex}-trigger`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value={IGNORE_VALUE}
                          data-testid={`map-column-${columnIndex}-option-ignore`}
                        >
                          {tMap("ignore")}
                        </SelectItem>
                        {CANONICAL_FIELDS.map((field) => (
                          <SelectItem
                            key={field.key}
                            value={field.key}
                            data-testid={`map-column-${columnIndex}-option-${field.key}`}
                          >
                            {`${tFields(field.key as Parameters<typeof tFields>[0])} (${tTier(field.tier)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
```

Add the Ignore sentinel constant near `NOT_MAPPED_VALUE` (which stays for the pure `updateMapping` helper's -1 contract) and remove the now-unused `tierBadgeVariant`, `confidenceMap`, `selectValue`, `sampleValue`, `confidencePercent`, and `handleSelectChange` field-first helpers:

```tsx
// Sentinel Select value meaning "do not import this column".
const IGNORE_VALUE = "__ignore__"
```

Note: `columnToField`/`assignColumnToField` (added in Step 3) and `CANONICAL_FIELDS`/`detectColumns` (already imported) are all in scope. `tTier` is still imported for the Select option labels; `Badge` and `tierBadgeVariant` are no longer used, so drop the `Badge` import and the `tierBadgeVariant` function.

- [ ] **Step 8: Run the render tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/map-step.test.tsx -t "column-first"`
Expected: PASS. If a Radix `Select` interaction test cannot open the listbox in jsdom, drive the change through the pure helper instead: assert `assignColumnToField(mapping, 4, "department").department === 4` (already covered by Step 1) and keep the render test to the header/sample/detected assertions plus a click on the visible trigger; do not add a real pointer-event polyfill.

- [ ] **Step 9: Add the four new i18n keys to all 5 locales**

In `packages/i18n/messages/en.json` under `dashboard.people.import.map`, add (keep existing keys):

```json
"columnHeading": "CSV column",
"samples": "Sample values",
"detectedAs": "Detected as",
"ignore": "Ignore this column"
```

Mirror into `sv.json`, `nb.json`, `da.json`, `fi.json` (Nordic = drafts, flag for native review):
- sv: `"columnHeading": "CSV-kolumn"`, `"samples": "Exempelvärden"`, `"detectedAs": "Identifierad som"`, `"ignore": "Ignorera kolumnen"`
- nb (draft): `"columnHeading": "CSV-kolonne"`, `"samples": "Eksempelverdier"`, `"detectedAs": "Gjenkjent som"`, `"ignore": "Ignorer kolonnen"`
- da (draft): `"columnHeading": "CSV-kolonne"`, `"samples": "Eksempelværdier"`, `"detectedAs": "Genkendt som"`, `"ignore": "Ignorer kolonnen"`
- fi (draft): `"columnHeading": "CSV-sarake"`, `"samples": "Esimerkkiarvot"`, `"detectedAs": "Tunnistettu muodoksi"`, `"ignore": "Ohita sarake"`

Do NOT edit the JSON with shell `perl`/`sed` (double-encodes non-ASCII, per the i18n non-ASCII memory). Edit the files directly.

- [ ] **Step 10: Run the i18n parity test and the full map-step suite**

Run: `bunx vitest run packages/i18n` then `bunx vitest run apps/dashboard/components/people/import/map-step.test.tsx`
Expected: PASS (parity: no locale's key set differs from `en`; map-step: all describes green). Grep for mojibake in the touched locale lines: `grep -nE 'Ã|Â' packages/i18n/messages/{sv,nb,da,fi}.json` should print nothing new for the added keys.

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/components/people/import/map-step.tsx apps/dashboard/components/people/import/map-step.test.tsx packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "refactor(import): make the map step column-first"
```

---

### Task 2: Render file warnings (`check-step.tsx`)

Thread the tokenizer's `signals` into `validateImport` (CheckStep currently calls it with `{}` and no signals, so `noDelimiter`/`raggedRow` cannot reach it). Re-tokenize the `csvText` inside CheckStep to obtain `signals`, pass them as the 4th arg, and render a new file-warnings section (between the warnings section and the data-quality issues section) driven by `validation.fileWarnings` via the existing `tCheck(`fileWarning.${code}`)` keys, under a new `check.fileWarnings` section heading.

**Files:**
- Modify: `apps/dashboard/components/people/import/check-step.tsx` (accept a new `csvText` prop, tokenize it for `signals`, thread signals into `validateImport`, add the file-warnings section)
- Modify: `apps/dashboard/components/people/import/import-wizard.tsx:178-190` (pass `csvText={state.csvText}` to `<CheckStep>`; it is already in wizard state and non-null when the check step renders)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `dashboard.people.import.check.fileWarnings` section heading; `check.fileWarning.{mojibake,noDelimiter}` already exist)
- Test: `apps/dashboard/components/people/import/check-step.test.tsx` (add a file-warnings describe; update `renderCheckStep` to pass `csvText`)

**Interfaces:**
- Consumes: `tokenizeCsv(text): { headers, rows, signals: TokenizeSignals }` where `TokenizeSignals` includes `noDelimiter: boolean` and `raggedRows: number[]`; `validateImport(input, mapping, opts, signals?: Partial<TokenizeSignals>): ImportValidation` where `ImportValidation.fileWarnings?: ("noDelimiter" | "mojibake")[]`. `validateImport` already emits `mojibake` from headers regardless of signals; it emits `noDelimiter` only when `signals.noDelimiter === true`, and `raggedRow` row-issues only from `signals.raggedRows`.
- Produces: `CheckStepProps` gains `csvText: string`. `onValidated(isBlocking, issueCount)` semantics unchanged (raggedRow issues now flow into `issueCount`).

- [ ] **Step 1: Write the failing file-warnings tests** (add to `check-step.test.tsx`)

First update the render helper to supply `csvText` (default derived from the fixture) and thread it:

```tsx
function renderCheckStep({
  parsed = FULL_PARSED,
  mapping = FULL_MAPPING,
  csvText,
  onValidated = vi.fn(),
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number>
  csvText?: string
  onValidated?: (isBlocking: boolean, issueCount: number) => void
} = {}) {
  const text =
    csvText ??
    `${parsed.headers.join(",")}\n${parsed.rows.map((r) => r.join(",")).join("\n")}`
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckStep
        parsed={parsed}
        mapping={mapping}
        csvText={text}
        onValidated={onValidated}
      />
    </NextIntlClientProvider>
  )
}
```

Then the new describe:

```tsx
describe("CheckStep — file warnings", () => {
  afterEach(() => {
    cleanup()
  })

  it("surfaces the no-delimiter file warning for single-column input", () => {
    // A one-column file (no commas) tokenizes with signals.noDelimiter === true.
    const singleCol: ParsedCsv = {
      headers: ["EmployeeID;JobTitle;Gender;MonthlySalary"],
      rows: [["E001;Engineer;Kvinna;55000"]],
    }
    renderCheckStep({
      parsed: singleCol,
      mapping: { externalRef: 0 },
      csvText: "EmployeeID;JobTitle;Gender;MonthlySalary\nE001;Engineer;Kvinna;55000",
    })
    const section = screen.getByTestId("file-warnings-section")
    expect(section.textContent).toContain(m.check.fileWarning.noDelimiter)
  })

  it("surfaces the mojibake file warning when 2+ headers are double-encoded", () => {
    // Two headers carry double-encoded UTF-8 sequences (Ã¥, Ã¶).
    const garbled: ParsedCsv = {
      headers: ["Anstnr", "MÃ¥nadslÃ¶n", "KÃ¶n", "Titel"],
      rows: [["E001", "55000", "Kvinna", "Engineer"]],
    }
    renderCheckStep({
      parsed: garbled,
      mapping: { externalRef: 0, basicMonthly: 1, gender: 2, title: 3 },
      csvText: "Anstnr,MÃ¥nadslÃ¶n,KÃ¶n,Titel\nE001,55000,Kvinna,Engineer",
    })
    const section = screen.getByTestId("file-warnings-section")
    expect(section.textContent).toContain(m.check.fileWarning.mojibake)
  })

  it("shows no file-warnings section for a clean CSV", () => {
    renderCheckStep({ mapping: FULL_MAPPING })
    expect(screen.queryByTestId("file-warnings-section")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx -t "file warnings"`
Expected: FAIL — `CheckStep` has no `csvText` prop and renders no `file-warnings-section`. (The "clean CSV" test may currently pass only by accident; the two warning tests fail because the section is never rendered.)

- [ ] **Step 3: Thread `csvText` + signals through `CheckStep`**

In `check-step.tsx`, add `csvText` to `CheckStepProps` and tokenize it for signals inside the memo. Import `tokenizeCsv` and its result-type guard:

```tsx
import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  type FileWarningCode,
  type ImportValidation,
  type RowIssueCode,
  tokenizeCsv,
  validateImport,
} from "@workspace/import"
```

Update the props and the memo:

```tsx
export interface CheckStepProps {
  parsed: ParsedCsv
  /** Current wizard mapping (canonical field key -> source column index). */
  mapping: Record<string, number>
  /** Raw CSV text, re-tokenized here to recover structural signals. */
  csvText: string
  onValidated: (isBlocking: boolean, issueCount: number) => void
}

export function CheckStep({
  parsed,
  mapping,
  csvText,
  onValidated,
}: CheckStepProps) {
  const tCheck = useTranslations("dashboard.people.import.check")
  const tFields = useTranslations("dashboard.people.import.fields")
  const tTier = useTranslations("dashboard.people.import.tier")

  const validation: ImportValidation = useMemo(() => {
    const detectedMapping = buildDetectedMapping(mapping)
    // Re-tokenize to recover structural signals (noDelimiter, raggedRows) that
    // the parsed headers/rows alone do not carry. tokenizeCsv never throws for
    // well-formed CSV; a binary file would already have been rejected on upload.
    const { signals } = tokenizeCsv(csvText)
    return validateImport(
      { headers: parsed.headers, rows: parsed.rows },
      detectedMapping,
      {},
      signals
    )
  }, [parsed, mapping, csvText])
```

- [ ] **Step 4: Render the file-warnings section**

Insert this block in `check-step.tsx` between the warnings section (`data-testid="warnings-section"`) and the data-quality issues section (`data-testid="issues-section"`):

```tsx
      {/* File-scoped warnings (shown once, not per row) */}
      {validation.fileWarnings && validation.fileWarnings.length > 0 && (
        <Alert data-testid="file-warnings-section">
          <AlertTitle>{tCheck("fileWarnings")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4">
              {validation.fileWarnings.map((code: FileWarningCode) => (
                <li key={code}>
                  {tCheck(
                    `fileWarning.${code}` as Parameters<typeof tCheck>[0]
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
```

- [ ] **Step 5: Pass `csvText` from the wizard**

In `import-wizard.tsx`, the `STEP_CHECK` case renders `<CheckStep>` only when `state.parsed !== null && state.mapping !== null`. Add `state.csvText !== null` to that guard and pass `csvText`:

```tsx
            {state.parsed !== null &&
              state.mapping !== null &&
              state.csvText !== null && (
                <CheckStep
                  parsed={state.parsed}
                  mapping={state.mapping}
                  csvText={state.csvText}
                  onValidated={(isBlocking, issueCount) =>
                    setState((prev) => ({
                      ...prev,
                      checkBlocking: isBlocking,
                      checkIssueCount: issueCount,
                    }))
                  }
                />
              )}
```

- [ ] **Step 6: Run the file-warnings tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx -t "file warnings"`
Expected: PASS. Then run the whole check-step suite to confirm the `csvText`-threaded render helper did not break the existing blocking/warning/issues/ready describes: `bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx` → PASS.

- [ ] **Step 7: Add the `check.fileWarnings` heading to all 5 locales**

In `packages/i18n/messages/en.json` under `dashboard.people.import.check`, add (the `fileWarning` object with `noDelimiter`/`mojibake` already exists; this is the SECTION heading):

```json
"fileWarnings": "File warnings"
```

Mirror (Nordic = drafts, flag for native review):
- sv: `"fileWarnings": "Filvarningar"`
- nb (draft): `"fileWarnings": "Filadvarsler"`
- da (draft): `"fileWarnings": "Filadvarsler"`
- fi (draft): `"fileWarnings": "Tiedostovaroitukset"`

Edit the JSON files directly (never shell `perl`/`sed`).

- [ ] **Step 8: Run the i18n parity test and typecheck this app**

Run: `bunx vitest run packages/i18n` → PASS. Then confirm the wizard compiles with the new prop: `bunx tsc -p apps/dashboard --noEmit` (or `bun run typecheck` at root) → no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/components/people/import/check-step.tsx apps/dashboard/components/people/import/check-step.test.tsx apps/dashboard/components/people/import/import-wizard.tsx packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(import): render file warnings on the check step"
```

---

### Task 3: Per-row assign-gender UI (`check-step.tsx` + wizard state + `review-step.tsx`)

For rows flagged `unresolvedGender`, render each flagged row (identified by its `externalRef` cell) with a Man/Kvinna control. Collect the choices into a `Record<externalRef, "Man" | "Kvinna">` in wizard state, thread it to ReviewStep, and have ReviewStep convert it to `Array<[externalRef, "Man" | "Kvinna"]>` and pass it as `genderOverrides` into the `importPayroll` call (Plan D accepts it).

**Files:**
- Create: `apps/dashboard/components/people/import/assign-gender.tsx` (small presentational sub-component: given the flagged rows, renders the Man/Kvinna controls and calls back with the choice map)
- Modify: `apps/dashboard/components/people/import/check-step.tsx` (compute flagged rows from `validation.issues` where `code === "unresolvedGender"`, resolve each row's `externalRef` cell, render `<AssignGender>`, lift the choice map via a new `onGenderOverridesChange` prop)
- Modify: `apps/dashboard/components/people/import/import-wizard.tsx` (add `genderOverrides: Record<string, "Man" | "Kvinna">` to `WizardState`; wire `onGenderOverridesChange` on `<CheckStep>`; pass `genderOverrides` to `<ReviewStep>`; reset it on header change alongside `mapping`)
- Modify: `apps/dashboard/components/people/import/review-step.tsx:130-176` (add `genderOverrides` prop; convert + include it in the `importPayroll` call under the empty-guard)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `dashboard.people.import.check.assignGender.{heading,help}` and `dashboard.people.import.gender.{Man,Kvinna}` display labels)
- Test: create `assign-gender.test.tsx`; extend `check-step.test.tsx` (assign UI appears for blank gender) and `review-step.test.tsx` (genderOverrides arg passed)

**Interfaces:**
- Consumes: `validation.issues: RowIssue[]` where `RowIssue = { row: number; code: RowIssueCode; detail: string }` and `RowIssueCode` includes `"unresolvedGender"`; the wizard `mapping` for the `externalRef` column index.
- Produces:
  - `AssignGender` component: `{ flagged: Array<{ externalRef: string; rowIndex: number }>; value: Record<string, "Man" | "Kvinna">; onChange: (next: Record<string, "Man" | "Kvinna">) => void }`.
  - `CheckStepProps` gains `onGenderOverridesChange: (next: Record<string, "Man" | "Kvinna">) => void` and `genderOverrides: Record<string, "Man" | "Kvinna">` (controlled).
  - `ReviewStepProps` gains `genderOverrides: Record<string, "Man" | "Kvinna">`; the `importPayroll` call now includes `genderOverrides: Array<[string, "Man" | "Kvinna"]>` (omitted when the record is empty).

- [ ] **Step 1: Write the failing `AssignGender` tests** (create `assign-gender.test.tsx`)

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AssignGender } from "./assign-gender"

const m = messages.dashboard.people.import

function renderAssign({
  flagged = [
    { externalRef: "E001", rowIndex: 0 },
    { externalRef: "E014", rowIndex: 3 },
  ],
  value = {},
  onChange = vi.fn(),
}: {
  flagged?: Array<{ externalRef: string; rowIndex: number }>
  value?: Record<string, "Man" | "Kvinna">
  onChange?: (next: Record<string, "Man" | "Kvinna">) => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssignGender flagged={flagged} value={value} onChange={onChange} />
    </NextIntlClientProvider>
  )
}

describe("AssignGender", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders one control row per flagged externalRef", () => {
    renderAssign()
    expect(screen.getByTestId("assign-gender-E001")).toBeDefined()
    expect(screen.getByTestId("assign-gender-E014")).toBeDefined()
  })

  it("shows the Man and Kvinna option labels", () => {
    renderAssign()
    expect(screen.getAllByText(m.gender.Man).length).toBeGreaterThan(0)
    expect(screen.getAllByText(m.gender.Kvinna).length).toBeGreaterThan(0)
  })

  it("calls onChange with the ref -> choice map when a gender is picked", () => {
    const onChange = vi.fn()
    renderAssign({ onChange })
    fireEvent.click(screen.getByTestId("assign-gender-E001-Kvinna"))
    expect(onChange).toHaveBeenCalledWith({ E001: "Kvinna" })
  })

  it("merges a second choice into the existing map (last-wins per ref)", () => {
    const onChange = vi.fn()
    renderAssign({ value: { E001: "Kvinna" }, onChange })
    fireEvent.click(screen.getByTestId("assign-gender-E014-Man"))
    expect(onChange).toHaveBeenCalledWith({ E001: "Kvinna", E014: "Man" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run apps/dashboard/components/people/import/assign-gender.test.tsx`
Expected: FAIL — `./assign-gender` does not exist.

- [ ] **Step 3: Implement `AssignGender`** (create `assign-gender.tsx`)

Uses shadcn `Button` toggle pair per row (a two-option control; `RadioGroup` is the alternative but a pair of pressed-state buttons keeps the choice visible inline and avoids a11y label plumbing). Fixed-width control slot to avoid reflow.

```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"

export interface AssignGenderProps {
  /** Rows flagged unresolvedGender, identified by their externalRef cell. */
  flagged: Array<{ externalRef: string; rowIndex: number }>
  /** Current choices (controlled). */
  value: Record<string, "Man" | "Kvinna">
  onChange: (next: Record<string, "Man" | "Kvinna">) => void
}

const GENDERS: ReadonlyArray<"Man" | "Kvinna"> = ["Man", "Kvinna"]

export function AssignGender({ flagged, value, onChange }: AssignGenderProps) {
  const tCheck = useTranslations("dashboard.people.import.check")
  const tGender = useTranslations("dashboard.people.import.gender")

  function pick(externalRef: string, gender: "Man" | "Kvinna") {
    onChange({ ...value, [externalRef]: gender })
  }

  return (
    <div data-testid="assign-gender" className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-sm">{tCheck("assignGender.heading")}</h3>
        <p className="text-muted-foreground text-sm">
          {tCheck("assignGender.help")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {flagged.map(({ externalRef }) => (
          <div
            key={externalRef}
            data-testid={`assign-gender-${externalRef}`}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <span className="font-mono text-sm">{externalRef}</span>
            <div className="flex gap-1">
              {GENDERS.map((g) => (
                <Button
                  key={g}
                  type="button"
                  size="sm"
                  variant={value[externalRef] === g ? "default" : "outline"}
                  onClick={() => pick(externalRef, g)}
                  data-testid={`assign-gender-${externalRef}-${g}`}
                >
                  {tGender(g)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the `AssignGender` tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/assign-gender.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing CheckStep integration test** (add to `check-step.test.tsx`)

```tsx
// Rows with a blank gender cell -> unresolvedGender flag -> assign UI.
const BLANK_GENDER_PARSED: ParsedCsv = {
  headers: ["EmployeeID", "JobTitle", "Gender", "MonthlySalary"],
  rows: [
    ["E001", "Engineer", "", "55000"],
    ["E002", "Manager", "Man", "70000"],
  ],
}
const BLANK_GENDER_MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
}

describe("CheckStep — assign gender", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the assign-gender UI for a row with a blank gender cell", () => {
    renderCheckStep({
      parsed: BLANK_GENDER_PARSED,
      mapping: BLANK_GENDER_MAPPING,
    })
    expect(screen.getByTestId("assign-gender")).toBeDefined()
    // The flagged row is identified by its externalRef E001.
    expect(screen.getByTestId("assign-gender-E001")).toBeDefined()
  })

  it("lifts the chosen gender via onGenderOverridesChange", () => {
    const onGenderOverridesChange = vi.fn()
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CheckStep
          parsed={BLANK_GENDER_PARSED}
          mapping={BLANK_GENDER_MAPPING}
          csvText={
            "EmployeeID,JobTitle,Gender,MonthlySalary\nE001,Engineer,,55000\nE002,Manager,Man,70000"
          }
          genderOverrides={{}}
          onGenderOverridesChange={onGenderOverridesChange}
          onValidated={vi.fn()}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("assign-gender-E001-Kvinna"))
    expect(onGenderOverridesChange).toHaveBeenCalledWith({ E001: "Kvinna" })
  })
})
```

Update `renderCheckStep` to pass the two new props with defaults (`genderOverrides = {}`, `onGenderOverridesChange = vi.fn()`), and add `fireEvent` to the top import.

- [ ] **Step 6: Run to verify it fails**

Run: `bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx -t "assign gender"`
Expected: FAIL — CheckStep does not render the assign UI or accept the new props.

- [ ] **Step 7: Wire `AssignGender` into `CheckStep`**

In `check-step.tsx`, add the two props, compute the flagged rows (dedup by row, resolve `externalRef` from the mapped column), and render `<AssignGender>` inside the issues area (after the issues section). Import the sub-component and `parseStringId` is NOT needed; use the raw trimmed cell.

```tsx
import { AssignGender } from "./assign-gender"
```

Extend props:

```tsx
export interface CheckStepProps {
  parsed: ParsedCsv
  mapping: Record<string, number>
  csvText: string
  /** Current per-row gender overrides (controlled), keyed by externalRef. */
  genderOverrides: Record<string, "Man" | "Kvinna">
  onGenderOverridesChange: (next: Record<string, "Man" | "Kvinna">) => void
  onValidated: (isBlocking: boolean, issueCount: number) => void
}
```

Compute the flagged rows from `validation.issues` (add near `issueGroups`):

```tsx
  // Rows flagged unresolvedGender, identified by their externalRef cell so the
  // HR admin can assign Man/Kvinna manually. The externalRef column is required
  // (validation would block without it), so it is present when we reach here.
  const flaggedGenderRows = useMemo(() => {
    const externalRefCol = mapping.externalRef
    if (externalRefCol === undefined) return []
    const out: Array<{ externalRef: string; rowIndex: number }> = []
    const seen = new Set<string>()
    for (const issue of validation.issues) {
      if (issue.code !== "unresolvedGender") continue
      const ref = (parsed.rows[issue.row]?.[externalRefCol] ?? "").trim()
      if (ref === "" || seen.has(ref)) continue
      seen.add(ref)
      out.push({ externalRef: ref, rowIndex: issue.row })
    }
    return out
  }, [validation.issues, mapping, parsed.rows])
```

Render after the data-quality issues section:

```tsx
      {/* Per-row gender assignment for unresolvedGender rows */}
      {flaggedGenderRows.length > 0 && (
        <AssignGender
          flagged={flaggedGenderRows}
          value={genderOverrides}
          onChange={onGenderOverridesChange}
        />
      )}
```

Add the props to the function signature: `export function CheckStep({ parsed, mapping, csvText, genderOverrides, onGenderOverridesChange, onValidated }: CheckStepProps)`.

- [ ] **Step 8: Run the CheckStep assign-gender tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/check-step.test.tsx -t "assign gender"` → PASS. Then the whole check-step suite → PASS.

- [ ] **Step 9: Thread wizard state**

In `import-wizard.tsx`:
1. Add to `WizardState`: `genderOverrides: Record<string, "Man" | "Kvinna">` and to the initial state `genderOverrides: {}`.
2. In `onParsed`'s header-change reset object, add `genderOverrides: {}` (alongside `mapping: null`, `checkBlocking: null`, `checkIssueCount: 0`).
3. In the `STEP_CHECK` case, pass the two new props:

```tsx
                <CheckStep
                  parsed={state.parsed}
                  mapping={state.mapping}
                  csvText={state.csvText}
                  genderOverrides={state.genderOverrides}
                  onGenderOverridesChange={(genderOverrides) =>
                    setState((prev) => ({ ...prev, genderOverrides }))
                  }
                  onValidated={(isBlocking, issueCount) =>
                    setState((prev) => ({
                      ...prev,
                      checkBlocking: isBlocking,
                      checkIssueCount: issueCount,
                    }))
                  }
                />
```

4. In the `STEP_REVIEW` case, pass `genderOverrides={state.genderOverrides}` to `<ReviewStep>`.

- [ ] **Step 10: Write the failing ReviewStep genderOverrides test** (add to `review-step.test.tsx`)

```tsx
describe("ReviewStep — gender overrides", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("passes genderOverrides as [ref, choice] pairs to importPayroll", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStep
          parsed={PARSED}
          mapping={MAPPING}
          csvText={CSV_TEXT}
          flaggedCount={1}
          genderOverrides={{ E001: "Kvinna" }}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("confirm-button"))
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as {
      genderOverrides: Array<[string, string]>
    }
    expect(call.genderOverrides).toEqual([["E001", "Kvinna"]])
  })

  it("omits genderOverrides when the record is empty", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep({ flaggedCount: 0 }) // renderReviewStep defaults genderOverrides to {}
    fireEvent.click(screen.getByTestId("confirm-button"))
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("genderOverrides" in call).toBe(false)
  })
})
```

Update `renderReviewStep` to accept and default `genderOverrides = {}` and pass it to `<ReviewStep>`.

- [ ] **Step 11: Run to verify it fails**

Run: `bunx vitest run apps/dashboard/components/people/import/review-step.test.tsx -t "gender overrides"`
Expected: FAIL — `ReviewStep` has no `genderOverrides` prop and does not send it.

- [ ] **Step 12: Wire `genderOverrides` into the `importPayroll` call**

In `review-step.tsx`, add the prop and include it under the empty-guard:

```tsx
export interface ReviewStepProps {
  parsed: ParsedCsv
  mapping: Record<string, number>
  csvText: string
  flaggedCount: number
  /** Per-row manual gender assignments, keyed by externalRef. */
  genderOverrides: Record<string, "Man" | "Kvinna">
}

export function ReviewStep({
  parsed,
  mapping,
  csvText,
  flaggedCount,
  genderOverrides,
}: ReviewStepProps) {
  // ...existing hooks...

  async function handleConfirm() {
    setIsSubmitting(true)
    setBlockingError(null)
    try {
      // Convert the ergonomic record to the Convex array-of-pairs Plan D expects.
      // Omit the arg entirely when there is nothing to override.
      const genderOverridePairs = Object.entries(genderOverrides) as Array<
        [string, "Man" | "Kvinna"]
      >
      const result = await importPayroll({
        orgId,
        csvText,
        columnMap,
        ...(genderOverridePairs.length > 0
          ? { genderOverrides: genderOverridePairs }
          : {}),
      })
      if (result.ok) {
        toast.success(tToast("peopleImported"))
        router.push("/people")
      } else {
        setBlockingError(result.validation.blocking)
      }
    } catch {
      toast.error(tToast("error"))
    } finally {
      setIsSubmitting(false)
    }
  }
```

- [ ] **Step 13: Run the ReviewStep gender-override tests to verify they pass**

Run: `bunx vitest run apps/dashboard/components/people/import/review-step.test.tsx -t "gender overrides"` → PASS. Then the whole review-step suite → PASS (the existing success/failure tests must still pass; they never set `genderOverrides`, so the arg is omitted and their `call.columnMap`/`call.orgId` assertions are unaffected).

- [ ] **Step 14: Add the i18n keys to all 5 locales**

In `packages/i18n/messages/en.json` under `dashboard.people.import.check`, add an `assignGender` object; and add a sibling `gender` object under `dashboard.people.import` (mirroring the existing `dashboard.people.gender.{Man,Kvinna}` = `Man`/`Woman`):

```json
// under dashboard.people.import.check:
"assignGender": {
  "heading": "Assign gender for these rows",
  "help": "We could not read a gender for these employees. Choose one for each so they can be imported. Rows are shown by employee ID; no other personal data is sent to import."
},
// under dashboard.people.import (sibling of check/map/review):
"gender": {
  "Man": "Man",
  "Kvinna": "Woman"
}
```

Mirror into sv/nb/da/fi (Nordic = drafts, flag for native review):
- sv: `assignGender.heading` = "Ange kön för dessa rader", `assignGender.help` = "Vi kunde inte läsa av kön för dessa anställda. Välj ett för var och en så att de kan importeras. Raderna visas med anställningsnummer; inga andra personuppgifter skickas till importen.", `gender` = { "Man": "Man", "Kvinna": "Kvinna" }
- nb (draft): `assignGender.heading` = "Angi kjønn for disse radene", `assignGender.help` = "Vi kunne ikke lese kjønn for disse ansatte. Velg ett for hver av dem så de kan importeres. Radene vises med ansattnummer; ingen andre personopplysninger sendes til importen.", `gender` = { "Man": "Mann", "Kvinna": "Kvinne" }
- da (draft): `assignGender.heading` = "Angiv køn for disse rækker", `assignGender.help` = "Vi kunne ikke aflæse køn for disse medarbejdere. Vælg et for hver, så de kan importeres. Rækkerne vises med medarbejdernummer; ingen andre personoplysninger sendes til importen.", `gender` = { "Man": "Mand", "Kvinna": "Kvinde" }
- fi (draft): `assignGender.heading` = "Määritä sukupuoli näille riveille", `assignGender.help` = "Emme voineet lukea sukupuolta näille työntekijöille. Valitse kullekin yksi, jotta heidät voidaan tuoda. Rivit näytetään henkilönumerolla; muita henkilötietoja ei lähetetä tuontiin.", `gender` = { "Man": "Mies", "Kvinna": "Nainen" }

Edit the JSON files directly (never shell `perl`/`sed`; the `gender` values contain non-ASCII).

- [ ] **Step 15: Run the i18n parity test and full import suite + typecheck**

Run: `bunx vitest run packages/i18n` → PASS. Then `bunx vitest run apps/dashboard/components/people/import` → PASS (all five test files). Then `bunx tsc -p apps/dashboard --noEmit` → no errors. Grep for mojibake in the touched non-ASCII lines: `grep -nE 'Ã|Â' packages/i18n/messages/{sv,nb,da,fi}.json` should show nothing new.

- [ ] **Step 16: Commit**

```bash
git add apps/dashboard/components/people/import/assign-gender.tsx apps/dashboard/components/people/import/assign-gender.test.tsx apps/dashboard/components/people/import/check-step.tsx apps/dashboard/components/people/import/check-step.test.tsx apps/dashboard/components/people/import/import-wizard.tsx apps/dashboard/components/people/import/review-step.tsx apps/dashboard/components/people/import/review-step.test.tsx packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(import): assign gender for unresolved rows and pass overrides to importPayroll"
```

---

### Task 4: Preview fraction fix (`review-step.tsx`)

The preview builder calls `parsePercent(ftePercentRaw)` with no `{ fraction: true }`, so a fractional FTE column (values <= 1.0, e.g. "0.8") previews as `0.8%` while the backend (which classifies the column and scales) imports `80`. Detect the fractional column with `classifyColumn` on the mapped FTE column and pass `{ fraction: true }` to `parsePercent` in the preview so it shows `80`, matching the backend.

**Files:**
- Modify: `apps/dashboard/components/people/import/review-step.tsx:79-124` (compute `fteIsFraction` once via `classifyColumn`, pass `{ fraction: fteIsFraction }` to `parsePercent`)
- Test: `apps/dashboard/components/people/import/review-step.test.tsx` (add a fractional-FTE preview test)

**Interfaces:**
- Consumes: `classifyColumn(values: string[], opts?): { shape, confidence, fillRate, sampleSize, fraction?: boolean }` from `@workspace/import`; `parsePercent(v, opts?: { fraction?: boolean })`. A column is fractional when `classifyColumn(columnCells).fraction === true` (every non-blank cell is a finite number <= 1.0 and the winning shape is percent).
- Produces: no interface change; the preview `ftePercent` value is now scaled x100 for fractional columns.

- [ ] **Step 1: Write the failing preview test** (add to `review-step.test.tsx`)

```tsx
describe("ReviewStep — fractional FTE preview", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows a fractional FTE column scaled to a percentage (0.8 -> 80)", () => {
    const fracHeaders = ["EmployeeID", "JobTitle", "Gender", "MonthlySalary", "FTE"]
    const fracRows: string[][] = [
      ["E001", "Engineer", "Kvinna", "55000", "0.8"],
      ["E002", "Manager", "Man", "70000", "1.0"],
    ]
    const fracParsed: ParsedCsv = { headers: fracHeaders, rows: fracRows }
    const fracMapping: Record<string, number> = {
      externalRef: 0,
      title: 1,
      gender: 2,
      basicMonthly: 3,
      ftePercent: 4,
    }
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStep
          parsed={fracParsed}
          mapping={fracMapping}
          csvText={`${fracHeaders.join(",")}\n${fracRows.map((r) => r.join(",")).join("\n")}`}
          flaggedCount={0}
          genderOverrides={{}}
        />
      </NextIntlClientProvider>
    )
    // 0.8 scaled x100 -> "80%", not "0.8%".
    expect(screen.getByTestId("preview-row-0").textContent).toContain("80%")
    expect(screen.getByTestId("preview-row-0").textContent).not.toContain("0.8%")
  })
})
```

(This test uses the `genderOverrides` prop from Task 3; if Task 4 is executed before Task 3, drop the `genderOverrides={{}}` prop and it still compiles against the pre-Task-3 signature. The plan sequences Task 3 before Task 4, so keep the prop.)

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run apps/dashboard/components/people/import/review-step.test.tsx -t "fractional FTE"`
Expected: FAIL — the preview shows `0.8%` (unscaled) because `parsePercent` is called without `{ fraction: true }`.

- [ ] **Step 3: Detect the fractional FTE column and scale in `buildPreviewRows`**

In `review-step.tsx`, import `classifyColumn`:

```tsx
import {
  type CanonicalFieldKey,
  classifyColumn,
  parseCurrency,
  parseGender,
  parseMoney,
  parsePercent,
} from "@workspace/import"
```

In `buildPreviewRows`, after resolving `ftePercentCol`, determine once whether that column is fractional, and pass the flag to `parsePercent`:

```tsx
  const ftePercentCol = col("ftePercent")
  const genderCol = col("gender")

  // Determine once whether the FTE column is fractional (values <= 1.0). The
  // backend classifies the whole column and scales x100; mirror that here so the
  // preview value matches the imported value (classifyColumn over ALL rows, not
  // just the previewed slice, so the fraction verdict is the column's, not the
  // preview window's).
  const fteIsFraction =
    ftePercentCol !== undefined &&
    classifyColumn(parsed.rows.map((r) => r[ftePercentCol] ?? "")).fraction ===
      true

  const rows = parsed.rows.slice(0, PREVIEW_ROW_COUNT)
```

Then update the FTE parse line:

```tsx
    const ftePercentRaw = cell(ftePercentCol)
    const ftePercent = ftePercentRaw
      ? parsePercent(ftePercentRaw, { fraction: fteIsFraction })
      : null
```

- [ ] **Step 4: Run the fractional-FTE test to verify it passes**

Run: `bunx vitest run apps/dashboard/components/people/import/review-step.test.tsx -t "fractional FTE"` → PASS.

- [ ] **Step 5: Run the whole review-step suite to confirm no regression**

Run: `bunx vitest run apps/dashboard/components/people/import/review-step.test.tsx` → PASS. The existing preview tests use whole-percent FTE ("100", "80"), for which `classifyColumn(...).fraction` is `undefined` (values > 1), so `{ fraction: false }` leaves them unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/people/import/review-step.tsx apps/dashboard/components/people/import/review-step.test.tsx
git commit -m "fix(import): scale fractional FTE in the preview to match the backend"
```

---

## Self-Review

**1. Spec coverage:**
- Task 1 = column-first map redesign: rows are CSV columns, show header + 3-5 samples + detected field + confidence + Select (any field or Ignore); same underlying `mapping` state; last-wins prevents two columns on one field; missing required still surfaced; new keys `map.{columnHeading,samples,detectedAs,ignore}`; reuses `buildInitialMapping`/`updateMapping`; tests cover detection/change/ignore/required. Covered.
- Task 2 = file-warnings render: threads `signals` into `validateImport`, renders `fileWarnings` between warnings and issues, new `check.fileWarnings` heading, tests for no-delimiter + mojibake. Covered.
- Task 3 = per-row assign-gender: flagged `unresolvedGender` rows by `externalRef`, Man/Kvinna control, collect `Record<externalRef, "Man"|"Kvinna">` in wizard state, thread to ReviewStep, pass `genderOverrides` array-of-pairs to `importPayroll`; new keys `check.assignGender.{heading,help}` + `import.gender.{Man,Kvinna}`; tests: blank-gender surfaces UI, choosing adds to overrides passed to importPayroll (mock `useAction`). Covered.
- Task 4 = preview fraction fix: `classifyColumn` on the FTE column, `{ fraction }` to `parsePercent`, preview test. Covered.
- Global constraints (i18n 5 locales/Nordic drafts, shadcn, layout shift, tests-in-commit, Vitest 4, no em dashes, conventional commits) are in the header and enforced per task. Covered.
- DEPENDENCY on Plan D (the `genderOverrides` arg + backend fraction/date fixes) is called out in a dedicated header section and re-noted in Tasks 3 and 4. Covered.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N"/uncoded steps. Every code step shows real code; every run step shows the exact command and expected result. The one conditional ("if a Radix Select cannot open in jsdom", Step 8 of Task 1) gives a concrete fallback, not a placeholder.

**3. Type consistency:**
- `genderOverrides` is `Record<string, "Man" | "Kvinna">` in wizard state, `CheckStepProps`, `AssignGenderProps.value`, and `ReviewStepProps`; converted to `Array<[string, "Man" | "Kvinna"]>` exactly once at the `importPayroll` call. Matches Plan D's `Array<[externalRef, "Man" | "Kvinna"]>` arg. Consistent.
- `columnToField(mapping, columnIndex): CanonicalFieldKey | null` and `assignColumnToField(prev, columnIndex, fieldKey: CanonicalFieldKey | null): Record<string, number>` are used identically in helper tests, the component, and cross-referenced from Task 1's Interfaces. Consistent.
- `CheckStepProps` grows across Task 2 (`csvText`) and Task 3 (`genderOverrides`, `onGenderOverridesChange`); the wizard passes all four extra props in the final `STEP_CHECK` snippet (Task 3 Step 9), which supersedes the Task 2 Step 5 snippet. The Task 2 wiring is a strict subset, so executing in order leaves no stale prop wiring. Consistent.
- `AssignGender.flagged` items are `{ externalRef: string; rowIndex: number }` in the sub-component, its test, and the CheckStep `flaggedGenderRows` producer. Consistent.
- `classifyColumn(...).fraction` is `boolean | undefined`; both the validate engine (`isFractionColumn`) and Task 4 compare `=== true`, so the whole-percent case (`fraction: undefined`) is treated as non-fraction. Consistent.

Fixes applied inline: none needed after the pass; the `CheckStepProps` growth ordering was clarified in point 3 above and both wiring snippets were written to be additive.
