# Pay-mapping overview redesign: design

Date: 2026-09-03. Owner document: "Översikt Lönekartläggning (första sidan)" (2026-09-03). Status: approved design, awaiting the implementation plan. Depends on the two-report export spec (`2026-09-03-two-report-export-design.md`) for the analysis-status helper and the shared masking threshold; the plan for this spec runs after that one.

## Summary

The run overview (`/pay-mappings/[slug]`) becomes the decision surface the owner's document describes: it answers, in order, whether there is a pay challenge, where it is, how large it is and how many people it touches, what is analysed and what remains, how the action work is going, and, only when the reader opts in, how the outcome changed against a chosen earlier mapping. Today's page (population card, gap card, equality clock, mean-comparison bars, whole-survey donut, quartile chart) is replaced. The quartile chart is the one element that stays.

First version scope is the owner document's priorities 1 to 6: run context with a reference selector, the KPI strip, prioritised observations, the group table, the action-plan block, and the comparison layer. The historical trend over three to five runs and the deeper visualisations (population breakdowns, level structure, the clock) are out of scope.

## Owner decisions recorded during brainstorming

1. Scope: priorities 1 to 6 now; 7 and 8 later.
2. The overview masks pay figures for small groups with the SAME threshold as the exports (fewer than 4 in the group or fewer than 2 of a gender): counts and status stay visible, means and medians are hidden. The analysis pages stay unmasked. ADR-0012 gets an addendum: one threshold across the product, applied on the overview and in the documents, never in the analysis flow.
3. The reference selector lists earlier COMPLETED runs only; the page opens in the pure current-state mode ("No comparison"); the choice lives in the URL (`?compare=<run slug>`) so a link or a screenshot always states what is being compared.
4. `followUpDate` (next decision point) is a new optional field on the run, edited inline in the action-plan block, allowed after completion, audit-logged.
5. The equality clock, the mean-comparison bars and the whole-survey donut are removed with their components, tests, help texts and i18n.
6. Approach 1: the client derives everything from the subscriptions the run shell already holds; the backend only adds medians to the gap aggregate, `withPayCount` and `followUpDate` to the run detail wire, and the follow-up-date mutation.

## Page structure (top to bottom)

All standing text is titles, labels, counts and state words; explanation lives in `HelpMorphButton`s after the titles (200/240 character caps).

### 1. Context row

Directly under the breadcrumbs: run label, status badge, reference date (labelled as the data extraction date), coverage ("112 of 118 with pay"), a "Base year" chip when no earlier run exists, and the reference selector labelled "Compare with" (a `Select`: "No comparison" first, then each earlier completed run as "<label> · <month year> · Completed"). The sidebar's run switcher keeps the role of "Showing". Selecting a reference writes `?compare=<slug>`; "No comparison" removes the parameter. The selector renders even while the run list loads (static-label control rule) showing "No comparison".

### 2. KPI strip (six `WidgetCard`s)

| Card | Value | Note / footer |
|---|---|---|
| Scope | people included | women / men counts |
| Total pay gap | mean gap % (org aggregate, unsigned, women vs men as today) | median gap % |
| Remaining to analyse | "3 of 18 groups" | counts groups and comparisons that require documentation and are not done |
| Risk groups | "3 of 18" | "14 affected" |
| Actions | "2 of 9 done" | in progress count |
| Estimated cost | annual recurring cost (per-year costs plus 12 x per-month costs) | one-off total; "Cost not estimated" as the value when no action carries a cost, otherwise the count of uncosted actions in the note |

Definitions:

- **Requires documentation**: an equal-work group whose flag is not `ok`, or a women-dominated group with at least one comparison (the existing `requiredDocumentationKeys` rule).
- **Risk group**: a group or women-dominated group whose derived analysis status is `furtherAnalysis` or `actionDecided` (the status helper from the two-report spec).
- **Affected people**: in each risk group, the headcount of the lower-paid gender (women where the group gap is positive in the women-behind direction, men in a reverse group; for a women-dominated group, its headcount).
- Values that change while on screen (every count here) render through `NumberFlow`; the money value through `NumberFlow` with the money format.

