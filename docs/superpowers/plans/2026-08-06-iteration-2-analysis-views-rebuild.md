# Iteration 2: Pay-mapping analysis views rebuild. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan slice-by-slice. Each slice (A-F) is sized for its own spec -> plan -> build cycle per the repo convention (`docs/pay-mapping-analysis-teardown-and-plan.md` sets the precedent); this document is the master plan that fixes interfaces, decisions, and sequencing so each slice can start without re-analysis.

**Goal:** Rebuild the lika/likvärdigt arbete analysis views per the Iteration 2 system notes (2026-08-06): entry conditions that hide non-comparable groups, individual-level detail views with dot plots, an explicit cross-level (tvärnivå) check, an opt-in deep-dive for gender-pure groups, and the M7 åtgärd/notering layer with a dedicated actions overview.

**Architecture:** All new analysis math is pure functions in `packages/core` (deterministic, snapshot-in/result-out), consumed by both `payMapping/gap.ts` server-side (gate authority) and the dashboard client-side (detail views compute from the already-subscribed snapshot rows). Actions and notes are new work-layer tables keyed to the run (ADR-0011 two-layer model). The guided wizard and the Analysis tab stay the primary flow; the new detail content replaces today's group-step underlag.

**Tech Stack:** Convex (packages/backend), packages/core pure engine, Next.js 16 dashboard, TanStack table v9, recharts via shadcn ChartContainer, react-hook-form + Zod, next-intl (en/sv/nb/da/fi).

**Source spec:** "Systemnoteringar – Iteration 2" (2026-08-06, five notes, delivered in conversation; not a repo file). Governing decisions: ADR-0011, ADR-0012, ADR-0013, ADR-0014, `docs/lonekartlaggning-process-och-kravbild.md`.

## Global constraints

