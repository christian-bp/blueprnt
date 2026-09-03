# Hourly Pay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give hourly pay a first-class model (a basis on the pay record, full-time hours with an org default and a per-person override), read a mixed "Lön" column by pay form in the import with a visible, switchable interpretation, and compare everyone on one basis (FTE-adjusted monthly) with the factor frozen into every run and stated in the report.

**Architecture:** `payRecords.basicMonthly` becomes `basicAmount` + `basis` (`monthly` | `hourly`); one pure helper in `@workspace/constants` normalizes (amount, basis, hours) to a full-time-equivalent monthly figure, and `fteTotalMonthlyComp` takes the basis so hourly rows skip the FTE division. Hours resolve person, then organization, then a country default, through one backend helper. The frozen snapshot keeps `basicMonthly` as the normalized value the engine reads and freezes the raw amount, the basis and the hours used beside it. The import gains `hourlyRate` and `fullTimeHoursPerMonth` columns, a per-row basis rule keyed on the employment type, three soft plausibility notices, and a review-step group with a default-on checkbox. The dashboard gets a basis choice in the salary dialog, the settings and person fields for hours, an "Hourly" chip on frozen rows, and a conditional method-note sentence.

**Tech Stack:** Convex (packages/backend, convex-test on edge-runtime), `@workspace/import` (pure TS), `@workspace/constants`, Next.js 16 dashboard (React, TanStack table, Base UI via @workspace/ui, next-intl, react-hook-form + Zod), Vitest 4, Biome.

**Spec:** `docs/superpowers/specs/2026-09-02-hourly-pay-design.md`

## Global Constraints

