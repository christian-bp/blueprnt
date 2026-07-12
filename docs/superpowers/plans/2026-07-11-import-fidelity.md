# Import Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an imported payroll file produce faithful monthly pay figures by adding a per-column annual/monthly basis, ingesting the full pay-component set as separate components, and capturing employment type.

**Architecture:** Pure normalization primitives (`toMonthly`, `normalizeEmploymentType`, `defaultBasis`) live in `@workspace/constants` and `@workspace/import` and are shared by the real import and the dry-run preview so they cannot diverge. Everything normalizes to monthly at ingestion, so `payRecords` and the TCC formula (`totalMonthlyComp`) keep their current shape; the basis choice is consumed during ingestion and persisted only on the mapping profile. The import wizard's Map step gains a per-money-column monthly/annual toggle, seeded from the field default and annual-flavoured header synonyms.

**Tech Stack:** Convex (edge-runtime + convex-test), TypeScript monorepo (Turborepo, Bun), Vitest 4, Next.js 16 App Router, shadcn/Base UI, next-intl.

## Global Constraints

- **Tests:** Vitest 4 only. Run with `bun run test` (never `bun test`). New code ships with tests in the same commit; the pre-commit hook runs the full `turbo run test`.
- **i18n:** Add every new UI string to `packages/i18n/messages/en.json` first (the `Messages` type is generated from it), then mirror the identical key set to `sv.json`, `nb.json`, `da.json`, `fi.json` (parity-guarded). Nordic/Swedish drafts are flagged for native review.
- **Storage invariant:** `payRecords` stores monthly amounts only; `components` stay `{ kind, monthlyAmount }`; `totalMonthlyComp` is unchanged. The `basis` decision is consumed at ingestion, never stored on `payRecords`.
- **No migration:** Pre-launch, new schema fields are optional and dev/prod data is reset, not migrated (no legacy before launch).
- **Typing/DRY:** No `any`; no duplicated literals/shapes; field key ≡ pay-component kind is an invariant. Convex functions use object form and stay org-scoped.
- **Style:** Biome format; use `@workspace/ui` components (Select). Commit messages use conventional prefixes; no AI attribution.
- **ASCII note:** `columnMap` is passed to the action as array-of-`[sourceHeader, canonicalKey]` pairs because Convex forbids non-ASCII `v.record()` keys (Swedish headers). `basisMap` keys are canonical field keys (always ASCII: `basicMonthly`, `variable`, …), so `basisMap` is a safe `v.record`.

---

### Task 1: Pay-basis primitives in `@workspace/constants`

**Files:**
- Modify: `packages/constants/src/pay.ts`
- Modify: `packages/constants/src/index.ts` (add exports)
- Test: `packages/constants/src/pay.test.ts`

**Interfaces:**
- Produces: `PAY_BASIS: readonly ["monthly","annual"]`, `type PayBasis`, `toMonthly(amount: number, basis: PayBasis): number`, `DEFAULT_BASIS_BY_FIELD: Record<"basicMonthly" | PayComponentKind, PayBasis>`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/constants/src/pay.test.ts` (import the new symbols at the top of the file alongside the existing `PAY_COMPONENT_KINDS` import):

```ts
import {
  DEFAULT_BASIS_BY_FIELD,
  PAY_BASIS,
  PAY_COMPONENT_KINDS,
  toMonthly,
} from "./pay"

describe("toMonthly", () => {
  it("passes a monthly amount through unchanged", () => {
    expect(toMonthly(50000, "monthly")).toBe(50000)
  })
  it("divides an annual amount by 12", () => {
    expect(toMonthly(120000, "annual")).toBe(10000)
  })
})