- All analysis reads the frozen snapshot (`payMappingSnapshotRows`), never live data (ADR-0011). The notes' "räkna mot snapshot, inte live" is already how the system works; keep it that way in every new query and view.
- Level 1 = highest. The notes' "kvinna på högre nivå" translates to `level_woman < level_man` numerically. Never invert this.
- ADR-0014 vocabulary: the notes say "band"/"level"/"track"; in code these are `level` (the computed weight), `seniority` (the individual's), `trackKey`. The notes' grouping "job_title + band + level" is exactly today's equal-work key `roleTitle|level|seniority` (`payMapping/gap.ts`).
- Gender is encoded by fill texture/outline in one brand ink, never hue (CLAUDE.md, `components/gender-mark.tsx`). The notes' "lila/rosa vs blå" is implemented as women = solid `GENDER_DOT`, men = outlined, exactly like the existing scatter. Non-negotiable.
- No emoji flags. The notes' 🔴/🟠/✅ render through the existing `PayGapFlagBadge` (`components/pay-mapping/pay-gap-flag-badge.tsx`) and the ADR-0012 thresholds, which match the notes (>10% / 5-10% / <5%).
- Per-row actions live behind a single `...` `DropdownMenu` trigger, never inline buttons (CLAUDE.md). The notes' per-row "Notering / Åtgärd"-knapp becomes menu items plus a status badge in a pre-reserved slot.
- Every new string in `en.json` first, mirrored to sv/nb/da/fi in the same change; machine translations flagged for native review. No em dashes in copy.
- Every new mutation: org-scoped, audit event + payload contract + category + subject + field labels + coded-value labels in all locales, in the same change (CLAUDE.md audit invariant).
- Role != Person: action/note rows never denormalize a person's name or salary; they carry `personPublicId` only and resolve display values from the snapshot row at read time (which the erasure path already pseudonymizes).
- Forms: `makeXSchema(t)` factories, `mode: "onTouched"`, submit gated on `isValid` (+ `isDirty` for edit forms), dialog anatomy per CLAUDE.md. CRUD toasts. Content-shaped skeletons. Tables per the table anatomy (default sort, `TableSortButton`, `table-fixed`, `TablePagination` past 25 rows).
- New code ships with tests in the same commit; Vitest 4 via `bun run test`; Biome at zero.
- Schema changes end with a live dev-deployment migration + browser pass on localhost:3001 (wipe -> deploy -> seed when validators narrow).

---

## 1. What the notes ask vs what exists

| Notering | Asks for | Exists today | Delta |
|---|---|---|---|
| 1. Singleton exclusion | Groups with <2 individuals silently removed everywhere | Shown as ⚪ insufficient, documentation-required | Filter + gate change (Slice A) |
| 2. Gender-pure groups | Out of the primary flow; separate opt-in deep-dive with full stats and individual data | Shown as ⚪ insufficient, documentation-required | Filter + gate change + new deep-dive surface (A, D) |
| 3. Lika arbete entry condition + detail | Show only groups with both genders AND women's mean < men's; women-earn-more groups to a separate info view; individual table with per-person diffs; swimlane dot plot; summary row | Groups always listed; group-level means only (`MeanComparisonBars`); member table shows name/gender/salary without diffs; scatter is age/tenure vs TCC, not the swimlane form | Entry-condition engine + full detail-view rebuild (A, B) |
| 4. Likvärdigt detail + tvärnivå | Per-level detail with level/track/title columns; individual-level cross-level pair check with a dedicated section and visual pairing | Per-level groups + group-mean women-dominated cross-comparison (`womenDominatedComparisons`, DL 3:9) | New individual-level pair engine + detail view; the statutory group-level comparison stays (A, C) |
| 5. Åtgärder + noteringar + översikt | Formal actions (owner, date, cost, priority, status) and informal notes at group/individual/pair level; dedicated overview with filters, status updates, summary bar | Only `payMappingGroupAnalyses` (group-level reasons + note + done). M7 is greenfield and already "recommended next" | The M7 build, now concretely specced (E, F) |

Note: the notes' statistics list (min, median, medel, max, standardavvikelse) requires extending the mean-only core engine. This is the same "medians next" item already tracked; it lands in Slice A and also unlocks the EU Art. 9 metrics for M8.

## 2. Spec deviations (notes vs binding project rules)

These are places where the plan deliberately implements the notes' *intent* with different *mechanics*. Each is settled by an existing invariant; none needs a new decision:

1. **Gender hue -> texture/outline** (notes 3-4): women solid, men outlined, brand ink, `GENDER_DOT`/`GenderLegend`/`GenderTooltipContent`.
2. **Emoji flags -> `PayGapFlagBadge`** (note 3): same thresholds, WCAG-AA chip.
3. **Inline row buttons -> `...` row dropdown + status badge** (note 5): "Skapa åtgärd" / "Lägg till notering" as `DropdownMenuItem`s; existing documentation indicated by a badge in a fixed slot (layout-shift rule).
4. **Status color coding** (note 5: orange/blå/grå/grön): implemented as Badge variants on dedicated status tokens (the `--flag-*` token precedent), not ad hoc colors; labels always visible, color never the only carrier.
5. **Reason codes** (note 5: PERF/EXP/SKILL/MARKET/RETENTION/LEGACY/NEGO/GEO/OTHER): mapped onto the existing `PAY_GAP_REASONS` taxonomy (`packages/constants/src/payGapReasons.ts`) rather than a second enum; add any genuinely missing code (e.g. GEO) to the existing taxonomy with labels in all locales. One taxonomy, everywhere (`resolveCodedValue` rule).
6. **Summary-row numbers** that update live (counts, total cost in the åtgärdsöversikt) render through NumberFlow per the live-numbers rule.

## 3. Decisions needing Christian (each with a recommendation; the plan assumes the recommendation unless overridden)

1. **ADR amendment.** Notes 1-3 change ADR-0012 semantics: ⚪ groups (singletons, gender-pure) leave the primary view and lose their documentation obligation, and the direction rule (only women < men shown/flagged) replaces the |gap| both-directions flagging. **Recommendation:** write ADR-0015 (Swedish, `docs/adr/0015-instegsvillkor-och-atgardslager.md`) recording the entry conditions, the direction rule, the deep-dive/info-view surfaces, and the åtgärd/notering model, as an extension of ADR-0012 (P1 stays mandatory; this reshapes its presentation and gate).
2. **Primary metric: grundlön.** The notes make basicMonthly the entry condition and the flag basis, with TCC parallel. Today's engine flags on FTE-adjusted TCC. **Recommendation:** follow the notes for the group views (base primary, TCC parallel columns), keep the org-level overview headline/clock/quartiles on TCC unchanged for now (they are EU-metric surfaces; M8 decides their final set). **Risk to confirm:** a group where women match men on base but lose on bonuses becomes invisible (base gap <= 0 hides the group while the TCC gap may be >10%). Mitigation offered: also admit groups whose TCC gap > 0, marked "TCC-driven", flag still from the larger of the two. Cheap to include; recommend including it.
3. **FTE adjustment in individual columns.** The notes show raw kr/mån; the engine compares FTE-adjusted values. **Recommendation:** compute stats and diffs on FTE-adjusted (heltidsekvivalent) values, display the FTE-adjusted figure, and mark rows where `ftePercent < 100` with the percentage; inline help explains. Raw-vs-adjusted mixing in one table produces provably wrong diffs.
4. **Tvärnivå pair explosion.** Per-pair listing is O(women x men); at 1000 employees this can be tens of thousands of rows. **Recommendation:** aggregate per woman (count of lower-level men out-earning her + the largest-difference man as the headline pair), expandable to the full pair list per woman, computed in core with a deterministic order.
5. **Post-completion mutability of åtgärder.** Actions are executed over up to three years, after the run completes. **Recommendation:** status/follow-up updates stay allowed on completed runs (audited); creating or editing action content locks at completion like the rest of the work layer. Noteringar lock fully at completion.
6. **Free text in audit diffs for person-linked records.** `GROUP_ANALYSIS_AUDIT_FIELDS` diffs the note text today (group-level, role content). Individual- and pair-linked action/note free text is person-related and cannot be erasure-scrubbed once diffed. **Recommendation:** audit diffs for actions/notes carry structured fields only (status, priority, reason, dates, cost, target ids); free-text changes log a changed-marker, never the text.
7. **Silent removal completeness.** Notes 1-2 also remove excluded groups from export reports. The report layer (M8) is unbuilt; the boundary is encoded now in the engine's outcome classification so M8 inherits it. Nothing to build today; confirm the report will carry an aggregate methodology note ("N groups excluded for lacking a comparison basis") so the statutory documentation stays honest.

## 4. Engine design (packages/core). The single source of truth

New pure module `packages/core/src/pay-analysis.ts` (+ tests), exported from `packages/core/src/index.ts`. All functions take snapshot-shaped inputs and are shared by the Convex gate and the client views.

```ts
export type PayMetric = "base" | "tcc";

export interface GroupMemberInput {
  personPublicId: string;
  displayName: string;   // already tombstoned post-erasure
  gender: "Man" | "Kvinna";
  level: number | null;
  trackKey: string;
  seniority: string;
  roleTitle: string;
  base: number | null;   // FTE-adjusted basicMonthly
  tcc: number | null;    // FTE-adjusted total comp
  ftePercent: number | null;
}

export interface GenderStats { count: number; min: number; max: number; mean: number; median: number; stdDev: number; }
export function genderStats(values: number[]): GenderStats | null;

// Entry-condition classification. One function; the gate, the wizard queue,
// the checklist, the info view, and the deep-dive all read the same outcome.
export type EqualWorkOutcome =
  | "shown"        // >=1 woman AND >=1 man AND (base gap > 0 OR tcc gap > 0 per decision 2)
  | "reverse"      // both genders, women's mean >= men's on both metrics -> info view
  | "genderPure"   // >=2 members, one gender -> deep-dive
  | "singleton";   // <2 members -> silently dropped everywhere
export function classifyEqualWorkGroup(members: GroupMemberInput[]): EqualWorkOutcome;

export interface MemberDiff { vsMenMeanKr: number; vsMenMeanPct: number; }
export function memberDiffs(members: GroupMemberInput[], metric: PayMetric): Map<string, MemberDiff>; // key personPublicId; null-safe

export interface CrossLevelWoman {
  personPublicId: string;
  level: number;
  outEarnedByCount: number;          // men on numerically HIGHER level number (lower value) with higher base
  worstPair: CrossLevelPair;         // largest kr difference
  pairs: CrossLevelPair[];           // deterministic order: diff desc, then publicId
}
export interface CrossLevelPair {
  manPublicId: string; womanLevel: number; manLevel: number;
  womanBase: number; manBase: number; diffKr: number; sameTrack: boolean;
}
export function crossLevelPairs(members: GroupMemberInput[]): CrossLevelWoman[];
```

Changes to existing code:

- `computeGenderGap` stays as-is (means, signed gap). `classifyPayGap` stays as-is (thresholds unchanged); after entry-condition filtering every shown group has both genders, so `insufficient` no longer occurs in the primary lika arbete view.
- `buildGapAggregates` (`payMapping/gap.ts`) computes per-group `EqualWorkOutcome` and per-metric stats; `getPayMappingGap` returns shown groups (both metrics), plus counts of reverse/genderPure/singleton for the info-view and deep-dive entry points. Per-group masking-to-null logic for ⚪ disappears from the equal-work path (superseded by filtering); the equivalent-work and women-dominated paths keep their current behavior.
- `requiredDocumentationKeys` becomes: shown equal-work groups with flag `critical`/`elevated` (base metric, or TCC-driven per decision 2) + the unchanged women-dominated comparisons. `completePayMappingRun`, the wizard queue (`review-queue.ts`), and the Analysis checklist all inherit this from the one function.
- The statutory group-level `womenDominatedComparisons` (DL 3:9) is untouched. Gender-pure exclusion applies to the *within-group* lika arbete comparison only; an all-women group remains a women-dominated group in the cross-comparison. A test pins this.

## 5. Data model additions (payMapping work layer)

In `packages/backend/convex/payMapping/tables.ts`:

```ts
export const actionTargetValidator = v.union(
  v.object({ kind: v.literal("group"), scope: payComparisonScopeValidator, groupKey: v.string() }),
  v.object({ kind: v.literal("person"), scope: payComparisonScopeValidator, groupKey: v.string(), personPublicId: v.string() }),
  v.object({ kind: v.literal("pair"), womanPublicId: v.string(), manPublicId: v.string() }),
);

payMappingActions: defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  target: actionTargetValidator,
  problem: v.string(),            // beskrivning av identifierat problem (required)
  plannedAction: v.string(),      // planerad åtgärd (required)
  reason: v.optional(payGapReasonValidator),
  ownerUserId: v.string(),        // ansvarig: a system user; name resolved at read
  plannedDate: v.number(),        // required
  estimatedCost: v.optional(v.number()),  // SEK, org-level figure, not person pay
  priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  status: v.union(v.literal("notStarted"), v.literal("inProgress"), v.literal("done")),
  createdBy: v.string(), createdAt: v.number(),
}).index("by_run", ["orgId", "runId"]),

payMappingNotes: defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  target: actionTargetValidator,  // pair targets not offered in the UI for notes
  text: v.string(),
  noteType: v.union(v.literal("objectiveReason"), v.literal("discussionNeeded"), v.literal("noActionNeeded")),
  createdBy: v.string(), createdAt: v.number(),
}).index("by_run", ["orgId", "runId"]),
```

PII stance: rows carry `personPublicId` only; the snapshot row (already pseudonymized on erasure) is the display source, so an erased person renders as the tombstone automatically and no new erasure hook is required for structured fields. Free text is user-authored statutory work-layer content, same class as `payMappingGroupAnalyses.note`; it is excluded from audit diffs (decision 6). `ownerUserId` resolves like `initiatedBy` does today (name at read time; erased users resolve to the tombstone).

Mutations (all org-scoped, audited): `createAction`, `updateAction` (content; locked on completed runs), `setActionStatus` (allowed on completed runs), `deleteAction`, `createNote`, `updateNote`, `deleteNote` (notes fully locked on completed runs). Queries: `listActions(runId)`, `listNotes(runId)`, plus a per-target lookup shape the detail views use for badges.

Audit wiring (same change): `AUDIT_EVENTS` keys `payMapping.actionCreated/actionUpdated/actionStatusChanged/actionDeleted/noteCreated/noteUpdated/noteDeleted`; subject `{ kind: "payMappingRun", id: runId }`; category `pay` (prefix already maps); `ACTION_AUDIT_FIELDS = ["status","priority","reason","plannedDate","estimatedCost","ownerUserId","targetKind"]` with `fieldLabel` entries and coded-value labels (`status`, `priority`, `noteType`, `targetKind`) in every locale; payload carries the action/note id. Free text: changed-marker only.

## 6. Slices

### Slice A: Engine + entry conditions + gate (the semantic core)

**Files:** Create `packages/core/src/pay-analysis.ts` + `pay-analysis.test.ts`; modify `packages/core/src/index.ts`, `packages/backend/convex/payMapping/gap.ts` + tests, `runs.ts` (gate), `apps/dashboard/components/pay-mapping/review-queue.ts` + tests, `pay-mapping-summary.tsx`, `pay-mapping-gap-types.ts`; create `docs/adr/0015-instegsvillkor-och-atgardslager.md` (Swedish); update `docs/go-live-checklist.md` (report exclusion note, decision 7).

**Produces:** `classifyEqualWorkGroup`, `genderStats`, `memberDiffs`, `crossLevelPairs`, the reshaped `getPayMappingGap` wire shape (shown groups with per-metric stats + outcome counts), the new `requiredDocumentationKeys`.

**Tests that pin the semantics:** singleton dropped everywhere including the gate; gender-pure absent from primary but still a women-dominated comparison source; reverse group hidden but counted; base-vs-TCC admission matrix (decision 2); a completed run's gate unaffected by groups that no longer require documentation; median/stdDev against hand-computed fixtures; cross-level pairs respect level-1-is-highest and same-track marking.

**Rollout:** no schema change; behavior change to the gate. Browser pass on a seeded dev run.

### Slice B: Lika arbete detail view

**Files:** Create `components/pay-mapping/equal-work-detail.tsx` (summary row + dot plot + individual table), `components/pay-mapping/pay-gap-dot-plot.tsx` (two-lane swimlane scatter: X = FTE-adjusted grundlön, lanes K/M, reference lines for both means, gap annotation in kr and %, tooltip name/salary/diff at `CHART_TOOLTIP_TEXT`, `GENDER_DOT` encoding), `components/pay-mapping/group-member-table.tsx` (TanStack, columns per note 3: name, gender mark, grundlön, TCC, diff kr, diff %, badge + `...` menu slot; default sort women-first then base ascending via initial multi-sort; `TableSortButton`; `table-fixed`; `TablePagination` past 25; `TableSkeleton` variant). Modify `review-group-step.tsx` and the Analysis-tab step pane to render the detail view (dot plot first per the note), retiring `pay-mapping-group-underlag.tsx`'s equal-work branch and `MeanComparisonBars` usage there (overview keeps its own). i18n: `dashboard.payMapping.detail.*` extensions + `dashboard.help.*` for the new concepts (diff vs men's mean, reference lines, TCC parallel), all locales.

