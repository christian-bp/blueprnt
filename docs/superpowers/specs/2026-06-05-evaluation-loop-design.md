# Evaluation Loop Design: Roles, Blind Rating, and Live Results

Design spec for the alpha evaluation loop slice. Read together with the
implementation plan `docs/superpowers/plans/2026-06-05-evaluation-loop.md`.

## Goal

Prove the V1 core loop modell -> roller -> poang -> band end to end (PLAN-V1
section 1 and 6). An onboarded admin registers roles (job profiles, with AI
drafting), rates each role blind against the model's criteria (0-5 per
criterion, anchor texts as the only reference), and sees live-derived score and
band outcome in a results view. The static demo dashboard shell is replaced
with real navigation. Score and band are never stored and never manually
overridden (ADR-0002); AI never touches the deterministic path (ADR-0003).

## Decisions (founder, 2026-06-05)

1. **Full alpha loop in one slice**: pure engine (packages/core), role
   register with job profiles, blind rating flow, results view, real
   dashboard navigation. Lands on main as one squash commit.
2. **AI job-profile drafting is part of the role register** (ADR-0003 V1
   scope already covers job profile assistance). Suggestion lifecycle with
   provenance and explicit confirm, same machinery as onboarding.
3. **Demo shell is replaced in this slice**: SectionCards, chart, data table,
   fixture data.json, demo nav items and their i18n keys all go away.
4. **Blind rating is a stepper, one criterion at a time.** The six anchor
   texts ARE the input: the rater clicks the description that fits (0-5).
   Progress indicator, optional motivation per rating, back navigation.
   Blind by construction: no score, no totals, no weights anywhere in the
   flow. (The Excel prototype was a matrix with live totals and anchors on
   another tab; this flow deliberately departs from it.)
5. **Approved roles are locked; editing requires explicit reopen.** A
   "Reopen" action (admin, audited) moves the role back to draft. No silent
   edits of approved results.
6. **Results view = band overview + roles table.** Distribution of roles per
   band on top (Band 1 first, with explicit "Band 1 is highest" messaging),
   the full roles table with score and band outcome below.

## Settled design questions (from the docs)

- **band.shift mechanics**: derived bands are compared at the mutation
  boundary. Every mutation that can change a derived band recomputes all
  bands before and after the write (pure functions over alpha-scale data)
  and logs one `band.shift` audit row per role whose band changed. Nothing
  is stored; ADR-0002 stands. Mutations wrapped: setRating, archiveRole,
  updateCriterionImportance, addCriterion, removeCriterion,
  confirmImportanceReview, confirmModelDraft.
- **computeResults executes in org-scoped Convex queries** calling the pure
  core engine at read time. No materialized results, no pagination (alpha
  scale).
- **Permissions**: editors and admins create/edit/rate roles and confirm AI
  role-profile drafts (role content is member scope, unlike model
  configuration which stays admin). Only admins approve, reopen, and
  archive. Backend enforces; UI hides what the role cannot do.
- **Incomplete ratings**: a role has a score and band only when EVERY model
  criterion has a rating. Until then results show rating progress
  ("5 of 9"), never a partial score. Adding a criterion to the model makes
  previously complete roles incomplete again (logged as band.shift to null);
  removing one can make incomplete roles complete.
- **Guardrails stay advisory**: an inline, non-blocking hint in the rating
  step the moment a selected value falls outside the level's advisory range,
  plus a warning marker per role in results. Never blocks saving or
  approval.
- **AI degradation**: identical to onboarding. No MISTRAL_API_KEY means the
  action marks the suggestion failed with `errors.aiUnavailable`; manual
  entry always works.
- **Orphan ratings**: removeCriterion deletes that criterion's ratings (new
  `by_criterion` index). The engine additionally ignores ratings whose
  criterionId is not in the model (defense in depth).
- **Blindness scope** (assessment glossary): during rating entry the rater
  sees criterion name, description, help text, and anchors only. Rating
  values for other criteria, score, and band are not shown. Score and band
  appear in the result step after the last criterion, and on the role page
  and results view once the role is fully rated.

## Engine (packages/core)

New pure modules, no Convex/Next imports, no side effects (ADR-0002).

```
packages/core/src/scoring.ts      scoreRole, assignBand, computeResults
packages/core/src/guardrails.ts   checkGuardrails
packages/core/src/types.ts        new shared types (extended)
```

### Types (types.ts additions)

