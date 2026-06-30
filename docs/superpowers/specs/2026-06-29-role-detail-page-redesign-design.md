# Role detail page redesign

Date: 2026-06-29
Status: design, pending review

## Goal

Make the role detail page feel coherent:

1. Editing should not feel disconnected. Entering edit from the top-right `...`
   menu, then watching fields change in a card elsewhere, is jarring. Move the
   Edit trigger back onto the profile card, beside the fields it edits.
2. Drop the standalone Rating card. Rating progress, the rate action, and the
   result are one concept (the role's evaluation), so they belong in one card,
   not two.

This is a layout and interaction change on one page. It does not touch the
deterministic score/band engine, the backend, permissions, or the rating flow
itself (the blind stepper at `/roles/[roleSlug]/rate` is unchanged).

## Decisions (locked)

- Layout: refined two-column. Profile card on the left (`lg:col-span-2`); a
  right rail holding the merged Evaluation card and the Anchor card.
- Edit: the Edit / Save control returns to the profile card header (beside the
  AI-draft button). The `...` menu reverts to Archive-only (admin; hidden when
  archived; absent for non-admins). This reverses the "Edit in the menu" change
  made earlier this session.
- Evaluation: one stateful card replaces the Rating card and the Result card.

## 1. Layout

The page keeps its grid: `grid gap-6 lg:grid-cols-3`, with the profile card at
`lg:col-span-2` and a right column (`space-y-6`) for the rail. The rail now
holds two cards instead of three:

- Evaluation card (new, merged).
- Anchor role card (unchanged: admin-only, shown once the assessment is
  complete).

The header is unchanged: the breadcrumb (`Roles > Family > Role`), the archived
badge, the track badge, `function . team`, and the `...` actions menu.

## 2. Edit returns to the profile card

`RoleProfileCard` owns its `editing` state again (internal `useState`), with an
Edit / Save toggle button in its header next to the AI-draft popover, exactly as
it did before the "Edit in the menu" change:

- Not editing, not archived: header shows the AI-draft button and an Edit
  button.
- Editing: the Edit button becomes Save (the existing toggle); fields are
  inputs; Save patches only changed fields (unchanged behavior).
- Archived (locked): no controls (read-only), as today.

Consequent reverts:

- The role page (`app/(app)/roles/[roleSlug]/page.tsx`) drops the lifted
  `editing` state and the `editing` / `onEditingChange` props it passes down.
- `RoleActionsMenu` drops the `editing` and `onEdit` props and the Edit item. It
  returns to Archive-only: rendered only for an admin on a non-archived role
  (the empty-menu rule still hides it otherwise).

## 3. The merged Evaluation card

New `components/roles/role-evaluation-card.tsx`, titled "Evaluation", replacing
`RoleRatingCard` and `RoleResultCard`. It receives everything both cards needed:

```
{ orgId: string; roleId: string; slug: string; archived: boolean;
  profileComplete: boolean; ratedCount: number; totalCriteria: number }
```

The role page passes these from the resolved `role` (the same values it passes
to the two cards today).

State machine (one card, mutually exclusive states):

- `evaluated = totalCriteria > 0 && ratedCount === totalCriteria`.
- **Result view** (`evaluated && !archived`): the card queries
  `getRoleResult` (as the result card does today) and shows the Weighting
  (`scoreOutOf`, the 0-100 value), the Band badge, the band-1-is-highest note,
  and `RoleCriterionBreakdown` (reused, unchanged, still shared with RoleSheet),
  plus an "Adjust ratings" action (`adjustRateCta`, links to
  `/roles/{slug}/rate`). Help on the heading explains the Weighting
  (`dashboard.help.scoreLabel` / `scoreBody`).
- **Progress view** (otherwise): shows the progress text (`evaluated`
  vs `notEvaluated`) and, when not archived:
  - profile complete: a Rate / Continue CTA (`rateCta` at 0, `resumeRateCta`
    while partial) linking to `/roles/{slug}/rate`. Help on the heading explains
    blind rating (`dashboard.help.blindRatingLabel` / `blindRatingBody`).
  - profile incomplete: the precondition stated in words (`profileIncomplete`,
    "Fill in purpose and responsibilities before evaluating"), no CTA.
  - archived: progress text only, no CTA (read-only), as today.

Help placement: the heading carries exactly one help morph, and the two states
never co-exist, so blind-rating help (progress) and Weighting help (result)
never stack (guidance convention).

Implementation notes for the plan (not user-facing):

- The view is chosen from the props (`evaluated`, `archived`) so it never
  flashes; the `getRoleResult` query only fills the result data. While that
  query is loading in the result view, show the existing `computing` placeholder
  rather than an empty card.
- `RoleCriterionBreakdown` and the `getRoleResult` query/handler are reused
  verbatim; only the surrounding card is new.

## 4. Components and files

- New: `components/roles/role-evaluation-card.tsx` (+ test). Merges the rating
  progress/CTA logic and the result rendering.
- Delete: `components/roles/role-rating-card.tsx`, `role-result-card.tsx`, and
  their tests (`role-rating-card.test.tsx`, `role-result-card.test.tsx`) per the
  no-legacy rule.
- Keep: `components/roles/role-criterion-breakdown.tsx` (still used by the
  Evaluation card and RoleSheet).
- Revert: `role-profile-card.tsx` (internal `editing` + Edit/Save button),
  `role-actions-menu.tsx` (Archive-only, drop Edit), and the role page wiring
  (`app/(app)/roles/[roleSlug]/page.tsx`: drop the `editing` state; render
  `RoleEvaluationCard` instead of the rating + result cards).
- Anchor card: unchanged.

## 5. i18n

- Add `dashboard.roles.detail.evaluationHeading` ("Evaluation") to `en.json`
  and mirror to `sv`, `nb`, `da`, `fi` (Nordic strings are drafts, flag for
  native review; parity test guards).
- Reuse existing keys: `dashboard.roles.detail.{rateCta, resumeRateCta,
  adjustRateCta, profileIncomplete}`, `dashboard.roles.{evaluated,
  notEvaluated}`, `dashboard.rating.result.{scoreOutOf, bandHighest}`,
  `assessment.band`, and the help keys `dashboard.help.{blindRatingLabel,
  blindRatingBody, scoreLabel, scoreBody}`.
- Remove the now-unused `dashboard.roles.detail.ratingHeading` and
  `resultHeading` keys (in all 5 locales) if a repo-wide grep confirms the two
  deleted cards were their only consumers. Keep `dashboard.rating.result.heading`
  (a separate key used by the rate flow's result step).
- Terminology stays as established: Evaluate / Weighting / Band, never "Score".

## 6. Tests

- New `role-evaluation-card.test.tsx` (mocks `getRoleResult`): profile
  incomplete shows the precondition and no CTA; complete-but-unrated shows the
  Rate CTA; partial shows Continue; fully rated shows the Weighting, Band, and
  breakdown plus Adjust; archived shows read-only progress with no CTA.
- Revert `role-profile-card.test.tsx` to the card-owned edit flow (the Edit
  button toggles to inputs, Save patches changed fields, archived hides the Edit
  button).
- Revert `role-actions-menu.test.tsx` to Archive-only (no trigger for a
  non-admin, no trigger when archived, admin archives via the confirm dialog).
- New code ships with tests in the same commit; the pre-commit hook runs Biome,
  a full typecheck, and the full suite.

## 7. Non-goals

- No change to the blind rating stepper, the scoring/band engine, the backend,
  or permissions.
- The Anchor card is not redesigned.
- No always-editable / inline-edit model (considered and rejected: every blur
  would write an audit row, and inline duplicate-title validation is fiddlier).
- The earlier `dashboard.roles.detail.doneCta` ("Done") key, if already
  orphaned, is outside this change; do not rely on it.
