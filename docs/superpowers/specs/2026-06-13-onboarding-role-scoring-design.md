# Onboarding role scoring, a slimmer role profile, and the "bedömningsnivå" rename

Date: 2026-06-13
Status: approved (design), pending implementation

## Goal

Add **scoring of roles as the final onboarding step**, opt-in and
save-and-exit friendly so the bulk of scoring continues later in the
dashboard. Along the way, **slim the role profile** so onboarding scoring is
light instead of a wall of forms, and **rename the criterion "assessment
anchors" to "bedömningsnivå" (assessment level)** so it is obvious these
texts describe the 0 to 5 levels used to rate a role.

The product principle running through all three: the user never faces a blank
form (AI drafts the profile), never gets trapped (save and exit is always one
click away and is stated up front), and is rewarded with a real derived band.

## Why this is three units

The work splits into three units that land as separate squash commits, in
dependency order:

1. **Slim the role** (prerequisite, also independently valuable).
2. **Rename anchors to bedömningsnivå** (independent).
3. **The "Score your roles" onboarding step** + a dashboard "continue
   scoring" affordance (the feature; depends on unit 1, reads better with
   unit 2).

Sequencing: unit 1 first, then units 2 and 3 in parallel.

## Decisions (settled with Christian)

1. **Slim the role to identity + purpose + responsibilities.** Delete the
   seven structured profile fields (`decisionMandate`, `stakeholders`,
   `knowledge`, `financial`, `people`, `risk`, `deliverables`). Keep identity
   (`title`/`function`/`team`/`trackKey`/`familyId`) and the two-field
   profile core. They were judged to be information overload for the user;
   pre-launch we delete them cleanly and can re-add later with no migration
   cost. The seven fields mirror scoring criteria and were the AI suggester's
   extra output targets, so removing them is a deliberate trim of the V1
   AI-assist surface and of per-band documentation, accepted for simplicity.
2. **Keep the profile gate.** `isProfileComplete` (purpose + responsibilities
   non-empty) still gates rating. A band must have at least a minimal written
   basis. This is what makes the onboarding scoring step capture those two
   fields before rating.
3. **Rename plus a model-surface clarity pass.** Three legibility changes to
   the model surface (unit 2): (a) rename the displayed strings to
   "Bedömningsnivå / Assessment level"; (b) make the criterion editor's six
   inputs read unmistakably as the descriptions of levels 0 to 5 (numbered
   rows + endpoint cues); (c) label the model-view importance value so
   "5 · 20%" reads as "Importance 5 · 20%" (SV "Viktnivå 5 · 20%"). Keep the
   i18n key identifiers (`anchors`, `anchorLevel`, `anchorsLabel`,
   `anchorsBody`) and the Convex field name `criteria.anchors` so the data
   layer and existing keys do not churn. The documented domain term "weight
   points / viktpoäng" (ADR-0004) is unchanged; "Importance / Viktnivå" is
   only the surface label.
   Anchor *roles* (`ankarroll`) are untouched.
4. **Onboarding scoring is opt-in with save and exit.** The final step leads
   with an explicit choice ("Want to score your roles now?"). If the user
   opts in, it is made unmistakable that they can save and exit anytime and
   continue in the dashboard. Reaching the step and choosing "later" (or
   exiting after starting) completes onboarding; no minimum number of scored
   roles is required to leave the wizard.
5. **Scoring lives inside the wizard frame (inline), not via deep-linking the
   existing `/roles/[id]/rate` page.** Inline keeps the "this is still
   onboarding" feel and keeps the save/exit + completion wiring simple, for
   the cost of one small wrapper component. The blind `RatingStepper`, the
   `RatingResult` reveal, and the `RoleAiPanel` draft are reused unchanged.
6. **Dashboard re-entry is an Overview card plus the existing per-role
   Resume/Adjust CTA**, not a dedicated scoring page. The card
   ("Continue scoring, X of Y roles scored") shows until every role is
   complete.

## Unit 1: slim the role

Remove the seven optional fields end to end. Keep `purpose`,
`responsibilities`, and identity.

Touch list:

- `packages/backend/convex/assessment/tables.ts`: remove the seven optional
  field definitions from the `roles` table (lines ~28-34).
- `packages/backend/convex/assessment/roles.ts`: `PROFILE_TEXT_FIELDS` becomes
  `["purpose", "responsibilities"]`; trim `optionalProfileArgs`, the
  create/update field loops (~101, ~365), and the `getRole` projection
  (~290-301). `isProfileComplete` is unchanged.
