# Pay-Mapping Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the run overview (`/pay-mappings/[slug]`) with the decision surface the owner's document describes: a context row with a reference selector, a six-card KPI strip, rule-derived observations, a pay-outcome panel beside the surviving quartile chart, a register table of groups with export-threshold masking, an action-plan block with an editable follow-up date, and a comparison layer that exists only when `?compare=<slug>` names an earlier completed run.

**Architecture:** The backend adds medians to the gap wire (one `compareMedians` helper in `@workspace/core`, applied per equal-work group and to the org aggregate), `withPayCount` and `followUpDate` to the run detail, a `frozenCriteria` summary to the run list, and one audited mutation `setPayMappingFollowUpDate`. Everything else is client derivation: pure helpers under `apps/dashboard/lib/pay-mapping-overview/` take the wire objects the run shell already subscribes to (gap, analyses, actions, run, run list) and return plain data; the shell gains three reference subscriptions keyed by the run named in the URL; the components under `apps/dashboard/components/pay-mapping/overview/` render those results block by block, each with its own content-shaped skeleton. The equality clock, mean-comparison bars, whole-survey donut and population card are deleted with their tests, help and message keys.

**Tech Stack:** Convex (`packages/backend`, convex-test on edge-runtime), `@workspace/core` (pure TS), Next.js 16 dashboard (React 19, TanStack Table v9, Base UI via `@workspace/ui`, next-intl, `@number-flow/react`, Motion), Vitest 4, Biome.

**Spec:** `docs/superpowers/specs/2026-09-03-pay-mapping-overview-redesign-design.md` (depends on `docs/superpowers/specs/2026-09-03-two-report-export-design.md`).

## Sequencing against the two-report plan

This plan runs AFTER `docs/superpowers/plans/2026-09-03-two-report-export.md` has been executed. It CONSUMES, and never re-creates, two modules that plan ships:

1. `apps/dashboard/components/pay-mapping/analysis-status.ts`: the analysis-status helper with the four statuses `noActionNeeded | objectiveReason | actionDecided | furtherAnalysis` and labels under `dashboard.payMapping.analysisStatus.*`. Its Task 5 ships exactly these exports, which this plan reads: `type AnalysisStatus`, `const ANALYSIS_STATUSES`, `equalWorkGroupStatus(group: Pick<GapGroup, "key" | "flag">, analyses: readonly GroupAnalysis[], actions: readonly PayMappingActionWire[]): AnalysisStatus`, `womenDominatedGroupStatus(group: Pick<WomenDominatedGroupWire, "key" | "comparisons">, analyses: readonly GroupAnalysis[], actions: readonly PayMappingActionWire[]): AnalysisStatus`. Exactly ONE file in this plan imports it (`apps/dashboard/lib/pay-mapping-overview/statuses.ts`, Task 3).
2. The masking threshold: `EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER`, `exportMasksGenderMeans(group: { womenCount: number; menCount: number }): boolean`, `exportMasksWholeGroupMean(headcount: number): boolean`. That plan's Task 8 creates `apps/dashboard/lib/pay-mapping-masking.ts` with them (imported by `signing-report-data.ts`, `pay-mapping-report-data.ts` and the key-figures workbook); Task 5 here checks that the path is in place and consumes it, and moves the module only if it is absent.

It also relies on that plan's `praxis` action target (`{ kind: "praxis"; area: PraxisAreaKey }` on `ActionTargetWire`, its Task 2) for the praxis observation (Task 4 here); on `getPayMappingRunBySlug` returning `frozenMethod` in place of `frozenCriteria` (its Task 4; Task 11 here reads `run.frozenMethod.criteria`, and the fixture is `makeFrozenCriterion`); on the unmasked assembly (`tccMedianText(members, formatters, signed)` without a `masked` parameter, its Task 6; Task 1 here switches it to the wire); on `targetScope` in the actions overview returning `"equalWork" | "equivalentWork" | "praxis"` (its Task 13; Task 12 here); and on the report export no longer capturing app charts (its Task 11; Task 13 here).

Task ordering deviates from the spec's prose in one place, on purpose: the i18n task (Task 9) precedes the component tasks, because typed message keys make a component that references a missing key a typecheck failure. The tree is green after every task.

## Global Constraints

- All code, code comments, log messages, commit messages, and code filenames are in English. Domain documents (ADRs) are in Swedish. Never use em dashes in text we write: UI copy, documents, comments, commit messages; use a period, comma, colon, or parentheses instead.
- All user-facing text goes through i18n (`next-intl` + `@workspace/i18n`). New strings are added to `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json` in the same task; every locale ships at production quality with the glossary's canonical terms and the wording neighbouring keys already use. Edit the JSON files with the Edit tool, never perl/sed (non-ASCII double-encodes). The parity test (`packages/i18n`) fails on any missing key; a bulk addition ends with a cross-locale QA pass in the same change.
- A `HelpMorphButton` sits only after a title or heading (a page, section, column, dialog, or card title) or after a field label; a help body is at most two sentences, max 200 characters in en and 240 in the other locales (`packages/i18n/src/messages.test.ts` enforces it). A new domain concept ships its help text in all locales in the same commit.
- Surfaces are text-minimal: standing text is titles, labels, counts and state words; explanation lives behind `HelpMorphButton`; no framing prose (no lead line, caption or intro paragraph restating what is visible).
- Every state-changing mutation writes an audit row via `ctx.audit.log` with an `AUDIT_EVENTS` key; a new event declares its subject in `AUDIT_SUBJECTS`, its payload contract in `lib/auditPayloads.ts`, and its label under `dashboard.auditLog.events.*` in every locale; every diffed field ships a `dashboard.auditLog.fields.*` label in every locale and is covered by `apps/dashboard/lib/audit-labels.test.ts`; a date field renders through the audit detail's date formatting, never as raw milliseconds.
- New code ships with tests in the same commit. All tests run with Vitest 4: `bun run test`, never `bun test`. Per package: `cd packages/core && bun run test`, `cd packages/backend && bun run test`, `cd apps/dashboard && bun run test`, `cd packages/i18n && bun run test`. Backend typecheck: `cd packages/backend && bunx tsc --noEmit -p convex`. Dashboard typecheck: `cd apps/dashboard && bunx tsc --noEmit`.
- Biome ends every task at zero errors, warnings and infos: `bunx biome check <files>` from the repo root; fix the code, never silence.
- No legacy before launch: what is replaced is deleted completely in the same change (components, tests, help keys, message keys); dev data is reset instead of migrated.
- DRY and typed by default: one constant or helper per literal, shape or rule; no `any`; a helper takes wire objects and returns plain data.
- Always build UI from `@workspace/ui` components or the app primitives composed from them: a date is the shadcn `DatePicker` (`@/components/date-picker`), never `<input type="date">`; a select is the `Select` component, never `<select>`; a segmented toggle is `ToggleGroup`.
- A register table is a TanStack data table: a toolbar with select filters (a result count appears while narrowing), sortable headings via `TableSortButton` in a `TableHead` carrying `aria-sort`, a declared default sort, client pagination via `TablePagination` past 25 rows, `table-fixed` with column widths declared once on the header cells, and a content-shaped `TableSkeleton` with the same `PAGE_SIZE` constant the pager uses. Inline-flex controls in a cell sit in a block flex wrapper.
- A surface that loads data shows a content-shaped skeleton; static-label controls (a select, a toggle, a title) render as their real component while the data loads; bars stand in for unknown data only.
- Charts in a widget card draw on `ChartCanvas`; the quartile chart keeps its existing anatomy unchanged.
- Live numbers render through `NumberFlow` (`@number-flow/react`); a number embedded in a translated sentence stays plain text unless the message is converted to a tag-based rich message rendered with `t.rich`.
- User-initiated CRUD shows a toast: `toast.success(t("dashboard.toast.<op>"))` from `@/lib/toast`, `toast.error(t("dashboard.toast.error"))` on failure.
- Animate legitimate transitions with Motion and respect `MotionConfig reducedMotion="user"`; read `docs/ui-animation.md` before any animation. Minimize layout shift: state changes never reflow existing content.
- Any change under `apps/dashboard/content/docs/` ends with `bun run docs:sync` (from `apps/dashboard`) in the same change; the drift guards in `apps/dashboard/lib/docs/docs-guards.test.ts` are the corpus's contract (locale parity, heading and link sequence parity, no em dashes).
- Commit rule (owner instruction, overrides the per-task commit habit): stage each task's files and present the diff; commit only after the owner approves, with the conventional message given in the task. No AI attribution in commits.
- After the last task: a reset of the dev deployment (`cd packages/backend && bunx convex run seed:resetDatabase`), a push (`bunx convex dev --once`) and a browser pass on localhost:3001 before reporting done.

---

## File map

**Core (`packages/core/src/`)**
- Modify `pay-analysis.ts`: `MedianComparison`, `compareMedians`.
- Modify `pay-analysis.test.ts`.

**Backend (`packages/backend/convex/`)**
- Modify `payMapping/orgGap.ts`: `OrgGap` gains the three median fields.
- Modify `payMapping/gap.ts`: `tccMetricShape`, `MASKED_TCC_METRIC`, `toGapGroup` medians, `orgAggregateShape` medians.
- Modify `payMapping/gap.test.ts`.
- Modify `payMapping/tables.ts`: `payMappingRuns.followUpDate`.
- Modify `payMapping/runs.ts`: `frozenCriteriaSummary`, run summary `frozenCriteria`, run detail `withPayCount` + `followUpDate`, mutation `setPayMappingFollowUpDate`.
- Modify `payMapping/runs.test.ts`.
- Modify `lib/audit.ts`: `payMappingFollowUpDateSet` event, subject, `FOLLOW_UP_AUDIT_FIELDS`.
- Modify `lib/auditPayloads.ts`: the event's payload contract.

**Dashboard helpers (`apps/dashboard/lib/`)**
- Create `pay-mapping-overview/statuses.ts` (+ test): `overviewStatuses`, `isRiskStatus`, `documentationDuties`.
- Create `pay-mapping-overview/kpis.ts` (+ test): `overviewCost`, `overviewKpis`.
- Create `pay-mapping-overview/observations.ts` (+ test): `overviewObservations`.
- Create `pay-mapping-overview/group-rows.ts` (+ test): `overviewEqualWorkRows`, `overviewEquivalentWorkRows`.
- Create `pay-mapping-overview/action-plan.ts` (+ test): `overviewActionPlan`.
- Create `pay-mapping-overview/comparison.ts` (+ test): `overviewDeltas`, `overviewComparability`, `referenceColumns`, `rowValueMap`.
- Create `iso-date.ts` (+ test): `isoToMs`, `msToIso` (moved out of `action-dialog.tsx`).
- Modify `audit-constants.ts`: `AUDIT_ISO_DATE_FIELDS` + `followUpDate`.
- Modify `audit-detail.tsx`: `FIELD_DISPLAY_ORDER` + `followUpDate`.
- Modify `audit-labels.test.ts`: `FOLLOW_UP_AUDIT_FIELDS`.

**Dashboard hooks (`apps/dashboard/hooks/`)**
- Create `use-compare-param.ts` (+ test).
- Create `use-number-flow-currency-format.ts` (+ test), lifted out of `actions-overview.tsx`.

**Dashboard components (`apps/dashboard/components/`)**
- Modify `panel-card.tsx`: optional `help`.
- Modify `pay-mapping/pay-mapping-gap-types.ts`: `GapTccMetric`, `OrgAggregate` medians, `PayMappingRunDetail.withPayCount` + `followUpDate`.
- Modify `pay-mapping/pay-mapping-run-context.tsx`: `PayMappingRunListEntry`, `PayMappingReference`, `referenceCandidates`, `resolveReferenceRun`.
- Create `pay-mapping/pay-mapping-run-context.test.ts`.
- Modify `pay-mapping/pay-mapping-run-shell.tsx` (+ test): the reference subscriptions.
- Modify `pay-mapping/analysis-chapters.ts`: `analysisStepHref`.
- Modify `pay-mapping/actions-overview.tsx`: consume `analysisStepHref` and the currency-format hook.
- Create `pay-mapping/quartile-stat.tsx` (+ test): `QuartileStat` moved verbatim.
- Create `pay-mapping/overview/overview-context-row.tsx` (+ test).
- Create `pay-mapping/overview/overview-kpi-strip.tsx` (+ test).
- Create `pay-mapping/overview/overview-comparability-notice.tsx` (+ test).
- Create `pay-mapping/overview/overview-observations.tsx` (+ test).
- Create `pay-mapping/overview/overview-pay-outcome.tsx` (+ test).
- Create `pay-mapping/overview/overview-group-table.tsx` (+ test).
- Create `pay-mapping/overview/overview-action-plan.tsx` (+ test).
- Rewrite `pay-mapping/pay-mapping-overview.tsx` (+ test) as the composition.
- Modify `app/(app)/pay-mappings/[slug]/page.tsx`.
- Modify `pay-mapping/action-dialog.tsx`: import the ISO helpers.
- Delete `pay-mapping/equality-clock.tsx` (+ test), `lib/equality-clock.ts` (+ test), `pay-mapping/mean-comparison-bars.tsx` (+ test), `pay-mapping/pay-mapping-population-card.tsx` (+ test), `pay-mapping/pay-mapping-trends.ts` (+ test).
- Modify `test/pay-mapping-fixtures.ts`: `makeGapTccMetric`, run detail and summary defaults.

**i18n (`packages/i18n/messages/`)**: `en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`.

**Docs**
- Rewrite `apps/dashboard/content/docs/{en,sv,nb,da,fi}/pay-mapping-overview.mdx`.
- Create `docs/adr/0031-oversikten-som-beslutsyta.md`; modify `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md` (addendum).

---

### Task 1: Medians on the gap wire

**Files:**
- Modify: `packages/core/src/pay-analysis.ts`
- Test: `packages/core/src/pay-analysis.test.ts`
- Modify: `packages/backend/convex/payMapping/orgGap.ts`
- Modify: `packages/backend/convex/payMapping/gap.ts`
- Test: `packages/backend/convex/payMapping/gap.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`
- Modify: `apps/dashboard/test/pay-mapping-fixtures.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (+ `pay-mapping-report-data.test.ts`)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx`, `review-queue.test.ts`, `actions-overview.test.tsx`, `pay-mapping-analysis.test.tsx`, `review-group-step.test.tsx`, `group-member-table.test.tsx` (inline fixtures only)

**Interfaces:**
- Consumes: `genderStats` (`@workspace/core`), `MetricComparison`, `gapMetricShape`, `MASKED_METRIC`, `toGapGroup`, `orgGap`.
- Produces: `compareMedians(women: readonly number[], men: readonly number[]): MedianComparison` and `interface MedianComparison { womenMedian: number | null; menMedian: number | null; medianGapPct: number | null }` in `@workspace/core`; wire `GapGroup.tcc` carries the three median fields (type `GapTccMetric` on the client); wire `OrgAggregate` carries `womenMedianComp`, `menMedianComp`, `medianGapPct`; fixture `makeGapTccMetric`.

- [ ] **Step 1: Write the failing core test**

Append to `packages/core/src/pay-analysis.test.ts`:

```ts
describe("compareMedians", () => {
  it("reports both medians and the signed median gap on total compensation", () => {
    expect(compareMedians([80000, 90000, 125000], [100000, 100000])).toEqual({
      womenMedian: 90000,
      menMedian: 100000,
      medianGapPct: 10,
    })
  })

  it("averages the two middle values on an even count", () => {
    expect(compareMedians([90000, 100000], [100000]).womenMedian).toBe(95000)
  })

  it("is null when a gender is absent or the men median is zero", () => {
    expect(compareMedians([], [100000])).toEqual({
      womenMedian: null,
      menMedian: 100000,
      medianGapPct: null,
    })
    expect(compareMedians([1], [0]).medianGapPct).toBeNull()
  })
})
```

Add `compareMedians` to the file's import from `./pay-analysis`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/core && bunx vitest run src/pay-analysis.test.ts`
Expected: FAIL with "compareMedians is not a function" (or an import error).

- [ ] **Step 3: Implement `compareMedians`**

In `packages/core/src/pay-analysis.ts`, directly after `compareMetric`:

```ts
// The per-gender medians beside the means, on the same signed convention
// as compareMetric (positive = women earn less). A median beside a mean is
// what tells a reader whether one outlier drives the gap, so the gap wire
// carries both for the primary measure. Null when a gender is absent or
// the men median is 0.
export interface MedianComparison {
  womenMedian: number | null
  menMedian: number | null
  medianGapPct: number | null
}

export function compareMedians(
  women: readonly number[],
  men: readonly number[]
): MedianComparison {
  const womenMedian = genderStats(women)?.median ?? null
  const menMedian = genderStats(men)?.median ?? null
  const comparable =
    womenMedian !== null && menMedian !== null && menMedian !== 0
  return {
    womenMedian,
    menMedian,
    medianGapPct: comparable
      ? ((menMedian - womenMedian) / menMedian) * 100
      : null,
  }
}
```

Run: `cd packages/core && bunx vitest run src/pay-analysis.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing backend tests**

In `packages/backend/convex/payMapping/gap.test.ts`, inside `describe("getPayMappingGap")`, add after the first test:

```ts
  it("reports the per-gender medians beside the means on total compensation", async () => {
    const t = initConvexTest()
    // Women 80k, 90k, 125k (mean 98 333, median 90k) vs men 100k, 100k.
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", seniority: "Senior", level: 3, basicMonthly: 80000 },
      { gender: "Kvinna", roleTitle: "SWE", seniority: "Senior", level: 3, basicMonthly: 90000 },
      { gender: "Kvinna", roleTitle: "SWE", seniority: "Senior", level: 3, basicMonthly: 125000 },
      { gender: "Man", roleTitle: "SWE", seniority: "Senior", level: 3, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "SWE", seniority: "Senior", level: 3, basicMonthly: 100000 },
    ])
    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })
    const group = result?.equalWork[0]
    expect(group?.tcc.womenMedian).toBe(90000)
    expect(group?.tcc.menMedian).toBe(100000)
    expect(group?.tcc.medianGapPct).toBe(10)
    // The org aggregate carries the same three fields over all priced rows.
    expect(result?.org.womenMedianComp).toBe(90000)
    expect(result?.org.menMedianComp).toBe(100000)
    expect(result?.org.medianGapPct).toBe(10)
  })
```

In the existing test `"masks a single-gender level in the equivalent-work list"`, append after the last expectation:

```ts
    expect(level1?.tcc.womenMedian).toBeNull()
    expect(level1?.tcc.menMedian).toBeNull()
    expect(level1?.tcc.medianGapPct).toBeNull()
```

- [ ] **Step 5: Run them to verify they fail**

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`
Expected: FAIL (`womenMedian` undefined on the wire).

- [ ] **Step 6: Org medians in `orgGap.ts`**

Change the import and the `OrgGap` interface:

```ts
import {
  compareMedians,
  computeGenderGap,
  type PayGapFlag,
} from "@workspace/core"
```

```ts
export interface OrgGap {
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  // The medians beside the means, on the same signed convention.
  womenMedianComp: number | null
  menMedianComp: number | null
  medianGapPct: number | null
  flag: PayGapFlag
}
```

In `orgGap()`, replace the `return` with:

```ts
  const stats = computeGenderGap(women, men)
  const medians = compareMedians(women, men)
  return {
    womenCount: stats.womenCount,
    menCount: stats.menCount,
    womenMeanComp: stats.womenMeanComp,
    menMeanComp: stats.menMeanComp,
    gapPct: stats.gapPct,
    womenMedianComp: medians.womenMedian,
    menMedianComp: medians.menMedian,
    medianGapPct: medians.medianGapPct,
    flag: stats.flag as PayGapFlag,
  }
```

- [ ] **Step 7: Medians on the group and org wire in `gap.ts`**

Add `compareMedians` and `type MedianComparison` to the `@workspace/core` import. After `gapMetricShape`:

```ts
// The primary measure's comparison also carries the per-gender medians
// (compareMedians): masked together with the means.
const tccMetricShape = gapMetricShape.extend({
  womenMedian: v.union(v.number(), v.null()),
  menMedian: v.union(v.number(), v.null()),
  medianGapPct: v.union(v.number(), v.null()),
})
```

In `gapGroupShape`, change `tcc: gapMetricShape,` to `tcc: tccMetricShape,`. In `orgAggregateShape`, after `gapPct`:

```ts
  womenMedianComp: v.union(v.number(), v.null()),
  menMedianComp: v.union(v.number(), v.null()),
  medianGapPct: v.union(v.number(), v.null()),
```

After `MASKED_METRIC`:

```ts
const MASKED_TCC_METRIC: MetricComparison & MedianComparison = Object.freeze({
  ...MASKED_METRIC,
  womenMedian: null,
  menMedian: null,
  medianGapPct: null,
})
```

In `toGapGroup`, replace `tcc: masked ? MASKED_METRIC : classification.tcc,` with:

```ts
    tcc: masked
      ? MASKED_TCC_METRIC
      : {
          ...classification.tcc,
          ...compareMedians(
            bucket.women.map((value) => value.tcc),
            bucket.men.map((value) => value.tcc)
          ),
        },
```

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts && bunx tsc --noEmit -p convex`
Expected: PASS, clean typecheck.

- [ ] **Step 8: Client types and fixtures**

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`, after `GapMetric`:

```ts
// The primary measure's comparison with the per-gender medians beside the
// means (the report tables print both; the overview's median note reads
// them). Masked together with the means.
export interface GapTccMetric extends GapMetric {
  womenMedian: number | null
  menMedian: number | null
  medianGapPct: number | null
}
```

Change `GapGroup.tcc: GapMetric` to `tcc: GapTccMetric`. In `OrgAggregate`, after `gapPct`:

```ts
  womenMedianComp: number | null
  menMedianComp: number | null
  medianGapPct: number | null
```

In `apps/dashboard/test/pay-mapping-fixtures.ts`, add `GapTccMetric` to the type import, then after `makeGapMetric`:

```ts
// The primary measure with its medians: the same 90k vs 100k pair, so the
// median gap equals the mean gap unless a test overrides one side.
export function makeGapTccMetric(
  overrides: Partial<GapTccMetric> = {}
): GapTccMetric {
  return {
    ...makeGapMetric(),
    womenMedian: 90000,
    menMedian: 100000,
    medianGapPct: 10,
    ...overrides,
  }
}
```

In `makeGapGroup`, change the `tcc?: Partial<GapMetric>` option to `tcc?: Partial<GapTccMetric>` and the built value to `tcc: makeGapTccMetric({ ...metric, ...tcc }),`. In `makeGapResult`'s `org`, after `gapPct: 10,` add `womenMedianComp: 90000, menMedianComp: 100000, medianGapPct: 10,`.

- [ ] **Step 9: The report assembly reads the wire medians**

In `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts`, add `GapTccMetric` to the type import from `./pay-mapping-gap-types` and replace `tccMedianText` with:

```ts
// The per-gender total-comp medians for a group, read from the gap wire
// (compareMedians in @workspace/core is the one median formula).
function tccMedianText(
  metric: GapTccMetric,
  formatters: ReportFormatters,
  signed = false
): ReportMedianText {
  const pct = signed ? formatters.signedPct : formatters.pct
  return {
    women:
      metric.womenMedian === null ? null : formatters.money(metric.womenMedian),
    men: metric.menMedian === null ? null : formatters.money(metric.menMedian),
    gapPct: metric.medianGapPct === null ? null : pct(metric.medianGapPct),
  }
}
```

In `groupRow`, replace the `tccMedian: tccMedianText(memberRows(rows, group), formatters, signed),` call with `tccMedian: tccMedianText(group.tcc, formatters, signed),`. Where the assembly derives the org medians (`const orgWomenMedian = percentileOf(orgWomenValues, 50)` and its men twin), read the wire instead:

```ts
  const orgWomenMedian = gap.org.womenMedianComp
  const orgMenMedian = gap.org.menMedianComp
```

(`percentileOf(values, 50)` and `compareMedians` agree on every list, so no figure moves.) Grep `genderStats` in the file afterwards: `orgVariablePayStats` keeps its own call; nothing else may still compute a median from rows. Drop imports that became unused.

In `pay-mapping-report-data.test.ts`, the test `"carries medians, year-over-year figures, spread and the excluded lists"` asserts SWE's `tccMedian.women` as `"M50000"`, QA's as `null`, and `doc.org.womenMedian` as `"M50000"` with `menMedian` and `medianGapPct` null, all previously computed from the one priced woman's rows. Set them on the wire fixtures instead: in the `assemble` fixture the SWE `makeGapGroup` call gets `tcc: { womenMedian: 50000, menMedian: null, medianGapPct: null }`, the QA call `tcc: { womenMedian: null, menMedian: null, medianGapPct: null }`, and the `makeGapResult` call's `org` gets `womenMedianComp: 50000, menMedianComp: null, medianGapPct: null`; the assertions stay as they are.

- [ ] **Step 10: Inline fixtures in other tests**

Run: `cd apps/dashboard && bunx tsc --noEmit`. Every error is an inline literal missing the new fields. Add `womenMedianComp: 90000, menMedianComp: 100000, medianGapPct: 10` to each inline `org: { ... }` (expected in `pay-mapping-overview.test.tsx`, `review-queue.test.ts`, `actions-overview.test.tsx`, `pay-mapping-analysis.test.tsx`) and `womenMedian: <womenMean>, menMedian: <menMean>, medianGapPct: <gapPct>` to each inline `tcc: { ... }` literal (expected in `review-group-step.test.tsx`, `group-member-table.test.tsx`). Re-run until clean.

- [ ] **Step 11: Run everything**

Run: `cd apps/dashboard && bun run test && cd ../../packages/backend && bun run test && cd ../core && bun run test`, then `bunx biome check packages/core/src packages/backend/convex/payMapping apps/dashboard/components/pay-mapping apps/dashboard/test` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 12: Present the diff (no commit)**

Proposed message when approved: `feat(pay-mapping): carry per-gender medians on the gap wire`

---

### Task 2: Run detail fields, the follow-up date mutation and its audit wiring

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts`
- Modify: `packages/backend/convex/payMapping/runs.ts`
- Test: `packages/backend/convex/payMapping/runs.test.ts`
- Modify: `packages/backend/convex/lib/audit.ts`
- Modify: `packages/backend/convex/lib/auditPayloads.ts`
- Test: `packages/backend/convex/lib/audit.test.ts` (the compile-time-total subject maps)
- Modify: `apps/dashboard/lib/audit-constants.ts`, `apps/dashboard/lib/audit-detail.tsx`, `apps/dashboard/lib/audit-labels.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`, `apps/dashboard/test/pay-mapping-fixtures.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (audit labels only)

**Interfaces:**
- Consumes: `orgMutation`, `appError`/`ERROR_CODES`, `buildChanges`, `plannedDateIso` (`./workLayer`), `AUDIT_EVENTS`.
- Produces: `payMappingRuns.followUpDate?: number`; `getPayMappingRunBySlug` returns `withPayCount: number` and `followUpDate: number | null`; `listPayMappingRuns` entries gain `frozenCriteria: { libraryKey: string | null; name: string; weightPoints: number }[]`; `sortedFrozenCriteria(run)` (module-private) feeds both the summary and `frozenMethod.criteria`; mutation `api.payMapping.runs.setPayMappingFollowUpDate({ orgId, runId, followUpDate: number | null })`; event `payMapping.followUpDateSet` with `changes.followUpDate` as ISO date strings; `FOLLOW_UP_AUDIT_FIELDS`; client `PayMappingRunDetail.withPayCount` and `.followUpDate`.

- [ ] **Step 1: Write the failing backend tests**

In `packages/backend/convex/payMapping/runs.test.ts`, inside `describe("getPayMappingRunBySlug")`, add:

```ts
  it("returns the frozen with-pay count and a null follow-up date on a fresh run", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedRun(t, noRequiredGroupRows)
    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.withPayCount).toBe(
      noRequiredGroupRows.filter((r) => r.basicMonthly !== null).length
    )
    expect(result?.followUpDate).toBeNull()
  })
```

Inside `describe("listPayMappingRuns")`, add:

```ts
  it("summarizes each run's frozen criteria as name and weight points", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedRun(t, noRequiredGroupRows)
    const runs = await asHr.query(api.payMapping.runs.listPayMappingRuns, {
      orgId,
    })
    // seedRun freezes an empty criteria list; the field exists and is empty.
    // (seedForFreeze's run, in the startPayMappingRun tests, carries the
    // seeded library keys: extend the first of those tests with
    // `expect(runs[0]?.frozenCriteria.map((c) => c.libraryKey)).toEqual([...SEEDED_LIBRARY_KEYS])`
    // after its existing list assertions.)
    expect(runs[0]?.frozenCriteria).toEqual([])
  })
```

After `describe("setPayMappingCollaboration")`, add:

```ts
describe("setPayMappingFollowUpDate", () => {
  const MARCH_1 = Date.UTC(2027, 2, 1)

  it("sets the follow-up date and reads it back via the slug query", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await asHr.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
      orgId,
      runId,
      followUpDate: MARCH_1,
    })
    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.followUpDate).toBe(MARCH_1)
  })

  it("clears the date with null and stays editable on a completed run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)
    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })
    await asHr.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
      orgId,
      runId,
      followUpDate: MARCH_1,
    })
    await asHr.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
      orgId,
      runId,
      followUpDate: null,
    })
    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.followUpDate).toBeNull()
  })

  it("writes one payMapping.followUpDateSet row diffing ISO dates, and none on a no-op", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await asHr.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
      orgId,
      runId,
      followUpDate: MARCH_1,
    })
    await asHr.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
      orgId,
      runId,
      followUpDate: MARCH_1,
    })
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.followUpDateSet")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.payload).toEqual({
      runId,
      changes: { followUpDate: { from: null, to: "2027-03-01" } },
    })
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
  })

  it("isolates cross-org access: another org's member gets notFound", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, noRequiredGroupRows)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })
    await expect(
      asOther.mutation(api.payMapping.runs.setPayMappingFollowUpDate, {
        orgId: otherOrg,
        runId,
        followUpDate: MARCH_1,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd packages/backend && bunx vitest run convex/payMapping/runs.test.ts -t "followUpDate|with-pay|frozen criteria"`
Expected: FAIL (no such mutation; `withPayCount` undefined; `frozenCriteria` undefined).

- [ ] **Step 3: Schema field**

In `packages/backend/convex/payMapping/tables.ts`, after the `collaboration` field of `payMappingRuns`:

```ts
  // The action plan's next decision point (epoch ms, day precision).
  // Planning metadata, not frozen evidence: editable after completion, the
  // way an action's status is, because the plan runs over years while the
  // snapshot never changes.
  followUpDate: v.optional(v.number()),
```

- [ ] **Step 4: Audit event, subject, fields and payload**

In `packages/backend/convex/lib/audit.ts`, `AUDIT_EVENTS`, after `payMappingCollaborationUpdated`:

```ts
  payMappingFollowUpDateSet: "payMapping.followUpDateSet",
```