### 3. Prioritised observations

A list of three to five rows, derived by rules, never by AI. Candidates and their status word:

| Candidate | Status word | Scope text | Next step (templated) |
|---|---|---|---|
| Equal-work group not closed (status `furtherAnalysis` or `actionDecided`), ranked by absolute gap % times headcount | "Action required" when the flag is `critical` or an action is decided; otherwise "Needs review" | "8 people · 6.2 %" | "Complete the objective-reason assessment and prepare any adjustment" / "Assess the need for a pay adjustment" |
| Women-dominated group with an open comparison | "Needs review" | "4 people · 3.7 %" (largest comparison) | "Assess against the higher-paid comparison group" |
| Women's share of the upper quartile at least 10 percentage points below their share of the population | "Needs review" | "31 % women in the upper quartile" | "Review pay criteria, promotion and career paths" |
| Praxis area with finding `found` and no linked action | "Needs review" | the area's label | "Decide an action for the area" |
| Nothing above | "No deviation identified" (single row) | "Within the defined range" | "Follow up in the next mapping" |

Ranking: "Action required" rows first, then "Needs review" rows by scope size; cut at five. Each row links to the analysis step (group, comparison, praxis area) or the actions page. Status is shown as text with an icon, colour only as support.

### 4. Pay outcome

A `PanelCard` with the total gap as mean and median, then counts instead of a fabricated "unexplained %": groups analysed of total, remaining, risk groups, affected people. The existing quartile chart (`QuartileStat`, with its help) sits beside it, unchanged.

### 5. Group table

A TanStack register table (`table-fixed`, `TableSortButton`, `TablePagination` past 25 rows, content-shaped `TableSkeleton` with `PAGE_SIZE` rows) with a segmented toggle: Equal work / Equivalent work.

Equal work columns: group (role title + level), women / men, median women / men (masked cell when the group has fewer than 4 people or fewer than 2 of a gender), pay gap % (total compensation mean gap, signed: negative when women earn less, positive in reverse groups), status (one of the four analysis statuses as a text badge). Gender-pure groups are excluded (no gap exists). Default sort: largest absolute gap first; a status filter in the toolbar; a result count while filtering. Row click navigates to the group's analysis step.

Equivalent work columns: women-dominated group (title + level), headcount and women share, comparison group (the largest comparison; count of others in the cell), difference %, status. Same masking rule on any amount shown.

### 6. Action plan

Counts per status (not started, in progress, done), the cost table (annual recurring, one-off, total first year), the number of uncosted actions ("Cost not estimated: 3 actions"), the next decision point (`followUpDate`, a `DatePicker` inline, editable by every member, also after completion, with a toast and an audit row), and the five-step process indicator: Mapping done (the run exists), Analysis done (nothing requiring documentation remains open), Plan decided (the run is completed), Implementing (at least one action is in progress or done), Follow-up (a later run exists). Each step shows done / current / upcoming as text plus a mark.

### 7. Comparison layer

Active only when `?compare` names an earlier completed run. Then, and only then:

- KPI cards gain a delta footer ("0.7 points lower than September 2025", "2 fewer groups", "7 fewer people", "2 more actions done") built from the same helpers run on the reference data.
- The group table gains "Reference" and "Change" columns, matched on the group key (`roleTitle|level`); a group absent from the reference shows "New" in the change cell.
- The action-plan block shows the done delta.
- A comparability notice renders when the population differs by at least 10 % between the two runs or the frozen models differ (different criterion keys or weight points): "Limited comparability: this mapping covers 118 people compared with 96 in September 2025. Read the changes together with the changed population." Text states the concrete difference.
- The reference run's gap, analyses and actions are three extra subscriptions keyed by the reference run id; delta cells render skeleton bars until they load.