describe("DEFAULT_BASIS_BY_FIELD", () => {
  it("defaults base salary to monthly and bonus/variable to annual", () => {
    expect(DEFAULT_BASIS_BY_FIELD.basicMonthly).toBe("monthly")
    expect(DEFAULT_BASIS_BY_FIELD.variable).toBe("annual")
    expect(DEFAULT_BASIS_BY_FIELD.bonus).toBe("annual")
    expect(DEFAULT_BASIS_BY_FIELD.benefitInKind).toBe("monthly")
  })
  it("has a basis for basicMonthly and every pay component kind", () => {
    expect(PAY_BASIS).toEqual(["monthly", "annual"])
    for (const kind of PAY_COMPONENT_KINDS) {
      expect(DEFAULT_BASIS_BY_FIELD[kind]).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/constants`
Expected: FAIL — `toMonthly`, `PAY_BASIS`, `DEFAULT_BASIS_BY_FIELD` are not exported.

- [ ] **Step 3: Implement the primitives**

Append to `packages/constants/src/pay.ts` (after the existing `fteTotalMonthlyComp`):

```ts
// Whether a mapped pay column is expressed per month or per year. Annual
// columns are divided by 12 at import ingestion so payRecords stays monthly.
export const PAY_BASIS = ["monthly", "annual"] as const
export type PayBasis = (typeof PAY_BASIS)[number]

// Pure helper: normalize an amount to a monthly figure. No I/O, no clock reads.
export function toMonthly(amount: number, basis: PayBasis): number {
  return basis === "annual" ? amount / 12 : amount
}

// Default basis per money field, used when the import mapping does not specify
// one (an annual-flavoured header can still override this client-side; see
// @workspace/import defaultBasis). Bonus/variable/equity are typically annual.
export const DEFAULT_BASIS_BY_FIELD: Record<
  "basicMonthly" | PayComponentKind,
  PayBasis
> = {
  basicMonthly: "monthly",
  variable: "annual",
  bonus: "annual",
  benefitInKind: "monthly",
  fixedSupplement: "monthly",
  allowance: "monthly",
  equity: "annual",
  other: "monthly",
}
```

Add to the `./pay` export block in `packages/constants/src/index.ts`:

```ts
export {
  DEFAULT_BASIS_BY_FIELD,
  PAY_BASIS,
  PAY_COMPONENT_KINDS,
  type PayBasis,
  type PayComponentKind,
  fteTotalMonthlyComp,
  toMonthly,
  totalMonthlyComp,
} from "./pay"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/constants`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/constants/src/pay.ts packages/constants/src/index.ts packages/constants/src/pay.test.ts
git commit -m "feat(constants): add pay-basis primitives (toMonthly, DEFAULT_BASIS_BY_FIELD)"
```

---

### Task 2: Employment-type primitives in `@workspace/constants`

**Files:**
- Create: `packages/constants/src/employment.ts`
- Modify: `packages/constants/src/index.ts` (add exports)
- Test: `packages/constants/src/employment.test.ts`

**Interfaces:**
- Produces: `EMPLOYMENT_TYPES: readonly ["permanent","fixedTerm","substitute","hourly"]`, `type EmploymentType`, `normalizeEmploymentType(raw: string): EmploymentType | null`.

- [ ] **Step 1: Write the failing tests**

Create `packages/constants/src/employment.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { EMPLOYMENT_TYPES, normalizeEmploymentType } from "./employment"

describe("normalizeEmploymentType", () => {
  it("maps Swedish/Nordic/English terms to canonical values", () => {
    expect(normalizeEmploymentType("Tillsvidare")).toBe("permanent")
    expect(normalizeEmploymentType("fast anställning")).toBe("permanent")
    expect(normalizeEmploymentType("Visstid")).toBe("fixedTerm")
    expect(normalizeEmploymentType("Vikariat")).toBe("substitute")
    expect(normalizeEmploymentType("Timanställd")).toBe("hourly")
    expect(normalizeEmploymentType("Permanent")).toBe("permanent")
  })
  it("returns null for blank or unrecognised input", () => {
    expect(normalizeEmploymentType("")).toBeNull()
    expect(normalizeEmploymentType("konsult")).toBeNull()
  })
  it("exposes the four canonical types", () => {
    expect(EMPLOYMENT_TYPES).toEqual([
      "permanent",
      "fixedTerm",
      "substitute",
      "hourly",
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/constants`
Expected: FAIL — module `./employment` not found.

- [ ] **Step 3: Implement the normalizer**

Create `packages/constants/src/employment.ts`:

```ts
// Canonical employment-type (anställningsform) values for pay-mapping grouping
// (Del 3.3 #10). Persisted on the people row; never repurpose an existing value.
export const EMPLOYMENT_TYPES = [
  "permanent",
  "fixedTerm",
  "substitute",
  "hourly",
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

// Folded synonyms per canonical type (lowercased, diacritics/non-alphanumerics
// stripped). Substring match, so "fast anställning" folds to "fastanstallning"
// and matches "fast". Mirrors the folding in @workspace/import fields.fold;
// kept local to avoid a package dependency for five lines.
const EMPLOYMENT_TYPE_SYNONYMS: Record<EmploymentType, readonly string[]> = {
  permanent: ["tillsvidare", "fast", "permanent", "vakinaisuus", "vakituinen"],
  fixedTerm: ["visstid", "tidsbegransad", "temporary", "fixedterm", "midlertidig", "maaraaikainen"],
  substitute: ["vikariat", "vikarie", "vikar", "substitute", "sijaisuus"],
  hourly: ["tim", "hourly", "timelonn", "tuntityo"],
}

const PRE_NFD: ReadonlyArray<readonly [RegExp, string]> = [
  [/[øØ]/g, "o"],
  [/[æÆ]/g, "ae"],
]

function fold(s: string): string {
  let out = s
  for (const [pattern, replacement] of PRE_NFD) out = out.replace(pattern, replacement)
  return out
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

// Map a raw payroll string to a canonical employment type, or null when blank
// or unrecognised (soft: the import leaves the field unset, never blocks a row).
export function normalizeEmploymentType(raw: string): EmploymentType | null {
  const f = fold(raw)
  if (!f) return null
  for (const type of EMPLOYMENT_TYPES) {
    if (EMPLOYMENT_TYPE_SYNONYMS[type].some((syn) => f.includes(syn))) {
      return type
    }
  }
  return null
}
```

Add to `packages/constants/src/index.ts`:

```ts
export {
  EMPLOYMENT_TYPES,
  type EmploymentType,
  normalizeEmploymentType,
} from "./employment"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/constants`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/constants/src/employment.ts packages/constants/src/index.ts packages/constants/src/employment.test.ts
git commit -m "feat(constants): add employment-type normalizer"
```

---

### Task 3: Import fields (component kinds, employmentType, defaultBasis)

**Files:**
- Modify: `packages/import/package.json` (add `@workspace/constants` dependency)
- Modify: `packages/import/src/fields.ts`
- Modify: `packages/import/src/index.ts` (export `defaultBasis`, `ANNUAL_HINT`, `type PayBasis`)
- Test: `packages/import/src/detect.test.ts` (new cases) and `packages/import/src/fields.test.ts` (create if absent)

**Interfaces:**
- Consumes: `DEFAULT_BASIS_BY_FIELD`, `type PayBasis` from `@workspace/constants` (Task 1).
- Produces: canonical fields `bonus`, `fixedSupplement`, `allowance`, `equity`, `other` (money), `employmentType` (new shape); `ANNUAL_HINT: readonly string[]`; `defaultBasis(fieldKey: string, rawHeader: string): PayBasis`.

- [ ] **Step 1: Add the constants dependency**

`@workspace/constants` is a leaf package, so `@workspace/import` may depend on it (valid layering). Add to `packages/import/package.json` `dependencies`:

```json
"@workspace/constants": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Write the failing tests**

Create `packages/import/src/fields.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { defaultBasis } from "./fields"

describe("defaultBasis", () => {
  it("uses the field default when the header has no annual hint", () => {
    expect(defaultBasis("basicMonthly", "Månadslön")).toBe("monthly")
    expect(defaultBasis("bonus", "Bonus")).toBe("annual")
  })
  it("returns annual when the header itself implies an annual figure", () => {
    expect(defaultBasis("basicMonthly", "Årslön")).toBe("annual")
    expect(defaultBasis("basicMonthly", "Annual salary")).toBe("annual")
  })
})
```

Add to `packages/import/src/detect.test.ts` a case asserting the new synonyms detect (mirror the file's existing `detectColumns` assertions):

```ts
it("detects new component and employment-type columns", () => {
  const { map } = detectColumns({
    headers: ["Bonus", "Anställningsform", "Aktier"],
    rows: [["10000", "Tillsvidare", "5000"]],
    headerless: false,
    currentYear: 2026,
  })
  expect(map.bonus?.columnIndex).toBe(0)
  expect(map.employmentType?.columnIndex).toBe(1)
  expect(map.equity?.columnIndex).toBe(2)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test --filter=@workspace/import`
Expected: FAIL — `defaultBasis` not exported; `map.bonus`/`map.employmentType`/`map.equity` undefined.

- [ ] **Step 4: Add the fields, ANNUAL_HINT, and defaultBasis**

In `packages/import/src/fields.ts`:

1. Add `"employmentType"` to the `ValueShape` union.
2. Add these entries to the `FIELDS` array (after the existing `benefitInKind` entry; keep `variable` and `benefitInKind` as-is):

```ts
{
  key: "bonus",
  tier: "optional",
  shape: "money",
  synonyms: ["bonus", "arsbonus", "annualbonus", "yearbonus", "resultatbonus", "malbonus"],
},
{
  key: "fixedSupplement",
  tier: "optional",
  shape: "money",
  synonyms: ["fasttillagg", "fixedsupplement", "fastlonetillagg", "fasttillaegg", "lonetillagg"],
},
{
  key: "allowance",
  tier: "optional",
  shape: "money",
  synonyms: ["ersattning", "allowance", "obtillagg", "skifttillagg", "traktamente", "tillaeg"],
},
{
  key: "equity",
  tier: "optional",
  shape: "money",
  synonyms: ["aktier", "equity", "optioner", "aktieprogram", "incitament", "aksjer"],
},
{
  key: "other",
  tier: "optional",
  shape: "money",
  synonyms: ["ovrigersattning", "ovrigttillagg", "otheraddition", "othercomp", "annengodtgjorelse"],
},
{
  key: "employmentType",
  tier: "recommended",
  shape: "employmentType",
  synonyms: ["anstallningsform", "anstform", "employmenttype", "employmentform", "contracttype", "ansettelsesform", "ansaettelsesform", "palvelussuhde"],
},
```

3. Append the basis helper (after `CANONICAL_FIELDS`):

```ts
import { DEFAULT_BASIS_BY_FIELD, type PayBasis } from "@workspace/constants"

// Folded header fragments that imply an annual figure regardless of the field
// (e.g. an "Årslön" column mapped to base salary). Used to seed the Map-step
// basis toggle to "annual" so the common annual-column case is one click.
export const ANNUAL_HINT: readonly string[] = [
  "arslon", "arslonn", "annualsalary", "yearlysalary", "grosssalary",
  "arsbonus", "annualbonus", "arsinkomst", "arsersattning",
].map(fold)

// Pure: the default monthly/annual basis for a mapped money column. An
// annual-flavoured header wins; otherwise the field's default; otherwise
// monthly. Used client-side (Map step) to seed the toggle.
export function defaultBasis(fieldKey: string, rawHeader: string): PayBasis {
  const folded = fold(rawHeader)
  if (ANNUAL_HINT.some((hint) => folded.includes(hint))) return "annual"
  return (
    DEFAULT_BASIS_BY_FIELD[fieldKey as keyof typeof DEFAULT_BASIS_BY_FIELD] ??
    "monthly"
  )
}
```

4. In `packages/import/src/index.ts`, add `defaultBasis`, `ANNUAL_HINT` to the exports and re-export the basis type: `export type { PayBasis } from "@workspace/constants"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test --filter=@workspace/import`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/import/package.json packages/import/src/fields.ts packages/import/src/index.ts packages/import/src/fields.test.ts packages/import/src/detect.test.ts bun.lock
git commit -m "feat(import): add component-kind + employmentType fields and defaultBasis"
```

---

### Task 4: employmentType in the shared import diff

**Files:**
- Modify: `packages/backend/convex/people/importDiff.ts`
- Test: `packages/backend/convex/people/importDiff.test.ts`

**Interfaces:**
- Produces: `PERSON_IMPORT_OPTIONAL_FIELDS` includes `"employmentType"`; `PersonImportValues.employmentType?: EmploymentType`.
- Consumes: `type EmploymentType` from `@workspace/constants` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/convex/people/importDiff.test.ts`:

```ts
it("emits an employmentType change in the person patch", () => {
  const patch = personImportPatch(
    { displayName: "A", gender: "Kvinna" },
    { displayName: "A", gender: "Kvinna", employmentType: "permanent" }
  )
  expect(patch.employmentType).toBe("permanent")
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/backend -- importDiff`
Expected: FAIL — `employmentType` not in `PersonImportValues` (type error) / not copied by the patch loop.

- [ ] **Step 3: Add employmentType to the shared field set and interface**

In `packages/backend/convex/people/importDiff.ts`:

```ts
import type { EmploymentType } from "@workspace/constants"

export const PERSON_IMPORT_OPTIONAL_FIELDS = [
  "birthDate",
  "employmentStartDate",
  "ftePercent",
  "country",
  "isManager",
  "statisticalCode",
  "department",
  "title",
  "employmentType",
] as const
```

Add the field to `PersonImportValues`:

```ts
export interface PersonImportValues {
  displayName: string
  gender: "Man" | "Kvinna"
  birthDate?: string
  employmentStartDate?: string
  ftePercent?: number
  country?: string
  isManager?: boolean
  statisticalCode?: string
  department?: string
  title?: string
  employmentType?: EmploymentType
}
```

The `personImportPatch` loop and `diffImport` pick the field up automatically (no other change needed here).

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/backend -- importDiff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/people/importDiff.ts packages/backend/convex/people/importDiff.test.ts
git commit -m "feat(people): thread employmentType through the import diff"
```

---

### Task 5: Ingest — basis normalization, full components, employmentType

**Files:**
- Modify: `packages/backend/convex/people/tables.ts` (add `people.employmentType`)
- Modify: `packages/backend/convex/people/import.ts` (action `basisMap` arg + prepareImport)
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes: `toMonthly`, `DEFAULT_BASIS_BY_FIELD`, `normalizeEmploymentType`, `PAY_COMPONENT_KINDS`, `type PayBasis` from `@workspace/constants`; `PersonImportValues` (Task 4).
- Produces: `importPayroll` / `previewImport` accept optional `basisMap: Record<string, "monthly" | "annual">`; a `payRecords` row's `components` carry every mapped kind, monthly-normalized; `people.employmentType` is set from the normalized column.

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/convex/people/import.test.ts` (uses the existing `seedOrg` helper and an inline CSV; `columnMap` is array-of-pairs, `basisMap` is a record keyed by canonical field):

```ts
describe("importPayroll (basis + components + employmentType)", () => {
  const CSV = [
    "Anstnr,Kon,Manadslon,Arsbonus,Anstallningsform",
    "E1,Kvinna,40000,120000,Tillsvidare",
  ].join("\n")
  const MAP: string[][] = [
    ["Anstnr", "externalRef"],
    ["Kon", "gender"],
    ["Manadslon", "basicMonthly"],
    ["Arsbonus", "bonus"],
    ["Anstallningsform", "employmentType"],
  ]

  it("divides an annual bonus by 12 and stores it as a separate component", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: CSV,
      columnMap: MAP,
      importId: "run-basis-1",
      basisMap: { basicMonthly: "monthly", bonus: "annual" },
    })

    await t.run(async (ctx) => {
      const pay = await ctx.db.query("payRecords").collect()
      expect(pay).toHaveLength(1)
      expect(pay[0]?.basicMonthly).toBe(40000)
      const bonus = pay[0]?.components.find((c) => c.kind === "bonus")
      expect(bonus?.monthlyAmount).toBe(10000) // 120000 / 12

      const people = await ctx.db.query("people").collect()
      expect(people[0]?.employmentType).toBe("permanent")
    })
  })

  it("defaults basicMonthly to monthly when basisMap omits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: CSV,
      columnMap: MAP,
      importId: "run-basis-2",
      // no basisMap: base salary falls back to DEFAULT_BASIS_BY_FIELD (monthly)
    })
    await t.run(async (ctx) => {
      const pay = await ctx.db.query("payRecords").collect()
      expect(pay[0]?.basicMonthly).toBe(40000)
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/backend -- import.test`
Expected: FAIL — `basisMap` is not a valid arg (validator rejects it), and `employmentType`/`bonus` are not ingested.

- [ ] **Step 3a: Add the schema field**

In `packages/backend/convex/people/tables.ts`, add to the `people` table definition (mirrors the `gender` literal-union style; keep the values in sync with `EMPLOYMENT_TYPES`):

```ts
// Anställningsform. Canonical values mirror @workspace/constants EMPLOYMENT_TYPES.
employmentType: v.optional(
  v.union(
    v.literal("permanent"),
    v.literal("fixedTerm"),
    v.literal("substitute"),
    v.literal("hourly")
  )
),
```

- [ ] **Step 3b: Add the action arg**

In `packages/backend/convex/people/import.ts`, add to BOTH the `importPayroll` and `previewImport` action `args` validators:

```ts
basisMap: v.optional(
  v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual")))
),
```

Thread `args.basisMap` into the `prepareImport(...)` call in each action (add a `basisMap` parameter to `prepareImport`'s signature/args object).

- [ ] **Step 3c: Normalize in prepareImport**

In `packages/backend/convex/people/import.ts`, add the imports:

```ts
import {
  DEFAULT_BASIS_BY_FIELD,
  PAY_COMPONENT_KINDS,
  normalizeEmploymentType,
  toMonthly,
  type PayBasis,
} from "@workspace/constants"
```

Inside `prepareImport`, next to the other `colOf(...)` lines, add:

```ts
const employmentTypeCol = colOf("employmentType")

const basisOf = (key: string): PayBasis =>
  (basisMap?.[key] as PayBasis | undefined) ??
  DEFAULT_BASIS_BY_FIELD[key as keyof typeof DEFAULT_BASIS_BY_FIELD] ??
  "monthly"
```

Replace the basic-salary normalization so it applies the basis:

```ts
const parsedBasic = basicMonthlyRaw ? parseMoney(basicMonthlyRaw) : null
const basicMonthly =
  parsedBasic === null ? null : toMonthly(parsedBasic, basisOf("basicMonthly"))
```

Replace the hardcoded `variable` + `benefit` component block (the current lines ~369-382) with a loop over every component kind (field key ≡ kind):

```ts
const components: Array<{ kind: string; monthlyAmount: number }> = []
for (const kind of PAY_COMPONENT_KINDS) {
  const col = colOf(kind)
  if (col === undefined) continue
  const raw = cell(col)
  if (!raw) continue
  const parsed = parseMoney(raw)
  if (parsed === null || parsed <= 0) continue
  components.push({ kind, monthlyAmount: toMonthly(parsed, basisOf(kind)) })
}
```

Add employmentType resolution next to the other optional person fields:

```ts
const employmentType =
  normalizeEmploymentType(cell(employmentTypeCol)) ?? undefined
```

And add it to the `person` object built into `normalized.push({ person: { ... } })`, using the same spread-if-defined pattern as `department`/`title`:

```ts
...(employmentType !== undefined ? { employmentType } : {}),
```

- [ ] **Step 3d: Include employmentType in the stored-person baseline**

Find where the upsert / preview reads the existing person's fields into `StoredPersonValues` (the `by_org_externalRef` lookup projection). Add `employmentType: existingPerson.employmentType` to that projection so a re-import correctly diffs the field (mirrors how `department` is read).

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/backend -- import.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/people/tables.ts packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts
git commit -m "feat(people): normalize pay basis, ingest all components + employmentType"
```

---

### Task 6: Persist basisMap on the import mapping profile

**Files:**
- Modify: `packages/backend/convex/people/tables.ts` (add `importMappingProfiles.basisMap`)
- Modify: `packages/backend/convex/people/importProfile.ts`
- Modify: `packages/backend/convex/people/import.ts` (pass basisMap to the profile save)
- Test: `packages/backend/convex/people/importProfile.test.ts`

**Interfaces:**
- Produces: `saveImportMappingProfile` / `internalSaveImportMappingProfile` accept optional `basisMap`; `getImportMappingProfile` returns it.

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/convex/people/importProfile.test.ts` (mirror the file's existing seed + save + read pattern):

```ts
it("round-trips basisMap on the mapping profile", async () => {
  const t = initConvexTest()
  const { orgId, asAdmin } = await seedOrg(t)
  await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
    orgId,
    columnMap: { basicMonthly: "Manadslon", bonus: "Arsbonus" },
    basisMap: { basicMonthly: "monthly", bonus: "annual" },
  })
  const profile = await asAdmin.query(
    api.people.importProfile.getImportMappingProfile,
    { orgId }
  )
  expect(profile?.basisMap?.bonus).toBe("annual")
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/backend -- importProfile`
Expected: FAIL — `basisMap` rejected by the mutation validator.

- [ ] **Step 3a: Schema**

In `packages/backend/convex/people/tables.ts`, add to `importMappingProfiles`:

```ts
// Per-money-column basis (monthly | annual), keyed by canonical field. ASCII
// keys, so a record is safe (unlike columnMap's non-ASCII source headers).
basisMap: v.optional(
  v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual")))
),
```

- [ ] **Step 3b: Profile mutations**

In `packages/backend/convex/people/importProfile.ts`, add `basisMap` to `profileShape`, to the `args` of `saveImportMappingProfile` and `internalSaveImportMappingProfile`, to the insert/patch bodies (spread-if-defined like `parseRules`), and to the change-detection compare (a `basisMapChanged` check alongside `columnMapChanged`/`parseRulesChanged`):

```ts
basisMap: v.optional(
  v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual")))
),
```

```ts
const basisMapChanged =
  JSON.stringify(args.basisMap ?? null) !==
  JSON.stringify(existing.basisMap ?? null)
if (!columnMapChanged && !parseRulesChanged && !basisMapChanged) return null
// ...include basisMap in the patch when changed
```

- [ ] **Step 3c: Save basisMap during import**

In `packages/backend/convex/people/import.ts`, where the import already calls the profile save (persisting `columnMap`), also pass `basisMap: args.basisMap` (omit-if-undefined).

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/backend -- importProfile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/people/tables.ts packages/backend/convex/people/importProfile.ts packages/backend/convex/people/import.ts packages/backend/convex/people/importProfile.test.ts
git commit -m "feat(people): persist per-column pay basis on the import profile"
```

---

### Task 7: i18n keys for the basis toggle and new fields

**Files:**
- Modify: `packages/i18n/messages/en.json` (source)
- Modify: `packages/i18n/messages/{sv,nb,da,fi}.json`
- Test: the existing `packages/i18n` parity test (run it)

**Interfaces:**
- Produces: `dashboard.people.import.map.{basisHeader,basisMonthly,basisAnnual}` and `dashboard.people.import.fields.{bonus,fixedSupplement,allowance,equity,other,employmentType}`.

- [ ] **Step 1: Add keys to `en.json` (source)**

Under `dashboard.people.import.map` add:

```json
"basisHeader": "Amount is",
"basisMonthly": "Per month",
"basisAnnual": "Per year"
```

Under `dashboard.people.import.fields` add:

```json
"bonus": "Bonus",
"fixedSupplement": "Fixed supplement",
"allowance": "Allowance",
"equity": "Equity",
"other": "Other pay component",
"employmentType": "Employment type"
```

- [ ] **Step 2: Mirror the identical keys into `sv/nb/da/fi`**

Use these drafts (Swedish is a live locale; nb/da/fi flagged for native review). `map.basisHeader / basisMonthly / basisAnnual`, then the six `fields.*` in the same order:

| key | sv | nb | da | fi |
|---|---|---|---|---|
| basisHeader | Beloppet är | Beløpet er | Beløbet er | Summa on |
| basisMonthly | Per månad | Per måned | Per måned | Kuukaudessa |
| basisAnnual | Per år | Per år | Per år | Vuodessa |
| bonus | Bonus | Bonus | Bonus | Bonus |
| fixedSupplement | Fast tillägg | Fast tillegg | Fast tillæg | Kiinteä lisä |
| allowance | Tillägg | Tillegg | Tillæg | Lisä |
| equity | Aktier/optioner | Aksjer/opsjoner | Aktier/optioner | Osakkeet/optiot |
| other | Övrig ersättning | Annen godtgjørelse | Anden betaling | Muu palkkaosuus |
| employmentType | Anställningsform | Ansettelsesform | Ansættelsesform | Palvelussuhteen tyyppi |

Do not add non-ASCII via shell (`perl`/`sed` double-encode); edit the JSON with the editor. After editing, grep for mojibake: `grep -R "Ã\|â€" packages/i18n/messages/` should return nothing.

- [ ] **Step 3: Run the parity + type checks**

Run: `bun run test --filter=@workspace/i18n`
Expected: PASS (key sets match across all five files).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "i18n(import): add basis toggle and new pay-field labels"
```

---

### Task 8: Map-step basis toggle + wizard/review threading

**Files:**
- Modify: `apps/dashboard/components/people/import/map-step.tsx`
- Modify: `apps/dashboard/components/people/import/import-wizard.tsx`
- Modify: `apps/dashboard/components/people/import/review-step.tsx`
- Test: `apps/dashboard/components/people/import/map-step.test.tsx`

**Interfaces:**
- Consumes: `defaultBasis`, `type PayBasis`, `CANONICAL_FIELDS` from `@workspace/import`; `importPayroll`/`previewImport` `basisMap` arg (Task 5).
- Produces: `MapStep` renders a per-money-column basis toggle; the wizard threads `basisMap` into `previewImport` and `importPayroll`.

- [ ] **Step 1: Write the failing test for the pure `syncBasisMap` helper**

Add to `apps/dashboard/components/people/import/map-step.test.tsx`:

```ts
import { syncBasisMap } from "./map-step"

describe("syncBasisMap", () => {
  it("seeds a basis for each mapped money field and drops non-money fields", () => {
    const headers = ["Årslön", "Bonus", "Anstnr"]
    const mapping = { basicMonthly: 0, bonus: 1, externalRef: 2 }
    const result = syncBasisMap(mapping, headers, {})
    expect(result.basicMonthly).toBe("annual") // "Årslön" annual hint
    expect(result.bonus).toBe("annual") // field default
    expect(result.externalRef).toBeUndefined() // not a money field
  })
  it("preserves an existing user override", () => {
    const headers = ["Bonus"]
    const result = syncBasisMap({ bonus: 0 }, headers, { bonus: "monthly" })
    expect(result.bonus).toBe("monthly")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/dashboard -- map-step`
Expected: FAIL — `syncBasisMap` not exported.

- [ ] **Step 3a: Add the pure helper to `map-step.tsx`**

```ts
import { CANONICAL_FIELDS, defaultBasis, type PayBasis } from "@workspace/import"

const MONEY_FIELD_KEYS = new Set(
  CANONICAL_FIELDS.filter((f) => f.shape === "money").map((f) => f.key)
)

// Keep a basis entry for every mapped MONEY column: preserve an existing
// override, else seed from defaultBasis (field default + annual header hint).
// Drops entries for unmapped or non-money fields so basisMap tracks mapping.
export function syncBasisMap(
  mapping: Record<string, number>,
  headers: string[],
  prev: Record<string, PayBasis>
): Record<string, PayBasis> {
  const next: Record<string, PayBasis> = {}
  for (const [fieldKey, columnIndex] of Object.entries(mapping)) {
    if (!MONEY_FIELD_KEYS.has(fieldKey)) continue
    next[fieldKey] = prev[fieldKey] ?? defaultBasis(fieldKey, headers[columnIndex] ?? "")
  }
  return next
}
```

- [ ] **Step 3b: Wire the toggle into the Map-step table**

Add props to `MapStepProps`: `basisMap: Record<string, PayBasis>` and `onBasisChange: (b: Record<string, PayBasis>) => void`.

In the seed `useEffect`, after `onMappingChange(seeded)`, also call `onBasisChange(syncBasisMap(seeded, parsed.headers, savedProfile?.basisMap ?? {}))` (so a saved profile's basis and header hints seed the toggles).

In `handleColumnFieldChange`, after computing `nextMapping`, call `onBasisChange(syncBasisMap(nextMapping, parsed.headers, basisMap))` alongside `onMappingChange(nextMapping)`.

Add a `basisHeader` column to the table header (`tMap("basisHeader")`), and in each row render the toggle only when the mapped field is a money field:

```tsx
<TableCell>
  {currentFieldKey && MONEY_FIELD_KEYS.has(currentFieldKey) ? (
    <Select
      value={basisMap[currentFieldKey] ?? defaultBasis(currentFieldKey, header)}
      onValueChange={onSelectValue((value: string) =>
        onBasisChange({ ...basisMap, [currentFieldKey]: value as PayBasis })
      )}
      items={{ monthly: tMap("basisMonthly"), annual: tMap("basisAnnual") }}
    >
      <SelectTrigger size="sm" className="min-w-[130px]" aria-label={tMap("basisHeader")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">{tMap("basisMonthly")}</SelectItem>
        <SelectItem value="annual">{tMap("basisAnnual")}</SelectItem>
      </SelectContent>
    </Select>
  ) : null}
</TableCell>
```

(The empty cell for non-money rows keeps the `table-fixed` layout stable — no reflow.)

- [ ] **Step 3c: Thread basisMap through the wizard**

In `import-wizard.tsx`: add `basisMap: Record<string, PayBasis>` to `WizardState` (initial `{}`); import `type PayBasis` from `@workspace/import`. Pass to `MapStep`:

```tsx
basisMap={state.basisMap}
onBasisChange={(basisMap) => setState((prev) => ({ ...prev, basisMap }))}
```

When headers change (the `onParsed` reset branch and `onClear`), also reset `basisMap: {}`. Pass `basisMap={state.basisMap}` to `<ReviewStep .../>`.

- [ ] **Step 3d: Send basisMap from ReviewStep**

In `review-step.tsx`: add `basisMap: Record<string, PayBasis>` to `ReviewStepProps` (import `type PayBasis`). Include it in both the `previewImport({...})` call and the `importPayroll({...})` call, omitting when empty:

```ts
...(Object.keys(basisMap).length > 0 ? { basisMap } : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test --filter=@workspace/dashboard -- map-step`
Expected: PASS. Then run the full dashboard suite to catch prop-type regressions: `bun run test --filter=@workspace/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/people/import/map-step.tsx apps/dashboard/components/people/import/import-wizard.tsx apps/dashboard/components/people/import/review-step.tsx apps/dashboard/components/people/import/map-step.test.tsx
git commit -m "feat(import): per-column monthly/annual basis toggle in the map step"
```

---

## Self-Review

**Spec coverage:**
- Annual/monthly basis + `toMonthly` (spec §1/§2) → Tasks 1, 5, 8. ✓
- Component breadth, field key ≡ kind (spec §3) → Tasks 3, 5. ✓
- employmentType typed union + soft normalizer (spec §4) → Tasks 2, 4, 5. ✓
- Map-step toggle, column-first, no layout shift (spec §5) → Task 8. ✓
- Preview/real parity (spec §4 diff) → Tasks 4, 5 (shared `prepareImport`/`personImportPatch`; the Task 5 test asserts stored values). ✓
- Profile persistence of basis (spec §5) → Task 6. ✓
- i18n en-first + mirror (spec §8) → Task 7. ✓
- Storage unchanged / no migration (spec §6) → honored (Global Constraints; `payRecords` untouched). ✓

**Deviation from spec §8 (flagged):** the spec listed four employment-type *value* labels (permanent/fixedTerm/…). This plan does **not** add them, because no surface localizes the stored value yet (the import review diff shows the canonical token via the existing `display()`), and adding unused i18n keys violates the repo rule. The `fields.employmentType` label IS added (consumed by the Map-step Select and the review diff's field label). Displaying the localized value in `person-detail.tsx` is a small, clean follow-up that should carry the four value labels then.

**Placeholder scan:** No TBD/TODO; every code step shows concrete code; Task 5 steps 3d references reading one projection but names the exact field and pattern (`department`).

**Type consistency:** `PayBasis` defined in Task 1 (constants), re-exported from `@workspace/import` (Task 3), consumed in Tasks 5/6/8. `EmploymentType` defined Task 2, consumed Tasks 4/5. `basisMap` is `Record<string,"monthly"|"annual">` at every boundary (action arg, profile, wizard state, `syncBasisMap`). `syncBasisMap` name consistent across Task 8 steps. Field key ≡ `PayComponentKind` invariant holds in Tasks 3 and 5.