In `AUDIT_SUBJECTS`, after the `"payMapping.collaborationUpdated"` entry:

```ts
  "payMapping.followUpDateSet": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
```

After `NOTE_AUDIT_FIELDS`:

```ts
// The run's follow-up date, diffed on payMapping.followUpDateSet as an ISO
// date string (never epoch ms), like an action's plannedDate.
export const FOLLOW_UP_AUDIT_FIELDS = ["followUpDate"] as const
```

In `packages/backend/convex/lib/auditPayloads.ts`, after `"payMapping.collaborationUpdated"`:

```ts
  // The next decision point: a before/after diff of one ISO date, so the
  // log renders it as an arrow through the date formatter.
  "payMapping.followUpDateSet": { runId: string; changes: Changes }
```

In `packages/backend/convex/lib/audit.test.ts` (both maps are total over `AuditEvent`, so the backend typecheck is red until they carry the new event): in `SUBJECT_FIXTURES`, after the `"payMapping.collaborationUpdated"` entry, add `"payMapping.followUpDateSet": { runId: "run-1", changes: {} },`; in `EXPECTED_SUBJECTS`, after its `"payMapping.collaborationUpdated"` entry, add `"payMapping.followUpDateSet": { kind: "payMappingRun", id: "run-1" },`; in the `otherFieldSets` object of the test `keeps identity fields out of every other event's diff`, add `FOLLOW_UP_AUDIT_FIELDS,` after `NOTE_AUDIT_FIELDS,` and add `FOLLOW_UP_AUDIT_FIELDS` to the file's import from `./audit`.

- [ ] **Step 5: The run wire and the mutation**

In `packages/backend/convex/payMapping/runs.ts`, the two-report plan already imports `buildChanges` and `COLLABORATION_AUDIT_FIELDS` from `../lib/audit` and `plannedDateIso` from `./workLayer`; add `FOLLOW_UP_AUDIT_FIELDS` to the `../lib/audit` import.

Above `runSummary`, add the one evidence-order sort and the summary derived from it:

```ts
// The frozen model's criteria in evidence order: the ONE sort both the run
// detail's frozenMethod and the run list's summary derive from.
function sortedFrozenCriteria(run: Doc<"payMappingRuns">) {
  return [...run.frozenModel.criteria].sort(
    (a, b) =>
      (a.order ?? Number.POSITIVE_INFINITY) -
      (b.order ?? Number.POSITIVE_INFINITY)
  )
}

// Identity (the library key, null on a pre-cutover run's evidence), name
// and weight points: what the overview needs to tell whether two mappings
// were computed under the same method without loading either snapshot.
const frozenCriteriaSummaryShape = v.array(
  v.object({
    libraryKey: v.union(v.string(), v.null()),
    name: v.string(),
    weightPoints: v.number(),
  })
)

function frozenCriteriaSummary(
  run: Doc<"payMappingRuns">
): { libraryKey: string | null; name: string; weightPoints: number }[] {
  return sortedFrozenCriteria(run).map((criterion) => ({
    libraryKey: criterion.libraryKey ?? null,
    name: criterion.name,
    weightPoints: criterion.weightPoints,
  }))
}
```

In `getPayMappingRunBySlug`'s handler, the two-report plan builds `frozenMethod.criteria` from `[...run.frozenModel.criteria].sort(...)` inline: replace that spread-and-sort with `sortedFrozenCriteria(run)` and keep its `.map(...)` body as it is, so the detail and the list can never order the criteria differently.

In `runSummary`, after `orgGapFlag: payGapFlag,` add `frozenCriteria: frozenCriteriaSummaryShape,`; in `listPayMappingRuns`' map, after `orgGapFlag: r.orgGapFlag,` add `frozenCriteria: frozenCriteriaSummary(r),`.

In `getPayMappingRunBySlug`'s `returns` object, after `populationCount: v.number(),`:

```ts
      // Frozen beside populationCount: the overview's coverage line reads
      // "N of M with pay" from the same two fields the run list reports.
      withPayCount: v.number(),
      // The action plan's next decision point; null until set.
      followUpDate: v.union(v.number(), v.null()),
```

In its handler's returned object, after `populationCount: run.populationCount,` add `withPayCount: run.withPayCount, followUpDate: run.followUpDate ?? null,`. The detail's `frozenMethod` (two-report plan) stays as it is; `frozenCriteriaSummary` serves the run list only.

After `setPayMappingCollaboration`, add:

```ts
// The action plan's next decision point. Allowed on a completed run: the
// plan runs over years while the frozen evidence never changes, and the
// audit row is the record of every move. Diffed as ISO dates; an unchanged
// date is a no-op that writes nothing.
export const setPayMappingFollowUpDate = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    followUpDate: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, followUpDate }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    const before = run.followUpDate ?? null
    if (before === followUpDate) return null
    await ctx.db.patch(runId, { followUpDate: followUpDate ?? undefined })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingFollowUpDateSet,
      payload: {
        runId,
        changes: buildChanges(
          { followUpDate: before === null ? null : plannedDateIso(before) },
          {
            followUpDate:
              followUpDate === null ? null : plannedDateIso(followUpDate),
          },
          FOLLOW_UP_AUDIT_FIELDS
        ),
      },
    })
    return null
  },
})
```

