# Analysis Documentation, Completion Gate, Women-Dominated Comparison, and Scatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a kartläggning completable: the objective-reasons documentation workflow (M6) with the ADR-0012 gate and a minimal run lifecycle, the statutory women-dominated cross-level comparison (F4) reshaping the likvärdigt view, a per-person scatter under both analysis details, and the worklist search-width fix.

**Architecture:** Pure comparison math lands in `packages/core` (no clock/IO); the backend grows one table (`payMappingGroupAnalyses`), one shared aggregate builder in `gap.ts` reused by the query and the server-side gate, an `analyses.ts` module, and two lifecycle mutations; the dashboard extends the run-shell context with the analyses subscription and adds three new components (documentation form, scatter, overview documentation card) plus a reshaped analysis view.

**Tech Stack:** Convex (orgQuery/orgMutation, convex-test on edge-runtime), Vitest 4, Next.js 16 App Router client components, next-intl, recharts via the shadcn chart kit, Base UI.

**Spec:** `docs/superpowers/specs/2026-07-16-analysis-documentation-and-scatter-design.md` (read it first).

## Global Constraints

- **NO COMMITS.** The repo runs in held-uncommitted mode: never `git add`/`git commit`/`git stash`. Finish each task by running Biome + the named tests and leaving the working tree dirty. The controller snapshots trees.
- **Vitest 4 only**: run package tests as `bunx vitest run <path>` from the owning package dir, full suite as `bun run test` from the repo root. NEVER `bun test`.
- **Locale JSON is edited ONLY with the Edit tool** (shell sed/perl mojibakes non-ASCII). All 5 files (`en`, `sv`, `nb`, `da`, `fi`) change in the same task; en.json is the source. Nordic strings are drafts (native review is tracked separately).
- **No em dashes** in any written text (UI copy, comments, docs). **All user-facing text through i18n.**
- `packages/core` stays pure: no imports from Convex/Next/React, no `Date.now()`, no randomness; `asOf` instants are inputs.
- After any change to `packages/backend/convex/**` schemas or function signatures/validators: run `bunx convex codegen` from `packages/backend` and treat `_generated/` as part of the change.
- Flag thresholds and masking are ADR-0012 (amended): insufficient = a gender missing; >10 critical; >=5 elevated. Band 1 is the HIGHEST value; "equally or lower valued" means `band >= group.band` numerically.
- Audit: every state-changing mutation writes `ctx.audit.log({type, payload})`; new events need `AUDIT_EVENTS` keys, `AuditPayloads` entries, and event + field labels in ALL 5 locales in the same task (the coverage tests in apps/dashboard enforce this).
- Errors: backend throws `appError(ERROR_CODES.x)` codes only; the frontend translates.
- Biome via `bun x biome check --write <files>` from the repo root; shadcn vendor files (`packages/ui/src/*`) are not touched by this plan.

---

## File Structure

- `packages/constants/src/payGapReasons.ts` (new) + `index.ts` export: the reason taxonomy.
- `packages/core/src/pay-gap.ts`: `WOMEN_DOMINANCE_THRESHOLD`, `isWomenDominated`, `womenDominatedComparisons`, `likaGroupRequiresDocumentation`, `womenDominatedGroupRequiresDocumentation`, exported `ageAt`.
- `packages/backend/convex/payMapping/tables.ts`: `payMappingGroupAnalyses` table + `payGapReasonValidator`.
- `packages/backend/convex/payMapping/gap.ts`: exported `buildGapAggregates(rows)` + `womenDominated` wire section + `requiredDocumentationKeys`.
- `packages/backend/convex/payMapping/analyses.ts` (new): `listGroupAnalyses`, `upsertGroupAnalysis`.
- `packages/backend/convex/payMapping/runs.ts`: `completePayMappingRun`, `reopenPayMappingRun`, wire additions on `getPayMappingRunBySlug`.
- `packages/backend/convex/lib/audit.ts` + `lib/auditPayloads.ts` + `lib/errors.ts`: 3 events, payload types, `GROUP_ANALYSIS_AUDIT_FIELDS`, 3 error codes.
- `apps/dashboard/components/table-search-field.tsx`: `className` prop.
- `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`: `WomenDominatedGroup`, `GroupAnalysis`, row/run field additions.
- `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.tsx` + `pay-mapping-run-context.tsx`: analyses subscription in context.
- `apps/dashboard/components/pay-mapping/pay-mapping-group-analysis-form.tsx` (new).
- `apps/dashboard/components/pay-mapping/pay-mapping-scatter.tsx` (new).
- `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`: worklist tabs, ⚪ return, form + scatter embeds, likvärdigt reshape.
- `apps/dashboard/components/pay-mapping/pay-mapping-documentation-card.tsx` (new) + `pay-mapping-overview.tsx` embed.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json`: per task as listed.

Tests live beside their sources (`*.test.ts(x)`), backend tests in `packages/backend/convex/payMapping/`.

---

### Task 1: TableSearchField width prop

**Files:**
- Modify: `apps/dashboard/components/table-search-field.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx` (2 call sites: `GroupList` and `AnalysisSkeleton`)
- Test: `apps/dashboard/components/table-search-field.test.tsx` (new)

**Interfaces:**
- Produces: `TableSearchField({placeholder, value?, onChange?, className?})`; `className` is merged onto the Input AFTER the defaults so `w-full` overrides `w-64`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/table-search-field.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TableSearchField } from "./table-search-field"

afterEach(() => cleanup())

describe("TableSearchField", () => {
  it("defaults to the toolbar width", () => {
    render(<TableSearchField placeholder="Search" />)
    expect(screen.getByLabelText("Search").className).toContain("w-64")
  })

  it("lets a call site widen it (the analysis worklist passes w-full)", () => {
    render(<TableSearchField placeholder="Search" className="w-full" />)
    const input = screen.getByLabelText("Search")
    expect(input.className).toContain("w-full")
    expect(input.className).not.toContain("w-64")
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** (`className` prop unknown / w-64 still present): `cd apps/dashboard && bunx vitest run components/table-search-field.test.tsx`

- [ ] **Step 3: Implement.** In `table-search-field.tsx`: add `className` to the props type (`className?: string`), import `cn` from `@workspace/ui/lib/utils`, and change the Input to `className={cn("w-64 pl-8", className)}`. Update the doc comment: the width is a default, the analysis worklist passes `w-full` to fill its card. In `pay-mapping-analysis.tsx`, add `className="w-full"` to BOTH `TableSearchField` usages (GroupList and AnalysisSkeleton, so loading and loaded measure identically).

- [ ] **Step 4: Run to PASS**, plus the analysis tests: `bunx vitest run components/table-search-field.test.tsx components/pay-mapping/pay-mapping-analysis.test.tsx`

- [ ] **Step 5: Biome** `bun x biome check --write apps/dashboard/components/table-search-field.tsx apps/dashboard/components/table-search-field.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx` (leave uncommitted).

---

### Task 2: Reason taxonomy in @workspace/constants

**Files:**
- Create: `packages/constants/src/payGapReasons.ts`, `packages/constants/src/payGapReasons.test.ts`
- Modify: `packages/constants/src/index.ts`

**Interfaces:**
- Produces: `PAY_GAP_REASON_GROUPS: {market: [...], individual: [...], work: [...]}` (const), `PAY_GAP_REASON_GROUP_KEYS: readonly ["market","individual","work"]`, `PAY_GAP_REASONS: readonly PayGapReason[]` (flattened), types `PayGapReasonGroup`, `PayGapReason`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/constants/src/payGapReasons.test.ts
import { describe, expect, it } from "vitest"
import {
  PAY_GAP_REASON_GROUP_KEYS,
  PAY_GAP_REASON_GROUPS,
  PAY_GAP_REASONS,
} from "./payGapReasons"

describe("pay gap reason taxonomy", () => {
  it("flattens the groups in group order without duplicates", () => {
    expect(PAY_GAP_REASONS).toEqual([
      "alternativeLabourMarket",
      "recruitmentPayLevel",
      "experience",
      "historicalPay",
      "competence",
      "performance",
      "responsibility",
    ])
    expect(new Set(PAY_GAP_REASONS).size).toBe(PAY_GAP_REASONS.length)
  })

  it("keys the groups market/individual/work", () => {
    expect(PAY_GAP_REASON_GROUP_KEYS).toEqual(["market", "individual", "work"])
    expect(PAY_GAP_REASON_GROUPS.work).toEqual(["responsibility"])
  })
})
```