- All code, comments, commit messages and filenames in English. No em dashes anywhere (UI copy, docs, comments, commits).
- Every user-facing string goes through i18n: add to `packages/i18n/messages/en.json` first, then mirror to `sv.json`, `nb.json`, `da.json`, `fi.json` in the same task. Edit the JSON files with the Edit tool (never perl/sed: non-ASCII double-encodes). The parity test fails on any missing key.
- Help bodies (`dashboard.help.*Body`) are at most two sentences, max 200 characters in en and 240 in the other locales (`packages/i18n/src/messages.test.ts` enforces it).
- Tests run with `bun run test` (Vitest 4). Never `bun test`. Per package: `cd packages/constants && bun run test`, `cd packages/import && bun run test`, `cd packages/backend && bun run test`, `cd apps/dashboard && bun run test`, `cd packages/i18n && bun run test`. Backend typecheck: `cd packages/backend && bunx tsc --noEmit -p convex`. Dashboard typecheck: `cd apps/dashboard && bunx tsc --noEmit`.
- Biome ends every task at zero errors, warnings and infos: `bunx biome check <files>` from the repo root; fix, never ignore.
- The rename is the safety net: `payRecords.basicMonthly` is REMOVED in Task 2. From Task 2 until Task 5 lands, the backend typecheck is red in the modules not yet migrated (`payMapping/runs.ts`, `payMapping/gap.ts`, `payMapping/orgGap.ts`, `assistant/insights.ts`, `people/import.ts`, `people/importDiff.ts`, `people/importHelpers.ts`), and the dashboard typecheck is red until Task 8. Each task runs ITS OWN package tests for the files it touched and reports the remaining red modules by name; the reviewer checks the red set shrinks with every task and is empty after Task 8. Never add a compat shim or a temporary `basicMonthly` alias to get green early.
- Every state-changing mutation writes an audit row; a new payload field ships its `dashboard.auditLog.fields.*` label in all five locales (Task 7); a coded value (`basis`) ships its value labels (reused from `dashboard.people.salaryForm.basis.*`).
- A `HelpMorphButton` sits only after a title or a settings-row label (the settings form's currency and language rows already carry one after the label; the hours row follows that pattern).
- Money in the audit trail stays AMOUNT-FREE: `basicAmount` is never diffed, only `basis`.
- Commit rule (owner instruction, overrides the per-task commit habit): stage each task's files and present the diff; commit only after the owner approves, with the conventional message given in the task. No AI attribution in commits.
- After the last task: `cd apps/dashboard && bun run docs:sync`, a reset of the dev deployment (`cd packages/backend && bunx convex run seed:resetDatabase`), a push (`bunx convex dev --once`) and a browser pass on localhost:3001 before reporting done.

---

## File map

**Constants (`packages/constants/src/`)**
- Modify `pay.ts`: `BASE_PAY_BASES`, `BasePayBasis`, `normalizedMonthlyBase`, `fteTotalMonthlyComp` basis parameter, `PAY_PLAUSIBILITY_BY_CURRENCY`, `plausibilityFor`.
- Modify `pay.test.ts`.
- Modify `countries.ts`: `FULL_TIME_HOURS_BY_COUNTRY`, `defaultFullTimeHoursFor`.
- Modify `countries.test.ts` (create if absent).
- Modify `people.ts`: `FULL_TIME_HOURS_MAX`.
- Modify `index.ts`: exports.

**Backend (`packages/backend/convex/`)**
- Modify `people/tables.ts`: `payRecords.basis` + `basicAmount` (drop `basicMonthly`), `people.fullTimeHoursPerMonth`.
- Modify `accounts/tables.ts`: `organizations.fullTimeHoursPerMonth`.
- Modify `payMapping/tables.ts`: snapshot row `basis`, `basicAmount`, `hoursPerMonth`; run `fullTimeHoursDefault`.
- Create `people/fullTimeHours.ts`: `resolveFullTimeHours`, `readOrgPayDefaults`.
- Create `people/fullTimeHours.test.ts`.
- Modify `people/pay.ts`: `setSalary`, `appendSalaryCore`, `appendSalary`, `toPayRecordShape`, `getSalaryHistory`, `getCurrentSalary`, `getRolePayComparison`, new `getPayDefaults`.
- Modify `people/pay.test.ts`.
- Modify `people/people.ts`: `personShape`/`toPersonShape` + `updatePerson` gain `fullTimeHoursPerMonth`; `personImportOptionalArgs` gains it.
- Modify `people/people.test.ts`.
- Modify `people/schema.test.ts`.
- Modify `lib/audit.ts`: `PAY_AUDIT_FIELDS` + `basis`, `SETTINGS_AUDIT_FIELDS` + `fullTimeHoursPerMonth`, `PERSON_AUDIT_FIELDS` + `fullTimeHoursPerMonth` (structural).
- Modify `lib/auditPayloads.ts`: `people.imported.hourlyPay`.
- Modify `lib/audit.test.ts` (if it enumerates fields).
- Modify `accounts/organization.ts`: `getOrganizationSettings` + `updateOrganizationSettings` gain `fullTimeHoursPerMonth`.
- Modify `accounts/organization.test.ts` (or the file that tests settings).
- Modify `payMapping/runs.ts`: freeze writes raw + basis + hours + normalized; run default.
- Modify `payMapping/orgGap.ts`, `payMapping/gap.ts`, `assistant/insights.ts`: basis-aware comp.
- Modify `payMapping/runs.test.ts`, `payMapping/gap.test.ts`, `payMapping/orgGap.test.ts` (if present), `payMapping/analyses.test.ts`, `payMapping/actions.test.ts`, `payMapping/erasure.test.ts`, `payMapping/tables.test.ts`, `assistant/insights.test.ts`, `accounts/mirrors.test.ts`, `people/erase.test.ts`, `people/importProfile.test.ts`: fixture shape (`basicMonthly` -> `basis` + `basicAmount` on payRecords; snapshot rows gain the three fields; runs gain `fullTimeHoursDefault`).
- Modify `people/import.ts`: `interpretHourly`, row basis rule, notices, preview result, result `hourlyPay`.
- Modify `people/importDiff.ts`: `SalaryValues` (basis + basicAmount), `sameSalaryValues`, `changedDetails` from/to shape, `PersonImportValues.fullTimeHoursPerMonth`, `PERSON_IMPORT_OPTIONAL_FIELDS`.
- Modify `people/importHelpers.ts`: `getOrgPayDefaults` replaces `getOrgCurrency`, baseline `latestSalary` shape, `importChunk` row validator, `logImportCompleted.hourlyPay`.
- Modify `people/import.test.ts`, `people/importDiff.test.ts`.

**Import engine (`packages/import/`)**
- Modify `src/fields.ts`: `ValueShape` + `"number"`, `FieldDef.fixedBasis`, `hourlyRate`, `fullTimeHoursPerMonth`.
- Modify `src/parse.ts`: `parseNumber`.
- Modify `src/index.ts`: export `parseNumber`.
- Modify `src/fields.test.ts`, `src/parse.test.ts`, `src/detect.test.ts`.
- Create `fixtures/visma-sv-hourly.csv`; modify `src/pipeline.test.ts`.

**i18n (`packages/i18n/messages/`)**
- Modify `en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`.

**Dashboard (`apps/dashboard/`)**
- Modify `lib/audit-constants.ts`: `SALARY_BASIS_VALUE_KEYS` + the coded-domain map entry.
- Modify `lib/audit-detail.tsx`: `FIELD_DISPLAY_ORDER` (`basis`, `fullTimeHoursPerMonth`, `hourlyPay`).
- Modify `lib/audit-labels.test.ts`: `OTHER_AUDIT_FIELDS` + `hourlyPay`.
- Modify `components/pay-mapping/pay-mapping-gap-types.ts` (+ test): `PayMappingSnapshotRow.basis/basicAmount/hoursPerMonth`, basis-aware helpers, `PayMappingRunDetail.fullTimeHoursDefault`.
- Modify `components/people/import/map-step.tsx` (+ test): no basis select on `fixedBasis` fields.
- Modify `components/people/import/review-step.tsx` (+ test): the hourly group, checkbox, notices, basis-aware `salaryChanged`.
- Modify `components/people/import/import-done-step.tsx` (+ test), `import-wizard.tsx`: `hourlyPay` count.
- Modify `components/people/add-salary-dialog.tsx` (+ test): basis select, amount label, derived line.
- Modify `components/people/person-detail.tsx` (+ test): basis-aware base figure, own hours.
- Modify `components/people/edit-person-dialog.tsx` (+ test), `person-actions-menu.tsx`, `person-detail.tsx`: `fullTimeHoursPerMonth` field.
- Modify `components/organization/organization-profile-form.tsx` (+ test), `lib/organization-schemas.ts`, `app/(app)/organization/general/page.tsx`: hours field.
- Modify `components/pay-mapping/group-member-table.tsx` (+ test): "Hourly" chip.
- Modify `components/pay-mapping/pay-mapping-report-data.ts` (+ test), `pay-mapping-report-doc.tsx`, `pay-mapping-report-export.tsx`: `hourlyNote`.
- Modify `lib/pay-unit.ts` (create) + test: `formatBasePay`.

**Docs**
- Create `docs/adr/0029-timlon-en-analysbas-heltidstimmar.md`.
- Modify `apps/dashboard/content/docs/<locale>/{importing-people,supported-payroll-exports,person-details-and-salary,organization-settings,pay-mapping-overview,troubleshooting-people-and-import,glossary}.mdx` in all five locales.
- Modify `docs/lonekartlaggning-rapport-kravbild.md` (the line-72 gap note).

---

### Task 1: Constants: bases, normalization, plausibility, country hours

**Files:**
- Modify: `packages/constants/src/pay.ts`
- Modify: `packages/constants/src/pay.test.ts`
- Modify: `packages/constants/src/countries.ts`
- Create: `packages/constants/src/countries.test.ts` (if a test file for countries does not exist; otherwise modify it)
- Modify: `packages/constants/src/people.ts`
- Modify: `packages/constants/src/index.ts`

**Interfaces:**
- Produces: `BASE_PAY_BASES`, `BasePayBasis`, `normalizedMonthlyBase(amount, basis, hoursPerMonth)`, `fteTotalMonthlyComp(basicMonthly, components, ftePercent, basis)` (FOURTH PARAMETER REQUIRED), `PAY_PLAUSIBILITY_BY_CURRENCY`, `plausibilityFor(currency)`, `FULL_TIME_HOURS_BY_COUNTRY`, `defaultFullTimeHoursFor(country)`, `FULL_TIME_HOURS_MAX`.
- Consumers: every later task. Changing `fteTotalMonthlyComp`'s arity breaks its five callers (`people/pay.ts`, `payMapping/gap.ts`, `payMapping/orgGap.ts`, `assistant/insights.ts` indirectly, `apps/dashboard/.../pay-mapping-gap-types.ts`); they are migrated in Tasks 2, 3 and 8. Do NOT touch them here.

- [ ] **Step 1: Write the failing tests**

Append to `packages/constants/src/pay.test.ts` (extend the existing import line with the new names):

```ts
import {
  BASE_PAY_BASES,
  DEFAULT_BASIS_BY_FIELD,
  PAY_BASIS,
  PAY_COMPONENT_KINDS,
  PAY_PLAUSIBILITY_BY_CURRENCY,
  fteTotalMonthlyComp,
  normalizedMonthlyBase,
  plausibilityFor,
  toMonthly,
  totalMonthlyComp,
} from "./pay"

describe("BASE_PAY_BASES", () => {
  it("is exactly monthly and hourly, in that order", () => {
    expect(BASE_PAY_BASES).toEqual(["monthly", "hourly"])
  })
})

describe("normalizedMonthlyBase", () => {
  it("returns a monthly amount unchanged whatever the hours", () => {
    expect(normalizedMonthlyBase(32000, "monthly", 165)).toBe(32000)
    expect(normalizedMonthlyBase(32000, "monthly", 173.33)).toBe(32000)
  })

  it("multiplies an hourly rate by the full-time hours", () => {
    expect(normalizedMonthlyBase(195, "hourly", 165)).toBe(32175)
    expect(normalizedMonthlyBase(200, "hourly", 162.5)).toBe(32500)
  })

  it("throws on non-positive hours (the resolver guarantees a positive value)", () => {
    expect(() => normalizedMonthlyBase(195, "hourly", 0)).toThrow()
    expect(() => normalizedMonthlyBase(195, "hourly", -1)).toThrow()
  })
})

describe("fteTotalMonthlyComp with a basis", () => {
  it("still grosses a monthly row up by its FTE share", () => {
    expect(fteTotalMonthlyComp(40000, [], 80, "monthly")).toBe(50000)
  })

  it("never divides an hourly row by its FTE share (rate x hours is already full time)", () => {
    expect(fteTotalMonthlyComp(32175, [], 50, "hourly")).toBe(32175)
    expect(
      fteTotalMonthlyComp(32175, [{ monthlyAmount: 1000 }], 50, "hourly")
    ).toBe(33175)
  })
})

describe("plausibilityFor", () => {
  it("returns the krona bounds for SEK, NOK and DKK and the euro bounds for EUR", () => {
    expect(plausibilityFor("SEK")).toEqual({ hourlyMax: 1500, monthlyMin: 3000 })
    expect(plausibilityFor("NOK")).toEqual({ hourlyMax: 1500, monthlyMin: 3000 })
    expect(plausibilityFor("DKK")).toEqual({ hourlyMax: 1500, monthlyMin: 3000 })
    expect(plausibilityFor("EUR")).toEqual({ hourlyMax: 150, monthlyMin: 300 })
  })

  it("returns undefined for a currency it has no bounds for", () => {
    expect(plausibilityFor("USD")).toBeUndefined()
    expect(plausibilityFor("")).toBeUndefined()
  })

  it("covers every CURRENCY_KEYS value", () => {
    expect(Object.keys(PAY_PLAUSIBILITY_BY_CURRENCY).sort()).toEqual(
      ["DKK", "EUR", "NOK", "SEK"]
    )
  })
})
```

Create or extend `packages/constants/src/countries.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  COUNTRY_KEYS,
  FULL_TIME_HOURS_BY_COUNTRY,
  defaultFullTimeHoursFor,
} from "./countries"

describe("defaultFullTimeHoursFor", () => {
  it("returns each country's customary full-time divisor", () => {
    expect(defaultFullTimeHoursFor("se")).toBe(165)
    expect(defaultFullTimeHoursFor("no")).toBe(162.5)
    expect(defaultFullTimeHoursFor("dk")).toBe(160.33)
    expect(defaultFullTimeHoursFor("fi")).toBe(162.5)
    expect(defaultFullTimeHoursFor("other")).toBe(173.33)
  })

  it("clamps an unknown or missing country to the 'other' figure", () => {
    expect(defaultFullTimeHoursFor(undefined)).toBe(173.33)
    expect(defaultFullTimeHoursFor("xx")).toBe(173.33)
  })

  it("has a positive figure for every country key", () => {
    for (const key of COUNTRY_KEYS) {
      expect(FULL_TIME_HOURS_BY_COUNTRY[key]).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/constants && bun run test`
Expected: FAIL (the new exports do not exist; `fteTotalMonthlyComp` ignores a fourth argument).

- [ ] **Step 3: Implement the constants**

In `packages/constants/src/pay.ts`, replace `fteTotalMonthlyComp` and add the new exports (keep `totalMonthlyComp`, `PAY_BASIS`, `toMonthly`, `DEFAULT_BASIS_BY_FIELD` unchanged):

```ts
import type { CurrencyKey } from "./countries"

// The basis a base-pay figure is recorded in. A pay record stores the figure
// as entered or imported (a monthly salary or an hourly rate) together with
// its basis; the monthly figure the analysis reads is DERIVED, never stored
// (except frozen into a run's snapshot). "annual" is deliberately absent: an
// annual column is converted at import time (PAY_BASIS / toMonthly below) and
// lands as a monthly record.
export const BASE_PAY_BASES = ["monthly", "hourly"] as const
export type BasePayBasis = (typeof BASE_PAY_BASES)[number]

// Pure helper: a base-pay figure as a full-time-equivalent MONTHLY amount. An
// hourly rate times the full-time hours per month is what the person would
// earn in a full-time month; a monthly figure is already that. Throws on
// non-positive hours: every caller resolves hours through the backend's
// resolveFullTimeHours, which always yields a positive value, so a zero here
// is a programming error, not data.
export function normalizedMonthlyBase(
  amount: number,
  basis: BasePayBasis,
  hoursPerMonth: number
): number {
  if (basis === "monthly") return amount
  if (!(hoursPerMonth > 0)) {
    throw new Error("normalizedMonthlyBase: hoursPerMonth must be positive")
  }
  return amount * hoursPerMonth
}

// Pure helper: FTE-adjusted total monthly comp. Grosses a part-time person's
// compensation up to its full-time equivalent so pay-gap comparisons are like
// for like (EU Pay Transparency Directive). ftePercent is a percentage
// (100 = full time). A missing, zero, or non-positive ftePercent is treated as
// 100 (no adjustment), so this never divides by zero.
//
// The basis is REQUIRED: an hourly row's basicMonthly is rate x full-time
// hours, already a full-time figure, so dividing it by an FTE share again
// would double-count. Hourly rows return the plain sum, components included
// (one rule per row, stated in the report's method note).
export function fteTotalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>,
  ftePercent: number | undefined,
  basis: BasePayBasis
): number {
  const total = totalMonthlyComp(basicMonthly, components)
  if (basis === "hourly") return total
  const fraction =
    ftePercent !== undefined && ftePercent > 0 ? ftePercent / 100 : 1
  return total / fraction
}

// Soft plausibility bounds for the import's review-step notices, per org
// currency: an hourly-basis amount above hourlyMax looks like a monthly
// salary, a monthly-basis amount below monthlyMin looks like an hourly rate.
// Notices only, never a skip: a part-time salary can be low and a specialist
// rate can be high. Krona currencies share one scale; the euro is about a
// tenth of it.
export const PAY_PLAUSIBILITY_BY_CURRENCY: Record<
  CurrencyKey,
  { hourlyMax: number; monthlyMin: number }
> = {
  SEK: { hourlyMax: 1500, monthlyMin: 3000 },
  NOK: { hourlyMax: 1500, monthlyMin: 3000 },
  DKK: { hourlyMax: 1500, monthlyMin: 3000 },
  EUR: { hourlyMax: 150, monthlyMin: 300 },
}

// The bounds for a currency, or undefined when the currency has none (then no
// notice is raised: an unknown currency has no scale to judge against).
export function plausibilityFor(
  currency: string
): { hourlyMax: number; monthlyMin: number } | undefined {
  return (
    PAY_PLAUSIBILITY_BY_CURRENCY as Record<
      string,
      { hourlyMax: number; monthlyMin: number } | undefined
    >
  )[currency]
}
```

In `packages/constants/src/countries.ts`, after `defaultLanguageFor`:

```ts
// The monthly hours that count as full time, per country: the customary
// collective-agreement divisor for the standard full-time week (SE 40 h with
// the 165 divisor most Swedish agreements use, NO 37.5 h, DK 37 h, FI 37.5 h,
// other 40 h x 52 / 12). Seeds the organization's default (editable in
// settings) and is the last fallback when neither the person nor the
// organization carries a value, so an hourly rate can always be converted.
export const FULL_TIME_HOURS_BY_COUNTRY = {
  se: 165,
  no: 162.5,
  dk: 160.33,
  fi: 162.5,
  other: 173.33,
} as const satisfies Record<CountryKey, number>

export function defaultFullTimeHoursFor(country: string | undefined): number {
  return FULL_TIME_HOURS_BY_COUNTRY[clampCountry(country)]
}
```

In `packages/constants/src/people.ts`, append:

```ts
// Validation ceiling for a full-time-hours-per-month figure (person override
// or organization default). Shared by the Zod form schemas and the Convex
// validators so the two gates can never disagree. A month has ~730 hours; a
// full-time figure past 400 is a typo (a weekly figure, an annual one).
export const FULL_TIME_HOURS_MAX = 400
```

In `packages/constants/src/index.ts`, extend the `./countries` export with `FULL_TIME_HOURS_BY_COUNTRY` and `defaultFullTimeHoursFor`, the `./people` export with `FULL_TIME_HOURS_MAX`, and the `./pay` export with `BASE_PAY_BASES`, `type BasePayBasis`, `PAY_PLAUSIBILITY_BY_CURRENCY`, `normalizedMonthlyBase`, `plausibilityFor`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/constants && bun run test`
Expected: PASS. Then `bunx biome check packages/constants/src` from the repo root: zero diagnostics. `cd packages/constants && bunx tsc --noEmit` (or the package's typecheck script): green.

- [ ] **Step 5: Present the diff (no commit)**

Stage `packages/constants/src/{pay.ts,pay.test.ts,countries.ts,countries.test.ts,people.ts,index.ts}` and report. Proposed message when approved: `feat(constants): base-pay bases, hourly normalization and per-country full-time hours`.

---
### Task 2: Backend schema, full-time-hours resolver, audit field sets, pay module

**Files:**
- Modify: `packages/backend/convex/people/tables.ts`
- Modify: `packages/backend/convex/accounts/tables.ts`
- Modify: `packages/backend/convex/payMapping/tables.ts`
- Create: `packages/backend/convex/people/fullTimeHours.ts`
- Create: `packages/backend/convex/people/fullTimeHours.test.ts`
- Modify: `packages/backend/convex/lib/audit.ts`
- Modify: `packages/backend/convex/lib/auditPayloads.ts`
- Modify: `packages/backend/convex/people/pay.ts`
- Modify: `packages/backend/convex/people/pay.test.ts`
- Modify: `packages/backend/convex/people/schema.test.ts`
- Modify: `packages/backend/convex/people/importDiff.ts` (ONLY `SalaryValues` and `sameSalaryValues`, which `appendSalaryCore` imports; the diff logic itself is Task 6)

**Interfaces:**
- Consumes (Task 1): `BASE_PAY_BASES`, `BasePayBasis`, `normalizedMonthlyBase`, `fteTotalMonthlyComp(…, basis)`, `defaultFullTimeHoursFor`, `FULL_TIME_HOURS_MAX`.
- Produces: `basePayBasis` validator (exported from `people/tables.ts`); `resolveFullTimeHours(person, org)`, `readOrgPayDefaults(ctx, orgId)`, `FullTimeHoursSource` (`people/fullTimeHours.ts`); `payRecords.{basis,basicAmount}`; `people.fullTimeHoursPerMonth`; `organizations.fullTimeHoursPerMonth`; snapshot row `{basis,basicAmount,hoursPerMonth}`; run `fullTimeHoursDefault`; `setSalary`/`appendSalaryCore`/`appendSalary` args `{ basis, basicAmount }`; `getSalaryHistory`/`getCurrentSalary` rows carry `basis`, `basicAmount`, `basicMonthly` (derived), `hoursPerMonth`, `hoursSource`, `totalMonthlyComp`; new `getPayDefaults({ personId })`; `PAY_AUDIT_FIELDS` includes `"basis"`, `SETTINGS_AUDIT_FIELDS` includes `"fullTimeHoursPerMonth"`, `PERSON_AUDIT_FIELDS` includes `"fullTimeHoursPerMonth"` (structural); `AuditPayloads["people.imported"].hourlyPay`.
- After this task the backend typecheck is red in: `payMapping/runs.ts`, `payMapping/gap.ts`, `payMapping/orgGap.ts`, `assistant/insights.ts`, `people/import.ts`, `people/importHelpers.ts`, `people/importDiff.ts` (diff part), `people/people.ts` (personAuditFields if it enumerates fields), and their tests. Tasks 3, 4 and 6 clear them. Report the exact red list.

- [ ] **Step 1: Schema**

`packages/backend/convex/people/tables.ts`:

```ts
// The basis a base-pay figure is recorded in (mirrors @workspace/constants
// BASE_PAY_BASES). Exported so pay.ts, the import chunk validator and the
// pay-mapping snapshot table share one validator.
export const basePayBasis = v.union(v.literal("monthly"), v.literal("hourly"))
```

In `people`, after `ftePercent`:

```ts
  // The monthly hours that count as full time for THIS person, when their
  // agreement differs from the organization's default (resolveFullTimeHours
  // in people/fullTimeHours.ts: person, then organization, then the country
  // default). Positive, decimals allowed, at most FULL_TIME_HOURS_MAX.
  fullTimeHoursPerMonth: v.optional(v.number()),
```

In `payRecords`, replace the `basicMonthly` field and its comment with:

```ts
  // The base-pay figure AS RECORDED (a monthly salary or an hourly rate) and
  // its basis. This is the Art. 9 basic-salary component, distinct from the
  // variable/bonus/benefit components. The full-time-equivalent monthly
  // figure the analysis reads is derived on read (normalizedMonthlyBase with
  // the person's resolved full-time hours) and stored only inside a run's
  // frozen snapshot (ADR-0011, ADR-0029).
  basis: basePayBasis,
  basicAmount: v.number(),
```

Update the table's leading comment ("Total compensation ... derived as basicMonthly + ...") to say `normalizedMonthlyBase(basicAmount, basis, hours) + sum(components[*].monthlyAmount)`.

`packages/backend/convex/accounts/tables.ts`, in `organizations` after `industry`:

```ts
  // The organization's default monthly hours that count as full time, used
  // to turn hourly pay into a monthly figure for everyone without a value of
  // their own. Unset means the country default (defaultFullTimeHoursFor).
  fullTimeHoursPerMonth: v.optional(v.number()),
```

`packages/backend/convex/payMapping/tables.ts`: import `basePayBasis` from `../people/tables`. In `payMappingRuns` after `referenceDate`:

```ts
  // The organization's resolved full-time hours per month at freeze time,
  // for the report's method note. Rows carry the hours actually used per
  // person (hoursPerMonth), which differ from this only for people with a
  // value of their own.
  fullTimeHoursDefault: v.number(),
```

In `payMappingSnapshotRows`, after `basicMonthly` (whose comment now reads "the NORMALIZED full-time-equivalent monthly base the engine reads; null when the person had no pay at the freeze"):

```ts
  // The frozen raw figure, its basis and the full-time hours used to derive
  // basicMonthly. All three present exactly when basicMonthly is non-null,
  // so a run stays evidence when the organization's default changes later.
  basis: v.optional(basePayBasis),
  basicAmount: v.optional(v.number()),
  hoursPerMonth: v.optional(v.number()),
```

- [ ] **Step 2: Write the resolver's failing test**

`packages/backend/convex/people/fullTimeHours.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { resolveFullTimeHours } from "./fullTimeHours"

describe("resolveFullTimeHours", () => {
  it("prefers the person's own value", () => {
    expect(
      resolveFullTimeHours(
        { fullTimeHoursPerMonth: 150 },
        { fullTimeHoursPerMonth: 160, country: "se" }
      )
    ).toEqual({ hoursPerMonth: 150, source: "person" })
  })

  it("falls back to the organization's default", () => {
    expect(
      resolveFullTimeHours({}, { fullTimeHoursPerMonth: 160, country: "se" })
    ).toEqual({ hoursPerMonth: 160, source: "organization" })
  })

  it("falls back to the country default, and to 'other' for an unknown country", () => {
    expect(resolveFullTimeHours({}, { country: "se" })).toEqual({
      hoursPerMonth: 165,
      source: "country",
    })
    expect(resolveFullTimeHours({}, {})).toEqual({
      hoursPerMonth: 173.33,
      source: "country",
    })
  })

  it("treats a non-positive stored value as absent", () => {
    expect(
      resolveFullTimeHours({ fullTimeHoursPerMonth: 0 }, { country: "no" })
    ).toEqual({ hoursPerMonth: 162.5, source: "country" })
  })
})
```

- [ ] **Step 3: Implement the resolver**

`packages/backend/convex/people/fullTimeHours.ts`:

```ts
import { defaultFullTimeHoursFor } from "@workspace/constants"
import type { QueryCtx } from "../_generated/server"

// Where a person's full-time hours came from; surfaces show it so HR can
// tell an agreement-specific value from the organization's default.
export type FullTimeHoursSource = "person" | "organization" | "country"

// The organization-level pay defaults every org-scaled read needs at once
// (the import's currency fallback, the freeze's hours, the salary queries).
export interface OrgPayDefaults {
  currency: string
  country: string | undefined
  fullTimeHoursPerMonth: number | undefined
}

// The full-time hours per month used to turn an hourly rate into a monthly
// figure: the person's own value, else the organization's default, else the
// country default. Always positive, so normalizedMonthlyBase never throws on
// a resolved value. ONE resolution rule for the salary queries, the freeze,
// the import preview and the assistant; none of them reads the fields
// directly.
export function resolveFullTimeHours(
  person: { fullTimeHoursPerMonth?: number },
  org: { fullTimeHoursPerMonth?: number; country?: string }
): { hoursPerMonth: number; source: FullTimeHoursSource } {
  if (
    person.fullTimeHoursPerMonth !== undefined &&
    person.fullTimeHoursPerMonth > 0
  ) {
    return { hoursPerMonth: person.fullTimeHoursPerMonth, source: "person" }
  }
  if (org.fullTimeHoursPerMonth !== undefined && org.fullTimeHoursPerMonth > 0) {
    return {
      hoursPerMonth: org.fullTimeHoursPerMonth,
      source: "organization",
    }
  }
  return {
    hoursPerMonth: defaultFullTimeHoursFor(org.country),
    source: "country",
  }
}

// One read of the organization row. Callers that loop over people fetch
// this once outside the loop. "SEK" is the currency fallback the import has
// always used for an org without one set.
export async function readOrgPayDefaults(
  ctx: QueryCtx,
  orgId: string
): Promise<OrgPayDefaults> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  return {
    currency: org?.currency ?? "SEK",
    country: org?.country,
    fullTimeHoursPerMonth: org?.fullTimeHoursPerMonth,
  }
}
```

- [ ] **Step 4: Audit field sets and the imported payload**

`packages/backend/convex/lib/audit.ts`:
- `PAY_AUDIT_FIELDS = ["payYear", "source", "currency", "basis"] as const` and extend its comment: "`basis` is the coded monthly/hourly basis; the amount itself is never diffed".
- `SETTINGS_AUDIT_FIELDS`: add `"fullTimeHoursPerMonth"` after `"industry"`.
- `PERSON_AUDIT_FIELDS`: add `"fullTimeHoursPerMonth"` right after `"ftePercent"`; in `PERSON_AUDIT_FIELD_KIND` add `fullTimeHoursPerMonth: "structural",` (the compile-time-total Record fails until you do).

`packages/backend/convex/lib/auditPayloads.ts`, in `"people.imported"` after `peopleReactivated`:

```ts
    // Rows written with the hourly basis (from a dedicated column or by the
    // pay-form interpretation). Count only.
    hourlyPay: number
