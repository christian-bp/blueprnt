# Organization dossier

Source pages fed: organization-settings, members-and-roles, invitations.

## Behavior today

**Organization = tenant, one per legal entity.** Every customer is a Better Auth "organization" (the tenant); all app data is scoped to `orgId`. A user can belong to several organizations and switches between them; there is no in-app org-tree/department structure (`docs/contexts/accounts/CONTEXT.md`, ADR-0007).

**Active-organization switcher lives at the top of the sidebar.** `apps/dashboard/components/nav-organization.tsx` (`NavOrganization`) renders a `SidebarMenuButton` showing the active org's logo (from `getOrganizationSettings`) or initials, and a dropdown listing every org from `authClient.useListOrganizations()` with a check on the active one (`authClient.useActiveOrganization()`). Clicking a non-active org calls `authClient.organization.setActive({ organizationId })`; there is no "reload" (`apps/dashboard/components/app-sidebar.tsx` mounts it in `<SidebarHeader>`). A second, avatar-menu variant (`apps/dashboard/components/org-switch-menu.tsx`, `OrgSwitchMenuSub`) renders only when the user belongs to 2+ orgs and only inside the auth/onboarding shell's account menu (`account-menu.tsx`), letting a user stuck in one org's onboarding switch to an already-onboarded one. Neither switcher offers create/join; both are switch-only (spec `2026-06-17-org-switcher-design.md`, confirmed unchanged in code).

**No self-service org creation beyond the first one.** Only the very first organization is created in-app, during onboarding's name step (`authClient.organization.create`). Every additional organization and membership is provisioned out-of-band by a platform admin (ADR-0007 addendum 2026-07-10; ADR-0009).

**`/organization` is the admin settings surface**, reached from the sidebar's "Administration" group (`app-sidebar.tsx`: `navAdmin` array, pushed only `if (role === "admin")`, pointing at `/organization` with sub-pages `general` and `members`). `apps/dashboard/app/(app)/organization/layout.tsx` is the authoritative-in-UI guard: a non-admin `role` sees `t("notAuthorized")` instead of children (backend re-checks regardless, see Rationale). `/organization/page.tsx` redirects to `/organization/general`.

- **General tab** (`organization/general/page.tsx`): renders `OrganizationLogoSection` (logo upload) and `OrganizationProfileForm` (`components/organization/organization-profile-form.tsx`) once `getOrganizationSettings` resolves. The form edits **name, country, currency, default language, industry**; name persists via `updateOrganizationName`, the other four via `updateOrganizationSettings`, called independently and only when that slice actually changed (`if (values.name !== name) ...`, `settingsChanged` check) so an unchanged save fires no mutation. `mode: "onTouched"`, gated on `isValid && isDirty` (react-hook-form + Zod, per convention).
- **Members tab** (`organization/members/page.tsx`): `PageHeader` with an `InviteMemberDialog` action, and `OrganizationMembersSection` below rendering one roster table of active members plus pending invitations (distinguished by a "Pending" badge). Members come from the reactive `api.accounts.organization.listOrgMembers` query; invitations come from `authClient.organization.listInvitations`, refetched via a `refreshKey`/nonce bumped on a new invite.
- Row actions (`organization-members-section.tsx`): a member's `...` dropdown offers **change role** (admin<->editor, via `updateMemberRole`) and **remove** (via `removeMember`, `AlertDialog` confirm); a pending invitation's `...` dropdown offers **Revoke** (via `authClient.organization.cancelInvitation`). Both member actions are `disabled` when the target `isSoleAdmin` (role === "admin" && the org has exactly one admin), and a footnote (`soleAdminNote`) explains why when `adminCount === 1`.

**Invite flow**: `InviteMemberDialog` (`components/organization/invite-member-dialog.tsx`) is a standard shadcn dialog (email input + role Select, default "editor") calling `authClient.organization.inviteMember({ email, role, organizationId })` directly on the Better Auth client; the submit is disabled until the RHF+Zod form (`makeInviteSchema`) is valid. A successful invite fires Better Auth's `sendInvitationEmail` (existing plumbing) and the `invitation.created` audit trigger; the dialog's `onInvited` callback bumps the members page's refresh nonce.

**Org logo**: uploaded/removed via a shared image-upload primitive (`use-image-upload.ts` + `avatar-upload.tsx`), backed by `setOrgAvatar`/`removeOrgAvatar`; the logo is stored on the `organizations.imageId` field (`accounts/tables.ts`) and is org-domain content, not person PII.

