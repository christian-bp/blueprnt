# Iteration 2, slice C2: per-level likvärdigt analysis + closing gaps

> **For agentic workers:** executed inline (same flow as the other Iteration 2 slices). This document fixes the interfaces and decisions so the work needs no re-analysis.

**Goal:** Close the remaining Systemnoteringar Iteration 2 gaps: note 4's per-level detail view (the only substantive gap), the three small fixes (track in the deep-dive, planned action in the overview, deep links into the analysis), and the reason-taxonomy additions.

**Architecture:** Everything builds on the existing run pages and the slice A-F building blocks. Per the Iteration 3 direction (the analysis page already overwhelms; the page-layer IA redesign happens AFTER all parts exist), every new surface here is a self-contained, collapsed-by-default section with thin coupling to the current page layout, and nothing adds standing (always-expanded) content to the analysis page.

**Tech stack:** unchanged (Next 16 / Convex / TanStack Table v9 / recharts via shadcn chart / next-intl).

## Global constraints

- No schema changes, no gate changes: the level analysis is an analytical complement; the statutory likvärdigt duty remains the women-dominated comparison (DL 3:9, ADR-0012/0015). If legal review later upgrades the per-level analysis to a duty, the wiring point is `requiredDocumentationKeys`.
- All strings through i18n, en first, mirrored to sv/nb/da/fi (drafts flagged for native review; extend the existing go-live entry).
- New surfaces collapsed by default; no layout shift; help texts for new concepts.

## Decisions (settled here)

1. **Entry conditions per level mirror the equal-work rule client-side.** A level qualifies iff `womenCount > 0 && menCount > 0 && (base.gapPct > 0 || tcc.gapPct > 0)` (the same shown-condition incl. the TCC-driven admission, ADR-0015 §5). The `equivalentWork` wire already carries per-level `GapGroup`s unconditionally; the predicate is a pure display filter (`meetsEntryConditions` in `pay-mapping-gap-types.ts`), never a gate input.
2. **Individual documentation from the level view anchors to the person's own equal-work group.** No new target kind: a member row offers the documentation menu only when the member's identity (roleTitle/seniority/level) matches a SHOWN equal-work group (whose key is the valid `person` target). Members of excluded groups get no menu here (their group takes no formal documentation by ADR-0015; the deep-dive covers gender-pure notes). This keeps one record per person visible from both views via `targetMatches`.
3. **No lane-per-level scatter with pair connectors.** One `PayGapDotPlot` per qualifying level's section. The cross-level signal already has its own section; connector lines were rejected for legibility in the master plan.
4. **Placement: analysis tab only** (next to the cross-level section in the likvärdigt chapter area), not the guided wizard. The wizard stays the statutory flow; Iteration 3 decides the final IA.
5. **Taxonomy: add `geographicDifferentiation` and `retention` to the market group.** NEGO is deliberately NOT added (individual negotiation is not a self-standing objective reason; the defensible content is `recruitmentPayLevel`), nor OTHER (an övrigt code undermines documentation quality; nuance lives in the mandatory free-text fields).
6. **Deep link format:** `/pay-mappings/[slug]/analysis?step=<scope>:<groupKey>`; the summary selects the matching checklist row once when its steps are first available. Pair targets keep the plain analysis link (a pair has no chapter step).

## Tasks

### Task 1: taxonomy additions

- `packages/constants/src/payGapReasons.ts`: market group gains `"geographicDifferentiation"`, `"retention"`; `payGapReasons.test.ts` updated (exact arrays).
- `packages/i18n/messages/*.json`: `dashboard.payMapping.reasons.{geographicDifferentiation,retention}` in all five locales.
- `apps/dashboard/lib/audit-constants.ts`: the typed reason `Record` gains both keys (compile-enforced).

### Task 2: one member-selection dispatch

- `pay-mapping-gap-types.ts`: `membersOf(rows, group)` dispatches between the identity match (`groupMembers`) and the per-level selection (`levelMembers`; a level group is the only wire shape with null roleTitle/seniority and a concrete level). The dot plot and the member table switch to it; no signature changes, no caller churn.

### Task 3: member-table level variant

- `pay-mapping-gap-types.ts`: `meetsEntryConditions(group)`, `levelMembers(rows, level)` (priced rows on the level), `shownEqualWorkKeyFor(row, equalWork)` (identity match against shown groups; returns the groupKey or null).
- `group-member-table.tsx`: `MemberRow` gains `trackKey`, `roleTitle`, `seniority`; new optional props `variant: "group" | "level"` (level adds Track and Role columns), `crossLevelFlagged?: ReadonlySet<string>` (flag badge slot per affected woman), and per-row documentation targets resolved via decision 2 (a `memberTargetFor` callback prop so the component stays presentation-only).
- New i18n columns: `detail.columns.track`, `detail.columns.role`, `detail.columns.crossLevel`.

### Task 4: the level-analysis section

- New `components/pay-mapping/equivalent-work-level-analysis.tsx`: a Collapsible (default closed, animated per the existing pattern) with an always-visible lead sentence; inside, one subsection per qualifying level: heading (LevelBadge + counts), compact means/gap line with `PayGapFlagBadge`, `PayGapDotPlot`, and the level-variant member table (default sort women-first, base ascending). `crossLevelFlagged` derives from `buildCrossLevelCases` (already memoized by the caller; thread the case list in, never recompute).
- Mount in `pay-mapping-summary.tsx` beside `CrossLevelSection`. Help pair `dashboard.help.levelAnalysis{Label,Body}`.
- Tests: qualifying-level filtering, columns, flag set, menu-only-for-shown-group members, collapsed default.

### Task 5: small fixes

- Deep-dive track badge: `excluded-groups-sections.tsx` renders `TrackBadge` from the group's first member's `trackKey` (constant within a group).
- Actions overview: `plannedAction` renders as a muted second line inside the problem cell (no eighth column).
- Deep links: `actions-overview.tsx` links group/person targets to `?step=<scope>:<key>`; `pay-mapping-summary.tsx` reads the param and pre-selects the matching checklist row once.

### Task 6: gate, docs, commits

- Full gate (Biome zero, typecheck, all tests, i18n parity). Tracker entry. Go-live native-review entry extended. Conventional commits per concern.
