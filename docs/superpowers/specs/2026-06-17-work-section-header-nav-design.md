# Work section navigation: header tabs + demoted breadcrumb

Date: 2026-06-17

## Problem

The sidebar groups the "role world" under a **Work** submenu (Overview `/work`,
Roles `/roles`). The sidebar defaults to the collapsed icon rail, so that
submenu only ever appears as a flyout, which is awkward. We want the sub-nav in
the header instead, and the header breadcrumb currently competes with it for the
single header row.

## Decision

Move the Work sub-navigation into the header as **section tabs**, and demote the
breadcrumb to a slim sub-row that appears only when there is a deeper trail
(a role, a family, the rate flow). Top-level pages then show just the tabs; deep
pages keep their trail and up-navigation.

## Design

### Sidebar (`app-sidebar.tsx`, `nav-main.tsx`)

- Three flat leaf items, no submenu: **Home** (`/`), **Work** (`/work`),
  **Model** (`/model`).
- **Work** stays highlighted on any `/work` or `/roles` path (it owns both
  sub-pages). `NavItem` gains an optional `match?: string[]` of extra active
  path-prefixes; Work sets `match: ["/roles"]`.
- `nav-main` drops the group machinery (Collapsible submenu, icon-rail
  DropdownMenu flyout, chevron, the related sidebar/dropdown imports and
  `useSidebar`) because no group remains. Only the leaf rendering, the rail
  classes, and `isActive` (exact-or-sub-path, plus `match`) stay. This is a
  deletion, per no-legacy-before-launch.

### Header (`site-header.tsx`)

The header becomes two stacked pieces, both rendered by `SiteHeader`:

1. **Top bar** (`<header>`, the existing fixed `--header-height` row): the
   sidebar trigger + the **section identity**:
   - Work section (`/work`, `/roles…`): the section tabs (see below).
   - Home / Model: a plain section title (`nav.home` / `nav.model`).
2. **Breadcrumb sub-row** (`<nav>` below the top bar, full-width, `border-b`,
   header padding, muted/smaller text): rendered **only when the breadcrumb has
   more than one crumb** (i.e. deep pages). On top-level pages it does not
   render at all.

`buildBreadcrumbs` is **unchanged**: it already returns one crumb for top-level
pages and a multi-crumb trail (`Roles › RoleName`, `Roles › RoleName › Rate`,
`Roles › FamilyName`) for deep pages. The dynamic-name queries (role, family)
stay in `SiteHeader` exactly as today.

### Section tabs (`components/section-tabs.tsx`, new)

- Two real `<Link>` tabs: **Overview** (`/work`) and **Roles** (`/roles`),
  active by path (`/work` → Overview; `/roles…` → Roles).
- Underline tab style: active tab is `text-foreground`, inactive is
  `text-muted-foreground`. A Motion sliding underline (`layoutId`,
  `SPRING` from `lib/motion`) moves between tabs; reduced motion is respected
  globally via the app's `MotionConfig`.
- Keyboard-accessible (native links). Decorative-only elements `aria-hidden`.
- Returns nothing for non-Work sections (the header decides what to render).

### i18n

Reuse `dashboard.nav.overview`, `dashboard.nav.roles`, `dashboard.nav.work`,
`dashboard.nav.home`, `dashboard.nav.model`. **No new keys.**

### Tests

- `nav-main.test.tsx`: drop the submenu/flyout cases; keep leaf rendering and
  add "Work is active on a `/roles` path" (the `match` behavior).
- `section-tabs.test.tsx` (new): both tabs render with correct hrefs; the right
  tab is active for `/work` vs `/roles/abc`; renders nothing outside the Work
  section.
- `site-header.test.tsx`: `buildBreadcrumbs` cases unchanged. Add component-level
  checks: top-level page shows the section tabs and no breadcrumb sub-row; a deep
  role page shows the trail sub-row.

## Non-goals

- No change to `buildBreadcrumbs` logic or the role/family name resolution.
- No new back-nav on deep pages (the demoted breadcrumb still provides it).
- No change to the in-page ladder/matrix view tabs on Overview (they remain the
  page's own content; the section tabs sit a level above them in the header).
- Home and Model gain no sub-pages.