**Consumes:** Slice A wire shape. **Produces:** `EqualWorkDetail` + `PayGapDotPlot` (reused by C and D).

### Slice C: Likvärdigt arbete detail + tvärnivå

**Files:** Create `components/pay-mapping/equivalent-work-detail.tsx` (per-level table adding level badge, track, roleTitle columns), `components/pay-mapping/cross-level-section.tsx` (per-woman aggregated rows, expandable pair lists, same-track warning badge), extend `pay-gap-dot-plot.tsx` with a lane-per-level mode and hover-scoped pair connectors (connector rendered only for the hovered/selected pair; a permanent all-pairs spaghetti is rejected for legibility). Modify the equivalent-work chapter step + summary. The existing women-dominated chapter stays as the statutory cross-group comparison; the tvärnivå section is presented alongside it with inline help distinguishing the two.

**Consumes:** `crossLevelPairs`, `EqualWorkDetail` patterns from B.

### Slice D: Deep-dive (könsrena grupper) + info view (women-earn-more)

**Files:** Create `components/pay-mapping/deep-dive-section.tsx`: a clearly separated section on the Analysis tab, default collapsed behind an explicit activation control carrying the note's explanation text ("ingår inte i den lagstadgade lönekartläggningen..."), listing gender-pure groups (which-gender badge, full `genderStats`, individual table reusing `group-member-table` with notes-only affordance, no formal actions). Create `components/pay-mapping/reverse-groups-section.tsx`: the low-key info view listing groups where women out-earn men (counts + stats, no flags, no documentation affordances, framed as analytical information). Neither feeds the gate, the flags, the report boundary, nor the åtgärdsöversikt (engine outcome classification enforces this; tests pin it).

