# Organisation switcher: switch-only company picker in the sidebar

Date: 2026-06-17

## Problem

A user can now belong to more than one company (ADR-0007: each company / legal
entity is its own Better Auth organisation; a user is a member of several and
switches between them). Nothing in the app surfaces that today: `getOnboardingStatus`
takes `memberships[0]`, the org-context is built from that one membership, and the
top of the sidebar is empty. Companies and memberships are provisioned by a future
back-office admin interface, not by users, so the user-facing piece is purely a
**switch** between the companies they already belong to.

## Decision

Add a switch-only company switcher at the top of the dashboard sidebar, mirroring
the Polyform team switcher minus its create/add action. The active company is
Better Auth's `session.activeOrganizationId`; switching re-scopes the whole app
reactively through the existing explicit-`orgId` query path, with no page reload.

Out of scope, by decision: creating companies, inviting or managing members, and
the back-office admin interface that will provision them. This build only switches
between existing memberships.

## Design

### Active company is Better Auth's active organisation

blueprnt already passes `orgId` into every Convex call (`orgQuery`/`adminMutation`
in `lib/functions.ts`), sourced from `useOrganization()`. So "switch company" means
"change the `orgId` the app uses". We make Better Auth the single source of truth:

- Active company = `session.activeOrganizationId`, set with
  `authClient.organization.setActive({ organizationId })`.
- The client reads it with the organisation-client hooks `useActiveOrganization()`
  (active) and `useListOrganizations()` (the user's companies, with name + logo).
- The org-context derives its `orgId` from `useActiveOrganization()`. Clicking a
  company calls `setActive()`; the hook re-emits, the context updates, and every
  `orgQuery` re-runs reactively with the new `orgId`. No reload.

(`authClient` already registers `organizationClient` in `lib/auth-client.ts`;
Better Auth is 1.6.17. Confirm the exact hook names during planning and adapt if
1.6.17 exposes them under slightly different names.)

### Backend (`packages/backend/convex/accounts/onboarding.ts`)

- `getOnboardingStatus` becomes active-company-aware: it takes the active `orgId`
  and returns that company's onboarding flags (`settingsComplete`, `hasModel`,
  `hasRoles`, `completed`) and the caller's `role` in it, instead of hardcoding
  `memberships[0]`. It validates that the caller is a member of that `orgId`
  (reuse the membership lookup already used by `resolveOrgContext`), returning the
  no-org shape when they are not.
- No new "list companies" query: `useListOrganizations()` already returns the
  user's companies. `listMembershipsForUser`'s existing `take(20)` guard already
  tolerates multiple memberships; no change there.
- Org-scoping, audit, and `resolveOrgContext` are unchanged. The active company is
  a client concern threaded through `orgId`; the backend keeps validating membership
  per call exactly as today.

### Switcher component (`apps/dashboard/components/nav-organization.tsx`, new)

- Mirrors `nav-user.tsx`: a `SidebarMenuButton` (size `lg`) inside a `DropdownMenu`,
  with the same collapsed-rail classes (`group-data-[collapsible=icon]:…`) so it
  collapses to an avatar-only button on the icon rail.
- Trigger shows the active company's avatar (logo, else `getInitials` fallback as
  in `nav-user`), its name, and a caret. No plan label (blueprnt has no plans).
- Dropdown content: a section label, then the user's companies from
  `useListOrganizations()`, each with avatar + name and a check on the active one
  (`useActiveOrganization()`); clicking a non-active company calls `setActive()`.
  **No "Add company" item, no create, no separator-action.**
- Single company: the trigger still renders the company identity (it fills the
  currently empty header); the dropdown lists that one company, checked, with no
  switch target.

### Sidebar (`apps/dashboard/components/app-sidebar.tsx`)

- Add a `<SidebarHeader>` (already exported by `@workspace/ui/components/sidebar`,
  currently unused) at the top containing `<NavOrganization />`. `SidebarContent`
  (`NavMain`) and `SidebarFooter` (`NavUser`) are unchanged.

### Org context + onboarding gate (`org-context.tsx`, `onboarding/onboarding-gate.tsx`)

- The bootstrap derives the active company client-side:
  1. `useListOrganizations()` for the companies. While loading, the existing
     loader shows. Empty list keeps the existing no-org/empty state (rare:
     signup is disabled and companies are provisioned).
  2. `useActiveOrganization()` for the active one. If unset, default to the first
     company and call `setActive()` so `activeOrganizationId` is always populated.
  3. Call `getOnboardingStatus({ orgId })` with that active `orgId` for the gate's
     onboarding flags and role.
- `useOrganization()` keeps its current shape `{ orgId, name, role }` so existing
  consumers do not change: `orgId` and `name` come from the active company,
  `role` from `getOnboardingStatus`.
- Stale `activeOrganizationId` (caller removed from that company): fall back to the
  first valid membership and re-persist with `setActive()`.
- Switching to a not-yet-onboarded company: `getOnboardingStatus` returns
  `completed: false`, so the existing gate routes into that company's onboarding.
  Provisioned companies are expected pre-set-up, so this is an edge path, but the
  behaviour stays correct.

### i18n

New keys under `dashboard.orgSwitcher.*`, added to `en.json` first then mirrored
to `sv`, `nb`, `da`, `fi` (nb/da/fi machine-draft, flagged for native review):

- `dashboard.orgSwitcher.sectionLabel` — dropdown header. User-facing term is
  **Företag / Company** (the canonical code/domain term stays `organization`; the
  label speaks the user's word, matching ADR-0007's company = legal entity).
- `dashboard.orgSwitcher.trigger` — aria-label for the trigger, e.g.
  "Byt företag" / "Switch company".

### Tests

- Backend (`onboarding.test.ts`, convex-test): `getOnboardingStatus({ orgId })`
  returns the requested company's flags and role; a user with two memberships gets
  the correct per-company flags; a non-member `orgId` returns the no-org shape.
- Frontend (`nav-organization.test.tsx`, new, mirroring `nav-user` test setup with
  the org hooks mocked): renders the companies, checks the active one, calls
  `setActive` on a non-active click, and shows no create/add item; single-company
  case renders the identity and one checked item with no switch target.
- Dev seed (`packages/backend`): add one user with two company memberships so the
  switcher is exercisable manually.

## Non-goals

- No company creation, no invite flow, no member-management UI (provisioned by the
  future back-office admin interface).
- No change to onboarding's first-company creation path in this build.
- No change to `orgQuery`/`adminMutation`/`resolveOrgContext` org-scoping or audit.
- No plan/billing label in the switcher.
- No URL- or cookie-based active company; Better Auth's session field is the store.
