# Guided Kartläggning Review Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the kartläggning experience as a guided journey: the overview as the hub (journey card + sentence-first Läget), one `/analysis` review wizard in the statutory chapter order (samverkan start, praxis, lika, kvinnodominerade, finish), plain-language findings with data behind disclosure, and the extended completion gate.

**Architecture:** All heavy machinery is reused (gap engine, `getPayMappingGap`, `payMappingGroupAnalyses`, upsert/gate/audit). The backend grows three small things: the `praxis` scope + `finding` field, the `samverkan` run fields + mutation, and the gate extension. The frontend replaces the master-detail analysis with a review family of focused components driven by one pure queue-derivation module.

**Tech Stack:** Convex (orgQuery/orgMutation, convex-test), Vitest 4, Next.js 16 App Router client components, next-intl, Motion, Base UI/shadcn kit.

**Spec:** `docs/superpowers/specs/2026-07-22-guided-pay-mapping-review-journey-design.md` (read first). Research grounding: `docs/lonekartlaggning-process-och-kravbild.md`.

## Global Constraints

- **NO COMMITS.** Held-uncommitted mode: never `git add`/`git commit`/`git stash`. Finish each task with Biome + the named tests and leave the tree dirty. The controller snapshots trees.
- **Vitest 4 only**: `bunx vitest run <path>` from the owning package dir; full suite `bun run test` from the root. NEVER `bun test`.
- **Locale JSON only via the Edit tool** (never shell text tools). All five files (`en`, `sv`, `nb`, `da`, `fi`) change in the same task; en first; Nordic strings are drafts. Parity test enforces sameness; deleted keys leave ALL five files in the same task.
- **No em dashes anywhere. All user-facing text through i18n. Never a signed percent inside prose** (direction is said in words, the number is unsigned).
- `packages/core` untouched this plan. `bunx convex codegen` from packages/backend after any schema/validator change; `_generated/` is part of the change.
- Audit: new events/fields ship AUDIT_EVENTS keys, AuditPayloads entries, and event + field labels in ALL 5 locales in the same task (coverage tests enforce). Samverkan participants are names by design and NEVER enter the audit trail.
- Skeleton rules: static i18n chrome real during load; bars only for unknown data; no layout shift. Toasts per CRUD rule (continuous saves silent; done-toggle and complete/reopen toast). Gender never color-alone. Read `docs/ui-animation.md` before the transition work; animate with transform+opacity only.
- Biome via `bun x biome check --write <files>` from the root.

---

## File Structure

- `packages/constants/src/praxisAreas.ts` (new) + index export.
- `packages/backend/convex/payMapping/tables.ts` (scope union, `finding`, `samverkan`), `analyses.ts` (praxis validation), `runs.ts` (`setPayMappingSamverkan`, wire, gate extension), `lib/audit.ts` + `lib/auditPayloads.ts` (event + field).
- `apps/dashboard/components/pay-mapping/`:
  - `review-queue.ts` (+`.test.ts`): pure queue derivation, the plan's single source of step order/progress.
  - `mean-comparison-bars.tsx` (+test): the two-bar primitive (also used by the overview).
  - `pay-mapping-group-underlag.tsx` (+test): the disclosure content (members/scatter/comparison table/band context).
  - `review-start-step.tsx`, `review-praxis-step.tsx`, `review-group-step.tsx`, `review-chapter-intro.tsx`, `review-finish.tsx`, `review-jump-menu.tsx`, `review-progress.tsx`, `pay-mapping-review.tsx` (each +test where behavioral).
  - `pay-mapping-journey-card.tsx` (+test) replacing `pay-mapping-documentation-card.tsx`.
  - Modified: `pay-mapping-group-analysis-form.tsx` (switch removed), `pay-mapping-overview.tsx` (Läget + Statistik reshape), `pay-mapping-gap-types.ts` (samverkan on the run type).
  - Deleted: `pay-mapping-analysis.tsx` (+test), `pay-mapping-analysis-tabs.tsx` (+coverage in site-header tests), `pay-mapping-documentation-card.tsx` (+test), the `/analysis/likvardigt` route.
- `apps/dashboard/components/site-header.tsx`: second row removed.

Step components are pure-props units: `{step data, locked, onNext, onPrevious, onSkip}`; only the shell (`pay-mapping-review.tsx`) knows navigation. That is what makes Tasks 6-10 independently testable before the shell exists.

---

### Task 1: PRAXIS_AREA_KEYS in @workspace/constants