Without a reference nothing from this list renders: no empty arrows, no dashes, no "no comparison selected" sentences.

## Backend changes

1. `getPayMappingGap`: each equal-work group's `tcc` gains `womenMedian`, `menMedian`, `medianGapPct` (from the existing `genderStats`), masked to null under the same rules that mask means today (gender-pure and singleton). Base keeps means only. The wire type and the report assembly (which computes medians itself today) switch to the wire values so the number exists once.
2. `getPayMappingRunBySlug` returns `withPayCount` and `followUpDate`.
3. `payMappingRuns.followUpDate?: number` (day precision), mutation `setPayMappingFollowUpDate({ runId, followUpDate: number | null })`, allowed on completed runs, audit event `payMapping.followUpDateSet` with a `followUpDate` changes diff, labels in every locale.
4. The masking threshold constants (`EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER`) and their two predicates move to `apps/dashboard/lib/pay-mapping-masking.ts`, imported by the overview helpers and by the signing projection.

## Client helpers (pure, unit-tested, under `apps/dashboard/lib/pay-mapping-overview/`)

- `overviewKpis(gap, analyses, actions, run)`: the six card values and notes.
- `overviewObservations(gap, analyses, actions, praxis, locale-independent codes)`: ranked observation rows as typed objects (kind, status, subject key, numbers); the component maps them to i18n.
- `overviewGroupRows(gap, analyses, actions)`: table rows with masking applied.
- `overviewActionPlan(actions, run, runs)`: status counts, cost split, process step.
- `overviewComparison(current, reference)`: deltas and the comparability decision.

Every helper takes wire objects only and returns plain data. The analysis-status helper from the two-report spec is reused, not duplicated.

## i18n

`dashboard.payMapping.overview.*` is rewritten for the new surface (card labels, notes, observation templates, status words, table columns, action-plan labels, comparison footers, comparability notice, process steps, reference selector). Help bodies for risk group, affected people, remaining to analyse, comparison, comparability and the process indicator, in five locales within the caps. The removed widgets' keys (`clock.*`, `meanComparisonTitle`, `wholeSurveyTitle`, related help) are deleted.

## Tests

- Unit tests for every helper: KPI values, observation ranking and cut-off, table rows with masking at the thresholds, cost annualisation (per month x 12), process step derivation, deltas, comparability at the 10 % edge and on model change, "New" for groups absent from the reference.
- Component tests: the table (default sort, status filter, masked cell, skeleton row parity), the reference selector (URL sync both ways, "No comparison" removes the parameter), the KPI strip (no delta footer without a reference), the follow-up date control (toast, disabled while saving).
- Backend (convex-test): medians on the gap wire, `withPayCount` and `followUpDate` on the run detail, the follow-up-date mutation on active and completed runs, its audit row.
- Existing tests for the removed widgets are deleted; the docs guards cover the guide page.

## Guide, ADR and cleanup

- `content/docs/<locale>/pay-mapping-overview.mdx` rewritten in five locales for the new surface (what each block shows, how the reference comparison works, why small groups are masked here), then `bun run docs:sync`.
- ADR-0031: the overview as decision surface, client derivation, the comparison layer in the URL, the follow-up date, and the removal of the clock and the population visualisations. ADR-0012 addendum: the masking threshold applies on the overview.
- Delete `equality-clock.tsx`, `mean-comparison-bars.tsx`, the whole-survey donut code in `pay-mapping-overview.tsx`, `lib/equality-clock.ts`, their tests, help keys and message keys.
- Dev deployment reset after the schema change; browser pass on the overview with and without a reference.

## Out of scope

- Historical trend over three to five runs (priority 7) and the population breakdown table, level structure and the clock (priority 8).
- Any new frozen field on snapshot rows (manager flag, department roll-ups).
- AI-written observations.