**Platform admin (`/admin`)**: a separate, org-independent operator surface (`apps/dashboard/app/(app)/admin/*`), reachable from the avatar menu (`nav-user.tsx`, item shown only `isPlatformAdmin === true`, linking to `/admin`). It has its own tab bar (`admin-tabs.tsx`: Users/Organizations tabs plus `audit-log`, `email-log`, `ai-usage` pages) and lets an operator create users, create organizations, connect a user to an org with a role, change a membership role, remove a membership, edit an org's settings, and hard-delete a user (GDPR erasure). This is a **documented exception** to org-scoping (see Rationale), gated by the `isPlatformAdmin` boolean, never an org role.

**Platform admin's create-user flow requires an organization and role atomically.** The admin `createUser` mutation always provisions the new user's first membership in the same call (org + role picked in the create-user dialog); there is no path to create a user without one (plan `2026-06-23-create-user-invite-and-org.md`). A newly created user with no password yet receives a "welcome" (set-password) email rather than a password-reset email, chosen by branching on `hasPassword`/`userHasPassword`; both templates send from a named, replyable sender (`blueprnt <hello@blueprnt.se>`) instead of a generic address.

**Admin AI usage page** (`/admin/ai-usage`, `apps/dashboard/app/(app)/admin/ai-usage/page.tsx`): KPI tiles, a ranked-bar chart per organization (cost, calls, tokens; outlier bars flagged in amber when cost exceeds 3x the median or an absolute floor), and a per-org sortable table, backed by `platform/aiUsage.ts` `usageByOrg({ period })` (`platformQuery`, no PII, org-level aggregates only).

## Terms and history

