# Import fidelity: annual/monthly basis, full pay components, employment type

**Date:** 2026-07-11 · **Status:** approved design, pending spec review · **Scope:** V2 people/pay import

## Context & problem

A conformance audit against the Swedish lönekartläggning method guide (Diskrimineringslagen kap. 3 + EU 2023/970) found the import pipeline's plumbing is production-grade but its payroll *semantics* are not yet faithful. Three defects, all in the CSV ingestion path:

1. **Annual-vs-monthly conflation (~12× overstatement).** Nothing in the import distinguishes annual from monthly pay. `basicMonthly` accepts `annualsalary`/`grosssalary` header synonyms and stores them straight as monthly; the variable cell is pushed in raw as a monthly component even though `bonus`/`målbonus`/`årsbonus` are annual; and `totalMonthlyComp` does no division. The guide's §2.2 TCC is `grundlön + förmåner + (bonus/år ÷ 12)`. Every downstream gap/quartile metric is poisoned until this is fixed.
2. **Only two pay components ingestible.** `import.ts` wires only `variable` + a single `benefitInKind` column, though §A2 (Art. 9.1) requires each component stored separately and the schema (`PAY_COMPONENT_KINDS`) can already hold them. Car benefit, other benefits, overtime, allowances, and equity collapse or have nowhere to land, forcing a re-import once the analysis layer needs them.
3. **`employment_type` has no home.** No field on `people`, no import synonym. The guide treats it as mandatory (§1.1) and groups by it (§3.3 #10); only heltid/deltid is derivable from `ftePercent`.

This is a single coherent "import fidelity" change: everything normalizes to monthly at ingestion, so `payRecords` and the TCC formula keep their current shape.

## Goals

- An imported payroll file produces faithful **monthly** figures regardless of whether source columns are annual or monthly.
- Each pay component from the source maps to a **separate** `payRecords` component with the correct kind.
- `employment_type` is captured as a typed, groupable attribute.
- Preview (dry-run diff) and real import stay byte-for-byte consistent (they already share the prepare path).

## Non-goals

- Annual/monthly toggle on the manual `setSalary` form (manual entry stays monthly-labelled).
- `grundlön = 0` warning, `cost_center`, `manager_id` (deferred; the zero-base flag is a cheap add if requested later).
- Anything in the analysis/reporting/comparison-group modules.
- A data migration: pre-launch, existing dev/prod data is reset, not migrated (no legacy before launch).

## Design

### 1. Shared, pure primitives (`@workspace/constants`)

`constants/src/pay.ts` (extend):
- `export const PAY_BASIS = ["monthly", "annual"] as const` + `type PayBasis`.
- `export function toMonthly(amount: number, basis: PayBasis): number` → `basis === "annual" ? amount / 12 : amount`. Pure, no I/O. The single point of annual→monthly normalization, imported by both `import.ts` and `importDiff.ts`.
- `export const DEFAULT_BASIS_BY_FIELD: Record<"basicMonthly" | PayComponentKind, PayBasis>` (keys = every money field: basic salary + each component kind) → base = `monthly`; `variable`, `bonus`, `equity` = `annual`; `benefitInKind`, `fixedSupplement`, `allowance`, `other` = `monthly`.

`constants/src/employment.ts` (new):
- `export const EMPLOYMENT_TYPES = ["permanent", "fixedTerm", "substitute", "hourly"] as const` + `type EmploymentType`.
- `export function normalizeEmploymentType(raw: string): EmploymentType | null` → folds a source string and maps Swedish/Nordic/English payroll terms (tillsvidare/fast → permanent; visstid/tidsbegränsad → fixedTerm; vikariat/vikarie → substitute; tim/timavlönad → hourly). Returns `null` when unrecognised (soft, no block).

### 2. Canonical import fields (`packages/import/src/fields.ts`)

- **Component-kind money fields:** the field key equals the `PAY_COMPONENT_KIND`. `variable` + `benefitInKind` already exist; add `bonus`, `fixedSupplement`, `allowance`, `equity`, `other`, each optional-tier `money` shape with sv/nb/da/fi/en synonyms. This makes ingestion a single loop keyed by kind (see §3), and keeps field-key ↔ component-kind a 1:1 invariant.
- **`employmentType` field:** new shape `employmentType` (parallels `gender`: resolves via a normalizer, but soft). Synonyms: `anstallningsform`, `anstform`, `employmenttype`, `employmentform`, `contracttype`, `ansettelsesform`, `ansaettelsesform`, `palvelussuhde`, etc.
- **Annual-hint synonyms:** an `ANNUAL_HINT` folded set (e.g. `arslon`, `annualsalary`, `grosssalary`, `arsbonus`, `annualbonus`) used only to pre-set the toggle default (§5). The `annualsalary`/`grosssalary` synonyms stay on `basicMonthly` (so an annual base column still auto-maps to the base field) but now default the toggle to `annual`, killing the silent trap.
- `export function defaultBasis(fieldKey, rawHeader): PayBasis` — pure: `ANNUAL_HINT`-folded header match → `annual`, else `DEFAULT_BASIS_BY_FIELD[fieldKey]`, else `monthly`. The wizard already knows each column's header, so this needs no threading through `detectColumns`.

### 3. Prepare / ingest (`packages/backend/convex/people/import.ts`)

In `prepareImport`:
- Add `basisOf(key) = args.basisMap?.[key] ?? DEFAULT_BASIS_BY_FIELD[key] ?? "monthly"`. The backend trusts the user-confirmed `basisMap`; the annual-hint `defaultBasis(fieldKey, header)` is applied **client-side only** (§5/§7) to seed the toggle, and is never re-derived here (the backend has no header-hint dependency).
- Normalize basic: `basicMonthly = toMonthly(parseMoney(raw), basisOf("basicMonthly"))`.
- Replace the hardcoded `variable`+`benefit` block (lines 369-382) with a loop over `PAY_COMPONENT_KINDS`:
  ```
  for (const kind of PAY_COMPONENT_KINDS) {
    const col = colOf(kind); if (col === undefined) continue
    const raw = cell(col); if (!raw) continue
    const parsed = parseMoney(raw); if (parsed === null || parsed <= 0) continue
    components.push({ kind, monthlyAmount: toMonthly(parsed, basisOf(kind)) })
  }
  ```
- Resolve `employmentType = normalizeEmploymentType(cell(employmentTypeCol)) ?? undefined` and add it to the person patch (spread-if-defined, like the other optionals).
- `payRecords` shape is unchanged: components stay `{ kind, monthlyAmount }`, everything monthly. The `basis` decision is *consumed* here, not stored on the record.

### 4. Preview parity (`packages/backend/convex/people/importDiff.ts`)

`diffImport`/`personImportPatch`/`sameSalaryValues` operate on the normalized rows `prepareImport` produces, so basis normalization flows through automatically once §3 lands. Verify: the preview must receive the same `basisMap` the real import will use, and `employmentType` must be included in the person-change diff.

### 5. Action boundary & profile persistence

- `importPayroll` action (and any internal variant) gains an optional arg `basisMap: Record<string, "monthly" | "annual">` (keyed by canonical money field), threaded into `prepareImport`.
- `people/tables.ts` `importMappingProfiles`: add `basisMap: v.optional(v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual"))))`.
- `people/importProfile.ts`: extend `profileShape` + `saveImportMappingProfile` + `internalSaveImportMappingProfile` args + the change-detection compare to include `basisMap`, so a re-import reuses the saved per-column basis.

### 6. Schema (`packages/backend/convex/people/tables.ts`)

- `people`: add `employmentType: v.optional(v.union(v.literal("permanent"), v.literal("fixedTerm"), v.literal("substitute"), v.literal("hourly")))`. Optional, HR-structural (not PII beyond what already lives here), so no audit-diff or masking concerns beyond the existing person rules.

### 7. UI — Map step (`apps/dashboard/components/people/import/map-step.tsx`)

- For each mapped **money column** row, render a compact monthly/annual control (shadcn `Select` or segmented control), initial state from `defaultBasis(fieldKey, header)`, user-overridable. Collected into `basisMap` and passed to the import action + profile save.
- `employmentType` appears as a normal mappable column row.
- Fits the column-first Map layout (each toggle sits on its column's row); no layout shift (the control occupies a reserved slot).

### 8. i18n

New keys added to `packages/i18n/messages/en.json` first, then mirrored to sv/nb/da/fi (parity-guarded): the basis toggle label + `monthly`/`annual` options, the `employmentType` field label, the four employment-type value labels, and the new pay-component labels (`bonus`, `fixedSupplement`, `allowance`, `equity`, `other`). Nordic strings flagged for native review.

## Testing (ships in the same commit)

- `constants`: `toMonthly` (monthly passthrough, annual ÷12), `normalizeEmploymentType` (each term + unrecognised → null), `DEFAULT_BASIS_BY_FIELD`.
- `import`: new component-kind + `employmentType` synonym detection; `defaultBasis` (annual-hint header → annual; plain header → field default).
- `backend/people`: `prepareImport` builds one component per mapped kind with correct monthly amounts under mixed bases; annual base column ÷12; `employmentType` normalized and set; unmapped/unrecognised employmentType left unset; `importDiff` preview equals real import under the same `basisMap`; profile round-trips `basisMap`.

## Component boundaries

- **Normalization logic** is pure and lives in `@workspace/constants` (`toMonthly`, `normalizeEmploymentType`) and `@workspace/import` (`defaultBasis`, field defs) — testable without Convex, reused by real import and preview.
- **Ingestion** (`import.ts`) orchestrates: read column → parse → normalize by basis → build record. No new domain concept leaks into it.
- **UI** only collects `basisMap` + mappings and hands them to the action; it holds no normalization logic.

## File-change checklist

- `packages/constants/src/pay.ts` — `PAY_BASIS`, `toMonthly`, `DEFAULT_BASIS_BY_FIELD` (+ test).
- `packages/constants/src/employment.ts` — `EMPLOYMENT_TYPES`, `normalizeEmploymentType` (+ test); export from index.
- `packages/import/src/fields.ts` — component-kind fields, `employmentType` field, `ANNUAL_HINT`, `defaultBasis` (+ tests in detect/validate).
- `packages/backend/convex/people/tables.ts` — `people.employmentType`, `importMappingProfiles.basisMap`.
- `packages/backend/convex/people/import.ts` — `basisOf`, `toMonthly` normalization, component loop, employmentType (+ tests).
- `packages/backend/convex/people/importDiff.ts` — verify basis + employmentType flow through preview (+ tests).
- `packages/backend/convex/people/importProfile.ts` — persist `basisMap` (+ tests).
- `apps/dashboard/components/people/import/map-step.tsx` — basis toggle + employmentType row (+ test).
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — new keys (parity-guarded).