```ts
export interface RatingInput { criterionId: string; value: RatingValue }
export interface BandThreshold { band: number; minScore: number }
export interface RoleRatings { roleId: string; ratings: RatingInput[] }
export interface RoleResult {
  roleId: string
  ratedCount: number
  totalCriteria: number
  complete: boolean
  score: number | null
  band: number | null
}
export interface GuardrailRange { criterionId: string; min: number; max: number }
export interface GuardrailWarning {
  criterionId: string
  value: RatingValue
  min: number
  max: number
}
export interface ComputeInput {
  criteria: CriterionWeight[]
  thresholds: BandThreshold[]
  roles: RoleRatings[]
}
```

`criterionId`/`roleId` stay opaque strings (Convex ids stringify into them);
never tighten to Convex types (purity).

### Contracts

- `scoreRole(ratings, criteria): number`
  Sum of `value * weightForImportance(importanceLevel)` over ratings whose
  criterionId exists in `criteria`. Ratings for unknown criterionIds are
  ignored (orphan safety). Throws on duplicate criterionId within either
  input and on a rating value that is not an integer 0-5 (boundary
  narrowing of stored `v.number()`).
- `assignBand(score, thresholds): number`
  Thresholds are `minScore` inclusive lower bounds; Band 1 is highest. Picks
  the threshold with the highest `minScore` that is `<= score` (tie-break:
  lowest band number). Throws on a negative/non-finite score, an empty
  thresholds array, or when no threshold matches (callers always seed a
  floor of 0).
- `computeResults({ criteria, thresholds, roles }): RoleResult[]`
  Per role: ratedCount counts ratings matching model criteria; `complete`
  means `criteria.length > 0` and every criterion is rated; score/band are
  non-null only when complete. Output order follows input order.
- `checkGuardrails(ratings, guardrails): GuardrailWarning[]`
  One warning per guardrail whose criterion has a rating outside
  `[min, max]`. Unrated criteria produce no warning. Advisory only; the
  engine never blocks.

### Test anchors (standardmall)

With the standard template importance mix (weights sum 108):

- all criteria rated 5 -> score 540 -> Band 1 (>= 530)
- all rated 0 -> score 0 -> Band 7
- score 530 -> Band 1; 529 -> Band 2; 450 -> Band 2; 449 -> Band 3
- changing one criterion's importance 7 -> 6 (weight 18 -> 14) with rating 4
  changes the score by exactly 16
- `weightForImportance` is additionally tested over all 7 levels (carried
  review note)

## Schema deltas (packages/backend)

- `ratings` gains `.index("by_criterion", ["criterionId"])` (cleanup path).
- `suggestions.target.kind` gains the documented value `"role.profile"`
  (kind is already `v.string()`; comment update only).
- No changes to `roles`: `purpose`/`responsibilities` stay required strings;
  createRole inserts `""` and "profile complete" means both are non-empty
  after trim. Status defaults to `"draft"` at insert.

## Backend surface

All org-scoped via the existing wrappers (`convex/lib/functions.ts`).
New directory content: `convex/assessment/{roles,ratings,results,compute}.ts`.

| Function | Kind | Notes |
| --- | --- | --- |
| `assessment/roles.createRole` | orgMutation | title/function/team trimmed non-empty; trackId must belong to the org model, levelId to the track; optional profile fields; inserts status draft, purpose/responsibilities "" unless given; audit `role.created` |
| `assessment/roles.updateRole` | orgMutation | patch of profile fields; rejects approved/archived with `errors.roleLocked`; audit `role.updated` (field names in payload) |
| `assessment/roles.listRoles` | orgQuery | non-archived roles + localized track/level names + status + ratedCount/totalCriteria; title asc |
| `assessment/roles.getRole` | orgQuery | full job profile + profileComplete + own ratings (criterionId, value, motivation) + the level's guardrail ranges; never score/band |
| `assessment/roles.setRoleStatus` | orgMutation | transition matrix below; audit `role.statusChange` |
| `assessment/roles.archiveRole` | adminMutation | soft archive (archivedAt); role ids are permanent, never deleted; band-shift wrapped; audit `role.archived` |
| `assessment/ratings.setRating` | orgMutation | upsert by (role, criterion); value integer 0-5; requires profileComplete (`errors.profileIncomplete`) and status draft/inReview (`errors.roleLocked`); criterion must belong to the org model; band-shift wrapped; audit `rating.change` (old/new value) |
| `assessment/results.getResults` | orgQuery | computeResults over the whole org + per-role guardrail warning count; returns table rows + band list |
| `assessment/results.getRoleResult` | orgQuery | per-role result: score, band, per-criterion breakdown (localized name, importance LABEL level, value, motivation, guardrail range + outside flag); `complete: false` shape while unrated |
| `assessment/compute.deriveResults` | helper | loads model criteria/thresholds/non-archived roles/ratings, calls core computeResults |
| `assessment/compute.logBandShifts` | helper | diffs before/after RoleResult sets; one `band.shift` audit row per changed band (missing side = null) |
| `evaluationModel/criteria.removeCriterion` | extended | also deletes the criterion's ratings (by_criterion); band-shift wrapped |
| `evaluationModel/criteria.addCriterion` / `updateCriterionImportance` | extended | band-shift wrapped |
| `ai/suggest.requestRoleProfileDraft` | orgMutation | role must exist, not archived, not approved; inserts `generating` suggestion (kind `role.profile`, roleId) + schedules the action |
| `ai/generate.generateRoleProfileDraft` | internalAction ("use node") | AI SDK v6 `generateText` + `Output.object`, Mistral direct; zod-bounded fields; injection-hardened data tags |
| `ai/suggest.confirmRoleProfileDraft` | orgMutation | applies accepted fields (whitelist of the 9 profile fields, trimmed, length-bounded at the trust boundary); audit `ai.suggestionConfirmed` + `role.updated` |
| `ai/suggest.getOpenSuggestions` | extended | additionally returns `roleId` (null for model-scoped kinds) so role panels can filter |