```

If `lib/audit.test.ts` enumerates `PAY_AUDIT_FIELDS` or the settings fields literally, update the expectation.

- [ ] **Step 5: `SalaryValues` in importDiff.ts (the part pay.ts imports)**

```ts
export interface SalaryValues {
  payYear: number
  basis: BasePayBasis
  basicAmount: number
  currency: string
  components: Array<{ kind: string; monthlyAmount: number }>
}

export function sameSalaryValues(a: SalaryValues, b: SalaryValues): boolean {
  return (
    a.payYear === b.payYear &&
    a.basis === b.basis &&
    a.basicAmount === b.basicAmount &&
    a.currency === b.currency &&
    a.components.length === b.components.length &&
    a.components.every(
      (c, i) =>
        c.kind === b.components[i]?.kind &&
        c.monthlyAmount === b.components[i]?.monthlyAmount
    )
  )
}
```

Import `type BasePayBasis` from `@workspace/constants`. Leave the rest of the file for Task 6 (it will not typecheck until then; that is expected).

- [ ] **Step 6: Update the pay tests to the new contract and add the hourly cases**

In `packages/backend/convex/people/pay.test.ts`: every `setSalary` / `appendSalary` call replaces `basicMonthly: N` with `basis: "monthly", basicAmount: N`; every `row?.basicMonthly` expectation on a STORED doc becomes `row?.basicAmount` plus `expect(row?.basis).toBe("monthly")`; expectations on `getSalaryHistory`/`getCurrentSalary` results keep `basicMonthly` (derived) and gain nothing else unless asserted. The amount-free audit test additionally asserts `expect(payload?.basicAmount).toBeUndefined()` and that `changes.basis.to` is `"monthly"`. Add:

```ts
describe("hourly pay", () => {
  it("derives the monthly figure from the org's country default when nothing else is set", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t) // country se -> 165 h
    const personId = await seedPerson(orgId, asAdmin)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basis: "hourly",
      basicAmount: 195,
      currency: "SEK",
      components: [],
    })
    const history = await asAdmin.query(api.people.pay.getSalaryHistory, {
      orgId,
      personId,
    })
    expect(history[0]).toMatchObject({
      basis: "hourly",
      basicAmount: 195,
      basicMonthly: 32175,
      totalMonthlyComp: 32175,
      hoursPerMonth: 165,
      hoursSource: "country",
    })
  })

  it("uses the organization default over the country, and the person's value over both", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId, personId, payYear: 2026, basis: "hourly", basicAmount: 200, currency: "SEK", components: [],
    })
    await t.run(async (ctx) => {
      const org = await ctx.db.query("organizations").withIndex("by_org", (q) => q.eq("orgId", orgId)).unique()
      if (org) await ctx.db.patch(org._id, { fullTimeHoursPerMonth: 160 })
    })
    let current = await asAdmin.query(api.people.pay.getCurrentSalary, { orgId, personId, asOf: Date.now() + 1000 })
    expect(current).toMatchObject({ basicMonthly: 32000, hoursPerMonth: 160, hoursSource: "organization" })

    await t.run(async (ctx) => { await ctx.db.patch(personId, { fullTimeHoursPerMonth: 150 }) })
    current = await asAdmin.query(api.people.pay.getCurrentSalary, { orgId, personId, asOf: Date.now() + 1000 })
    expect(current).toMatchObject({ basicMonthly: 30000, hoursPerMonth: 150, hoursSource: "person" })
  })

  it("rejects a negative amount and an unknown basis at the validator", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await expect(
      asAdmin.mutation(api.people.pay.setSalary, {
        orgId, personId, payYear: 2026, basis: "hourly", basicAmount: -1, currency: "SEK", components: [],
      })
    ).rejects.toThrow()
  })

  it("getPayDefaults names the currency, the hours and their source", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    expect(
      await asAdmin.query(api.people.pay.getPayDefaults, { orgId, personId })
    ).toEqual({ currency: "SEK", hoursPerMonth: 165, hoursSource: "country" })
  })

  it("a basis change with the same figure is a real new record, not a duplicate", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, userId } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const first = await t.mutation(internal.people.pay.appendSalary, {
      orgId, actorId: userId, personId, payYear: 2026, basis: "monthly", basicAmount: 195, currency: "SEK", components: [],
    })
    const second = await t.mutation(internal.people.pay.appendSalary, {
      orgId, actorId: userId, personId, payYear: 2026, basis: "hourly", basicAmount: 195, currency: "SEK", components: [],
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(true)
  })
})
```

In the `getRolePayComparison` tests, add one case: the viewed person hourly (rate 195, ftePercent 50) beside a monthly peer (40000, ftePercent 80): the hourly point's `amount` is 32175 (no FTE division) and the peer's is 50000.

Update `packages/backend/convex/people/schema.test.ts` (round-trips a payRecord): the inserted doc carries `basis: "monthly", basicAmount: …` instead of `basicMonthly`.

- [ ] **Step 7: Run the tests to verify the new ones fail**

Run: `cd packages/backend && bunx vitest run convex/people/pay.test.ts convex/people/fullTimeHours.test.ts convex/people/schema.test.ts`
Expected: the resolver test passes already (Step 3); the pay tests FAIL (args rejected, derived fields missing).

- [ ] **Step 8: Migrate `people/pay.ts`**

Imports: add `normalizedMonthlyBase` from `@workspace/constants`, `basePayBasis` from `./tables`, `readOrgPayDefaults`, `resolveFullTimeHours`, `type FullTimeHoursSource` and `type OrgPayDefaults` from `./fullTimeHours`.

`payRecordFields`:

```ts
const payRecordFields = {
  payRecordId: v.id("payRecords"),
  personId: v.id("people"),
  payYear: v.number(),
  source: v.union(v.literal("import"), v.literal("manual")),
  // The figure as recorded and its basis.
  basis: basePayBasis,
  basicAmount: v.number(),
  // Derived: the full-time-equivalent monthly base (normalizedMonthlyBase
  // with the person's resolved full-time hours). Computed on read, never
  // stored, so a corrected hours default reaches every record at once.
  basicMonthly: v.number(),
  hoursPerMonth: v.number(),
  hoursSource: v.union(
    v.literal("person"),
    v.literal("organization"),
    v.literal("country")
  ),
  currency: v.string(),
  components: v.array(payComponentValidator),
  // Derived: basicMonthly + sum(components[*].monthlyAmount).
  totalMonthlyComp: v.number(),
  effectiveAt: v.number(),
  createdAt: v.number(),
}
```

```ts
function toPayRecordShape(
  doc: Doc<"payRecords">,
  hours: { hoursPerMonth: number; source: FullTimeHoursSource }
) {
  const basicMonthly = normalizedMonthlyBase(
    doc.basicAmount,
    doc.basis,
    hours.hoursPerMonth
  )
  return {
    payRecordId: doc._id,
    personId: doc.personId,
    payYear: doc.payYear,
    source: doc.source,
    basis: doc.basis,
    basicAmount: doc.basicAmount,
    basicMonthly,
    hoursPerMonth: hours.hoursPerMonth,
    hoursSource: hours.source,
    currency: doc.currency,
    components: doc.components,
    totalMonthlyComp: totalMonthlyComp(basicMonthly, doc.components),
    effectiveAt: doc.effectiveAt,
    createdAt: doc.createdAt,
  }
}
```

`setSalary`: args `basis: basePayBasis, basicAmount: v.number()` replace `basicMonthly`; the guard checks `args.basicAmount < 0`; the insert writes `basis`, `basicAmount`; the audit snapshot gains `basis: args.basis` (still no amount). `appendSalaryCore` and `appendSalary` mirror it (args, guard, insert, snapshot). `deleteSalary`'s snapshot gains `basis: record.basis` and its null diff gains `basis: null`.

`getSalaryHistory` and `getCurrentSalary`: after the person check, `const org = await readOrgPayDefaults(ctx, ctx.orgId)` and `const hours = resolveFullTimeHours(person, org)`; map with `toPayRecordShape(row, hours)`.

New query:

```ts
// What the salary dialog needs before a figure is typed: the currency the
// amount is in and the full-time hours the derived monthly line multiplies
// an hourly rate by, with where those hours came from.
export const getPayDefaults = orgQuery({
  args: { personId: v.id("people") },
  returns: v.object({
    currency: v.string(),
    hoursPerMonth: v.number(),
    hoursSource: v.union(
      v.literal("person"),
      v.literal("organization"),
      v.literal("country")
    ),
  }),
  handler: async (ctx, { personId }) => {
    const person = await requireOwnPerson(ctx, personId)
    const org = await readOrgPayDefaults(ctx, ctx.orgId)
    const hours = resolveFullTimeHours(person, org)
    return {
      currency: org.currency,
      hoursPerMonth: hours.hoursPerMonth,
      hoursSource: hours.source,
    }
  },
})
```

`comparisonPoint(person, record, seniority, isSelf, org: OrgPayDefaults)`:

```ts
  const { hoursPerMonth } = resolveFullTimeHours(person, org)
  const basicMonthly = normalizedMonthlyBase(
    record.basicAmount,
    record.basis,
    hoursPerMonth
  )
  const amount = Math.round(
    fteTotalMonthlyComp(
      basicMonthly,
      record.components,
      person.ftePercent,
      record.basis
    )
  )
  const basic = Math.round(
    fteTotalMonthlyComp(basicMonthly, [], person.ftePercent, record.basis)
  )
```

`getRolePayComparison` reads `const org = await readOrgPayDefaults(ctx, ctx.orgId)` once after the person check and passes it to every `comparisonPoint` call.

- [ ] **Step 9: Run the tests**

Run: `cd packages/backend && bunx vitest run convex/people/pay.test.ts convex/people/fullTimeHours.test.ts convex/people/schema.test.ts convex/lib/audit.test.ts`
Expected: PASS. `bunx biome check packages/backend/convex/people packages/backend/convex/lib packages/backend/convex/accounts/tables.ts packages/backend/convex/payMapping/tables.ts`: zero diagnostics. `cd packages/backend && bunx tsc --noEmit -p convex`: red ONLY in the modules listed under Interfaces; list them in the report.

- [ ] **Step 10: Present the diff (no commit)**

Proposed message when approved: `feat(people)!: record base pay with its basis and derive the monthly figure on read`.

---
### Task 3: Freeze, gap engine, org gap and assistant insights on the basis

**Files:**
- Modify: `packages/backend/convex/payMapping/orgGap.ts`
- Modify: `packages/backend/convex/payMapping/gap.ts`
- Modify: `packages/backend/convex/payMapping/runs.ts`
- Modify: `packages/backend/convex/assistant/insights.ts`
- Modify: `packages/backend/convex/payMapping/runs.test.ts`, `gap.test.ts`, `analyses.test.ts`, `actions.test.ts`, `erasure.test.ts`, `tables.test.ts`, `orgGap.test.ts` (if present), `assistant/insights.test.ts`, `accounts/mirrors.test.ts`, `people/erase.test.ts`, `people/importProfile.test.ts` (fixture shapes only)

**Interfaces:**
- Consumes (Task 2): `readOrgPayDefaults`, `resolveFullTimeHours`, `normalizedMonthlyBase`, snapshot row fields, `fullTimeHoursDefault`.
- Produces: `PricedRow.basis?: BasePayBasis` (`orgGap.ts`); `tccComp`/`baseComp` basis-aware; the run detail wire carries `fullTimeHoursDefault` and each row's `basis`, `basicAmount`, `hoursPerMonth`. Task 8 mirrors the row type on the dashboard.

- [ ] **Step 1: Failing tests**

In `gap.test.ts`'s seeding helper, rows accept an optional `basis` and `basicAmount`; the inserted snapshot row spreads `...(r.basicMonthly !== null ? { basis: r.basis ?? "monthly", basicAmount: r.basicAmount ?? r.basicMonthly, hoursPerMonth: 165 } : {})` and the run insert gains `fullTimeHoursDefault: 165`. Add:

```ts
  it("compares an hourly row on rate x hours, never divided by its FTE share", async () => {
    const { orgId, runId, asHr } = await seedRun(t, [
      // Women hourly: 195 kr/h x 165 h = 32 175, frozen as basicMonthly.
      { gender: "Kvinna", roleTitle: "Cashier", seniority: "IC1", level: 3, basicMonthly: 32175, basis: "hourly", basicAmount: 195, ftePercent: 50 },
      { gender: "Kvinna", roleTitle: "Cashier", seniority: "IC1", level: 3, basicMonthly: 32175, basis: "hourly", basicAmount: 195, ftePercent: 50 },
      // Men monthly at 80 %: 32 000 / 0.8 = 40 000.
      { gender: "Man", roleTitle: "Cashier", seniority: "IC1", level: 3, basicMonthly: 32000, ftePercent: 80 },
      { gender: "Man", roleTitle: "Cashier", seniority: "IC1", level: 3, basicMonthly: 32000, ftePercent: 80 },
    ])
    const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, { orgId, runId })
    const group = gap.equalWork.find((g) => g.roleTitle === "Cashier")
    expect(group?.tcc.womenMean).toBe(32175)
    expect(group?.tcc.menMean).toBe(40000)
  })