- [ ] **Step 2: Run, expect FAIL** (module missing): `cd packages/constants && bunx vitest run src/payGapReasons.test.ts`

- [ ] **Step 3: Implement**

```ts
// packages/constants/src/payGapReasons.ts
// The objective-reason (sakligt skäl) taxonomy for documenting pay-gap
// groups in a kartläggning (M6). Fixed in V1 and aligned with the
// Diskrimineringsombudsmannen framework: market, individual, and work
// factors. i18n labels live at dashboard.payMapping.reasons.<key> and
// group headings at dashboard.payMapping.reasons.groups.<group>.
export const PAY_GAP_REASON_GROUPS = {
  market: ["alternativeLabourMarket", "recruitmentPayLevel"],
  individual: ["experience", "historicalPay", "competence", "performance"],
  work: ["responsibility"],
} as const

export type PayGapReasonGroup = keyof typeof PAY_GAP_REASON_GROUPS
export type PayGapReason =
  (typeof PAY_GAP_REASON_GROUPS)[PayGapReasonGroup][number]

export const PAY_GAP_REASON_GROUP_KEYS = Object.keys(
  PAY_GAP_REASON_GROUPS
) as readonly PayGapReasonGroup[]

export const PAY_GAP_REASONS: readonly PayGapReason[] = Object.values(
  PAY_GAP_REASON_GROUPS
).flat()
```

Add to `packages/constants/src/index.ts` (alphabetical with the others):

```ts
export {
  PAY_GAP_REASON_GROUP_KEYS,
  PAY_GAP_REASON_GROUPS,
  PAY_GAP_REASONS,
  type PayGapReason,
  type PayGapReasonGroup,
} from "./payGapReasons"
```

- [ ] **Step 4: Run to PASS**: `bunx vitest run src/payGapReasons.test.ts`
- [ ] **Step 5: Biome** on the three files; leave uncommitted.

---

### Task 3: Core engine (women-dominated comparisons + documentation predicates + ageAt export)

**Files:**
- Modify: `packages/core/src/pay-gap.ts`
- Test: `packages/core/src/pay-gap.test.ts` (extend)

**Interfaces:**
- Produces (all exported from `@workspace/core`):

```ts
export const WOMEN_DOMINANCE_THRESHOLD = 0.6
export function isWomenDominated(womenCount: number, menCount: number): boolean
export interface ComparableGroup {
  key: string; roleTitle: string | null; level: string | null
  band: number | null; womenCount: number; menCount: number
  meanComp: number | null // whole-group mean of the gap measure
}
export interface WomenDominatedComparison {
  key: string; roleTitle: string | null; level: string | null; band: number
  headcount: number; womenSharePct: number; meanComp: number
  diffPct: number | null; diffSek: number
}
export interface WomenDominatedGroup {
  key: string; roleTitle: string | null; level: string | null; band: number
  headcount: number; womenSharePct: number; meanComp: number
  comparisons: WomenDominatedComparison[]
}
export function womenDominatedComparisons(groups: readonly ComparableGroup[]): WomenDominatedGroup[]
export function likaGroupRequiresDocumentation(flag: PayGapFlag): boolean       // flag !== "ok"
export function womenDominatedGroupRequiresDocumentation(comparisonCount: number): boolean // > 0
export function ageAt(birthDate: string, asOfMs: number): number | null        // existing fn, now exported (also used for tenure)
```

- [ ] **Step 1: Write the failing tests** (append to `pay-gap.test.ts`; import the new names):

```ts
describe("isWomenDominated", () => {
  it("uses the 60 % DO-praxis threshold inclusively", () => {
    expect(isWomenDominated(3, 2)).toBe(true) // 60 % exactly
    expect(isWomenDominated(59, 41)).toBe(false) // 59 %
    expect(isWomenDominated(0, 0)).toBe(false) // empty is never dominated
    expect(isWomenDominated(2, 0)).toBe(true)
  })
})

function comparable(overrides: Partial<ComparableGroup>): ComparableGroup {
  return {
    key: "k", roleTitle: "SWE", level: "Mid", band: 3,
    womenCount: 1, menCount: 3, meanComp: 40000,
    ...overrides,
  }
}

describe("womenDominatedComparisons", () => {
  const womenDominated = comparable({
    key: "wd", roleTitle: "Marketing", level: "Mid", band: 3,
    womenCount: 3, menCount: 1, meanComp: 38000,
  })

  it("compares against non-dominated groups in the same or lower-valued band that earn more", () => {
    const sameBandHigher = comparable({ key: "a", band: 3, meanComp: 42000 })
    const lowerValueHigher = comparable({ key: "b", band: 5, meanComp: 45000 }) // band 5 < band 3 in value
    const higherValueBand = comparable({ key: "c", band: 1, meanComp: 60000 }) // band 1 is HIGHER value: excluded
    const sameBandLowerPaid = comparable({ key: "d", band: 3, meanComp: 30000 }) // earns less: excluded
    const alsoDominated = comparable({ key: "e", band: 3, womenCount: 4, menCount: 0, meanComp: 50000 }) // women-dominated: excluded
    const result = womenDominatedComparisons([
      womenDominated, sameBandHigher, lowerValueHigher, higherValueBand, sameBandLowerPaid, alsoDominated,
    ])
    expect(result).toHaveLength(1)
    const group = result[0]
    expect(group?.key).toBe("wd")
    expect(group?.womenSharePct).toBeCloseTo(75, 5)
    expect(group?.comparisons.map((c) => c.key)).toEqual(["a", "b"]) // band asc (higher value first)
    expect(group?.comparisons[0]?.diffSek).toBe(4000)
    expect(group?.comparisons[0]?.diffPct).toBeCloseTo((4000 / 38000) * 100, 5)
  })

  it("keeps a dominated group with no comparisons (documentable, not gate-required)", () => {
    const result = womenDominatedComparisons([womenDominated])
    expect(result).toHaveLength(1)
    expect(result[0]?.comparisons).toEqual([])
  })

  it("skips unbanded groups entirely and orders output by comparison count desc, then band", () => {
    const unbanded = comparable({ key: "u", band: null, womenCount: 5, menCount: 0 })
    const rival = comparable({ key: "r", band: 3, meanComp: 50000 })
    const second = comparable({ key: "wd2", band: 4, womenCount: 4, menCount: 1, meanComp: 39000 })
    const result = womenDominatedComparisons([womenDominated, second, unbanded, rival])
    // wd (band 3) compares to r; wd2 (band 4) compares to nothing in a same-or-lower band that earns more... r is band 3 = HIGHER value than band 4, so excluded for wd2.
    expect(result.map((g) => g.key)).toEqual(["wd", "wd2"])
    expect(result[1]?.comparisons).toEqual([])
  })

  it("null-guards diffPct when the dominated mean is 0", () => {
    const zero = comparable({ key: "z", band: 3, womenCount: 2, menCount: 0, meanComp: 0 })
    const rival = comparable({ key: "r", band: 3, meanComp: 1000 })
    const result = womenDominatedComparisons([zero, rival])
    expect(result[0]?.comparisons[0]?.diffPct).toBeNull()
    expect(result[0]?.comparisons[0]?.diffSek).toBe(1000)
  })
})

describe("documentation predicates", () => {
  it("lika groups require documentation unless ok", () => {
    expect(likaGroupRequiresDocumentation("critical")).toBe(true)
    expect(likaGroupRequiresDocumentation("elevated")).toBe(true)
    expect(likaGroupRequiresDocumentation("insufficient")).toBe(true)
    expect(likaGroupRequiresDocumentation("ok")).toBe(false)
  })
  it("women-dominated groups require documentation when compared", () => {
    expect(womenDominatedGroupRequiresDocumentation(0)).toBe(false)
    expect(womenDominatedGroupRequiresDocumentation(2)).toBe(true)
  })
})

describe("ageAt (exported for the scatter's age and tenure axes)", () => {
  it("counts whole years at the reference instant", () => {
    expect(ageAt("1990-07-01", Date.UTC(2026, 6, 1))).toBe(36)
    expect(ageAt("1990-07-02", Date.UTC(2026, 6, 1))).toBe(35)
    expect(ageAt("not-a-date", Date.UTC(2026, 6, 1))).toBeNull()
    expect(ageAt("2030-01-01", Date.UTC(2026, 6, 1))).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect FAIL** (exports missing): `cd packages/core && bunx vitest run src/pay-gap.test.ts`

- [ ] **Step 3: Implement** in `pay-gap.ts`. Change `function ageAt` to `export function ageAt` and extend its comment: also used for tenure (years since employmentStartDate). Append:

```ts
// DO praxis: a group "brukar anses" women-dominated at 60 % women or more.
export const WOMEN_DOMINANCE_THRESHOLD = 0.6

