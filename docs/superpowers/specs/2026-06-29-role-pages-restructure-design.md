# Role and family page header restructure

Date: 2026-06-29
Status: design, pending review

## Goal

Make the role detail page and the role family page better structured and easier
to navigate:

1. Consolidate the scattered lifecycle buttons (rename, delete, archive) into a
   single `...` actions menu, instead of spreading them across the header.
2. Make the family one click away from a role, with a breadcrumb that doubles as
   the page title.

This is a header and navigation restructure. It does not change scoring, the
deterministic engine, permissions, or the role/family data model (beyond
exposing one already-loaded field for the breadcrumb link).

## Surfaces in scope

- Role detail page: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`.
- Family page header: `apps/dashboard/components/roles/family-header.tsx` (owned
  by `apps/dashboard/app/(app)/roles/families/[familySlug]/page.tsx`).

## Decisions (locked)

- Header style: compact breadcrumb as title. One row, no separate large brand
  `PageHeading`. The last crumb is the current entity, styled to still read as
  the page title.
- Actions menu: a top left `...` (ghost icon `Button` with `MoreVerticalIcon`)
  opening a `DropdownMenu`. Lifecycle actions only.
- Destructive actions confirm via `AlertDialog` (the documented dropdown pattern
  from `components/model/criterion-item.tsx`). The `MorphConfirmButton` retires
  from both headers.
- Rename family opens a small Dialog (not inline edit), because inline editing a
  breadcrumb segment is awkward.
- Role stays Archive (soft, audited). Family stays a hard Delete. Deleting a
  family unfiles its roles (they keep their data and move to the "No family"
  group); it never archives or deletes the roles. The delete dialog lists the
  affected roles so the impact is explicit.
- Edit profile and the AI draft assistant stay in the profile card, next to the
  content they act on. They do not move into the actions menu.

## 1. Header layout

Both pages replace today's header with a single flex row
(`flex flex-wrap items-center gap-3`, so badges wrap on narrow screens):

Role page:

```
[...]  Roles > Engineering > Senior Engineer   . IC .   Eng . Platform
-------------------------------------------------------------------------
profile card                              rating / result / anchor cards
```

Family page:

```
[...]  Roles > Engineering
-------------------------------------------------------------------------
band-guidance note . track sections / role tables
```

- The `...` actions menu sits at the start (left) of the row.
- The breadcrumb follows. Its final crumb (the role or family name) is a
  `BreadcrumbPage` (`aria-current="page"`), styled `font-medium text-foreground`
  so it reads as the title even though the large brand heading is gone.
- Role page only: the archived `Badge`, the `TrackBadge`, and the
  `function . team` muted text stay on this row, after the breadcrumb.
- If a viewer has no available actions, the `...` trigger is not rendered at all
  (see permissions below). No reserved slot is needed because this is a header,
  not an aligned table row.

## 2. The actions menu

A ghost icon `Button` (`MoreVerticalIcon`, with an aria-label) is the
`DropdownMenuTrigger`; `DropdownMenuContent` is aligned to `start`. Same anatomy
as `criterion-item.tsx`, lifted from row level to page level.

Contents:

- Family menu: `Rename`, `Delete family` (destructive).
- Role menu: `Archive` (destructive).

Destructive items use `variant="destructive"` and open an `AlertDialog`
(outline Cancel first, destructive confirm last, per the dialog convention).

Permissions (preserved exactly as today, no policy change in this work):

- Family Rename and Delete: available to all members (the current
  `family-header.tsx` has no admin gate).
- Role Archive: admin only (`orgRole === "admin"`, as today).

Empty-menu rule: when the menu would contain no items for the current viewer,
the `...` trigger is omitted. Concretely:

- A non-admin on the role page sees no `...` (Archive is the only role action and
  it is admin only).
- An already-archived role shows no `...` (Archive does not apply twice, and
  there is no Unarchive action today; see non-goals).

## 3. Shared breadcrumb component

New `apps/dashboard/components/page-breadcrumb.tsx`, a thin wrapper over the
existing shadcn `Breadcrumb` (`packages/ui/src/components/breadcrumb.tsx`).

- Props: `segments: { label: string; href?: string }[]`.
- Renders each segment as a `BreadcrumbLink` (via `next/link` `asChild`) except
  the last, which renders as a title-styled `BreadcrumbPage`.
- Reused by both pages (and available to the rate sub-page later).

Segments:

- Role page: `Roles` (-> `/roles`), then the family `{familyName}`
  (-> `/roles/families/{familySlug}`) when the role has a family, then the role
  title (current). A family-less role omits the family crumb:
  `Roles > {role title}`.
- Family page: `Roles` (-> `/roles`), then `{family name}` (current).

The breadcrumb root label reuses `dashboard.nav.roles` ("Roles").

## 4. Rename family dialog

A small `Dialog` (shadcn anatomy: `DialogHeader` with `DialogTitle`, body form,
`DialogFooter` with Cancel then Save), opened from the family menu `Rename` item.

- Form: react-hook-form + Zod factory `makeRenameFamilySchema(t)` with one
  required, trimmed, bounded `name` field, following the form convention.
- Pre-filled and gated on `isValid && isDirty` (a settings-style edit form), so
  an unchanged name cannot fire a no-op mutation.
- Submit calls the existing `renameRoleFamily` mutation. Duplicate-name errors
  are surfaced inline via the existing `isDuplicateFamilyError` classification
  and the `errors.roleFamilyExists` message.

This replaces the current inline edit (heading morphs into an input). The
`Input`, Save, and Cancel inline controls are removed from `family-header.tsx`.

## 5. Delete family flow (Option A: unfile and list)

Deleting a family is a hard delete that unfiles its roles (current
`removeRoleFamily` behavior, unchanged). The improvement is transparency,
adapted from the polyform archive dialog.

The `Delete family` menu item opens an `AlertDialog` that:

- States the action: delete the family `{name}`.
- States the consequence: its N roles will move to "No family"; they keep all
  their data and stay active. (Reuses the intent of the existing
  `dashboard.roles.family.removeHint` copy, moved out of the standing header line
  and into the dialog.)
- Lists the affected roles by title in a scrollable list
  (`max-h-[200px] overflow-y-auto`), animated in per the motion conventions
  (`AnimatePresence` + height/opacity), mirroring polyform's
  `delete-project-modal`.
- Empty family: no list, just the confirm.

The role list is free: the family page already loads its roles (it renders them
grouped by track), so the dialog receives them as a prop. No new query.

Confirm calls the existing `removeRoleFamily` mutation and navigates to `/roles`
(as today).

Note: this also removes the permanent hint line under the family header, so the
header collapses to one tidy breadcrumb row.

## 6. Backend change (one field)

`packages/backend/convex/assessment/roles.ts`:

- Add `familySlug: v.union(v.string(), v.null())` to `roleDetailShape`.
- Return it from `buildRoleDetail`:
  `familySlug: role.familyId !== undefined ? (fNames.get(role.familyId as string)?.slug ?? null) : null`.
  The `familyNames` map (`fNames`) is already loaded in `buildRoleDetail` and
  already carries `.slug` (it is used the same way in `listRoles`).

This is the only backend change. It powers the family crumb's link on the role
page. The family page already has its name and is reached by its slug, so it
needs nothing.

## 7. i18n

All new strings are added to `packages/i18n/messages/en.json` first, then
mirrored to every other locale file (`sv`, `nb`, `da`, `fi`) and flagged for
native review. Parity is guarded by the i18n test.

Reused (no new key):

- Breadcrumb root: `dashboard.nav.roles`.
- "No family" label: `dashboard.roles.family.none`.
- Family menu labels: `dashboard.roles.family.renameCta`,
  `dashboard.roles.family.removeCta`.
- Family rename save/cancel and name label:
  `dashboard.roles.family.saveCta`, `dashboard.roles.family.cancel`,
  `dashboard.roles.family.nameLabel`.
- Delete family dialog body: `dashboard.roles.family.removeHint` (moved out of
  the standing header line and into the dialog description, not duplicated).
- Role archive labels: `dashboard.roles.archive.cta`,
  `dashboard.roles.archive.confirm`, `dashboard.roles.archive.cancel`.
- Duplicate family error: `errors.roleFamilyExists`.

New keys (illustrative names; finalized in the plan):

- `dashboard.roles.detail.actionsMenu`: aria-label for the role `...` trigger
  ("Role actions").
- `dashboard.roles.family.actionsMenu`: aria-label for the family `...` trigger
  ("Family actions").
- `dashboard.roles.archive.dialogTitle`: Archive `AlertDialog` title.
- `dashboard.roles.archive.dialogBody`: Archive `AlertDialog` description (the
  read-only consequence; the existing `archivedHint` copy can seed this).
- `dashboard.roles.family.removeDialogTitle`: Delete family `AlertDialog` title.
- `dashboard.roles.family.removeListLabel`: heading above the affected-roles list
  ("Roles that will be unfiled:").
- `dashboard.roles.family.renameDialogTitle`: Rename `Dialog` title.

## 8. Files touched

- `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`: replace the header row
  with `PageBreadcrumb` + the role actions menu; keep the badges and meta on the
  row; keep the archived hint line below when archived.
- `apps/dashboard/components/roles/family-header.tsx`: rewrite as
  `PageBreadcrumb` + the family actions menu (Rename dialog + Delete dialog).
  Remove the inline rename controls, the standing remove-hint line, and the
  `MorphConfirmButton`.
- New `apps/dashboard/components/page-breadcrumb.tsx`: shared breadcrumb.
- New role/family actions-menu pieces under `apps/dashboard/components/roles/`
  (for example `role-actions-menu.tsx`, `family-actions-menu.tsx`, and the
  Rename dialog and Delete dialog they own).
- `apps/dashboard/lib/role-schemas.ts` (or a sibling): add
  `makeRenameFamilySchema(t)`.
- `packages/backend/convex/assessment/roles.ts`: add `familySlug`.
- `packages/i18n/messages/*.json`: new keys in all locales.

DRY note: extract a small `ConfirmDeleteMenuItem` (a `DropdownMenuItem`
`variant="destructive"` paired with its `AlertDialog`) used by both the family
and role menus, so the destructive-confirm wiring is written once.
`components/model/criterion-item.tsx` keeps its current inline implementation for
now (out of scope); it can adopt the shared component in a later, focused change.

## 9. Tests

New code ships with tests in the same commit (turbo-cached pre-commit run).

- Backend (`packages/backend`, convex-test): extend `getRoleBySlug` and
  `getRole` coverage to assert `familySlug` is set for a filed role and `null`
  for a family-less role.
- `PageBreadcrumb`: renders the right segments and links; the last crumb is the
  non-link page title; a family-less role omits the family crumb.
- Role page: the `...` menu is hidden for non-admins and for archived roles;
  Archive opens the `AlertDialog` and calls `archiveRole` on confirm.
- Family page: Rename opens the dialog, gates on dirty, and calls
  `renameRoleFamily`; surfaces the duplicate-name error. Delete opens the dialog,
  lists the affected role titles, and calls `removeRoleFamily` on confirm; an
  empty family shows no list.

## 10. Non-goals and follow-ups

- No Unarchive: there is no unarchive mutation today (archive is one-way;
  archived roles are read-only). An archived role therefore shows no `...` menu.
  Adding Unarchive would be a new backend mutation and is out of scope.
- No permission changes: family Rename/Delete stay member-available; role Archive
  stays admin only. Tightening family actions to admin only would be a separate
  policy decision.
- No cascade archive on family delete (rejected): a role is an independent,
  evaluable unit, not contained by a family; cascading would retire evaluated
  roles and their bands and hit the admin-gate boundary. Unfile + list is the
  chosen behavior.
- The "No family" group in the register is functional but understated (plain
  text header, sorts last). Improving its prominence is a possible follow-up,
  not part of this restructure.
```
