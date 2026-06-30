# Role page: evaluation-first layout and a card actions menu

Date: 2026-06-29
Status: design, pending review

## Goal

The role detail page currently puts the job profile (role settings) in the wide
2/3 column and the evaluation in the narrow 1/3 rail. For an evaluation product
that is backwards: the weighting, band, breakdown, and anchor are the payoff,
the profile is the input. Rebalance the page so the evaluation leads, give the
evaluation card the room to lay out its anchor and adjust controls cleanly, and
move those controls into a card-level actions menu.

This is a layout and interaction change on the role detail page. It does not
change the evaluation, the deterministic engine, the anchor lifecycle, the
mutations, the backend, or permissions.

## Decisions (locked)

- The page stacks vertically: the Evaluation card is full-width on top, the Job
  profile card is full-width below it. The 3-column grid is removed.
- The Evaluation card stays a single full-width column. Score and band stay in
  the header, joined by a new trailing `...` actions menu.
- The card's two actions live in that menu: `Adjust ratings` (everyone) and,
  for admins, `Manage anchor role` / `Designate as anchor role`. The inline
  "Adjust ratings" button is removed from the card body.
- The anchor STATUS (heading + help + status badge + band badge + motivation)
  stays visible inline in the card body, as a bottom row, for everyone, only
  when the role is an anchor. Only the anchor ACTION moves into the menu.
- Two menus, clean split: the page-header menu keeps the role-lifecycle action
  (Archive); the card menu holds the evaluation actions. The existing
  page-header `RoleActionsMenu` is unchanged.
- `Designate as anchor role` lives in the menu only (no inline designate
  button); the anchor status row still appears only once the role is an anchor.

## 1. Page layout

`apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`. The page's outer wrapper is
already `<div className="space-y-6">` and the header row (breadcrumb + badges +
`RoleActionsMenu`) and the archived hint stay as they are. Replace the
`<div className="grid gap-6 lg:grid-cols-3">` block (profile in `lg:col-span-2`,
evaluation in the rail) with the two cards rendered directly in the stack, in
this order:

1. `<RoleEvaluationCard ... />` (full width)
2. `<RoleProfileCard ... />` (full width)

All existing props stay. The AI-draft comment that sits above the profile card
moves with it. On small screens the page already stacks (the grid was the only
desktop split), so only the desktop layout changes: side-by-side becomes
stacked. Nothing inside either card changes because of the move; the profile
card simply gets full width (it was 2/3 before).

## 2. Evaluation card

`apps/dashboard/components/roles/role-evaluation-card.tsx`. Props are unchanged
(`orgId`, `roleId`, `slug`, `archived`, `profileComplete`, `ratedCount`,
`totalCriteria`, `anchorRole`, `isAdmin`). The state machine is unchanged:
`showResult = evaluated && !archived`, then `result?.complete` chooses the
result view vs the computing placeholder; otherwise the progress/CTA view.

### Complete (result) state

- **Header.** `CardTitle` = `Evaluation` + the score help morph on the left
  (unchanged). On the right, a flex group containing: the score
  (`scoreOutOf`), the `Band` badge (still guarded `result.band != null`), and a
  new trailing `...` **actions menu** (section 3). The score/band markup is
  unchanged; the menu is appended after the band badge.
- **Body.** In order:
  1. The `bandHighest` hint (unchanged).
  2. `RoleCriterionBreakdown` at full width (unchanged component; it already
     scales to any width via `flex-1` bars).
  3. The **anchor status row**, rendered only when `anchorRole !== null`,
     separated from the breakdown by a divider (a `border-t` on the row's
     wrapper, with top padding). It renders `RoleAnchorStatus` (section 4).
  - The inline `Adjust ratings` button is removed from the body (it becomes a
    menu item).

A non-admin on a complete role sees the score/band, the breakdown, the anchor
status row when designated, and a menu whose only item is `Adjust ratings`.

### Other states (unchanged)

- Computing (`showResult && !result.complete`): the `computing` message, no
  menu.
- Not evaluated / progress (`!showResult`): the `evaluated` / `notEvaluated`
  message and, when not archived, the rate CTA (`rateCta` / `resumeRateCta`) or
  the `profileIncomplete` note. No menu.
- Archived: read-only, no anchor row, no menu (consistent with the prior anchor
  decision that an archived role shows no anchor designation on the page; the
  backend marks it `replaced` and `listAnchorRoles` excludes it).

## 3. The card actions menu

A `DropdownMenu` in the Evaluation card header, rendered only in the complete
state. Trigger: a ghost icon `Button`, `size="icon"`, with
`MoreHorizontalIcon` and an `aria-label` from the new key
`dashboard.roles.detail.evaluationActionsMenu` ("Evaluation actions").
`DropdownMenuContent align="end"`.

Items, in order:

- **Adjust ratings** (everyone): a `DropdownMenuItem` rendered `asChild` around a
  `next/link` `Link` to `/roles/${slug}/rate`, label `detail.adjustRateCta`
  (existing key). Internal navigation uses the Link component, never a plain
  anchor.