**Consumes:** outcome counts + group payloads from A, table/plot from B.

### Slice E: Åtgärder + noteringar (entities, forms, in-view affordances)

**Files:** Modify `packages/backend/convex/payMapping/tables.ts` (section 5 schema); create `packages/backend/convex/payMapping/actions.ts` + `notes.ts` + tests; extend `lib/audit.ts` + `lib/auditPayloads.ts` + `apps/dashboard/lib/audit-detail.tsx` + `audit-labels.test.ts` labels; create `components/pay-mapping/action-dialog.tsx` and `note-dialog.tsx` (dialog anatomy; `makeActionSchema(t)` / `makeNoteSchema(t)`; prefilled locked target context; reason `Select` from the shared taxonomy; owner `Select` from the org members query; `DatePicker`; cost numeric; priority; submit gated on validity; toasts); create `components/pay-mapping/documentation-badge.tsx` (status-colored badge in the pre-reserved row slot, opens existing documentation); wire the `...` menus at group, row, and pair level in B/C/D surfaces. i18n `dashboard.payMapping.actions.*` in all locales.

**Rollout:** schema change: dev migration + browser pass (wipe -> deploy -> seed if validators require).

### Slice F: Åtgärdsöversikt (the dedicated overview)

**Files:** Create `app/(app)/pay-mappings/[slug]/actions/page.tsx`; extend `pay-mapping-tabs.tsx` (Overview / Analysis / Actions / Report) + nav i18n; create `components/pay-mapping/actions-overview.tsx`: summary bar (NumberFlow counts + total estimated cost), two TanStack tables (actions: status, priority, type, target link back into the source analysis view, problem summary, planned action, owner, date, cost, `...` menu with edit/status/close; notes: type, target link, text, author, date), filters (status, priority, comparison type, owner, due-within window), status updates inline from the overview (audited via `setActionStatus`), skeletons sized to `PAGE_SIZE`.