export function isWomenDominated(womenCount: number, menCount: number): boolean {
  const total = womenCount + menCount
  return total > 0 && womenCount / total >= WOMEN_DOMINANCE_THRESHOLD
}

// A group as the cross-level comparison sees it: identity + counts + the
// whole-group mean of the gap measure (callers compute the mean; the engine
// never re-derives comp).
export interface ComparableGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  womenCount: number
  menCount: number
  meanComp: number | null
}

export interface WomenDominatedComparison {
  key: string
  roleTitle: string | null
  level: string | null
  band: number
  headcount: number
  womenSharePct: number
  meanComp: number
  // Positive: the equally or lower-valued group out-earns the dominated one.
  diffPct: number | null
  diffSek: number
}

export interface WomenDominatedGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number
  headcount: number
  womenSharePct: number
  meanComp: number
  comparisons: WomenDominatedComparison[]
}

function womenSharePct(womenCount: number, menCount: number): number {
  return (womenCount / (womenCount + menCount)) * 100
}

// Diskrimineringslagen's third comparison: every women-dominated group with a
// band, against every NON-women-dominated banded group of equal or LOWER
// value (band 1 is highest, so numerically >=) whose whole-group mean is
// HIGHER. Groups without a band or mean cannot be placed and are skipped
// (the UI states the unbanded count separately). Deterministic ordering:
// output by comparison count desc, then band asc, then key; comparisons by
// band asc (higher value first), then diffSek desc.
export function womenDominatedComparisons(
  groups: readonly ComparableGroup[]
): WomenDominatedGroup[] {
  const placeable = groups.filter(
    (g): g is ComparableGroup & { band: number; meanComp: number } =>
      g.band !== null && g.meanComp !== null
  )
  const dominated = placeable.filter((g) =>
    isWomenDominated(g.womenCount, g.menCount)
  )
  const others = placeable.filter(
    (g) => !isWomenDominated(g.womenCount, g.menCount)
  )
  const result = dominated.map((group) => ({
    key: group.key,
    roleTitle: group.roleTitle,
    level: group.level,
    band: group.band,
    headcount: group.womenCount + group.menCount,
    womenSharePct: womenSharePct(group.womenCount, group.menCount),
    meanComp: group.meanComp,
    comparisons: others
      .filter((o) => o.band >= group.band && o.meanComp > group.meanComp)
      .map((o) => ({
        key: o.key,
        roleTitle: o.roleTitle,
        level: o.level,
        band: o.band,
        headcount: o.womenCount + o.menCount,
        womenSharePct: womenSharePct(o.womenCount, o.menCount),
        meanComp: o.meanComp,
        diffSek: o.meanComp - group.meanComp,
        diffPct:
          group.meanComp === 0
            ? null
            : ((o.meanComp - group.meanComp) / group.meanComp) * 100,
      }))
      .sort((a, b) => (a.band !== b.band ? a.band - b.band : b.diffSek - a.diffSek)),
  }))
  return result.sort((a, b) => {
    if (a.comparisons.length !== b.comparisons.length)
      return b.comparisons.length - a.comparisons.length
    if (a.band !== b.band) return a.band - b.band
    return a.key.localeCompare(b.key)
  })
}

// The ADR-0012 gate's per-group rule, shared by the backend mutations and the
// UI (a lika group needs a documented reason unless it is ok; a
// women-dominated group needs one when something out-earns it).
export function likaGroupRequiresDocumentation(flag: PayGapFlag): boolean {
  return flag !== "ok"
}

export function womenDominatedGroupRequiresDocumentation(
  comparisonCount: number
): boolean {
  return comparisonCount > 0
}
```

- [ ] **Step 4: Run to PASS**: `bunx vitest run src/pay-gap.test.ts`
- [ ] **Step 5: Biome** on both files; leave uncommitted.

---

### Task 4: Backend schema + shared gap builder + womenDominated wire

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts`, `packages/backend/convex/schema.ts`, `packages/backend/convex/payMapping/gap.ts`
- Test: `packages/backend/convex/payMapping/gap.test.ts` (extend)

**Interfaces:**
- Produces: table `payMappingGroupAnalyses` (index `by_run` on `["orgId","runId"]`); exported `payGapReasonValidator` (tables.ts); gap.ts exports for sibling modules:

```ts
export function buildGapAggregates(rows: Doc<"payMappingSnapshotRows">[]): {
  priced: SnapshotRow[]; currency: string | null
  lika: GapGroupWire[]                     // as today, with the SAME keys
  likvardigt: GapGroupWire[]; unbandedCount: number
  womenDominated: WomenDominatedGroup[]    // from @workspace/core
}
export function requiredDocumentationKeys(rows: Doc<"payMappingSnapshotRows">[]): {
  likaAll: Set<string>; likaRequired: Set<string>
  womenDominatedAll: Set<string>; womenDominatedRequired: Set<string>
}
```

- `getPayMappingGap` return gains `womenDominated: v.array(womenDominatedGroupShape)`.

- [ ] **Step 1: Write the failing test.** Extend `gap.test.ts` (reuse its existing seed helpers; seed via the same path existing tests use). Add a scenario: a women-dominated group ("Nurse", level "Mid", band 3: 3 women at 38000) plus a non-dominated group ("Tech", level "Mid", band 3: 1 woman 42000 + 2 men 42000) plus an unbanded priced person. Assert on the query result:

