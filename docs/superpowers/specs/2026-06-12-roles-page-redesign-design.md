# Roles page redesign: grouped data table with search and filters

Date: 2026-06-12
Status: approved (design), pending implementation

## Goal

Rebuild the role register at `/roles` as ONE table organized by role family,
with free-text search and status/track filters, built on the shadcn data
table recipe (`@tanstack/react-table`) so future tables in the app share the
same engine and patterns.

## Current state

`apps/dashboard/app/(app)/roles/page.tsx` renders one shadcn `Table` PER
family (repeated column headers), no search, no filters. Grouping comes from
`lib/role-groups.ts` (`groupByFamily`). Data: `assessment.roles.listRoles`
returns the whole register (SMB scale, client-side work is fine);
`evaluationModel.model.getModel` provides the tracks.

## Decisions (settled with Christian)

1. **One table with group header rows** (option A). A single column header;
   each family contributes a group row (family name linking to
   `/roles/families/[familyId]`, role count, subtle `bg-muted/50`), followed
   by its role rows. The "no family" group renders last. Groups stay during
   search/filter; families with zero matches disappear.
2. **Filters: status + track** as Selects with an "all" option each. Family
   and team are deliberately not filters (family is the visible grouping;
   team is covered by search).
3. **Search matches title + team + function**, case-insensitive substring.
4. **Improvements**: whole row clickable (hover highlight; the title stays a
   real `Link` as the accessible path), result counter ("8 of 24 roles",
   shown only while any filter/search is active), zero-match empty state
   with a "clear filters" action. **No sorting** (conflicts with grouping,
   YAGNI at register size), no pagination, no URL state.
5. **Engine: `@tanstack/react-table`** (new dashboard dependency), per the
   shadcn data table recipe, for consistency with future tables:
   - `getCoreRowModel` + `getFilteredRowModel` + `getGroupedRowModel` +
     `getExpandedRowModel`; the pipeline filters BEFORE grouping, so empty
     groups vanish automatically.
   - `grouping: ["family"]` on a hidden family column
     (`groupedColumnMode: "remove"`); the group row reads the family
     name/id from its first leaf row's original for the link.
   - `initialState: { expanded: true }` keeps all groups open.
   - Search via `globalFilter` with a custom, exported, pure
     `globalFilterFn`; the Selects drive `column.setFilterValue`.
   - Counter reads `table.getFilteredRowModel().rows.length` (leaf rows)
     against `data.length`; clear = `resetGlobalFilter()` +
     `resetColumnFilters()`.

## Architecture

- `apps/dashboard/components/roles/roles-table.tsx`: toolbar (search Input
  with icon, status Select, track Select, counter) + the table. Props:
  `roles` (listRoles rows), `tracks` (model tracks). No queries of its own.
  Row click navigates via `useRouter().push`; family order is presorted
  (locale-aware name order, "no family" last) before the data enters the
  table.
- Column definitions live in `roles-table.tsx` (single consumer, per the
  file-placement convention): `ColumnDef[]` for title, track, team, status,
  rated, plus the hidden family grouping column. The pure search matcher is
  a named export for unit tests.
- `apps/dashboard/app/(app)/roles/page.tsx` stays thin: queries, loading
  gate, header row with `CreateRoleDialog`, zero-roles `Empty`, and
  `<RolesTable roles tracks />`.
- `lib/role-groups.ts` stays (the family detail page also uses it); the
  roles page stops importing it.

## i18n

New keys `dashboard.roles.toolbar.*` in all five locales: searchPlaceholder,
statusAll, trackAll, resultCount ("{shown} of {total} roles"), noMatches,
clearFilters. nb/da/fi are machine drafts flagged for native review.

## Empty states

- Zero roles in the org: existing `Empty` (unchanged).
- Active search/filter with zero matches: `Empty` with `noMatches` copy and
  a clearFilters button.

## Testing

- Pure unit test for the exported global filter matcher (title, team,
  function, case-insensitivity, no-match).
- Component test for `RolesTable` (props in, no convex mocks): group header
  rows render with counts and family links; searching hides non-matching
  families entirely; status/track Selects filter (driven via the hidden
  native select pattern if needed); the counter appears only with active
  filters; clear filters restores all rows; zero-match state shows the
  button.

## Out of scope

Sorting, pagination, URL-synced filter state, migrating the results page to
the same recipe (a follow-up candidate), and any backend change.
