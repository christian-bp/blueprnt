# Analysis documentation, completion gate, women-dominated comparison, and scatter

One slice (user's explicit choice) delivering the documentation half of the kartläggning analysis: the objective-reasons workflow (M6) with the ADR-0012 completion gate and a minimal run lifecycle, the statutory women-dominated cross-level comparison (teardown F4), a per-person scatter under the analysis detail, and the worklist search-width fix. AI insights ("Generativa insikter") are explicitly deferred to a later GDPR-safe slice; action plans (M7), plotter diagram-type/Y-metric toggles, and the report (M8) stay out.

Decisions locked with Christian 2026-07-16: everything in one slice; klarmarkering requires documentation for groups that need it; minimal lifecycle (Slutför + Återöppna, completed locks editing) is in; AI deferred; scatter is scoped to the selected group under the detail in both views; X toggles age/tenure while Y is the gap measure; F4 is in; the likvärdigt view is reshaped into the women-dominated (statutory) form.

## 1. Search fix

`TableSearchField` (apps/dashboard/components/table-search-field.tsx) hardcodes `w-64`, sized for register toolbars; inside the analysis worklist card it floats as a fixed 256px box. Add an optional `className` prop merged with `cn` onto the Input (default stays `w-64`); the worklist passes `w-full`. No other call sites change.

## 2. Reason taxonomy (shared constant)

New `packages/constants/src/payGapReasons.ts` (exported via index), the single source of truth for the objective-reason taxonomy, DO-framework aligned and identical in shape to the competitor's:

```ts
export const PAY_GAP_REASON_GROUPS = {
  market: ["alternativeLabourMarket", "recruitmentPayLevel"],
  individual: ["experience", "historicalPay", "competence", "performance"],
  work: ["responsibility"],
} as const
export type PayGapReasonGroup = keyof typeof PAY_GAP_REASON_GROUPS
export type PayGapReason = (typeof PAY_GAP_REASON_GROUPS)[PayGapReasonGroup][number]
export const PAY_GAP_REASONS: readonly PayGapReason[] // flattened, for validators
```

The backend builds its `v.union(v.literal(...))` validator from `PAY_GAP_REASONS`; the dashboard renders the chip groups from `PAY_GAP_REASON_GROUPS`; i18n labels live at `dashboard.payMapping.reasons.<key>` and group headings at `dashboard.payMapping.reasons.groups.<group>`. The taxonomy is fixed in V1 (no org-defined reasons).

## 3. Data model

New table in `packages/backend/convex/payMapping/tables.ts`:

```ts
payMappingGroupAnalyses = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  scope: v.union(v.literal("lika"), v.literal("likvardigt")),
  groupKey: v.string(),           // the engine's deterministic group key (wire `key`)
  reasons: v.array(payGapReasonValidator),
  note: v.optional(v.string()),   // Fördjupad analys free text
  done: v.boolean(),              // Klarmarkerad
}).index("by_run", ["orgId", "runId"])
```

One row per (runId, scope, groupKey), enforced by upsert (query `by_run`, filter scope+groupKey in memory; a run has few groups). `likvardigt`-scope rows key on the women-dominated group's lika key (a women-dominated group IS a lika group), so the same group can carry independent documentation in each view. Group keys are stable because the snapshot is frozen (ADR-0011). Notes are group-level (role-level) content: they are NOT person PII and are not touched by person erasure; the textarea's helper text steers users to describe roles and experience, not name individuals.

## 4. Engine (packages/core, pure)

- `WOMEN_DOMINANCE_THRESHOLD = 0.6` (DO praxis: a group "brukar anses" women-dominated at 60 %), with the citation in a comment.
- `isWomenDominated(womenCount, menCount)`: share of women `>= WOMEN_DOMINANCE_THRESHOLD` (headcount > 0).
- `womenDominatedComparisons(groups)` where each input group carries `{key, roleTitle, level, band, womenCount, menCount, meanComp}` (meanComp = the whole-group mean of the gap measure): for every women-dominated group with a non-null band, the comparison set is every NON-women-dominated group with a non-null band that is **equally or lower valued** (band 1 is highest, so `comparison.band >= group.band`) and has a **higher** meanComp. Output per group: `{key, roleTitle, level, band, headcount, womenSharePct, meanComp, comparisons: [{key, roleTitle, level, band, headcount, womenSharePct, meanComp, diffPct, diffSek}]}`, comparisons sorted by band ascending (higher-valued first) then diffSek descending. `diffSek = comparison.meanComp - group.meanComp` (positive: the equally/lower-valued group earns more); `diffPct = diffSek / group.meanComp * 100`, null-guarded when `group.meanComp` is 0. Groups with no comparisons are still returned (empty array): they appear in the worklist as documentable but the gate does not require them.
- `groupsRequiringDocumentation(flags)` helper: a lika group requires documentation when its flag is `critical`, `elevated`, or `insufficient` (ADR-0012: reds/ambers documented, single-gender groups motivated); a women-dominated group requires it when it has at least one comparison. Kept in core so the mutation and the UI share one rule.
- Export the existing pure age helper (`ageAt`) and add `yearsBetween(isoDate, asOfMs)` (UTC whole years, the same arithmetic) for the scatter's age and tenure axes. No clock reads: `asOf` is always an input.

## 5. Backend (packages/backend/convex/payMapping/)

**gap.ts.** Extract the bucket-building + stats into a shared `buildGapAggregates(rows)` used by both `getPayMappingGap` and the completion gate. Extend the query's return with `womenDominated` (the engine output above, wire-shaped). The existing `lika`/`likvardigt`/org/quartiles/age sections are unchanged; `likvardigt` (per-band W-vs-M) stays on the wire as the reshaped view's context row.

**analyses.ts (new).**
- `listGroupAnalyses` (orgQuery, `{runId}`): all `payMappingGroupAnalyses` rows for the run, wire shape `{scope, groupKey, reasons, note, done}`.
- `upsertGroupAnalysis` (orgMutation, `{runId, scope, groupKey, reasons, note, done}`): rejects with `appError("payMappingRunCompleted")` when the run's status is `completed`; validates reasons against the taxonomy (validator-level); recomputes the group's documentation requirement SERVER-SIDE (snapshot rows -> `buildGapAggregates` -> `groupsRequiringDocumentation`; never trusts the client's flag) and rejects `done: true` without documentation (`reasons.length > 0` or a non-empty trimmed `note`) with `appError("payMappingDocumentationRequired")`; also rejects an unknown groupKey for the scope. Writes the audit row.
- Erasure: nothing to do (no person data in the table).

**runs.ts.**
- `completePayMappingRun` (orgMutation, `{runId}`): recomputes the full gate server-side (every documentation-requiring lika group AND every women-dominated group with comparisons has a `done: true` row in its scope); on failure `appError("payMappingGateUnmet")`; on success sets `status: "completed"` + audit. Only an `active` run can complete.
- `reopenPayMappingRun` (orgMutation, `{runId}`): `completed -> active` + audit.
- `getPayMappingRunBySlug` regains `referenceDate` (the scatter computes age/tenure at the frozen date client-side; the lean-wire comment already says fields return when a surface needs them), and its `rows` gain `birthDate`, `employmentStartDate`, `ftePercent`, and `components` (all already in the table; wire + `PayMappingSnapshotRow` type extended).

**Audit (lib/audit.ts + lib/auditPayloads.ts).** Three new events following the existing `payMapping.*` naming: `payMapping.groupAnalysisUpdated` (a `changes` diff over `reasons`/`note`/`done` via a `GROUP_ANALYSIS_AUDIT_FIELDS` constant, plus flat group identity `scope`/`roleTitle`/`level`, all role-level content), `payMapping.runCompleted` (flat stats: documented group counts per scope), `payMapping.runReopened`. Each ships its `AuditPayloads` entry, field labels under `dashboard.auditLog.fields.*`, and event labels under `dashboard.auditLog.events.*` in every locale (the coverage tests enforce both).

## 6. Lika view (pay-mapping-analysis.tsx)

- ⚪ single-gender groups RETURN to the worklist (they are documentable posts now, per the ADR-0012 amendment); the `singleGenderHidden` note and its five locale keys are deleted. Their flag chip and the detail's "no comparison to make" line explain themselves; the stat grid renders as today (null means).
- The worklist gains **Ej klara / Klara / Alla** segmented tabs (counts in each label) above the search field; default **Ej klara**; when Ej klara is empty an honest all-done empty state points to Alla. Partitioning is by the group's `done` row (absent = not done). Sorting within a tab stays attention-first.
- The detail panel, under the stat grid and member table, gains the **documentation form** (section 8) and then the **scatter** (section 9) scoped to the group's members.

## 7. Likvärdigt view reshaped (statutory women-dominated form)

The band-worklist view is replaced (no legacy kept):

- **Worklist** = the women-dominated groups from `gap.womenDominated` (label `roleTitle · level`, chip = the count of higher-paid comparisons, e.g. "3 högre betalda", neutral styling; zero-comparison groups show no chip), with the same Ej klara/Klara/Alla tabs and search. Default sort: most comparisons first, then band.
- **Detail** = the group's key figures (headcount, andel kvinnor, medellön), the **comparison table** (columns Band, Arbete, Antal, Andel kvinnor, Medellön, Skillnad %, Skillnad SEK; rows = the comparison set, higher-valued bands first), a context line with the group's own band W-vs-M gap (from the existing `likvardigt` wire section), the documentation form (scope `likvardigt`), and the scatter over the comparison set (the group's members + every comparison group's members).
- The unbanded note stays under the worklist. Empty state: no women-dominated groups -> explain what women-dominated means (help key) and that there is nothing to compare.
- The view description + help are rewritten for the new form; `gap.bandRoles` and other band-composition keys that lose their surface are deleted in the same change.

Member resolution (shared helper): rows matching a group = same `roleTitle`, `level`, `band`, priced; extracted once and reused by the lika member table and both scatter scopes.

## 8. Documentation form (new pay-mapping-group-analysis-form.tsx)

Props: `{runId, scope, groupKey, requiresDocumentation, locked, analysis | undefined}`. Renders:

- **"Löneskillnader förklaras av"**: the taxonomy as toggleable chips in three labeled groups (Marknad / Individ / Arbete), multi-select. A chip toggle saves immediately.
- **"Fördjupad analys"**: a textarea, saved on blur/800 ms debounce, with muted helper text: describe the explanation in terms of role, market, and experience; avoid naming individuals (the note becomes part of the statutory documentation and the audit trail).
- **Klarmarkerad**: a switch/button; disabled (with the requirement stated in text, per the guidance rule) while `requiresDocumentation` and the form has neither a reason nor a note. Toggling it toasts (`dashboard.toast.*`); chip/note saves are continuous edits and do NOT toast (the toast rule's auto-save exemption), errors always toast.
- This is a continuous editing surface like the per-criterion rating, not a submit-gated form, so it uses controlled components + the upsert mutation directly (documented deviation from the RHF+Zod form rule, which governs submit-style forms).
- `locked` (run completed): every control disabled plus one line explaining that a completed kartläggning is locked and can be reopened from the overview.

The run shell's context gains the `listGroupAnalyses` subscription so the form, the worklist tabs, and the overview card share one source.

## 9. Scatter (new pay-mapping-scatter.tsx)

- Recharts `ScatterChart` inside the shadcn chart kit and a `WidgetCard` (title + help + fullscreen expand), rendered under the detail panel in BOTH views, scoped to the selection: lika = the group's members; likvärdigt = the women-dominated group's members + its comparison groups' members.
- **Y** = the gap measure, `fteTotalMonthlyComp(basicMonthly, components, ftePercent)` from `@workspace/constants` (the same helper and figure the backend's flags are computed from), currency-formatted axis. **X** toggles **Ålder** (default) / **Anställningstid**, both computed with the core helpers at the frozen `referenceDate`. The toggle is a small segmented control in the WidgetCard header slot.
- **Color = gender** via the `--gender-man`/`--gender-woman` tokens with a text legend (never color-alone).
- **Hover tooltip** (per person): displayName (erased rows show the tombstone), roleTitle · level, band, gender, grundlön, rörligt (component sum), the FTE-adjusted total (the plotted value), and the X value; in likvärdigt also the person's group. HR-only surface: individual pay is by design visible in-app (small-cell minimums apply at the export boundary only).
- Rows missing the active X field (no birthDate / no employmentStartDate) are omitted with an honest count note under the chart ("N personer utan födelsedatum visas inte"); if nothing is plottable the card states the precondition in words. Loading follows the skeleton rules (real title/help/toggle, a bar for the plot area).

## 10. Overview: documentation card + lifecycle

A new full-width **"Dokumentation"** card (WidgetCard, no expand) between the KPI strip and the charts:

- Progress per scope: "X av Y grupper klarmarkerade" for Lika arbeten and for Kvinnodominerade arbeten (Y = the documentation-requiring groups plus any additionally done ones; the count logic mirrors the gate), each row linking into its analysis view.
- **"Slutför kartläggningen"** (primary): disabled while the gate is unmet, with the remainder stated in words ("3 grupper återstår att klarmarkera"); enabled it calls `completePayMappingRun`, toasts, and the status badge in the header switcher flips to Slutförd.
- On a completed run the card shows the completed state + **"Återöppna"** (outline, confirm via AlertDialog since it reopens the statutory documentation for editing) calling `reopenPayMappingRun`.
- `paused`/`underReview` statuses remain wired-in-schema but unset by any UI this slice.

## 11. i18n

All new strings land in `en.json` first and are mirrored to sv/nb/da/fi (Nordic = drafts flagged for native review): the reason taxonomy labels + group headings, the form labels/helper/lock line, worklist tabs (Ej klara/Klara/Alla with counts), the comparison-table headers, the women-dominated view description + empty states, scatter labels (axis toggle, legend, tooltip fields, omitted-count note, precondition), the documentation card (progress rows, gate remainder, complete/reopen + confirm copy), toasts, appError codes, audit event + field labels, and help keys (`dashboard.help.*`) for: sakligt skäl (taxonomy), klarmarkering + grinden, kvinnodominerad, and the scatter. Deleted keys (`gap.singleGenderHidden`, the band-composition keys losing their surface) are removed from all five files in the same change.

## 12. Testing

- **Core**: threshold boundary (exactly 60 %, just under), band direction (band 1 highest; equal band included; higher band number = lower value included; lower band number excluded), higher-pay filter, zero-mean guard, empty/no-women-dominated cases, `groupsRequiringDocumentation` per flag and per comparison count, `yearsBetween`/`ageAt` edge dates.
- **Backend (convex-test)**: upsert happy path + taxonomy validation + done-without-documentation rejection + unknown groupKey + completed-run lock; gate rejection with remaining counts + successful completion + reopen; audit rows written with the right events/payloads; `womenDominated` wire section over a seeded snapshot; extended row/referenceDate wire fields.
- **Dashboard**: search field fills the card; worklist tabs partition + counts + default + all-done empty state; ⚪ groups visible and documentable; form chip toggle fires upsert, note debounce, Klarmarkerad disabled until documented, locked state; likvärdigt reshape (worklist from womenDominated, comparison table contents/order, context gap row, empty state); scatter axis toggle, omitted-count note, tooltip fields, gender legend; overview card progress, gated Slutför with remainder text, complete + reopen flows with confirm; loading skeletons per rules.
- **Guards**: i18n parity, audit event-label + field-label coverage tests.

## Out of scope (deliberate)

AI reason-assist (own GDPR-safe slice: role/aggregate-level prompts only, suggests categories + neutral draft text, HR confirms), action plans (M7, the second gate input for gaps without an objective reason), scatter diagram-type and Y-metric toggles, the report (M8), org-defined taxonomies, paused/underReview lifecycle UI.

## Deviations (implementation, 2026-07-16)

- **Band-context copy branches on direction.** The spec's single "women earn {gap} less than men" string was direction-buggy for bands where women out-earn men; the shipped copy uses unsigned percents with three branches: `bandContext` (less), `bandContextWomenAhead` (more), `bandContextNone` (null or zero gap).
- **A zero-comparator women-dominated group states its result in words** (`gap.noComparators`, "No equally or lower valued group out-earns this one.") instead of rendering an empty comparison table: the compliance-positive outcome is said, not implied.
- **The form surfaces the documentation-required rejection specifically** (the `errors.payMappingDocumentationRequired` string) instead of a generic error toast, since removing the last reason on a done group is a reachable path.
- The engine also returns women-dominated groups with zero comparisons (documentable but not gate-required), exactly as section 4 specified; the spec's own example test undercounted them and was corrected during implementation.
