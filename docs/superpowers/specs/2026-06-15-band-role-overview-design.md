# Design: Band and role Overview (Work › Overview)

Date: 2026-06-15
Status: Approved, ready for implementation planning

## Goal

Improve how the product visualizes the bands and which roles sit in each band.
Today this lives on a standalone "Results" page whose `BandOverview` shows only a
neutral bar chart of role counts per band. It never shows which roles are in
which band, which is exactly the information users want.

This design removes the "Results" navigation item, introduces a collapsible
"Work" section in the sidebar, and gives it an "Overview" subitem that hosts a
new band and role visualization with two views: a band ladder (default) and a
band by track matrix (toggle).

## Locked decisions

These were settled during brainstorming and are not open:

1. Navigation option A: rename today's home "Overview" to "Home", add a
   collapsible "Work" parent, place "Overview" (the band view) and "Roles" under
   it, keep "Model" top level, remove "Results".
2. Primary visualization: vertical band ladder, Band 1 on top.
3. Band by track matrix is built now as a toggle on the same page, not deferred.
4. Anchor roles appear inline in the ladder and matrix (a marker on the chip, a
   deviation flag when the computed band differs from the agreed band). No
   separate anchor panel.
5. The ladder and matrix replace the old flat results table. The plain role
   register stays under Work › Roles where it already lives.

## Navigation

Sidebar after the change:

- Home, route `/`, today's stat-card dashboard, relabeled only.
- Work, collapsible parent, trigger only (no route of its own).
  - Overview, route `/work`, the new band visualization.
  - Roles, route `/roles`, unchanged.
- Model, route `/model`, unchanged.
- Results is removed.

Implementation notes:

- Build with the existing shadcn primitives already vendored in
  `packages/ui/src/components/sidebar.tsx` (`SidebarMenuSub`,
  `SidebarMenuSubItem`, `SidebarMenuSubButton`) plus `Collapsible`.
- "Work" shows active state whenever a child route is active, and the group
  auto-expands on those routes. Reuse the prefix-match logic in `nav-main.tsx`.
- The nav item definitions live in `app-sidebar.tsx`. Convert the flat array to
  support an optional `items` (children) field, or add a dedicated collapsible
  group. Keep the change minimal and follow the existing rendering pattern.
- Update `site-header.tsx`: the `BreadcrumbLabels` type and `buildBreadcrumbs`
  drop `results`, add the `work` / overview crumb, and reflect the home rename.
- The home page CTA currently labeled "View results" (key `overview.goResults`)
  repoints to `/work` and is relabeled to point at the Overview.

## The Overview page (`/work`)

A single page with a header toolbar and two switchable views.

### Header toolbar

- Title "Overview".
- A `HelpMorphButton` next to the title explaining band and weighting (reuse the
  existing `dashboard.help` band and weighting copy).
- A family filter dropdown. It scopes both views to roles in the chosen family,
  or all families. Mirror the filter already on the current Results page.
- A "Ladder | Matrix" segmented toggle using shadcn `Tabs` (line variant). The
  toggle and the family filter both scope the data shown.

### Ladder view (default)

- One lane per band, Band 1 on top, descending to the lowest band.
- Left rail per band: band number, the weighting range for that band (for
  example 98 to 100, derived from `bandThresholds`), the role count, and a
  subtle neutral weight bar that encodes band height (higher band, darker ink).
- Roles wrap as chips inside their band lane, ordered by weighting descending
  (the order `getResults` already returns).
- Empty bands are shown muted with a "No roles in this band" note, so the full
  band structure is always visible.

### Matrix view (toggle)

- Bands down the side (Band 1 on top), tracks across the top (IC, Lead, M).
- Each role sits in the cell where its band meets its track.
- Empty cells are shown faint. Cells with several roles stack them vertically.
- The same family filter and inline anchor treatment apply.

### Role chip

- Shows the role title, a track tag, and the weighting.
- Click navigates to the role detail page (`/roles/[roleId]`).
- Anchor roles carry a small anchor marker.
- When an anchor role's computed band differs from its agreed band, a deviation
  flag (`≠ Band n agreed`) sits on the chip. This flag is the only colored
  accent on the page (destructive), because it is an alert to act on, not a
  judgement of the role.