```

(Adjust the field path to the wire shape `getPayMappingGap` returns; the existing tests show it.)

In `runs.test.ts`, add a freeze test: seed an org (country "se"), one hourly-paid woman (`setSalary` with `basis: "hourly", basicAmount: 195`) with `fullTimeHoursPerMonth: 150` on the person, one monthly man, both classified; start a run; assert the woman's snapshot row has `basis: "hourly"`, `basicAmount: 195`, `hoursPerMonth: 150`, `basicMonthly: 29250`, the man's row has `basis: "monthly"`, `hoursPerMonth: 165`, and the run has `fullTimeHoursDefault: 165`; and that `withPayCount` is 2.

In `assistant/insights.test.ts`, seed one hourly record and assert the pay stat reads the normalized figure (rate x org hours), not the rate.

Every other listed test file: mechanical fixture update (payRecords inserts use `basis` + `basicAmount`; snapshot rows and runs gain the new fields as above). `tables.test.ts` round-trips the new fields.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd packages/backend && bunx vitest run convex/payMapping convex/assistant/insights.test.ts`
Expected: FAIL (freeze writes no basis; engine divides hourly rows by FTE).

- [ ] **Step 3: Implement**

`orgGap.ts`:

```ts
import { type BasePayBasis, fteTotalMonthlyComp } from "@workspace/constants"

export interface PricedRow {
  gender: "Man" | "Kvinna"
  basicMonthly: number | null
  components: { kind: string; monthlyAmount: number }[]
  ftePercent?: number
  // Absent only on a row without pay (basicMonthly null), which contributes
  // nothing; a priced row always carries its basis from the freeze.
  basis?: BasePayBasis
}

export function tccComp(row: PricedRow): number {
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    row.components,
    row.ftePercent,
    row.basis ?? "monthly"
  )
}
```

`gap.ts` `baseComp`: same four-argument call with `row.basis ?? "monthly"`.

`runs.ts` freeze: before the `for (const person of active)` loop, `const orgDefaults = await readOrgPayDefaults(ctx, ctx.orgId)` and `const fullTimeHoursDefault = resolveFullTimeHours({}, orgDefaults).hoursPerMonth`; the run insert carries `fullTimeHoursDefault`. Inside the loop, after `payRecordAt`:

```ts
      const hours = resolveFullTimeHours(person, orgDefaults)
      const basicMonthly =
        pay === null
          ? null
          : normalizedMonthlyBase(pay.basicAmount, pay.basis, hours.hoursPerMonth)
```

and the snapshot row spreads:

```ts
        basicMonthly,
        components: pay?.components ?? [],
        ...(pay !== null
          ? {
              basis: pay.basis,
              basicAmount: pay.basicAmount,
              hoursPerMonth: hours.hoursPerMonth,
            }
          : {}),
```

The run detail query's wire validators (search `basicMonthly: v.union(v.number(), v.null())` in `runs.ts` for the row shape and `referenceDate: v.number()` for the run shape) gain `basis: v.optional(basePayBasis)`, `basicAmount: v.optional(v.number())`, `hoursPerMonth: v.optional(v.number())` on rows and `fullTimeHoursDefault: v.number()` on the detail; the mapping code passes them through.

`assistant/insights.ts`: read `const orgDefaults = await readOrgPayDefaults(ctx, args.orgId)` once before the people loop; per person `const hours = resolveFullTimeHours(person, orgDefaults)`; the `PricedRow` becomes `{ gender, basicMonthly: normalizedMonthlyBase(record.basicAmount, record.basis, hours.hoursPerMonth), components: record.components, ftePercent: person.ftePercent, basis: record.basis }`.

- [ ] **Step 4: Run the tests**

Run: `cd packages/backend && bun run test`
Expected: PASS for everything except `people/import.test.ts`, `people/importDiff.test.ts`, `people/people.test.ts` (if it asserts person fields) and any test seeding an import (Tasks 4 and 6). `bunx tsc --noEmit -p convex`: red only in `people/import.ts`, `people/importHelpers.ts`, `people/importDiff.ts` (diff part), `people/people.ts` if `personAuditFields` is field-enumerated. Biome clean on touched files.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message when approved: `feat(pay-mapping): freeze the raw figure, basis and hours beside the normalized base`.

---

### Task 4: Organization default and the person's own hours (backend)

**Files:**
- Modify: `packages/backend/convex/accounts/organization.ts`
- Modify: the settings test file next to it (`accounts/organization.test.ts`; create it if none exists)
- Modify: `packages/backend/convex/people/people.ts`
- Modify: `packages/backend/convex/people/people.test.ts`
- Modify: `packages/backend/convex/people/importDiff.ts` (`PERSON_IMPORT_OPTIONAL_FIELDS`, `PersonImportValues` only)

**Interfaces:**
- Consumes: `FULL_TIME_HOURS_MAX`, `SETTINGS_AUDIT_FIELDS`, `PERSON_AUDIT_FIELDS` (Task 2).
- Produces: `getOrganizationSettings().fullTimeHoursPerMonth: number | null`; `updateOrganizationSettings({ fullTimeHoursPerMonth?: number | null })`; `getPersonByPublicId` / `listPeople` rows carry `fullTimeHoursPerMonth: number | null`; `updatePerson({ fullTimeHoursPerMonth?: number | null })`; `personImportOptionalArgs.fullTimeHoursPerMonth`; `PERSON_IMPORT_OPTIONAL_FIELDS` includes `"fullTimeHoursPerMonth"`.

- [ ] **Step 1: Failing tests**

Settings:

```ts
describe("updateOrganizationSettings: fullTimeHoursPerMonth", () => {
  it("stores a positive figure, returns it from getOrganizationSettings, and diffs it", async () => {
    // seed org + admin as the neighbouring tests do
    await asAdmin.mutation(api.accounts.organization.updateOrganizationSettings, { orgId, fullTimeHoursPerMonth: 160 })
    const settings = await asAdmin.query(api.accounts.organization.getOrganizationSettings, { orgId })
    expect(settings.fullTimeHoursPerMonth).toBe(160)
    // audit row: changes.fullTimeHoursPerMonth = { from: null, to: 160 }
  })

  it("null clears the value back to the country default", async () => {
    await asAdmin.mutation(…, { orgId, fullTimeHoursPerMonth: 160 })
    await asAdmin.mutation(…, { orgId, fullTimeHoursPerMonth: null })
    const settings = await asAdmin.query(…)
    expect(settings.fullTimeHoursPerMonth).toBeNull()
    // audit row: changes.fullTimeHoursPerMonth = { from: 160, to: null }
  })

  it("rejects zero, negatives and values above FULL_TIME_HOURS_MAX", async () => {
    for (const bad of [0, -1, FULL_TIME_HOURS_MAX + 1]) {
      await expect(asAdmin.mutation(…, { orgId, fullTimeHoursPerMonth: bad })).rejects.toThrow()
    }
  })
})
```