**Consumes:** `listActions`/`listNotes` from E; deep links resolve to the group step / detail anchor in the Analysis tab.

## 7. Sequencing and dependencies

A -> B -> C, then D (needs A+B), E (independent of B/C/D backend-wise; UI affordances land with/after B), F (needs E). Recommended order: **A, B, E, C, F, D.** Rationale: A changes gate semantics and must settle first; B delivers the visible core of notes 3; E unblocks the per-row affordances B/C/D want to render; F completes note 5; D is the smallest and fully additive. Each slice ends: full gate green (typecheck, `turbo run test`, Biome zero, i18n parity), dev-deployment verified in the browser, work left uncommitted for review with a file-by-file summary.

## 8. Explicitly out of scope (unchanged from the tracker)

Report/export (M8) including the export-boundary masking and access/export logging; due-date notifications; per-code evidence metadata; the AI reason-assist; adjusted gap (F7); cross-survey trend. The engine's outcome classification (Slice A) is built so M8 inherits the exclusion boundary without rework.

## Self-review notes

- Every note maps to a slice: note 1 -> A; note 2 -> A+D; note 3 -> A+B; note 4 -> A+C; note 5 -> E+F. Statistics list -> A (`genderStats`).
- Names used across slices are defined once: `classifyEqualWorkGroup`, `genderStats`, `memberDiffs`, `crossLevelPairs`, `EqualWorkOutcome`, `payMappingActions`, `payMappingNotes`, `actionTargetValidator`, `PayGapDotPlot`, `group-member-table`.
- The seven decision points (section 3) are the only unresolved inputs; all have stated defaults so implementation can start on approval.