**Files:** Create `packages/constants/src/praxisAreas.ts`, `packages/constants/src/praxisAreas.test.ts`; modify `packages/constants/src/index.ts`.

**Interfaces (produces):**

```ts
export const PRAXIS_AREA_KEYS = [
  "payPolicy",
  "collectiveAgreements",
  "benefits",
  "payPractices",
  "previousActions",
] as const
export type PraxisAreaKey = (typeof PRAXIS_AREA_KEYS)[number]
// The areas every run reviews; previousActions applies only when the org
// has an earlier completed kartläggning.
export const BASE_PRAXIS_AREA_KEYS: readonly PraxisAreaKey[]  // the first four
```

- [ ] **Step 1: failing test**

```ts
// packages/constants/src/praxisAreas.test.ts
import { describe, expect, it } from "vitest"
import { BASE_PRAXIS_AREA_KEYS, PRAXIS_AREA_KEYS } from "./praxisAreas"

describe("praxis areas", () => {
  it("lists the statutory review areas with previousActions last", () => {
    expect(PRAXIS_AREA_KEYS).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
      "previousActions",
    ])
  })
  it("keeps the base set free of the conditional area", () => {
    expect(BASE_PRAXIS_AREA_KEYS).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
    ])
  })
})
```

- [ ] **Step 2: run RED** `cd packages/constants && bunx vitest run src/praxisAreas.test.ts`
- [ ] **Step 3: implement** (module comment: the lönebestämmelser & praxis review areas per DL 3 kap. 8 § p1; i18n at `dashboard.payMapping.review.praxis.<key>.*`):

```ts
export const PRAXIS_AREA_KEYS = [
  "payPolicy",
  "collectiveAgreements",
  "benefits",
  "payPractices",
  "previousActions",
] as const
export type PraxisAreaKey = (typeof PRAXIS_AREA_KEYS)[number]

export const BASE_PRAXIS_AREA_KEYS: readonly PraxisAreaKey[] =
  PRAXIS_AREA_KEYS.filter((key) => key !== "previousActions")
```

Export both + the type from `index.ts`.

- [ ] **Step 4: run GREEN**, then the whole package (`bunx vitest run`).
- [ ] **Step 5: Biome**; leave uncommitted.

---

### Task 2: Backend praxis scope + finding field

**Files:** Modify `packages/backend/convex/payMapping/tables.ts`, `analyses.ts`, `lib/audit.ts` (GROUP_ANALYSIS_AUDIT_FIELDS), `packages/i18n/messages/*.json` (one field label ×5), `apps/dashboard/lib/audit-labels.test.ts` (if the constant list needs the new field registered; read it). Test: `packages/backend/convex/payMapping/analyses.test.ts` (extend).

**Interfaces (produces):**
- `payMappingGroupAnalyses.scope`: `v.union(v.literal("lika"), v.literal("likvardigt"), v.literal("praxis"))`; new `finding: v.optional(v.union(v.literal("none"), v.literal("found")))`.
- `upsertGroupAnalysis` args gain `finding: v.optional(...)` (same union). Wire shape `groupAnalysisShape` gains `finding: v.union(v.literal("none"), v.literal("found"), v.null())` (returned as `row.finding ?? null`); the frontend `GroupAnalysis` type is extended in Task 5.
- Praxis validation in the handler, inserted after the existing group-key validation branch (which must now run ONLY for lika/likvardigt):

```ts
if (scope === "praxis") {
  if (!(PRAXIS_AREA_KEYS as readonly string[]).includes(groupKey))
    throw appError(ERROR_CODES.notFound)
  if (reasons.length > 0) throw appError(ERROR_CODES.invalidInput)
  // Done requires a verdict; found deficiencies require a description.
  if (done && finding === undefined)
    throw appError(ERROR_CODES.payMappingDocumentationRequired)
  if (done && finding === "found" && trimmedNote === "")
    throw appError(ERROR_CODES.payMappingDocumentationRequired)
} else {
  // existing keys/required checks for lika/likvardigt, unchanged
}
```

`next` gains `finding` (stored only for praxis; strip/ignore for group scopes: `...(scope === "praxis" && finding !== undefined ? { finding } : {})`). `auditView` gains `finding: row?.finding ?? null`; `GROUP_ANALYSIS_AUDIT_FIELDS` becomes `["reasons", "note", "done", "finding"] as const`. The audit `groupLabel` for praxis must NOT split on "|": when scope is praxis use the raw area key as `groupLabel` (it is a constant slug, not an internal id; the auditLog field label explains it) OR better: resolve to nothing and set `groupLabel: groupKey`. Pin: `const groupLabel = scope === "praxis" ? groupKey : [roleTitle, level].filter(...)...` with a comment.
- i18n: `dashboard.auditLog.fields.finding` en "Assessment" (sv "Bedömning", + nb/da/fi drafts) ×5.