People (`people.test.ts`): `updatePerson` with `fullTimeHoursPerMonth: 150` stores it and writes a `person.updated` diff `{ from: null, to: 150 }`; `null` clears it; out-of-range rejects; `getPersonByPublicId` returns it (null when unset); the import upsert core stores it on insert and patches it on change (call `upsertPersonByExternalRefCore` through `internal.people.people.upsertPersonByExternalRef` or however the neighbouring tests reach it).

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && bunx vitest run convex/accounts convex/people/people.test.ts`

- [ ] **Step 3: Implement**

`accounts/organization.ts`: `settingsShape` gains `fullTimeHoursPerMonth: v.union(v.number(), v.null())`; `getOrganizationSettings` returns `settings.fullTimeHoursPerMonth ?? null`. `updateOrganizationSettings`:

```ts
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    industry: v.optional(v.string()),
    // null clears the default (back to the country figure).
    fullTimeHoursPerMonth: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    if (
      typeof args.fullTimeHoursPerMonth === "number" &&
      !(args.fullTimeHoursPerMonth > 0 && args.fullTimeHoursPerMonth <= FULL_TIME_HOURS_MAX)
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const { fullTimeHoursPerMonth, ...rest } = args
    // The db patch clears with undefined; the audit "after" diffs to null.
    const patch = {
      ...rest,
      ...(fullTimeHoursPerMonth !== undefined
        ? { fullTimeHoursPerMonth: fullTimeHoursPerMonth ?? undefined }
        : {}),
    }
    const after = {
      ...rest,
      ...(fullTimeHoursPerMonth !== undefined ? { fullTimeHoursPerMonth } : {}),
    }
    … insert/patch with `patch` …
    changes: buildChanges(settings ?? {}, after, SETTINGS_AUDIT_FIELDS),
```

(Confirm how `buildChanges` treats an `undefined` before-value versus `null`; the person path's comment in `updatePerson` says a cleared field must reach it as `null`. Mirror that.)

`people/people.ts`: `personFields` + `toPersonShape` gain `fullTimeHoursPerMonth` (`v.union(v.number(), v.null())`, `person.fullTimeHoursPerMonth ?? null`); `personImportOptionalArgs` gains `fullTimeHoursPerMonth: v.optional(v.number())`; the upsert insert path spreads it like `ftePercent`; `updatePerson` gains `fullTimeHoursPerMonth: v.optional(v.union(v.number(), v.null()))` and a block mirroring the `ftePercent` block plus the range check (`invalidInput` outside `(0, FULL_TIME_HOURS_MAX]`); `personAuditFields` includes it wherever `ftePercent` is listed. `createPerson` does NOT take it (derive; the add dialog has no field).

`importDiff.ts`: `PERSON_IMPORT_OPTIONAL_FIELDS` gains `"fullTimeHoursPerMonth"` after `"ftePercent"`; `PersonImportValues` gains `fullTimeHoursPerMonth?: number`.

- [ ] **Step 4: Run the tests**

Run: `cd packages/backend && bunx vitest run convex/accounts convex/people/people.test.ts convex/lib/audit.test.ts`
Expected: PASS. Biome clean. Typecheck red only in `people/import.ts`, `people/importHelpers.ts`, `people/importDiff.ts` (diff part).

- [ ] **Step 5: Present the diff (no commit)**

Proposed message when approved: `feat(people): full-time hours per month on the organization and the person`.

---
### Task 5: Import engine: the two canonical fields, the number shape, hourly-cell validation, a mixed-column fixture

**Files:**
- Modify: `packages/import/src/fields.ts`
- Modify: `packages/import/src/parse.ts`
- Modify: `packages/import/src/validate.ts`
- Modify: `packages/import/src/index.ts`
- Modify: `packages/import/src/fields.test.ts`, `parse.test.ts`, `detect.test.ts`, `validate.test.ts`, `pipeline.test.ts`
- Create: `packages/import/fixtures/visma-sv-hourly.csv`

**Interfaces:**
- Produces: `ValueShape` includes `"number"`; `FieldDef.fixedBasis?: "hourly"`; canonical keys `hourlyRate` (money, `fixedBasis: "hourly"`) and `fullTimeHoursPerMonth` (number); `BASIS_SELECT_FIELD_KEYS: ReadonlySet<string>` (money fields WITHOUT a fixed basis, the only ones that get the Map step's monthly/annual select); `parseNumber(v): number | null`; `unparsableMoney`/`negativeValue` are also raised for a non-blank `hourlyRate` cell.
- Consumers: Task 6 (backend prepare), Task 9 (Map step).

- [ ] **Step 1: Failing tests**

`fields.test.ts`:

```ts
import { BASIS_SELECT_FIELD_KEYS, CANONICAL_FIELDS, matchesSynonym, fold } from "./fields"

describe("hourly pay fields", () => {
  const hourlyRate = CANONICAL_FIELDS.find((f) => f.key === "hourlyRate")
  const hours = CANONICAL_FIELDS.find((f) => f.key === "fullTimeHoursPerMonth")

  it("hourlyRate is an optional money field with a fixed hourly basis", () => {
    expect(hourlyRate).toMatchObject({ tier: "optional", shape: "money", fixedBasis: "hourly" })
  })

  it("matches the Nordic and English hourly-rate headers", () => {
    for (const header of ["Timlön", "Timlon", "Timelønn", "Timeløn", "Hourly rate", "Hourly wage", "Tuntipalkka"]) {
      const { exact, substring } = matchesSynonym(fold(header), hourlyRate?.synonyms ?? [])
      expect(exact || substring, header).toBe(true)
    }
  })

  it("fullTimeHoursPerMonth is an optional number field matched by header only", () => {
    expect(hours).toMatchObject({ tier: "optional", shape: "number" })
    for (const header of ["Heltidstimmar", "Heltidstimmar per månad", "Full-time hours", "Hours per month", "Heltidstimer", "Fuldtidstimer", "Kokoaikatunnit"]) {
      const { exact, substring } = matchesSynonym(fold(header), hours?.synonyms ?? [])
      expect(exact || substring, header).toBe(true)
    }
  })

  it("never claims a working-time column (weekly hours or an FTE share)", () => {
    for (const header of ["Arbetstid", "Arbeidstid", "Arbejdstid", "Työaika"]) {
      const { exact, substring } = matchesSynonym(fold(header), hours?.synonyms ?? [])
      expect(exact || substring, header).toBe(false)
    }
  })

  it("BASIS_SELECT_FIELD_KEYS holds every money field except the fixed-basis one", () => {
    expect(BASIS_SELECT_FIELD_KEYS.has("basicMonthly")).toBe(true)
    expect(BASIS_SELECT_FIELD_KEYS.has("bonus")).toBe(true)
    expect(BASIS_SELECT_FIELD_KEYS.has("hourlyRate")).toBe(false)
  })
})
```

`parse.test.ts`:

```ts
describe("parseNumber", () => {
  it("reads dot and comma decimals and a trailing h", () => {
    expect(parseNumber("162.5")).toBe(162.5)
    expect(parseNumber("162,5")).toBe(162.5)
    expect(parseNumber("165")).toBe(165)
    expect(parseNumber("165 h")).toBe(165)
  })
  it("never scales a fraction and rejects anything else", () => {
    expect(parseNumber("0.8")).toBe(0.8)
    expect(parseNumber("80 %")).toBeNull()
    expect(parseNumber("abc")).toBeNull()
    expect(parseNumber("")).toBeNull()
    expect(parseNumber("-5")).toBeNull()
  })
})
```

`detect.test.ts`: a header row `Anstnr;Kon;Befattning;Lön;Timlön;Heltidstimmar;Arbetstid` with two sample rows maps `Lön` to `basicMonthly`, `Timlön` to `hourlyRate`, `Heltidstimmar` to `fullTimeHoursPerMonth`, and leaves `Arbetstid` unmapped.

`validate.test.ts`: a mapped `hourlyRate` cell of `"abc"` raises `unparsableMoney` on that row; `"-195"` raises `negativeValue`; a blank cell raises nothing.

`pipeline.test.ts`:

```ts
describe("pipeline: visma-sv-hourly (mixed Lön column by pay form)", () => {
  it("maps the pay-form and hours columns and reports no blocking or money issues", () => {
    const { mapping, validation } = runCsv("visma-sv-hourly.csv")
    for (const key of REQUIRED) expect(mapping.map[key]).toBeDefined()
    expect(mapping.map.employmentType).toBeDefined()
    expect(mapping.map.fullTimeHoursPerMonth).toBeDefined()
    expect(validation.blocking).toHaveLength(0)
    expect(validation.issues.filter((i) => i.code === "unparsableMoney")).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/import && bun run test`

- [ ] **Step 3: Implement**

`fields.ts`:
- `ValueShape` gains `| "number"` with the comment "a plain decimal (hours, counts): parsed by parseNumber, never scaled, never detected from values".
- `FieldDef` gains `/** A money field whose basis is fixed by definition (an hourly rate is per hour); such a field gets no monthly/annual select. */ fixedBasis?: "hourly"`.
- Two entries appended to `FIELDS` before `employmentType`:

```ts
  {
    key: "hourlyRate",
    tier: "optional",
    shape: "money",
    fixedBasis: "hourly",
    // sv timlön, nb timelønn, da timeløn (both fold with o-slash -> o), fi tuntipalkka.
    synonyms: [
      "timlon",
      "timelon",
      "timelonn",
      "hourlyrate",
      "hourlywage",
      "hourlypay",
      "tuntipalkka",
    ],
  },
  {
    key: "fullTimeHoursPerMonth",
    tier: "optional",
    shape: "number",
    // Deliberately NOT arbetstid/arbeidstid/arbejdstid/tyoaika: those columns
    // are as often weekly hours or an FTE share.
    synonyms: [
      "heltidstimmar",
      "heltidstimmarpermanad",
      "fulltimehours",
      "fulltimehourspermonth",
      "hourspermonth",
      "heltidstimer",
      "fuldtidstimer",
      "kokoaikatunnit",
    ],
  },
```

- After `CANONICAL_FIELDS`:

```ts
// The money fields that get the Map step's monthly/annual select: every
// money-shaped field without a fixed basis. One set for the Map step and
// its basis-map sync, so a fixed-basis field can never grow a select.
export const BASIS_SELECT_FIELD_KEYS: ReadonlySet<string> = new Set(
  CANONICAL_FIELDS.filter(
    (f) => f.shape === "money" && f.fixedBasis === undefined
  ).map((f) => f.key)
)
```

`parse.ts`:

```ts
/**
 * Parse a plain decimal (an hours figure, a count): dot or comma decimal, an
 * optional trailing "h". Never scales (unlike parsePercent's fraction mode)
 * and rejects negatives, percent signs and any other trailing word.
 * Examples: "162,5" -> 162.5, "165 h" -> 165, "80 %" -> null.
 */
export function parseNumber(v: string): number | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/\s*h$/i, "").trim().replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
```

`validate.ts`: resolve `hourlyRateCol` beside `basicMonthlyCol` and run the same non-blank `isNegativeMoney` / `parseMoney` block on it (detail text names `hourlyRate`). Keep the shared block DRY: extract `moneyCellIssues(rowIdx, fieldKey, raw)` used for both columns.

`index.ts`: export `parseNumber` and `BASIS_SELECT_FIELD_KEYS`.

`fixtures/visma-sv-hourly.csv` (semicolon-separated like `visma-sv.csv`; synthetic data):

```
Anstnr;Fornamn;Efternamn;Kon;Befattning;Anstallningsform;Lon;Heltidstimmar
201;Anna;Svensson;Kvinna;Butikssaljare;Tillsvidare;29 500;
202;Erik;Lindqvist;Man;Butikssaljare;Timanstalld;165;
203;Maria;Karlsson;Kvinna;Kassabitrade;Timanstalld;158,50;150
204;Johan;Berg;Man;Lagerarbetare;Tillsvidare;31 200;
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/import && bun run test` (PASS), `bunx biome check packages/import`, `cd packages/import && bunx tsc --noEmit`.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message when approved: `feat(import): hourly-rate and full-time-hours columns with a number shape`.

---

### Task 6: Backend import: row basis by pay form, notices, preview and result counts

**Files:**
- Create: `packages/backend/convex/people/importHourly.ts`
- Create: `packages/backend/convex/people/importHourly.test.ts`
- Modify: `packages/backend/convex/people/import.ts`
- Modify: `packages/backend/convex/people/importDiff.ts`
- Modify: `packages/backend/convex/people/importHelpers.ts`
- Modify: `packages/backend/convex/people/import.test.ts`, `importDiff.test.ts`

**Interfaces:**
- Consumes: Task 1 (`plausibilityFor`, `toMonthly`), Task 2 (`SalaryValues`, `readOrgPayDefaults`, `basePayBasis`), Task 4 (`PersonImportValues.fullTimeHoursPerMonth`), Task 5 (`parseNumber`, the two canonical keys).
- Produces: `previewImport`/`importPayroll` arg `interpretHourly?: boolean` (default true); preview result fields `hourlyPay: { interpreted: ImportPersonRef[]; total: number; notices: Array<{ code: HourlyNoticeCode; ref: ImportPersonRef }> }` and `ownHoursCount: number` (present when `ok`); `diff.salary.changedDetails[].from/to` become `{ basis, amount }`; import result `hourlyPay: number`; `people.imported` payload `hourlyPay`; `internal.people.importHelpers.getOrgPayDefaults` replaces `getOrgCurrency`.

- [ ] **Step 1: The pure rules and their tests**

`people/importHourly.ts`:

```ts
import {
  type BasePayBasis,
  type EmploymentType,
  type PayBasis,
  toMonthly,
} from "@workspace/constants"

// Soft review-step notices about a row's pay basis. Never a skip code: each
// is listed with its rows so HR can look, and the row still imports.
export type HourlyNoticeCode =
  | "hourlyLooksMonthly"
  | "monthlyLooksHourly"
  | "bothBasesPresent"

export interface RowBasis {
  basis: BasePayBasis
  basicAmount: number
  // True when the base-pay column was read as an hourly rate BECAUSE the
  // row's employment type is hourly (rule 2): the review step lists these.
  interpreted: boolean
  notice: "bothBasesPresent" | null
}

// Which basis a row's base pay is in, and the figure, from the two cells and
// the pay form. Pure so the preview and the import share it (one rule):
//   1. an hourly-rate cell wins, unless the row also has a base-pay cell and
//      is NOT hourly-typed (then the base pay wins); both cells present is
//      always worth a look, so it carries the bothBasesPresent notice;
//   2. a base-pay cell on an hourly-typed row is an hourly rate when the
//      caller interprets (the review step's default-on checkbox);
//   3. otherwise the base-pay cell is a monthly figure via its column basis;
//   4. no base pay at all: null (no salary row, as before).
export function resolveRowBasis(input: {
  parsedBase: number | null
  parsedHourly: number | null
  employmentType: EmploymentType | undefined
  interpretHourly: boolean
  baseColumnBasis: PayBasis
}): RowBasis | null {
  const hourlyTyped = input.employmentType === "hourly"
  if (input.parsedHourly !== null) {
    const both = input.parsedBase !== null
    if (both && !hourlyTyped) {
      return {
        basis: "monthly",
        basicAmount: toMonthly(input.parsedBase as number, input.baseColumnBasis),
        interpreted: false,
        notice: "bothBasesPresent",
      }
    }
    return {
      basis: "hourly",
      basicAmount: input.parsedHourly,
      interpreted: false,
      notice: both ? "bothBasesPresent" : null,
    }
  }
  if (input.parsedBase === null) return null
  if (hourlyTyped && input.interpretHourly) {
    return { basis: "hourly", basicAmount: input.parsedBase, interpreted: true, notice: null }
  }
  return {
    basis: "monthly",
    basicAmount: toMonthly(input.parsedBase, input.baseColumnBasis),
    interpreted: false,
    notice: null,
  }
}

// The size-based notice for a resolved row, given the org currency's bounds
// (undefined bounds: no notice). A low MONTHLY figure is only suspicious on
// an hourly-typed or untyped row: a monthly-typed low figure is a part-time
// salary.
export function plausibilityNotice(
  row: { basis: BasePayBasis; basicAmount: number },
  employmentType: EmploymentType | undefined,
  bounds: { hourlyMax: number; monthlyMin: number } | undefined
): "hourlyLooksMonthly" | "monthlyLooksHourly" | null {
  if (bounds === undefined) return null
  if (row.basis === "hourly") {
    return row.basicAmount > bounds.hourlyMax ? "hourlyLooksMonthly" : null
  }
  const suspicious = employmentType === undefined || employmentType === "hourly"
  return suspicious && row.basicAmount < bounds.monthlyMin ? "monthlyLooksHourly" : null
}
```

`importHourly.test.ts` covers: each of the four rules (including the annual column basis dividing by 12 in rule 3), both-cells outcomes for hourly-typed and permanent rows, `interpretHourly: false` turning rule 2 into rule 3, and `plausibilityNotice` at the bounds (1500 vs 1501 hourly in SEK; 2999 monthly hourly-typed vs 2999 monthly permanent vs 3000; undefined bounds).

- [ ] **Step 2: Failing backend import tests**

In `import.test.ts` add:

```ts
describe("importPayroll (hourly pay)", () => {
  const CSV = [
    "Anstnr,Kon,Befattning,Anstallningsform,Lon,Heltidstimmar",
    "H1,Kvinna,Kassabitrade,Timanstalld,195,",
    "H2,Man,Lagerarbetare,Tillsvidare,31200,",
    "H3,Kvinna,Butikssaljare,Timanstalld,158.5,150",
  ].join("\n")
  const MAP: string[][] = [
    ["Anstnr", "externalRef"], ["Kon", "gender"], ["Befattning", "title"],
    ["Anstallningsform", "employmentType"], ["Lon", "basicMonthly"],
    ["Heltidstimmar", "fullTimeHoursPerMonth"],
  ]

  it("reads the Lon column as an hourly rate on hourly-typed rows and counts them", async () => {
    // importPayroll with importId "run-hourly-1" and no interpretHourly (default true)
    // payRecords: H1 { basis: "hourly", basicAmount: 195 }, H2 { basis: "monthly", basicAmount: 31200 }, H3 hourly 158.5
    // people: H3.fullTimeHoursPerMonth === 150, H1's undefined
    // result.hourlyPay === 2; the people.imported audit payload has hourlyPay: 2
  })

  it("interpretHourly: false keeps the Lon column monthly and the preview flags the low figures", async () => {
    // previewImport with interpretHourly: false: hourlyPay.interpreted is [], hourlyPay.total 0,
    // notices contain { code: "monthlyLooksHourly", ref: { externalRef: "H1", ... } } and H3
    // importPayroll with interpretHourly: false: H1 stored { basis: "monthly", basicAmount: 195 }
  })

  it("the preview lists the interpreted rows and the own-hours count", async () => {
    // previewImport default: hourlyPay.interpreted has H1 and H3, total 2, ownHoursCount 1, notices []
  })

  it("a dedicated Timlon column wins, and both cells on a permanent row stay monthly with a notice", async () => {
    // CSV with Lon AND Timlon columns: "P1,Man,X,Tillsvidare,30000,180" -> monthly 30000 + bothBasesPresent
    // "P2,Kvinna,Y,Timanstalld,,190" -> hourly 190, no notice
    // "P3,Kvinna,Z,,,210" (no employment type, only Timlon) -> hourly 210
  })

  it("an hourly-typed row with a monthly-sized figure gets hourlyLooksMonthly", async () => {
    // "X1,Kvinna,T,Timanstalld,32000," -> stored hourly 32000 (the rule is visible, not silent) + notice hourlyLooksMonthly
  })

  it("an out-of-range hours cell is ignored", async () => {
    // Heltidstimmar 900 -> person.fullTimeHoursPerMonth undefined
  })

  it("a salary change shows basis and amount on both sides", async () => {
    // import H1 hourly 195, then preview the same file with 205: diff.salary.changedDetails[0] equals
    // { externalRef: "H1", displayName: ..., payYear, from: { basis: "hourly", amount: 195 }, to: { basis: "hourly", amount: 205 } }
  })
})
```

Write each `// comment` out as real assertions following the neighbouring tests' style (they show how `previewImport`/`importPayroll` are called and how `people.imported` is read). Update the existing basis tests (`basicMonthly` -> `basis`/`basicAmount` on stored docs) and `importDiff.test.ts` fixtures (`latestSalary` carries `basis` + `basicAmount`; `changedDetails` from/to objects).

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/backend && bunx vitest run convex/people/importHourly.test.ts convex/people/import.test.ts convex/people/importDiff.test.ts`

- [ ] **Step 4: Implement**

`importHelpers.ts`:
- Replace `getOrgCurrency` with:

```ts
export const getOrgPayDefaults = internalQuery({
  args: { orgId: v.string() },
  returns: v.object({
    currency: v.string(),
    country: v.optional(v.string()),
    fullTimeHoursPerMonth: v.optional(v.number()),
  }),
  handler: (ctx, { orgId }) => readOrgPayDefaults(ctx, orgId),
})
```
- `getImportBaseline`'s `latestSalary` object: `basis: basePayBasis, basicAmount: v.number()` replace `basicMonthly`; the handler maps the newest record accordingly.
- `importRowValidator`'s salary object: same two fields.
- `logImportCompleted`: arg + payload `hourlyPay: v.number()`.

`importDiff.ts`:
- `ImportPreviewDiff.salary.changedDetails[]` becomes `{ externalRef, displayName, payYear, from: { basis: BasePayBasis; amount: number }, to: { basis: BasePayBasis; amount: number } }`; `diffImport` fills it from `baseline.latestSalary` and `row.salary`.

`import.ts` (`prepareImport`):
- `PrepareArgs` gains `interpretHourly?: boolean`; `const interpretHourly = args.interpretHourly ?? true`.
- `orgDefaults` from `internal.people.importHelpers.getOrgPayDefaults`; `const orgCurrency = orgDefaults.currency`; `const bounds = plausibilityFor(orgCurrency)`.
- Columns: `hourlyRateCol = colOf("hourlyRate")`, `fullTimeHoursCol = colOf("fullTimeHoursPerMonth")`.
- Per row, person side: `const hoursRaw = cell(fullTimeHoursCol); const parsedHours = hoursRaw ? parseNumber(hoursRaw) : null; const fullTimeHoursPerMonth = parsedHours !== null && parsedHours > 0 && parsedHours <= FULL_TIME_HOURS_MAX ? parsedHours : undefined` (spread into `person` like `ftePercent`).
- Per row, salary side, replacing the `basicMonthly` block:

```ts
    const baseRaw = cell(basicMonthlyCol)
    const hourlyRaw = cell(hourlyRateCol)
    const resolvedBasis = resolveRowBasis({
      parsedBase: baseRaw ? parseMoney(baseRaw) : null,
      parsedHourly: hourlyRaw ? parseMoney(hourlyRaw) : null,
      employmentType,
      interpretHourly,
      baseColumnBasis: basisOf("basicMonthly"),
    })

    let salary: NormalizedImportRow["salary"] = null
    if (resolvedBasis !== null) {
      … currency, payYear, components exactly as today …
      salary = {
        payYear,
        basis: resolvedBasis.basis,
        basicAmount: resolvedBasis.basicAmount,
        currency,
        components,
      }
      const ref = { externalRef, displayName }
      if (resolvedBasis.basis === "hourly") hourlyTotal += 1
      if (resolvedBasis.interpreted) interpretedRefs.push(ref)
      if (resolvedBasis.notice !== null) notices.push({ code: resolvedBasis.notice, ref })
      const sizeNotice = plausibilityNotice(resolvedBasis, employmentType, bounds)
      if (sizeNotice !== null) notices.push({ code: sizeNotice, ref })
    }
    if (fullTimeHoursPerMonth !== undefined) ownHoursCount += 1
```

- The prepared result gains `hourlyPay: { interpreted: interpretedRefs, total: hourlyTotal, notices }` and `ownHoursCount`.
- `previewImport`: args gain `interpretHourly: v.optional(v.boolean())`; `importPreviewValidator` gains `hourlyPay: v.optional(v.object({ interpreted: v.array(importPersonRefValidator), total: v.number(), notices: v.array(v.object({ code: hourlyNoticeCodeValidator, ref: importPersonRefValidator })) }))` and `ownHoursCount: v.optional(v.number())` (name the intermediate validators, as the file's comment explains, so the generated api type stays shallow); the ok-branch returns them. `changedDetails`' validator: `from`/`to` become `v.object({ basis: basePayBasis, amount: v.number() })`.
- `importPayroll`: args gain `interpretHourly`; after the skip filter `const hourlyPay = rows.filter((r) => r.salary?.basis === "hourly").length`; the result (both branches) and `logImportCompleted` carry `hourlyPay`; `importResultValidator` gains `hourlyPay: v.number()`.

- [ ] **Step 5: Run the tests**

Run: `cd packages/backend && bun run test` (all PASS), `bunx tsc --noEmit -p convex` (GREEN: the backend red set is now empty), `bunx biome check packages/backend/convex/people`.

- [ ] **Step 6: Present the diff (no commit)**

Proposed message when approved: `feat(import): read the pay column by pay form and flag implausible figures`.

---
### Task 7: i18n strings in five locales

**Files:**
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Produces every key below. Tasks 8 to 12 consume them; the audit-label coverage test (`apps/dashboard/lib/audit-labels.test.ts`) and the i18n parity/help-cap tests guard them.

- [ ] **Step 1: Add the keys to `en.json` (Edit tool), placed beside their neighbours**

```json
"dashboard.people.salaryForm.basis": { "label": "Pay basis", "monthly": "Monthly salary", "hourly": "Hourly pay" },
"dashboard.people.salaryForm.hourlyAmount": "Hourly rate",
"dashboard.people.salaryForm.derivedMonthly": "= {amount} per month at {hours} h",
"dashboard.people.payUnit": { "monthly": "{amount}/mo", "hourly": "{amount}/h" },
"dashboard.people.detail.salaryColumns.basicMonthly": "Base pay",           (CHANGED text, same key)
"dashboard.people.detail.fullTimeHours": "Full-time hours",
"dashboard.people.personForm.fullTimeHoursLabel": "Full-time hours per month",
"dashboard.people.personForm.fullTimeHoursPlaceholder": "Default: {hours}",
"dashboard.organization.general.fullTimeHoursLabel": "Full-time hours per month",
"dashboard.organization.general.fullTimeHoursPlaceholder": "Country default: {hours}",
"dashboard.people.import.fields.hourlyRate": "Hourly rate",
"dashboard.people.import.fields.fullTimeHoursPerMonth": "Full-time hours per month",
"dashboard.people.import.review.hourly": {
  "heading": "Hourly pay",
  "interpreted": "{count, plural, one {# amount is read as hourly pay} other {# amounts are read as hourly pay}}",
  "interpretToggle": "Read amounts for hourly-paid people as hourly pay",
  "ownHours": "{count, plural, one {# person gets their own full-time hours} other {# people get their own full-time hours}}",
  "noticesTitle": "Worth a look",
  "notice": {
    "hourlyLooksMonthly": "{count, plural, one {# hourly rate looks like a monthly salary} other {# hourly rates look like monthly salaries}}",
    "monthlyLooksHourly": "{count, plural, one {# monthly salary looks like an hourly rate} other {# monthly salaries look like hourly rates}}",
    "bothBasesPresent": "{count, plural, one {# row carries both a monthly salary and an hourly rate} other {# rows carry both a monthly salary and an hourly rate}}"
  }
},
"dashboard.people.import.done.hourlyPay": "Read as hourly pay",
"dashboard.payMapping.hourlyChip": "Hourly",
"dashboard.payMapping.report.hourlyMark": "(hourly)",
"dashboard.payMapping.report.hourlyNote": "Hourly pay is converted to full-time-equivalent monthly pay using {hours} full-time hours per month ({count, plural, =0 {no one} one {# person} other {# people}} with a value of their own).",
"dashboard.help.fullTimeHoursLabel": "What are full-time hours per month?",
"dashboard.help.fullTimeHoursBody": "The monthly hours that count as full time, used to turn hourly pay into a monthly amount. A person's own value replaces the organization's default.",
"dashboard.help.payBasisLabel": "What is the pay basis?",
"dashboard.help.payBasisBody": "Whether the figure is a monthly salary or an hourly rate. Hourly pay is compared as rate times full-time hours, so it is not FTE-adjusted again.",
"dashboard.auditLog.fields.basis": "Pay basis",
"dashboard.auditLog.fields.fullTimeHoursPerMonth": "Full-time hours per month",
"dashboard.auditLog.fields.hourlyPay": "Read as hourly pay"
```

- [ ] **Step 2: Mirror to sv, nb, da, fi at production quality**

Swedish (the reference for the other Nordic locales):

```json
"salaryForm.basis": { "label": "Löneform", "monthly": "Månadslön", "hourly": "Timlön" },
"salaryForm.hourlyAmount": "Timlön",
"salaryForm.derivedMonthly": "= {amount} per månad vid {hours} h",
"payUnit": { "monthly": "{amount}/mån", "hourly": "{amount}/h" },
"detail.salaryColumns.basicMonthly": "Grundlön",
"detail.fullTimeHours": "Heltidstimmar",
"personForm.fullTimeHoursLabel": "Heltidstimmar per månad",
"personForm.fullTimeHoursPlaceholder": "Standard: {hours}",
"organization.general.fullTimeHoursLabel": "Heltidstimmar per månad",
"organization.general.fullTimeHoursPlaceholder": "Landets standard: {hours}",
"import.fields.hourlyRate": "Timlön",
"import.fields.fullTimeHoursPerMonth": "Heltidstimmar per månad",
"import.review.hourly.heading": "Timlön",
"import.review.hourly.interpreted": "{count, plural, one {# belopp tolkas som timlön} other {# belopp tolkas som timlön}}",
"import.review.hourly.interpretToggle": "Tolka belopp för timanställda som timlön",
"import.review.hourly.ownHours": "{count, plural, one {# person får egna heltidstimmar} other {# personer får egna heltidstimmar}}",
"import.review.hourly.noticesTitle": "Värt en titt",
"import.review.hourly.notice.hourlyLooksMonthly": "{count, plural, one {# timlön ser ut som en månadslön} other {# timlöner ser ut som månadslöner}}",
"import.review.hourly.notice.monthlyLooksHourly": "{count, plural, one {# månadslön ser ut som en timlön} other {# månadslöner ser ut som timlöner}}",
"import.review.hourly.notice.bothBasesPresent": "{count, plural, one {# rad har både månadslön och timlön} other {# rader har både månadslön och timlön}}",
"import.done.hourlyPay": "Tolkade som timlön",
"payMapping.hourlyChip": "Timlön",
"payMapping.report.hourlyMark": "(timlön)",
"payMapping.report.hourlyNote": "Timlön räknas om till heltidsekvivalent månadslön med {hours} heltidstimmar per månad ({count, plural, =0 {ingen} one {# person} other {# personer}} med eget värde).",
"help.fullTimeHoursLabel": "Vad är heltidstimmar per månad?",
"help.fullTimeHoursBody": "Timmarna som räknas som heltid, används för att räkna om timlön till ett månadsbelopp. En persons eget värde ersätter organisationens standard.",
"help.payBasisLabel": "Vad är löneform?",
"help.payBasisBody": "Om beloppet är en månadslön eller en timlön. Timlön jämförs som timlön gånger heltidstimmar och FTE-justeras därför inte igen.",
"auditLog.fields.basis": "Löneform",
"auditLog.fields.fullTimeHoursPerMonth": "Heltidstimmar per månad",
"auditLog.fields.hourlyPay": "Tolkade som timlön"
```

nb, da and fi: write each string directly at production quality (nb: timelønn, heltidstimer per måned, "{amount}/mnd", "{amount}/t"; da: timeløn, fuldtidstimer pr. måned, "{amount}/md.", "{amount}/t"; fi: tuntipalkka, kokoaikatunnit kuukaudessa, "{amount}/kk", "{amount}/h"). Use the register the neighbouring keys already use (du-form in sv/nb/da, sinuttelu in fi). Finnish plural forms use `one`/`other`. End with the cross-locale read: every new nb/da/fi string against sv and en for false friends and terminology drift; help bodies under 240 characters.

- [ ] **Step 3: Run the i18n tests**

Run: `cd packages/i18n && bun run test` (parity + help caps PASS). `grep -nP '\x{2014}' packages/i18n/messages/*.json` finds nothing new. Check for mojibake: `grep -n 'Ã' packages/i18n/messages/*.json` finds nothing.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(i18n): strings for hourly pay and full-time hours in five locales`.

---

### Task 8: Dashboard audit wiring and the frozen-row types

**Files:**
- Modify: `apps/dashboard/lib/audit-constants.ts`
- Modify: `apps/dashboard/lib/audit-detail.tsx`
- Modify: `apps/dashboard/lib/audit-detail.test.tsx`
- Modify: `apps/dashboard/lib/audit-labels.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (+ its test)

**Interfaces:**
- Consumes: Task 2 audit sets, Task 3 wire fields, Task 7 labels.
- Produces: `SALARY_BASIS_VALUE_KEYS`; `PayMappingSnapshotRow.{basis?,basicAmount?,hoursPerMonth?}`; the run-detail type's `fullTimeHoursDefault`; basis-aware `fteBaseMonthly`/`fteTotalMonthly`. After this task the dashboard typecheck is green.

- [ ] **Step 1: Failing tests**

`audit-detail.test.tsx`: a `pay.salarySet` row with `changes: { basis: { from: null, to: "hourly" } }` renders the label "Pay basis" and the value "Hourly pay" (never the raw code). `audit-labels.test.ts`: add `"hourlyPay"` to `OTHER_AUDIT_FIELDS` (the imported `PAY_AUDIT_FIELDS`/`SETTINGS_AUDIT_FIELDS`/`PERSON_AUDIT_FIELDS` already carry the other two). `pay-mapping-gap-types.test.ts`: `fteTotalMonthly({ ...row, basis: "hourly", basicMonthly: 32175, ftePercent: 50 })` is 32175, and the monthly case still grosses up.

- [ ] **Step 2: Implement**

`audit-constants.ts`, beside `SALARY_SOURCE_VALUE_KEYS`:

```ts
// pay.* `basis` (people/tables.ts basePayBasis): labeled where the salary
// dialog labels the same choice, so the diff reads "Pay basis: Hourly pay".
export const SALARY_BASIS_VALUE_KEYS: Record<BasePayBasis, string> = {
  monthly: "people.salaryForm.basis.monthly",
  hourly: "people.salaryForm.basis.hourly",
}
```

and `basis: SALARY_BASIS_VALUE_KEYS,` in the coded-domain map next to `source`.

`audit-detail.tsx` `FIELD_DISPLAY_ORDER`: `"fullTimeHoursPerMonth"` right after `"ftePercent"`, `"basis"` right after `"payYear"`, `"hourlyPay"` right after `"peopleReactivated"`.

`pay-mapping-gap-types.ts`: import `type BasePayBasis`; `PayMappingSnapshotRow` gains `basis?: BasePayBasis`, `basicAmount?: number`, `hoursPerMonth?: number` (with the same "present exactly when priced" comment as the table); `fteBaseMonthly`/`fteTotalMonthly` pass `row.basis ?? "monthly"`; the run-detail type (`PayMappingRunDetail`, wherever it is declared: search `referenceDate: number` in this file or its import) gains `fullTimeHoursDefault: number`. Any fixture builder in dashboard tests that types rows against `PayMappingSnapshotRow` keeps compiling (the fields are optional); the run fixtures gain `fullTimeHoursDefault: 165`.

- [ ] **Step 3: Run**

Run: `cd apps/dashboard && bunx vitest run lib/audit-detail.test.tsx lib/audit-labels.test.ts components/pay-mapping/pay-mapping-gap-types.test.ts` (PASS), `bunx tsc --noEmit` (GREEN; fix any remaining `basicMonthly`-on-payRecord reads it names, they belong to this task), `bunx biome check apps/dashboard/lib apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(dashboard): label the pay basis in the audit log and carry the frozen basis on rows`.

---
### Task 9: Import wizard: no select on the fixed-basis column, the hourly group, the done row

**Files:**
- Modify: `apps/dashboard/components/people/import/map-step.tsx` (+ `map-step.test.tsx`)
- Modify: `apps/dashboard/components/people/import/review-step.tsx` (+ `review-step.test.tsx`)
- Modify: `apps/dashboard/components/people/import/import-done-step.tsx` (+ `import-done-step.test.tsx`)
- Modify: `apps/dashboard/components/people/import/import-wizard.tsx`

**Interfaces:**
- Consumes: Task 5 `BASIS_SELECT_FIELD_KEYS`; Task 6 preview fields `hourlyPay`, `ownHoursCount`, arg `interpretHourly`, result `hourlyPay`; Task 7 strings.
- Produces: `ImportResultCounts.hourlyPay`.

- [ ] **Step 1: Failing tests**

`map-step.test.tsx`: a column mapped to `hourlyRate` renders NO `map-column-<i>-basis-trigger`; `syncBasisMap` never emits a `hourlyRate` entry.

`review-step.test.tsx` (the preview mock returns `hourlyPay: { interpreted: [{ externalRef: "H1", displayName: "Maria Karlsson" }], total: 2, notices: [{ code: "hourlyLooksMonthly", ref: { externalRef: "H9", displayName: "X" } }] }, ownHoursCount: 1`):
- renders the "Hourly pay" group with the interpreted count row, Maria's name in the list, the own-hours row, and the notice row with its person;
- the checkbox `import-interpret-hourly` is checked by default; unchecking calls `previewImport` again with `interpretHourly: false`; confirming then calls `importPayroll` with `interpretHourly: false`; with the box checked, neither call carries `interpretHourly` (omitted like every other default arg);
- a preview with `hourlyPay.total === 0`, no notices and `ownHoursCount === 0` renders no group;
- `onImportSuccess` receives `hourlyPay: result.hourlyPay`.

`import-done-step.test.tsx`: `hourlyPay: 2` renders the row `done-hourlyPay` with "2"; `hourlyPay: 0` renders none.

- [ ] **Step 2: Implement**

`map-step.tsx`: delete the local `MONEY_FIELD_KEYS`; import `BASIS_SELECT_FIELD_KEYS` from `@workspace/import` and use it in `syncBasisMap` and in the cell condition.

`import-wizard.tsx`: `ImportResultCounts` gains `// Rows written with the hourly basis (dedicated column or pay-form interpretation).` `hourlyPay: number`.

`import-done-step.tsx`: after the `archived` conditional row:

```tsx
    ...(result.hourlyPay > 0
      ? [{ key: "hourlyPay" as const, icon: CoinsDollarIcon, value: result.hourlyPay }]
      : []),
```

(import `CoinsDollarIcon` from `@hugeicons/core-free-icons`).

`review-step.tsx`:
- State: `const [interpretHourly, setInterpretHourly] = useState(true)`, `const [showAllInterpreted, setShowAllInterpreted] = useState(false)`, `const [showAllNotice, setShowAllNotice] = useState<Record<string, boolean>>({})`.
- Refactor the mount effect into `runPreview(interpret: boolean)` that clears `changePreview` to null (the count cells show their skeletons again), calls `previewImport({ …, ...(interpret ? {} : { interpretHourly: false }) })` and sets the result; the mount effect calls `runPreview(true)` once (keep the StrictMode ref guard); the checkbox handler sets the state and calls `runPreview(next)`.
- `handleConfirm` adds `...(interpretHourly ? {} : { interpretHourly: false })` and `hourlyPay: result.hourlyPay` in `onImportSuccess`.
- Derived: `const hourly = changePreview?.hourlyPay`, `const ownHoursCount = changePreview?.ownHoursCount ?? 0`, `const showHourlyGroup = hourly !== undefined && (hourly.total > 0 || hourly.notices.length > 0 || ownHoursCount > 0 || !interpretHourly)`.
- Render, inside the `space-y-4` stack right after the `CHANGE_GROUPS` block (so it extends below, never reflows), when `showHourlyGroup`:

```tsx
<div data-testid="hourly-pay">
  <h4 className="mb-2 font-medium text-muted-foreground text-xs">{tHourly("heading")}</h4>
  <div className="divide-y rounded-md border">
    <div className="space-y-2 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <HugeiconsIcon icon={CoinsDollarIcon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm">{tHourly("interpreted", { count: hourly.interpreted.length })}</span>
        </span>
        <span className="font-medium font-mono text-sm">{hourly.interpreted.length}</span>
      </div>
      {hourly.interpreted.length > 0 && (
        <PersonRefList people={hourly.interpreted} showAll={showAllInterpreted} onShowAll={() => setShowAllInterpreted(true)} showAllLabel={tChanges("showAll", { count: hourly.interpreted.length })} />
      )}
      {/* htmlFor association, not a wrapping label (a wrapping label toggles twice). */}
      <div className="flex items-center gap-2">
        <Checkbox id="import-interpret-hourly" checked={interpretHourly} onCheckedChange={(checked) => handleInterpretChange(checked === true)} />
        <Label htmlFor="import-interpret-hourly" className="font-medium">{tHourly("interpretToggle")}</Label>
      </div>
    </div>
    {ownHoursCount > 0 && (
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm">{tHourly("ownHours", { count: ownHoursCount })}</span>
        <span className="font-medium font-mono text-sm">{ownHoursCount}</span>
      </div>
    )}
  </div>
  {hourly.notices.length > 0 && (
    <Alert className="mt-3" data-testid="hourly-notices">
      <AlertTitle>{tHourly("noticesTitle")}</AlertTitle>
      <AlertDescription>
        {/* one block per notice code present, in a fixed code order */}
        {HOURLY_NOTICE_CODES.filter((code) => byCode(code).length > 0).map((code) => (
          <div key={code} className="mt-2">
            <p>{tHourly(`notice.${code}`, { count: byCode(code).length })}</p>
            <PersonRefList people={byCode(code).map((n) => n.ref)} showAll={showAllNotice[code] === true} onShowAll={() => setShowAllNotice((prev) => ({ ...prev, [code]: true }))} showAllLabel={tChanges("showAll", { count: byCode(code).length })} />
          </div>
        ))}
      </AlertDescription>
    </Alert>
  )}
</div>
```

with `const tHourly = useTranslations("dashboard.people.import.review.hourly")`, `const HOURLY_NOTICE_CODES = ["hourlyLooksMonthly", "monthlyLooksHourly", "bothBasesPresent"] as const` (module scope) and `byCode(code) = hourly.notices.filter((n) => n.code === code)`. The notice `Alert` is the plain variant (a notice never blocks), not `WARNING_ALERT_CLASS`.

- `changedDetails` is not rendered by the review step today (only counted), so its new `from`/`to` shape changes fixtures only.

- [ ] **Step 3: Run**

Run: `cd apps/dashboard && bunx vitest run components/people/import` (PASS), `bunx tsc --noEmit`, `bunx biome check apps/dashboard/components/people/import`.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(import): the review step shows which amounts are read as hourly pay and lets HR switch it off`.

---

### Task 10: Salary dialog, person page and the person's own hours

**Files:**
- Create: `apps/dashboard/hooks/use-base-pay-format.ts` (+ `use-base-pay-format.test.tsx`)
- Modify: `apps/dashboard/components/people/add-salary-dialog.tsx` (+ test)
- Modify: `apps/dashboard/components/people/person-detail.tsx` (+ test)
- Modify: `apps/dashboard/components/people/edit-person-dialog.tsx` (+ test)
- Modify: `apps/dashboard/components/people/person-actions-menu.tsx` (the `EditablePerson` pass-through)

**Interfaces:**
- Consumes: Task 2 `getPayDefaults`, `getSalaryHistory` rows (`basis`, `basicAmount`, `basicMonthly`, `hoursPerMonth`), Task 4 `updatePerson.fullTimeHoursPerMonth` and `getPersonByPublicId().fullTimeHoursPerMonth`, Task 7 strings, Task 1 `normalizedMonthlyBase`, `BASE_PAY_BASES`, `FULL_TIME_HOURS_MAX`, `defaultFullTimeHoursFor`.
- Produces: `useBasePayFormat(): (amount, basis, currency) => string` (money through `useMoney`, unit through `dashboard.people.payUnit.*`). Task 12 reuses it in the scatter hover.

- [ ] **Step 1: Failing tests**

`use-base-pay-format.test.tsx`: with `en` messages, `(195, "hourly", "SEK")` renders the `payUnit.hourly` message with the formatted money inside, `(32000, "monthly", "SEK")` the monthly one.

`add-salary-dialog.test.tsx` (mock `useQuery` -> `{ currency: "SEK", hoursPerMonth: 165, hoursSource: "country" }`): the existing save test sends `basis: "monthly", basicAmount: 50000`; a new test picks "hourly" in the basis select (`pickSelectOption` from `@/test/select`), types 195, sees the derived line (text "derivedMonthly" under the key-returning `t` mock), submits, and `setSalary` receives `basis: "hourly", basicAmount: 195`.

`person-detail.test.tsx`: an hourly record renders its base line through the unit format (assert the `payUnit.hourly` text is present) and a person with `fullTimeHoursPerMonth: 150` renders the `detail.fullTimeHours` label with "150"; a person without renders no such label.

`edit-person-dialog.test.tsx`: the hours field is optional (an empty field submits `fullTimeHoursPerMonth: null`), a typed 150 submits 150, 0 and 401 block submit, and the placeholder carries the org default.

- [ ] **Step 2: Implement**

`hooks/use-base-pay-format.ts`:

```ts
import type { BasePayBasis } from "@workspace/constants"
import { useTranslations } from "next-intl"
import { useMoney } from "@/hooks/use-money"

// A base-pay figure with its unit ("195 kr/h", "32 000 kr/mo"): the money
// through the app's one formatter, the unit through i18n. Every surface that
// shows a RAW base-pay figure (never a normalized one) formats through this.
export function useBasePayFormat() {
  const money = useMoney()
  const t = useTranslations("dashboard.people.payUnit")
  return (amount: number, basis: BasePayBasis, currency: string) =>
    t(basis, { amount: money(amount, currency) })
}
```

`add-salary-dialog.tsx`:
- Schema: `basis: z.enum(BASE_PAY_BASES)`, `basicAmount: z.number({ error: t("required") }).nonnegative()` (replacing `basicMonthly`); defaults `basis: "monthly", basicAmount: 0`.
- Replace the settings query with `const defaults = useQuery(api.people.pay.getPayDefaults, { orgId, personId })`; `currency = defaults?.currency`, `hours = defaults?.hoursPerMonth`.
- Fields: a full-width basis `FormField` FIRST (Select with the two `BASE_PAY_BASES` items labelled `t(\`basis.${basis}\`)`, aria-label `t("basis.label")`, `FormLabel` `t("basis.label")`), then the existing two-column row with `payYear` and the amount; the amount's label and aria-label are `basis === "hourly" ? t("hourlyAmount") : t("basicMonthly")` (`const basis = form.watch("basis")`); under the amount, when `basis === "hourly" && hours !== undefined && amount > 0`:

```tsx
<FormDescription>
  {t("derivedMonthly", { amount: money(normalizedMonthlyBase(amount, "hourly", hours), currency ?? ""), hours })}
</FormDescription>
```

(`FormDescription` from `@workspace/ui/components/form`, `money` from `useMoney`). Reserve the line's height with `min-h-5` on the description slot so toggling the basis does not reflow the footer (layout-shift rule).
- Submit sends `basis: values.basis, basicAmount: values.basicAmount`; the reset keeps the chosen basis.

`person-detail.tsx`: `const formatBasePay = useBasePayFormat()`; the base line becomes `formatBasePay(record.basicAmount, record.basis, record.currency)`; the identity `<dl>` gains, when `person.fullTimeHoursPerMonth != null`, a `<div><dt>{t("fullTimeHours")}</dt><dd>{person.fullTimeHoursPerMonth}</dd></div>`; the `PersonActionsMenu` person object gains `fullTimeHoursPerMonth: person.fullTimeHoursPerMonth`.

`edit-person-dialog.tsx`: `EditablePerson.fullTimeHoursPerMonth: number | null`; schema `fullTimeHoursPerMonth: z.number().positive().max(FULL_TIME_HOURS_MAX).optional()`; `toFormValues` maps `?? undefined`; a `FormField` after `ftePercent` with `FormLabel` `tForm("fullTimeHoursLabel")`, `NumberInput step="0.01" min={0} max={FULL_TIME_HOURS_MAX}` and `placeholder={tForm("fullTimeHoursPlaceholder", { hours })}` where `hours` is `settings.fullTimeHoursPerMonth ?? defaultFullTimeHoursFor(settings.country ?? undefined)` from `useQuery(api.accounts.organization.getOrganizationSettings, { orgId })` (placeholder "" while loading); submit sends `fullTimeHoursPerMonth: values.fullTimeHoursPerMonth ?? null`. `person-actions-menu.tsx` passes the field through unchanged.

- [ ] **Step 3: Run**

Run: `cd apps/dashboard && bunx vitest run hooks components/people` (PASS), `bunx tsc --noEmit`, `bunx biome check apps/dashboard/hooks apps/dashboard/components/people`.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(people): enter hourly pay with a basis, and a person's own full-time hours`.

---
### Task 11: The organization's full-time hours in settings

**Files:**
- Modify: `apps/dashboard/lib/organization-schemas.ts`
- Modify: `apps/dashboard/components/organization/organization-profile-form.tsx` (+ test)
- Modify: `apps/dashboard/app/(app)/organization/general/page.tsx`

**Interfaces:**
- Consumes: Task 4 settings query/mutation field, Task 7 strings and help, Task 1 `FULL_TIME_HOURS_MAX`, `defaultFullTimeHoursFor`.

- [ ] **Step 1: Failing tests**

`organization-profile-form.test.tsx` (initial gains `fullTimeHoursPerMonth: null`):
- the hours row renders with the label from `en.dashboard.organization.general.fullTimeHoursLabel`, the placeholder "Country default: 165" for country `se`, and a help button after the label;
- typing 160 enables save and `updateSettings` receives `fullTimeHoursPerMonth: 160`;
- clearing a pre-filled 160 sends `fullTimeHoursPerMonth: null`;
- 0 and 401 keep save disabled;
- the existing "unchanged form cannot save" test still passes.

Deviation from the spec, decided here: the spec sketched a titled "Pay" group holding currency and hours. The form has no titled groups; its anatomy is one `SettingsRow` per field with the help button after the row label (currency and language already do this). The hours row follows that anatomy instead of introducing a group.

- [ ] **Step 2: Implement**

`organization-schemas.ts`: `fullTimeHoursPerMonth: z.number().positive().max(FULL_TIME_HOURS_MAX).optional()`.

`page.tsx`: pass `fullTimeHoursPerMonth: settings.fullTimeHoursPerMonth` into `initial`.

`organization-profile-form.tsx`:
- `initial.fullTimeHoursPerMonth: number | null`; default value `props.initial.fullTimeHoursPerMonth ?? undefined`.
- A `FormField name="fullTimeHoursPerMonth"` right after the currency row, following the currency row's markup exactly (a `SettingsRow` with `align="center"`, the label a `<span className="flex items-center gap-1">` holding `FormLabel` `t("fullTimeHoursLabel")` and `<HelpMorphButton label={tHelp("fullTimeHoursLabel")}>{tHelp("fullTimeHoursBody")}</HelpMorphButton>`), the control a `NumberInput` with `step="0.01"`, `min={0}`, `max={FULL_TIME_HOURS_MAX}`, `aria-label={t("fullTimeHoursLabel")}`, `placeholder={t("fullTimeHoursPlaceholder", { hours: defaultFullTimeHoursFor(form.watch("country") || undefined) })}` and `{...numberInputField(field)}`, followed by `FormMessage`.
- Submit: the settings slice comparison includes the field; the mutation gets `fullTimeHoursPerMonth: values.fullTimeHoursPerMonth ?? null` when the slice changed.

- [ ] **Step 3: Run**

Run: `cd apps/dashboard && bunx vitest run components/organization` (PASS), `bunx tsc --noEmit`, `bunx biome check apps/dashboard/components/organization apps/dashboard/lib/organization-schemas.ts "apps/dashboard/app/(app)/organization"`.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(organization): a full-time hours per month default in settings`.

---

### Task 12: Pay-mapping surfaces: the hourly chip, the scatter mark, the method note

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/group-member-table.tsx` (+ test)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-scatter.tsx` (+ test)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (+ test)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-doc.tsx` (+ `pay-mapping-report-render.test.tsx`)

**Interfaces:**
- Consumes: Task 8 row fields and `fullTimeHoursDefault`, Task 7 strings, Task 10 `useBasePayFormat`.
- Produces: `PayMappingReportDoc.method.{hourlyRowCount, ownHoursCount}` and `PayMappingReportDoc.fullTimeHoursDefault`; `PayMappingReportLabels.hourlyNote: string | null`.

- [ ] **Step 1: Failing tests**

`group-member-table.test.tsx`: a row with `basis: "hourly"` renders the "Hourly" badge in its name cell and a monthly row does not; the skeleton-parity measurement test (if the file has one) still passes with the badge wrapped in a block flex container.

`pay-mapping-scatter.test.tsx`: the hover for an hourly row shows the basic line followed by the `hourlyMark` text; a monthly row shows none.

`pay-mapping-report-data.test.ts`: a run with two hourly rows (one with `hoursPerMonth` 150, one 165) and `fullTimeHoursDefault: 165` assembles `method.hourlyRowCount: 2`, `method.ownHoursCount: 1`, `fullTimeHoursDefault: 165`; a run with no hourly rows assembles `hourlyRowCount: 0`.

`pay-mapping-report-render.test.tsx`: with `hourlyRowCount > 0` the method section renders the hourly note text; with 0 it renders no such line.

Deviation from the spec, decided here: the spec had the report's member listing append "(hourly)"; the report lists no individuals (its individualNote says so), so the mark goes on the scatter hover's basic line instead, which is the one per-person surface that shows a base figure.

- [ ] **Step 2: Implement**

`group-member-table.tsx`: `MemberRow` gains `hourly: boolean` (`row.basis === "hourly"` in `buildMemberRows`); the name cell becomes

```tsx
<TableCell className="font-medium">
  {/* Block flex wrapper: an inline-flex Badge directly in the cell inflates
      the line box and desyncs the skeleton rows (skeleton-parity rule). */}
  <div className="flex min-w-0 items-center gap-2">
    <span className="truncate">{row.erased ? t("erased") : row.name}</span>
    {row.hourly && <Badge variant="outline">{tPayMapping("hourlyChip")}</Badge>}
  </div>
</TableCell>
```

(`Badge` from `@workspace/ui/components/badge`, `tPayMapping = useTranslations("dashboard.payMapping")`).

`pay-mapping-scatter.tsx`: the hover's basic line appends `{row.basis === "hourly" ? ` ${t("report.hourlyMark")}` : ""}` (or the payMapping namespace it already uses); the figure itself stays the normalized monthly base.

`pay-mapping-report-data.ts`: `assemblePayMappingReport` computes

```ts
  const hourlyRows = pricedRows.filter((row) => row.basis === "hourly")
  const ownHoursCount = hourlyRows.filter(
    (row) => row.hoursPerMonth !== undefined && row.hoursPerMonth !== run.fullTimeHoursDefault
  ).length
```

and puts `hourlyRowCount: hourlyRows.length`, `ownHoursCount` on `method`, plus `fullTimeHoursDefault: run.fullTimeHoursDefault` on the doc (type additions on `PayMappingReportDoc`).

`pay-mapping-report-export.tsx`: `hourlyNote: doc.method.hourlyRowCount > 0 ? t("hourlyNote", { hours: doc.fullTimeHoursDefault, count: doc.method.ownHoursCount }) : null` in the labels object; `PayMappingReportLabels.hourlyNote: string | null`.

`pay-mapping-report-doc.tsx`: after the `measuresNote` line, `{labels.hourlyNote !== null && <Text style={s.note}>{labels.hourlyNote}</Text>}`.

- [ ] **Step 3: Run**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping` (PASS), `bunx tsc --noEmit`, `bunx biome check apps/dashboard/components/pay-mapping`.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message when approved: `feat(pay-mapping): mark hourly-paid rows and state the conversion factor in the report`.

---
### Task 13: ADR-0029, the user guide in five locales, the requirements note

**Files:**
- Create: `docs/adr/0029-timlon-en-analysbas-heltidstimmar.md`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/importing-people.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/supported-payroll-exports.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/person-details-and-salary.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/organization-settings.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/pay-mapping-overview.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/troubleshooting-people-and-import.mdx`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/glossary.mdx`
- Modify: `docs/lonekartlaggning-rapport-kravbild.md`

**Interfaces:**
- Consumes: the shipped behaviour of Tasks 1 to 12 (write from the code, not from the spec's intentions).
- Guards: `apps/dashboard/lib/docs/docs-guards.test.ts` (locale parity, anchors, links); `bun run docs:sync` at the end.

- [ ] **Step 1: ADR-0029 (Swedish, the ADR-0028 shape: title, Status line, context paragraph, Beslut, Konsekvenser, Alternativ som avvisades)**

Title: `# Timlön: en analysbas, heltidstimmar per organisation med personöverstyrning`. Status: `accepterad 2026-09-02 (ägarbeslut)`. Context: the mixed Lön column, the sign-flip example, DL 3 kap. 8-9 §§ and art. 3.1. Beslut (four numbered): (1) en analysbas, FTE-justerad månadslön, timlön × heltidstimmar, ingen FTE-justering på timrader, ingen basväljare per körning; (2) `basis` + `basicAmount` på löneposten, månadsvärdet härleds vid läsning (ADR-0002:s anda), snapshoten fryser rått + bas + timmar + normaliserat (ADR-0011); (3) heltidstimmar: person → organisation → landets standard, `resolveFullTimeHours` som enda regel; (4) importen tolkar Lön-kolumnen efter löneform, synligt och avstängbart, med mjuka rimlighetsnotiser. Konsekvenser: schemaändringen utan migrering (pre-launch reset), rapportens metodnot, audit (`basis` kodat, beloppsfritt), vad som skjuts upp (`yearlyPayouts`, basväljare per körning, timmarnas historik). Alternativ som avvisades: lagrat månadsvärde, timlön på personen, Sysarbs basväljare, timavlönade som egen population, kräva Timlön-kolumn.

- [ ] **Step 2: The guide, English first, then the four locales**

`importing-people.mdx`: in the Map-step bullet, mention the two optional columns ("Hourly rate" and "Full-time hours per month") and that the hourly-rate column has no per-month/per-year choice; a new paragraph or bullet in the Review step: a row whose employment type is hourly has its salary amount read as an hourly rate, listed under "Hourly pay" with a checkbox (on by default) to switch that off for this import, plus the three "worth a look" notices and what each means; the done screen's "Read as hourly pay" count.

`supported-payroll-exports.mdx`: a section "One salary column for monthly and hourly pay" describing the common Swedish layout and how blueprnt reads it by the employment-type column.

`person-details-and-salary.mdx`: the salary dialog's pay basis (Monthly salary / Hourly pay), the derived monthly line, the salary rail's base figure with its unit, and the identity block's "Full-time hours" shown only when the person has a value of their own (set from "Edit employee").

`organization-settings.mdx`: a section "Full-time hours per month": what it converts, the country default shown as the placeholder, that a person's own value overrides it, and that a change reaches live views immediately while frozen pay mappings keep the value they were made with.

`pay-mapping-overview.mdx` (the FTE-adjustment paragraph, or the nearest place the measure is explained): hourly pay is converted (rate times full-time hours) and not FTE-adjusted again; the method note names the factor and how many people had their own value.

`troubleshooting-people-and-import.mdx`: under "The importer flagged problems with my data", the three hourly notices and what to do (fix the employment-type column, map the dedicated column, or untick the interpretation).

`glossary.mdx`: entries "Hourly pay" (boundary against monthly salary and FTE) and "Full-time hours per month" (boundary against FTE share), alphabetically placed, each two short paragraphs like the neighbours.

Every locale is written directly at production quality (glossary terms: sv timlön/heltidstimmar per månad, nb timelønn/heltidstimer per måned, da timeløn/fuldtidstimer pr. måned, fi tuntipalkka/kokoaikatunnit kuukaudessa). No em dashes. Keep slugs and anchors locale-invariant.

- [ ] **Step 3: The requirements note**

`docs/lonekartlaggning-rapport-kravbild.md` line 72: replace "bruttoårslön/timlön-normalisering" in the "Vad som saknas" list with a sentence in "Vad vi redan har": "timlön normaliseras till heltidsekvivalent månadslön med frysta heltidstimmar per rad (ADR-0029)"; bruttoårslön (annual gross) stays listed as missing.

- [ ] **Step 4: Guards and sync**

Run: `cd apps/dashboard && bunx vitest run lib/docs` (PASS), `grep -rnP '\x{2014}' apps/dashboard/content/docs docs/adr/0029-*.md` (nothing), then `cd apps/dashboard && bun run docs:sync` and paste its per-page output in the report.

- [ ] **Step 5: Present the diff (no commit)**

Proposed messages when approved: `docs(adr): ADR-0029, hourly pay on one analysis basis with frozen full-time hours` and `docs(guide): hourly pay in the import, the salary dialog, settings and the method note`.

---

### Task 14: Dev deployment reset and browser verification (controller-run)

**Files:** none (verification only).

- [ ] **Step 1: Reset and push**

`cd packages/backend && bunx convex run seed:resetDatabase` (the schema change has no migration by design: pre-launch, no legacy), then `bunx convex dev --once`. If the CLI answers "You don't have access to the selected project", stop and ask the owner to run `npx convex login` (their account, not fixable from here).

- [ ] **Step 2: Browser pass on localhost:3001 (Chrome extension, the owner's Browser 1)**

1. Settings, General: the hours row shows "Country default: 165"; set 160, save, see the toast; clear it, save.
2. Import the mixed file (build it from `packages/import/fixtures/visma-sv-hourly.csv` or the corrected Christian fixture with a handful of rows switched to Timanställd and rates around 195): Map step shows no per-month/per-year select on a Timlön column if one is mapped; Review step shows the Hourly pay group with the interpreted list, the checkbox on, and (with a 32000 planted on an hourly-typed row) the "hourly rate looks like a monthly salary" notice; untick the box and see the counts re-run; tick it again; confirm; the done screen shows "Read as hourly pay".
3. Person page of an hourly-paid person: the salary rail shows "195 kr/h" and the total as the monthly figure; Add salary with basis Hourly shows the derived line while typing; Edit employee sets full-time hours 150 and the identity block shows it; the salary rail's total updates.
4. Start a pay mapping: the member table shows the "Hourly" chip on those rows, the scatter places them on the converted figure and the hover carries "(hourly)", the report PDF's method chapter has the hourly note with the hours and the own-value count.
5. Audit log: the salary row reads "Pay basis: Hourly pay", the settings row reads the hours change, the import row reads "Read as hourly pay: N", the person row reads "Full-time hours per month: (empty) -> 150".

- [ ] **Step 3: Report**

The file-by-file change summary for the whole slice, grouped by area, with the browser findings and anything left out and why.

---

---

## Deviations recorded after execution

Decided during execution and review; the code is the authority where the tasks above say otherwise.

- `hoursSource` was removed from the salary wire shapes and from `getPayDefaults` (no surface consumed it); `resolveFullTimeHours` returns `{ hoursPerMonth }` only.
- The organization's full-time hours are a stored value from the moment the organization gets a country: `updateOrganizationSettings` seeds the country default when none is stored and re-derives it when the country changes without an explicit value; the null-clears path is gone; `getOrganizationSettings` returns the resolved number and the settings form field is required. The settings row keeps the form's existing anatomy (no titled group).
- The done-screen row and audit field count hourly pay records actually SAVED ("Hourly pay records saved"), counted in `importChunk` when a salary was created.
- An unreadable cell in the optional hourly-rate column is a soft `unparsableHourlyRate` notice; a negative one stays hard.
- The scatter hover shows the raw rate in parentheses after the normalized base for hourly rows (no "(hourly)" mark, no `hourlyMark` key); the report lists no individuals.
- The "/h" unit suffix inside the hourly amount input was not implemented; the label "Hourly rate" carries the unit.
- The pay-basis help renders after the salary dialog's title; the edit-person dialog carries no new help.
- The derived monthly line sits full width below the two-column grid; the review step keeps the previous preview mounted through a re-run with a sequence guard and a failed-re-run revert.
- The map table is `table-fixed` with declared column widths so it fits its container.