- `packages/backend/convex/ai/generate.ts`: the profile zod schema (~252-260),
  the `OPTIONAL_FIELDS` array (~264-270), and the prompt line that lists the
  optional fields (~308) are **hardcoded**; trim all three to the two fields.
- `packages/backend/convex/ai/persist.ts`: the hardcoded profile validator
  (~69-77); trim to the two fields.
- `packages/backend/convex/ai/suggest.ts`: derives from `PROFILE_TEXT_FIELDS`
  (`ROLE_PROFILE_FIELDS`, the char-limit helper, the loop ~468), so it follows
  unit 1 automatically; verify the char-limit helper still makes sense for two
  fields.
- `apps/dashboard/components/roles/role-profile-card.tsx`: remove the
  `OPTIONAL_FIELDS` constant and its rendering rows; keep purpose +
  responsibilities text rows and the AI draft popover.
- `apps/dashboard/components/roles/role-ai-panel.tsx`: trim the hardcoded
  `PROFILE_FIELDS` list (~18-28) to the two fields.
- `apps/dashboard/lib/suggestion-schemas.ts`: no change. `profile` is a
  generic `z.record(z.string(), z.string())`.
- `apps/dashboard/components/roles/create-role-dialog.tsx`: no change. It
  already collects only title/function/team/track.
- i18n: delete `assessment.role.{decisionMandate,stakeholders,knowledge,`
  `financial,people,risk,deliverables}` from all five locale files
  (`en`, `sv`, `nb`, `da`, `fi`). Keep `purpose`, `responsibilities`.
- `docs/contexts/assessment/CONTEXT.md`: rewrite the "Jobbprofil" definition
  to the slim core; note the structured fields are deferred (pre-launch, can
  return). Update the i18n table to drop the seven rows.
- Tests: update `assessment/roles.test.ts`, `roles/role-profile-card.test.tsx`,
  `roles/role-ai-panel.test.tsx`, `ai/suggest.test.ts`, and any
  `ai/generate`-touching test.

**Guardrail.** The criterion **ids** `knowledge`, `stakeholders`, `financial`,
`people`, `risk` (in `standardTemplate.content.*.ts`, `scoring.fixtures.ts`,
`scoring.test.ts`, `criteria.test.ts`) share names with the deleted role
fields but are **criteria**, a different concept. They stay. Only the
role-profile fields of those names are deleted. Grep matches in
`packages/core` and `evaluationModel` are criteria, not role fields.

## Unit 2: rename to "Bedömningsnivå / Assessment level"

Change only the displayed values. Key identifiers and the `criteria.anchors`
field name stay.

- `dashboard.model.editor.anchors`: "Assessment anchors (0 to 5)" ->
  **"Assessment levels (0 to 5)"** / SV "Bedömningsankare (0 till 5)" ->
  **"Bedömningsnivåer (0 till 5)"**.
- `dashboard.model.editor.anchorLevel`: "Anchor {level}" -> **"Level {level}"**
  / SV "Ankare {level}" -> **"Nivå {level}"**.
- `dashboard.help.anchorsLabel`: -> "How do assessment levels work?" / SV
  "Hur fungerar bedömningsnivåer?".
- `dashboard.help.anchorsBody`: rewrite to state plainly "the six levels, 0 to
  5, for this criterion," keep the existing clarification that this is not the
  same as an anchor role.
- `model.anchor` (an unused domain constant, never rendered): leave as is; out
  of scope.
- nb/da/fi: mirror with native terms (nb "vurderingsnivå", da
  "bedømmelsesniveau", fi to confirm), flagged for native review.
- `docs/contexts/assessment/CONTEXT.md`, `docs/contexts/evaluation-model/`
  `CONTEXT.md`, and `docs/PLAN-V1.md` §6: record the UI term "bedömningsnivå"
  and add a one-line note that `nivå` here means the criterion's 0 to 5 scale,
  distinct from the V2 individual-seniority `nivå` (ADR-0005). The canonical
  domain term `ankare` (and `criteria.anchors` in code) is unchanged.

### Criterion-editor clarity pass

`apps/dashboard/components/model/criterion-form.tsx` renders the six level
inputs more legibly so it is obvious each box describes one level of the 0 to
5 scale (chosen treatment: "numbered rows + endpoint cues"):

- A muted helper line under the `anchors` legend: "Describe what a role looks
  like at each level, from 0 (lowest) to 5 (highest)."
- Each row gains a small fixed-width level-number badge (0..5) to the left of
  its `anchorLevel` label ("Level 0" .. "Level 5"), so numbering reads as
  scale position, not a name.