```ts
it("returns the women-dominated cross-level comparison", async () => {
  // seed as described above with the existing helper pattern in this file
  const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, { orgId, runId })
  expect(gap?.womenDominated).toHaveLength(1)
  const group = gap?.womenDominated[0]
  expect(group?.roleTitle).toBe("Nurse")
  expect(group?.womenSharePct).toBe(100)
  expect(group?.comparisons).toHaveLength(1)
  expect(group?.comparisons[0]?.roleTitle).toBe("Tech")
  expect(group?.comparisons[0]?.diffSek).toBe(4000)
})
```

- [ ] **Step 2: Run, expect FAIL**: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`

- [ ] **Step 3: Implement.**
  1. `tables.ts`: add (with a comment citing the spec and that reasons are group-level, never person PII):

```ts
export const payGapReasonValidator = v.union(
  v.literal("alternativeLabourMarket"),
  v.literal("recruitmentPayLevel"),
  v.literal("experience"),
  v.literal("historicalPay"),
  v.literal("competence"),
  v.literal("performance"),
  v.literal("responsibility")
)

export const payMappingGroupAnalyses = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  scope: v.union(v.literal("lika"), v.literal("likvardigt")),
  groupKey: v.string(),
  reasons: v.array(payGapReasonValidator),
  note: v.optional(v.string()),
  done: v.boolean(),
}).index("by_run", ["orgId", "runId"])
```

  Add a compile-time drift guard right under the validator so the literals cannot diverge from `@workspace/constants`:

```ts
import type { Infer } from "convex/values"
import type { PayGapReason } from "@workspace/constants"
type ReasonFromValidator = Infer<typeof payGapReasonValidator>
type _ReasonsExact = ReasonFromValidator extends PayGapReason
  ? PayGapReason extends ReasonFromValidator
    ? true
    : never
  : never
const _assertReasonsMatch: _ReasonsExact = true
void _assertReasonsMatch
```

  2. `schema.ts`: import and register `payMappingGroupAnalyses` next to the other payMapping tables.
  3. `gap.ts`: refactor the handler's grouping section into an exported module-level `buildGapAggregates(rows)` (move `priced`, `currency`, the lika/likv maps, `byBandTitleLevel`, `toGapGroup` calls, `unbandedCount` into it; keep the org aggregate + population/quartiles/age in the handler since only the query needs them). Inside the builder, after building `lika` buckets, compute the whole-group mean per lika bucket (`(sum(women)+sum(men)) / (women.length+men.length)`) and call `womenDominatedComparisons` from `@workspace/core` with `{key, roleTitle, level, band, womenCount, menCount, meanComp}`. Add `requiredDocumentationKeys(rows)` calling `buildGapAggregates` and applying `likaGroupRequiresDocumentation` / `womenDominatedGroupRequiresDocumentation`. Add the wire shapes and extend the query return + handler:

```ts
const womenDominatedComparisonShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  diffPct: v.union(v.number(), v.null()),
  diffSek: v.number(),
})
const womenDominatedGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  comparisons: v.array(womenDominatedComparisonShape),
})
```

  4. `cd packages/backend && bunx convex codegen`

- [ ] **Step 4: Run to PASS** (all gap tests): `bunx vitest run convex/payMapping/gap.test.ts`
- [ ] **Step 5: Typecheck** (`cd ../.. && bun run typecheck`), fix any fixture in `apps/dashboard` missing the new `womenDominated` field (add `womenDominated: []` to `PayMappingGapResult` fixtures; the frontend type is extended in Task 7). Biome on touched files; leave uncommitted.

---

### Task 5: analyses.ts (upsert + list) with audit + error codes

**Files:**
- Create: `packages/backend/convex/payMapping/analyses.ts`, `packages/backend/convex/payMapping/analyses.test.ts`
- Modify: `packages/backend/convex/lib/errors.ts`, `lib/audit.ts`, `lib/auditPayloads.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (audit event + field labels, error strings)
- Modify: `apps/dashboard/components/audit-labels.test.ts` (or the file that enumerates field-set constants; find it with `grep -rn "AUDIT_FIELDS" apps/dashboard --include="*.test.*"`) to cover `GROUP_ANALYSIS_AUDIT_FIELDS`.

**Interfaces:**
- Produces:

```ts
// errors.ts additions
payMappingRunCompleted: "errors.payMappingRunCompleted",
payMappingDocumentationRequired: "errors.payMappingDocumentationRequired",
payMappingGateUnmet: "errors.payMappingGateUnmet",

// audit.ts additions
payMappingGroupAnalysisUpdated: "payMapping.groupAnalysisUpdated",
export const GROUP_ANALYSIS_AUDIT_FIELDS = ["reasons", "note", "done"] as const

// auditPayloads.ts addition
"payMapping.groupAnalysisUpdated": {
  runId: string
  scope: "lika" | "likvardigt"
  groupLabel: string          // "roleTitle · level", role-level content
  changes: Changes            // reasons diffed as a ", "-joined string; done as boolean
}

// analyses.ts
export const listGroupAnalyses = orgQuery({ args: { runId }, returns: v.array(groupAnalysisShape) })
export const upsertGroupAnalysis = orgMutation({
  args: { runId, scope: v.union(v.literal("lika"), v.literal("likvardigt")),
          groupKey: v.string(), reasons: v.array(payGapReasonValidator),
          note: v.optional(v.string()), done: v.boolean() },
  returns: v.null(),
})
// groupAnalysisShape = { scope, groupKey, reasons, note: v.union(v.string(), v.null()), done }
```

- Consumes: `requiredDocumentationKeys` + `buildGapAggregates` (Task 4), `payGapReasonValidator` (tables.ts), `buildChanges`/`AUDIT_EVENTS` (lib/audit.ts), `appError`/`ERROR_CODES`.

- [ ] **Step 1: Write the failing tests** (`analyses.test.ts`, convex-test on edge-runtime like `gap.test.ts`; reuse the same seeding helpers). Cover, each as its own `it`:
  1. upsert inserts, list returns it (`reasons: ["experience"]`, `note: undefined -> null on the wire`, `done: false`).
  2. upsert updates the same (scope, groupKey) row instead of inserting a second (list length stays 1).
  3. `done: true` WITHOUT reasons or note on a group whose flag requires documentation rejects with `payMappingDocumentationRequired` (seed a critical group; use the group key format `${roleTitle}|${band}|${level}`).
  4. `done: true` with only a note (no reasons) succeeds; a whitespace-only note does NOT count (rejects).
  5. `done: true` on an OK-flag group with no documentation succeeds (fri bock).
  6. Unknown groupKey for the scope rejects with `notFound`.
  7. On a run whose status is `completed` (patch it directly via `t.run`), upsert rejects with `payMappingRunCompleted`.
  8. The audit row: exactly one `payMapping.groupAnalysisUpdated` entry after an upsert; its payload has `scope`, `groupLabel`, and a `changes.done` entry; reasons diff is the joined string (e.g. `{from: null, to: "experience, competence"}`).

Use `expect(promise).rejects.toThrow()` + catch the `ConvexError` `data.code` the way existing backend tests assert appError codes (`grep -rn "appError\|data.code" packages/backend/convex/payMapping/runs.test.ts` for the local idiom and reuse it).

- [ ] **Step 2: Run, expect FAIL**: `cd packages/backend && bunx vitest run convex/payMapping/analyses.test.ts`

- [ ] **Step 3: Implement.**
  1. `errors.ts`: the three codes above.
  2. `audit.ts`: event key `payMappingGroupAnalysisUpdated: "payMapping.groupAnalysisUpdated"` in `AUDIT_EVENTS`; `export const GROUP_ANALYSIS_AUDIT_FIELDS = ["reasons", "note", "done"] as const` beside the other field constants, with a comment: reasons are diffed as a joined display string, the note is group-level (role-level) free text, never person identity.
  3. `auditPayloads.ts`: the payload entry above.
  4. `analyses.ts`:

```ts
import { v } from "convex/values"
import { AUDIT_EVENTS, buildChanges, GROUP_ANALYSIS_AUDIT_FIELDS } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { requiredDocumentationKeys } from "./gap"
import { payGapReasonValidator } from "./tables"

const scopeValidator = v.union(v.literal("lika"), v.literal("likvardigt"))

const groupAnalysisShape = v.object({
  scope: scopeValidator,
  groupKey: v.string(),
  reasons: v.array(payGapReasonValidator),
  note: v.union(v.string(), v.null()),
  done: v.boolean(),
})

// The run's documentation rows (objective reasons, deepened analysis, and
// the Klarmarkerad state per group). Group-level content only: never person
// data (the note's helper text steers users away from naming individuals).
export const listGroupAnalyses = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.array(groupAnalysisShape),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) return []
    const rows = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    return rows.map((row) => ({
      scope: row.scope,
      groupKey: row.groupKey,
      reasons: row.reasons,
      note: row.note ?? null,
      done: row.done,
    }))
  },
})

// Normalizes an analysis row into the flat scalars the audit diff compares
// (arrays diff by identity, so reasons join into one display string).
function auditView(row: { reasons: readonly string[]; note?: string; done: boolean } | null) {
  return {
    reasons: row === null || row.reasons.length === 0 ? null : row.reasons.join(", "),
    note: row?.note ?? null,
    done: row?.done ?? null,
  }
}

export const upsertGroupAnalysis = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    scope: scopeValidator,
    groupKey: v.string(),
    reasons: v.array(payGapReasonValidator),
    note: v.optional(v.string()),
    done: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, scope, groupKey, reasons, note, done }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    // A completed kartläggning is locked: its documentation is what was
    // certified. Reopen (overview) to edit.
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const snapshotRows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const keys = requiredDocumentationKeys(snapshotRows)
    const all = scope === "lika" ? keys.likaAll : keys.womenDominatedAll
    const required =
      scope === "lika" ? keys.likaRequired : keys.womenDominatedRequired
    if (!all.has(groupKey)) throw appError(ERROR_CODES.notFound)

    const trimmedNote = note?.trim() ?? ""
    // The gate's per-group rule, enforced server-side from the snapshot:
    // never trust the client's flag.
    if (done && required.has(groupKey) && reasons.length === 0 && trimmedNote === "")
      throw appError(ERROR_CODES.payMappingDocumentationRequired)

    const existing = (
      await ctx.db
        .query("payMappingGroupAnalyses")
        .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
        .collect()
    ).find((row) => row.scope === scope && row.groupKey === groupKey)

    const next = {
      reasons: [...reasons],
      note: trimmedNote === "" ? undefined : trimmedNote,
      done,
    }
    if (existing === undefined) {
      await ctx.db.insert("payMappingGroupAnalyses", {
        orgId: ctx.orgId,
        runId,
        scope,
        groupKey,
        ...next,
      })
    } else {
      await ctx.db.patch(existing._id, next)
    }

    const changes = buildChanges(
      auditView(existing ?? null),
      auditView(next),
      GROUP_ANALYSIS_AUDIT_FIELDS
    )
    // groupLabel resolves the key to display text (roleTitle · level): the
    // trail never shows a raw internal key.
    const [roleTitle, , level] = groupKey.split("|")
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingGroupAnalysisUpdated,
      payload: {
        runId,
        scope,
        groupLabel: [roleTitle, level].filter((p) => p !== "").join(" · "),
        changes,
      },
    })
    return null
  },
})
```

  Note: `auditView(next)` needs `done: boolean` not null on the after side; `done: row?.done ?? null` yields the boolean for a real row. `buildChanges` skips fields whose value did not change.
  5. i18n ×5 with the Edit tool:
     - `dashboard.auditLog.events["payMapping.groupAnalysisUpdated"]`: en "Pay gap analysis updated", sv "Löneanalys uppdaterad" (nb/da/fi drafts following the locale's kartläggning terminology).
     - `dashboard.auditLog.fields.{reasons,note,done,groupLabel,scope}`: en "Objective reasons" / "Deepened analysis" / "Marked done" / "Group" / "View" and locale mirrors.
     - `errors.payMappingRunCompleted` en "The pay mapping is completed and locked. Reopen it to edit." / `errors.payMappingDocumentationRequired` en "Add an objective reason or a deepened analysis before marking the group done." / `errors.payMappingGateUnmet` en "Groups remain to mark done before the pay mapping can be completed." + 4 mirrors each.
  6. Extend the audit field-label coverage test to import `GROUP_ANALYSIS_AUDIT_FIELDS`.
  7. `bunx convex codegen`.

- [ ] **Step 4: Run to PASS**: `bunx vitest run convex/payMapping/analyses.test.ts` then the dashboard coverage tests: `cd ../../apps/dashboard && bunx vitest run $(grep -rln "AUDIT_FIELDS\|auditLog.events" --include="*.test.*" . | tr '\n' ' ')` and the i18n parity test (`cd ../../packages/i18n && bun run test`).
- [ ] **Step 5: Biome** on all touched TS files; leave uncommitted.

---

### Task 6: Lifecycle mutations (complete + reopen)

**Files:**
- Modify: `packages/backend/convex/payMapping/runs.ts`, `lib/audit.ts`, `lib/auditPayloads.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (2 event labels)
- Test: `packages/backend/convex/payMapping/runs.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
// audit.ts
payMappingRunCompleted: "payMapping.runCompleted",
payMappingRunReopened: "payMapping.runReopened",
// auditPayloads.ts
"payMapping.runCompleted": { runId: string; likaDone: number; likvardigtDone: number }
"payMapping.runReopened": { runId: string }
// runs.ts
export const completePayMappingRun = orgMutation({ args: { runId }, returns: v.null() })
export const reopenPayMappingRun = orgMutation({ args: { runId }, returns: v.null() })
```

- Consumes: `requiredDocumentationKeys` (gap.ts), `ERROR_CODES.payMappingGateUnmet` / `invalidTransition` (Task 5 / existing).

- [ ] **Step 1: Write the failing tests** (extend `runs.test.ts`):
  1. Completing with an undocumented required group rejects `payMappingGateUnmet`.
  2. After upserting `done: true` analyses for every required lika + women-dominated key (drive the real `upsertGroupAnalysis` with a reason), complete succeeds, status reads `completed` via `getPayMappingRunBySlug`, and a `payMapping.runCompleted` audit row exists with the done counts.
  3. Completing a completed run rejects `invalidTransition`.
  4. Reopen flips `completed -> active` and logs `payMapping.runReopened`; reopening an active run rejects `invalidTransition`.
  (A seed where NO group requires documentation completes immediately; cover it in case 2 if simpler.)

- [ ] **Step 2: Run, expect FAIL**: `bunx vitest run convex/payMapping/runs.test.ts`

- [ ] **Step 3: Implement** in `runs.ts`:

```ts
// The ADR-0012 completion gate: a kartläggning reaches Slutförd only when
// every group the analysis requires documentation for is marked done. The
// requirement set is recomputed here from the frozen snapshot; the client's
// progress card is a preview, never the authority.
export const completePayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status !== "active")
      throw appError(ERROR_CODES.invalidTransition)

    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const keys = requiredDocumentationKeys(rows)
    const analyses = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const doneKeys = (scope: "lika" | "likvardigt") =>
      new Set(
        analyses
          .filter((row) => row.scope === scope && row.done)
          .map((row) => row.groupKey)
      )
    const likaDone = doneKeys("lika")
    const likvDone = doneKeys("likvardigt")
    const unmet =
      [...keys.likaRequired].some((key) => !likaDone.has(key)) ||
      [...keys.womenDominatedRequired].some((key) => !likvDone.has(key))
    if (unmet) throw appError(ERROR_CODES.payMappingGateUnmet)

    await ctx.db.patch(runId, { status: "completed" })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunCompleted,
      payload: { runId, likaDone: likaDone.size, likvardigtDone: likvDone.size },
    })
    return null
  },
})