### Role status machine

```
draft -> inReview      any member; requires profileComplete + ratings complete
draft -> approved      admin shortcut (single-user alpha); same requirements
inReview -> approved   admin
inReview -> draft      any member (withdraw)
approved -> draft      admin (reopen, audited)
anything else          errors.invalidTransition
```

Approved or archived blocks updateRole, setRating, and role-profile AI
confirm with `errors.roleLocked`. Ratings stay editable in draft AND
inReview.

### AI role-profile draft

- Input context: company profile (industry, country, language; reuse
  `requireCompleteSettings`), role title, localized track/level names,
  function, team, plus an optional free-text description wrapped in data
  tags (treated strictly as data, same hardening as model drafts).
- zod schema: `purpose` (1-1000) and `responsibilities` (1-2000) required;
  `decisionMandate`, `stakeholders`, `knowledge`, `financial`, `people`,
  `risk`, `deliverables` optional (1-1000 each). AI never drafts title,
  function, or team (HR context the model cannot know), and never ratings
  (ADR-0003).
- Output language follows the organization language (same rule as model
  drafts).
- Confirm: per-field acceptance (`acceptedFields: string[]` against the
  9-field whitelist); re-validates lengths and non-emptiness before
  patching the role; suggestion flips confirmed/rejected exactly like
  `confirmModelDraft`.

### Audit events (new)

| Event | type | Payload |
| --- | --- | --- |
| roleCreated | `role.created` | `{ roleId }` |
| roleUpdated | `role.updated` | `{ roleId, fields }` |
| roleArchived | `role.archived` | `{ roleId }` |
| roleStatusChanged | `role.statusChange` | `{ roleId, from, to }` |
| ratingChanged | `rating.change` | `{ roleId, criterionId, oldValue, newValue }` |
| bandShift | `band.shift` | `{ roleId, fromBand, toBand }` (null = no complete result) |

### Error codes (new)

`errors.roleLocked`, `errors.ratingsIncomplete`, `errors.invalidTransition`
(+ en/sv/nb/da/fi messages; backend returns codes only).

## Dashboard: navigation and routing

Today everything renders at `/` via component swaps. This slice introduces
real routes behind a route group whose layout owns the auth + onboarding
gates:

```
app/(app)/layout.tsx              client layout: AuthLoading / Unauthenticated /
                                  Authenticated + OnboardingGate(children)
app/(app)/page.tsx                Overview (start page, real counts)
app/(app)/roles/page.tsx          Role register (table + create dialog)
app/(app)/roles/[roleId]/page.tsx Role detail (job profile, AI panel, status,
                                  rating progress, result card when complete)
app/(app)/roles/[roleId]/rate/page.tsx  Blind rating stepper
app/(app)/model/page.tsx          Model page (reuses the criteria editor)
app/(app)/results/page.tsx        Results (band overview + roles table)
```

- `OnboardingGate` is refactored to accept children: it renders the wizard
  while onboarding is incomplete (regardless of URL), otherwise
  `<AppShell organization=...>{children}</AppShell>`.