### Not yet evaluated zone

- A zone at the bottom of the page lists roles that have no band because their
  assessment is incomplete (band is null).
- Each is a dashed chip showing rating progress (for example "3/9 rated").
- Click navigates to the rating flow for that role.

### Empty and loading states

- When the org has zero roles, reuse the `Empty` component with a "Create a
  role" call to action, matching the current Results page behavior.
- Show a spinner while the query is loading.

## Data layer

- Reuse the existing `getResults` query
  (`packages/backend/convex/assessment/results.ts`). It already returns rows
  sorted by band then weighting, with track and family names, and the `bands`
  threshold list. Score and band stay derived at read time per ADR-0002.
- One backend change: include a per-row `anchor` field shaped as
  `{ expectedBand: number, status: "active" | "underReview" } | null`, read from
  the role's `anchorRole` aggregate and excluding `replaced` anchors. This lets
  the chip render the anchor marker and the deviation flag without a second
  query, and lets this page stop using `listAnchorRoles`.
- Add a test in `results.test.ts` covering the new `anchor` field, including an
  anchor whose computed band deviates from the agreed band.
- Band weighting ranges are computed by a pure helper from the `bands` list.
  Extend `apps/dashboard/lib/results.ts` or add `apps/dashboard/lib/bands.ts`.
  Band 1's top is 100. Each lower band's top is one below the next higher band's
  `minScore`.

## Color, animation, help, i18n

- Color: band and role data stay neutral ink. Never use the brand rose on data.
  The deviation flag is the single intentional colored accent (destructive).
- Animation: chips animate to their new band lane or cell when ratings or the
  model change, since `getResults` is reactive through Convex. Use
  `AnimatePresence` plus `layout` and the shared `SPRING`. Follow the rules in
  `docs/ui-animation.md`, which must be read before implementing. Reduced motion
  is respected globally through the existing `MotionConfig`.
- Help: reuse `dashboard.help` keys for band, weighting, anchor role, and track.
  Add one help key explaining why a role has no band yet (the not yet evaluated
  concept). Every domain term on the page gets an inline `HelpMorphButton`, with
  at most one help popover per heading or row.
- i18n: add a `dashboard.bands.*` namespace for the page (heading, rail labels,
  matrix track headers, pending zone copy, toggle labels, inline anchor labels).
  Update the nav keys: add `nav.home` and `nav.work`, keep a child `nav.overview`
  for the band view, and remove `nav.results`. Add every key to `en.json` first,
  then mirror to sv, nb, da, and fi. Non-English additions are machine drafts and
  are flagged for native review. The parity test in `packages/i18n` must stay
  green.

## Teardown (no legacy before launch)

Remove completely in the same change:

- The `/results` route and its page.
- `apps/dashboard/components/results/band-overview.tsx`.
- `apps/dashboard/components/results/anchor-roles-panel.tsx`.
- The results table on the old Results page.
- Now unused `dashboard.results.*` keys across all five locale files.

## Component structure

New surface folder `apps/dashboard/components/bands/`, with small, single
purpose components:

- `BandLadder` renders the band lanes.
- `BandMatrix` renders the band by track grid.
- `BandViewToggle` switches between ladder and matrix.
- `RoleChip` renders a single role, including the anchor marker and deviation
  flag.
- `PendingRoles` renders the not yet evaluated zone.

Pure helpers live in `apps/dashboard/lib/`. A hook never imports from a surface
folder.

## Testing

- Backend: extend `results.test.ts` for the new `anchor` field and the deviation
  case.
- Frontend pure helpers (band range computation, any grouping for the matrix)
  ship with unit tests in the same commit.
- i18n parity test stays green after the key changes.

## Out of scope

- Drag to reband. Band is derived and never set by hand (ADR-0002, ADR-0004), so
  the view is read only placement.
- Level (individual seniority within a track). Level is V2 and person data, not
  role data (ADR-0005).
- Any change to band count or thresholds. Bands stay the fixed configurable set
  the model already defines.