export const reopenPayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status !== "completed")
      throw appError(ERROR_CODES.invalidTransition)
    await ctx.db.patch(runId, { status: "active" })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunReopened,
      payload: { runId },
    })
    return null
  },
})
```

Add the two `AUDIT_EVENTS` keys + `AuditPayloads` entries; add `dashboard.auditLog.events["payMapping.runCompleted"]` (en "Pay mapping completed", sv "Lönekartläggning slutförd") and `["payMapping.runReopened"]` (en "Pay mapping reopened", sv "Lönekartläggning återöppnad") + nb/da/fi drafts, and field labels `dashboard.auditLog.fields.{likaDone,likvardigtDone}` (en "Equal work groups marked done" / "Equivalent work groups marked done") ×5. `bunx convex codegen`.

- [ ] **Step 4: Run to PASS**: `bunx vitest run convex/payMapping/` then parity (`cd ../i18n && bun run test`) and the dashboard audit-label tests.
- [ ] **Step 5: Biome**; leave uncommitted.

---

### Task 7: Wire extension for the scatter (run detail + row fields + frontend types)

**Files:**
- Modify: `packages/backend/convex/payMapping/runs.ts` (`snapshotRowShape`, `getPayMappingRunBySlug`)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`
- Modify: fixtures in `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.test.tsx`, `apps/dashboard/components/site-header.test.tsx`, `apps/dashboard/components/pay-mapping/pay-mapping-analysis.test.tsx`
- Test: `packages/backend/convex/payMapping/runs.test.ts` (extend the detail-query test)

**Interfaces:**
- Produces: `getPayMappingRunBySlug` returns `{runId, label, status, referenceDate, rows}` where each row additionally carries `birthDate?: string`, `employmentStartDate?: string`, `ftePercent?: number`, `components: {kind: string, monthlyAmount: number}[]`. Frontend `PayMappingRunDetail` gains `referenceDate: number`; `PayMappingSnapshotRow` gains the four fields; `PayMappingGapResult` gains `womenDominated: WomenDominatedGroup[]` and exports `GroupAnalysis`:

```ts
export interface WomenDominatedComparisonWire { key: string; roleTitle: string | null; level: string | null; band: number; headcount: number; womenSharePct: number; meanComp: number; diffPct: number | null; diffSek: number }
export interface WomenDominatedGroupWire extends Omit<WomenDominatedComparisonWire, "diffPct" | "diffSek"> { comparisons: WomenDominatedComparisonWire[] }
export interface GroupAnalysis { scope: "lika" | "likvardigt"; groupKey: string; reasons: PayGapReason[]; note: string | null; done: boolean }
```

- [ ] **Step 1: Extend the backend detail test**: assert `result?.referenceDate` is a number and a seeded row round-trips `birthDate`/`ftePercent`/`components`. Run, expect FAIL.
- [ ] **Step 2: Implement**: add `referenceDate: v.number()` to the detail validator + `referenceDate: run.referenceDate` to the return (update the lean-wire comment: the scatter computes age/tenure at the frozen date); extend `snapshotRowShape` and the row mapping with `...(r.birthDate !== undefined ? { birthDate: r.birthDate } : {})`, same for `employmentStartDate`/`ftePercent`, plus `components: r.components`. `bunx convex codegen`. Extend the frontend types as above (import `PayGapReason` from `@workspace/constants`), add `referenceDate: Date.UTC(2026, 6, 1)` to `RUN` fixtures and `womenDominated: []` to `GAP` fixtures.
- [ ] **Step 3: Run to PASS**: backend `bunx vitest run convex/payMapping/runs.test.ts`; dashboard `bunx vitest run components/pay-mapping/ components/site-header.test.tsx`; root `bun run typecheck`.
- [ ] **Step 4: Biome**; leave uncommitted.

---

### Task 8: Run context carries analyses + lock state

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-run-context.tsx`, `pay-mapping-run-shell.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.test.tsx` (extend)

**Interfaces:**
- Produces: `PayMappingRunContextValue` gains `analyses: GroupAnalysis[] | undefined`; the shell subscribes `useQuery(api.payMapping.analyses.listGroupAnalyses, run ? {orgId, runId: run.runId} : "skip")` and provides it. Consumers read lock state as `run?.status === "completed"`.

- [ ] **Step 1: Extend the shell test**: `onQuery` returns `[]` for `payMapping.analyses.listGroupAnalyses`; assert the probe child still renders and no crash while analyses load (return `undefined` in one case). Run, expect FAIL (type error on context value).
- [ ] **Step 2: Implement** the context field + shell subscription (mirror the gap query's skip pattern).
- [ ] **Step 3: Run to PASS**: `bunx vitest run components/pay-mapping/pay-mapping-run-shell.test.tsx`; `bun run typecheck`.
- [ ] **Step 4: Biome**; leave uncommitted.

---

### Task 9: Documentation form component

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-group-analysis-form.tsx`, `.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Produces:

```tsx
export function PayMappingGroupAnalysisForm({ runId, scope, groupKey, requiresDocumentation, locked, analysis }:
  { runId: Id<"payMappingRuns">; scope: "lika" | "likvardigt"; groupKey: string
    requiresDocumentation: boolean; locked: boolean; analysis: GroupAnalysis | undefined })