- `AppShell` (the renamed dashboard-shell) keeps sidebar + header and renders
  children in the content area; it also mounts an `OrganizationProvider`
  exposing `{ orgId, name, role }` (from getOnboardingStatus) via
  `useOrganization()` so every page can make org-scoped calls and gate
  admin-only affordances.
- Sidebar nav: Overview `/`, Roles `/roles`, Model `/model`, Results
  `/results`, with active state from `usePathname()`. Quick Create, Inbox,
  Documents, and the secondary demo group are removed (nav-documents.tsx and
  nav-secondary.tsx deleted; NavMain loses the quick-create props).
- Site header title follows the route (pathname -> nav key map).
- Internal navigation always uses `next/link` (the dashboard has no URL
  locale).
- Deleted: section-cards.tsx, chart-area-interactive.tsx, data-table.tsx,
  app/dashboard/data.json, and the dashboard.cards/chart/table i18n
  sections plus demo nav keys, mirrored across all five locales (parity
  test enforces).
- The model editor core of onboarding's ModelReview is extracted to a shared
  component used by both the onboarding step and `/model`; its i18n
  namespace moves `dashboard.onboarding.model` -> `dashboard.model`
  (mechanical rename across locales; parity protects).

## Blind rating stepper (`/roles/[roleId]/rate`)

- One criterion per step, model order; starts at the first unrated
  criterion (resume). Progress "Criterion N of T" + dots.
- The anchor texts are the input: six selectable option cards (0-5), each
  showing the level number and its anchor text. Criterion name, description,
  and help text above. Optional motivation textarea below (always present;
  no layout shift).
- Guardrail hint: a pre-reserved slot under the options reveals (opacity
  only) an advisory line when the selected value is outside the level's
  range. Never blocks.
- "Next" persists via setRating, then advances; "Back" returns with the
  saved value preselected. Step transitions animate (Motion, respecting
  docs/ui-animation.md and reduced motion).
- After the last criterion: the result step reveals score + band outcome
  (live getRoleResult) with "Band 1 is highest" context and any guardrail
  warnings, plus a link back to the role page, where the status actions
  (submit for review, admin approve) live.
- Blindness invariant: no running total, no weights, no per-criterion
  contributions anywhere in the flow. Weights NEVER appear as numbers
  anywhere in the slice (importance labels only).

## Results view (`/results`)

- Band overview first: one row per band from the model's thresholds (Band 1
  on top), animated count bars, explicit "Band 1 is highest" caption.
- Roles table below: title, track/level, status badge, score (or "n/T
  rated" progress for incomplete roles), band outcome badge, guardrail
  warning marker. Rows link to the role page. Live-reactive: model or
  rating changes recompute instantly.
- Empty state with a CTA to create the first role.
- Terminology: UI label for the outcome is "Band" (assessment.band);
  never "Bandplacering", never "override" (does not exist).

## Out of scope (explicitly NOT in this slice)

- Anchor roles / calibration (deferred; no table exists yet)
- CSV/XLSX import/export of roles
- Band-threshold editing UI, criterion rationale, bias review (E2)
- Motivation nudge triggers (rating 0/4-5, near band boundary): noted UX
  idea, not built
- Unarchive UI, role search/filter/pagination
- AI rating suggestions (AI never rates in V1)
- People/pay contexts, rollplacering (V2)
- Modellversionering (deliberately omitted, ADR-0002)

## Acceptance criteria

1. `bun run test` green across packages; typecheck green; pre-commit hook
   passes on every commit (never `--no-verify`).
2. Engine anchors hold (see test anchors above), proven by core unit tests
   and one backend integration test seeding the standard template.
3. The rating flow never renders score, band, weights, or other criteria's
   values before the result step; weights appear nowhere as numbers.
4. Approved roles reject updateRole/setRating with `errors.roleLocked`;
   reopen (admin) unlocks and is audited.
5. `band.shift` rows are written when a rating change, importance change,
   or criterion add/remove changes any role's derived band (including
   to/from null), and on archive.
6. removeCriterion deletes the criterion's ratings; results recompute and
   roles can become complete by removal.
7. Without MISTRAL_API_KEY the role-profile AI panel shows the translated
   `errors.aiUnavailable` failure and manual entry still works end to end.
8. i18n parity test passes; en.json first, sv mirrored, nb/da/fi machine
   drafts flagged for native review. No hardcoded display text.
9. Demo shell fully removed (components, fixture data, i18n keys in all
   five locales); sidebar shows exactly Overview/Roles/Model/Results plus
   the user menu.
10. Role ids are permanent: no code path deletes or recreates a role row
    (archive is a soft flag).