Run: `cd packages/backend && bunx vitest run convex/payMapping/runs.test.ts && bunx tsc --noEmit -p convex && bun run test`
Expected: PASS (the audit coverage tests in `lib/audit.test.ts` see the new event's category and subject).

- [ ] **Step 6: Dashboard audit wiring and the run detail type**

`apps/dashboard/lib/audit-constants.ts`, `AUDIT_ISO_DATE_FIELDS`: add `"followUpDate",` after `"plannedDate",`.

`apps/dashboard/lib/audit-detail.tsx`, `FIELD_DISPLAY_ORDER`: after `"withPayCount",` (present today under the pay-mapping run flat-stats comment) add `"followUpDate",`; if that anchor is gone, anchor it directly after `"plannedDate",` instead, and if neither exists append it to the pay-mapping block with a comment `// Pay-mapping run follow-up (payMapping.followUpDateSet).`

`apps/dashboard/lib/audit-labels.test.ts`: add `FOLLOW_UP_AUDIT_FIELDS,` to the `@workspace/backend/convex/lib/audit` import and `...FOLLOW_UP_AUDIT_FIELDS,` after `...NOTE_AUDIT_FIELDS,` in `ALL_AUDIT_FIELDS`.

`apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`, `PayMappingRunDetail`, after `populationCount: number`:

```ts
  // How many of the frozen population carried a pay record at the freeze;
  // the overview's coverage line.
  withPayCount: number
  // The action plan's next decision point (epoch ms, day precision), null
  // until set.
  followUpDate: number | null
```

`apps/dashboard/test/pay-mapping-fixtures.ts`, `makeRunDetail`: after `populationCount: 6,` add `withPayCount: 6, followUpDate: null,`.

- [ ] **Step 7: Audit labels in five locales**

`dashboard.auditLog.events.payMappingFollowUpDateSet` and `dashboard.auditLog.fields.followUpDate`, placed after `payMappingCollaborationUpdated` and after `plannedDate` respectively:

| locale | event | field |
|---|---|---|
| en | `Follow-up date set` | `Next decision point` |
| sv | `Uppföljningsdatum satt` | `Nästa beslutspunkt` |
| nb | `Oppfølgingsdato satt` | `Neste beslutningspunkt` |
| da | `Opfølgningsdato sat` | `Næste beslutningspunkt` |
| fi | `Seurantapäivä asetettu` | `Seuraava päätöskohta` |

- [ ] **Step 8: Verify**

Run: `cd packages/i18n && bun run test && cd ../../apps/dashboard && bunx tsc --noEmit && bunx vitest run lib/audit-labels.test.ts lib/audit-detail.test.tsx`, then `bunx biome check packages/backend/convex apps/dashboard/lib apps/dashboard/test` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 9: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): follow-up date on the run with an audited mutation, with-pay count and frozen criteria on the wire`

---

### Task 3: Helpers: statuses and the six KPI values

**Files:**
- Modify: `apps/dashboard/test/pay-mapping-fixtures.ts` (`makeAction`)
- Create: `apps/dashboard/lib/pay-mapping-overview/statuses.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/statuses.test.ts`
- Create: `apps/dashboard/lib/pay-mapping-overview/kpis.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/kpis.test.ts`

**Interfaces:**
- Consumes: `equalWorkGroupStatus`, `womenDominatedGroupStatus`, `type AnalysisStatus` from `@/components/pay-mapping/analysis-status` (the ONLY import site of that module in this plan); `equalWorkGroupRequiresDocumentation`, `womenDominatedGroupRequiresDocumentation` (`@workspace/core`); `primaryGapMetric`, wire types from `@/components/pay-mapping/pay-mapping-gap-types`.
- Produces:
  - `interface OverviewStatuses { equalWork: ReadonlyMap<string, AnalysisStatus>; womenDominated: ReadonlyMap<string, AnalysisStatus> }`, `overviewStatuses(gap, analyses, actions): OverviewStatuses`, `isRiskStatus(status): boolean`, `interface DocumentationDuty { key: string; scope: "equalWork" | "equivalentWork"; done: boolean }`, `documentationDuties(gap, analyses): DocumentationDuty[]`.
  - `interface OverviewCost { annual: number; oneOff: number; firstYear: number; costed: number; uncosted: number }`, `overviewCost(actions): OverviewCost`, `interface OverviewKpis { scope: { included: number; women: number; men: number; withPay: number }; totalGap: { meanPct: number | null; medianPct: number | null }; remaining: { open: number; total: number }; risk: { groups: number; total: number; affected: number }; actions: { done: number; inProgress: number; total: number }; cost: OverviewCost }`, `overviewKpis(input: OverviewKpiInput): OverviewKpis` with `interface OverviewKpiInput { gap; analyses; actions; run: { populationCount: number; withPayCount: number }; statuses: OverviewStatuses }`, `MONTHS_PER_YEAR = 12`.

- [ ] **Step 0: One action fixture for every overview test**

In `apps/dashboard/test/pay-mapping-fixtures.ts`, add `PayMappingActionWire` to the type import from `@/components/pay-mapping/pay-mapping-gap-types` and append:

```ts
// A formal action anchored to the SWE group by default; tests override the
// target, the status and the cost. `number` is the run's own action number.
// The two report tests keep their local helpers of the same name (a
// positional one and a costed one); this is the overview tests' single
// builder, so no test below carries an action literal of its own.
export function makeAction(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as PayMappingActionWire["actionId"],
    number: 1,
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
    problem: "Unexplained gap",
    plannedAction: "Salary review",
    reason: null,
    ownerUserId: "u1",
    ownerName: "Owner",
    plannedDate: Date.UTC(2027, 0, 1),
    estimatedCost: null,
    estimatedCostUnit: null,
    priority: "medium",
    status: "notStarted",
    erased: false,
    createdAt: 1,
    ...overrides,
  }
}
```

- [ ] **Step 1: Write the failing statuses test**

`apps/dashboard/lib/pay-mapping-overview/statuses.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { makeAction, makeGapGroup, makeGapResult } from "@/test/pay-mapping-fixtures"
import type {
  GroupAnalysis,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import {
  documentationDuties,
  isRiskStatus,
  overviewStatuses,
} from "./statuses"

function analysis(
  scope: GroupAnalysis["scope"],
  groupKey: string,
  done: boolean
): GroupAnalysis {
  return {
    scope,
    groupKey,
    comparisonKey: null,
    reasons: done ? ["experience"] : [],
    note: null,
    done,
    finding: null,
  }
}

const dominated: WomenDominatedGroupWire = {
  key: "Nurse|2",
  roleTitle: "Nurse",
  seniority: null,
  level: 2,
  headcount: 5,
  womenSharePct: 80,
  meanComp: 40000,
  comparisons: [
    {
      key: "Support|3",
      roleTitle: "Support",
      seniority: null,
      level: 3,
      headcount: 4,
      womenSharePct: 25,
      meanComp: 44000,
      diffPct: 10,
      diffSek: 4000,
    },
  ],
}

describe("overviewStatuses", () => {
  it("keys one status per equal-work group and per women-dominated group", () => {
    const gap = makeGapResult({
      equalWork: [
        makeGapGroup({ key: "SWE|3", flag: "elevated" }),
        makeGapGroup({ key: "QA|3", flag: "ok" }),
      ],
      womenDominated: [dominated],
    })
    const statuses = overviewStatuses(
      gap,
      [analysis("equalWork", "SWE|3", true)],
      [makeAction({ target: { kind: "group", scope: "equalWork", groupKey: "QA|3" } })]
    )
    expect(statuses.equalWork.get("SWE|3")).toBe("objectiveReason")
    expect(statuses.equalWork.get("QA|3")).toBe("actionDecided")
    expect(statuses.womenDominated.get("Nurse|2")).toBe("furtherAnalysis")
  })
})

describe("isRiskStatus", () => {
  it("is true for further analysis and a decided action only", () => {
    expect(isRiskStatus("furtherAnalysis")).toBe(true)
    expect(isRiskStatus("actionDecided")).toBe(true)
    expect(isRiskStatus("objectiveReason")).toBe(false)
    expect(isRiskStatus("noActionNeeded")).toBe(false)
  })
})

describe("documentationDuties", () => {
  it("lists the groups that require documentation with their done state", () => {
    const gap = makeGapResult({
      equalWork: [
        makeGapGroup({ key: "SWE|3", flag: "critical" }),
        makeGapGroup({ key: "QA|3", flag: "ok" }),
      ],
      womenDominated: [dominated, { ...dominated, key: "Admin|4", comparisons: [] }],
    })
    expect(
      documentationDuties(gap, [analysis("equivalentWork", "Nurse|2", true)])
    ).toEqual([
      { key: "SWE|3", scope: "equalWork", done: false },
      { key: "Nurse|2", scope: "equivalentWork", done: true },
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/statuses.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `statuses.ts`**

```ts
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import {
  type AnalysisStatus,
  equalWorkGroupStatus,
  womenDominatedGroupStatus,
} from "@/components/pay-mapping/analysis-status"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
} from "@/components/pay-mapping/pay-mapping-gap-types"

// One derived status per group, keyed by group key, computed ONCE per
// render from the shell's subscriptions. Every overview helper takes this
// map rather than calling the status helper itself, so the four statuses
// are resolved in exactly one place.
export interface OverviewStatuses {
  equalWork: ReadonlyMap<string, AnalysisStatus>
  womenDominated: ReadonlyMap<string, AnalysisStatus>
}

export function overviewStatuses(
  gap: PayMappingGapResult,
  analyses: GroupAnalysis[],
  actions: PayMappingActionWire[]
): OverviewStatuses {
  return {
    equalWork: new Map(
      gap.equalWork.map((group) => [
        group.key,
        equalWorkGroupStatus(group, analyses, actions),
      ])
    ),
    womenDominated: new Map(
      gap.womenDominated.map((group) => [
        group.key,
        womenDominatedGroupStatus(group, analyses, actions),
      ])
    ),
  }
}

// A risk group is one whose difference is still open or has an action
// decided against it; a documented objective reason closes it.
export function isRiskStatus(status: AnalysisStatus): boolean {
  return status === "furtherAnalysis" || status === "actionDecided"
}

// The groups the completion gate requires documentation for (the same rule
// as requiredDocumentationKeys on the backend), with whether their own
// analysis row is marked done. Independent of actions on purpose: the gate
// asks for a done row, and "remaining to analyse" answers the gate.
export interface DocumentationDuty {
  key: string
  scope: "equalWork" | "equivalentWork"
  done: boolean
}

export function documentationDuties(
  gap: PayMappingGapResult,
  analyses: GroupAnalysis[]
): DocumentationDuty[] {
  const isDone = (scope: DocumentationDuty["scope"], key: string) =>
    analyses.some(
      (row) =>
        row.scope === scope &&
        row.groupKey === key &&
        row.comparisonKey === null &&
        row.done
    )
  return [
    ...gap.equalWork
      .filter((group) => equalWorkGroupRequiresDocumentation(group.flag))
      .map((group) => ({
        key: group.key,
        scope: "equalWork" as const,
        done: isDone("equalWork", group.key),
      })),
    ...gap.womenDominated
      .filter((group) =>
        womenDominatedGroupRequiresDocumentation(group.comparisons.length)
      )
      .map((group) => ({
        key: group.key,
        scope: "equivalentWork" as const,
        done: isDone("equivalentWork", group.key),
      })),
  ]
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/statuses.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing KPI test**

`apps/dashboard/lib/pay-mapping-overview/kpis.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { makeAction, makeGapGroup, makeGapResult } from "@/test/pay-mapping-fixtures"
import type {
  GroupAnalysis,
  PayMappingActionWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { overviewCost, overviewKpis } from "./kpis"
import { overviewStatuses } from "./statuses"

const doneRow: GroupAnalysis = {
  scope: "equalWork",
  groupKey: "QA|3",
  comparisonKey: null,
  reasons: ["experience"],
  note: null,
  done: true,
  finding: null,
}

describe("overviewCost", () => {
  it("annualises per-month costs, keeps one-off apart and counts uncosted actions", () => {
    const cost = overviewCost([
      makeAction({ estimatedCost: 1000, estimatedCostUnit: "perMonth" }),
      makeAction({ estimatedCost: 5000, estimatedCostUnit: "perYear" }),
      makeAction({ estimatedCost: 20000, estimatedCostUnit: "oneOff" }),
      makeAction(),
    ])
    expect(cost).toEqual({
      annual: 17000,
      oneOff: 20000,
      firstYear: 37000,
      costed: 3,
      uncosted: 1,
    })
  })
})

describe("overviewKpis", () => {
  const gap = makeGapResult({
    equalWork: [
      makeGapGroup({ key: "SWE|3", flag: "critical", womenCount: 3, menCount: 5 }),
      makeGapGroup({ key: "QA|3", flag: "elevated", womenCount: 2, menCount: 2 }),
      makeGapGroup({ key: "Ops|4", flag: "ok" }),
    ],
    population: { women: 40, men: 60 },
  })
  const actions = [
    makeAction({ status: "done" }),
    makeAction({ actionId: "a2" as PayMappingActionWire["actionId"], status: "inProgress" }),
  ]
  const kpis = overviewKpis({
    gap,
    analyses: [doneRow],
    actions,
    run: { populationCount: 100, withPayCount: 96 },
    statuses: overviewStatuses(gap, [doneRow], actions),
  })

  it("reads the scope from the run and the population split from the gap", () => {
    expect(kpis.scope).toEqual({ included: 100, women: 40, men: 60, withPay: 96 })
  })

  it("carries the org mean and median gap", () => {
    expect(kpis.totalGap).toEqual({ meanPct: 10, medianPct: 10 })
  })

  it("counts the groups that require documentation and are not done", () => {
    // SWE (critical, open) and QA (elevated, done) require it; Ops does not.
    expect(kpis.remaining).toEqual({ open: 1, total: 2 })
  })

  it("counts risk groups out of all groups and the lower-paid gender in them", () => {
    // SWE has an action (actionDecided) and 3 women behind; QA has a reason.
    expect(kpis.risk).toEqual({ groups: 1, total: 3, affected: 3 })
  })

  it("splits actions by status", () => {
    expect(kpis.actions).toEqual({ done: 1, inProgress: 1, total: 2 })
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/kpis.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement `kpis.ts`**

```ts
import {
  type GroupAnalysis,
  type PayMappingActionWire,
  type PayMappingGapResult,
  primaryGapMetric,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import {
  documentationDuties,
  isRiskStatus,
  type OverviewStatuses,
} from "./statuses"

export const MONTHS_PER_YEAR = 12

// The action plan's money, split by recurrence: an annual figure (every
// per-year cost plus twelve times every per-month cost), the one-off sum,
// and the first year's total. Actions without a cost are counted, never
// summed; erased actions keep their structure and count like any other.
export interface OverviewCost {
  annual: number
  oneOff: number
  firstYear: number
  costed: number
  uncosted: number
}

export function overviewCost(actions: PayMappingActionWire[]): OverviewCost {
  let annual = 0
  let oneOff = 0
  let costed = 0
  let uncosted = 0
  for (const action of actions) {
    if (action.estimatedCost === null) {
      uncosted += 1
      continue
    }
    costed += 1
    switch (action.estimatedCostUnit) {
      case "perMonth":
        annual += action.estimatedCost * MONTHS_PER_YEAR
        break
      case "perYear":
        annual += action.estimatedCost
        break
      default:
        oneOff += action.estimatedCost
    }
  }
  return { annual, oneOff, firstYear: annual + oneOff, costed, uncosted }
}

export interface OverviewKpis {
  scope: { included: number; women: number; men: number; withPay: number }
  totalGap: { meanPct: number | null; medianPct: number | null }
  remaining: { open: number; total: number }
  risk: { groups: number; total: number; affected: number }
  actions: { done: number; inProgress: number; total: number }
  cost: OverviewCost
}

export interface OverviewKpiInput {
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  run: { populationCount: number; withPayCount: number }
  statuses: OverviewStatuses
}

// The six card values. Two different denominators, on purpose: "remaining"
// counts against the groups that REQUIRE documentation (it answers the
// completion gate), "risk" counts against EVERY group with a comparison
// (it answers how much of the mapping is at risk); each card's note or
// help names its own. "Affected" counts the lower-paid gender in each risk
// group (women where the group's primary gap is women-behind, men in the
// reverse case) and everyone in a women-dominated risk group.
export function overviewKpis(input: OverviewKpiInput): OverviewKpis {
  const { gap, analyses, actions, run, statuses } = input
  const duties = documentationDuties(gap, analyses)

  let riskGroups = 0
  let affected = 0
  for (const group of gap.equalWork) {
    const status = statuses.equalWork.get(group.key)
    if (status === undefined || !isRiskStatus(status)) continue
    riskGroups += 1
    const gapPct = primaryGapMetric(group).gapPct ?? 0
    affected += gapPct >= 0 ? group.womenCount : group.menCount
  }
  for (const group of gap.womenDominated) {
    const status = statuses.womenDominated.get(group.key)
    if (status === undefined || !isRiskStatus(status)) continue
    riskGroups += 1
    affected += group.headcount
  }

  return {
    scope: {
      included: run.populationCount,
      women: gap.population.women,
      men: gap.population.men,
      withPay: run.withPayCount,
    },
    totalGap: { meanPct: gap.org.gapPct, medianPct: gap.org.medianGapPct },
    remaining: {
      open: duties.filter((duty) => !duty.done).length,
      total: duties.length,
    },
    risk: {
      groups: riskGroups,
      total: gap.equalWork.length + gap.womenDominated.length,
      affected,
    },
    actions: {
      done: actions.filter((action) => action.status === "done").length,
      inProgress: actions.filter((action) => action.status === "inProgress")
        .length,
      total: actions.length,
    },
    cost: overviewCost(actions),
  }
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/pay-mapping-overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 7: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview status map and KPI derivation`

---

### Task 4: Helper: prioritised observations

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-overview/observations.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/observations.test.ts`

**Interfaces:**
- Consumes: `OverviewStatuses`, `isRiskStatus`, `documentationDuties` (Task 3); `PRAXIS_AREA_KEYS`, `type PraxisAreaKey` (`@workspace/constants`); `primaryGapMetric`; the `praxis` action target kind from the two-report plan.
- Produces: `OBSERVATION_LIMIT = 5`, `UPPER_QUARTILE_SHORTFALL_POINTS = 10`, `type ObservationStatus = "actionRequired" | "needsReview"`, the discriminated union `OverviewObservation` below, `overviewObservations(input: { gap; analyses; actions; statuses }): OverviewObservation[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { makeAction, makeGapGroup, makeGapResult } from "@/test/pay-mapping-fixtures"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { OBSERVATION_LIMIT, overviewObservations } from "./observations"
import { overviewStatuses } from "./statuses"

function praxisRow(area: string, finding: "none" | "found"): GroupAnalysis {
  return {
    scope: "praxis",
    groupKey: area,
    comparisonKey: null,
    reasons: [],
    note: "n",
    done: true,
    finding,
  }
}

const dominated: WomenDominatedGroupWire = {
  key: "Nurse|2",
  roleTitle: "Nurse",
  seniority: null,
  level: 2,
  headcount: 4,
  womenSharePct: 75,
  meanComp: 40000,
  comparisons: [
    { key: "Support|3", roleTitle: "Support", seniority: null, level: 3, headcount: 4, womenSharePct: 25, meanComp: 41480, diffPct: 3.7, diffSek: 1480 },
    { key: "Clerk|3", roleTitle: "Clerk", seniority: null, level: 3, headcount: 3, womenSharePct: 30, meanComp: 41000, diffPct: 2.5, diffSek: 1000 },
  ],
}

function observe(
  gap: ReturnType<typeof makeGapResult>,
  analyses: GroupAnalysis[] = [],
  actions: PayMappingActionWire[] = []
) {
  return overviewObservations({
    gap,
    analyses,
    actions,
    statuses: overviewStatuses(gap, analyses, actions),
  })
}

describe("overviewObservations", () => {
  it("marks a critical open group as action required and a decided action too", () => {
    const gap = makeGapResult({
      equalWork: [
        makeGapGroup({ key: "SWE|3", flag: "critical", womenCount: 3, menCount: 5, metric: { gapPct: 12 } }),
        makeGapGroup({ key: "QA|3", flag: "elevated", womenCount: 2, menCount: 2, metric: { gapPct: 6 } }),
      ],
    })
    const rows = observe(gap, [], [makeAction({ target: { kind: "group", scope: "equalWork", groupKey: "QA|3" } })])
    expect(rows.map((row) => row.kind === "equalWorkGroup" && [row.groupKey, row.status, row.next])).toEqual([
      ["SWE|3", "actionRequired", "completeAssessment"],
      ["QA|3", "actionRequired", "completeAssessment"],
    ])
  })

  it("says assess adjustment once the assessment is done but the group is still open", () => {
    const gap = makeGapResult({
      equalWork: [makeGapGroup({ key: "SWE|3", flag: "elevated" })],
    })
    const done: GroupAnalysis = { scope: "equalWork", groupKey: "SWE|3", comparisonKey: null, reasons: [], note: "checked", done: true, finding: null }
    const rows = observe(gap, [done], [makeAction()])
    expect(rows[0]).toMatchObject({ kind: "equalWorkGroup", status: "actionRequired", next: "assessAdjustment" })
  })

  it("lists a women-dominated group with its largest open comparison", () => {
    const rows = observe(makeGapResult({ womenDominated: [dominated] }))
    expect(rows[0]).toEqual({
      kind: "womenDominatedGroup",
      status: "needsReview",
      groupKey: "Nurse|2",
      roleTitle: "Nurse",
      level: 2,
      headcount: 4,
      diffPct: 3.7,
      comparisonKey: "Support|3",
      scopeSize: 4,
      weight: 14.8,
    })
  })

  it("flags the upper quartile when women's share sits 10 points under their population share", () => {
    const rows = observe(
      makeGapResult({
        // 50 % women overall, 31 % in the upper quartile.
        quartiles: [
          { women: 20, men: 5 },
          { women: 15, men: 10 },
          { women: 10, men: 24 },
          { women: 5, men: 11 },
        ],
      })
    )
    expect(rows[0]).toMatchObject({ kind: "upperQuartile", status: "needsReview", womenSharePct: 50 })
    expect(rows[0]?.kind === "upperQuartile" && Math.round(rows[0].upperQuartileWomenSharePct)).toBe(31)
  })

  it("does not flag the upper quartile at a nine-point shortfall", () => {
    const rows = observe(
      makeGapResult({
        // 50 % women overall, 41 % in the upper quartile: a nine-point shortfall.
        quartiles: [
          { women: 20, men: 10 },
          { women: 20, men: 10 },
          { women: 19, men: 21 },
          { women: 41, men: 59 },
        ],
      })
    )
    expect(rows[0]?.kind).toBe("none")
  })

  it("flags a practice area with a finding and no linked action", () => {
    const rows = observe(makeGapResult(), [praxisRow("payPolicy", "found"), praxisRow("benefits", "found")], [
      makeAction({ target: { kind: "praxis", area: "benefits" } }),
    ])
    expect(rows).toEqual([{ kind: "praxisArea", status: "needsReview", area: "payPolicy", scopeSize: 0, weight: 0 }])
  })

  it("returns the single no-deviation row when nothing qualifies", () => {
    expect(observe(makeGapResult())).toEqual([{ kind: "none" }])
  })

  it("ranks action required first, then by scope size, and cuts at five", () => {
    const groups = [12, 9, 7, 6, 5, 11].map((gapPct, index) =>
      makeGapGroup({ key: `G${index}|3`, flag: "elevated", womenCount: gapPct, menCount: 1, metric: { gapPct } })
    )
    const gap = makeGapResult({ equalWork: groups, womenDominated: [dominated] })
    const rows = observe(gap, [], [makeAction({ target: { kind: "group", scope: "equalWork", groupKey: "G4|3" } })])
    expect(rows).toHaveLength(OBSERVATION_LIMIT)
    expect(rows[0]).toMatchObject({ kind: "equalWorkGroup", groupKey: "G4|3", status: "actionRequired" })
    // Then the largest scopes: G0 (13 people), G5 (12), G1 (10), G2 (8).
    expect(rows.slice(1).map((row) => row.kind === "equalWorkGroup" ? row.groupKey : row.kind)).toEqual(["G0|3", "G5|3", "G1|3", "G2|3"])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/observations.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `observations.ts`**

```ts
import { PRAXIS_AREA_KEYS, type PraxisAreaKey } from "@workspace/constants"
import {
  type GroupAnalysis,
  type PayMappingActionWire,
  type PayMappingGapResult,
  primaryGapMetric,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { isRiskStatus, type OverviewStatuses } from "./statuses"

// At most this many rows; "action required" rows first, then the largest
// scopes. Rules only, never AI.
export const OBSERVATION_LIMIT = 5
// Women's share of the upper quartile at least this many points below
// their share of the priced population is the glass-ceiling signal.
export const UPPER_QUARTILE_SHORTFALL_POINTS = 10

export type ObservationStatus = "actionRequired" | "needsReview"

// Typed rows; the component maps kinds and statuses to i18n. scopeSize is
// the people the row is about (the cross-kind ranking key), weight the
// row's own magnitude (|gap| x headcount for a group), the tie-break.
export type OverviewObservation =
  | {
      kind: "equalWorkGroup"
      status: ObservationStatus
      groupKey: string
      roleTitle: string | null
      level: number | null
      headcount: number
      gapPct: number
      next: "completeAssessment" | "assessAdjustment"
      scopeSize: number
      weight: number
    }
  | {
      kind: "womenDominatedGroup"
      status: "needsReview"
      groupKey: string
      roleTitle: string | null
      level: number
      headcount: number
      diffPct: number
      comparisonKey: string
      scopeSize: number
      weight: number
    }
  | {
      kind: "upperQuartile"
      status: "needsReview"
      womenSharePct: number
      upperQuartileWomenSharePct: number
      scopeSize: number
      weight: number
    }
  | {
      kind: "praxisArea"
      status: "needsReview"
      area: PraxisAreaKey
      scopeSize: number
      weight: number
    }
  | { kind: "none" }

type RankedObservation = Exclude<OverviewObservation, { kind: "none" }>

const STATUS_RANK: Record<ObservationStatus, number> = {
  actionRequired: 0,
  needsReview: 1,
}

function isPraxisArea(value: string): value is PraxisAreaKey {
  return (PRAXIS_AREA_KEYS as readonly string[]).includes(value)
}

function rowKey(row: RankedObservation): string {
  switch (row.kind) {
    case "equalWorkGroup":
    case "womenDominatedGroup":
      return row.groupKey
    case "praxisArea":
      return row.area
    case "upperQuartile":
      return "upperQuartile"
  }
}

export function overviewObservations(input: {
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  statuses: OverviewStatuses
}): OverviewObservation[] {
  const { gap, analyses, actions, statuses } = input
  const rows: RankedObservation[] = []

  for (const group of gap.equalWork) {
    const status = statuses.equalWork.get(group.key)
    if (status === undefined || !isRiskStatus(status)) continue
    const gapPct = primaryGapMetric(group).gapPct ?? 0
    const headcount = group.womenCount + group.menCount
    const assessmentDone = analyses.some(
      (row) =>
        row.scope === "equalWork" &&
        row.groupKey === group.key &&
        row.comparisonKey === null &&
        row.done
    )
    rows.push({
      kind: "equalWorkGroup",
      status:
        group.flag === "critical" || status === "actionDecided"
          ? "actionRequired"
          : "needsReview",
      groupKey: group.key,
      roleTitle: group.roleTitle,
      level: group.level,
      headcount,
      gapPct,
      next: assessmentDone ? "assessAdjustment" : "completeAssessment",
      scopeSize: headcount,
      weight: Math.abs(gapPct) * headcount,
    })
  }

  for (const group of gap.womenDominated) {
    const status = statuses.womenDominated.get(group.key)
    if (status === undefined || !isRiskStatus(status)) continue
    const largest = [...group.comparisons].sort(
      (a, b) => (b.diffPct ?? -1) - (a.diffPct ?? -1)
    )[0]
    if (largest === undefined) continue
    const diffPct = largest.diffPct ?? 0
    rows.push({
      kind: "womenDominatedGroup",
      status: "needsReview",
      groupKey: group.key,
      roleTitle: group.roleTitle,
      level: group.level,
      headcount: group.headcount,
      diffPct,
      comparisonKey: largest.key,
      scopeSize: group.headcount,
      weight: diffPct * group.headcount,
    })
  }

  const upper = gap.quartiles[3]
  if (upper !== undefined) {
    const women = gap.quartiles.reduce((sum, tally) => sum + tally.women, 0)
    const total = gap.quartiles.reduce(
      (sum, tally) => sum + tally.women + tally.men,
      0
    )
    const upperTotal = upper.women + upper.men
    if (total > 0 && upperTotal > 0) {
      const womenSharePct = (women / total) * 100
      const upperQuartileWomenSharePct = (upper.women / upperTotal) * 100
      const shortfall = womenSharePct - upperQuartileWomenSharePct
      if (shortfall >= UPPER_QUARTILE_SHORTFALL_POINTS) {
        rows.push({
          kind: "upperQuartile",
          status: "needsReview",
          womenSharePct,
          upperQuartileWomenSharePct,
          scopeSize: upperTotal,
          weight: shortfall * upperTotal,
        })
      }
    }
  }

  for (const row of analyses) {
    if (row.scope !== "praxis" || row.finding !== "found") continue
    if (!isPraxisArea(row.groupKey)) continue
    const area = row.groupKey
    const linked = actions.some(
      (action) => action.target.kind === "praxis" && action.target.area === area
    )
    if (linked) continue
    rows.push({
      kind: "praxisArea",
      status: "needsReview",
      area,
      scopeSize: 0,
      weight: 0,
    })
  }

  if (rows.length === 0) return [{ kind: "none" }]

  return rows
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (rank !== 0) return rank
      if (a.scopeSize !== b.scopeSize) return b.scopeSize - a.scopeSize
      if (a.weight !== b.weight) return b.weight - a.weight
      return rowKey(a).localeCompare(rowKey(b))
    })
    .slice(0, OBSERVATION_LIMIT)
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/observations.test.ts && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/pay-mapping-overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): rule-derived overview observations`

---

### Task 5: Helper: group table rows with masking

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-overview/group-rows.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/group-rows.test.ts`

**Interfaces:**
- Consumes: `exportMasksGenderMeans` from `@/lib/pay-mapping-masking` (shipped by the two-report plan's Task 8, with `EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER` and `exportMasksWholeGroupMean`); `OverviewStatuses`; `primaryGapMetric`; `GapGroup`, `WomenDominatedGroupWire`.
- Produces: `displayGapPct(wireGapPct: number | null): number | null` (sign flipped: negative when women earn less), `interface OverviewEqualWorkRow { key; roleTitle; level; womenCount; menCount; masked: boolean; womenMedian: number | null; menMedian: number | null; gapPct: number | null; status: AnalysisStatus }`, `overviewEqualWorkRows(gap, statuses): OverviewEqualWorkRow[]`, `interface OverviewEquivalentWorkRow { key; roleTitle; level; headcount; womenSharePct; comparison: { key; roleTitle; level; headcount; diffPct: number | null } | null; otherComparisons: number; status: AnalysisStatus }`, `overviewEquivalentWorkRows(gap, statuses): OverviewEquivalentWorkRow[]`.

- [ ] **Step 0: Precondition: the masking module is where the spec puts it**

Run from the root: `test -f apps/dashboard/lib/pay-mapping-masking.ts && grep -rn "exportMasksGenderMeans\|exportMasksWholeGroupMean\|EXPORT_MIN_GROUP_SIZE\|EXPORT_MIN_PER_GENDER" apps/dashboard --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v "lib/pay-mapping-masking" | grep -v "@/lib/pay-mapping-masking"`.
Expected: the file exists and the grep prints nothing (every importer, `signing-report-data.ts`, `pay-mapping-report-data.ts` and `pay-mapping-metrics-export.ts` included, already resolves `@/lib/pay-mapping-masking`). Only if the file is ABSENT (the two-report plan's Task 8 was not run as written): create `apps/dashboard/lib/pay-mapping-masking.ts` by cutting the block that starts at the comment `// The export-boundary small-cell minimums (ADR-0012, tillägg 2026-07-16)` and ends with `exportMasksWholeGroupMean` out of whichever module the grep found it in, verbatim, add `import { EXPORT_MIN_GROUP_SIZE, EXPORT_MIN_PER_GENDER, exportMasksGenderMeans, exportMasksWholeGroupMean } from "@/lib/pay-mapping-masking"` to that module (dropping names it does not use), repoint every other importer the grep listed, move the threshold `describe` from that module's test into `apps/dashboard/lib/pay-mapping-masking.test.ts`, and re-run the grep until it prints nothing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { makeGapGroup, makeGapResult } from "@/test/pay-mapping-fixtures"
import type { WomenDominatedGroupWire } from "@/components/pay-mapping/pay-mapping-gap-types"
import {
  displayGapPct,
  overviewEqualWorkRows,
  overviewEquivalentWorkRows,
} from "./group-rows"
import type { OverviewStatuses } from "./statuses"

const statuses: OverviewStatuses = {
  equalWork: new Map([["SWE|3", "furtherAnalysis"]]),
  womenDominated: new Map([["Nurse|2", "actionDecided"]]),
}

describe("displayGapPct", () => {
  it("is negative when women earn less and positive in a reverse group", () => {
    expect(displayGapPct(6.2)).toBe(-6.2)
    expect(displayGapPct(-3)).toBe(3)
    expect(displayGapPct(null)).toBeNull()
  })
})

describe("overviewEqualWorkRows", () => {
  it("lists shown and reverse groups, never gender-pure ones, with the signed gap", () => {
    const gap = makeGapResult({
      equalWork: [makeGapGroup({ key: "SWE|3", womenCount: 2, menCount: 3, metric: { gapPct: 6.2 } })],
      excluded: {
        singletonCount: 1,
        genderPure: [{ key: "Pure|1", roleTitle: "Pure", seniority: null, level: 1, gender: "Kvinna", count: 3 }],
        reverse: [makeGapGroup({ key: "UX|2", roleTitle: "UX", level: 2, womenCount: 3, menCount: 2, metric: { gapPct: -2 } })],
      },
    })
    const rows = overviewEqualWorkRows(gap, statuses)
    expect(rows.map((row) => [row.key, row.gapPct, row.status])).toEqual([
      ["SWE|3", -6.2, "furtherAnalysis"],
      ["UX|2", 2, "noActionNeeded"],
    ])
  })

  it("masks the medians, and only the medians, below the export thresholds", () => {
    const gap = makeGapResult({
      equalWork: [
        makeGapGroup({ key: "SWE|3", womenCount: 2, menCount: 2 }),
        makeGapGroup({ key: "QA|3", womenCount: 1, menCount: 3 }),
        makeGapGroup({ key: "Ops|3", womenCount: 1, menCount: 2 }),
      ],
    })
    const rows = overviewEqualWorkRows(gap, statuses)
    expect(rows[0]).toMatchObject({ masked: false, womenMedian: 90000, menMedian: 100000, gapPct: -10 })
    // 4 people but only 1 woman.
    expect(rows[1]).toMatchObject({ masked: true, womenMedian: null, menMedian: null, gapPct: -10 })
    // 3 people.
    expect(rows[2]).toMatchObject({ masked: true, womenMedian: null, menMedian: null })
  })
})

describe("overviewEquivalentWorkRows", () => {
  const dominated: WomenDominatedGroupWire = {
    key: "Nurse|2",
    roleTitle: "Nurse",
    seniority: null,
    level: 2,
    headcount: 5,
    womenSharePct: 80,
    meanComp: 40000,
    comparisons: [
      { key: "Clerk|3", roleTitle: "Clerk", seniority: null, level: 3, headcount: 3, womenSharePct: 30, meanComp: 41000, diffPct: 2.5, diffSek: 1000 },
      { key: "Support|3", roleTitle: "Support", seniority: null, level: 3, headcount: 4, womenSharePct: 25, meanComp: 41480, diffPct: 3.7, diffSek: 1480 },
    ],
  }

  it("carries the largest comparison and counts the others", () => {
    const rows = overviewEquivalentWorkRows(makeGapResult({ womenDominated: [dominated] }), statuses)
    expect(rows).toEqual([
      {
        key: "Nurse|2",
        roleTitle: "Nurse",
        level: 2,
        headcount: 5,
        womenSharePct: 80,
        comparison: { key: "Support|3", roleTitle: "Support", level: 3, headcount: 4, diffPct: 3.7 },
        otherComparisons: 1,
        status: "actionDecided",
      },
    ])
  })

  it("keeps a group with no comparison, with a null comparison", () => {
    const rows = overviewEquivalentWorkRows(
      makeGapResult({ womenDominated: [{ ...dominated, key: "Admin|4", comparisons: [] }] }),
      { equalWork: new Map(), womenDominated: new Map([["Admin|4", "noActionNeeded"]]) }
    )
    expect(rows[0]).toMatchObject({ comparison: null, otherComparisons: 0 })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/group-rows.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `group-rows.ts`**

```ts
import type { AnalysisStatus } from "@/components/pay-mapping/analysis-status"
import {
  type GapGroup,
  type PayMappingGapResult,
  primaryGapMetric,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { exportMasksGenderMeans } from "@/lib/pay-mapping-masking"
import type { OverviewStatuses } from "./statuses"

// The wire's gap is positive when women earn less; the table shows the
// sign the reader expects (negative = women behind, positive in a reverse
// group), so the two never share one number.
export function displayGapPct(wireGapPct: number | null): number | null {
  return wireGapPct === null ? null : -wireGapPct
}

export interface OverviewEqualWorkRow {
  key: string
  roleTitle: string | null
  level: number | null
  womenCount: number
  menCount: number
  // The export thresholds (ADR-0012 addendum) hide the medians here; the
  // counts, the gap percent and the status stay visible.
  masked: boolean
  womenMedian: number | null
  menMedian: number | null
  gapPct: number | null
  status: AnalysisStatus
}

function equalWorkRow(
  group: GapGroup,
  status: AnalysisStatus
): OverviewEqualWorkRow {
  const masked = exportMasksGenderMeans(group)
  return {
    key: group.key,
    roleTitle: group.roleTitle,
    level: group.level,
    womenCount: group.womenCount,
    menCount: group.menCount,
    masked,
    womenMedian: masked ? null : group.tcc.womenMedian,
    menMedian: masked ? null : group.tcc.menMedian,
    gapPct: displayGapPct(primaryGapMetric(group).gapPct),
    status,
  }
}

// Shown groups first, then the reverse groups (women ahead, no
// documentation duty, so no status can be anything but "no action").
// Gender-pure groups have no gap and are not listed.
export function overviewEqualWorkRows(
  gap: PayMappingGapResult,
  statuses: OverviewStatuses
): OverviewEqualWorkRow[] {
  return [
    ...gap.equalWork.map((group) =>
      equalWorkRow(group, statuses.equalWork.get(group.key) ?? "noActionNeeded")
    ),
    ...gap.excluded.reverse.map((group) =>
      equalWorkRow(group, "noActionNeeded")
    ),
  ]
}

export interface OverviewEquivalentWorkRow {
  key: string
  roleTitle: string | null
  level: number
  headcount: number
  womenSharePct: number
  comparison: {
    key: string
    roleTitle: string | null
    level: number
    headcount: number
    diffPct: number | null
  } | null
  otherComparisons: number
  status: AnalysisStatus
}

export function overviewEquivalentWorkRows(
  gap: PayMappingGapResult,
  statuses: OverviewStatuses
): OverviewEquivalentWorkRow[] {
  return gap.womenDominated.map((group) => {
    const largest = [...group.comparisons].sort(
      (a, b) => (b.diffPct ?? -1) - (a.diffPct ?? -1)
    )[0]
    return {
      key: group.key,
      roleTitle: group.roleTitle,
      level: group.level,
      headcount: group.headcount,
      womenSharePct: group.womenSharePct,
      comparison:
        largest === undefined
          ? null
          : {
              key: largest.key,
              roleTitle: largest.roleTitle,
              level: largest.level,
              headcount: largest.headcount,
              diffPct: largest.diffPct,
            },
      otherComparisons: Math.max(0, group.comparisons.length - 1),
      status: statuses.womenDominated.get(group.key) ?? "noActionNeeded",
    }
  })
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/pay-mapping-overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview group rows with export-threshold masking`

---

### Task 6: Helper: action plan and the process step

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-overview/action-plan.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/action-plan.test.ts`

**Interfaces:**
- Consumes: `overviewCost`, `OverviewCost` (Task 3); `PayMappingActionWire`, `PayMappingRunStatus`.
- Produces: `PROCESS_STEPS = ["mappingDone", "analysisDone", "planDecided", "implementing", "followUp"] as const`, `type ProcessStepKey`, `type ProcessStepState = "done" | "current" | "upcoming"`, `interface OverviewActionPlan { counts: { notStarted; inProgress; done; total }; cost: OverviewCost; process: { key: ProcessStepKey; state: ProcessStepState }[] }`, `overviewActionPlan(input: { actions; run: { status: PayMappingRunStatus; referenceDate: number }; runs: readonly { referenceDate: number }[]; remainingOpen: number }): OverviewActionPlan`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import type { PayMappingActionWire } from "@/components/pay-mapping/pay-mapping-gap-types"
import { makeAction } from "@/test/pay-mapping-fixtures"
import { overviewActionPlan } from "./action-plan"

// One costed action per status, ids distinct so a list can hold all three.
const action = (status: PayMappingActionWire["status"]) =>
  makeAction({
    actionId: `a-${status}` as PayMappingActionWire["actionId"],
    status,
    estimatedCost: 1000,
    estimatedCostUnit: "perMonth",
  })

const REF = Date.UTC(2026, 6, 1)

describe("overviewActionPlan", () => {
  it("counts actions per status and annualises the cost", () => {
    const plan = overviewActionPlan({
      actions: [action("notStarted"), action("inProgress"), action("done")],
      run: { status: "active", referenceDate: REF },
      runs: [],
      remainingOpen: 2,
    })
    expect(plan.counts).toEqual({ notStarted: 1, inProgress: 1, done: 1, total: 3 })
    expect(plan.cost.annual).toBe(36000)
  })

  it("marks mapping done and analysis current while duties remain open", () => {
    const plan = overviewActionPlan({ actions: [], run: { status: "active", referenceDate: REF }, runs: [], remainingOpen: 1 })
    expect(plan.process).toEqual([
      { key: "mappingDone", state: "done" },
      { key: "analysisDone", state: "current" },
      { key: "planDecided", state: "upcoming" },
      { key: "implementing", state: "upcoming" },
      { key: "followUp", state: "upcoming" },
    ])
  })

  it("marks the plan decided on a completed run and implementing once an action moves", () => {
    const plan = overviewActionPlan({
      actions: [action("inProgress")],
      run: { status: "completed", referenceDate: REF },
      runs: [],
      remainingOpen: 0,
    })
    expect(plan.process.map((step) => step.state)).toEqual(["done", "done", "done", "done", "current"])
  })

  it("marks follow-up done once a later mapping exists, and keeps a done step done past a current one", () => {
    const plan = overviewActionPlan({
      actions: [action("done")],
      run: { status: "active", referenceDate: REF },
      runs: [{ referenceDate: Date.UTC(2027, 6, 1) }, { referenceDate: Date.UTC(2025, 6, 1) }],
      remainingOpen: 0,
    })
    expect(plan.process.map((step) => step.state)).toEqual(["done", "done", "current", "done", "done"])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/action-plan.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `action-plan.ts`**

```ts
import type {
  PayMappingActionWire,
  PayMappingRunStatus,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { type OverviewCost, overviewCost } from "./kpis"

// The five-step process the action plan reports against. Each step has
// its own condition; a step is "done" when its condition holds, "current"
// when it is the first that does not, "upcoming" otherwise, so a step
// whose condition already holds stays done even past a current one.
export const PROCESS_STEPS = [
  "mappingDone",
  "analysisDone",
  "planDecided",
  "implementing",
  "followUp",
] as const
export type ProcessStepKey = (typeof PROCESS_STEPS)[number]
export type ProcessStepState = "done" | "current" | "upcoming"

export interface OverviewActionPlan {
  counts: { notStarted: number; inProgress: number; done: number; total: number }
  cost: OverviewCost
  process: { key: ProcessStepKey; state: ProcessStepState }[]
}

export function overviewActionPlan(input: {
  actions: PayMappingActionWire[]
  run: { status: PayMappingRunStatus; referenceDate: number }
  runs: readonly { referenceDate: number }[]
  // Documentation duties not yet marked done (overviewKpis' remaining.open).
  remainingOpen: number
}): OverviewActionPlan {
  const { actions, run, runs, remainingOpen } = input
  const count = (status: PayMappingActionWire["status"]) =>
    actions.filter((action) => action.status === status).length
  const counts = {
    notStarted: count("notStarted"),
    inProgress: count("inProgress"),
    done: count("done"),
    total: actions.length,
  }
  const conditions: Record<ProcessStepKey, boolean> = {
    mappingDone: true,
    analysisDone: remainingOpen === 0,
    planDecided: run.status === "completed",
    implementing: counts.inProgress + counts.done > 0,
    followUp: runs.some((other) => other.referenceDate > run.referenceDate),
  }
  const firstOpen = PROCESS_STEPS.find((key) => !conditions[key])
  return {
    counts,
    cost: overviewCost(actions),
    process: PROCESS_STEPS.map((key) => ({
      key,
      state: conditions[key]
        ? "done"
        : key === firstOpen
          ? "current"
          : "upcoming",
    })),
  }
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/pay-mapping-overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview action-plan counts, cost split and process step`

---

### Task 7: Helper: comparison deltas, comparability and reference columns

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-overview/comparison.ts`
- Test: `apps/dashboard/lib/pay-mapping-overview/comparison.test.ts`

**Interfaces:**
- Consumes: `OverviewKpis` (Task 3).
- Produces: `COMPARABILITY_POPULATION_THRESHOLD = 0.1`, `interface OverviewDeltas { people: number; gapPoints: number | null; remainingGroups: number; riskGroups: number; affected: number; actionsDone: number }`, `overviewDeltas(current: OverviewKpis, reference: OverviewKpis): OverviewDeltas`, `interface ComparabilityInput { populationCount: number; criteria: readonly { libraryKey: string | null; name: string; weightPoints: number }[] }` (the model signature is the library key, or the name when a pre-cutover criterion has none, plus the weight points), `interface Comparability { populationDiffers: boolean; modelDiffers: boolean }`, `overviewComparability(current, reference): Comparability`, `interface ReferenceColumns { referenceValue: number | null; changePoints: number | null; isNew: boolean }`, `referenceColumns(key, current: number | null, reference: ReadonlyMap<string, number | null>): ReferenceColumns`, `rowValueMap<T extends { key: string }>(rows, value: (row: T) => number | null): ReadonlyMap<string, number | null>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  overviewComparability,
  overviewDeltas,
  referenceColumns,
  rowValueMap,
} from "./comparison"
import type { OverviewKpis } from "./kpis"

function kpis(overrides: Partial<OverviewKpis> = {}): OverviewKpis {
  return {
    scope: { included: 118, women: 60, men: 58, withPay: 112 },
    totalGap: { meanPct: 3.4, medianPct: 3.0 },
    remaining: { open: 3, total: 18 },
    risk: { groups: 3, total: 18, affected: 14 },
    actions: { done: 4, inProgress: 2, total: 9 },
    cost: { annual: 0, oneOff: 0, firstYear: 0, costed: 0, uncosted: 9 },
    ...overrides,
  }
}

describe("overviewDeltas", () => {
  it("subtracts the reference from the current figures", () => {
    const deltas = overviewDeltas(
      kpis(),
      kpis({
        scope: { included: 125, women: 62, men: 63, withPay: 120 },
        totalGap: { meanPct: 4.1, medianPct: 3.5 },
        remaining: { open: 5, total: 17 },
        risk: { groups: 5, total: 17, affected: 21 },
        actions: { done: 2, inProgress: 3, total: 8 },
      })
    )
    expect(deltas.people).toBe(-7)
    expect(deltas.gapPoints).toBeCloseTo(-0.7, 10)
    expect(deltas.remainingGroups).toBe(-2)
    expect(deltas.riskGroups).toBe(-2)
    expect(deltas.affected).toBe(-7)
    expect(deltas.actionsDone).toBe(2)
  })

  it("has no gap delta when either side is not measurable", () => {
    expect(overviewDeltas(kpis({ totalGap: { meanPct: null, medianPct: null } }), kpis()).gapPoints).toBeNull()
  })
})

describe("overviewComparability", () => {
  const model = [
    { libraryKey: "knowledge-depth", name: "Knowledge", weightPoints: 4 },
    { libraryKey: "scope-impact", name: "Responsibility", weightPoints: 2 },
  ]

  it("is comparable under a ten percent population change with the same model", () => {
    expect(overviewComparability({ populationCount: 105, criteria: model }, { populationCount: 96, criteria: model })).toEqual({ populationDiffers: false, modelDiffers: false })
  })

  it("flags the population at exactly ten percent", () => {
    expect(overviewComparability({ populationCount: 110, criteria: model }, { populationCount: 100, criteria: model }).populationDiffers).toBe(true)
  })

  it("flags a model that differs by a weight or by a criterion key", () => {
    const [knowledge, responsibility] = model
    if (knowledge === undefined || responsibility === undefined) throw new Error("fixture")
    expect(overviewComparability({ populationCount: 100, criteria: [{ ...knowledge, weightPoints: 5 }, responsibility] }, { populationCount: 100, criteria: model }).modelDiffers).toBe(true)
    expect(overviewComparability({ populationCount: 100, criteria: [{ ...knowledge, libraryKey: "knowledge-breadth" }, responsibility] }, { populationCount: 100, criteria: model }).modelDiffers).toBe(true)
    expect(overviewComparability({ populationCount: 100, criteria: model.slice(0, 1) }, { populationCount: 100, criteria: model }).modelDiffers).toBe(true)
  })

  it("treats a renamed criterion with the same key as the same criterion, and a keyless one by its name", () => {
    const [knowledge, responsibility] = model
    if (knowledge === undefined || responsibility === undefined) throw new Error("fixture")
    expect(overviewComparability({ populationCount: 100, criteria: [{ ...knowledge, name: "Kunskap" }, responsibility] }, { populationCount: 100, criteria: model }).modelDiffers).toBe(false)
    const keyless = [{ libraryKey: null, name: "Knowledge", weightPoints: 4 }]
    expect(overviewComparability({ populationCount: 100, criteria: keyless }, { populationCount: 100, criteria: keyless }).modelDiffers).toBe(false)
    expect(overviewComparability({ populationCount: 100, criteria: [{ libraryKey: null, name: "Skill", weightPoints: 4 }] }, { populationCount: 100, criteria: keyless }).modelDiffers).toBe(true)
  })

  it("ignores criterion order", () => {
    expect(overviewComparability({ populationCount: 100, criteria: [...model].reverse() }, { populationCount: 100, criteria: model }).modelDiffers).toBe(false)
  })
})

describe("referenceColumns", () => {
  const reference = rowValueMap([{ key: "SWE|3", gapPct: -8 }, { key: "QA|3", gapPct: null }], (row) => row.gapPct)

  it("computes the change in points against the reference row", () => {
    // Integers: -6.2 minus -8 is not exactly 1.8 in floating point.
    expect(referenceColumns("SWE|3", -6, reference)).toEqual({ referenceValue: -8, changePoints: 2, isNew: false })
  })

  it("marks a group absent from the reference as new", () => {
    expect(referenceColumns("Ops|4", -3, reference)).toEqual({ referenceValue: null, changePoints: null, isNew: true })
  })

  it("has no change when the reference value is masked or missing", () => {
    expect(referenceColumns("QA|3", -3, reference)).toEqual({ referenceValue: null, changePoints: null, isNew: false })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview/comparison.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `comparison.ts`**

```ts
import type { OverviewKpis } from "./kpis"

// A population that moved by this share or more between two mappings
// limits how far their figures can be read against each other.
export const COMPARABILITY_POPULATION_THRESHOLD = 0.1

// Signed "current minus reference" per card. Points, never percent of a
// percent: a gap that went from 4.1 to 3.4 moved 0.7 points.
export interface OverviewDeltas {
  people: number
  gapPoints: number | null
  remainingGroups: number
  riskGroups: number
  affected: number
  actionsDone: number
}

export function overviewDeltas(
  current: OverviewKpis,
  reference: OverviewKpis
): OverviewDeltas {
  return {
    people: current.scope.included - reference.scope.included,
    gapPoints:
      current.totalGap.meanPct === null || reference.totalGap.meanPct === null
        ? null
        : current.totalGap.meanPct - reference.totalGap.meanPct,
    remainingGroups: current.remaining.open - reference.remaining.open,
    riskGroups: current.risk.groups - reference.risk.groups,
    affected: current.risk.affected - reference.risk.affected,
    actionsDone: current.actions.done - reference.actions.done,
  }
}

export interface ComparabilityInput {
  populationCount: number
  criteria: readonly {
    libraryKey: string | null
    name: string
    weightPoints: number
  }[]
}

export interface Comparability {
  populationDiffers: boolean
  modelDiffers: boolean
}

// A criterion is identified by its library key (a rename keeps it the same
// criterion); evidence frozen before the library existed carries no key and
// falls back to its name. Order never counts.
function modelSignature(
  criteria: ComparabilityInput["criteria"]
): string {
  return [...criteria]
    .map(
      (criterion) =>
        `${criterion.libraryKey ?? criterion.name}=${criterion.weightPoints}`
    )
    .sort()
    .join("|")
}

export function overviewComparability(
  current: ComparabilityInput,
  reference: ComparabilityInput
): Comparability {
  const populationDiffers =
    reference.populationCount > 0 &&
    Math.abs(current.populationCount - reference.populationCount) /
      reference.populationCount >=
      COMPARABILITY_POPULATION_THRESHOLD
  return {
    populationDiffers,
    modelDiffers:
      modelSignature(current.criteria) !== modelSignature(reference.criteria),
  }
}

// The two extra table columns under a reference: the reference row's own
// value and the change in points, matched on the group key. A group the
// reference did not have reads "New"; a reference value that is masked
// or unmeasurable yields no change.
export interface ReferenceColumns {
  referenceValue: number | null
  changePoints: number | null
  isNew: boolean
}

export function rowValueMap<T extends { key: string }>(
  rows: readonly T[],
  value: (row: T) => number | null
): ReadonlyMap<string, number | null> {
  return new Map(rows.map((row) => [row.key, value(row)]))
}

export function referenceColumns(
  key: string,
  current: number | null,
  reference: ReadonlyMap<string, number | null>
): ReferenceColumns {
  if (!reference.has(key)) {
    return { referenceValue: null, changePoints: null, isNew: true }
  }
  const referenceValue = reference.get(key) ?? null
  return {
    referenceValue,
    changePoints:
      current === null || referenceValue === null
        ? null
        : current - referenceValue,
    isNew: false,
  }
}
```

Run: `cd apps/dashboard && bunx vitest run lib/pay-mapping-overview && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/pay-mapping-overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview comparison deltas, comparability and reference columns`

---

### Task 8: The reference in the URL, the run context and the shell's subscriptions

**Files:**
- Create: `apps/dashboard/hooks/use-compare-param.ts`
- Test: `apps/dashboard/hooks/use-compare-param.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-run-context.tsx`
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-run-context.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.test.tsx`
- Modify: `apps/dashboard/test/pay-mapping-fixtures.ts`, `apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx`, `apps/dashboard/components/pay-mapping/pay-mapping-population-card.test.tsx` (type annotations and the navigation mock only)

**Interfaces:**
- Consumes: `useSearchParams`, `usePathname`, `useRouter` (`next/navigation`; the `[slug]` route is dynamic, so no Suspense boundary is needed); `listPayMappingRuns` entries (Task 2's `frozenCriteria`).
- Produces: `COMPARE_PARAM = "compare"`, `useCompareParam(): { compare: string | null; setCompare: (slug: string | null) => void }`; `PayMappingRunData.slug: string` (provided by the shell, read by Tasks 12 and 14); `interface PayMappingRunListEntry extends PayMappingRunSummary { runId: Id<"payMappingRuns">; slug: string; withPayCount: number; frozenCriteria: { libraryKey: string | null; name: string; weightPoints: number }[] }`; `interface PayMappingReference { run: PayMappingRunListEntry; gap: PayMappingGapResult | undefined; analyses: GroupAnalysis[] | undefined; actions: PayMappingActionWire[] | undefined }`; `PayMappingRunData.runsList: PayMappingRunListEntry[] | undefined` and `PayMappingRunData.reference?: PayMappingReference | null`; context value `reference: PayMappingReference | null`; `referenceCandidates(run, runs)`, `resolveReferenceRun(run, runs, slug)`.

- [ ] **Step 1: Write the failing hook test**

`apps/dashboard/hooks/use-compare-param.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const navigation = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ replace: navigation.replace }),
}))

import { useCompareParam } from "./use-compare-param"

describe("useCompareParam", () => {
  it("reads the compare slug from the URL", () => {
    navigation.search = "compare=pay-2025"
    const { result } = renderHook(() => useCompareParam())
    expect(result.current.compare).toBe("pay-2025")
  })

  it("writes the slug with replace and keeps other params", () => {
    navigation.search = "step=equalWork:SWE"
    const { result } = renderHook(() => useCompareParam())
    act(() => result.current.setCompare("pay-2025"))
    expect(navigation.replace).toHaveBeenCalledWith(
      "/pay-mappings/pay-2026?step=equalWork%3ASWE&compare=pay-2025",
      { scroll: false }
    )
  })

  it("removes the param on null", () => {
    navigation.search = "compare=pay-2025"
    const { result } = renderHook(() => useCompareParam())
    act(() => result.current.setCompare(null))
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/pay-mappings/pay-2026",
      { scroll: false }
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run hooks/use-compare-param.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

`apps/dashboard/hooks/use-compare-param.ts`:

```ts
"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

// The overview's reference selection lives in the URL, so a link or a
// screenshot always states what is being compared.
//
// useSearchParams, not a one-time window.location read like the analysis
// page's ?step= deep link: that value is consumed once at mount, while this
// one changes while the page is open (the selector writes it, the back
// button restores it) and every block must re-render with it. The [slug]
// route is dynamic, so no Suspense boundary is required around the caller.
export const COMPARE_PARAM = "compare"

export function useCompareParam(): {
  compare: string | null
  setCompare: (slug: string | null) => void
} {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const compare = params.get(COMPARE_PARAM)
  const setCompare = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (slug === null) next.delete(COMPARE_PARAM)
      else next.set(COMPARE_PARAM, slug)
      const query = next.toString()
      // replace, not push: changing the comparison is a view setting, and
      // the back button should leave the run, not step through selections.
      router.replace(query === "" ? pathname : `${pathname}?${query}`, {
        scroll: false,
      })
    },
    [params, pathname, router]
  )
  return { compare, setCompare }
}
```

Run: `cd apps/dashboard && bunx vitest run hooks/use-compare-param.test.tsx`
Expected: PASS.

- [ ] **Step 4: Write the failing context test**

`apps/dashboard/components/pay-mapping/pay-mapping-run-context.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { makeRunSummary } from "@/test/pay-mapping-fixtures"
import { referenceCandidates, resolveReferenceRun } from "./pay-mapping-run-context"

const current = { referenceDate: Date.UTC(2026, 6, 1) }
const runs = [
  makeRunSummary({ slug: "pay-2027", referenceDate: Date.UTC(2027, 6, 1) }),
  makeRunSummary({ slug: "pay-2025", referenceDate: Date.UTC(2025, 6, 1) }),
  makeRunSummary({ slug: "pay-2024-draft", referenceDate: Date.UTC(2024, 6, 1), status: "active" }),
  makeRunSummary({ slug: "pay-2024", referenceDate: Date.UTC(2024, 0, 1) }),
]

describe("referenceCandidates", () => {
  it("lists earlier completed runs only, newest first", () => {
    expect(referenceCandidates(current, runs).map((run) => run.slug)).toEqual(["pay-2025", "pay-2024"])
  })
})

describe("resolveReferenceRun", () => {
  it("resolves a candidate slug and nothing else", () => {
    expect(resolveReferenceRun(current, runs, "pay-2025")?.slug).toBe("pay-2025")
    expect(resolveReferenceRun(current, runs, "pay-2027")).toBeNull()
    expect(resolveReferenceRun(current, runs, "pay-2024-draft")).toBeNull()
    expect(resolveReferenceRun(current, runs, "unknown")).toBeNull()
    expect(resolveReferenceRun(current, runs, null)).toBeNull()
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-run-context.test.ts`
Expected: FAIL (`referenceCandidates` is not exported; `makeRunSummary` has no `slug`).

- [ ] **Step 6: Context types and the two resolvers**

In `pay-mapping-run-context.tsx`, add `import type { Id } from "@workspace/backend/convex/_generated/dataModel"`. After `PayMappingRunSummary`:

```ts
// The run-list entry as the shell holds it: the summary plus what the
// reference selector and the comparability check read (identity, coverage
// and the frozen method's criteria). Consumers that only trend figures
// keep taking PayMappingRunSummary.
export interface PayMappingRunListEntry extends PayMappingRunSummary {
  runId: Id<"payMappingRuns">
  slug: string
  withPayCount: number
  frozenCriteria: { libraryKey: string | null; name: string; weightPoints: number }[]
}

// The earlier completed mapping the overview compares against, with its
// own three subscriptions (issued by the shell only while a reference is
// selected). Undefined members are still loading.
export interface PayMappingReference {
  run: PayMappingRunListEntry
  gap: PayMappingGapResult | undefined
  analyses: GroupAnalysis[] | undefined
  actions: PayMappingActionWire[] | undefined
}

// Earlier COMPLETED runs only, newest first: a mapping still being
// documented is not a reference anyone signs against.
export function referenceCandidates(
  run: { referenceDate: number },
  runs: readonly PayMappingRunListEntry[]
): PayMappingRunListEntry[] {
  return runs
    .filter(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.referenceDate < run.referenceDate
    )
    .sort((a, b) => b.referenceDate - a.referenceDate)
}

// The run a ?compare= slug names, or null when it names nothing that
// qualifies (an unknown slug, a later run, an unfinished one).
export function resolveReferenceRun(
  run: { referenceDate: number },
  runs: readonly PayMappingRunListEntry[],
  slug: string | null
): PayMappingRunListEntry | null {
  if (slug === null) return null
  return (
    referenceCandidates(run, runs).find((candidate) => candidate.slug === slug) ??
    null
  )
}
```

In `PayMappingRunData`, change `runsList: PayMappingRunSummary[] | undefined` to `runsList: PayMappingRunListEntry[] | undefined`, add `slug: string` as its first member (the route's slug: every block that links back into the run reads it here instead of re-parsing the pathname), and add:

```ts
  // Optional so every provider call site that has no comparison (every
  // test, every non-overview surface) stays as it is; the context value
  // normalizes it to null.
  reference?: PayMappingReference | null
```

In `PayMappingRunContextValue`, add `reference: PayMappingReference | null` and in the provider's `resolved` memo build `{ ...value, reference: value.reference ?? null, queue, locked: run?.status === "completed" }`.

In `apps/dashboard/test/pay-mapping-fixtures.ts`, import `PayMappingRunListEntry` instead of `PayMappingRunSummary` and make `makeRunSummary` return the entry with defaults `runId: "run-2025" as PayMappingRunListEntry["runId"], slug: "pay-mapping-2025", withPayCount: 6, frozenCriteria: [],` (added before `...overrides`; `overrides: Partial<PayMappingRunListEntry>`).

In `pay-mapping-overview.test.tsx` and `pay-mapping-population-card.test.tsx`, change the `runsList?: PayMappingRunSummary[]` option types (and the matching import) to `PayMappingRunListEntry[]`. Run `bunx tsc --noEmit` and do the same in any other test that types a provider `runsList` as `PayMappingRunSummary[]` (candidate: `pay-mapping-report-download.test.tsx`, which the two-report plan rewrote).

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-run-context.test.ts && bunx tsc --noEmit`. The typecheck now reports every provider `value` literal without a `slug` (the pay-mapping component tests that render `PayMappingRunProvider`); add `slug: "pay-2026",` to each and re-run until clean.
Expected: PASS, clean typecheck.

- [ ] **Step 7: Write the failing shell test**

In `pay-mapping-run-shell.test.tsx`, extend the navigation mock and the query dispatcher:

```tsx
const pathState = vi.hoisted(() => ({
  current: "/pay-mappings/pay-2026",
  search: "",
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
  useSearchParams: () => new URLSearchParams(pathState.search),
  useRouter: () => ({ replace: vi.fn() }),
}))
```

Add to the `state` object `runsList: unknown[] | undefined` (default `[]`) and to `onQuery`:

```ts
const queryArgs: { ref: string; args: unknown }[] = []
onQuery((ref, args) => {
  queryArgs.push({ ref, args })
  if (ref === "payMapping.runs.getPayMappingRunBySlug") return state.run
  if (ref === "payMapping.analyses.listGroupAnalyses") return state.analyses
  if (ref === "payMapping.runs.listPayMappingRuns") return state.runsList
  return undefined
})
```

Reset `pathState.search = ""`, `state.runsList = []` and `queryArgs.length = 0` in `afterEach`. Add the tests:

```tsx
  it("subscribes to the reference run's gap, analyses and actions when ?compare names an earlier completed run", () => {
    pathState.search = "compare=pay-2025"
    state.runsList = [
      makeRunSummary({ runId: "run-2025" as PayMappingRunDetail["runId"], slug: "pay-2025", referenceDate: Date.UTC(2025, 6, 1) }),
    ]
    renderShell()
    const forReference = queryArgs.filter(
      (call) =>
        typeof call.args === "object" &&
        call.args !== null &&
        (call.args as { runId?: string }).runId === "run-2025"
    )
    expect(new Set(forReference.map((call) => call.ref))).toEqual(
      new Set([
        "payMapping.gap.getPayMappingGap",
        "payMapping.analyses.listGroupAnalyses",
        "payMapping.actions.listActions",
      ])
    )
  })

  it("skips the reference subscriptions when the slug names no earlier completed run", () => {
    pathState.search = "compare=pay-2025"
    state.runsList = [
      makeRunSummary({ runId: "run-2025" as PayMappingRunDetail["runId"], slug: "pay-2025", status: "active", referenceDate: Date.UTC(2025, 6, 1) }),
    ]
    renderShell()
    const forReference = queryArgs.filter(
      (call) =>
        typeof call.args === "object" &&
        call.args !== null &&
        (call.args as { runId?: string }).runId === "run-2025"
    )
    expect(forReference).toHaveLength(0)
    expect(
      queryArgs.filter((call) => call.args === "skip").map((call) => call.ref)
    ).toEqual(expect.arrayContaining(["payMapping.gap.getPayMappingGap"]))
  })
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-run-shell.test.tsx`
Expected: FAIL (no reference subscriptions are issued).

- [ ] **Step 9: The shell's reference subscriptions**

In `pay-mapping-run-shell.tsx`, add `import { useCompareParam } from "@/hooks/use-compare-param"` and extend the context import to `import { type PayMappingReference, PayMappingRunProvider, resolveReferenceRun } from "./pay-mapping-run-context"`. After the `runsList` query:

```ts
  // The comparison layer: the earlier completed run named in the URL gets
  // its own gap, analyses and actions subscriptions, keyed by its id and
  // skipped entirely while nothing is selected, so the pure current-state
  // page costs no extra query.
  const { compare } = useCompareParam()
  const referenceRun =
    run === undefined || run === null || runsList === undefined
      ? null
      : resolveReferenceRun(run, runsList, compare)
  const referenceArgs =
    referenceRun === null
      ? ("skip" as const)
      : { orgId, runId: referenceRun.runId }
  const referenceGap = useQuery(api.payMapping.gap.getPayMappingGap, referenceArgs)
  const referenceAnalyses = useQuery(
    api.payMapping.analyses.listGroupAnalyses,
    referenceArgs
  )
  const referenceActions = useQuery(
    api.payMapping.actions.listActions,
    referenceArgs
  )
  const reference: PayMappingReference | null =
    referenceRun === null
      ? null
      : {
          run: referenceRun,
          gap: referenceGap === null ? undefined : referenceGap,
          analyses: referenceAnalyses,
          actions: referenceActions,
        }
```

Pass it: `value={{ slug, run, gap, analyses, actions, notes, runsList, reference }}`.

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/hooks apps/dashboard/components/pay-mapping apps/dashboard/test` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 10: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): reference run in the URL with its own subscriptions in the run shell`

---

### Task 9: i18n for the new surface in five locales

**Files:**
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Produces the keys every component task below reads: `dashboard.payMapping.overview.{context,kpi,delta,observations,outcome,groupTable,actionPlan,comparability}.*`, `dashboard.help.{riskGroup,affectedPeople,remainingToAnalyse,compareWith,comparability,process,overviewMasking,followUpDate,estimatedCost,observations}{Label,Body}`, `dashboard.toast.payMappingFollowUpDateSaved`. Adds only; the old `overview.*`, `clock.*` and `review.finding.org*` keys are deleted in Task 19.

- [ ] **Step 1: English**

Inside `dashboard.payMapping.overview` in `en.json` (keep `headlineGapLabel`, `insufficient`, `quartileTitle`, `quartiles` and the other existing keys untouched), add:

```json
"context": {
  "extracted": "Data extracted {date}",
  "coverage": "{withPay} of {total} with pay",
  "baseYear": "Base year",
  "compareLabel": "Compare with",
  "noComparison": "No comparison",
  "referenceOption": "{label} · {month} · Completed"
},
"kpi": {
  "scope": "Scope",
  "scopeNote": "{women} women · {men} men",
  "totalGap": "Total pay gap",
  "totalGapNote": "Median {median}",
  "totalGapNoMedian": "Median not measurable",
  "notMeasurable": "Not measurable",
  "remaining": "Remaining to analyse",
  "remainingValue": "<open></open> of <total></total> groups",
  "remainingNote": "Not done, of the groups requiring documentation",
  "riskGroups": "Risk groups",
  "riskValue": "<count></count> of <total></total>",
  "riskNote": "{count, plural, one {# person affected} other {# people affected}}",
  "actions": "Actions",
  "actionsValue": "<done></done> of <total></total> done",
  "actionsNote": "{count} in progress",
  "cost": "Estimated cost",
  "costNote": "{oneOff} one-off",
  "costUncostedNote": "{count, plural, one {# action without a cost} other {# actions without a cost}}",
  "costNone": "Cost not estimated",
  "costNoneNote": "No action carries a cost"
},
"delta": {
  "gapLower": "{points} points lower than {label}",
  "gapHigher": "{points} points higher than {label}",
  "fewerGroups": "{count, plural, one {# fewer group} other {# fewer groups}} than {label}",
  "moreGroups": "{count, plural, one {# more group} other {# more groups}} than {label}",
  "fewerPeople": "{count, plural, one {# fewer person} other {# fewer people}} than {label}",
  "morePeople": "{count, plural, one {# more person} other {# more people}} than {label}",
  "fewerDone": "{count, plural, one {# fewer action done} other {# fewer actions done}} than {label}",
  "moreDone": "{count, plural, one {# more action done} other {# more actions done}} than {label}",
  "unchanged": "Unchanged vs {label}"
},
"observations": {
  "title": "Observations",
  "actionRequired": "Action required",
  "needsReview": "Needs review",
  "none": "No deviation identified",
  "scopeGroup": "{count, plural, one {# person} other {# people}} · {gap}",
  "scopeQuartile": "{share} women in the upper quartile",
  "scopeNone": "Within the defined range",
  "nextCompleteAssessment": "Complete the objective-reason assessment and prepare any adjustment",
  "nextAssessAdjustment": "Assess the need for a pay adjustment",
  "nextComparison": "Assess against the higher-paid comparison group",
  "nextQuartile": "Review pay criteria, promotion and career paths",
  "nextPraxis": "Decide an action for the area",
  "nextNone": "Follow up in the next mapping",
  "open": "Open {label}"
},
"outcome": {
  "title": "Pay outcome",
  "mean": "Mean gap",
  "median": "Median gap",
  "analysed": "Groups analysed",
  "ofTotal": "{done} of {total}",
  "remaining": "Remaining",
  "riskGroups": "Risk groups",
  "affected": "People affected"
},
"groupTable": {
  "title": "Groups",
  "viewLabel": "Comparison type",
  "equalWork": "Equal work",
  "equivalentWork": "Equivalent work",
  "statusFilterLabel": "Status",
  "statusAll": "All statuses",
  "resultCount": "{shown} of {total} groups",
  "noMatches": "No groups match the filter.",
  "clearFilters": "Clear filter",
  "empty": "No groups to show.",
  "columns": {
    "group": "Group",
    "women": "Women",
    "men": "Men",
    "medianWomen": "Median women",
    "medianMen": "Median men",
    "gap": "Pay gap",
    "status": "Status",
    "headcount": "People",
    "comparison": "Comparison group",
    "diff": "Difference",
    "reference": "Reference",
    "change": "Change"
  },
  "masked": "Masked",
  "new": "New",
  "otherComparisons": "+{count} more",
  "womenShare": "{share} women",
  "openRow": "Open {label} in the analysis"
},
"actionPlan": {
  "title": "Action plan",
  "annual": "Annual recurring",
  "oneOff": "One-off",
  "firstYear": "Total first year",
  "uncosted": "Cost not estimated: {count, plural, one {# action} other {# actions}}",
  "followUp": "Next decision point",
  "process": "Process",
  "steps": {
    "mappingDone": "Mapping done",
    "analysisDone": "Analysis done",
    "planDecided": "Plan decided",
    "implementing": "Implementing",
    "followUp": "Follow-up"
  },
  "state": {
    "done": "Done",
    "current": "Current",
    "upcoming": "Upcoming"
  }
},
"comparability": {
  "title": "Limited comparability",
  "population": "This mapping covers {current} people compared with {reference} in {label}. Read the changes together with the changed population.",
  "model": "The evaluation model differs from the one used in {label}. Read the changes together with the changed method."
}
```

In `dashboard.help`, after `payQuartilesBody`:

```json
"riskGroupLabel": "What is a risk group?",
"riskGroupBody": "A group whose difference is still under analysis or has an action decided, counted out of every group with a comparison. A documented objective reason closes it.",
"affectedPeopleLabel": "Who counts as affected?",
"affectedPeopleBody": "The lower-paid gender's headcount in each risk group; for a women-dominated group, everyone in it. It counts people, not amounts.",
"remainingToAnalyseLabel": "What remains to analyse?",
"remainingToAnalyseBody": "Groups that require documentation and are not marked done: an equal-work group with a gap, or a women-dominated group with a higher-paid comparison.",
"compareWithLabel": "What does comparing do?",
"compareWithBody": "Adds each figure's change against an earlier completed mapping, matched group by group. It never changes this mapping's own figures.",
"comparabilityLabel": "What limits comparability?",
"comparabilityBody": "A population that differs by 10 % or more, or a different evaluation model. The changes still show; read them together with what changed.",
"processLabel": "What are the process steps?",
"processBody": "Mapping, analysis, decided plan, implementation and follow-up in the next mapping. A step is done when its condition holds, whatever the steps around it show.",
"overviewMaskingLabel": "Why are some medians masked?",
"overviewMaskingBody": "A group with fewer than 4 people or fewer than 2 of a gender hides its medians here and in the documents. The analysis pages show every figure.",
"followUpDateLabel": "What is the next decision point?",
"followUpDateBody": "The date the action plan is next reviewed. Any member can set it, also after the mapping is completed, and every change is logged.",
"estimatedCostLabel": "How is the cost estimated?",
"estimatedCostBody": "Annual recurring cost is every per-year cost plus twelve times every per-month cost; one-off costs are listed beside it. Actions without a cost are counted, not summed.",
"observationsLabel": "How are observations chosen?",
"observationsBody": "Derived by fixed rules from the groups, comparisons, quartiles and practice areas, never by AI. Action required ranks first, then the largest scope."
```

In `dashboard.toast`, after `payMappingNoteDeleted`: `"payMappingFollowUpDateSaved": "Next decision point saved"`.

- [ ] **Step 2: Swedish**

Same positions in `sv.json`:

```json
"context": {
  "extracted": "Data uttagna {date}",
  "coverage": "{withPay} av {total} med lön",
  "baseYear": "Basår",
  "compareLabel": "Jämför med",
  "noComparison": "Ingen jämförelse",
  "referenceOption": "{label} · {month} · Avslutad"
},
"kpi": {
  "scope": "Omfattning",
  "scopeNote": "{women} kvinnor · {men} män",
  "totalGap": "Totalt lönegap",
  "totalGapNote": "Median {median}",
  "totalGapNoMedian": "Median ej mätbar",
  "notMeasurable": "Ej mätbart",
  "remaining": "Återstår att analysera",
  "remainingValue": "<open></open> av <total></total> grupper",
  "remainingNote": "Inte klara, av grupperna som kräver dokumentation",
  "riskGroups": "Riskgrupper",
  "riskValue": "<count></count> av <total></total>",
  "riskNote": "{count, plural, one {# person berörd} other {# personer berörda}}",
  "actions": "Åtgärder",
  "actionsValue": "<done></done> av <total></total> klara",
  "actionsNote": "{count} pågående",
  "cost": "Beräknad kostnad",
  "costNote": "{oneOff} engångs",
  "costUncostedNote": "{count, plural, one {# åtgärd utan kostnad} other {# åtgärder utan kostnad}}",
  "costNone": "Kostnad ej beräknad",
  "costNoneNote": "Ingen åtgärd har en kostnad"
},
"delta": {
  "gapLower": "{points} punkter lägre än {label}",
  "gapHigher": "{points} punkter högre än {label}",
  "fewerGroups": "{count, plural, one {# grupp färre} other {# grupper färre}} än {label}",
  "moreGroups": "{count, plural, one {# grupp fler} other {# grupper fler}} än {label}",
  "fewerPeople": "{count, plural, one {# person färre} other {# personer färre}} än {label}",
  "morePeople": "{count, plural, one {# person fler} other {# personer fler}} än {label}",
  "fewerDone": "{count, plural, one {# åtgärd färre klar} other {# åtgärder färre klara}} än {label}",
  "moreDone": "{count, plural, one {# åtgärd fler klar} other {# åtgärder fler klara}} än {label}",
  "unchanged": "Oförändrat mot {label}"
},
"observations": {
  "title": "Iakttagelser",
  "actionRequired": "Åtgärd krävs",
  "needsReview": "Behöver granskas",
  "none": "Ingen avvikelse identifierad",
  "scopeGroup": "{count, plural, one {# person} other {# personer}} · {gap}",
  "scopeQuartile": "{share} kvinnor i övre kvartilen",
  "scopeNone": "Inom det definierade intervallet",
  "nextCompleteAssessment": "Slutför bedömningen av sakliga skäl och förbered eventuell justering",
  "nextAssessAdjustment": "Bedöm behovet av en lönejustering",
  "nextComparison": "Bedöm mot den högre betalda jämförelsegruppen",
  "nextQuartile": "Se över lönekriterier, befordran och karriärvägar",
  "nextPraxis": "Besluta en åtgärd för området",
  "nextNone": "Följ upp i nästa kartläggning",
  "open": "Öppna {label}"
},
"outcome": {
  "title": "Löneutfall",
  "mean": "Medelgap",
  "median": "Mediangap",
  "analysed": "Analyserade grupper",
  "ofTotal": "{done} av {total}",
  "remaining": "Återstår",
  "riskGroups": "Riskgrupper",
  "affected": "Berörda personer"
},
"groupTable": {
  "title": "Grupper",
  "viewLabel": "Jämförelsetyp",
  "equalWork": "Lika arbete",
  "equivalentWork": "Likvärdigt arbete",
  "statusFilterLabel": "Status",
  "statusAll": "Alla statusar",
  "resultCount": "{shown} av {total} grupper",
  "noMatches": "Inga grupper matchar filtret.",
  "clearFilters": "Rensa filter",
  "empty": "Inga grupper att visa.",
  "columns": {
    "group": "Grupp",
    "women": "Kvinnor",
    "men": "Män",
    "medianWomen": "Median kvinnor",
    "medianMen": "Median män",
    "gap": "Lönegap",
    "status": "Status",
    "headcount": "Personer",
    "comparison": "Jämförelsegrupp",
    "diff": "Skillnad",
    "reference": "Referens",
    "change": "Förändring"
  },
  "masked": "Maskerad",
  "new": "Ny",
  "otherComparisons": "+{count} till",
  "womenShare": "{share} kvinnor",
  "openRow": "Öppna {label} i analysen"
},
"actionPlan": {
  "title": "Åtgärdsplan",
  "annual": "Årlig återkommande",
  "oneOff": "Engångs",
  "firstYear": "Totalt första året",
  "uncosted": "Kostnad ej beräknad: {count, plural, one {# åtgärd} other {# åtgärder}}",
  "followUp": "Nästa beslutspunkt",
  "process": "Process",
  "steps": {
    "mappingDone": "Kartläggning klar",
    "analysisDone": "Analys klar",
    "planDecided": "Plan beslutad",
    "implementing": "Genomförande",
    "followUp": "Uppföljning"
  },
  "state": {
    "done": "Klart",
    "current": "Aktuellt",
    "upcoming": "Kommande"
  }
},
"comparability": {
  "title": "Begränsad jämförbarhet",
  "population": "Den här kartläggningen omfattar {current} personer jämfört med {reference} i {label}. Läs förändringarna tillsammans med den förändrade populationen.",
  "model": "Värderingsmodellen skiljer sig från den som användes i {label}. Läs förändringarna tillsammans med den förändrade metoden."
}
```

Help in `sv.json`:

```json
"riskGroupLabel": "Vad är en riskgrupp?",
"riskGroupBody": "En grupp vars skillnad fortfarande analyseras eller har en beslutad åtgärd, räknad av alla grupper med en jämförelse. Ett dokumenterat sakligt skäl avslutar den.",
"affectedPeopleLabel": "Vilka räknas som berörda?",
"affectedPeopleBody": "Antalet personer av det lägre betalda könet i varje riskgrupp; i en kvinnodominerad grupp alla i gruppen. Det räknar personer, inte belopp.",
"remainingToAnalyseLabel": "Vad återstår att analysera?",
"remainingToAnalyseBody": "Grupper som kräver dokumentation och inte är klarmarkerade: en grupp med lika arbete och ett gap, eller en kvinnodominerad grupp med en högre betald jämförelse.",
"compareWithLabel": "Vad gör jämförelsen?",
"compareWithBody": "Lägger till varje siffras förändring mot en tidigare avslutad kartläggning, matchad grupp för grupp. Den ändrar aldrig den här kartläggningens egna siffror.",
"comparabilityLabel": "Vad begränsar jämförbarheten?",
"comparabilityBody": "En population som skiljer sig med 10 % eller mer, eller en annan värderingsmodell. Förändringarna visas ändå; läs dem tillsammans med det som ändrats.",
"processLabel": "Vad är processtegen?",
"processBody": "Kartläggning, analys, beslutad plan, genomförande och uppföljning i nästa kartläggning. Ett steg är klart när dess villkor gäller, oavsett vad stegen runt omkring visar.",
"overviewMaskingLabel": "Varför är vissa medianer maskerade?",
"overviewMaskingBody": "En grupp med färre än 4 personer eller färre än 2 av ett kön döljer sina medianer här och i dokumenten. Analyssidorna visar varje siffra.",
"followUpDateLabel": "Vad är nästa beslutspunkt?",
"followUpDateBody": "Datumet då åtgärdsplanen ses över nästa gång. Alla medlemmar kan sätta det, även efter att kartläggningen avslutats, och varje ändring loggas.",
"estimatedCostLabel": "Hur beräknas kostnaden?",
"estimatedCostBody": "Årlig återkommande kostnad är varje årskostnad plus tolv gånger varje månadskostnad; engångskostnader listas bredvid. Åtgärder utan kostnad räknas, inte summeras.",
"observationsLabel": "Hur väljs iakttagelserna?",
"observationsBody": "Härledda med fasta regler ur grupperna, jämförelserna, kvartilerna och praxisområdena, aldrig av AI. Åtgärd krävs rankas först, sedan störst omfattning."
```

Toast: `"payMappingFollowUpDateSaved": "Nästa beslutspunkt sparad"`.

- [ ] **Step 3: Norwegian, Danish and Finnish**

Write every key above in `nb.json`, `da.json` and `fi.json` at production quality, keeping the same structure, the same ICU arguments and the same `<open></open>`-style tags. Anchor the vocabulary on the strings these files already use for the same concepts:

| concept | nb | da | fi |
|---|---|---|---|
| pay gap | `Lønnsgap` (`overview.headlineGapLabel`) | `Løngab` | `Palkkaero` |
| women / men | `Kvinner` / `Menn` (`gap.columns`) | `Kvinder` / `Mænd` | `Naiset` / `Miehet` |
| people included | `Personer inkludert` (`detail.population`) | `Personer inkluderet` | `Mukana olevat henkilöt` |
| not enough data | `Utilstrekkelig grunnlag` (`gap.flag.insufficient`) | `Utilstrækkeligt grundlag` | `Riittämättömät tiedot` |
| action statuses | `Ikke påbegynt` / `Pågår` / `Fullført` (`actions.status`) | `Ikke påbegyndt` / `I gang` / `Afsluttet` | `Aloittamatta` / `Käynnissä` / `Valmis` |
| actions (noun) | `Tiltak` (`actionsOverview.totalLabel`) | `Tiltag` | `Toimenpiteet` |
| estimated cost | `Beregnet kostnad` (`actions.estimatedCost`) | `Beregnet omkostning` | `Arvioitu kustannus` |
| per month / per year suffix | `/mnd`, `/år` | `/md.`, `/år` | `/kk`, `/v` |
| completed (run status) | `Fullført` (`status.completed`) | `Afsluttet` | `Valmis` |
| reference date | `Referansedato` (`table.referenceDate`) | `Referencedato` | `Viitepäivä` |
| equal / equivalent work | `Likt arbeid` / `Likeverdig arbeid` (`review.chaptersShort`) | `Lige arbejde` / `Ligeværdigt arbejde` | `Samaa työtä` / `Samanarvoista työtä` |
| women-dominated group | `Kvinnedominerte grupper` (`review.chapters.equivalentWork`) | `Kvindedominerede grupper` | `Naisvaltaiset ryhmät` |
| unchanged vs | `Uendret mot {label}` (`overview.deltaUnchanged`) | `Uændret i forhold til {label}` | `Ennallaan verrattuna {label}` |
| upper quartile | `Øvre kvartil` (`overview.quartiles.upper`) | `Øvre kvartil` | `Ylin neljännes` |
| next decision point | `Neste beslutningspunkt` (Task 2's audit field) | `Næste beslutningspunkt` | `Seuraava päätöskohta` |
| practice (area) | `Praksis` (`review.chaptersShort.praxis`) | `Praksis` | `Käytäntö` |
| pick a date / clear | `Velg dato` / `Tøm` (`datePicker`) | `Vælg dato` / `Ryd` | `Valitse päivä` / `Tyhjennä` |
| mapping (noun) | `lønnskartlegging` | `lønkortlægning` | `palkkakartoitus` |

Toast: nb `Neste beslutningspunkt lagret`, da `Næste beslutningspunkt gemt`, fi `Seuraava päätöskohta tallennettu`.

- [ ] **Step 4: Cross-locale QA pass**

Read every new nb, da and fi string against the sv and en versions for false friends, register (the files address the reader as "du"/"dere" consistently) and terminology drift; check the plural forms (`one`/`other`) read naturally in each language; check every help body stays under 240 characters (`cd packages/i18n && bun run test` enforces it and the key parity). Fix in place.

- [ ] **Step 5: Verify**

Run: `cd packages/i18n && bun run test && cd ../../apps/dashboard && bunx tsc --noEmit`, then `grep -rnP '\x{2014}' packages/i18n/messages` (expected: nothing).
Expected: PASS.

- [ ] **Step 6: Present the diff (no commit)**

Proposed message: `feat(i18n): pay-mapping overview strings in five locales`

---

### Task 10: PanelCard help and the context row with the reference selector

**Files:**
- Modify: `apps/dashboard/components/panel-card.tsx`
- Create: `apps/dashboard/components/pay-mapping/overview/overview-context-row.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-context-row.test.tsx`

**Interfaces:**
- Consumes: `usePayMappingRun` (`run`, `runsList`, `reference`), `referenceCandidates`, `useCompareParam`, `onSelectValue`, `Select`, `Badge`, `HelpMorphButton`, keys `dashboard.payMapping.overview.context.*`, `dashboard.payMapping.status.*`, `dashboard.help.compareWith*`.
- Produces: `PanelCard` accepts `help?: { label: string; body: string }`; `OverviewContextRow` (no props).

- [ ] **Step 1: PanelCard help**

In `panel-card.tsx`, add `import { HelpMorphButton } from "@/components/help-morph-button"`, add `help?: { label: string; body: string }` to the props (after `meta`), and replace the `<h3>` with:

```tsx
        <h3 className="flex min-w-0 flex-1 items-center gap-2 font-medium text-sm">
          <span className="truncate">{title}</span>
          {help !== undefined && (
            <HelpMorphButton label={help.label}>{help.body}</HelpMorphButton>
          )}
        </h3>
```

- [ ] **Step 2: Write the failing component test**

`overview-context-row.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ replace: navigation.replace }),
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import {
  type PayMappingReference,
  type PayMappingRunListEntry,
  PayMappingRunProvider,
} from "@/components/pay-mapping/pay-mapping-run-context"
import { makeRunDetail, makeRunSummary } from "@/test/pay-mapping-fixtures"
import { pickSelectOption } from "@/test/select"
import { OverviewContextRow } from "./overview-context-row"

const m = en.dashboard.payMapping
const RUN = makeRunDetail({
  label: "Pay mapping 2026",
  referenceDate: Date.UTC(2026, 8, 1),
  populationCount: 118,
  withPayCount: 112,
})
const EARLIER = makeRunSummary({
  slug: "pay-2025",
  label: "Pay mapping 2025",
  referenceDate: Date.UTC(2025, 8, 1),
})

function renderRow(options: {
  run?: typeof RUN | undefined
  runsList?: PayMappingRunListEntry[] | undefined
  reference?: PayMappingReference | null
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="Europe/Stockholm" messages={en}>
      <PayMappingRunProvider
        value={{
          slug: "pay-2026",
          run: "run" in options ? options.run : RUN,
          gap: undefined,
          analyses: undefined,
          actions: [],
          notes: [],
          runsList: "runsList" in options ? options.runsList : [],
          reference: options.reference ?? null,
        }}
      >
        <OverviewContextRow />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  navigation.search = ""
  navigation.replace.mockReset()
})

describe("OverviewContextRow", () => {
  it("shows the run label, status, extraction date, coverage and the base-year chip on a first mapping", () => {
    renderRow()
    expect(screen.getByText("Pay mapping 2026")).toBeDefined()
    expect(screen.getByText(m.status.active)).toBeDefined()
    expect(screen.getByText("Data extracted Sep 1, 2026")).toBeDefined()
    expect(screen.getByText("112 of 118 with pay")).toBeDefined()
    expect(screen.getByText(m.overview.context.baseYear)).toBeDefined()
  })

  it("drops the base-year chip and lists earlier completed runs in the selector", async () => {
    renderRow({ runsList: [EARLIER] })
    expect(screen.queryByText(m.overview.context.baseYear)).toBeNull()
    fireEvent.click(screen.getByRole("combobox", { name: m.overview.context.compareLabel }))
    expect(await screen.findByRole("option", { name: "Pay mapping 2025 · September 2025 · Completed" })).toBeDefined()
  })

  it("writes ?compare= on selection", async () => {
    renderRow({ runsList: [EARLIER] })
    await pickSelectOption(
      screen.getByRole("combobox", { name: m.overview.context.compareLabel }),
      "Pay mapping 2025 · September 2025 · Completed"
    )
    expect(navigation.replace).toHaveBeenLastCalledWith("/pay-mappings/pay-2026?compare=pay-2025", { scroll: false })
  })

  it("removes the parameter on No comparison", async () => {
    navigation.search = "compare=pay-2025"
    renderRow({ runsList: [EARLIER], reference: { run: EARLIER, gap: undefined, analyses: undefined, actions: undefined } })
    await pickSelectOption(
      screen.getByRole("combobox", { name: m.overview.context.compareLabel }),
      m.overview.context.noComparison
    )
    expect(navigation.replace).toHaveBeenLastCalledWith("/pay-mappings/pay-2026", { scroll: false })
  })

  it("renders the selector showing No comparison while the run list loads", () => {
    renderRow({ run: undefined, runsList: undefined })
    expect(screen.getByRole("combobox", { name: m.overview.context.compareLabel })).toBeDefined()
    expect(screen.getByText(m.overview.context.noComparison)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-context-row.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the row**

`overview-context-row.tsx`:

```tsx
"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useCompareParam } from "@/hooks/use-compare-param"
import { onSelectValue } from "@/lib/select"
import {
  referenceCandidates,
  usePayMappingRun,
} from "../pay-mapping-run-context"

// The Select's own value for "nothing selected": a slug can never be this
// (slugs are lowercase hyphenated words, and the run list never carries
// one named "none" that is also completed and earlier, because the
// candidate list is what the options are built from).
const NO_COMPARISON = "none"

// Under the breadcrumbs: what this mapping is (label, status, extraction
// date, coverage), whether it is the base year, and what it is compared
// with. The selector is static chrome and renders live while the run list
// loads, showing "No comparison".
export function OverviewContextRow() {
  const t = useTranslations("dashboard.payMapping.overview.context")
  const tStatus = useTranslations("dashboard.payMapping.status")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const { run, runsList, reference } = usePayMappingRun()
  const { setCompare } = useCompareParam()

  const candidates =
    run === undefined || runsList === undefined
      ? []
      : referenceCandidates(run, runsList)
  const hasEarlier =
    run !== undefined &&
    runsList !== undefined &&
    runsList.some((candidate) => candidate.referenceDate < run.referenceDate)
  const optionLabel = (candidate: (typeof candidates)[number]) =>
    t("referenceOption", {
      label: candidate.label,
      month: format.dateTime(candidate.referenceDate, {
        month: "long",
        year: "numeric",
      }),
    })
  const items = {
    [NO_COMPARISON]: t("noComparison"),
    ...Object.fromEntries(
      candidates.map((candidate) => [candidate.slug, optionLabel(candidate)])
    ),
  }
  const value = reference === null ? NO_COMPARISON : reference.run.slug

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {run === undefined ? (
        <Skeleton className="h-5 w-64" />
      ) : (
        <>
          <span className="font-medium">{run.label}</span>
          <Badge variant="outline">{tStatus(run.status)}</Badge>
          <span className="text-muted-foreground">
            {t("extracted", {
              date: format.dateTime(run.referenceDate, { dateStyle: "medium" }),
            })}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {t("coverage", {
              withPay: run.withPayCount,
              total: run.populationCount,
            })}
          </span>
          {runsList !== undefined && !hasEarlier && (
            <Badge variant="secondary">{t("baseYear")}</Badge>
          )}
        </>
      )}
      {/* ml-auto: the selector sits at the row's right edge and wraps to
          its own line on a narrow viewport. */}
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          {t("compareLabel")}
          <HelpMorphButton label={tHelp("compareWithLabel")}>
            {tHelp("compareWithBody")}
          </HelpMorphButton>
        </span>
        <Select
          items={items}
          value={value}
          onValueChange={onSelectValue((next: string) =>
            setCompare(next === NO_COMPARISON ? null : next)
          )}
        >
          <SelectTrigger size="sm" className="w-72" aria-label={t("compareLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COMPARISON}>{t("noComparison")}</SelectItem>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.runId} value={candidate.slug}>
                {optionLabel(candidate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview components/panel-card && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/components/panel-card.tsx apps/dashboard/components/pay-mapping/overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview context row with the reference selector`

---

### Task 11: The KPI strip and the comparability notice

**Files:**
- Create: `apps/dashboard/hooks/use-number-flow-currency-format.ts`
- Test: `apps/dashboard/hooks/use-number-flow-currency-format.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/actions-overview.tsx` (consume the hook)
- Create: `apps/dashboard/components/pay-mapping/overview/overview-kpi-strip.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-kpi-strip.test.tsx`
- Create: `apps/dashboard/components/pay-mapping/overview/overview-comparability-notice.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-comparability-notice.test.tsx`

**Interfaces:**
- Consumes: `overviewKpis`, `overviewStatuses`, `overviewDeltas`, `overviewComparability` (Tasks 3, 7); `WidgetCard`, `StatBar`; `NumberFlow`; `useMoney`; `percentText`; `Alert`, `AlertTitle`, `AlertDescription`; keys `overview.kpi.*`, `overview.delta.*`, `overview.comparability.*`, `help.*`.
- Produces: `useNumberFlowCurrencyFormat(currency: string | null): { style: "currency"; currency: string; maximumFractionDigits: 0 } | null`; `OverviewKpiStrip`; `OverviewComparabilityNotice`; both read the context only.

- [ ] **Step 1: Write the failing hook test**

`use-number-flow-currency-format.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useNumberFlowCurrencyFormat } from "./use-number-flow-currency-format"

describe("useNumberFlowCurrencyFormat", () => {
  it("returns a zero-decimal currency format for a valid code", () => {
    expect(renderHook(() => useNumberFlowCurrencyFormat("SEK")).result.current).toEqual({
      style: "currency",
      currency: "SEK",
      maximumFractionDigits: 0,
    })
  })

  it("returns null for an invalid or absent code", () => {
    expect(renderHook(() => useNumberFlowCurrencyFormat("not-a-code")).result.current).toBeNull()
    expect(renderHook(() => useNumberFlowCurrencyFormat(null)).result.current).toBeNull()
  })
})
```

- [ ] **Step 2: Implement the hook, the shared NumberFlow stand-in, and consume both in the actions overview**

Create `apps/dashboard/test/number-flow-mock.tsx` (lifted from the inline mock at the top of `actions-overview.test.tsx`):

```tsx
import type { ReactNode } from "react"

// NumberFlow's custom element does not exist in jsdom. The stand-in formats
// through the same Intl options the component takes, so a test reads the
// number a user would (a currency roll-up included) instead of a raw value.
// Every test that renders a NumberFlow mocks the module with this:
//   vi.mock("@number-flow/react", async () =>
//     (await import("@/test/number-flow-mock")).numberFlowModule)
export function NumberFlowMock({
  value,
  format,
  locales,
}: {
  value: number
  format?: Intl.NumberFormatOptions
  locales?: string | string[]
}): ReactNode {
  return (
    <span>{new Intl.NumberFormat(locales ?? "en", format).format(value)}</span>
  )
}

export const numberFlowModule = { default: NumberFlowMock }
```

In `actions-overview.test.tsx`, replace the inline `vi.mock("@number-flow/react", () => ({ default: ... }))` block with `vi.mock("@number-flow/react", async () => (await import("@/test/number-flow-mock")).numberFlowModule)`, and replace its local `action(...)` helper with `makeAction` from `@/test/pay-mapping-fixtures` (keep every override each call passes; delete the helper).

`use-number-flow-currency-format.ts`:

```ts
import { useMemo } from "react"

// NumberFlow's currency format throws on an invalid code (imported
// currencies are not schema-constrained), so validate once and let the
// caller fall back to the plain formatMoney text, which has its own
// fallback. Null for no currency at all.
export function useNumberFlowCurrencyFormat(currency: string | null) {
  return useMemo(() => {
    if (currency === null || currency === "") return null
    try {
      new Intl.NumberFormat("en", { style: "currency", currency })
      return {
        style: "currency" as const,
        currency,
        maximumFractionDigits: 0,
      }
    } catch {
      return null
    }
  }, [currency])
}
```

In `actions-overview.tsx`, replace the `costFormat` `useMemo` block with `const costFormat = useNumberFlowCurrencyFormat(currency)` (import from `@/hooks/use-number-flow-currency-format`; drop the now-unused `useMemo` import only if nothing else uses it).

Run: `cd apps/dashboard && bunx vitest run hooks/use-number-flow-currency-format.test.tsx components/pay-mapping/actions-overview.test.tsx`
Expected: PASS.

Recorded choice (i18n boundary): the card VALUES roll through NumberFlow via tag-based rich messages (`<open></open> of <total></total> groups`); the notes `scopeNote`, `riskNote` and `actionsNote` embed their counts in ICU sentences (a plural, or a number inside a phrase) and stay plain text, because a rich tag cannot drive an ICU plural and the i18n rule forbids splitting a message around a component.

- [ ] **Step 3: Write the failing KPI strip test**

`overview-kpi-strip.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock("@number-flow/react", async () =>
  (await import("@/test/number-flow-mock")).numberFlowModule
)
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import type { PayMappingActionWire } from "@/components/pay-mapping/pay-mapping-gap-types"
import {
  type PayMappingReference,
  PayMappingRunProvider,
} from "@/components/pay-mapping/pay-mapping-run-context"
import { makeAction, makeGapGroup, makeGapResult, makeRunDetail, makeRunSummary } from "@/test/pay-mapping-fixtures"
import { OverviewKpiStrip } from "./overview-kpi-strip"

const m = en.dashboard.payMapping.overview

const GAP = makeGapResult({
  equalWork: [makeGapGroup({ key: "SWE|3", flag: "critical", womenCount: 3, menCount: 5 })],
  population: { women: 60, men: 58 },
})
const RUN = makeRunDetail({ populationCount: 118, withPayCount: 112 })

function renderStrip(options: { loading?: boolean; reference?: PayMappingReference | null; actions?: PayMappingActionWire[] } = {}) {
  const loading = options.loading === true
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayMappingRunProvider
        value={{
          slug: "pay-2026",
          run: loading ? undefined : RUN,
          gap: loading ? undefined : GAP,
          analyses: loading ? undefined : [],
          actions: loading ? undefined : (options.actions ?? [makeAction({ status: "done" }), makeAction({ actionId: "a2" as PayMappingActionWire["actionId"], status: "inProgress", estimatedCost: 1000, estimatedCostUnit: "perMonth" })]),
          notes: [],
          runsList: [],
          reference: options.reference ?? null,
        }}
      >
        <OverviewKpiStrip />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("OverviewKpiStrip", () => {
  it("renders the six card titles with their figures", () => {
    renderStrip()
    for (const key of ["scope", "totalGap", "remaining", "riskGroups", "actions", "cost"] as const) {
      expect(screen.getByText(m.kpi[key])).toBeDefined()
    }
    expect(screen.getByText("118")).toBeDefined()
    expect(screen.getByText("60 women · 58 men")).toBeDefined()
    expect(screen.getByText("10%")).toBeDefined()
    expect(screen.getByText("Median 10%")).toBeDefined()
    expect(screen.getByText("3 people affected")).toBeDefined()
    expect(screen.getByText("1 in progress")).toBeDefined()
    // 1000/month annualised.
    expect(screen.getByText(/12[\s,.]?000/)).toBeDefined()
    expect(screen.getByText("1 action without a cost")).toBeDefined()
    // The note is the one-off total; the uncosted count is the footer.
    expect(screen.getByText(/one-off$/)).toBeDefined()
  })

  it("says cost not estimated when no action carries a cost", () => {
    renderStrip({ actions: [makeAction()] })
    expect(screen.getByText(m.kpi.costNone)).toBeDefined()
    expect(screen.getByText(m.kpi.costNoneNote)).toBeDefined()
  })

  it("renders no delta footer without a reference", () => {
    renderStrip()
    expect(screen.queryByText(/than /)).toBeNull()
    expect(screen.queryByText(/Unchanged vs/)).toBeNull()
  })

  it("renders delta footers against the reference once it has loaded", () => {
    const reference: PayMappingReference = {
      run: makeRunSummary({ label: "September 2025", populationCount: 125 }),
      gap: makeGapResult({ org: { ...GAP.org, gapPct: 10.7 }, population: { women: 62, men: 63 } }),
      analyses: [],
      actions: [],
    }
    renderStrip({ reference })
    expect(screen.getByText("7 fewer people than September 2025")).toBeDefined()
    expect(screen.getByText("0.7 points lower than September 2025")).toBeDefined()
    expect(screen.getByText("1 more action done than September 2025")).toBeDefined()
    // Remaining (1 open duty vs 0) and risk (1 group vs 0) both move by one.
    expect(screen.getAllByText("1 more group than September 2025")).toHaveLength(2)
  })

  it("keeps the card titles real and shows bars while loading", () => {
    renderStrip({ loading: true })
    expect(screen.getByText(m.kpi.scope)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(6)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-kpi-strip.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement the strip**

`overview-kpi-strip.tsx`:

```tsx
"use client"

import {
  Alert02Icon,
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  CheckListIcon,
  Coins01Icon,
  JusticeScale01Icon,
  TaskDone01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useMemo } from "react"
import { StatBar, WidgetCard } from "@/components/widget-card"
import { useMoney } from "@/hooks/use-money"
import { useNumberFlowCurrencyFormat } from "@/hooks/use-number-flow-currency-format"
import { type OverviewDeltas, overviewDeltas } from "@/lib/pay-mapping-overview/comparison"
import { type OverviewKpis, overviewKpis } from "@/lib/pay-mapping-overview/kpis"
import { overviewStatuses } from "@/lib/pay-mapping-overview/statuses"
import { percentText } from "@/lib/percent"
import {
  type PayMappingReference,
  usePayMappingRun,
} from "../pay-mapping-run-context"

// The reference's KPIs from its own three subscriptions; undefined while
// any is still loading, and undefined without a reference.
function referenceKpis(
  reference: PayMappingReference | null
): OverviewKpis | undefined {
  if (
    reference === null ||
    reference.gap === undefined ||
    reference.analyses === undefined ||
    reference.actions === undefined
  ) {
    return undefined
  }
  const { gap, analyses, actions, run } = reference
  return overviewKpis({
    gap,
    analyses,
    actions,
    run,
    statuses: overviewStatuses(gap, analyses, actions),
  })
}

// The delta vocabulary, typed as the message keys under
// dashboard.payMapping.overview.delta so a wrong word is a compile error.
type DeltaWords = {
  fewer: "fewerGroups" | "fewerPeople" | "fewerDone"
  more: "moreGroups" | "morePeople" | "moreDone"
}
const DELTA_WORDS = {
  groups: { fewer: "fewerGroups", more: "moreGroups" },
  people: { fewer: "fewerPeople", more: "morePeople" },
  done: { fewer: "fewerDone", more: "moreDone" },
} as const satisfies Record<string, DeltaWords>

type DeltaTranslator = ReturnType<
  typeof useTranslations<"dashboard.payMapping.overview.delta">
>

// A signed count delta as the footer statement, with its arrow. Zero reads
// "Unchanged vs <label>", which is a different statement from having
// nothing to compare against (no footer at all).
function countDelta(
  value: number,
  label: string,
  words: DeltaWords,
  t: DeltaTranslator
): { text: string; icon?: IconSvgElement } {
  if (value === 0) return { text: t("unchanged", { label }) }
  return {
    text: t(value < 0 ? words.fewer : words.more, {
      count: Math.abs(value),
      label,
    }),
    icon: value < 0 ? ArrowDownRight01Icon : ArrowUpRight01Icon,
  }
}

// Six stat tiles. Every count is a NumberFlow (they move as the analysis
// and the actions change while the page is open); the money value rolls
// through the currency format when the code is valid. The delta footer
// exists only under a reference: without one, nothing in this strip
// mentions a comparison.
export function OverviewKpiStrip() {
  const t = useTranslations("dashboard.payMapping.overview.kpi")
  const tDelta = useTranslations("dashboard.payMapping.overview.delta")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const money = useMoney()
  const { run, gap, analyses, actions, reference } = usePayMappingRun()
  const currency = gap?.currency ?? null
  const costFormat = useNumberFlowCurrencyFormat(currency)

  const kpis = useMemo(() => {
    if (
      run === undefined ||
      gap === undefined ||
      analyses === undefined ||
      actions === undefined
    ) {
      return undefined
    }
    return overviewKpis({
      gap,
      analyses,
      actions,
      run,
      statuses: overviewStatuses(gap, analyses, actions),
    })
  }, [run, gap, analyses, actions])
  const referenceValues = useMemo(() => referenceKpis(reference), [reference])
  const deltas: OverviewDeltas | undefined =
    kpis !== undefined && referenceValues !== undefined
      ? overviewDeltas(kpis, referenceValues)
      : undefined
  const referenceLabel = reference?.run.label

  // The footer slot: nothing without a reference, a bar while the
  // reference loads, the statement once both sides are known.
  function footerFor(
    statement: (deltas: OverviewDeltas, label: string) => { text: string; icon?: IconSvgElement } | null
  ): { footer?: ReactNode; footerIcon?: IconSvgElement } {
    if (reference === null || referenceLabel === undefined) return {}
    if (deltas === undefined) return { footer: <StatBar className="h-4 w-36" /> }
    const result = statement(deltas, referenceLabel)
    return result === null ? {} : { footer: result.text, footerIcon: result.icon }
  }

  if (kpis === undefined) {
    const bars = {
      value: <StatBar className="h-7 w-20" />,
      note: <StatBar className="h-4 w-28" />,
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WidgetCard title={t("scope")} icon={UserGroupIcon} {...bars} />
        <WidgetCard title={t("totalGap")} icon={JusticeScale01Icon} {...bars} />
        <WidgetCard title={t("remaining")} icon={CheckListIcon} {...bars} />
        <WidgetCard title={t("riskGroups")} icon={Alert02Icon} {...bars} />
        <WidgetCard title={t("actions")} icon={TaskDone01Icon} {...bars} />
        <WidgetCard title={t("cost")} icon={Coins01Icon} {...bars} />
      </div>
    )
  }

  const flow = (value: number) => <NumberFlow value={value} />

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <WidgetCard
        title={t("scope")}
        icon={UserGroupIcon}
        value={flow(kpis.scope.included)}
        note={t("scopeNote", { women: kpis.scope.women, men: kpis.scope.men })}
        {...footerFor((d, label) => countDelta(d.people, label, DELTA_WORDS.people, tDelta))}
      />
      <WidgetCard
        title={t("totalGap")}
        icon={JusticeScale01Icon}
        help={{ label: tHelp("headlineGapLabel"), body: tHelp("headlineGapBody") }}
        value={
          kpis.totalGap.meanPct === null ? (
            <span className="font-normal text-base text-muted-foreground">{t("notMeasurable")}</span>
          ) : (
            percentText(kpis.totalGap.meanPct, format)
          )
        }
        note={
          kpis.totalGap.medianPct === null
            ? t("totalGapNoMedian")
            : t("totalGapNote", { median: percentText(kpis.totalGap.medianPct, format) })
        }
        {...footerFor((d, label) => {
          if (d.gapPoints === null) return null
          const points = format.number(Math.abs(d.gapPoints), { maximumFractionDigits: 1 })
          if (Math.abs(d.gapPoints) < 0.05) return { text: tDelta("unchanged", { label }) }
          return {
            text: tDelta(d.gapPoints < 0 ? "gapLower" : "gapHigher", { points, label }),
            icon: d.gapPoints < 0 ? ArrowDownRight01Icon : ArrowUpRight01Icon,
          }
        })}
      />
      <WidgetCard
        title={t("remaining")}
        icon={CheckListIcon}
        help={{ label: tHelp("remainingToAnalyseLabel"), body: tHelp("remainingToAnalyseBody") }}
        value={t.rich("remainingValue", { open: () => flow(kpis.remaining.open), total: () => flow(kpis.remaining.total) })}
        note={t("remainingNote")}
        {...footerFor((d, label) => countDelta(d.remainingGroups, label, DELTA_WORDS.groups, tDelta))}
      />
      <WidgetCard
        title={t("riskGroups")}
        icon={Alert02Icon}
        help={{ label: tHelp("riskGroupLabel"), body: tHelp("riskGroupBody") }}
        value={t.rich("riskValue", { count: () => flow(kpis.risk.groups), total: () => flow(kpis.risk.total) })}
        note={t("riskNote", { count: kpis.risk.affected })}
        {...footerFor((d, label) => countDelta(d.riskGroups, label, DELTA_WORDS.groups, tDelta))}
      />
      <WidgetCard
        title={t("actions")}
        icon={TaskDone01Icon}
        value={t.rich("actionsValue", { done: () => flow(kpis.actions.done), total: () => flow(kpis.actions.total) })}
        note={t("actionsNote", { count: kpis.actions.inProgress })}
        {...footerFor((d, label) => countDelta(d.actionsDone, label, DELTA_WORDS.done, tDelta))}
      />
      <WidgetCard
        title={t("cost")}
        icon={Coins01Icon}
        help={{ label: tHelp("estimatedCostLabel"), body: tHelp("estimatedCostBody") }}
        value={
          kpis.cost.costed === 0 ? (
            <span className="font-normal text-base text-muted-foreground">{t("costNone")}</span>
          ) : costFormat === null || currency === null ? (
            money(kpis.cost.annual, currency ?? "")
          ) : (
            <NumberFlow value={kpis.cost.annual} format={costFormat} />
          )
        }
        // The spec's cost card: the annual figure as the value, the one-off
        // total as the note, the uncosted count as the footer. Never a delta
        // footer here.
        note={
          kpis.cost.costed === 0
            ? t("costNoneNote")
            : t("costNote", { oneOff: money(kpis.cost.oneOff, currency ?? "") })
        }
        footer={
          kpis.cost.costed > 0 && kpis.cost.uncosted > 0
            ? t("costUncostedNote", { count: kpis.cost.uncosted })
            : undefined
        }
      />
    </div>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-kpi-strip.test.tsx && bunx tsc --noEmit`
Expected: PASS, clean typecheck.

- [ ] **Step 6: Write the failing comparability test**

`overview-comparability-notice.test.tsx` (same mocks and provider wrapper as the strip test, rendering `<OverviewComparabilityNotice />`):

```tsx
  it("renders nothing without a reference or while it loads", () => {
    renderNotice({ reference: null })
    expect(screen.queryByRole("alert")).toBeNull()
    renderNotice({ reference: { run: makeRunSummary({ populationCount: 96 }), gap: undefined, analyses: undefined, actions: undefined } })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("names the population difference at ten percent or more", () => {
    renderNotice({ reference: { run: makeRunSummary({ label: "September 2025", populationCount: 96 }), gap: makeGapResult(), analyses: [], actions: [] } })
    expect(screen.getByRole("alert").textContent).toContain(
      "This mapping covers 118 people compared with 96 in September 2025. Read the changes together with the changed population."
    )
  })

  it("names a differing model and stays silent when both match", () => {
    const run = makeRunDetail({
      populationCount: 100,
      frozenMethod: { ...makeRunDetail().frozenMethod, criteria: [makeFrozenCriterion({ name: "Knowledge", weightPoints: 4 })] },
    })
    renderNotice({ run, reference: { run: makeRunSummary({ label: "September 2025", populationCount: 100, frozenCriteria: [{ libraryKey: null, name: "Knowledge", weightPoints: 3 }] }), gap: makeGapResult(), analyses: [], actions: [] } })
    expect(screen.getByRole("alert").textContent).toContain("The evaluation model differs from the one used in September 2025.")
    cleanup()
    renderNotice({ run, reference: { run: makeRunSummary({ populationCount: 100, frozenCriteria: [{ libraryKey: null, name: "Knowledge", weightPoints: 4 }] }), gap: makeGapResult(), analyses: [], actions: [] } })
    expect(screen.queryByRole("alert")).toBeNull()
  })
```

(`renderNotice` takes `{ run?; reference }`, defaulting `run` to `makeRunDetail({ populationCount: 118, withPayCount: 112 })`; `makeFrozenCriterion` is imported from `@/test/pay-mapping-fixtures`.)

- [ ] **Step 7: Implement the notice**

`overview-comparability-notice.tsx`:

```tsx
"use client"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { overviewComparability } from "@/lib/pay-mapping-overview/comparison"
import { usePayMappingRun } from "../pay-mapping-run-context"

// Rendered only under a loaded reference whose population differs by the
// threshold or whose frozen model differs; every sentence states the
// concrete difference. Without a reference this renders nothing at all.
export function OverviewComparabilityNotice() {
  const t = useTranslations("dashboard.payMapping.overview.comparability")
  const tHelp = useTranslations("dashboard.help")
  const { run, reference } = usePayMappingRun()
  if (
    run === undefined ||
    reference === null ||
    reference.gap === undefined ||
    reference.analyses === undefined ||
    reference.actions === undefined
  ) {
    return null
  }
  // Both sides reduce to key + name + weight points: the run detail's
  // frozen method carries more per criterion, the run list carries exactly
  // this.
  const comparability = overviewComparability(
    {
      populationCount: run.populationCount,
      criteria: run.frozenMethod.criteria.map(
        ({ libraryKey, name, weightPoints }) => ({ libraryKey, name, weightPoints })
      ),
    },
    {
      populationCount: reference.run.populationCount,
      criteria: reference.run.frozenCriteria,
    }
  )
  if (!comparability.populationDiffers && !comparability.modelDiffers) {
    return null
  }
  const label = reference.run.label
  return (
    <Alert>
      <HugeiconsIcon icon={AlertDiamondIcon} strokeWidth={2} aria-hidden="true" />
      <AlertTitle className="flex items-center gap-2">
        {t("title")}
        <HelpMorphButton label={tHelp("comparabilityLabel")}>
          {tHelp("comparabilityBody")}
        </HelpMorphButton>
      </AlertTitle>
      <AlertDescription>
        {comparability.populationDiffers && (
          <p>
            {t("population", {
              current: run.populationCount,
              reference: reference.run.populationCount,
              label,
            })}
          </p>
        )}
        {comparability.modelDiffers && <p>{t("model", { label })}</p>}
      </AlertDescription>
    </Alert>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview hooks && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/hooks apps/dashboard/components/pay-mapping` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 8: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview KPI strip with reference deltas and the comparability notice`

---

### Task 12: The observations list

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/analysis-chapters.ts` (export `analysisStepHref`)
- Modify: `apps/dashboard/components/pay-mapping/actions-overview.tsx` (consume it)
- Create: `apps/dashboard/components/pay-mapping/overview/overview-observations.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-observations.test.tsx`

**Interfaces:**
- Consumes: `overviewObservations`, `overviewStatuses`; `PanelCard` with `help`; `groupLabel`; `percentText`; keys `overview.observations.*`, `payMapping.gap.levelLabel`, `payMapping.review.praxis.<area>.title`, `help.observations*`.
- Produces: `analysisStepHref(slug: string, scope: "equalWork" | "equivalentWork" | "praxis", key: string): string` in `analysis-chapters.ts` (the key is a group key, or the praxis area); `OverviewObservations` (no props).

- [ ] **Step 1: Lift the deep link into `analysis-chapters.ts`**

Append to `analysis-chapters.ts`:

```ts
// The deep link that opens ONE step in its chapter page
// (?step=<scope>:<key>, the key the analysis page parses at mount): a
// group key for the two comparison chapters, the area for the practice
// review. A comparison links to the DOMINATED group's step, so callers
// pass the dominated group's key with the equivalentWork scope.
export function analysisStepHref(
  slug: string,
  scope: "equalWork" | "equivalentWork" | "praxis",
  key: string
): string {
  return `/pay-mappings/${slug}/analysis/${chapterSegment(scope)}?step=${scope}:${encodeURIComponent(key)}`
}
```

In `actions-overview.tsx`, delete the local `analysisStepHref` function, import `analysisStepHref` from `./analysis-chapters`, and replace each local `analysisStepHref(analysisHref, target)` call with `analysisStepHref(slug ?? "", targetScope(target), target.kind === "praxis" ? target.area : target.groupKey)` (the two-report plan's `targetScope` already returns `"praxis"` for a praxis target, and its actions-overview test expects `/pay-mappings/<slug>/analysis/praxis?step=praxis:<area>`, which this produces). Run `cd apps/dashboard && bunx vitest run components/pay-mapping/actions-overview.test.tsx` (PASS).

- [ ] **Step 2: Write the failing component test**

`overview-observations.test.tsx` (same navigation/convex mocks and a `renderWithRun({ gap, analyses, actions })` provider wrapper as Task 11's test, with `slug: "pay-2026"`, `run: makeRunDetail()`, `runsList: []`):

```tsx
  it("lists a critical group as action required with its scope and next step, linking to its step", () => {
    renderWithRun({
      gap: makeGapResult({ equalWork: [makeGapGroup({ key: "SWE|3", flag: "critical", womenCount: 3, menCount: 5, metric: { gapPct: 6.2 } })] }),
      analyses: [],
      actions: [],
    })
    expect(screen.getByText(m.observations.actionRequired)).toBeDefined()
    expect(screen.getByText("SWE · Level 3")).toBeDefined()
    expect(screen.getByText("8 people · 6.2%")).toBeDefined()
    expect(screen.getByText(m.observations.nextCompleteAssessment)).toBeDefined()
    expect(screen.getByRole("link", { name: "Open SWE · Level 3" }).getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/equal-work?step=equalWork:SWE%7C3"
    )
  })

  it("renders the single no-deviation row when nothing qualifies", () => {
    renderWithRun({ gap: makeGapResult(), analyses: [], actions: [] })
    expect(screen.getByText(m.observations.none)).toBeDefined()
    expect(screen.getByText(m.observations.scopeNone)).toBeDefined()
    expect(screen.getByText(m.observations.nextNone)).toBeDefined()
  })

  it("names a practice area by its title and links to the practice chapter", () => {
    renderWithRun({
      gap: makeGapResult(),
      analyses: [{ scope: "praxis", groupKey: "payPolicy", comparisonKey: null, reasons: [], note: "n", done: true, finding: "found" }],
      actions: [],
    })
    expect(screen.getByText(en.dashboard.payMapping.review.praxis.payPolicy.title)).toBeDefined()
    expect(screen.getByRole("link", { name: "Open Pay policy" }).getAttribute("href")).toBe("/pay-mappings/pay-2026/analysis/praxis?step=praxis:payPolicy")
  })

  it("keeps its title real and shows row bars while loading", () => {
    renderWithRun({ gap: undefined, analyses: undefined, actions: undefined })
    expect(screen.getByText(m.observations.title)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(3)
  })
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-observations.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the list**

`overview-observations.tsx`:

```tsx
"use client"

import {
  Alert02Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo } from "react"
import { PanelCard } from "@/components/panel-card"
import {
  OBSERVATION_LIMIT,
  type OverviewObservation,
  overviewObservations,
} from "@/lib/pay-mapping-overview/observations"
import { overviewStatuses } from "@/lib/pay-mapping-overview/statuses"
import { percentText } from "@/lib/percent"
import { analysisStepHref, chapterSegment } from "../analysis-chapters"
import { groupLabel } from "../pay-mapping-gap-types"
import { usePayMappingRun } from "../pay-mapping-run-context"

// Status as text with an icon; the colour is support only (the flag text
// tokens), never the carrier.
const STATUS_ICON: Record<"actionRequired" | "needsReview" | "none", IconSvgElement> = {
  actionRequired: Alert02Icon,
  needsReview: AlertCircleIcon,
  none: CheckmarkCircle02Icon,
}
const STATUS_CLASS: Record<"actionRequired" | "needsReview" | "none", string> = {
  actionRequired: "text-flag-critical",
  needsReview: "text-flag-elevated",
  none: "",
}

// One row's texts, resolved from the typed observation. The scope text
// and the next step are templates; nothing here is generated.
function useRowTexts(slug: string) {
  const t = useTranslations("dashboard.payMapping.overview.observations")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tPraxis = useTranslations("dashboard.payMapping.review.praxis")
  const format = useFormatter()
  const label = (roleTitle: string | null, level: number | null) =>
    [groupLabel({ roleTitle, seniority: null }), level === null ? null : tGap("levelLabel", { level })]
      .filter((part) => part !== null && part !== "")
      .join(" · ")
  return (row: OverviewObservation) => {
    switch (row.kind) {
      case "equalWorkGroup":
        return {
          status: row.status,
          subject: label(row.roleTitle, row.level),
          scope: t("scopeGroup", { count: row.headcount, gap: percentText(row.gapPct, format) }),
          next: t(row.next === "assessAdjustment" ? "nextAssessAdjustment" : "nextCompleteAssessment"),
          href: analysisStepHref(slug, "equalWork", row.groupKey),
        }
      case "womenDominatedGroup":
        return {
          status: row.status,
          subject: label(row.roleTitle, row.level),
          scope: t("scopeGroup", { count: row.headcount, gap: percentText(row.diffPct, format) }),
          next: t("nextComparison"),
          href: analysisStepHref(slug, "equivalentWork", row.groupKey),
        }
      case "upperQuartile":
        return {
          status: row.status,
          subject: t("scopeQuartile", { share: percentText(row.upperQuartileWomenSharePct, format) }),
          scope: t("scopeQuartile", { share: percentText(row.upperQuartileWomenSharePct, format) }),
          next: t("nextQuartile"),
          href: `/pay-mappings/${slug}/analysis/${chapterSegment("praxis")}`,
        }
      case "praxisArea":
        return {
          status: row.status,
          subject: tPraxis(`${row.area}.title`),
          scope: tPraxis(`${row.area}.title`),
          next: t("nextPraxis"),
          href: analysisStepHref(slug, "praxis", row.area),
        }
      case "none":
        return {
          status: "none" as const,
          subject: t("none"),
          scope: t("scopeNone"),
          next: t("nextNone"),
          href: `/pay-mappings/${slug}/actions`,
        }
    }
  }
}

export function OverviewObservations() {
  const t = useTranslations("dashboard.payMapping.overview.observations")
  const tHelp = useTranslations("dashboard.help")
  const { slug, gap, analyses, actions } = usePayMappingRun()
  const texts = useRowTexts(slug)
  const rows = useMemo(() => {
    if (gap === undefined || analyses === undefined || actions === undefined) return undefined
    return overviewObservations({ gap, analyses, actions, statuses: overviewStatuses(gap, analyses, actions) })
  }, [gap, analyses, actions])

  return (
    <PanelCard
      title={t("title")}
      icon={Target01Icon}
      help={{ label: tHelp("observationsLabel"), body: tHelp("observationsBody") }}
    >
      {rows === undefined ? (
        <ul className="divide-y">
          {Array.from({ length: 3 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
            <li key={index} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_1fr]">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y">
          {rows.slice(0, OBSERVATION_LIMIT).map((row) => {
            const text = texts(row)
            const key = row.kind === "none" ? "none" : `${row.kind}:${"groupKey" in row ? row.groupKey : "area" in row ? row.area : row.kind}`
            return (
              <li key={key} className="grid gap-1 py-3 text-sm sm:grid-cols-[10rem_1fr_1fr] sm:items-center">
                <span className={cn("flex items-center gap-1.5 font-medium", STATUS_CLASS[text.status])}>
                  <HugeiconsIcon icon={STATUS_ICON[text.status]} size={16} strokeWidth={2} aria-hidden="true" />
                  {text.status === "none" ? t("none") : t(text.status)}
                </span>
                <span className="min-w-0">
                  <Link href={text.href} aria-label={t("open", { label: text.subject })} className="truncate underline-offset-4 hover:underline">
                    {row.kind === "none" ? text.scope : text.subject}
                  </Link>
                  {row.kind !== "none" && row.kind !== "upperQuartile" && row.kind !== "praxisArea" && (
                    <span className="ms-2 text-muted-foreground tabular-nums">{text.scope}</span>
                  )}
                </span>
                <span className="text-muted-foreground">{text.next}</span>
              </li>
            )
          })}
        </ul>
      )}
    </PanelCard>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/components/pay-mapping` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview observations list`

---

### Task 13: The quartile chart moves; the pay-outcome panel

**Known defect to fix while moving the chart:** a quartile whose whole bar is one gender loses the rounded corner on the end the other gender would have occupied, because the corner radius is applied per segment on the assumption that both segments are present (women on the right, men on the left). A single-gender bar must round both of its own ends. Cover it in `quartile-stat.test.tsx` with a quartile of `{ women: 4, men: 0 }` and one of `{ women: 0, men: 4 }`.

**Files:**
- Create: `apps/dashboard/components/pay-mapping/quartile-stat.tsx`
- Test: `apps/dashboard/components/pay-mapping/quartile-stat.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx` (import `QuartileStat` from the new file; the local definition goes)
- Create: `apps/dashboard/components/pay-mapping/overview/overview-pay-outcome.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-pay-outcome.test.tsx`

**Interfaces:**
- Consumes: `QuartileStat` (moved verbatim: props `{ quartiles: GenderTally[] | undefined; animate?: boolean }`), `overviewKpis`, `PanelCard`, `WidgetCard`, keys `overview.outcome.*`, `overview.kpi.notMeasurable`, `overview.quartileTitle`, `help.payQuartiles*`.
- Produces: `QuartileStat` at `@/components/pay-mapping/quartile-stat`; `OverviewPayOutcome` (no props).

- [ ] **Step 1: Move `QuartileStat`**

Create `quartile-stat.tsx` with `"use client"`, the imports it needs (`ChartConfig`, `ChartTooltip` from `@workspace/ui/components/chart`; `Skeleton`; `useTranslations`; `Bar`, `BarChart`, `XAxis`, `YAxis` from `recharts`; `GenderHatch`, `GenderMenIcon`, `genderMarkBorder`, `GenderLegend`, `GenderTooltipContent`, `useGenderMarks` from `@/components/gender-mark`; `ChartCanvas`; `useWidgetExpanded`; `BAR_RADIUS`, `CHART_TOOLTIP_MOTION`; `type GenderTally` from `./pay-mapping-gap-types`) and the `QuartileStat` function cut VERBATIM from `pay-mapping-overview.tsx`, including its comment. In `pay-mapping-overview.tsx`, remove the moved function and import `QuartileStat` from `./quartile-stat` (the old overview keeps rendering it until Task 16).

The two-report plan's Task 11 rewrote `pay-mapping-report-export.tsx` without a capture host and deleted `pay-mapping-report-doc.tsx`, so no export code imports the chart components any more. Confirm: `grep -rn "WholeSurveyStat\|QuartileStat\|pay-mapping-overview\"" apps/dashboard --include='*.ts' --include='*.tsx' | grep -v node_modules` lists only `pay-mapping-overview.tsx`, its test, the run page and (after this step) `quartile-stat.tsx` and its test. If the grep finds a leftover capture host instead, delete its `data-chart="population"` block, the `population` members of its `captureData` state and `chartImages`, and the `captureHostChart(host, "population")` call, repoint its `QuartileStat` import to `./quartile-stat`, and repoint the matching `vi.mock("./pay-mapping-overview", ...)` in `pay-mapping-report-download.test.tsx` to `./quartile-stat` with only `QuartileStat` stubbed.

`quartile-stat.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { QuartileStat } from "./quartile-stat"

const m = en.dashboard.payMapping

afterEach(() => cleanup())

describe("QuartileStat", () => {
  it("renders the gender legend while loading and the four quartile labels once loaded", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <QuartileStat quartiles={undefined} />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(m.gap.columns.women)).toBeDefined()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <QuartileStat
          quartiles={[{ women: 2, men: 0 }, { women: 1, men: 1 }, { women: 0, men: 1 }, { women: 0, men: 1 }]}
          animate={false}
        />
      </NextIntlClientProvider>
    )
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
    expect(screen.getByText(m.gap.columns.men)).toBeDefined()
  })
})
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping && bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Write the failing pay-outcome test**

`overview-pay-outcome.test.tsx` (mocks and `renderWithRun` as in Task 11; `GAP` with `equalWork: [makeGapGroup({ key: "SWE|3", flag: "critical", womenCount: 3, menCount: 5 }), makeGapGroup({ key: "QA|3", flag: "elevated" })]`, one done analysis row for `QA|3`, actions `[]`):

```tsx
  it("shows the mean and median gap and the four counts", () => {
    renderWithRun({ gap: GAP, analyses: [doneQa], actions: [] })
    expect(screen.getByText(m.outcome.title)).toBeDefined()
    expect(screen.getByText(m.outcome.mean).nextSibling?.textContent).toBe("10%")
    expect(screen.getByText(m.outcome.median).nextSibling?.textContent).toBe("10%")
    // 1 of 2 duties done, 1 remaining, 1 risk group (SWE open), 3 affected.
    expect(screen.getByText(m.outcome.analysed).nextSibling?.textContent).toBe("1 of 2")
    expect(screen.getByText(m.outcome.remaining).nextSibling?.textContent).toBe("1")
    expect(screen.getByText(m.outcome.riskGroups).nextSibling?.textContent).toBe("1")
    expect(screen.getByText(m.outcome.affected).nextSibling?.textContent).toBe("3")
  })

  it("says not measurable when the org gap is insufficient", () => {
    renderWithRun({ gap: makeGapResult({ org: { ...GAP.org, gapPct: null, medianGapPct: null, flag: "insufficient" } }), analyses: [], actions: [] })
    expect(screen.getAllByText(m.kpi.notMeasurable)).toHaveLength(2)
  })

  it("renders the quartile chart card beside the panel, expandable", () => {
    renderWithRun({ gap: GAP, analyses: [], actions: [] })
    expect(screen.getByText(m.quartileTitle)).toBeDefined()
    expect(screen.getByRole("button", { name: en.dashboard.widgetCard.expand })).toBeDefined()
  })

  it("keeps both titles real and shows bars while loading", () => {
    renderWithRun({ gap: undefined, analyses: undefined, actions: undefined })
    expect(screen.getByText(m.outcome.title)).toBeDefined()
    expect(screen.getByText(m.quartileTitle)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(6)
  })
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-pay-outcome.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the panel**

`overview-pay-outcome.tsx`:

```tsx
"use client"

import { ChartAverageIcon } from "@hugeicons/core-free-icons"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useMemo } from "react"
import { PanelCard } from "@/components/panel-card"
import { WidgetCard } from "@/components/widget-card"
import { overviewKpis } from "@/lib/pay-mapping-overview/kpis"
import { overviewStatuses } from "@/lib/pay-mapping-overview/statuses"
import { percentText } from "@/lib/percent"
import { usePayMappingRun } from "../pay-mapping-run-context"
import { QuartileStat } from "../quartile-stat"

// One labelled figure of the outcome grid. The value follows its label in
// the DOM (dt, dd), which is what the tests read.
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-semibold text-lg tabular-nums">{value}</dd>
    </div>
  )
}

// The total gap as mean and median, then counts (never a fabricated
// "unexplained %"), beside the quartile chart, unchanged.
export function OverviewPayOutcome() {
  const t = useTranslations("dashboard.payMapping.overview.outcome")
  const tKpi = useTranslations("dashboard.payMapping.overview.kpi")
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const { run, gap, analyses, actions } = usePayMappingRun()
  const kpis = useMemo(() => {
    if (run === undefined || gap === undefined || analyses === undefined || actions === undefined) return undefined
    return overviewKpis({ gap, analyses, actions, run, statuses: overviewStatuses(gap, analyses, actions) })
  }, [run, gap, analyses, actions])
  const pct = (value: number | null) =>
    value === null ? (
      <span className="font-normal text-base text-muted-foreground">{tKpi("notMeasurable")}</span>
    ) : (
      percentText(value, format)
    )
  const bar = <Skeleton className="h-6 w-16" />

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PanelCard title={t("title")} icon={ChartAverageIcon}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label={t("mean")} value={kpis === undefined ? bar : pct(kpis.totalGap.meanPct)} />
          <Stat label={t("median")} value={kpis === undefined ? bar : pct(kpis.totalGap.medianPct)} />
          <Stat
            label={t("analysed")}
            value={
              kpis === undefined
                ? bar
                : t("ofTotal", { done: kpis.remaining.total - kpis.remaining.open, total: kpis.remaining.total })
            }
          />
          <Stat label={t("remaining")} value={kpis === undefined ? bar : kpis.remaining.open} />
          <Stat label={t("riskGroups")} value={kpis === undefined ? bar : kpis.risk.groups} />
          <Stat label={t("affected")} value={kpis === undefined ? bar : kpis.risk.affected} />
        </dl>
      </PanelCard>
      <WidgetCard
        className="md:col-span-2"
        title={tOverview("quartileTitle")}
        help={{ label: tHelp("payQuartilesLabel"), body: tHelp("payQuartilesBody") }}
        expandable
      >
        <QuartileStat quartiles={gap?.quartiles} />
      </WidgetCard>
    </div>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/components/pay-mapping` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): pay-outcome panel beside the quartile chart, quartile chart in its own module`

---

### Task 14: The group table

**Files:**
- Create: `apps/dashboard/components/pay-mapping/overview/overview-group-table.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-group-table.test.tsx`

**Interfaces:**
- Consumes: `overviewEqualWorkRows`, `overviewEquivalentWorkRows` (Task 5); `referenceColumns`, `rowValueMap` (Task 7); `overviewStatuses`; `analysisStepHref`; `FrameTable`, `FrameTableFooter`, `TablePagination`, `TableSortButton`, `ariaSort`, `TableSkeleton`; TanStack v9 (`useTable`, `tableFeatures`, `columnFilteringFeature`, `rowSortingFeature`, `rowPaginationFeature`, `createFilteredRowModel`, `createSortedRowModel`, `createPaginatedRowModel`, `createColumnHelper`, the same imports `people-section.tsx` uses); `ToggleGroup`, `ToggleGroupItem`, `Select`; `useMoney`; `signedPercentText`; keys `overview.groupTable.*`, `payMapping.analysisStatus.*`, `payMapping.gap.levelLabel`, `payMapping.toolbar.previous/next`, `help.overviewMasking*`.
- Produces: `OverviewGroupTable` (no props); `PAGE_SIZE = 25` (module constant, shared by the pager and the skeleton).

- [ ] **Step 1: Write the failing test**

`overview-group-table.test.tsx` (mocks as in Task 11, the NumberFlow stand-in included because the frame's count chip is a NumberFlow; `pickSelectOption` from `@/test/select`; `renderTable({ gap, analyses, actions, reference })` wraps the provider with `slug: "pay-2026"`, `run: makeRunDetail()`, `runsList: []`):

```tsx
const GAP = makeGapResult({
  equalWork: [
    makeGapGroup({ key: "SWE|3", roleTitle: "SWE", level: 3, flag: "critical", womenCount: 3, menCount: 5, metric: { gapPct: 12 } }),
    makeGapGroup({ key: "QA|3", roleTitle: "QA", level: 3, flag: "elevated", womenCount: 1, menCount: 3, metric: { gapPct: 6 } }),
    makeGapGroup({ key: "Ops|4", roleTitle: "Ops", level: 4, flag: "ok", womenCount: 2, menCount: 2, metric: { gapPct: 2 } }),
  ],
  womenDominated: [
    {
      key: "Nurse|2", roleTitle: "Nurse", seniority: null, level: 2, headcount: 5, womenSharePct: 80, meanComp: 40000,
      comparisons: [{ key: "Support|3", roleTitle: "Support", seniority: null, level: 3, headcount: 4, womenSharePct: 25, meanComp: 41480, diffPct: 3.7, diffSek: 1480 }],
    },
  ],
})

describe("OverviewGroupTable", () => {
  it("sorts equal-work groups by largest absolute gap, signed negative when women earn less", () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((row) => row.textContent?.slice(0, 3))).toEqual(["SWE", "QA ", "Ops"])
    expect(rows[0]?.textContent).toContain("-12%")
  })

  it("masks the medians of a group under the thresholds and keeps its counts, gap and status", () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    const qa = screen.getAllByRole("row")[2]
    expect(qa?.textContent).toContain(m.groupTable.masked)
    expect(qa?.textContent).toContain("-6%")
    expect(qa?.textContent).toContain(en.dashboard.payMapping.analysisStatus.furtherAnalysis)
    // The unmasked SWE row prints money for both medians.
    expect(screen.getAllByRole("row")[1]?.querySelectorAll("td")[3]?.textContent).toMatch(/90/)
  })

  it("filters by status with a result count", async () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    // The pick is the LAST gesture of the test: happy-dom leaves the picked
    // select's popup open and it swallows the next click (test/select.ts).
    await pickSelectOption(
      screen.getByRole("combobox", { name: m.groupTable.statusFilterLabel }),
      en.dashboard.payMapping.analysisStatus.noActionNeeded
    )
    expect(screen.getByText("1 of 3 groups")).toBeDefined()
  })

  it("switches to equivalent work", () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    fireEvent.click(screen.getByRole("button", { name: m.groupTable.equivalentWork }))
    expect(screen.getByText("Nurse · Level 2")).toBeDefined()
    expect(screen.getByText("Support · Level 3")).toBeDefined()
    expect(screen.getByText("3.7%")).toBeDefined()
  })

  it("links each group to its analysis step", () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    expect(
      screen.getByRole("link", { name: "Open SWE · Level 3 in the analysis" }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026/analysis/equal-work?step=equalWork:SWE%7C3")
  })

  it("adds Reference and Change columns under a reference and marks a new group", () => {
    const reference: PayMappingReference = {
      run: makeRunSummary({ label: "September 2025" }),
      gap: makeGapResult({ equalWork: [makeGapGroup({ key: "SWE|3", roleTitle: "SWE", level: 3, womenCount: 3, menCount: 5, metric: { gapPct: 14 } })] }),
      analyses: [],
      actions: [],
    }
    renderTable({ gap: GAP, analyses: [], actions: [], reference })
    expect(screen.getByText(m.groupTable.columns.reference)).toBeDefined()
    const swe = screen.getAllByRole("row")[1]
    expect(swe?.textContent).toContain("-14%")
    expect(swe?.textContent).toContain("+2")
    expect(screen.getAllByRole("row")[2]?.textContent).toContain(m.groupTable.new)
  })

  it("shows no reference columns without a reference", () => {
    renderTable({ gap: GAP, analyses: [], actions: [] })
    expect(screen.queryByText(m.groupTable.columns.reference)).toBeNull()
  })

  it("renders the toggle, the filter and a full skeleton page while loading", () => {
    renderTable({ gap: undefined, analyses: undefined, actions: undefined })
    expect(screen.getByRole("button", { name: m.groupTable.equalWork })).toBeDefined()
    expect(screen.getByRole("combobox", { name: m.groupTable.statusFilterLabel })).toBeDefined()
    expect(screen.getAllByRole("row")).toHaveLength(26)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-group-table.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the table**

`overview-group-table.tsx`:

```tsx
"use client"

import type { AnalysisStatus } from "@/components/pay-mapping/analysis-status"
import { ANALYSIS_STATUSES } from "@/components/pay-mapping/analysis-status"
import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState } from "react"
import { FrameTable, FrameTableFooter, TablePagination } from "@/components/frame-table"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TableSkeleton, type TableSkeletonColumn } from "@/components/table-skeleton"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import { useMoney } from "@/hooks/use-money"
import { referenceColumns, type ReferenceColumns, rowValueMap } from "@/lib/pay-mapping-overview/comparison"
import { overviewEqualWorkRows, overviewEquivalentWorkRows } from "@/lib/pay-mapping-overview/group-rows"
import { overviewStatuses } from "@/lib/pay-mapping-overview/statuses"
import { onSelectValue } from "@/lib/select"
import { percentText, signedPercentText } from "@/lib/percent"
import { analysisStepHref } from "../analysis-chapters"
import {
  type GroupAnalysis,
  groupLabel,
  type PayMappingActionWire,
  type PayMappingGapResult,
} from "../pay-mapping-gap-types"
import { usePayMappingRun } from "../pay-mapping-run-context"

// One shared constant sizes the pager AND the loading skeleton.
const PAGE_SIZE = 25

type View = "equalWork" | "equivalentWork"

// One normalized row for both views, so a single table instance carries
// the sort/filter/pagination state and the view switch only swaps the
// data and the columns drawn. valuePct is the signed display gap (equal
// work) or the largest comparison's difference (equivalent work).
interface OverviewTableRow {
  key: string
  view: View
  label: string
  womenCount: number
  menCount: number
  headcount: number
  womenSharePct: number | null
  masked: boolean
  womenMedian: number | null
  menMedian: number | null
  valuePct: number | null
  magnitude: number
  comparisonLabel: string | null
  otherComparisons: number
  status: AnalysisStatus
  href: string
  reference: ReferenceColumns | null
}

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})
type Features = typeof features

const columnHelper = createColumnHelper<Features, OverviewTableRow>()
const columns = columnHelper.columns([
  columnHelper.accessor("label", { id: "label" }),
  columnHelper.accessor("womenCount", { id: "women" }),
  columnHelper.accessor("menCount", { id: "men" }),
  columnHelper.accessor("headcount", { id: "headcount" }),
  columnHelper.accessor("magnitude", { id: "magnitude" }),
  columnHelper.accessor("status", {
    id: "status",
    filterFn: (row, columnId, value: string) => row.getValue<string>(columnId) === value,
  }),
])

const DEFAULT_SORT: SortingState = [{ id: "magnitude", desc: true }]

function buildRows(input: {
  view: View
  slug: string
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  reference: { gap: PayMappingGapResult; analyses: GroupAnalysis[]; actions: PayMappingActionWire[] } | null
  levelLabel: (level: number) => string
}): OverviewTableRow[] {
  const { view, slug, gap, analyses, actions, reference, levelLabel } = input
  const label = (roleTitle: string | null, level: number | null) =>
    [groupLabel({ roleTitle, seniority: null }), level === null ? null : levelLabel(level)]
      .filter((part) => part !== null && part !== "")
      .join(" · ")
  const statuses = overviewStatuses(gap, analyses, actions)
  if (view === "equalWork") {
    const referenceValues =
      reference === null
        ? null
        : rowValueMap(
            overviewEqualWorkRows(reference.gap, overviewStatuses(reference.gap, reference.analyses, reference.actions)),
            (row) => row.gapPct
          )
    return overviewEqualWorkRows(gap, statuses).map((row) => ({
      key: row.key,
      view,
      label: label(row.roleTitle, row.level),
      womenCount: row.womenCount,
      menCount: row.menCount,
      headcount: row.womenCount + row.menCount,
      womenSharePct: null,
      masked: row.masked,
      womenMedian: row.womenMedian,
      menMedian: row.menMedian,
      valuePct: row.gapPct,
      magnitude: row.gapPct === null ? -1 : Math.abs(row.gapPct),
      comparisonLabel: null,
      otherComparisons: 0,
      status: row.status,
      href: analysisStepHref(slug, "equalWork", row.key),
      reference: referenceValues === null ? null : referenceColumns(row.key, row.gapPct, referenceValues),
    }))
  }
  const referenceValues =
    reference === null
      ? null
      : rowValueMap(
          overviewEquivalentWorkRows(reference.gap, overviewStatuses(reference.gap, reference.analyses, reference.actions)),
          (row) => row.comparison?.diffPct ?? null
        )
  return overviewEquivalentWorkRows(gap, statuses).map((row) => ({
    key: row.key,
    view,
    label: label(row.roleTitle, row.level),
    womenCount: 0,
    menCount: 0,
    headcount: row.headcount,
    womenSharePct: row.womenSharePct,
    masked: false,
    womenMedian: null,
    menMedian: null,
    valuePct: row.comparison?.diffPct ?? null,
    magnitude: row.comparison?.diffPct ?? -1,
    comparisonLabel: row.comparison === null ? null : label(row.comparison.roleTitle, row.comparison.level),
    otherComparisons: row.otherComparisons,
    status: row.status,
    href: analysisStepHref(slug, "equivalentWork", row.key),
    reference: referenceValues === null ? null : referenceColumns(row.key, row.comparison?.diffPct ?? null, referenceValues),
  }))
}

// The status as a text badge: the four analysis statuses, secondary tint,
// never a colour alone.
function StatusBadge({ status }: { status: AnalysisStatus }) {
  const t = useTranslations("dashboard.payMapping.analysisStatus")
  return (
    <div className="flex items-center">
      <Badge variant="secondary">{t(status)}</Badge>
    </div>
  )
}

export function OverviewGroupTable() {
  const t = useTranslations("dashboard.payMapping.overview.groupTable")
  const tStatus = useTranslations("dashboard.payMapping.analysisStatus")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const money = useMoney()
  const { slug, gap, analyses, actions, reference } = usePayMappingRun()
  const currency = gap?.currency ?? ""

  const [view, setView] = useState<View>("equalWork")
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT)
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | "all">("all")
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE })

  const loading = gap === undefined || analyses === undefined || actions === undefined
  // The reference's rows join only once all three of its subscriptions
  // have landed; until then the two extra columns show bars.
  const referenceLoaded =
    reference !== null && reference.gap !== undefined && reference.analyses !== undefined && reference.actions !== undefined
  const rows = useMemo(() => {
    if (gap === undefined || analyses === undefined || actions === undefined) return []
    return buildRows({
      view,
      slug,
      gap,
      analyses,
      actions,
      reference:
        reference !== null && reference.gap !== undefined && reference.analyses !== undefined && reference.actions !== undefined
          ? { gap: reference.gap, analyses: reference.analyses, actions: reference.actions }
          : null,
      levelLabel: (level) => tGap("levelLabel", { level }),
    })
  }, [view, slug, gap, analyses, actions, reference, tGap])

  const table = useTable({
    features,
    data: rows,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters: statusFilter === "all" ? [] : [{ id: "status", value: statusFilter }],
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    enableSortingRemoval: false,
  })
  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()
  const resetPage = () => setPagination((state) => ({ ...state, pageIndex: 0 }))

  function switchView(next: View) {
    setView(next)
    setSorting(DEFAULT_SORT)
    setStatusFilter("all")
    resetPage()
  }

  function sortableHead(id: string, label: string, widthClass?: string) {
    const column = table.getColumn(id)
    const sorted = column?.getIsSorted() ?? false
    return (
      <TableHead className={widthClass} aria-sort={ariaSort(sorted)}>
        <TableSortButton
          label={label}
          sorted={sorted}
          onToggle={() => {
            column?.toggleSorting(sorted === "asc")
            resetPage()
          }}
        />
      </TableHead>
    )
  }

  // Fixed widths, declared once here for both states (table-fixed).
  const showReference = reference !== null
  const header = (
    <TableHeader>
      <TableRow>
        {sortableHead("label", t("columns.group"))}
        {view === "equalWork" ? (
          <>
            {sortableHead("women", t("columns.women"), "w-20")}
            {sortableHead("men", t("columns.men"), "w-20")}
            <TableHead className="w-32">{t("columns.medianWomen")}</TableHead>
            <TableHead className="w-32">{t("columns.medianMen")}</TableHead>
            {sortableHead("magnitude", t("columns.gap"), "w-24")}
          </>
        ) : (
          <>
            {sortableHead("headcount", t("columns.headcount"), "w-32")}
            <TableHead className="w-[24%]">{t("columns.comparison")}</TableHead>
            {sortableHead("magnitude", t("columns.diff"), "w-24")}
          </>
        )}
        {showReference && (
          <>
            <TableHead className="w-24">{t("columns.reference")}</TableHead>
            <TableHead className="w-24">{t("columns.change")}</TableHead>
          </>
        )}
        {sortableHead("status", t("columns.status"), "w-40")}
      </TableRow>
    </TableHeader>
  )
  const skeletonColumns: TableSkeletonColumn[] = [
    { className: "w-40" },
    ...(view === "equalWork"
      ? [{ className: "w-8" }, { className: "w-8" }, { className: "w-20" }, { className: "w-20" }, { className: "w-12" }]
      : [{ className: "w-20" }, { className: "w-32" }, { className: "w-12" }]),
    ...(showReference ? [{ className: "w-12" }, { className: "w-12" }] : []),
    { className: "h-5 w-24 rounded-full" },
  ]

  const pctCell = (value: number | null) => (value === null ? "" : signedPercentText(value, format))
  const moneyCell = (value: number | null, masked: boolean) =>
    masked ? <span className="text-muted-foreground">{t("masked")}</span> : value === null ? "" : money(value, currency)
  const referenceCells = (row: OverviewTableRow) =>
    !showReference ? null : !referenceLoaded || row.reference === null ? (
      <>
        <TableCell><div className="flex min-h-5 items-center"><span className="h-4 w-12 animate-pulse rounded-md bg-muted" data-slot="skeleton" /></div></TableCell>
        <TableCell><div className="flex min-h-5 items-center"><span className="h-4 w-12 animate-pulse rounded-md bg-muted" data-slot="skeleton" /></div></TableCell>
      </>
    ) : (
      <>
        <TableCell className="tabular-nums">{row.reference.isNew ? <span className="text-muted-foreground">{t("new")}</span> : pctCell(row.reference.referenceValue)}</TableCell>
        <TableCell className="tabular-nums">
          {row.reference.changePoints === null ? "" : format.number(row.reference.changePoints, { maximumFractionDigits: 1, signDisplay: "exceptZero" })}
        </TableCell>
      </>
    )

  const toggle = (
    <ToggleGroup
      variant="outline"
      aria-label={t("viewLabel")}
      value={[view]}
      onValueChange={(value) => {
        const next = value[0]
        if (next === "equalWork" || next === "equivalentWork") switchView(next)
      }}
    >
      <ToggleGroupItem value="equalWork">{t("equalWork")}</ToggleGroupItem>
      <ToggleGroupItem value="equivalentWork">{t("equivalentWork")}</ToggleGroupItem>
    </ToggleGroup>
  )
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={{ all: t("statusAll"), ...Object.fromEntries(ANALYSIS_STATUSES.map((status) => [status, tStatus(status)])) }}
        value={statusFilter}
        onValueChange={onSelectValue((next: string) => {
          setStatusFilter(next === "all" ? "all" : (next as AnalysisStatus))
          resetPage()
        })}
      >
        <SelectTrigger size="sm" className="w-48" aria-label={t("statusFilterLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("statusAll")}</SelectItem>
          {ANALYSIS_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>{tStatus(status)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {statusFilter !== "all" && (
        <span className="ml-auto text-muted-foreground text-sm tabular-nums">
          {t("resultCount", { shown, total: rows.length })}
        </span>
      )}
    </div>
  )

  return (
    <FrameTable
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {t("title")}
          <HelpMorphButton label={tHelp("overviewMaskingLabel")}>{tHelp("overviewMaskingBody")}</HelpMorphButton>
        </span>
      }
      count={loading ? undefined : shown}
      toolbar={toggle}
      filters={filters}
      footer={
        loading || pageCount <= 1 ? undefined : (
          <FrameTableFooter
            page={pagination.pageIndex}
            pageSize={pagination.pageSize}
            total={shown}
            pager={
              <TablePagination
                page={pagination.pageIndex}
                pageCount={pageCount}
                hasMore={false}
                canPrev={table.getCanPreviousPage()}
                canNext={table.getCanNextPage()}
                onPrev={() => table.previousPage()}
                onNext={() => table.nextPage()}
                onSelect={(page0) => table.setPageIndex(page0)}
                previousLabel={tToolbar("previous")}
                nextLabel={tToolbar("next")}
              />
            }
          />
        )
      }
    >
      <Table className="table-fixed">
        {header}
        {loading ? (
          <TableSkeleton rows={PAGE_SIZE} columns={skeletonColumns} />
        ) : (
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={skeletonColumns.length} className="text-muted-foreground">
                  {rows.length === 0 ? t("empty") : t("noMatches")}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.key}>
                  {/* The group cell is the row's link (the people register's
                      idiom): a real anchor, reachable by keyboard, never a
                      click handler on the row. */}
                  <TableCell className="truncate font-medium">
                    <Link
                      href={row.href}
                      aria-label={t("openRow", { label: row.label })}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.label}
                    </Link>
                  </TableCell>
                  {row.view === "equalWork" ? (
                    <>
                      <TableCell className="tabular-nums">{row.womenCount}</TableCell>
                      <TableCell className="tabular-nums">{row.menCount}</TableCell>
                      <TableCell className="tabular-nums">{moneyCell(row.womenMedian, row.masked)}</TableCell>
                      <TableCell className="tabular-nums">{moneyCell(row.menMedian, row.masked)}</TableCell>
                      <TableCell className="tabular-nums">{pctCell(row.valuePct)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="tabular-nums">
                        {row.headcount}
                        {row.womenSharePct !== null && (
                          <span className="ms-2 text-muted-foreground">
                            {t("womenShare", { share: format.number(row.womenSharePct / 100, { style: "percent", maximumFractionDigits: 0 }) })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="truncate">
                        {row.comparisonLabel ?? ""}
                        {row.otherComparisons > 0 && (
                          <span className="ms-2 text-muted-foreground">{t("otherComparisons", { count: row.otherComparisons })}</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{row.valuePct === null ? "" : percentText(row.valuePct, format)}</TableCell>
                    </>
                  )}
                  {referenceCells(row)}
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        )}
      </Table>
    </FrameTable>
  )
}
```

The two inline skeleton spans in `referenceCells` mirror `Skeleton`'s markup; replace them with `<Skeleton className="h-4 w-12" />` from `@workspace/ui/components/skeleton` (imported) so `data-slot="skeleton"` comes from the vendor component, not a copy.

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-group-table.test.tsx && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/components/pay-mapping/overview` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview group table with masking, status filter and reference columns`

---

### Task 15: The action-plan block with the follow-up date

**Files:**
- Create: `apps/dashboard/lib/iso-date.ts`
- Test: `apps/dashboard/lib/iso-date.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/action-dialog.tsx` (import the two helpers instead of defining them)
- Create: `apps/dashboard/components/pay-mapping/overview/overview-action-plan.tsx`
- Test: `apps/dashboard/components/pay-mapping/overview/overview-action-plan.test.tsx`

**Interfaces:**
- Consumes: `overviewActionPlan`, `PROCESS_STEPS` (Task 6); `overviewKpis` (for `remaining.open`); `overviewDeltas` (Task 7); `DatePicker`; `useMutation(api.payMapping.runs.setPayMappingFollowUpDate)`; `toast`; `useOrganization`; `PanelCard` with `help`; `NumberFlow`; `useMoney`; keys `overview.actionPlan.*`, `overview.delta.*`, `payMapping.actions.status.*`, `toast.payMappingFollowUpDateSaved`, `help.followUpDate*`, `help.process*`.
- Produces: `isoToMs(iso: string): number`, `msToIso(ms: number): string` in `@/lib/iso-date`; `OverviewActionPlan` (no props); `FollowUpDateControl` (module-private).

- [ ] **Step 1: Lift the ISO helpers**

`apps/dashboard/lib/iso-date.ts`:

```ts
// A day-precision date crosses the wire as epoch ms at UTC midnight; the
// DatePicker speaks ISO YYYY-MM-DD. These two are the only conversions.
export function isoToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`)
}

export function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
```

`iso-date.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isoToMs, msToIso } from "./iso-date"

describe("iso-date", () => {
  it("round-trips a day through UTC midnight", () => {
    expect(isoToMs("2027-03-01")).toBe(Date.UTC(2027, 2, 1))
    expect(msToIso(Date.UTC(2027, 2, 1))).toBe("2027-03-01")
  })
})
```

In `action-dialog.tsx`, delete the local `isoToMs` and `msToIso` functions and add `import { isoToMs, msToIso } from "@/lib/iso-date"`. Run `cd apps/dashboard && bunx vitest run lib/iso-date.test.ts components/pay-mapping/action-dialog.test.tsx` (PASS).

`DatePicker` takes `disabled?: boolean` since the two-report plan's Task 14. If it does not (`grep -n "disabled" apps/dashboard/components/date-picker.tsx` prints nothing), add it exactly as that plan states: a `disabled = false` prop, `disabled={disabled}` on the trigger `Button` inside `PopoverTrigger`'s `render` (next to `aria-label={ariaLabel}`), and `open={open && !disabled}` on the `Popover`, so a disabled trigger can never leave a popover open; every existing call site keeps compiling.

- [ ] **Step 2: Write the failing component test**

`overview-action-plan.test.tsx` (mocks as in Task 11, the NumberFlow stand-in included, plus `vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))` and `vi.mock("@/components/org-context", () => ({ useOrganization: () => ({ orgId: "org-1", role: "admin" }) }))`; `const setFollowUp = mockMutation("payMapping.runs.setPayMappingFollowUpDate")`; `renderPlan({ run, gap, analyses, actions, runsList, reference })` wraps the provider with `slug: "pay-2026"`; `makeAction` comes from `@/test/pay-mapping-fixtures`):

```tsx
const ACTIONS = [
  makeAction({ status: "done", estimatedCost: 5000, estimatedCostUnit: "perYear" }),
  makeAction({ actionId: "a2" as PayMappingActionWire["actionId"], status: "inProgress", estimatedCost: 1000, estimatedCostUnit: "perMonth" }),
  makeAction({ actionId: "a3" as PayMappingActionWire["actionId"], status: "notStarted", estimatedCost: 20000, estimatedCostUnit: "oneOff" }),
  makeAction({ actionId: "a4" as PayMappingActionWire["actionId"] }),
]

describe("OverviewActionPlan", () => {
  it("shows the status counts, the cost table and the uncosted line", () => {
    renderPlan({ run: makeRunDetail(), gap: makeGapResult(), analyses: [], actions: ACTIONS, runsList: [] })
    expect(screen.getByText(en.dashboard.payMapping.actions.status.notStarted).nextSibling?.textContent).toBe("2")
    expect(screen.getByText(en.dashboard.payMapping.actions.status.inProgress).nextSibling?.textContent).toBe("1")
    expect(screen.getByText(en.dashboard.payMapping.actions.status.done).nextSibling?.textContent).toBe("1")
    expect(screen.getByText(m.actionPlan.annual).nextSibling?.textContent).toMatch(/17[\s,.]?000/)
    expect(screen.getByText(m.actionPlan.oneOff).nextSibling?.textContent).toMatch(/20[\s,.]?000/)
    expect(screen.getByText(m.actionPlan.firstYear).nextSibling?.textContent).toMatch(/37[\s,.]?000/)
    expect(screen.getByText("Cost not estimated: 1 action")).toBeDefined()
  })

  it("renders the five process steps with their state words", () => {
    renderPlan({ run: makeRunDetail({ status: "completed" }), gap: makeGapResult(), analyses: [], actions: ACTIONS, runsList: [] })
    const items = screen.getAllByRole("listitem")
    expect(items.map((item) => item.textContent)).toEqual([
      `${m.actionPlan.steps.mappingDone}${m.actionPlan.state.done}`,
      `${m.actionPlan.steps.analysisDone}${m.actionPlan.state.done}`,
      `${m.actionPlan.steps.planDecided}${m.actionPlan.state.done}`,
      `${m.actionPlan.steps.implementing}${m.actionPlan.state.done}`,
      `${m.actionPlan.steps.followUp}${m.actionPlan.state.current}`,
    ])
  })

  it("saves the follow-up date through the mutation with a toast, disabled while saving", async () => {
    let resolve: () => void = () => {}
    setFollowUp.mockImplementation(() => new Promise<void>((r) => { resolve = r }))
    renderPlan({ run: makeRunDetail({ status: "completed" }), gap: makeGapResult(), analyses: [], actions: [], runsList: [] })
    const picker = screen.getByRole("button", { name: m.actionPlan.followUp })
    // Open the calendar and click day 15 of the displayed month: only the
    // current month's 15th is on the grid (outside days pad the edge weeks).
    fireEvent.click(picker)
    const dayButton = await waitFor(() => {
      const button = screen
        .getAllByRole("button")
        .find((candidate) => candidate.textContent === "15")
      expect(button).toBeDefined()
      return button as HTMLElement
    })
    fireEvent.click(dayButton)
    expect(setFollowUp).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", runId: "run-1", followUpDate: expect.any(Number) }))
    await waitFor(() => expect(picker.hasAttribute("disabled")).toBe(true))
    resolve()
    await waitFor(() => expect(picker.hasAttribute("disabled")).toBe(false))
    expect(toast.success).toHaveBeenCalledWith(en.dashboard.toast.payMappingFollowUpDateSaved)
  })

  it("shows the done delta under a reference and nothing without one", () => {
    renderPlan({ run: makeRunDetail(), gap: makeGapResult(), analyses: [], actions: ACTIONS, runsList: [] })
    expect(screen.queryByText(/than /)).toBeNull()
    cleanup()
    renderPlan({
      run: makeRunDetail(), gap: makeGapResult(), analyses: [], actions: ACTIONS, runsList: [],
      reference: { run: makeRunSummary({ label: "September 2025" }), gap: makeGapResult(), analyses: [], actions: [] },
    })
    expect(screen.getByText("1 more action done than September 2025")).toBeDefined()
  })

  it("keeps the title, the labels and the picker real while loading", () => {
    renderPlan({ run: undefined, gap: undefined, analyses: undefined, actions: undefined, runsList: undefined })
    expect(screen.getByText(m.actionPlan.title)).toBeDefined()
    expect(screen.getByText(m.actionPlan.annual)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(6)
  })
})
```

(`toast` is imported from `@/lib/toast` after the mock; `waitFor` from `@testing-library/react`.)

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/overview/overview-action-plan.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the block**

`overview-action-plan.tsx`:

```tsx
"use client"

import {
  ArrowDownRight01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  CircleIcon,
  Flowchart01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useMemo, useState } from "react"
import { DatePicker } from "@/components/date-picker"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PanelCard } from "@/components/panel-card"
import { useMoney } from "@/hooks/use-money"
import { useNumberFlowCurrencyFormat } from "@/hooks/use-number-flow-currency-format"
import { isoToMs, msToIso } from "@/lib/iso-date"
import { overviewActionPlan, type ProcessStepState } from "@/lib/pay-mapping-overview/action-plan"
import { overviewDeltas } from "@/lib/pay-mapping-overview/comparison"
import { overviewKpis } from "@/lib/pay-mapping-overview/kpis"
import { overviewStatuses } from "@/lib/pay-mapping-overview/statuses"
import { toast } from "@/lib/toast"
import { usePayMappingRun } from "../pay-mapping-run-context"

const STEP_ICON: Record<ProcessStepState, IconSvgElement> = {
  done: Tick02Icon,
  current: ArrowRight01Icon,
  upcoming: CircleIcon,
}

// The next decision point: a DatePicker inline, editable by every member
// and after completion (the plan runs over years), saved on pick with a
// toast; disabled while the save is in flight. The audit row is written
// by the mutation.
function FollowUpDateControl({ runId, value }: { runId: Id<"payMappingRuns">; value: number | null }) {
  const t = useTranslations("dashboard.payMapping.overview.actionPlan")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const setFollowUpDate = useMutation(api.payMapping.runs.setPayMappingFollowUpDate)
  const [saving, setSaving] = useState(false)

  async function handleChange(iso: string) {
    const next = iso === "" ? null : isoToMs(iso)
    if (next === value) return
    setSaving(true)
    try {
      await setFollowUpDate({ orgId, runId, followUpDate: next })
      toast.success(tToast("payMappingFollowUpDateSaved"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        {t("followUp")}
        <HelpMorphButton label={tHelp("followUpDateLabel")}>{tHelp("followUpDateBody")}</HelpMorphButton>
      </div>
      <DatePicker
        value={value === null ? "" : msToIso(value)}
        onChange={(iso) => void handleChange(iso)}
        ariaLabel={t("followUp")}
        disabled={saving}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function OverviewActionPlan() {
  const t = useTranslations("dashboard.payMapping.overview.actionPlan")
  const tDelta = useTranslations("dashboard.payMapping.overview.delta")
  const tStatus = useTranslations("dashboard.payMapping.actions.status")
  const tHelp = useTranslations("dashboard.help")
  const money = useMoney()
  const { run, gap, analyses, actions, runsList, reference } = usePayMappingRun()
  const currency = gap?.currency ?? null
  const costFormat = useNumberFlowCurrencyFormat(currency)

  const plan = useMemo(() => {
    if (run === undefined || gap === undefined || analyses === undefined || actions === undefined || runsList === undefined) return undefined
    const statuses = overviewStatuses(gap, analyses, actions)
    const kpis = overviewKpis({ gap, analyses, actions, run, statuses })
    return {
      kpis,
      plan: overviewActionPlan({ actions, run, runs: runsList, remainingOpen: kpis.remaining.open }),
    }
  }, [run, gap, analyses, actions, runsList])
  const doneDelta = useMemo(() => {
    if (plan === undefined || reference === null || reference.gap === undefined || reference.analyses === undefined || reference.actions === undefined) return undefined
    const { gap: refGap, analyses: refAnalyses, actions: refActions } = reference
    const referenceKpis = overviewKpis({ gap: refGap, analyses: refAnalyses, actions: refActions, run: reference.run, statuses: overviewStatuses(refGap, refAnalyses, refActions) })
    return overviewDeltas(plan.kpis, referenceKpis).actionsDone
  }, [plan, reference])

  const bar = <Skeleton className="h-4 w-12" />
  const amount = (value: number) =>
    costFormat === null || currency === null ? money(value, currency ?? "") : <NumberFlow value={value} format={costFormat} />

  return (
    <PanelCard title={t("title")} icon={Flowchart01Icon}>
      <div className="grid gap-6 md:grid-cols-3">
        <dl className="space-y-2">
          <Row label={tStatus("notStarted")} value={plan === undefined ? bar : <NumberFlow value={plan.plan.counts.notStarted} />} />
          <Row label={tStatus("inProgress")} value={plan === undefined ? bar : <NumberFlow value={plan.plan.counts.inProgress} />} />
          <Row label={tStatus("done")} value={plan === undefined ? bar : <NumberFlow value={plan.plan.counts.done} />} />
          {reference !== null && (
            <div className="flex items-center gap-1.5 pt-1 font-medium text-sm">
              {doneDelta === undefined ? (
                <Skeleton className="h-4 w-36" />
              ) : (
                <>
                  <span>
                    {doneDelta === 0
                      ? tDelta("unchanged", { label: reference.run.label })
                      : tDelta(doneDelta < 0 ? "fewerDone" : "moreDone", { count: Math.abs(doneDelta), label: reference.run.label })}
                  </span>
                  {doneDelta !== 0 && (
                    <HugeiconsIcon icon={doneDelta < 0 ? ArrowDownRight01Icon : ArrowUpRight01Icon} size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </>
              )}
            </div>
          )}
        </dl>
        <dl className="space-y-2">
          <Row label={t("annual")} value={plan === undefined ? bar : amount(plan.plan.cost.annual)} />
          <Row label={t("oneOff")} value={plan === undefined ? bar : amount(plan.plan.cost.oneOff)} />
          <Row label={t("firstYear")} value={plan === undefined ? bar : amount(plan.plan.cost.firstYear)} />
          {plan !== undefined && plan.plan.cost.uncosted > 0 && (
            <p className="text-muted-foreground text-sm">{t("uncosted", { count: plan.plan.cost.uncosted })}</p>
          )}
        </dl>
        <div className="space-y-4">
          {run === undefined ? (
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-sm">{t("followUp")}</span>
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <FollowUpDateControl runId={run.runId} value={run.followUpDate} />
          )}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              {t("process")}
              <HelpMorphButton label={tHelp("processLabel")}>{tHelp("processBody")}</HelpMorphButton>
            </div>
            {plan === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                  <Skeleton key={index} className="h-4 w-40" />
                ))}
              </div>
            ) : (
              <ol className="space-y-1.5">
                {plan.plan.process.map((step) => (
                  <li key={step.key} className={cn("flex items-center gap-2 text-sm", step.state === "upcoming" && "text-muted-foreground")}>
                    <HugeiconsIcon icon={STEP_ICON[step.state]} size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    <span>{t(`steps.${step.key}`)}</span>
                    <span className="ml-auto text-muted-foreground text-xs">{t(`state.${step.state}`)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </PanelCard>
  )
}
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping lib/iso-date.test.ts && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/lib/iso-date.ts apps/dashboard/components/pay-mapping` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message: `feat(pay-mapping): overview action-plan block with the follow-up date and the process indicator`

---

### Task 16: Compose the overview, rewire the page, rewrite the page test

**Files:**
- Rewrite: `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx`
- Rewrite: `apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx`
- Modify: `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`

**Interfaces:**
- Consumes: the seven block components (Tasks 10 to 15).
- Produces: `PayMappingOverview` (no props). `WholeSurveyStat`, `GapFinding`, `ClockStat` and `gapStat` cease to exist (their only consumer was this file; the report export stopped capturing app charts in the two-report plan, confirmed by Task 13's grep).

- [ ] **Step 1: Rewrite the composition**

`pay-mapping-overview.tsx`:

```tsx
"use client"

import { OverviewActionPlan } from "./overview/overview-action-plan"
import { OverviewComparabilityNotice } from "./overview/overview-comparability-notice"
import { OverviewContextRow } from "./overview/overview-context-row"
import { OverviewGroupTable } from "./overview/overview-group-table"
import { OverviewKpiStrip } from "./overview/overview-kpi-strip"
import { OverviewObservations } from "./overview/overview-observations"
import { OverviewPayOutcome } from "./overview/overview-pay-outcome"

// The run's decision surface (ADR-0031), top to bottom: what this mapping
// is and what it is compared with, whether there is a pay challenge, where
// it is, how large it is, what is analysed and what remains, how the
// action work is going. Every block reads the run shell's subscriptions
// through the context and owns its own loading shape, so the page needs no
// skeleton of its own. The comparison layer renders only under a
// reference; without one nothing here mentions a comparison.
export function PayMappingOverview() {
  return (
    <div className="space-y-4">
      <OverviewContextRow />
      <OverviewComparabilityNotice />
      <OverviewKpiStrip />
      <OverviewObservations />
      <OverviewPayOutcome />
      <OverviewGroupTable />
      <OverviewActionPlan />
    </div>
  )
}
```

`page.tsx`:

```tsx
"use client"

import { PayMappingOverview } from "@/components/pay-mapping/pay-mapping-overview"

// The Overview sub-page (the run's index route). The [slug] layout's shell
// resolves every subscription the blocks read; each block renders its real
// title and owns its loading bars, so no page-level skeleton is needed.
export default function PayMappingOverviewPage() {
  return <PayMappingOverview />
}
```

- [ ] **Step 2: Rewrite the page test**

`pay-mapping-overview.test.tsx` keeps its mocks (navigation now with `useSearchParams` and `useRouter`, plus `@/lib/toast`, `@/components/org-context` and the NumberFlow stand-in: `vi.mock("@number-flow/react", async () => (await import("@/test/number-flow-mock")).numberFlowModule)`) and `renderOverview(gap, { run, analyses, actions, runsList, reference })` wrapping `<PayMappingOverview />` in the provider with `slug: "pay-2026"`, then:

```tsx
describe("PayMappingOverview", () => {
  it("orders the context row, the KPI strip, observations, pay outcome, the group table and the action plan", () => {
    renderOverview(makeGapResult(), { run: makeRunDetail({ label: "Pay mapping 2026" }) })
    const text = document.body.textContent ?? ""
    const at = (needle: string) => text.indexOf(needle)
    expect(at("Pay mapping 2026")).toBeGreaterThan(-1)
    expect(at(m.overview.kpi.scope)).toBeGreaterThan(at("Pay mapping 2026"))
    expect(at(m.overview.observations.title)).toBeGreaterThan(at(m.overview.kpi.cost))
    expect(at(m.overview.outcome.title)).toBeGreaterThan(at(m.overview.observations.title))
    expect(at(m.overview.groupTable.title)).toBeGreaterThan(at(m.overview.outcome.title))
    expect(at(m.overview.actionPlan.title)).toBeGreaterThan(at(m.overview.groupTable.title))
  })

  it("carries nothing of the removed widgets", () => {
    renderOverview(makeGapResult())
    expect(screen.queryByText(m.overview.headlineGapLabel)).toBeNull()
    expect(screen.queryByText(m.detail.population)).toBeNull()
    expect(screen.queryByText(/unpaid/)).toBeNull()
    expect(document.querySelectorAll('[data-testid="mean-bar"]')).toHaveLength(0)
  })

  it("renders no comparison layer without a reference", () => {
    renderOverview(makeGapResult())
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText(m.overview.groupTable.columns.reference)).toBeNull()
    expect(screen.queryByText(/than /)).toBeNull()
  })

  it("keeps every block title real while everything loads", () => {
    renderOverview(undefined, { run: undefined, analyses: undefined, actions: undefined, runsList: undefined })
    for (const title of [m.overview.kpi.scope, m.overview.observations.title, m.overview.outcome.title, m.overview.groupTable.title, m.overview.actionPlan.title]) {
      expect(screen.getByText(title)).toBeDefined()
    }
  })
})
```

Run: `cd apps/dashboard && bun run test && bunx tsc --noEmit`, then `bunx biome check apps/dashboard/components/pay-mapping "apps/dashboard/app/(app)/pay-mappings"` from the root.
Expected: PASS, zero diagnostics. (`pay-mapping-population-card.test.tsx`, `equality-clock.test.tsx` and `mean-comparison-bars.test.tsx` still pass on their own until Task 19 deletes them.)

- [ ] **Step 3: Present the diff (no commit)**

Proposed message: `feat(pay-mapping)!: the run overview is the decision surface`

---

### Task 17a: The guide page in English and Swedish

**Files:**
- Rewrite: `apps/dashboard/content/docs/{en,sv}/pay-mapping-overview.mdx`

**Interfaces:**
- Consumes: the shipped behaviour of Tasks 1 to 16 (write from the code, not from the spec's intentions).
- Guards: `apps/dashboard/lib/docs/docs-guards.test.ts`. Tasks 17a and 17b are ONE review unit presented as one diff: guard 8 (locale structural parity, heading and link sequence position for position) is red by construction between them, because nb/da/fi still carry the old page's headings until 17b; 17a runs every other guard, 17b runs the whole suite. The slug and every anchor stay locale-invariant; every locale keeps EXACTLY this heading list in this order and the same internal links in the same order.

- [ ] **Step 1: English**

```mdx
---
title: The pay mapping overview
description: The decision surface a pay mapping opens on, from the six key figures to the action plan, and how to compare it with an earlier mapping.
section: pay-mapping
---

Opening a pay mapping (lönekartläggning) from [Pay mappings](/pay-mappings)
lands you on its Overview, the first of the pages in the mapping's own
sidebar (Overview, Analysis, Actions, and Report). Every figure on it is
read from the mapping's frozen snapshot and from the documentation and
actions you have added since.

## The context row

The row under the breadcrumbs names the mapping, its status, the date its
data was extracted, and how many of the people included had a salary at
the time, for example "112 of 118 with pay". A mapping with no earlier
mapping in the organization carries a "Base year" chip. At the row's right
end, "Compare with" lists the organization's earlier completed mappings;
the page opens with "No comparison" and stays there until you choose one.

## The six figures

Six tiles answer the first questions in order. Scope: the people included,
with the women and men counts. Total pay gap: the average pay difference
between all women and all men, with the median difference beneath it, or
"Not measurable" when a gender is missing. Remaining to analyse: the groups
that require documentation and are not yet marked done, out of all that
require it. Risk groups: the groups whose difference is still under
analysis or has an action decided, with how many people are affected, that
is the lower-paid gender in each such group. Actions: how many of the
mapping's actions are done, with the number in progress. Estimated cost:
the annual recurring cost of the actions (every per-year cost plus twelve
times every per-month cost) with the one-off total beneath, or "Cost not
estimated" when no action carries a cost.

## Observations

Up to five rows, derived by fixed rules and never by AI: an equal-work group
that is not closed, a women-dominated group with an open comparison, an
upper pay quartile where women's share sits at least ten points below their
share of everyone, and a practice area with a finding but no action. Each
row shows a status word ("Action required" or "Needs review"), the scope
("8 people · 6.2 %"), and the next step, and opens the group, the
comparison or the area in the analysis. When nothing qualifies, the single
row reads "No deviation identified".

## Pay outcome

The panel restates the total gap as mean and median and adds counts instead
of an invented "unexplained" figure: groups analysed of all that require it,
groups remaining, risk groups, and people affected. Beside it, "Gender split
by pay level" shows everyone with a salary ranked by pay and split into four
quartiles, lowest to highest, so you can see whether women cluster in the
lower-paid quartiles while men cluster in the upper ones.

## The group table

The table lists every group with a gap, switchable between Equal work and
Equivalent work. Under Equal work each row shows the group, the women and
men counts, the median pay of each gender, the pay gap in percent (negative
when women earn less, positive in a group where women earn more), and the
group's analysis status. Under Equivalent work each row shows a
women-dominated group, its headcount and share of women, the largest
higher-paid comparison group with a count of any others, the difference,
and the status. The table opens sorted by the largest gap; the status
filter narrows it, and a row opens the group's own step in the analysis.

A group with fewer than four people, or fewer than two of a gender, hides
its medians here, marked "Masked". That is the same threshold the signing
report and the key-figures export apply, so nothing appears on this page
that the documents would not print. The analysis pages are not masked: HR
already sees every salary there, and that is where the work is done.

## The action plan

The block counts the mapping's actions by status (not started, in progress,
done), tables the cost as annual recurring, one-off and total for the first
year, and states how many actions have no cost estimate. The next decision
point is a date any member can set inline, also after the mapping is
completed, and every change is written to the audit log. The five-step
process indicator shows where the mapping stands: mapping done, analysis
done (nothing requiring documentation remains open), plan decided (the
mapping is completed), implementing (at least one action has started or is
done), and follow-up (a later mapping exists).

## Comparing with an earlier mapping

Choosing an earlier completed mapping under "Compare with" adds the
comparison to the page and to the link, as `?compare=`, so a shared link or
a screenshot always states what is being compared. The tiles gain a
statement of the change ("0.7 points lower than September 2025", "2 fewer
groups"), the group table gains Reference and Change columns matched group
by group (a group the earlier mapping did not have reads "New"), and the
action plan shows how many more or fewer actions are done. When the two
populations differ by ten percent or more, or the two mappings were
computed under different evaluation models, a notice states the concrete
difference so you read the changes together with it. Choosing "No
comparison" removes all of it; without a reference nothing on the page
mentions a comparison.

## Hourly pay

A person paid by the hour has their base pay converted to a
full-time-equivalent monthly figure, an hourly rate times full-time hours
per month, before any of these figures use it; that conversion already
assumes a full-time month, so it is never FTE-adjusted a second time,
unlike a part-time monthly salary. The report's method chapter states the
full-time hours figure this mapping used and how many people in it had a
value of their own.

## Everything reads from frozen data

None of these figures update as your live People or Roles change: they
are read from the snapshot taken the moment this mapping started, so they
stay exactly as they were even as your live data moves. See
[Starting a pay mapping](/docs/starting-a-pay-mapping) for what gets
frozen and why. To see where things stand today, start a new pay mapping.

## Related

- [What is a pay mapping](/docs/what-is-pay-mapping)
- [Starting a pay mapping](/docs/starting-a-pay-mapping)
- [Equal work](/docs/equal-work)
- [Equivalent work](/docs/equivalent-work)
- [Actions and notes](/docs/actions-and-notes)
- [Pay mapping lifecycle and statuses](/docs/run-lifecycle)
```

- [ ] **Step 2: Swedish**

```mdx
---
title: Lönekartläggningens översikt
description: Beslutsytan en lönekartläggning öppnar på, från de sex nyckeltalen till åtgärdsplanen, och hur du jämför den med en tidigare kartläggning.
section: pay-mapping
---

Att öppna en lönekartläggning från [Lönekartläggningar](/pay-mappings)
tar dig till dess Översikt, den första av sidorna i kartläggningens egen
meny (Översikt, Analys, Åtgärder och Rapport). Varje siffra på den läses
från kartläggningens frysta ögonblicksbild och från den dokumentation och
de åtgärder du har lagt till sedan dess.

## Kontextraden

Raden under brödsmulorna namnger kartläggningen, dess status, datumet då
data togs ut och hur många av de personer som ingår som hade en lön vid
tillfället, till exempel "112 av 118 med lön". En kartläggning utan någon
tidigare kartläggning i organisationen bär chipet "Basår". Längst till
höger listar "Jämför med" organisationens tidigare avslutade
kartläggningar; sidan öppnas med "Ingen jämförelse" och stannar där tills
du väljer en.

## De sex nyckeltalen

Sex rutor besvarar de första frågorna i ordning. Omfattning: personerna som
ingår, med antal kvinnor och män. Totalt lönegap: den genomsnittliga
löneskillnaden mellan alla kvinnor och alla män, med medianskillnaden
under, eller "Ej mätbart" när ett kön saknas. Återstår att analysera:
grupperna som kräver dokumentation och ännu inte är klarmarkerade, av alla
som kräver det. Riskgrupper: grupperna vars skillnad fortfarande
analyseras eller har en beslutad åtgärd, med hur många personer som är
berörda, det vill säga det lägre betalda könet i varje sådan grupp.
Åtgärder: hur många av kartläggningens åtgärder som är klara, med antalet
pågående. Beräknad kostnad: åtgärdernas årliga återkommande kostnad (varje
årskostnad plus tolv gånger varje månadskostnad) med engångssumman under,
eller "Kostnad ej beräknad" när ingen åtgärd har en kostnad.

## Iakttagelser

Upp till fem rader, härledda med fasta regler och aldrig av AI: en grupp
med lika arbete som inte är avslutad, en kvinnodominerad grupp med en öppen
jämförelse, en övre lönekvartil där kvinnornas andel ligger minst tio
punkter under deras andel av alla, och ett praxisområde med en brist men
ingen åtgärd. Varje rad visar ett statusord ("Åtgärd krävs" eller "Behöver
granskas"), omfattningen ("8 personer · 6,2 %") och nästa steg, och öppnar
gruppen, jämförelsen eller området i analysen. När inget kvalificerar sig
lyder den enda raden "Ingen avvikelse identifierad".

## Löneutfall

Panelen upprepar det totala gapet som medel och median och lägger till
antal i stället för en påhittad "oförklarad" siffra: analyserade grupper
av alla som kräver det, återstående grupper, riskgrupper och berörda
personer. Bredvid visar "Könsfördelning utifrån lönenivå" alla med lön
rangordnade efter lön och delade i fyra kvartiler, lägst till högst, så att
du ser om kvinnor samlas i de lägre betalda kvartilerna medan män samlas i
de övre.

## Grupptabellen

Tabellen listar varje grupp med ett gap, växlingsbar mellan Lika arbete och
Likvärdigt arbete. Under Lika arbete visar varje rad gruppen, antalet
kvinnor och män, medianlönen för varje kön, lönegapet i procent (negativt
när kvinnor tjänar mindre, positivt i en grupp där kvinnor tjänar mer) och
gruppens analysstatus. Under Likvärdigt arbete visar varje rad en
kvinnodominerad grupp, dess antal och andel kvinnor, den största högre
betalda jämförelsegruppen med antalet övriga, skillnaden och statusen.
Tabellen öppnas sorterad på störst gap; statusfiltret smalnar av den, och
en rad öppnar gruppens eget steg i analysen.

En grupp med färre än fyra personer, eller färre än två av ett kön, döljer
sina medianer här, markerade "Maskerad". Det är samma tröskel som
signeringsrapporten och nyckeltalsexporten tillämpar, så ingenting visas
på den här sidan som dokumenten inte skulle skriva ut. Analyssidorna är
inte maskerade: HR ser redan varje lön där, och det är där arbetet görs.

## Åtgärdsplanen

Blocket räknar kartläggningens åtgärder per status (ej påbörjad, pågående,
klar), tabellerar kostnaden som årlig återkommande, engångs och totalt
första året, och anger hur många åtgärder som saknar kostnadsuppskattning.
Nästa beslutspunkt är ett datum som varje medlem kan sätta direkt, även
efter att kartläggningen avslutats, och varje ändring skrivs till
revisionsloggen. Processindikatorn i fem steg visar var kartläggningen
står: kartläggning klar, analys klar (inget som kräver dokumentation är
öppet), plan beslutad (kartläggningen är avslutad), genomförande (minst en
åtgärd har påbörjats eller är klar) och uppföljning (en senare
kartläggning finns).

## Jämföra med en tidigare kartläggning

Att välja en tidigare avslutad kartläggning under "Jämför med" lägger till
jämförelsen på sidan och i länken, som `?compare=`, så att en delad länk
eller en skärmbild alltid anger vad som jämförs. Rutorna får en beskrivning
av förändringen ("0,7 punkter lägre än september 2025", "2 grupper
färre"), grupptabellen får kolumnerna Referens och Förändring matchade
grupp för grupp (en grupp som den tidigare kartläggningen inte hade läser
"Ny"), och åtgärdsplanen visar hur många fler eller färre åtgärder som är
klara. När de två populationerna skiljer sig med tio procent eller mer,
eller när de två kartläggningarna beräknades under olika
värderingsmodeller, anger en notis den konkreta skillnaden så att du läser
förändringarna tillsammans med den. Att välja "Ingen jämförelse" tar bort
allt; utan en referens nämner ingenting på sidan en jämförelse.

## Timlön

En person med timlön får sin grundlön omräknad till en heltidsekvivalent
månadssumma, timlön gånger heltidstimmar per månad, innan någon av dessa
siffror använder den; den omräkningen förutsätter redan en heltidsmånad,
så den FTE-justeras aldrig en andra gång, till skillnad från en
deltidsmånadslön. Rapportens metodkapitel anger vilka heltidstimmar den här
kartläggningen använde och hur många personer i den som hade ett eget
värde.

## Allt läses från frysta data

Ingen av dessa siffror uppdateras när dina levande Personer eller Roller
ändras: de läses från ögonblicksbilden som togs i det ögonblick
kartläggningen startade, så de står kvar exakt som de var även när dina
levande data rör sig. Se [Starta en lönekartläggning](/docs/starting-a-pay-mapping)
för vad som fryses och varför. För att se var saker står i dag, starta en
ny lönekartläggning.

## Relaterat

- [Vad är en lönekartläggning](/docs/what-is-pay-mapping)
- [Starta en lönekartläggning](/docs/starting-a-pay-mapping)
- [Lika arbete](/docs/equal-work)
- [Likvärdigt arbete](/docs/equivalent-work)
- [Åtgärder och noteringar](/docs/actions-and-notes)
- [Lönekartläggningens livscykel och statusar](/docs/run-lifecycle)
```

- [ ] **Step 3: Guards (all but structural parity)**

Run: `cd apps/dashboard && bunx vitest run lib/docs -t "guard 1|guard 2|guard 3|guard 4|guard 6|guard 7|guard 9|guard 10|guard 11"` (PASS) and `grep -rnP '\x{2014}' apps/dashboard/content/docs/en/pay-mapping-overview.mdx apps/dashboard/content/docs/sv/pay-mapping-overview.mdx` (nothing).

- [ ] **Step 4: Present the diff (no commit; reviewed together with 17b)**

Proposed message: `docs(guide): the pay-mapping overview as a decision surface (en, sv)`

---

### Task 17b: The guide page in Norwegian, Danish and Finnish, and the sync

**Files:**
- Rewrite: `apps/dashboard/content/docs/{nb,da,fi}/pay-mapping-overview.mdx`

**Interfaces:**
- Consumes: Task 17a's English page as the structural source and Task 9's message files for the UI strings.
- Guards: the whole `docs-guards.test.ts` suite (guard 8 turns green here); `bun run docs:sync` in this task.

- [ ] **Step 1: Norwegian, Danish and Finnish**

Write `nb`, `da` and `fi` directly at production quality from the English page, with the same eleven headings in the same order (the guard compares heading level sequence and internal-link sequence position for position, and every locale must carry the same links), quoting the UI strings from Task 9's message files (the tile titles, the status words, "Masked", "New", "No comparison", "Compare with", "Base year") in that locale's own wording, and the terms from the anchor table in Task 9 (`lønnskartlegging` / `lønkortlægning` / `palkkakartoitus`, `Likt arbeid` / `Lige arbejde` / `Samaa työtä`, etc.). Keep the existing "Hourly pay" and "Everything reads from frozen data" paragraphs from each locale's current page where they already exist, unchanged. No em dashes.

- [ ] **Step 2: Guards and sync**

Run: `cd apps/dashboard && bunx vitest run lib/docs` (PASS, guard 8 included), `grep -rnP '\x{2014}' apps/dashboard/content/docs` (nothing), then `cd apps/dashboard && bun run docs:sync` and paste its per-page output in the report.

- [ ] **Step 3: Present the diff (no commit; one review unit with 17a)**

Proposed message: `docs(guide): the pay-mapping overview as a decision surface (nb, da, fi) and the corpus sync`

---

### Task 18: ADR-0031 and the ADR-0012 addendum

**Files:**
- Create: `docs/adr/0031-oversikten-som-beslutsyta.md`
- Modify: `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md`

- [ ] **Step 1: ADR-0031 (Swedish, the ADR-0029 shape)**

```markdown
# Översikten är kartläggningens beslutsyta

**Status:** accepterad 2026-09-03 (ägarbeslut). Bygger på ADR-0011, ADR-0012 och ADR-0015; ersätter översiktens tidigare komposition (befolkningsruta, gap-ruta, jämställdhetsklocka, medelvärdesstaplar, donut).

Ägardokumentet "Översikt Lönekartläggning (första sidan)" (2026-09-03) beskriver vad den som öppnar en kartläggning behöver få svar på, i ordning: finns det en löneutmaning, var finns den, hur stor är den och hur många berör den, vad är analyserat och vad återstår, hur går åtgärdsarbetet, och, först när läsaren själv väljer det, hur utfallet förändrats mot en vald tidigare kartläggning. Den tidigare översikten svarade på "hur stort är gapet" med tre olika bilder av samma tal (procent, klocka, staplar) och på inget av de andra. Ägaren beslutade ytans innehåll och prioritetsordning.

## Beslut

1. **Sju block i beslutsordning.** Kontextrad (etikett, status, datauttagsdatum, täckning "N av M med lön", basårschip, referensväljare), sex nyckeltalsrutor (omfattning, totalt lönegap med median, återstår att analysera, riskgrupper med berörda, åtgärder, beräknad kostnad), prioriterade iakttagelser (tre till fem rader, regelhärledda, aldrig AI), löneutfall med antal i stället för en påhittad "oförklarad %", grupptabell (lika arbete / likvärdigt arbete), åtgärdsplan med processindikator i fem steg, och jämförelselagret. Kvartildiagrammet består oförändrat; klockan, staplarna, donuten och befolkningsrutan tas bort med sina tester, hjälptexter och strängar.
2. **Klienten härleder, backend levererar tal.** Alla block räknas fram på klienten ur de prenumerationer körningens skal redan håller (gap-aggregatet, dokumentationsraderna, åtgärderna, körningen, körningslistan) genom rena hjälpfunktioner under `apps/dashboard/lib/pay-mapping-overview/`, var och en enhetstestad. Backend tillför enbart medianerna på gap-wiren (`compareMedians` i `@workspace/core`, per grupp och för org-aggregatet), `withPayCount` och `followUpDate` på körningsdetaljen, en `frozenCriteria`-sammanfattning på körningslistan, och mutationen `setPayMappingFollowUpDate`. Analysstatusen (`noActionNeeded | objectiveReason | actionDecided | furtherAnalysis`) läses från rapporternas hjälpfunktion (ADR-0030), aldrig dubblerad.
3. **Jämförelsen lever i URL:en.** `?compare=<slug>` namnger en tidigare AVSLUTAD körning; sidan öppnas alltid i rent nulägesläge ("Ingen jämförelse"). Under en referens prenumererar skalet på referensens gap, dokumentation och åtgärder (tre prenumerationer, nycklade på referensens id, helt överhoppade utan referens), rutorna får delta-fotnoter, tabellen får kolumnerna Referens och Förändring matchade på gruppnyckel ("Ny" för en grupp referensen saknade), åtgärdsplanen visar klar-deltat, och en jämförbarhetsnotis anger den konkreta skillnaden när populationen skiljer sig med minst 10 % eller de frysta modellerna skiljer sig (kriterienamn eller viktpoäng). Utan referens renderas inget ur listan: inga tomma pilar, inga streck, inga "ingen jämförelse vald"-meningar.
4. **Nästa beslutspunkt är planeringsmetadata.** `payMappingRuns.followUpDate` (dagsprecision) sätts inline i åtgärdsplanen av varje medlem, även efter avslut (planen löper över år medan den frysta evidensen aldrig ändras), med toast och revisionsrad `payMapping.followUpDateSet` som diffar ISO-datum. Ett oförändrat datum skriver ingenting.
5. **Maskningströskeln gäller på översikten.** Översikten döljer medel och medianer för grupper under exportens småcellsminimum (färre än 4 personer eller färre än 2 av ett kön) exakt som dokumenten; antal, gap-procent och status består. Analyssidorna maskeras inte. Tröskeln lever i `apps/dashboard/lib/pay-mapping-masking.ts` och konsumeras av översikten och signeringsprojektionen (tillägg till ADR-0012).

## Konsekvenser

- **Wire-formen:** `GapGroup.tcc` bär `womenMedian`, `menMedian`, `medianGapPct` (maskerade tillsammans med medelvärdena); `OrgAggregate` bär `womenMedianComp`, `menMedianComp`, `medianGapPct`; rapportsammanställningen läser medianerna från wiren så att talet finns en gång. Körningsdetaljen bär `withPayCount` och `followUpDate`; körningslistan bär `frozenCriteria`.
- **Schemaändringen är utan migrering** (`followUpDate` är valfri; dev-miljön nollställs enligt pre-launch-regeln).
- **Audit:** en ny händelse med subjekt `payMappingRun`, kategori `pay`, fältet `followUpDate` som ISO-datum med etikett i fem språk.
- **Borttaget utan ersättning:** `equality-clock`, `mean-comparison-bars`, `pay-mapping-population-card`, `pay-mapping-trends`, `WholeSurveyStat` och donut-fångsten i rapportexporten, hjälpnycklarna `equalityClock*`, meddelandenycklarna `clock.*`, översiktens gamla trend-strängar och fyndmeningarna `review.finding.org*`.
- **Utanför omfattning (prioritet 7 och 8 i ägardokumentet):** historisk trend över tre till fem körningar, befolkningsnedbrytning, nivåstruktur, klockan i ny form. Inga nya frysta fält på snapshotrader. Inga AI-skrivna iakttagelser.

## Alternativ som avvisades

- **Ett backend-aggregat för översikten.** En query som levererar färdiga nyckeltal skulle dubblera regler som redan finns i klienten (status, dokumentationsplikt, kostnadsannualisering) och göra referensjämförelsen till en andra serverkodväg; klienthärledning ur befintliga prenumerationer kostar ingen extra query i nulägesläget.
- **Jämförelsen i React-state.** En vald referens som inte syns i länken gör en delad skärmbild oläslig; URL:en är den enda plats där "mot vad" alltid följer med.
- **Automatiskt vald referens (senaste körningen).** Sidans första uppgift är nuläget; en påtvingad jämförelse fyller varje ruta med pilar innan läsaren bett om en.
- **Behålla klockan bredvid de nya rutorna.** Tre bilder av samma tal var problemet; en fjärde yta för det löser inget.
```

- [ ] **Step 2: ADR-0012 addendum**

Append to `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md`:

```markdown

## Tillägg 2026-09-03: maskningströskeln gäller även översikten (ADR-0031)

Tillägget 2026-07-16 delade tröskeln mellan appen (⚪ betyder enbart att ett kön saknas) och exportgränsen (minst 4 personer totalt OCH minst 2 per kön innan ett gruppmedelvärde exponeras). Översiktens omgörning (ADR-0031) preciserar var exportgränsen går inne i appen: **körningens översikt** visar medel och medianer för en grupp endast över samma minimum som dokumenten, med antal, gap-procent och status synliga oavsett, eftersom översikten är den sida som delas, skärmdumpas och läses av andra än den som gör analysen. **Analysflödet maskeras inte**: där ser HR varje lön redan och där görs arbetet. En tröskel i hela produkten, tillämpad på översikten och i dokumenten, aldrig i analysflödet; värdena lever i `apps/dashboard/lib/pay-mapping-masking.ts`.
```

- [ ] **Step 3: Verify**

Run: `grep -rnP '\x{2014}' docs/adr/0031-*.md docs/adr/0012-*.md` (nothing).

- [ ] **Step 4: Present the diff (no commit)**

Proposed message: `docs(adr): ADR-0031, the overview as decision surface; ADR-0012 masking addendum`

---

### Task 19: Delete the clock, the bars, the donut, the population card and the trends

**Files:**
- Delete: `apps/dashboard/components/pay-mapping/equality-clock.tsx`, `equality-clock.test.tsx`
- Delete: `apps/dashboard/lib/equality-clock.ts`, `equality-clock.test.ts`
- Delete: `apps/dashboard/components/pay-mapping/mean-comparison-bars.tsx`, `mean-comparison-bars.test.tsx`
- Delete: `apps/dashboard/components/pay-mapping/pay-mapping-population-card.tsx`, `pay-mapping-population-card.test.tsx`
- Delete: `apps/dashboard/components/pay-mapping/pay-mapping-trends.ts`, `pay-mapping-trends.test.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- Modify: `apps/dashboard/components/pay-mapping/review-group-step.test.tsx` (one comment mentions the deleted bars test)

**Interfaces:**
- Consumes: nothing; every consumer of these modules was rewired in Tasks 13 and 16.
- Produces: the deleted surface leaves no key, help text or test behind.

- [ ] **Step 1: Confirm nothing imports them**

Run from the root: `grep -rn "equality-clock\|mean-comparison-bars\|pay-mapping-population-card\|pay-mapping-trends\|WholeSurveyStat\|populationTrend\|gapTrend\b\|previousRun(" apps/dashboard --include='*.ts' --include='*.tsx' | grep -v node_modules`
Expected: only the ten files listed above (and `review-group-step.test.tsx`'s comment). `previousRun` as a LOCAL variable in `pay-mapping-report-download.tsx` and `pay-mapping-run-actions.tsx` is unrelated and stays.

- [ ] **Step 2: Delete the files**

```bash
git rm apps/dashboard/components/pay-mapping/equality-clock.tsx apps/dashboard/components/pay-mapping/equality-clock.test.tsx apps/dashboard/lib/equality-clock.ts apps/dashboard/lib/equality-clock.test.ts apps/dashboard/components/pay-mapping/mean-comparison-bars.tsx apps/dashboard/components/pay-mapping/mean-comparison-bars.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-population-card.tsx apps/dashboard/components/pay-mapping/pay-mapping-population-card.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-trends.ts apps/dashboard/components/pay-mapping/pay-mapping-trends.test.ts
```

In `review-group-step.test.tsx`, rewrite the comment `// equal (mirrors mean-comparison-bars.test.tsx's own moneyText helper).` to `// equal (the same moneyText idiom the money-rendering tests share).`

- [ ] **Step 3: Delete the message keys in all five locales**

From `dashboard.payMapping.overview`: `populationFirstRun`, `populationDeltaMore`, `populationDeltaFewer`, `meanComparisonTitle`, `statisticsHeading`, `wholeSurveyTitle`, `deltaUnchanged`, `populationNote`, `gapDeltaNarrowed`, `gapDeltaWidened`, `gapNoComparison`, `gapNote`, `clockNote`. (Keep `headlineGapLabel`, read by the run-facts footer and the total-gap card's help, `insufficient`, `quartileTitle`, `quartiles`, and everything Task 9 added.)

Delete the whole `dashboard.payMapping.clock` object.

From `dashboard.payMapping.review.finding`: `orgLess`, `orgMore`, `orgNone` (keep `none`).

From `dashboard.help`: `equalityClockLabel`, `equalityClockBody`.

Confirm each key has no remaining reader: `grep -rn "payMapping\.clock\|\"clock\"\|meanComparisonTitle\|wholeSurveyTitle\|statisticsHeading\|populationNote\|populationFirstRun\|populationDelta\|gapNoComparison\|gapDelta\|deltaUnchanged\|clockNote\|gapNote\|equalityClock\|finding.org\|\"orgLess\"\|\"orgMore\"\|\"orgNone\"" apps/dashboard --include='*.ts' --include='*.tsx' | grep -v node_modules` (expected: nothing).

- [ ] **Step 4: Verify**

Run: `cd packages/i18n && bun run test && cd ../../apps/dashboard && bun run test && bunx tsc --noEmit`, then `bunx biome check apps/dashboard` from the root.
Expected: PASS, zero diagnostics.

- [ ] **Step 5: Present the diff (no commit)**

Proposed message: `chore(pay-mapping)!: remove the equality clock, the mean bars, the donut and the population trend`

---

### Task 20: Dev deployment reset and browser verification (controller-run)

**Files:** none (verification only).

- [ ] **Step 1: Reset and push**

`cd packages/backend && bunx convex run seed:resetDatabase` (the schema change has no migration by design: pre-launch, no legacy), then `bunx convex dev --once`. If the CLI answers "You don't have access to the selected project", stop and ask the owner to run `npx convex login` (their account, not fixable from here).

- [ ] **Step 2: Production build check**

`cd apps/dashboard && bunx next build`. Expected: the build completes and prints no `Missing Suspense boundary with useSearchParams` error for `/pay-mappings/[slug]` (the route is dynamic; the hook needs no boundary). If it does print one, wrap `<PayMappingRunShell>` in `app/(app)/pay-mappings/[slug]/layout.tsx` in `<Suspense fallback={null}>` from `react` and re-run.

- [ ] **Step 3: Seed two mappings**

Import the seeded people, start a pay mapping, document every required group and praxis area, fill in collaboration, complete it, then add three actions (one per month, one per year, one one-off; leave one uncosted) and mark one done. Start a second pay mapping (the reference must be an EARLIER completed run, so the first one qualifies).

- [ ] **Step 4: Browser pass on localhost:3001 (Chrome extension, the owner's Browser 1)**

1. Pure current-state mode: open the second mapping's Overview. The context row shows the label, status, "Data extracted <date>", "N of M with pay" and no "Base year" chip; the selector reads "No comparison"; nothing on the page mentions a comparison (no Reference column, no delta footers, no notice). The six tiles show figures; the observations list shows the open groups ranked with "Action required" first; the pay-outcome panel's mean and median match the total-gap tile; the group table opens on Equal work sorted by largest gap with negative signs for women-behind groups; switching to Equivalent work lists the women-dominated groups; the status filter shows the result count; clicking a row lands on that group's step in the analysis.
2. Masked cells at the thresholds: find (or make, by adjusting the seed) a group with exactly 4 people and 2 of each gender (unmasked medians), one with 4 people and 1 woman (masked), and one with 3 people (masked); the counts, the gap percent and the status stay visible on the masked rows; the help after "Groups" explains why.
3. With a reference: pick the first mapping under "Compare with"; the URL gains `?compare=<slug>`; the tiles show delta footers naming the reference's label; the table gains Reference and Change with "New" on a group the first mapping lacked; the action plan shows the done delta; a comparability notice appears if the populations differ by 10 % or more (adjust the seed to make it appear once and disappear once). Reload the page with the parameter in the URL: the reference is still selected. Pick "No comparison": the parameter is gone and every comparison element with it.
4. Narrow viewport: at 375px wide the context row wraps and the selector sits on its own line, fully visible; the six tiles stack; the table scrolls inside its own container, not the page.
5. Follow-up date: on the COMPLETED first mapping's Overview, pick a date; the toast confirms; the audit log shows "Follow-up date set" with the date as a formatted date (never milliseconds); clear it and see the arrow to empty.
6. Reduced motion: with `prefers-reduced-motion: reduce`, the NumberFlow figures swap without rolling.

- [ ] **Step 5: Report**

The file-by-file change summary for the whole slice, grouped by area, with the browser findings and anything left out and why.

---

## Self-review

**Spec coverage.** Owner decisions 1 to 6: scope (priorities 1 to 6 only; 7 and 8 named out of scope in ADR-0031), masking on the overview with the export threshold (Task 5, Task 14, ADR-0012 addendum in Task 18), reference selector of earlier completed runs with the URL parameter and the pure current-state default (Tasks 8, 10), `followUpDate` inline, allowed after completion, audited (Tasks 2, 15), the clock/bars/donut removed with tests, help and keys (Task 19), approach 1 client derivation with the four backend additions (Tasks 1, 2, 3 to 7). Page structure 1 to 7: context row (10), KPI strip with NumberFlow and the money format (11), observations with the five candidates, ranking and cut (4, 12), pay outcome beside the unchanged quartile chart (13), group table anatomy, masking, default sort, status filter, result count, row click, equivalent-work columns (14), action plan counts, cost table, uncosted count, follow-up date, process indicator (6, 15), comparison layer (7, 8, 11, 14, 15). Backend changes 1 to 4: medians (1), `withPayCount`/`followUpDate` (2), the mutation and event (2), the masking module consumed from the two-report plan (5). Helpers, i18n (9), tests per helper and component (each task), guide (17), ADRs (18), dev reset and browser pass (20). One addition beyond the spec's list, stated in the header and ADR-0031: `frozenCriteria` on the run list and the org medians on the aggregate, both needed by the comparability rule and the median note.

**Recorded choices.** (1) Denominators: "Remaining to analyse" counts against the groups requiring documentation (its note says so); "Risk groups" counts against every group with a comparison (its help says so); they are different questions and stay distinct. (2) The i18n boundary: card values roll through NumberFlow via rich tags; `scopeNote`, `riskNote`, `actionsNote` keep their counts in plain ICU text. (3) The cost card follows the spec's table literally: value = annual recurring, note = one-off total, footer = uncosted count, never a delta. (4) The model signature is `libraryKey ?? name` plus weight points, so a renamed criterion is the same criterion and pre-cutover evidence still compares. (5) The masking threshold is consumed from `@/lib/pay-mapping-masking` as the two-report plan ships it; Task 5 only checks the path.

**Placeholder scan.** No TBD/TODO; every code step shows its code; the nb/da/fi strings and guide pages are written by the executor against the anchor table, as the spec's locale rule prescribes, with a QA step; the sibling plan was read and its shipped names are used verbatim (analysis-status exports, `frozenMethod` + `makeFrozenCriterion`, the unmasked `tccMedianText`, `targetScope` with `praxis`, the threshold predicates); the one conditional instruction left (Task 13's grep for a leftover capture host) is pinned to one step.

**Type consistency.** `GapTccMetric` (1) is what `group-rows.ts` (5) reads; `OverviewStatuses`/`isRiskStatus`/`documentationDuties` (3) are consumed by 4, 5, 6, 11 to 15 under those names; `overviewKpis` returns `remaining.open` which 6 and 15 pass as `remainingOpen`; `PayMappingRunListEntry.frozenCriteria` (8) matches the summary field added in 2 and the `ComparabilityInput.criteria` shape (7); `referenceColumns` returns `referenceValue` (7) and the table reads `row.reference.referenceValue` (14); `analysisStepHref(slug, scope, groupKey)` (12) is what 14 calls; `isoToMs`/`msToIso` (15) keep the signatures the action dialog had.