```

- Behavior: renders the three chip groups from `PAY_GAP_REASON_GROUPS` (a chip is a `Button` `variant={active ? "secondary" : "outline"}` `size="sm"` with `aria-pressed`), the note `Textarea` (from `@workspace/ui/components/textarea`) with the privacy helper line, and the Klarmarkerad `Switch` (or Button if no Switch exists in `packages/ui`; check `ls packages/ui/src/components | grep switch`). Saves: chip toggle and done toggle call `upsertGroupAnalysis` immediately; the note saves on blur AND on a 800 ms debounce (clear the timer on unmount). Done toggle success shows `toast.success(t("dashboard.toast.payMappingGroupDone"))` / `payMappingGroupReopened`; chip/note saves are silent (continuous-edit exemption); every failure shows `toast.error(tToast("error"))`. The done control is `disabled` when `locked`, or when `requiresDocumentation` and the CURRENT form state has no reason and an empty trimmed note; the requirement is stated in muted text next to it (guidance rule). When `locked`, everything is disabled plus one line: the run is completed, reopen from the overview. This is a continuous editing surface (like per-criterion rating), NOT an RHF+Zod submit form; note the deviation in the component comment.
- i18n keys (en values; sv + 3 drafts mirror): `dashboard.payMapping.reasons.groups.{market: "Market", individual: "Individual", work: "Work"}`, `dashboard.payMapping.reasons.{alternativeLabourMarket: "Alternative labour market", recruitmentPayLevel: "Pay level at recruitment", experience: "Experience", historicalPay: "Historical pay", competence: "Competence", performance: "Performance", responsibility: "Responsibility"}`, `dashboard.payMapping.analysisForm.{reasonsTitle: "Pay differences explained by", noteTitle: "Deepened analysis", noteHelper: "Describe the explanation in terms of role, market and experience. Avoid naming individuals: the text becomes part of the statutory documentation.", donePendingHint: "Add an objective reason or a deepened analysis to mark this group done.", doneLabel: "Marked done", lockedHint: "The pay mapping is completed and locked. Reopen it from the overview to edit."}`, toasts `dashboard.toast.{payMappingGroupDone: "Group marked done.", payMappingGroupReopened: "Group reopened."}`, help `dashboard.help.{payGapReasonsLabel: "Objective reasons", payGapReasonsBody: "..." (plain-language: Swedish law requires an objective reason, e.g. market or experience, for every pay difference between comparable groups; pick the factors that apply and elaborate in the text field)}`.

- [ ] **Step 1: Write the failing tests** (mock `convex/react` + generated api via `@/test/convex-mocks`, org-context like sibling tests; capture `useMutation` calls through the mock module's mutation spy, following `grep -rn "onMutation\|useMutation" apps/dashboard/test/convex-mocks.tsx` for the local idiom): chips render all 7 reasons under 3 group headings; clicking a chip fires the upsert with the toggled reasons array; done disabled while `requiresDocumentation` and empty, enabled after a chip is active; done disabled + locked hint when `locked`; note change does not fire per keystroke but fires on blur.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** per the behavior block; local state mirrors `analysis` (`useState` seeded from props with a `key`-less sync via `useEffect` on `analysis?` changes is acceptable here because saves round-trip through the subscription; keep it simple: controlled local state initialized from `analysis`, updated optimistically on toggle, note kept local and pushed on blur/debounce). i18n in all 5 files with the Edit tool.
- [ ] **Step 4: Run to PASS** + i18n parity + Biome; leave uncommitted.

---

### Task 10: Lika view: worklist tabs, ⚪ returns, form embed

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`, `.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: `usePayMappingRun()` now provides `analyses`; `PayMappingGroupAnalysisForm` (Task 9); `likaGroupRequiresDocumentation` from `@workspace/core`.
- Produces: `PayMappingAnalysis` renders for `view="lika"`: worklist = ALL lika groups (⚪ included again; delete the `singleGenderHidden` note and its key ×5), partitioned by done-state tabs.

**Implementation notes (exact):**
- Add a `DoneFilter = "open" | "done" | "all"` state defaulting to `"open"`. Render a `Tabs` row (from `@workspace/ui/components/tabs`, the Base UI wrapper; check its exact exports with `grep -n "export" packages/ui/src/components/tabs.tsx`) above the search field inside `GroupList`, labels from `dashboard.payMapping.gap.tabs.{open: "Not done ({count})", done: "Done ({count})", all: "All ({count})"}` (ICU with count).
- Done lookup: `const doneKeys = new Set(analyses?.filter(a => a.scope === scope && a.done).map(a => a.groupKey))`; partition the attention-sorted list. When the open tab is empty and groups exist, show `gap.allDone` (en "Every group is marked done."). While `analyses === undefined` treat none as done (the tabs still render; counts settle when the subscription lands).
- Detail: below the member table render `PayMappingGroupAnalysisForm` with `requiresDocumentation={likaGroupRequiresDocumentation(group.flag)}`, `locked={run?.status === "completed"}`, `analysis={analyses?.find(a => a.scope === "lika" && a.groupKey === group.key)}`. For an insufficient group the stat grid stays as-is (null means render "-") and the flag chip explains it.
- Delete `singleGenderHidden` usage + key in all 5 locales; update the component's header comments (the M6 promise lines are now reality).

- [ ] **Step 1: Update/extend the tests first** (they encode the new behavior and MUST fail before implementation): QA (insufficient) group appears in the worklist again under "Not done"; tabs partition (seed `analyses` fixture with QA done → QA under Done tab, counts right); default tab open; all-done empty state; the form renders in the detail with the done switch disabled for the undocumented critical group; run `bunx vitest run components/pay-mapping/pay-mapping-analysis.test.tsx` (FAIL).
- [ ] **Step 2: Implement.** The analysis component reads `analyses` + `run` from `usePayMappingRun()` (add them to the two page components' props or read context directly inside `PayMappingAnalysis`; PREFER reading context inside `PayMappingAnalysis` and dropping the `gap`/`rows` props in favor of context to avoid prop drift, updating both pages and tests accordingly).
- [ ] **Step 3: Run to PASS** + parity + Biome; leave uncommitted.

---

### Task 11: Likvärdigt view reshaped to women-dominated

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`, `.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Implementation notes (exact):**
- `view="likvardigt"` now lists `gap.womenDominated` in the worklist (label `roleTitle · level`, chip = `gap.comparisonCount` ICU en "{count, plural, =0 {} one {# higher paid} other {# higher paid}}" rendered as a `Badge variant="outline"` only when count > 0), with the same done tabs (scope `"likvardigt"`, requirement = `womenDominatedGroupRequiresDocumentation(group.comparisons.length)`), search, and default sort as delivered by the engine (already comparison-count desc).
- Detail (`WomenDominatedDetail`): header (label + band badge), a 3-figure stat row (headcount, `womenShare` formatted percent, mean via `useMoney`), the comparison table (`table-fixed`; columns `gap.columns.{band,group,headcount,womenShare,mean,diffPct,diffSek}`; band rendered via the existing `gap.bandLabel`), a context line `gap.bandContext` (en "Within band {band}, women earn {gap} less than men." pulling the group's band row from `gap.likvardigt`; when that band row's gapPct is null render `gap.bandContextNone` en "Within band {band} there is no measurable woman-man gap.") with the existing likvärdigt help button, then the documentation form (scope `"likvardigt"`), then the scatter (Task 12 embeds it; leave a placeholder slot comment in this task).
- Empty state when `womenDominated` is empty: `gap.noWomenDominated` (en "No women-dominated groups in this pay mapping. A group counts as women-dominated at 60 percent women or more.") plus the new help `dashboard.help.{womenDominatedLabel, womenDominatedBody}`.
- The old band-composition detail (`LikvardigtDetail`, `gap.bandRoles` key) is DELETED with its keys ×5 (no legacy). `gap.likvardigtDescription` + `help.payGapLikvardigt*` are REWRITTEN for the new form (en description: "Women-dominated jobs compared with equally or lower valued jobs that pay more."). `gap.unbanded` note stays.

- [ ] **Step 1: Rewrite the likvärdigt tests first** (worklist from womenDominated fixture; comparison table rows + order; band context line; empty state; done tabs with scope likvardigt) and run to FAIL.
- [ ] **Step 2: Implement** per the notes; delete dead keys in all 5 locales; add the new ones (en + sv exact, nb/da/fi drafts).
- [ ] **Step 3: Run to PASS** + parity + Biome; leave uncommitted.

---

### Task 12: Scatter component + embeds

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-scatter.tsx`, `.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx` (embed under both details)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Produces:

```tsx
export type ScatterXMode = "age" | "tenure"
// Pure, exported for tests: rows -> plottable points + omitted count.
export function buildScatterPoints(
  rows: PayMappingSnapshotRow[], xMode: ScatterXMode, referenceDateMs: number,
  groupLabelFor?: (row: PayMappingSnapshotRow) => string
): { points: Array<{ x: number; y: number; woman: boolean; row: PayMappingSnapshotRow; groupLabel?: string }>; omitted: number }
export function PayMappingScatter({ rows, currency, referenceDateMs, groupLabelFor, title }: {...})
```

