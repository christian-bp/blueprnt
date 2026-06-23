# Design: member-side org management + auto-slug on org create

Date: 2026-06-23
Status: Approved design, pending implementation

Two related platform-admin improvements.

## A. Manage a user's organizations from the member side

Today membership is added from the org's manage dialog ("Add member" section).
Move adding to the member side and give each user an Organizations dialog.

### Changes
- **`manage-organization-dialog.tsx`**: remove the "Add member" `<section>` (the
  user Select + role Select + Add button), the `addMembership` mutation hook, the
  `addUserId`/`addRole` state, and the `memberIds`/`addableUsers` derivation. Also
  remove the now-unused **`users` prop** from `ManageOrganizationDialog`. The
  members list (role change + remove) and the settings section stay.
- **`organizations-section.tsx`**: stop passing `users={...}` to
  `ManageOrganizationDialog`, and remove the `const users = useQuery(listUsers)`
  if it is used only for that (confirm; otherwise keep).
- **New `apps/dashboard/components/admin/manage-user-organizations-dialog.tsx`**:
  props `{ user: { authId, name, email }, open, onOpenChange }`. It is the mirror
  of the org dialog's members section, per user:
  - Lists the user's current memberships (org name + a role `Select` →
    `setMembershipRole`, + a `...` dropdown with a destructive Remove →
    `removeMembership`), from a new `listOrganizationsForUser` query.
  - An "add to organization" control: an org `Select` (from
    `listOrganizations`, filtered to orgs the user is NOT already in) + a role
    `Select` (default editor) + an Add button → `addMembership`.
  - Empty state when the user has no memberships.
- **`users-section.tsx`**: add an "Organizations" `DropdownMenuItem` to each
  user's `...` menu (above Delete) that sets an `orgTarget` state; render
  `ManageUserOrganizationsDialog` driven by it (mirror the existing
  `DeleteUserDialog` open/close pattern).
- **Backend `platform/admin.ts`**: add `listOrganizationsForUser` (`platformQuery`,
  args `{ authId }`) that calls `components.betterAuth.membership.listMembershipsForUser`
  ({ userId: authId }) and maps to `{ orgId, name, role }` (the component query
  already returns `organizationName`, so no extra join). The
  `addMembership`/`setMembershipRole`/`removeMembership` mutations are reused
  unchanged.

### i18n (new keys, all 5 locales, en first)
Under `dashboard.admin.users.organizations` (the dialog): `title` ("Organizations for {name}"),
`currentHeading` ("Member of"), `noMemberships` ("Not a member of any organization yet."),
`addHeading` ("Add to organization"), `orgLabel` ("Organization"), `orgPlaceholder`
("Select an organization"), `roleLabel` ("Role"), `addCta` ("Add"), `removeCta`
("Remove"), `memberActions` ("Actions for {name}"), `close` ("Close"), `error`
("Something went wrong. Try again."). Reuse `accounts.role.{admin,editor}` for the
role option labels. Add a `users.organizationsCta` ("Organizations") for the row
menu item. No em dashes; sv/nb/da/fi are drafts.

### Tests
- Backend: `listOrganizationsForUser` returns a seeded membership's
  `{ orgId, name, role }` and `[]` for a user with none (mirror existing
  `listOrganizationMembers` test seeding).
- Frontend: the per-user dialog renders current memberships and calls
  `addMembership` with `{ authId, orgId, role }` on add (mock `useQuery`/`useMutation`);
  `manage-organization-dialog` no longer renders an add-member control.

## B. Auto-derive the slug from the name on org create

Typing the org name should fill the slug live (until the slug is hand-edited),
transliterating diacritics: "Kanonkula AB" → `kanonkula-ab`, "Känslosam AB" →
`kanslosam-ab`, "Mørk Æra" → `mork-aera`.

### Changes
- **`packages/constants/src/slug.ts`**: add and export `slugify(input: string): string`:

```ts
const TRANSLITERATE: Record<string, string> = {
  ø: "o", æ: "ae", œ: "oe", ß: "ss", ð: "d", þ: "th", ł: "l", đ: "d",
}

// Lowercase, transliterate the Nordic/Latin letters that do not decompose under
// NFD (ø, æ, ...), strip remaining combining marks (ä->a, ö->o, å->a, é->e),
// then collapse any run of non [a-z0-9] into a single hyphen and trim hyphens.
// Produces a string that satisfies SLUG_PATTERN (or "" for empty input).
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[øæœßðþłđ]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
```
Export it from `packages/constants/src/index.ts` alongside `SLUG_PATTERN`/`isValidSlug`.

- **`create-organization-dialog.tsx`**: track `slugEdited` (boolean, default false).
  Name `onChange`: `setName(v)` and, if `!slugEdited`, `setSlug(slugify(v))`. Slug
  `onChange`: `setSlug(v)` and `setSlugEdited(true)` (so manual edits stop the
  auto-fill). Reset `slugEdited` to false in `handleOpenChange` close. The Zod
  gate and submit are unchanged.

### Tests
- `packages/constants/src/slug.test.ts`: add `slugify` cases — `"Kanonkula AB"`
  → `"kanonkula-ab"`, `"Känslosam AB"` → `"kanslosam-ab"`, `"Mørk Æra"` →
  `"mork-aera"`, `"  Hej!! "` → `"hej"`, `""` → `""`; and assert
  `SLUG_PATTERN.test(slugify(x))` for non-empty results.
- `create-organization-dialog` test: typing the name fills the slug; editing the
  slug then typing the name leaves the slug untouched.

## Out of scope
- No change to `addMembership`/`setMembershipRole`/`removeMembership` behavior.
- No change to the org dialog's members list or settings beyond removing "Add member".
- The slug remains editable; `slugify` only seeds it.
