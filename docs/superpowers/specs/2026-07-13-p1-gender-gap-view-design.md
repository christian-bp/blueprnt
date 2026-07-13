# P1 gender-gap primary view (ADR-0012)

**Date:** 2026-07-13 · **Status:** approved design, pending spec review · **Scope:** V2 analysis pillar, guide Del 3 (lika/likvärdigt arbete), first analysis slice on the frozen snapshot

## Problem

The M3 slice built the kartläggning entity and its immutable data snapshot (`payMappingRuns` + `payMappingSnapshotRows`), but a run's detail page shows only the frozen population as a flat table. Nothing computes the thing the whole survey exists to answer: is there an unexplained pay gap between women and men doing equal (lika) or equivalent (likvärdigt) work?

ADR-0012 makes the gender-gap analysis the always-on, non-disableable, pre-selected primary view of every kartläggning. It is the statutory core of a lönekartläggning (Diskrimineringslagen 3 kap., EU Pay Transparency Directive 2023/970). Everything downstream (objective reasons, action plans, the Art. 9 report) hangs off the groups and flags this view produces.

No stats or gap code exists anywhere in the repo yet. `packages/core` derives band/score; it does not yet compute means or gaps. This slice adds the deterministic gap engine and the first view built on it.

## Goal

On a run's detail page, above the population table, show two always-on gap tables computed from the frozen snapshot:

- **Steg 1, lika arbete:** one row per `(roleTitle, band, level)` group.
- **Steg 2, likvärdigt arbete:** one row per `band`.

Each row shows women/men counts, mean pay per gender, the signed pay gap %, and one of four flags (🔴 over 10 %, 🟠 5-10 %, ✅ under 5 %, ⚪ insufficient). The gap math lives in a pure, deterministic `packages/core` engine (ADR-0002) reused wholesale by the query. Insufficient groups never expose a mean or gap. No completion gate, no comparison beyond lika/likvärdigt, no export yet.

## Scope: P1 conformance

This slice maps to ADR-0012's P1 (the primary view) as follows. It is the P1 view in full; the P1 completion gate waits for the modules it depends on (objective reasons plus action plans, guide Modul 6-7) to exist.

| ADR-0012 / guide Del 3 requirement | This slice |
|---|---|
| Deterministic gap engine in `packages/core` (means, gap, `classifyPayGap`) | ✅ in |
| Aggregate query over the frozen snapshot | ✅ in |
| Steg 1 lika = job_title + band + level | ✅ in (`(roleTitle, band, level)`) |
| Steg 2 likvärdigt = band | ✅ in (`band`) |
| Four flags 🔴 over 10 % / 🟠 5-10 % / ✅ under 5 % / ⚪ insufficient | ✅ in |
| Min group size 4; ⚪ on under 4 or a missing gender | ✅ in |
| ⚪ group never exposes an individual mean/gap | ✅ in (query masks means + gap) |
| Always-on, pre-selected primary view of the run | ✅ in (leads the detail page) |
| Gates survey completion (documented + action plans on unfair gaps) | ❌ deferred, needs objective reasons (M6) + action plans (M7); status transitions land with the gate |
| Base salary AND total comp, mean AND median | ⚠️ partial, total comp + mean now; base and median are later additive views |
| P2/P3 comparisons (job-family, cohort, intersectional, off-policy) | ❌ deferred, separate slices |
| Art. 9 export of the analysis | ❌ deferred, needs report content (M8) |

## Non-goals

- No completion gate, no status transitions (`active` to `underReview` to `completed`); the gate needs objective reasons + action plans that do not exist yet.
- No median, no base-salary view, no variable-pay split (guide A1/A4): total comp + mean only this slice; the engine is shaped so adding them later is additive.
- No P2/P3 (job-family rollups, age/tenure cohorts, intersectional splits, off-policy vs band range).
- No view-selector tabs; the view leads the single detail page. Tabs arrive when P2/P3 do.
- No cross-survey trend, no Art. 9 export package.
- No writing to the snapshot: the view is read-only over frozen data (ADR-0011).