- The 0 row carries a "lowest" tag and the 5 row a "highest" tag, making the
  scale direction explicit. The 0 and 5 inputs get example placeholders ("e.g.
  not present / not required" and "e.g. the strongest reasonable expression").
- Layout is static (no state-triggered reveal), so it respects the
  minimize-layout-shift rule. Inputs stay single-line `Input` for now;
  switching to small textareas is a separate, optional follow-up.

New i18n keys (all five locales, same commit): `dashboard.model.editor`
`.levelsIntro`, `.levelEndpointLowest`, `.levelEndpointHighest`,
`.levelPlaceholderLowest`, `.levelPlaceholderHighest`. (New keys use the
`level*` stem; the legacy `anchors`/`anchorLevel` keys keep their names per
decision 3.)

Test: `apps/dashboard/components/model/criterion-form.test.tsx` gains coverage
that the level labels, endpoint tags, and helper line render. The i18n parity
test stays green as long as all five locales carry the same key set.

### Model-view importance label

In `apps/dashboard/components/model/model-editor.tsx`, the read-mode criterion
row builds the importance node as the bare `{weightPoints} · {share}`. Prefix
it with the surface label so each row reads "Importance 5 · 20%" (SV
"Viktnivå 5 · 20%").

- New i18n key `dashboard.model.editor.importance` = "Importance" / SV
  "Viktnivå" (all five locales; nb "Vektnivå", da "Vægtniveau", fi flagged for
  native review). The row renders `{importance} {weightPoints} · {share}`.
- The existing `weightPointsLabel`/`weightPointsBody` help stays where it is
  (the budget meter); no second help popover is added (one concept, one help).
- **Layout-shift watch:** the importance slot is a fixed `w-44` that holds the
  read label in read mode and the 1-5 `ButtonGroup` in edit mode. Adding the
  word may require widening that slot so neither mode reflows when toggling
  edit. Verify the longest label ("Importance 5 · 20%") fits without wrap in
  the read state and the `ButtonGroup` still fills the slot.
- Test: assert the read-mode row renders the importance label with the points
  and share, at the render site (`model-editor.tsx`; add a focused test if no
  model-editor test exists yet).

## Unit 3: the "Score your roles" onboarding step

### Completion rewiring (the structural change)

Today `families-step` does `createStarterSet` (or `confirmStarterImport`),
then `completeOnboarding`, then advances. Both `model` and `families` steps
have `isComplete` permanently false and rely on a session latch, so a reload
mid-flow bounces back to the model review.

New wiring:

- `families-step` stops calling `completeOnboarding`. It creates the starter
  set and advances (`latchNext`) to the scoring step. Both the template and
  the AI-import paths change.
- `packages/backend/convex/accounts/onboarding.ts`: `getOnboardingStatus`
  gains `hasRoles` (org has at least one role).
- `apps/dashboard/components/onboarding/onboarding-wizard.tsx`: add the
  `score` step to `STEPS` after `families`. `families.isComplete` becomes
  `hasRoles` (server-derived, so reload resumes correctly).
  `score.isComplete` becomes `completed` (= `onboardingCompletedAt` set).
- `completeOnboarding` (`accounts/organization.ts`, unchanged signature, still
  requires `MIN_CRITERIA`) now fires from the scoring step on every exit path:
  "I'll do this later", "Save and exit", and "finished all roles".

Net effect: reload mid-scoring resumes on the scoring step (families is
server-complete, onboarding is not yet complete); leaving the step by any path
sets `onboardingCompletedAt` and the gate flips to the dashboard.

### Screen flow inside the step

New component `apps/dashboard/components/onboarding/score-step.tsx`, plus a
small per-role wrapper.

1. **Fork screen** (shown only when no role has been started, derived from
   "any role has a rating or a non-empty profile"): heading "Your roles are
   ready. Want to score them now?" with a `HelpMorphButton`
   (`dashboard.help.onboardingScore*`) explaining what scoring is and that the
   band is derived, never set by hand. Buttons: **[Score now]** /
   **[I'll do this later]**. "Later" calls `completeOnboarding` and finishes.
2. **Scoring view** (after "Score now", and on re-entry once any role is
   started): a persistent reassurance line, "You can save and exit anytime and
   continue in your dashboard," above a list of starter roles each showing
   rating progress (`ratedCount` / total). A **"Save and exit"** button is
   always present and calls `completeOnboarding` then finishes.
3. **Per role** (the wrapper): because starter roles have empty profiles, the
   role opens to inline **profile capture** (the two fields, with `RoleAiPanel`
   reused for one-click AI draft), then the existing **`RatingStepper`** (blind,
   auto-saves each criterion via `setRating`), then the **`RatingResult`**
   reveal (the band). "Done" returns to the list, which now shows that role
   complete.
4. When every role is complete, a small done state calls `completeOnboarding`
   and finishes.

New UI is the fork screen + the per-role wrapper. `RatingStepper`,
`RatingResult`, and `RoleAiPanel` are reused unchanged.

### Dashboard "continue scoring" affordance

- `apps/dashboard/app/(app)/page.tsx` (Overview): a card "Continue scoring, X
  of Y roles scored," shown until all roles are complete, linking to the roles
  register (`/roles`) where the per-role Resume CTAs live. X and Y are derived
  from the existing `assessment.results.getResults` (`complete` flag per role);
  no new backend query.
- `apps/dashboard/components/roles/role-rating-card.tsx`: unchanged. Its
  Start/Resume/Adjust CTA already covers per-role resume after onboarding.

## Cross-cutting

### i18n (new keys, all five locales, same commit)

- `dashboard.onboarding.dots.score` (step label).
- `dashboard.onboarding.score.*` (fork heading + the two button labels, the
  save-and-exit reassurance line, the done state, the inline profile-capture
  copy).
- `dashboard.help.onboardingScoreLabel` / `dashboard.help.onboardingScoreBody`
  (a new domain concept ships with help in all locales, same commit, per the
  "guide every concept" rule).
- `dashboard.overview.continueScoring.*` (the Overview card).

### Audit

Unchanged. `setRating` already audits and logs band shifts; `completeOnboarding`
already audits onboarding completion. No new `AUDIT_EVENTS` keys.

### Animation

The fork -> list -> per-role -> result transitions use the wizard's existing
`AnimatePresence` crossfade. Read `docs/ui-animation.md` before writing or
reviewing any animation (FLIP scale, height-vs-box-model, gap collapse).
Respect `MotionConfig reducedMotion="user"`.

### Layout shift

The fork screen, list, and per-role views swap within the wizard's existing
fixed frame; the "Save and exit" button and reassurance line sit in
pre-reserved slots so opting in does not reflow.

## Out of scope (deliberate)

- No change to the deterministic engine (`packages/core`), no band storage,
  no band override (ADR-0002, ADR-0004).
- No AI anywhere in the scoring/score path (AI only drafts the profile text,
  which HR confirms; ADR-0003).
- No change to the `ratings` schema or the blind-rating principle.
- The seven structured profile fields are deleted, not hidden; re-adding them
  later is a separate change (pre-launch, no migration obligation).
- Renaming the i18n key identifiers or the `criteria.anchors` field name (a
  larger, low-value rename) is not done.

## Testing

- Unit 1: backend tests for create/update/getRole with the slimmed field set;
  `role-profile-card` and `role-ai-panel` render only the two fields; AI
  suggest/generate/persist round-trip with two fields.
- Unit 2: i18n parity test stays green (same key set in all five locales).
  `criterion-form.test.tsx` asserts the level labels, endpoint tags, and the
  helper line render; the model-editor read row asserts the "Importance"
  label renders with points and share. The value-only string renames need no
  behavioral test.
- Unit 3: `getOnboardingStatus` returns `hasRoles`; `families.isComplete`
  follows `hasRoles` and `score.isComplete` follows `completed`; the wizard
  resumes on the scoring step after families and on reload mid-scoring; each
  exit path ("later", "save and exit", "all complete") sets
  `onboardingCompletedAt`; the fork screen is skipped once a role is started;
  the Overview card shows the right X of Y and hides when all complete. New
  code ships with tests in the same commit (Vitest 4, `bun run test`).

## Files most affected

- `packages/backend/convex/assessment/{tables,roles,roles.test}.ts`
- `packages/backend/convex/ai/{generate,persist,suggest,suggest.test}.ts`
- `packages/backend/convex/accounts/{onboarding,organization}.ts`
- `apps/dashboard/components/onboarding/{onboarding-wizard,families-step}.tsx`
  and new `score-step.tsx` (+ per-role wrapper)
- `apps/dashboard/components/roles/{role-profile-card,role-ai-panel}.tsx`
- `apps/dashboard/components/model/criterion-form.tsx` (level clarity pass)
- `apps/dashboard/components/model/model-editor.tsx` (importance label)
- `apps/dashboard/app/(app)/page.tsx`
- `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- `docs/contexts/assessment/CONTEXT.md`,
  `docs/contexts/evaluation-model/CONTEXT.md`, `docs/PLAN-V1.md`
