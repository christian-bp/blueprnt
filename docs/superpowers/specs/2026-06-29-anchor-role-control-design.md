# Anchor role as an action on the Evaluation card

Date: 2026-06-29
Status: design, pending review

## Goal

On the role detail page the Anchor role designation is a permanent form that
sits as a second card below the Evaluation card in the right rail, so a tall
profile pushes it below the fold. It is also an occasional admin action (it only
applies to an admin on a fully evaluated role). Make it a compact status plus a
button on the Evaluation card, with the form in a dialog, so the rail is a single
card and the anchor is never a buried panel.

This is a layout and interaction change on the role detail page. It does not
change the anchor lifecycle, the mutations, the deterministic engine, the
backend, or permissions (designate/update stay admin-only; the backend stays the
authority).

## Decisions (locked)

- The standalone `AnchorRoleCard` is removed. The anchor lives as a control
  inside the Evaluation card's result (complete) state.
- The anchor designate/update form moves into a dialog opened from a button.
- The "requires a completed assessment" message is dropped: the control only
  renders in the complete/result state, where the assessment is by definition
  done, so the message is redundant (the progress view already conveys "not yet
  evaluated").

## 1. `RoleAnchorControl`

New `apps/dashboard/components/roles/role-anchor-control.tsx`, rendered by the
Evaluation card in its result state (after the criterion breakdown). Props:

```
{ orgId: string; roleId: Id<"roles">; anchorRole: AnchorRoleInfo | null; isAdmin: boolean }
```

where `AnchorRoleInfo = { expectedBand: number; motivation: string; status: "active" | "underReview" | "replaced"; reviewedAt: number }` (the existing shape from the role detail's `anchorRole`).

Render logic:

- `anchorRole === null && !isAdmin` -> render nothing.
- `anchorRole === null && isAdmin` -> a "Designate as anchor role" button
  (`dashboard.roles.anchor.designateCta`) that opens the dialog (designate form).
  No status line (there is no designation yet).
- `anchorRole !== null` (everyone) -> a compact status line: the "Anchor role"
  label (`dashboard.roles.anchor.heading`) with its help morph
  (`dashboard.help.anchorRoleLabel`/`anchorRoleBody`), the status badge
  (Active / Under review / Replaced, reusing the existing status-key and
  badge-variant maps), the band (`bandOption`), and the motivation text.
  - `isAdmin` -> additionally a "Manage anchor role" button
    (`dashboard.roles.anchor.manageCta`, new) that opens the dialog (edit form).

The help morph appears once, on the status line's label (guidance: one help per
row). Layout-shift: the control adds content below the breakdown only; nothing
above it reflows.

## 2. The anchor dialog

A shadcn `Dialog` (controlled by the control's open state), only ever opened by
admins. `DialogHeader` with `DialogTitle` = `dashboard.roles.anchor.heading`
("Anchor role"); a `DialogDescription` only if there is copy (otherwise set
`aria-describedby={undefined}` on `DialogContent`, per the shadcn convention).
Body = the form; `DialogFooter` = Cancel (outline) first, then the submit.

- Designate (anchorRole null): the band select + motivation textarea + the 2-5
  count hint (`countHint`, or `tooMany` once 5 anchors are active); footer submit
  = `designateCta`; calls `designateAnchorRole`. On success, close the dialog.
- Edit (anchorRole present): the band select + motivation textarea + status
  select + the "reviewed at" line; footer submit = `updateCta` ("Save changes");
  calls `updateAnchorRole`; gated on dirty + non-empty motivation (as today). On
  success, close. The form is keyed by `anchorRole.reviewedAt` so a concurrent
  admin's update remounts it with fresh values (preserve the existing behavior).
- Errors surface inline above the footer (the existing failure handling), not the
  reserved `ErrorSlot` line the card used (a dialog can grow without reflowing the
  page).

The band options come from `getModel` and the active count from
`listAnchorRoles`, loaded for admins only (`"skip"` otherwise), as today.

The existing field sub-components (band field, motivation field, reviewed line),
the designate/update mutations, and the status maps move into this file
unchanged in behavior.

## 3. Evaluation card integration

`RoleEvaluationCard` gains two props: `anchorRole: AnchorRoleInfo | null` and
`isAdmin: boolean`. In its result view (the complete state), after
`RoleCriterionBreakdown` and the Adjust ratings action, it renders
`<RoleAnchorControl orgId roleId anchorRole isAdmin />`. The progress and
archived states are unchanged (no anchor control there).

## 4. Files

- New: `apps/dashboard/components/roles/role-anchor-control.tsx` (+ test). Holds
  the control, the dialog, the two forms, the field sub-components, the status
  maps, and the `getModel`/`listAnchorRoles` queries (relocated from the card).
- Delete: `apps/dashboard/components/roles/anchor-role-card.tsx` and
  `anchor-role-card.test.tsx` (no-legacy rule).
- Modify: `apps/dashboard/components/roles/role-evaluation-card.tsx` (add the two
  props; render the control in the result view) and its test (add an
  anchor-section assertion).
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`: pass
  `anchorRole={role.anchorRole}` and `isAdmin={orgRole === "admin"}` to
  `RoleEvaluationCard`; remove the `AnchorRoleCard` import and render.

## 5. i18n

- Add `dashboard.roles.anchor.manageCta` ("Manage anchor role") to `en.json` and
  mirror to `sv`, `nb`, `da`, `fi` (Nordic drafts, flag for native review; parity
  test guards).
- Reuse all other `dashboard.roles.anchor.*` keys (heading, designateCta,
  expectedBandLabel, bandOption, motivationLabel, motivationPlaceholder,
  countHint, tooMany, statusLabel, statusActive/UnderReview/Replaced, reviewedAt,
  updateCta, error) and `dashboard.help.anchorRoleLabel`/`anchorRoleBody`.
- Remove `dashboard.roles.anchor.requiresAssessment` from all 5 locales if a
  repo-wide grep confirms the deleted card was its only consumer (the dropped
  state).
- Terminology unchanged (Band, etc.).

## 6. Tests

- New `role-anchor-control.test.tsx`: non-admin + not designated renders nothing;
  admin + not designated shows the Designate button and opens the designate form
  dialog; designated shows the status (band + status badge + motivation) to a
  non-admin with no button; designated + admin shows the Manage button and opens
  the edit form dialog; submitting the dialog calls the mutation and closes.
- `role-evaluation-card.test.tsx`: add a case asserting the anchor control
  appears in the complete state for an admin (and not in the progress state).
- Delete `anchor-role-card.test.tsx`.
- New code ships with tests in the same commit; the pre-commit hook runs Biome, a
  full typecheck, and the full suite.

## 7. Non-goals

- No change to the anchor lifecycle, the `designateAnchorRole`/`updateAnchorRole`
  mutations, the engine, the backend, or who may designate (admin-only).
- The Evaluation card's progress/result/archived state machine is otherwise
  unchanged.
- No change to the profile card or the role actions menu.