## Decisions

Four product decisions were settled in brainstorming:

1. **Slice boundary:** the P1 view (compute + display), the P1 gate deferred until objective reasons + action plans exist.
2. **Gap metric:** mean FTE-adjusted total monthly comp, reusing the existing pure `fteTotalMonthlyComp` (`@workspace/constants/pay`). The gap is flagged on the metric's mean. Base salary and median are later additive views.
3. **Grouping onto our model:** lika = `(roleTitle, band, level)` (a role's title determines its band, so this is effectively "same role + same level"; band stays in the key to match ADR-0012 verbatim and stay correct if data ever disagrees). Likvärdigt = `band`. Rows with a null band cannot be placed in likvärdigt (band is the equivalence key) and are surfaced as an `unbandedCount`, not silently dropped; in lika a null-band row still forms a `(title, null, level)` group.
4. **Placement:** the view leads the detail page: header, then run summary card, then the P1 gap view, then the population table (now under its own heading). One page, no new nav pattern.

## Design

### 1. The engine (`packages/core/src/pay-gap.ts`)

Pure and deterministic (ADR-0002): no framework imports, no clock, no I/O, no randomness. Reuses `fteTotalMonthlyComp` from `@workspace/constants` (already a dependency of `@workspace/core`), so the FTE/total-comp formula is never re-derived.

```ts
import { fteTotalMonthlyComp } from "@workspace/constants/pay"

// Min people in a group before a gap is meaningful; also the small-cell
// threshold (a sub-4-person mean is effectively one salary). ADR-0012.
export const MIN_GROUP_SIZE = 4

export type PayGapFlag = "critical" | "elevated" | "ok" | "insufficient"

export interface GenderGapResult {
  womenCount: number
  menCount: number
  womenMeanComp: number | null // mean FTE-adjusted total comp; null if no women
  menMeanComp: number | null
  gapPct: number | null // signed; null if either mean is null or menMean === 0
  flag: PayGapFlag
}
```

**`classifyPayGap(womenCount, menCount, gapPct)`** is ADR-0012's named helper, the single source of the thresholds:

```
insufficient (⚪)  if womenCount === 0 || menCount === 0
                   || womenCount + menCount < MIN_GROUP_SIZE
                   || gapPct === null
critical     (🔴)  else if Math.abs(gapPct) > 10
elevated     (🟠)  else if Math.abs(gapPct) >= 5      // 5 % = the EU line, inclusive
ok           (✅)  else                                // under 5 %
```

Boundaries are exact: `10.0` gives elevated, `> 10` gives critical; `5.0` gives elevated, `< 5` gives ok. Flagging is on `Math.abs(gapPct)` because an unexplained gap in either direction is a finding.

**`computeGenderGap(womenComp: number[], menComp: number[]): GenderGapResult`** takes the per-person FTE-adjusted total-comp values already split by gender, and returns counts, means, the signed gap, and the flag:

```
womenMean = womenComp.length ? sum(womenComp) / womenComp.length : null
menMean   = menComp.length   ? sum(menComp)   / menComp.length   : null
gapPct    = (womenMean !== null && menMean !== null && menMean !== 0)
              ? ((menMean - womenMean) / menMean) * 100
              : null
flag      = classifyPayGap(womenComp.length, menComp.length, gapPct)
```

Signed gap convention: positive means women earn less than men (the usual concern); negative means women earn more. The engine is an honest calculator: it always returns the true means. Privacy suppression is the query's job, not the engine's.

Exported from `packages/core/src/index.ts`: `MIN_GROUP_SIZE`, `PayGapFlag`, `GenderGapResult`, `classifyPayGap`, `computeGenderGap`.

### 2. The aggregate query (`packages/backend/convex/payMapping/gap.ts`)

`getPayMappingGap({ orgId, runId })` is an org-scoped query. It resolves the run (returns `null` if not in the caller's org, mirroring `getPayMappingRunBySlug`), reads its rows via the `by_run` index, and builds the two group arrays through the engine.

Per row, the person's comp is `fteTotalMonthlyComp(basicMonthly, components, ftePercent)`. A row with a null `basicMonthly` has no pay and is excluded from all gap math (it is not in `withPayCount`); it is not counted as unbanded either.

- **lika:** bucket rows with a non-null `basicMonthly` by a stable key `"<roleTitle>|<band ?? "none">|<level>"`. For each bucket, split comp by gender, call `computeGenderGap`.
- **likvardigt:** bucket the same priced rows by `band`; rows whose `band` is null are excluded and counted into `unbandedCount`.

**Masking:** after `computeGenderGap`, if `flag === "insufficient"` the query sets `womenMeanComp`, `menMeanComp`, and `gapPct` to `null` in the wire shape (a sub-4-person mean is an individual salary and a gap on under 4 is statistically meaningless). Counts and the flag are still returned so the UI can explain why a group is ⚪. This is small-cell / statistical hygiene, not access control: HR can still see the underlying people in the population table below, by design (HR-only audience). It is also the seam the future Art. 9 export reuses.

**Wire shape:**

```ts
interface GapGroup {
  key: string            // the stable bucket key
  roleTitle: string | null  // lika only; null for likvärdigt rows
  level: string | null      // lika only
  band: number | null
  womenCount: number
  menCount: number
  womenMeanComp: number | null // null when masked (insufficient) or no women
  menMeanComp: number | null
  gapPct: number | null        // null when masked or not computable
  flag: PayGapFlag
}

// return:
{
  currency: string | null   // the org's single enforced currency, from the first priced row; null if none
  lika: GapGroup[]
  likvardigt: GapGroup[]
  unbandedCount: number     // priced rows excluded from likvärdigt for a null band
}
```

The org enforces one currency for salaries (commit 5cf5c12), so `currency` is read from the first priced row and is uniform across groups; it is `null` only when the run has no priced rows at all.

**Ordering** (deterministic; grouped register, no per-column sorting): likvärdigt by `band` ascending (band 1 = highest, shown first); lika by `band` ascending, then `roleTitle`, then `level`. Null bands sort last.

The query imports `computeGenderGap` from `@workspace/core`, keeping the math as the single source (ADR-0002: the same pure engine could run client-side identically). Adding this module requires `bunx convex codegen` and staging `_generated/api.d.ts`.

### 3. The UI (`apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx`)

- **`PayMappingGap({ orgId, runId })`** issues `getPayMappingGap` and renders two sections: **Steg 1: Lika arbete** and **Steg 2: Likvärdigt arbete**. Each section is a `table-fixed` table (declared column widths on the header cells): *Grupp, Antal kvinnor, Medellön, Antal män, Medellön, Lönegap %, Flagga*. Above each table, a one-line summary counts that table's own flagged groups ("1 grupp över 10 %, 2 grupper 5-10 %") so problems surface without reordering rows. Below likvärdigt, the `unbandedCount` note ("N personer visas inte: rollen är inte färdigvärderad ännu") appears only when it is above 0.
  - lika row label: `roleTitle` + level (with band as context); likvärdigt row label: the band.
  - a ⚪ row shows "-" for both means and the gap.
  - means formatted with `useMoney()` + the returned `currency`; gap as a signed percentage (`tabular-nums`).
- **`PayGapFlagBadge({ flag })`** holds the flag-to-chip mapping in one place: traffic-light semantic colors (critical = destructive/red, elevated = amber, ok = green, insufficient = muted). A deliberate custom severity indicator, documented at its definition (severity is not a shadcn default variant). It renders the localized flag label; the color encodes state in form as well as text.
- **Skeleton (`PayMappingGapSkeleton`):** static section titles and column headers render real (a shared `PayGapTableHeader`, same precedent as `PayMappingRowsHeader`); only counts/means/gap/flag are `Skeleton` bars, centered in their text-line boxes and measured identical to data rows. Inline-flex chips (the flag badge) sit in a block flex wrapper in the cell.
- **Help:** a `HelpMorphButton` on each section heading explaining lika arbete, likvärdigt arbete, and the flag scale in plain language (new `dashboard.help.*` keys). One help popover per heading (never stacked).
- **Placement:** rendered inside `PayMappingDetail`, between the summary card and the population table. The population table gains its own section heading ("Population") so the two sections read as distinct. `PayMappingDetail` already holds the resolved `run`, so it passes `run.runId` to the gap query (no slug re-resolution, a tiny and acceptable query dependency).

The gap tables are not register tables: the number of groups is bounded and HR wants to see all of them at once, so there is no search, pagination, or per-column sorting (the grouping is the order).

### 4. i18n

New namespace `dashboard.payMapping.gap.*` in `en.json` first, then mirrored to sv/nb/da/fi:

- `likaTitle`, `likvardigtTitle`, `likaDescription`, `likvardigtDescription`
- `columns.group`, `columns.women`, `columns.womenMean`, `columns.men`, `columns.menMean`, `columns.gap`, `columns.flag`
- `flag.critical`, `flag.elevated`, `flag.ok`, `flag.insufficient`
- `summary` (ICU plural over the flagged counts), `unbanded` (ICU plural), `masked` (the "-" cell reason for help/aria)
- `empty` (a run with no priced rows)

New help keys `dashboard.help.payGapLikaLabel/Body`, `payGapLikvardigtLabel/Body`, `payGapFlagsLabel/Body`. Nordic strings are machine-translated drafts flagged for native review. Locale JSON is edited only with the Edit tool (never shell), and the i18n parity test guards key coverage.

### File structure

- Create `packages/core/src/pay-gap.ts` + `packages/core/src/pay-gap.test.ts`; export from `packages/core/src/index.ts`.
- Create `packages/backend/convex/payMapping/gap.ts` + `packages/backend/convex/payMapping/gap.test.ts`; run codegen, stage `_generated/api.d.ts`.
- Create `apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx` + `pay-mapping-gap.test.tsx`.
- Modify `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx` (insert the gap view + the "Population" heading).
- Modify the five `packages/i18n/messages/*.json`.

### Testing

- **`pay-gap.test.ts` (core, Vitest):** `classifyPayGap` at every boundary (0 women, 0 men, total under 4, `gapPct === null`, `10.0`, `> 10`, `5.0`, `< 5`, a negative gap flagged by magnitude); `computeGenderGap` (means, signed gap sign both ways, `menMean === 0` gives null gap, empty arrays give null means + insufficient).
- **`gap.test.ts` (backend, convex-test/edge-runtime):** freeze a run with a known population, call `getPayMappingGap`, assert lika + likvärdigt grouping keys, the FTE adjustment on a part-timer, ⚪ masking (means + gap null, counts present), `unbandedCount`, `currency`, and cross-org isolation (a run in another org gives `null`).
- **`pay-mapping-gap.test.tsx` (dashboard):** the four flags render their chip + label, a masked group renders "-", section titles render, the unbanded note appears only when above 0.

New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + the full `turbo run test`.

## Follow-ups (tracked, non-blocking)

- Median + base-salary + variable-pay views (guide A1/A4) as additive columns/toggles.
- The P1 completion gate + status transitions, once objective reasons (M6) + action plans (M7) exist.
- P2/P3 comparison slices; the Art. 9 export (M8) reuses this aggregate as its data source.
- Update the roadmap artifact ("Lönekartläggning progress tracker") once this slice lands.
- Nordic gap/help strings to native review.