- **Manage / Designate anchor role** (admins only, `isAdmin`): a
  `DropdownMenuItem` whose `onSelect` opens the anchor dialog. Label is
  `anchor.manageCta` when `anchorRole !== null`, else `anchor.designateCta`. The
  dialog itself (section 4) decides which form to show.

The card owns the dialog open state: `const [anchorOpen, setAnchorOpen] =
useState(false)`. The menu item calls `setAnchorOpen(true)`; the card renders
`<AnchorDialog open={anchorOpen} onOpenChange={setAnchorOpen} orgId roleId
anchorRole />` only for admins. `getModel` stays gated to dialog-open inside
`AnchorDialog`, so a non-admin (no dialog) and an admin with the dialog closed
both issue no model query.

Layout-shift: the menu trigger is a fixed-size icon button in the header; the
menu is a popover (no reflow). The anchor status row only appends below the
breakdown. Nothing already on screen moves when the menu opens. No new
animation is introduced; existing breakdown layout animation is untouched
(docs/ui-animation.md).

## 4. Anchor refactor

`apps/dashboard/components/roles/role-anchor-control.tsx` is restructured so the
status display and the dialog are separate, composable pieces (the card needs
the status inline and the dialog behind a menu item):

- **Remove** the `RoleAnchorControl` wrapper component (it bundled status +
  button + dialog and owned the open state). No-legacy: delete it in the same
  change; it has no other consumers (only the Evaluation card used it).
- **Add** `RoleAnchorStatus`, a presentational component:
  `{ anchorRole: AnchorRoleInfo }` (non-null). It renders the existing status
  markup extracted verbatim from the old wrapper: the `Anchor role` heading
  (`anchor.heading`) + the help morph (`help.anchorRoleLabel` /
  `anchorRoleBody`) + the status badge (reusing `STATUS_KEYS` and
  `STATUS_BADGE_VARIANTS`), then the band badge (`anchor.bandOption`) and the
  motivation paragraph. One help morph only.
- **Export** the existing `AnchorDialog` (controlled `open` / `onOpenChange`,
  `orgId`, `roleId`, `anchorRole`). It is unchanged: `getModel` gated on `open`,
  renders `DesignateForm` when `anchorRole === null` else `EditForm` keyed by
  `reviewedAt`, footer Cancel-first then submit, closes on success. The forms,
  the mutations (`designateAnchorRole` / `updateAnchorRole`), the dirty +
  non-empty-motivation gate, and the partial-update spread are all unchanged.
- `AnchorRoleInfo`, `STATUS_KEYS`, `STATUS_BADGE_VARIANTS`, and the field
  sub-components stay in this file, shared by `RoleAnchorStatus` and the forms.

The filename stays `role-anchor-control.tsx` (the anchor UI module: status +
dialog).

## 5. i18n

- Add `dashboard.roles.detail.evaluationActionsMenu` ("Evaluation actions") to
  `en.json` and mirror to `sv`, `nb`, `da`, `fi` (Nordic drafts, flag for native
  review; parity test guards).
- Reuse existing keys for everything else: `detail.adjustRateCta`,
  `anchor.manageCta`, `anchor.designateCta`, and all the `anchor.*` and
  `help.*` keys the status row and dialog already use.
- No key is removed (every current key still has a consumer: the status markup
  moves into `RoleAnchorStatus`, the dialog keys stay in the forms).

## 6. Tests

- `role-evaluation-card.test.tsx` (update):
  - Complete state still renders the score, band badge, and breakdown.
  - Complete state: the `...` actions menu (by its aria-label) opens and
    contains `Adjust ratings` linking to `/roles/<slug>/rate`; the body no
    longer has a standalone Adjust button.
  - Complete + admin + anchor designated: the anchor status row renders inline
    (status badge text + motivation); the menu has `Manage anchor role`, and
    selecting it opens the dialog (the motivation field appears).
  - Complete + admin + not an anchor: no status row; the menu has
    `Designate as anchor role`, and selecting it opens the designate form.
  - Complete + non-admin: the menu has only `Adjust ratings` (no anchor item);
    a designated anchor still shows its status row.
  - A non-complete state (progress or computing) renders no actions menu.
- `role-anchor-control.test.tsx` (rewrite to the new exports):
  - `RoleAnchorStatus` renders the status badge, band badge, and motivation for
    a designated anchor.
  - `AnchorDialog` (controlled `open`): the designate form submits
    `designateAnchorRole` with the right payload and closes; the edit form
    submits `updateAnchorRole` and closes. Carry over the file-scoped Select
    mock used today to drive the band field in the dialog.
- New code ships with tests in the same commit; the pre-commit hook runs Biome,
  a full typecheck, and the full suite. Parity test guards the new key in all 5
  locales.

## 7. Non-goals

- No change to the evaluation, the deterministic engine, the score/band, or
  `getRoleResult`.
- No change to the anchor lifecycle, the `designateAnchorRole` /
  `updateAnchorRole` mutations, the backend, or who may designate (admin-only
  stays admin-only; the backend stays the authority).
- No change to the page-header `RoleActionsMenu` (Archive) or to who can adjust
  ratings (everyone who can rate, unchanged).
- No change to the Job profile card internals; only its position (full width,
  below the evaluation) changes.
- Archived behavior is unchanged: an archived role shows no anchor status on the
  page and no card menu.