- [ ] **Step 1: failing tests** (extend analyses.test.ts): praxis upsert happy path (area key `payPolicy`, `finding: "none"`, done true, no reasons/note) round-trips via `listGroupAnalyses` with `finding: "none"`; unknown praxis key rejects notFound; non-empty reasons reject invalidInput; done without finding rejects payMappingDocumentationRequired; done with `finding: "found"` and empty note rejects; with a note succeeds; audit row's changes include a `finding` entry; group-scope upserts still work untouched (existing tests stay green).
- [ ] **Step 2: run RED** `cd packages/backend && bunx vitest run convex/payMapping/analyses.test.ts`
- [ ] **Step 3: implement** per the interfaces (import `PRAXIS_AREA_KEYS` from `@workspace/constants`); `bunx convex codegen`.
- [ ] **Step 4: run GREEN** + dashboard audit-label tests + i18n parity + root typecheck.
- [ ] **Step 5: Biome**; leave uncommitted.

---

### Task 3: Backend samverkan

**Files:** Modify `packages/backend/convex/payMapping/tables.ts` (run field), `runs.ts` (mutation + wire), `lib/audit.ts` + `lib/auditPayloads.ts` (event), `packages/i18n/messages/*.json` (event label ×5), `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (+ fixtures that typecheck flags). Test: `packages/backend/convex/payMapping/runs.test.ts` (extend).

**Interfaces (produces):**
- `payMappingRuns.samverkan: v.optional(v.object({ participants: v.string(), description: v.string() }))`.
- `setPayMappingSamverkan` (orgMutation): args `{runId, participants: v.string(), description: v.string()}`, returns v.null(). Org check -> notFound; completed run -> payMappingRunCompleted; trims both; when BOTH trim empty, clears the field (`ctx.db.patch(runId, { samverkan: undefined })`), else patches the object. Audit: `AUDIT_EVENTS.payMappingSamverkanUpdated: "payMapping.samverkanUpdated"`, payload `{ runId: string }` ONLY (marker event; participants are names by design and never enter the trail; comment this). Event label en "Samverkan updated" (sv "Samverkan uppdaterad") ×5.
- `getPayMappingRunBySlug` returns `samverkan: v.union(v.object({participants: v.string(), description: v.string()}), v.null())` (`run.samverkan ?? null`); `PayMappingRunDetail` gains `samverkan: { participants: string; description: string } | null`; fixtures (`RUN` in run-shell test, `RUN_2026` in site-header test) gain `samverkan: null`.

- [ ] **Step 1: failing tests**: set + read back via the slug query; whitespace-only both fields clears to null; completed run rejects; cross-org rejects notFound; exactly one `payMapping.samverkanUpdated` audit row whose payload has ONLY `runId` (assert `Object.keys(payload)` = `["runId"]`, and `JSON.stringify(payload)` does not contain a seeded participant name).
- [ ] **Step 2: run RED.**
- [ ] **Step 3: implement**; `bunx convex codegen`; extend the frontend type + fixtures.
- [ ] **Step 4: run GREEN** + parity + dashboard audit-label tests + root typecheck (fix any fixture it flags, minimally).
- [ ] **Step 5: Biome**; leave uncommitted.

---

### Task 4: Gate extension (praxis + samverkan)

**Files:** Modify `packages/backend/convex/payMapping/runs.ts` (completePayMappingRun). Test: `runs.test.ts` (extend).

**Interfaces:** the gate now ALSO requires: (a) `run.samverkan` present with both fields non-empty after trim; (b) a done analyses row (scope `praxis`) for every applicable praxis area: `BASE_PRAXIS_AREA_KEYS` always, plus `previousActions` when the org has another run with `status === "completed"` and `referenceDate < run.referenceDate` (query `payMappingRuns.by_org`). Unmet -> the existing `payMappingGateUnmet`. Audit payload unchanged (counts stay group counts).

- [ ] **Step 1: failing tests**: with groups documented but no samverkan -> gateUnmet; with samverkan + groups but missing a praxis area -> gateUnmet; all base areas + samverkan + groups -> completes (org with no previous run must NOT require previousActions); an org with an earlier completed run requires `previousActions` too (seed two runs: complete the first via the full path, then gate-check the second).
- [ ] **Step 2: run RED.** **Step 3: implement** (helper `applicablePraxisKeys(ctx, run)` inside runs.ts, exported for reuse-by-test; comment cites 8 § p1 + dokumentationens utvärderingsdel). **Step 4: GREEN** (whole payMapping folder). **Step 5: Biome.**

---

### Task 5: review-queue.ts (pure derivation)

**Files:** Create `apps/dashboard/components/pay-mapping/review-queue.ts`, `review-queue.test.ts`. Modify `pay-mapping-gap-types.ts` (`GroupAnalysis` gains `finding: "none" | "found" | null`).

**Interfaces (produces, consumed by every later task):**

```ts
export type ReviewStep =
  | { kind: "start" }
  | { kind: "praxis"; area: PraxisAreaKey }
  | { kind: "chapterIntro"; chapter: "lika" | "likvardigt" }
  | { kind: "group"; scope: "lika"; group: GapGroup }
  | { kind: "group"; scope: "likvardigt"; group: WomenDominatedGroupWire }
  | { kind: "finish" }