- **Organization** (code: `Organization`) = the tenant, a single customer/company/legal entity. Avoid: Workspace (renamed away from 2026-06-05), Account, Company, Tenant, Org (as a standalone label). User-facing copy still uses "Company / Företag" for this same concept (the org switcher's i18n uses `orgSwitcher.label` = "Company"), while the code-level canonical term stays `organization` (`docs/contexts/accounts/CONTEXT.md`; org-switcher spec).
- **Member** (code: `Member`) = a user's membership *within* an organization, carrying that user's role there. Avoid conflating with "User" (the global identity, org-independent).
- **Admin** = a member who can configure evaluation models, weights, level thresholds, and manage members. Avoid: Owner, Manager (Chef).
- **Editor** = a member who can register roles and enter ratings, but not change model configuration. Avoid: Bedömare (assessor) - a separate concept that in an HR-only tool is usually the same person as Editor; they are distinguished only if a review/calibration step needs it (flagged open question in the glossary).
- **Platform admin** (`isPlatformAdmin`) is not an org role at all: a cross-tenant operator flag on the app-side `users` mirror, entirely separate from `admin`/`editor`. Never confuse "org admin" with "platform admin" - the former manages one tenant's model/members, the latter provisions tenants themselves (ADR-0009).
- This section is unaffected by the ADR-0014 terminology rename (Level/Seniority/Step); those terms belong to the model/roles domain, not organization.
- **FLAGGED naming collision to avoid in future docs** (`docs/contexts/accounts/CONTEXT.md`): a future V2 org structure (departments, units, reporting lines) must never be called bare "organisation" since that would collide with the tenant term; call it "organisationsstruktur" / "org-tree" instead. There is no such structure in the app today.

## Rationale

- **Organization-per-legal-entity, with a switch-only picker, chosen over a shared multi-entity tenant** (ADR-0007): simplest, requires no new dimension in the data model, and matches how "equal work"/pay-mapping comparisons are scoped (within one employer, never across a group). The deliberate trade-off: no shared job architecture and no built-in group rollup across a customer's organizations; a future group/rollup layer can reference existing organizations additively later.
- **Only the first organization is created in-app; the rest are back-office** (ADR-0007 addendum, 2026-07-10): a self-service create/join flow was explicitly not built, because provisioning is intended to stay with blueprnt operators, not customers.
- **`employeeCount` is derived, never manually entered** (ADR-0007 addendum): `internal.people.employeeCount.setEmployeeCountFromPeople` is the sole writer, called from the import flow; the manual argument on `updateOrganizationSettings` was removed so the number that gates EU pay-transparency thresholds (100/150/250 employees) cannot be overwritten by hand.
- **Platform admin is a deliberate, narrow exception to "every Convex function is org-scoped"** (ADR-0009): the app is strictly multi-tenant via `resolveOrgContext`, and there was no way to create an organization or connect a user to one from outside that model. `platformQuery`/`platformMutation` (`lib/functions.ts`) take **no `orgId` argument at all** - the absence of that argument is the structural guard separating them from `orgQuery`/`adminMutation`. `requirePlatformAdmin` is the sole authorization source; the frontend gate (hiding the admin link, showing a not-authorized page) is cosmetic only.
- **`isPlatformAdmin` can only be set out-of-band** (ADR-0009, spec `2026-06-18-platform-admin-page-design.md`): via `internal.platform.bootstrap.grantPlatformAdminByEmail`/`revokePlatformAdminByEmail` (Convex CLI/dashboard) or the dev/pre-launch seed. No client-callable or org-scoped mutation may ever write this field; `onUserUpdate` only patches `{name, email}` from Better Auth profile updates, so the flag survives them untouched.
- **A separate `platformAuditLog`, never mixed into a tenant's own `auditLog`** (ADR-0009): operator cross-tenant actions must not appear in a customer's own event trail. Org-affecting platform actions (org create, member add/role/remove, settings update) additionally write the ordinary org-scoped audit event, now attributed to the real platform-admin actor instead of the `"system"` sentinel used by triggers.
- **The last-admin guard exists because removing/demoting the sole admin would leave an organization admin-less** with no path back in from inside the app: `updateMemberRole`/`removeMember` (`accounts/organization.ts`) check `isSoleAdmin` before mutating and throw `ERROR_CODES.lastAdmin`; the UI disables those actions preemptively and shows an inline footnote.
- **Member/invitation audit payloads never carry name or email** (ADR-0013 boundary maintained here; `2026-06-19-audit-before-after.md`): only ids, roles, and status/expiry are captured, specifically so a person's erasure never needs to scrub these rows. `organization.created` is a deliberate id-only marker row (no founder name), because the substantive before/after lands in the following `organization.settingsUpdated` row.
- **Org name and org settings (country/currency/language/industry) are two separate mutations** (`updateOrganizationName` vs `updateOrganizationSettings`), each firing its own audit event, so the profile form only calls the one whose slice actually changed rather than always writing both.
- **Delete-organization was deliberately left out of V1** (`2026-06-27-organization-settings-design.md`): `disableOrganizationDeletion: true` is the posture; tenant deletion is out-of-band support work only, so the settings surface has no danger zone.

## Edge cases and error states

- **Non-admin visits `/organization` directly.** `organization/layout.tsx` checks `role !== "admin"` and renders `t("notAuthorized")` in place of the page; this is UI-only, the backend (`adminMutation`/`adminQuery`) is the real gate and independently throws `errors.adminRequired` ("Only organization admins can do this.") if reached anyway.
- **Non-member calls an org-scoped function with a given `orgId`.** `resolveOrgContext` throws `errors.notAMember` ("You are not a member of this organization.") when the membership lookup returns null.
- **Not signed in at all.** `errors.notAuthenticated` ("You need to sign in.") from `resolveOrgContext`/`requireOrgAdminAction`.
- **Membership-lookup data conflict** (duplicate membership row, or any lookup failure, or an unrecognized role string outside admin/editor). `resolveOrgContext` fails closed with `errors.membershipConflict` ("membershipConflict" - no dedicated user-facing copy verified beyond the code, logged server-side with orgId/subject for ops). Also thrown from `ai/prefillData.ts` and `ai/suggest.ts` on the same membership-integrity check, and from `requireOrgAdminAction` (the action-context admin gate for `setOrgAvatar`).
- **Demoting or removing the organization's only admin.** `updateMemberRole` (target role -> editor) and `removeMember` both throw `errors.lastAdmin` when `isSoleAdmin(members, userId)` is true; the frontend disables the menu items for that member ahead of time and shows `soleAdminNote` under the table when `adminCount === 1`.
- **A non-platform-admin calls any `platformQuery`/`platformMutation`.** Throws `errors.platformAdminRequired` ("You do not have platform admin access."); the `isPlatformAdmin` convenience query never throws (returns `false`) so the avatar-menu link and page guard can check it without an error boundary.
- **Self-deleting a platform-admin account via `/admin`'s `deleteUser`.** Blocked with `errors.invalidInput` when `authId === ctx.authUserId` (an operator cannot erase their own account from the platform surface); self-erasure of one's own account exists as a separate, unblocked self-service path (`eraseSelf`, outside this section's scope) with its own last-admin check across all the user's organizations.
- **Cross-org listings are capped.** `listAllUsers`/`listAllOrganizations`/`listMembers` (`betterAuth/provisioning.ts`) use `.take(500)`; pagination for platform lists beyond that is not built (documented V1 limitation, ADR-0009).
- **Invite errors surface generically.** `InviteMemberDialog` and `OrganizationMembersSection` show a local inline `error` message (`t("error")` / `ti("error")`, e.g. "Something went wrong") on any Better Auth `inviteMember`/`listInvitations`/`cancelInvitation` error object, with no per-code mapping in the UI (the Better Auth org client returns `{ data, error }`, not the app's own `errors.*` codes).
- **A platform admin visits `/admin` without being a member of any onboarded organization.** `/admin` is rendered inside the ordinary `(app)` layout and gated by `OnboardingGate`, so a platform admin must also be a member of at least one onboarded organization to reach it; there is no dedicated org-less operator entry path in V1 (ADR-0009 V1 limitations).
- **Switching to a not-yet-onboarded organization** via either switcher: `getOnboardingStatus` returns `completed: false` for that org, and the existing onboarding gate routes the user into that org's onboarding wizard instead of the dashboard.
- **A user's `activeOrganizationId` refers to an org they were removed from.** `resolveActiveOrgId(activeId, orgs)` (`apps/dashboard/lib/active-org.ts`) is the client-side scoping fallback used throughout the app shell: if `activeId` is not among the caller's current memberships, it resolves to the first membership in the list (or `null` if there are none) for that render, but this does not persist anything server-side; Better Auth's own `session.activeOrganizationId` is left unchanged. Persisting a new active org via `authClient.organization.setActive()` happens only in one place, `OnboardingGate` (`apps/dashboard/components/onboarding/onboarding-gate.tsx`), and only when `active.data == null` after the active-organization query has settled (i.e. no active org is set at all, not specifically "set to a removed org") and at least one membership exists; that effect writes the first membership in the list as the new active org.

## Deliberately absent

- **In-app organization creation or join beyond the first org.** Explicitly out of scope for the switcher build; provisioning additional organizations/memberships is back-office only (ADR-0007 addendum; `2026-06-17-org-switcher-design.md` "Out of scope").
- **Delete organization / danger zone on `/organization`.** `disableOrganizationDeletion: true` is the deliberate V1 posture; tenant deletion is support-only, out-of-band (`2026-06-27-organization-settings-design.md`).
- **A separate org activity log on the settings surface.** The org audit log at `/audit-log` is linked from the General tab rather than duplicated there.
- **Editor read-only views of `/organization`.** The product decision is admins-only; editors never see the surface at all, so there is no read-only or disabled rendering to build.
- **Multi-org shared job architecture / group rollup.** Each organization keeps its own evaluation model; no cross-org rollup view exists, and none is required by the EU pay-transparency directive's per-employer reporting scope (ADR-0007).
- **In-app granting or revoking of the platform-admin flag.** Strictly out-of-band (Convex CLI/dashboard internal mutation, or the dev/pre-launch seed); no UI for this exists or is planned for V1 (ADR-0009).
- **Soft-deactivation of users or memberships.** Every removal/deletion in this domain is a true, hard action (membership row deleted; user erasure is a GDPR hard delete), never a disabled/deactivated flag.
- **Scrubbing of email strings embedded in historical audit payloads.** Documented as unnecessary today because the shipped invitation events (`invitation.created/accepted/revoked`) carry ids/codes only, never the invitee's email (ADR-0009's original V1 limitation about this was resolved once the invitation flow shipped e-mail-free).
- **Pagination of the platform admin's cross-org user/org lists** beyond the current 500-row `.take()` cap (ADR-0009 V1 limitation).
- **A dedicated entry point for an organization-less platform-admin operator.** `/admin` requires membership in an onboarded organization like any other app route in V1 (ADR-0009).

## Sources read

- `docs/contexts/accounts/CONTEXT.md`
- `docs/adr/0001-convex-eu-better-auth.md`
- `docs/adr/0007-legal-entity-reporting-dimension.md`
- `docs/adr/0009-platform-admin.md`
- `docs/superpowers/specs/2026-06-17-org-switcher-design.md`
- `docs/superpowers/specs/2026-06-27-organization-settings-design.md`
- `docs/superpowers/specs/2026-06-23-admin-membership-and-slug-design.md`
- `docs/superpowers/specs/2026-06-23-create-user-invite-and-org-design.md`
- `docs/superpowers/specs/2026-06-18-platform-admin-page-design.md`
- `docs/superpowers/specs/2026-06-19-audit-before-after.md`
- `docs/superpowers/specs/2026-06-20-admin-audit-log-parity.md`
- `docs/superpowers/plans/2026-08-13-admin-ai-usage.md`
- `docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md` (Fas 1 foundation design: original "organization = workspace" terminology, Admin/Editor access control, org-scoping wrapper design, `member` index restore, `workspaceProfiles` predecessor of today's org settings; superseded in current code by ADR-0007/0009 and the specs above, but the workspace-era terminology note corroborates the "Avoid: Workspace" guidance in Terms and history)
- `docs/superpowers/specs/2026-06-21-email-template-branding-design.md` (read, nothing new for this section: redesigns the invitation/verify/reset email templates' visual branding only, no change to invite behavior, send pipeline, or organization data model)
- `docs/superpowers/plans/2026-06-04-convex-backend-better-auth.md` (implementation plan for the design above; superseded by shipped code, read for the same historical corroboration, nothing additional beyond the design doc)
- `docs/superpowers/plans/2026-06-17-org-switcher.md` (implementation plan for the org-switcher spec; confirms switch-only with no create/invite affordance, and the stale-active-org fallback split between backend and the `resolveActiveOrgId` helper, matching current code)
- `docs/superpowers/plans/2026-06-18-platform-admin-page.md` (implementation plan for the platform-admin spec; confirms the 500-row `.take()` cap on cross-org user/organization/member listings as a deliberate V1 bound, pagination deferred post-V1)
- `docs/superpowers/plans/2026-06-21-email-template-branding.md` (read, nothing new for this section: implementation plan for the email branding redesign, same scope as its design doc)
- `docs/superpowers/plans/2026-06-23-create-user-invite-and-org.md` (platform admin's `createUser` requires an organization + role, provisioned atomically in one mutation; new users without a password get a "welcome" set-password email instead of a reset email; transactional mail sends from the named sender `blueprnt <hello@blueprnt.se>`)
- `docs/superpowers/plans/2026-06-27-organization-settings.md` (implementation plan for the organization-settings spec; confirms `employeeCount` as a nullable derived field on the settings schema, matching the "derived, never manually entered" rationale already documented)
- `apps/dashboard/app/(app)/organization/layout.tsx`
- `apps/dashboard/app/(app)/organization/page.tsx`
- `apps/dashboard/app/(app)/organization/general/page.tsx`
- `apps/dashboard/app/(app)/organization/members/page.tsx`
- `apps/dashboard/components/organization/organization-members-section.tsx`
- `apps/dashboard/components/organization/organization-profile-form.tsx`
- `apps/dashboard/components/organization/invite-member-dialog.tsx`
- `apps/dashboard/components/nav-organization.tsx`
- `apps/dashboard/components/org-switch-menu.tsx`
- `apps/dashboard/components/account-menu.tsx`
- `apps/dashboard/components/nav-user.tsx`
- `apps/dashboard/components/app-sidebar.tsx`
- `apps/dashboard/components/admin/admin-tabs.tsx`
- `apps/dashboard/components/admin/manage-organization-dialog.tsx`
- `apps/dashboard/app/(app)/admin/ai-usage/page.tsx`
- `packages/backend/convex/accounts/tables.ts`
- `packages/backend/convex/accounts/organization.ts`
- `packages/backend/convex/accounts/mirrors.ts`
- `packages/backend/convex/lib/functions.ts`
- `packages/backend/convex/lib/audit.ts`
- `packages/backend/convex/lib/errors.ts`
- `packages/backend/convex/auth.ts`
- `packages/backend/convex/platform/admin.ts`
- `packages/backend/convex/platform/bootstrap.ts`
- `packages/i18n/messages/en.json` (errors namespace)
- `.superpowers/sdd/00-overview/section-pages.md`
