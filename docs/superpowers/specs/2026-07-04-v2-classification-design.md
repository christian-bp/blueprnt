# V2 Classification Flow: Design Spec

**Date:** 2026-07-04
**Status:** Design approved; ready for implementation plans.
**Sources:** `docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` (§6, §8.1, companion items); `docs/superpowers/specs/2026-07-04-v2-plan-coverage-audit.md` (phase-1 gap analysis); ADR-0002, ADR-0003, ADR-0005.
**Goal:** Connect each imported employee to a V1 role (track) and a per-individual level via a deterministic suggestion layer followed by HR confirmation. No AI in the path. This spec delivers the missing classification half of build-phase 1 from the salary-import design (§8.1) and the five companion completion items scattered across phase 1 and phase 2.

**Architecture:** `packages/core` hosts the pure suggestion engines (no Convex/React imports, no side effects). The Convex backend persists suggestions via the existing `personAssignments` + `assignPersonToRole` infrastructure. A new `/people/classify` dashboard route is the HR review surface. The companion items each touch one existing subsystem without introducing new abstractions.

**Invariants preserved:**
- Role != Person: `roles`/`ratings` gain no person, gender, or pay field.
- Derived never stored (ADR-0002): score/band stay derived live; nothing in this spec stores a derived numeric value except the `personAssignments` rows, which are assignment records, not derived figures.
- AI never auto-decides (ADR-0003): a suggestion is a reviewable proposal that HR confirms; the engine produces candidates, not decisions.
- Level is per-individual (ADR-0005): level lives on `personAssignments`, validated against the role's `trackKey` via `isValidLevelForTrack`.
- Every state-changing mutation writes an audit row; `assignPersonToRole` already does this via `AUDIT_EVENTS.assignmentSet`.
- All data stays in the EU (ADR-0001); no external calls.
- Org-scoped: every function is tenant-isolated; no cross-org reads.

---

## 1. Data model foundation: add `title` to `people`

**The gap.** The `people` table (`packages/backend/convex/people/tables.ts`) has no `title` field. The import wizard maps the `Befattning` column to a canonical `title` field during the mapping step, but `importPayroll` (`people/import.ts`) does not persist it, and `upsertPersonByExternalRef` (`people/people.ts`) accepts no `title` argument. The raw job title is validated then silently dropped. Without it, the suggestion engine has nothing to match against.

**Change.** Add `title: v.optional(v.string())` to the `people` table definition in `packages/backend/convex/people/tables.ts`. Wire `upsertPersonByExternalRef` to accept and persist an optional `title` argument. Wire `importPayroll` to pass the mapped `Befattning` value through that argument.

**Why optional.** Manually created persons (not imported from payroll) may have no job title string on record. Null/absent is valid; classification simply flags them as needing a title before they can be matched.

**No new tables.** Classification reuses `personAssignments` and `assignPersonToRole` exactly as designed in the salary-import spec. No schema additions beyond the `title` field.

---

## 2. Title-to-role suggestion engine

**Location:** `packages/core/src/classification/titleMatcher.ts` (pure, no I/O).

**Input:** an array of distinct imported titles (each with a count of how many people share it) and the org's current role list (each role carrying `id`, `title`, `trackKey`).

**Algorithm (deterministic, three-tier):**

1. **Normalize.** Apply `normalizeTitleString(s)` to both the imported title and each role title: lowercase, strip diacritics (Unicode canonical decomposition, drop combining marks), strip punctuation, collapse whitespace. The normalization function is a pure utility, exported separately so it is independently testable.

2. **Exact match.** If the normalized imported title equals the normalized role title exactly, return that role with `confidence: "high"`.

3. **Fuzzy match.** Tokenize both normalized strings on whitespace. Compute token overlap as `|intersection| / |union|` (Jaccard index). Pick the role with the highest score above a defined threshold (e.g. 0.5). Return it with `confidence: "medium"`. When two roles tie, apply the manager nudge (see below) as a tiebreaker; if still tied, pick the role with the lexically earlier title so the output is deterministic.