- Behavior: `y = fteTotalMonthlyComp(row.basicMonthly ?? 0, row.components, row.ftePercent)` for priced rows only; `x = ageAt(birthDate | employmentStartDate, referenceDateMs)`; rows missing the active X field or unpriced count into `omitted`. Renders a `WidgetCard` (title from the view, help `dashboard.help.payGapScatter*`, `headerExtra` = the X-mode `Tabs` segmented control labeled `scatter.xAge` en "Age" / `scatter.xTenure` en "Tenure (years)", `expandable`) containing `ChartContainer` + recharts `ScatterChart` with TWO `Scatter` series (women fill `var(--gender-woman)`, men `var(--gender-man)`) so the legend carries text (never color-alone), number X axis, currency-formatted Y axis (`useMoney` short form; mirror the axis formatting in `pay-comparison-section.tsx`), and a custom tooltip card listing: name (erased -> `payMapping.detail.erased`), roleTitle · level, band (`gap.bandLabel`), gender (`dashboard.people.gender.*`), grundlön (`scatter.basic`), rörligt (`scatter.variable`, the component sum, only when > 0), the FTE-adjusted total (`scatter.total`), the X value (`scatter.age`/`scatter.tenure` labels), and `groupLabel` when provided (likvärdigt). Under the chart: `scatter.omitted` ICU (en "{count, plural, one {# person without a {field} is not shown} other {# people without a {field} are not shown}}" is awkward across locales: use two keys instead, `scatter.omittedAge` en "{count, plural, one {# person without a birth date is not shown} other {# people without a birth date are not shown}}" and `scatter.omittedTenure` mirroring for start date), shown only when omitted > 0. When zero points: `scatter.emptyAge`/`scatter.emptyTenure` state the precondition in words. Loading (rows undefined): real title/help/toggle, a `Skeleton` block for the plot area (fixed height, e.g. `h-64`, matching the chart height so nothing shifts).
- Embeds: lika detail passes the group's member rows (the existing member-matching filter, extracted to a shared `groupMembers(rows, group)` helper in `pay-mapping-analysis.tsx`); likvärdigt passes the dominated group's members + every comparison group's members with `groupLabelFor` returning the owning group label.

- [ ] **Step 1: Write the failing tests**: `buildScatterPoints` (age mode omits missing birthDate and counts them; tenure mode keys on employmentStartDate; unpriced rows omitted; y is FTE-adjusted: 40000 basic + 2000 variable at 80 % fte -> 52500); component renders both series + legend, toggling X mode swaps the omitted note, empty precondition, tooltip content function returns the fields (test the exported tooltip render helper directly if recharts hover is impractical in jsdom, mirroring how `pay-comparison-section.test.tsx` tests its tooltip; read that file first).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**; embed under both details; i18n ×5 (`dashboard.payMapping.scatter.*` incl. title keys `titleLika` en "People in the group", `titleLikvardigt` en "People in the comparison", help `payGapScatterLabel/Body` explaining the historical-reasons lens).
- [ ] **Step 4: Run to PASS**: scatter + analysis tests, parity, `bun run typecheck`, Biome; leave uncommitted.

---

### Task 13: Overview documentation card + complete/reopen

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-documentation-card.tsx`, `.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx` (render the card between the KPI strip grid and the charts grid; it needs `gap`, `analyses`, `run` from context or props following the overview's existing data flow)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: `gap.lika` flags + `gap.womenDominated` comparisons + `analyses` + `run.status`; mutations `completePayMappingRun`, `reopenPayMappingRun`; core predicates for the required sets (same math as the backend, as a PREVIEW; the mutation re-derives authoritatively).
- Behavior: a `WidgetCard` (title `documentation.title` en "Documentation", help `help.payGapGate*` explaining the completion gate in plain language). Two progress rows: en `documentation.likaProgress` "{done} of {total} equal work groups marked done" and `documentation.likvardigtProgress` (women-dominated wording), each a `Link` into its analysis view (`/pay-mappings/${slug}/analysis`, `/analysis/likvardigt`; get slug via `usePathname` split as the sibling components do). Totals = required groups PLUS voluntarily done ones (spec: mirror the gate; concretely `total = required.size`, `done = required ∩ doneKeys` and a separate muted "+N frivilligt klarmarkerade" line only if `doneBeyond > 0`; keep it to the two figures and drop the extra line if noisy: decide = keep the simple `done of total` over required groups ONLY). Below: for an `active` run a primary `Button` `documentation.complete` en "Complete the pay mapping", disabled while `done < total` with muted text `documentation.remaining` ICU en "{count, plural, one {# group remains to mark done} other {# groups remain to mark done}}", enabled -> calls complete, `toast.success(dashboard.toast.payMappingCompleted)` en "Pay mapping completed."; for a `completed` run a `documentation.completedNote` line (en "The pay mapping is completed and locked.") + an outline `documentation.reopen` en "Reopen" button opening an `AlertDialog` (title/body/confirm keys `documentation.reopenConfirm*`, warning that editing reopens the statutory documentation) whose confirm calls reopen + `toast.success(dashboard.toast.payMappingReopened)` en "Pay mapping reopened.". While `gap`/`analyses` are undefined: real title/help, skeleton bars for the two progress rows, and the real button disabled.

- [ ] **Step 1: Write the failing tests**: progress counts from fixtures (2 required lika, 1 done; 1 required likvardigt, 0 done -> "1 of 2", "0 of 1"); button disabled with remaining text; enabled when all done and fires the mutation; completed state shows reopen + confirm flow fires reopen; loading shape.
- [ ] **Step 2: Run FAIL, implement, run PASS** (+ overview test update for the new card), parity, Biome; leave uncommitted.

---

### Task 14: Final sweep and full gate

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-staged-survey-detail-design.md` is NOT touched; instead verify `docs/superpowers/specs/2026-07-16-analysis-documentation-and-scatter-design.md` still matches what shipped and note any deviation inline under a "Deviations" heading (only if any).
- Modify: `.superpowers/sdd/progress.md` ledger (controller does this; implementer skips).

- [ ] **Step 1: Dead-reference sweep**: `grep -rn "singleGenderHidden\|bandRoles\|LikvardigtDetail" apps packages --include="*.ts" --include="*.tsx" --include="*.json" | grep -v ".next"` must be empty; `grep -rn "TODO\|XXX" <all new files>` empty.
- [ ] **Step 2: Full gate**: `bun run typecheck` (9/9), `bun run test` (8/8; includes i18n parity + audit label coverage), `bun x biome check --write` on every file this plan touched, mojibake grep on locale files (`grep -rn "Ã\|Â\|â€" packages/i18n/messages/*.json` empty).
- [ ] **Step 3:** Leave everything uncommitted; report per-task status to the controller.

---

## Self-review notes

- Spec coverage: sections 1-12 of the spec map to Tasks 1 (search), 2 (taxonomy), 3 (engine), 4 (schema + womenDominated wire), 5 (analyses + audit + errors), 6 (lifecycle), 7 (scatter wire), 8 (context), 9 (form), 10 (lika), 11 (likvärdigt reshape), 12 (scatter), 13 (overview card), 14 (sweep). Spec section 12's test list is distributed into the owning tasks.
- Type consistency: `womenDominatedComparisons` output field names (`womenSharePct`, `meanComp`, `diffPct`, `diffSek`, `headcount`, `comparisons`) are used verbatim in the gap wire shapes (Task 4), the frontend types (Task 7), and the UI (Task 11). The analyses wire shape `{scope, groupKey, reasons, note, done}` matches `GroupAnalysis` (Task 7) and the form props (Task 9). Group keys everywhere are the engine's `${roleTitle}|${band ?? "none"}|${level}` lika keys.
- Known judgment calls the implementer should NOT reopen: reasons diffed as a joined string in audit (arrays diff by identity); the progress card counts required groups only; `ageAt` doubles as the tenure calculator.