export interface ReviewQueue {
  steps: ReviewStep[]
  // Index of the first actionable step whose done-state is unmet; the
  // finish index when everything is done.
  resumeIndex: number
  // Actionable progress (intros/finish excluded): done / total, per chapter
  // and overall.
  progress: {
    overall: { done: number; total: number }
    praxis: { done: number; total: number }
    lika: { done: number; total: number }
    likvardigt: { done: number; total: number }
    samverkanDone: boolean
  }
}

export function stepKey(step: ReviewStep): string  // stable per step, for React keys + jump targets
export function isStepDone(step: ReviewStep, input: ReviewQueueInput): boolean
export function buildReviewQueue(input: ReviewQueueInput): ReviewQueue

export interface ReviewQueueInput {
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  samverkan: { participants: string; description: string } | null
  hasPreviousCompletedRun: boolean
}
```

Rules (all from the spec): step order start -> praxis areas (BASE + conditional previousActions last) -> chapterIntro lika -> lika groups requiring documentation, attention-sorted worst-first (port `sortGroupsByAttention` here from pay-mapping-analysis.tsx as an internal helper; it moves home in Task 11's deletion) -> chapterIntro likvardigt -> womenDominated groups with comparisons.length > 0, engine order -> finish. Done: start = samverkan non-null with both fields non-empty; praxis/group = a matching analyses row (scope+key) with done true. `resumeIndex` skips intros (an intro is passed when the NEXT actionable step is the resume target; simplest: resumeIndex = index of first actionable undone step, else the finish index). Progress counts actionable steps only.

- [ ] **Step 1: failing tests** (fixtures reuse the shapes from pay-mapping-analysis.test.tsx history: a small GAP with 2 requiring lika groups + 1 ok group + 1 women-dominated with a comparison + 1 without): full ordering incl. conditional previousActions on/off; ok-flag lika groups and zero-comparison wd groups excluded from steps; resumeIndex with nothing done = 0; with samverkan done = first praxis step; with everything done = finish index; progress counts (per chapter + overall + samverkanDone); stepKey uniqueness across all steps.
- [ ] **Step 2: RED** (`cd apps/dashboard && bunx vitest run components/pay-mapping/review-queue.test.ts`). **Step 3: implement.** **Step 4: GREEN + root typecheck.** **Step 5: Biome.**

---

### Task 6: MeanComparisonBars primitive

**Files:** Create `apps/dashboard/components/pay-mapping/mean-comparison-bars.tsx`, `.test.tsx`. Modify `packages/i18n/messages/*.json`.

**Interfaces:** `MeanComparisonBars({ womenMean, menMean, currency }: { womenMean: number; menMean: number; currency: string })`. Two horizontal bars scaled to the larger mean (never color-alone: each row = a text label kvinnor/män + the bar + the money value; bars use `var(--gender-woman)`/`var(--gender-man)` via inline style or the chart tokens the overview charts already use: read `pay-mapping-overview.tsx` and mirror its token access). Bar heights fixed (h-3, rounded), row layout with a fixed label column so the two rows align; money via `useMoney`. Accessible: the visual is decoration over the text rows (`aria-hidden` on the bar divs). i18n: labels reuse `dashboard.payMapping.gap.columns.women/men` if present (grep; else add `review.women`/`review.men` en "Women"/"Men" ×5).

- [ ] Steps: failing test (renders both labels + money values; bar widths proportional: with 50 000 vs 100 000 the women bar style width is 50 %), RED, implement, GREEN, Biome.

---

### Task 7: Group underlag component + form switch removal

**Files:** Create `apps/dashboard/components/pay-mapping/pay-mapping-group-underlag.tsx`, `.test.tsx`. Modify `pay-mapping-group-analysis-form.tsx` (+ its test), `pay-mapping-analysis.test.tsx` (only the assertions on the removed switch).

**Interfaces (produces):**

```tsx
export function PayMappingGroupUnderlag(props:
  | { scope: "lika"; group: GapGroup; rows: PayMappingSnapshotRow[]; currency: string; referenceDateMs: number }
  | { scope: "likvardigt"; group: WomenDominatedGroupWire; likvardigt: GapGroup[]; rows: PayMappingSnapshotRow[]; currency: string; referenceDateMs: number })
```

A Collapsible (check `ls packages/ui/src/components | grep -i collapsib`; if absent use the Base UI pattern an existing app surface uses; else add via shadcn CLI per the vendor rule) closed by default, trigger label `review.showUnderlag` en "Show the underlying data" (chevron rotates). Content is MOVED-BY-COPY from pay-mapping-analysis.tsx (which stays untouched until Task 11; note the deliberate short-lived duplication in the component comment for the reviewer): lika = the member table + `PayMappingScatter` scoped by `groupMembers`; likvardigt = the full comparison table + band-context sentence block + scatter over the comparison set. Reuse the existing helpers (`groupMembers` is exported from pay-mapping-analysis.tsx today: import from there for now; Task 11 moves it here). The likvärdigt underlag help body gains the lönespridning sentence (update `dashboard.help.payGapScatterBody` or the likvärdigt body per current key layout, ×5).

Form change: remove the Klarmarkerad switch section + `doneId`/Switch import from `pay-mapping-group-analysis-form.tsx`; the form's remaining public contract (`requiresDocumentation`, `locked`, autosaving chips/note, error mapping) is unchanged, plus a new prop callback `onDocumentationChange?: (payload: { reasons: PayGapReason[]; note: string; documented: boolean }) => void` fired on every local reasons/note change with the CURRENT local state (`documented = reasons.length > 0 || note.trim() !== ""`). This is the wizard's whole window into the form: Task 9's primary button gates on `documented` and sends `reasons`/`note` with its `done: true` upsert, so the payload must always mirror what the form would itself save. Update the form tests (switch assertions become onDocumentationChange payload assertions); adjust the old analysis test only where it asserted the switch.

- [ ] Steps: failing tests (underlag: collapsed by default, expands to show member rows for lika / comparison table for likvardigt; form: no switch role, callback fires with false -> true when a chip toggles), RED, implement, GREEN (`bunx vitest run components/pay-mapping/`), Biome.

---

### Task 8: Start step + praxis step components

**Files:** Create `review-start-step.tsx`, `review-praxis-step.tsx` (+ tests). Modify locale files.

**Shared step contract (all step components):** props `{ locked: boolean, onNext: () => void, onPrevious?: () => void, onSkip?: () => void }` plus their data; they render the card ONLY (the shell owns progress header + transitions). Action row anatomy (shared tiny component `review-step-actions.tsx`, create in this task): `[Föregående (outline, hidden when onPrevious undefined)] [Hoppa över (ghost)] [primary]`, primary label + disabled-state + muted hint passed as props.

**Start step:** intro copy (what a kartläggning is, the four-step cycle, that the journey produces the statutory documentation; one HelpMorphButton for samverkan: cites 11-12 §§ rights in plain words). The samverkan form: two labeled Textareas (participants, description) autosaving via `setPayMappingSamverkan` on blur + 800 ms debounce (mirror the group form's guarded save: lastSaved ref + no-op skip + focus guard; failures toast error, saves silent). Primary "Fortsätt" is NEVER disabled (navigation), but a muted hint `review.samverkanHint` states the gate needs both fields before completion. Locked: read-only textareas + existing lockedHint pattern.

**Praxis step:** props add `{ area: PraxisAreaKey, analysis: GroupAnalysis | undefined, runId }`. Card: title + question + helper from `review.praxis.<area>.*`; the two-choice control (two Buttons `variant={active ? "secondary" : "outline"}` with `aria-pressed`, labels `review.findingNone` en "No deficiencies found" / `review.findingFound` en "Deficiencies or unclarities found"); a Textarea (required when found; helper `review.praxisNoteHelper`); saves via `upsertGroupAnalysis` with `scope: "praxis"`, `groupKey: area`, `reasons: []`, `finding`, note (choice saves immediately, note on blur/debounce, same guards). Primary "Klarmarkera och gå till nästa" disabled until a choice exists and (when found) a non-empty note, hint `review.praxisPendingHint`; on click upsert `done: true` then `onNext()` (toast per done rule). A done step renders its state + "Ångra klarmarkering" (`review.undoDone`) firing `done: false`.

i18n (en + 4 drafts): the five `review.praxis.<key>.{title,question,helper}` sets exactly as speced (payPractices helper includes the parental-leave caveat; previousActions helper cites the evaluation duty), `review.{samverkanTitle,samverkanParticipants,samverkanDescription,samverkanHint,findingNone,findingFound,praxisNoteHelper,praxisPendingHint,undoDone,continue,skip,previous,markDoneNext}` plus `dashboard.help.{samverkanLabel,samverkanBody}` and the start-intro copy keys `review.{introTitle,introBody,cycleBody}`.

- [ ] Steps: failing tests (start: fields render + autosave fires the mutation on blur + never-disabled primary; praxis: choice gates primary, found requires note, upsert payload exact incl. scope/groupKey/finding, undo path, locked read-only), RED, implement, GREEN, parity, Biome.

---

### Task 9: Group step component

**Files:** Create `review-group-step.tsx` (+test). Modify locale files.

**Props:** `{ scope, group (GapGroup | WomenDominatedGroupWire), analysis, runId, locked, rows, currency, referenceDateMs, requiresDocumentation, onNext, onPrevious, onSkip }`.

**Card anatomy top-to-bottom:**
1. Heading: group label + `PayGapFlagBadge` + band Badge (existing `gap.bandLabel`).
2. **The finding sentence** (`review.finding.*`, ICU, unsigned percents, en values):
   - `likaLess`: "The women in this group earn on average {gap} less than the men ({women} women · {men} men)."
   - `likaMore`: same with "more".
   - `likaNone`: "There is no measurable pay difference between the women and the men in this group ({women} women · {men} men)."
   - `likaOnlyWomen` / `likaOnlyMen`: "This group has only women ({count} people), so there is no woman-man comparison to make. Explain why the group looks this way." (mirrored)
   - `wdLead`: "{label} is women-dominated ({share} women)." + `wdComparisons`: "{count, plural, one {One equally or lower valued job earns more on average.} other {# equally or lower valued jobs earn more on average.}}"
   - Comparator lines (likvardigt, a plain list under the lead): `review.finding.wdComparator`: "{label} (band {band}) earns {diff} more per month on average." (money via useMoney).
3. `MeanComparisonBars` (lika only, both means non-null).
4. The re-skinned `PayMappingGroupAnalysisForm` (chips + note; `onDocumentationChange` wired to local state).
5. `PayMappingGroupUnderlag`.
6. `review-step-actions`: primary `review.markDoneNext` disabled while `requiresDocumentation && !documented` (hint = existing `analysisForm.donePendingHint`); on click upsert `done: true` (scope-correct payload preserving current reasons/note from the form via a ref callback: simplest correct contract: the form exposes `getCurrentDocumentation(): {reasons, note}` through a forwarded ref OR the step keeps chips/note state itself: DECIDE: the step passes `onDocumentationChange` with the full `{reasons, note, documented}` payload so the step owns what it sends with done; pin this contract in both files) then `onNext()`. Done state shows "Ångra klarmarkering". Skip/previous always available; locked = read-only + lockedHint.

- [ ] Steps: failing tests (sentence variant per fixture: less/more/none/onlyWomen/wd with comparator lines; bars only for mixed lika; primary gated then enabled after chip; upsert payload carries the form's current reasons+note+done; undo; locked), RED, implement (update `onDocumentationChange` in the form to the full-payload contract in the same task), GREEN (form + group-step + underlag tests), parity, Biome.

---

### Task 10: Chapter intros, jump menu, finish screen

**Files:** Create `review-chapter-intro.tsx`, `review-jump-menu.tsx`, `review-finish.tsx` (+tests for jump menu + finish). Modify locale files.

- **Chapter intro:** static card per chapter: title + body (lika: groups from actual work content not titles; every difference analyzed regardless of size; the 5/10 % flags are the tool's prioritization. likvardigt: kvinnodominerad explained; 60 % is DO's riktpunkt, not statute) + HelpMorphButtons reusing/adding `dashboard.help` keys; actions = previous + primary "Fortsätt".
- **Jump menu:** a Sheet (`packages/ui` sheet; check exports) triggered from the progress header (`review.allSteps` en "All steps"). Contents grouped by chapter: start + praxis areas (status icon done/undone), lika: ALL lika groups from `gap.lika` (queue members AND non-queue ✅/zero-comparison ones) each with its unsigned gap text + status (`review.status.{toReview,done,noRemark,justified}`: ✅ groups show "{gap} · no remark", ⚪ documented show "justified"); likvardigt: ALL womenDominated groups (zero-comparison: `review.status.noComparators` "no higher-paid comparisons"); a `TableSearchField` (`className="w-full"`) filtering by label. Selecting closes the sheet and jumps: queue steps by stepKey; NON-queue groups open as a group step with `requiresDocumentation: false` (the shell supports an "extra step" overlay state: pin in Task 11's shell contract: `openExtraGroup(scope, key)`).
- **Finish screen:** heading + the documentation mirror: samverkan summary (participants/description or the missing-warning), praxis results list (area + finding + note excerpt), ALL groups with gap + status (same status labels), the M7 note (`review.finishActionsNote` en "Pay adjustments, cost estimate and the three-year time plan are added in the action plan."), and the primary CTA: gate met -> "Slutför kartläggningen" calling `completePayMappingRun` (toast; on `payMappingGateUnmet` error toast); gate unmet -> disabled with the remaining-count hint (reuse the journey-card math via `buildReviewQueue().progress`); completed run -> completed note + Återöppna (AlertDialog, moved intact from the documentation card in Task 12: for THIS task render the completed note only and leave reopen to the overview: pin: reopen lives ONLY on the overview journey card; finish screen shows `documentation.completedNote` + a link to the overview).

- [ ] Steps: failing tests (jump menu lists non-queue ✅ group with gap + opens it via callback; search filters; finish lists all statuses + gated CTA + fires complete; completed state), RED, implement, GREEN, parity, Biome.

---

### Task 11: The shell + route swap + deletions

**Files:** Create `pay-mapping-review.tsx`, `review-progress.tsx` (+ `pay-mapping-review.test.tsx`). Modify `app/(app)/pay-mappings/[slug]/analysis/page.tsx`, `components/site-header.tsx` (+ test), `pay-mapping-tabs.test.tsx` if it referenced the submenu. Delete: `app/(app)/pay-mappings/[slug]/analysis/likvardigt/` (whole dir), `pay-mapping-analysis-tabs.tsx`, `pay-mapping-analysis.tsx` + `.test.tsx`. Move `groupMembers` + `sortGroupsByAttention` into their new owners (`pay-mapping-group-underlag.tsx` / `review-queue.ts`) and update imports. Locale files: DELETE the orphaned keys (grep each candidate first: `gap.tabs.*`, `gap.searchGroups`, `gap.allDone`, `gap.noGroups`, `gap.comparisonCount`, `gap.likaTitle`, `gap.likvardigtTitle`, `gap.likaDescription`, `gap.likvardigtDescription`, `gap.groupMembers`, `gap.bandRoles`-style leftovers, the payGapLika/payGapLikvardigt help IF unused after the chapter intros: keep what the intros reuse) from all five files.

**Shell contract:** reads `usePayMappingRun()` (+ `useQuery(listPayMappingRuns)` for `hasPreviousCompletedRun`), builds the queue, holds `stepIndex` state initialized to `resumeIndex` once data resolves, plus the `extraGroup` overlay state for non-queue groups (`openExtraGroup(scope, key)` from the jump menu; closing returns to the current step). Renders `review-progress` (chapter name via `review.chapters.{praxis,lika,likvardigt}`, `review.stepCounter` en "Step {current} of {total}", dots or a thin progress bar, the jump-menu trigger) + the step body inside `AnimatePresence mode="wait" initial={false}` with a direction-aware transition: `initial={{opacity: 0, x: direction * 24}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: direction * -24}} transition={{duration: 0.2}}` (transform+opacity only per docs/ui-animation.md; read it first; direction = +1 forward / -1 back). Loading (gap/analyses/run undefined): the progress chrome real with a bar for the counter numbers, a skeleton card body. `gap.currency === null` -> the existing empty text. The route page becomes `<PayMappingReview />` inside the run context (mirror the old page's thinness).

**Site-header:** remove the `AnimatePresence` second row + `inPayMappingAnalysis` + the `PayMappingAnalysisTabs` import (single-row header again); update its tests (submenu assertions deleted; run tabs + switcher assertions stay).

- [ ] Steps: failing shell tests first (resume lands on first undone; next/skip/previous move; done-advance on a group step via the wired mutation mock; jump to a non-queue group opens extra state; finish reachable; loading chrome real), RED, implement + deletions + key sweep, GREEN: `bunx vitest run components/pay-mapping/ components/site-header.test.tsx`, parity, dead-key greps (`grep -rn "singleGenderHidden\|gap.tabs\|searchGroups\|likvardigtTitle" apps packages --include="*.ts*" --include="*.json" | grep -v ".next"` clean for the deleted set), root typecheck, Biome.

---

### Task 12: Overview hub (journey card + Läget + Statistik)

**Files:** Create `pay-mapping-journey-card.tsx` (+test). Modify `pay-mapping-overview.tsx` (+test). Delete `pay-mapping-documentation-card.tsx` + `.test.tsx` and `FlagSummary` (in overview). Locale files: new journey keys; delete orphaned documentation-card keys ONLY where the journey card does not reuse them (reuse `documentation.complete`, `reopen*`, `completedNote`, toasts; grep each before deleting).

**Journey card:** consumes `usePayMappingRun()` + `useQuery(listPayMappingRuns)`; derives progress via `buildReviewQueue` (single source with the wizard). Renders the four chapter rows (`review.chapters.start` en "Get started and samverkan" + the three others) each with state text (`journey.state.{notStarted,inProgress,done}` + "x of y" for countable chapters, samverkan shows done/not), and the single CTA: gate unmet -> Link-button "Fortsätt granskningen" to `/pay-mappings/{slug}/analysis` + muted remaining hint (`documentation.remaining` reused); gate met + active -> the Complete button (move the guarded `handleComplete` + toast from the documentation card verbatim); completed -> completedNote + Reopen AlertDialog (moved verbatim). Loading: real title/help, skeleton rows in min-h-5 line boxes, real disabled CTA.

**Overview reshape:** order = journey card (full width) -> Läget row (`GapStat` reshaped: sentence-first via the `review.finding.orgLess/orgMore/orgNone` keys en "Women earn on average {gap} less than men across the whole pay mapping." etc., above `MeanComparisonBars` with the org means; flag chip beside the heading; keep the existing card/skeleton discipline) + the equality clock -> `overview.statisticsHeading` en "Statistics" + the three charts unchanged. `FlagSummary` deleted (its i18n keys removed ×5 if unused elsewhere; grep).

- [ ] Steps: failing tests (journey card states/CTA targets/complete/reopen/loading; overview renders journey + sentence-led gap + statistics heading; FlagSummary gone), RED, implement, GREEN (`components/pay-mapping/`), parity, root typecheck, Biome.

---

### Task 13: Final sweep + full gate

- [ ] **Step 1:** Dead-reference greps: `PayMappingAnalysis\b`, `PayMappingAnalysisTabs`, `PayMappingDocumentationCard`, `FlagSummary`, plus every deleted i18n key (list from Tasks 11-12) -> zero hits outside `.next`. `grep -rn "—" apps/dashboard/components/pay-mapping packages/i18n/messages packages/backend/convex/payMapping` clean; mojibake grep clean.
- [ ] **Step 2:** `bun run typecheck` (9/9) and `bun run test` (8/8) from the root.
- [ ] **Step 3:** Verify the spec's Deviations section stays empty or record real ones. Leave everything uncommitted; report per-task status to the controller.

---

## Self-review notes

- Spec coverage: spec §1 -> Task 12; §2 -> Task 11; §3 -> Task 5; §4 -> Tasks 3+8; §5 -> Tasks 1+2+8; §6 -> Tasks 6+7+9; §7 -> Task 10; §8 -> Tasks 11+12; §9 -> Tasks 2-4; §10 -> in every UI task + sweeps in 11-12; §11 -> distributed; out-of-scope respected (no M7/M8/EU work).
- Type consistency: `ReviewStep`/`buildReviewQueue`/`stepKey` names match across Tasks 5, 10, 11, 12; the form's `onDocumentationChange` full-payload contract is defined in Task 7 and consumed in Task 9 (Task 9 explicitly updates it: implementers of 7 ship the boolean-or-payload contract as pinned in 9: FINAL contract = `onDocumentationChange(payload: {reasons: PayGapReason[], note: string, documented: boolean})`, implemented in Task 7 already so Task 9 only consumes).
- Judgment calls pinned: reopen lives only on the overview; praxis audit groupLabel = the area key; participants never audited; short-lived underlag duplication until Task 11; step position is client state.