4. **No match.** If no role clears the threshold, return `{ match: null, confidence: "unmatched" }`.

**Manager nudge.** If `isManager === true` for a person sharing this title, and the tiebreaker is needed, prefer roles whose `trackKey` is `"Lead"` or `"M"` over `"IC"`. This is a tiebreaker only, never a primary signal.

**Statistikkod.** Reserved as a future secondary signal (YAGNI). The engine accepts it in its type signature so callers can pass it forward without a later breaking change, but the current implementation ignores it.

**Output per distinct title:**
```
{
  importedTitle: string
  personCount: number
  suggestedRoleId: Id<"roles"> | null
  confidence: "high" | "medium" | "unmatched"
}
```

**Constraints.** Pure TypeScript: no `Date`, no `Math.random`, no Convex imports, no network. Exports a single `suggestRoleForTitles` function. Unit-tested in `packages/core`.

---

## 3. Level suggestion engine

**Location:** `packages/core/src/classification/levelSuggester.ts` (pure, no I/O).

**Input per person:** the role's `trackKey` (`"IC" | "Lead" | "M"`), the person's `title` string (may be absent), and the person's `employmentStartDate` (may be absent).

**Algorithm (keyword + tenure heuristic):**

The engine extracts two signals and combines them conservatively.

*Keyword signal (from title):*
- Tokens `junior`, `jr`, `associate`, `intern` -> low seniority within the track.
- Tokens `senior`, `sr`, `principal`, `staff`, `architect` -> high seniority within the track.
- Tokens `lead`, `teamlead`, `tech lead` -> prefer `trackKey = "Lead"` (used to validate; if the assigned role is actually IC, default to IC entry).
- Tokens `chef`, `manager`, `head`, `chief`, `director`, `vp` -> prefer `trackKey = "M"`.
- No keyword match -> neutral (mid).

*Tenure signal (years since `employmentStartDate` to today):*
- < 2 years -> low.
- 2-5 years -> mid.
- > 5 years -> high.

*Combination and mapping to levels:*

| Track | Low | Mid | High |
|-------|-----|-----|------|
| IC    | IC1 | IC3 | IC5  |
| Lead  | Lead-1 | Lead-2 | Lead-3 |
| M     | M1  | M2  | M3   |

When both signals are available and agree, use that band. When they disagree, take the lower (conservative default). When neither signal is available, use mid. The result is always validated with `isValidLevelForTrack(trackKey, level)` from `@workspace/constants` before returning.

**Output:** `{ suggestedLevel: string }` where `suggestedLevel` is always a valid level for the given track.

**Constraints.** Pure TypeScript, same rules as the title matcher. The tenure calculation takes the current date as an argument (not `Date.now()`) so tests are deterministic. Unit-tested with fixed date inputs.

---

## 4. The Classify surface

**Route:** `/people/classify` under `apps/dashboard/app/(app)/people/classify/page.tsx`.

**Entry points:**
- A "Classify employees" action on the People page (`/people`), prominent when the org has imported people with unclassified titles.
- An automatic prompt offered at the end of a successful import ("Import complete. N employees need classification. Classify now").

The page uses `PageHeader` (consistent with the roles and families pages introduced in recent commits). It has two coordinated panels, described below.

### 4A. Title-to-role table

A table with one row per distinct imported title. Columns: job title string, person count (how many employees share it), a suggested-role Select (prefilled with the engine's best candidate, or empty for unmatched), and a confidence hint (a small badge: "High confidence match", "Suggested match", or "Unmatched").

Confirming a title row (clicking "Assign" or equivalent) calls `assignPersonToRole` for each person sharing that title with `levelSource: "confirmed"`, at the HR-selected role and level.

**Unmatched titles.** An unmatched row offers two inline resolution options, rendered as a small action group inside the row:
- "Create role" (opens a sheet or inline form; title prefilled; HR picks `trackKey` and `function/team`; calls the existing `createRole` mutation; on success the new role is immediately available in the Select on this row).
- "Map to existing" (opens a searchable role picker; same result as manually choosing from the Select).

Both options result in a confirmed assignment for all people sharing that title once HR selects or creates the role.

### 4B. Per-person level panel

Expanding a title row reveals the list of people sharing it. Each person row shows their display name (or pseudonym when the org has `pseudonymizeNames` on), employment start date, tenure, and a level Select prefilled with the level suggested by the level engine. HR can adjust the level before confirming. Confirming a title row persists each person's level at the value shown in their row at the moment of confirmation.

This is not a separate step: it is an inline expansion of the title row. The two-panel design is a single coherent surface, not a sequential wizard.

**Classification state badge.** Each title row carries a badge reflecting the aggregate state of its people: "Confirmed" (all people confirmed), "Pending review" (suggestions computed, none confirmed), or "Unclassified" (no suggestion, no confirmation). The badge updates in real time as HR works through the list.

**All UI copy goes through i18n** (`next-intl`) under `dashboard.classify.*`. All five locales (en, sv, nb, da, fi) must be populated in the same commit. Nordic-language strings are marked as draft and flagged for native review.

---

## 5. Persistence and provenance

**Approach: eager suggestion (approved).** A Convex mutation `runClassificationSuggestions` (an `orgMutation` in `people/classification.ts`) computes and persists a `levelSource: "suggested"` assignment for each person whose imported title matched a role. Because one mutation cannot call another public `orgMutation`, the implementation shares the underlying DB write logic with `assignPersonToRole` via an internal helper extracted from `people/assignments.ts`. This mutation is triggered in two moments:
- Automatically at the end of a successful `importPayroll` action (after people rows are upserted and titles are saved).
- On opening the Classify surface, for any person who has a title but no assignment yet (a re-import may have added new people or new titles since the last run).

**What the mutation does.** For each distinct title in the org's people:
1. Run `suggestRoleForTitles` (pure engine) against the org's role list.
2. If a match exists (high or medium confidence), run `suggestLevelForPerson` (pure engine) for each person sharing that title.
3. For each such person, check the current open assignment via `getCurrentAssignment`. Skip the person if they already have a `levelSource: "confirmed"` assignment (HR has already reviewed them; do not re-suggest). Skip also if they already have a `levelSource: "suggested"` assignment for the same role and level (re-run idempotency: no-op is correct). Otherwise call `assignPersonToRole` with `levelSource: "suggested"` and the current timestamp as `effectiveAt`.

People whose titles are unmatched get no assignment. They are flagged "Unclassified" in the UI.

**HR confirmation.** When HR reviews the Classify surface and confirms a title row, `assignPersonToRole` is called again with `levelSource: "confirmed"` (and the HR-selected or HR-accepted role and level). This call closes the existing "suggested" open assignment and opens a new "confirmed" one, following the existing chronological invariant: the confirmed `effectiveAt` must be greater than the suggested `effectiveAt`. In practice this is always satisfied because confirmation happens after suggestion.

**No AI auto-decides (ADR-0003).** A suggestion is a reviewable proposal. The engine is deterministic and transparent: HR sees the confidence tier, can correct the role, can adjust the level, and confirms explicitly. The "suggested" record is a draft in the system's own provenance language, not a committed fact.

**New backend query needed.** The Classify surface requires a query that returns distinct titles across an org's people along with person counts and their current assignment state. This is not yet built. The implementation plan includes `listPeopleByTitle(orgId)` (an `orgQuery` in `people/people.ts`) returning, per distinct title, the list of people (id, displayName, employmentStartDate, currentAssignment). This query uses the `by_org` index on `people` with a collect, groups by title in JS, and joins `getCurrentAssignment` per person. The set of distinct titles per org is small (bounded by headcount), so the collect approach is safe.

---

## 6. Classification status: badge, not gate

**People list enrichment.** The existing People page (`/people`) gains a "Classification status" column (or inline badge on each person row) showing one of three states:
- Confirmed (the person has a `levelSource: "confirmed"` open assignment).
- Pending review (the person has a `levelSource: "suggested"` open assignment, not yet confirmed).
- Unclassified (the person has no open assignment).

**Summary line.** The People page header area shows an "N of M classified" summary (where "classified" means confirmed) and a "Classify employees" action when M > 0 and any person is unclassified or pending.

**No hard gate.** The reporting and analysis features (pay-gap grouping, gap engine, frozen runs) are deferred per the current V2 sequencing. Classification is not a mandatory prerequisite that blocks other surfaces. HR can navigate away from the Classify surface at any point; progress is preserved (suggested assignments are already persisted).

---

## 7. Data model changes summary

The only schema change in this spec:

| Table | Change | File |
|-------|--------|------|
| `people` | Add `title: v.optional(v.string())` | `packages/backend/convex/people/tables.ts` |

`personAssignments`, `payRecords`, `importMappingProfiles`, and all other tables are unchanged.

Backend function changes (not schema changes):
- `upsertPersonByExternalRef` (`people/people.ts`): add optional `title` arg.
- `importPayroll` (`people/import.ts`): pass mapped `Befattning` value as `title`.
- New: `runClassificationSuggestions` mutation (`people/classification.ts`).
- New: `listPeopleByTitle` query (`people/people.ts` or `people/classification.ts`).

---

## 8. Companion completion items

These items finish the import+classification pillar. Each is a small, mostly-specified task; they are in scope for the implementation plans but receive design-light treatment here because they are individually straightforward.

**(i) Reload saved `importMappingProfile` on re-import.** The wizard (`components/people/import/`) must load the org's saved `importMappingProfiles` record at the start of the map step and pre-seed the column dropdowns. If all required fields are already mapped with high confidence, the map step should be skippable (a "Looks right, continue" shortcut). The query is a simple `by_org` lookup; the wire-up is a UI change only.

**(ii) FTE-adjusted total-comp helper.** The `totalMonthlyComp` helper in `packages/constants/src/pay.ts` sums `basicMonthly + components` but does not FTE-adjust. Add `fteTotalMonthlyComp(basicMonthly, components, ftePercent)` returning `totalMonthlyComp(basicMonthly, components) / (ftePercent / 100)`. Pure, unit-tested. Used by the gap engine (phases 3-5) and available for display on the per-person detail surface.

**(iii) Manual salary-entry UI.** The `setSalary` mutation (`people/pay.ts`) exists and is tested but has no dashboard caller. A per-person detail surface at `/people/[id]` (new route, see note below) will host a salary add/adjust form wired to `setSalary`. The form follows the standard `react-hook-form + Zod + shadcn Form` pattern; the submit button triggers `setSalary` with `source: "manual"`. On success: `toast.success(t("dashboard.toast.saved"))`. Audit is already wired inside `setSalary`.

**(iv) `pseudonymizeNames` display toggle.** An org display setting (`pseudonymizeNames: boolean`, stored on the org settings document, not on `people`). When on, the frontend renders `Anställd #<externalRef>` in place of `displayName` wherever a person's name appears. The real `displayName` is stored unchanged and is still returned by backend queries; the substitution is a pure client-side formatting decision. The toggle lives in org settings (the settings page already has a section structure). All five locales.

**(v) Erasure UI.** A "Delete employee" action on the per-person detail surface (`/people/[id]`) calls the existing `erasePerson` mutation (`people/erase.ts`, an `adminMutation`, which already performs a true hard delete of `people`, `personAssignments`, `payRecords`, and audit snapshot anonymization). The action requires a type-to-confirm gate (standard AlertDialog with a `type: <externalRef>` confirmation field), consistent with the user-erasure pattern in admin settings. On success: navigate back to `/people` with `toast.success(t("dashboard.toast.deleted"))`.

**Note on `/people/[id]`.** Items (iii) and (v) both require a per-person detail route. This route does not exist today (the People list rows are not clickable). The route should be added as part of the companion items plan; it can start with a minimal layout (name header, salary history, classification/level, delete action) and be extended later. The People list rows become clickable links to it.

---

## 9. Testing

**Pure engines (`packages/core`).**
- `suggestRoleForTitles`: unit tests covering exact match, fuzzy match above threshold, below-threshold no-match, tiebreaker with manager flag, and determinism (same input always produces same output).
- `normalizeTitleString`: unit tests for diacritics, punctuation, whitespace, mixed case.
- `suggestLevelForPerson`: unit tests for each keyword tier, each tenure band, combined signals agreeing, combined signals disagreeing (lower wins), no signal (mid default). All tests pass a fixed `today` date argument.
- `fteTotalMonthlyComp`: unit tests for 100% FTE (no change), 80% FTE, zero FTE guard.

**Backend mutations (`packages/backend`, using `convex-test` on `edge-runtime`).**
- `runClassificationSuggestions`: tests covering org with all matched titles, org with unmatched titles (no assignment created), re-run idempotency (re-running after confirmation does not overwrite confirmed assignments).
- `assignPersonToRole` already has tests; extend to cover the confirmed-after-suggested scenario.
- `upsertPersonByExternalRef` with `title` arg: test that title is persisted and updated on re-import.

**Component tests (`apps/dashboard`).**
- Classify surface: renders the title-to-role table with suggested roles; the inline expand shows per-person level Selects; confirming a row calls `assignPersonToRole` for each person; an unmatched row renders the create/map actions; the confidence badge reflects the engine's tier.
- People list: classification badge renders correctly for confirmed / pending / unclassified states; the "N of M classified" summary line counts correctly.

**i18n parity.** The existing parity test in `packages/i18n` catches any key present in `en.json` but missing from sv/nb/da/fi. All new `dashboard.classify.*` and `dashboard.toast.*` keys must pass this check; the implementation commit includes all five locale files.

---

## 10. Phasing and plan breakdown

Suggested split into four focused implementation plans:

**Plan 1: Data foundation + suggestion engines (pure)**
Scope: add `title` to the `people` schema; wire `upsertPersonByExternalRef` and `importPayroll` to persist it; implement `normalizeTitleString`, `suggestRoleForTitles`, and `suggestLevelForPerson` in `packages/core`; implement `fteTotalMonthlyComp` in `packages/constants`. All with unit tests. No UI, no backend mutations beyond the `upsertPersonByExternalRef` wire-up.

**Plan 2: Backend: suggestions mutation + queries**
Scope: `runClassificationSuggestions` mutation in `packages/backend/convex/people/classification.ts`; `listPeopleByTitle` org query; i18n keys for audit events if any new events are introduced. Tests with `convex-test`. This plan has no UI component.

**Plan 3: The Classify surface (UI)**
Scope: the `/people/classify` route and all its components; the People list classification badge and summary line; i18n strings in all five locales; wiring to Plan 2's backend queries and mutations. Component tests for the Classify surface and the enriched People list. The `pseudonymizeNames` display toggle (companion item iv) fits here since it affects the same render path.

**Plan 4: Companion completion items**
Scope: `/people/[id]` detail route; manual salary-entry UI (companion item iii); erasure UI (companion item v); import mapping profile reload on re-import (companion item i). Each item is a self-contained task within this plan. The per-person detail route is the shared dependency that the manual salary form and the erasure action both build on.

Plans 1 and 2 are strictly sequential (2 depends on the engines from 1). Plan 3 depends on Plan 2. Plan 4 depends on Plan 3 for the detail route but companion item (i) (mapping profile reload) depends only on Plan 1.

---

## 11. Out of scope

Everything in phases 3-5 of the salary-import spec (§8) remains out of scope for this classification spec:
- Equal-work and equal-value grouping (score-tolerance engine).
- Gap analysis: median, mean, quartiles, gender-dominance flag, small-group masking.
- Frozen report runs (`payGapReportRun`, ADR-0008).
- Reporting UI and PDF export.
- Employer-size threshold gating and cadence logic.

This spec closes the classification gap in phase 1 and the two loose ends in phase 2 (FTE-adjust helper, manual salary UI), and does not advance phases 3-5.
