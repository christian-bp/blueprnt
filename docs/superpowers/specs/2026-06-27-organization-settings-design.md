# Organization settings — design

Date: 2026-06-27
Status: approved (design); pending implementation plan
Related: `2026-06-27-account-settings-design.md` (the per-user mirror surface this parallels), `2026-06-17-org-switcher-design.md`, `2026-06-23-admin-membership-and-slug-design.md`, `2026-06-18-platform-admin-page-design.md`

## Overview

A user-facing **organization settings** surface at `/organization`, parallel to the existing `/account` surface, where an organization **admin** manages the org profile (name, logo, currency, country, industry, default language) and the team (member roster, role changes, removals, email invitations, pending-invitation management).

The surface is **admin-only**: editors never see it. The Better Auth backend already carries ~80% of what is needed (the `organizations` mirror table and its admin-only `updateOrganizationSettings`, the full member/invitation provisioning layer, member/invitation audit triggers, the last-admin guard pattern, `sendInvitationEmail`, the `organizationClient` on the auth client, and the `/accept-invitation/[id]` route). This work is therefore frontend-heavy plus a small set of backend gaps (org logo, org-name editing, member role/remove mutations) and a **DRY refactor of the file/avatar machinery** so the user avatar and the new org logo share one implementation.

## Goals

- Admins can edit the full org profile: **name, logo, currency, country, industry, default language**.
- Admins can manage the team: **see the roster, change a member's role (admin ⇄ editor), remove a member, invite by email with a role, and revoke pending invitations**.
- The destructive team actions are protected by a **last-admin guard** (cannot remove or demote the only remaining admin).
- A **single, typed, DRY** file-upload implementation serves both the user avatar and the org logo (frontend and backend).
- Everything works in all five locales and writes audit rows where the change is org-domain content.

## Non-goals (V1)

- **Delete organization.** `disableOrganizationDeletion: true` is the deliberate V1 posture (tenant deletion is out-of-band support only). No danger zone on this surface.
- **Editor read-only views.** The product decision is admins-only; editors do not see the surface, so there are no disabled/read-only states to build.
- **A separate org activity log.** The org audit log already lives at `/audit-log` (member-facing, `org-audit-log-section.tsx`). The General tab links to it rather than duplicating it.
- **Multi-org management.** V1 is one org per user; the surface acts on the user's current org.

## Surface & navigation

Mirror `/account` exactly:

- Routes under `apps/dashboard/app/(app)/organization/`:
  - `layout.tsx` — `max-w-2xl` left-aligned wrapper (same as `account/layout.tsx`); **server-side admin guard** (redirect non-admins away).
  - `page.tsx` — redirects to `/organization/general`.
  - `general/page.tsx` — profile + settings sections.
  - `members/page.tsx` — team sections.
- Header tabs: a new `components/organization/organization-tabs.tsx` mirroring `components/account/account-tabs.tsx` (the `layoutId` motion underline), rendered by `components/site-header.tsx` when `section === "organization"`. Tabs: **General**, **Members**.
- Entry point: an **admin-only** "Organization" link in `components/org-switch-menu.tsx` (the org is its natural home). The link is hidden from editors; the layout guard is the authoritative gate (the menu is only UI).

## General tab

`general/page.tsx` renders, in `organization/` section components:

1. **Logo section** (`organization-logo-section.tsx`) — org avatar with the shared upload control (see "DRY file architecture"); fallback is the org initials.
2. **Profile/settings form** (`organization-profile-form.tsx`):
   - **Name** — text input.
   - **Country** — `CountrySelect` (existing). Changing country offers the derived default currency/language exactly as onboarding does (`defaultCurrencyFor` from `packages/constants/src/countries.ts`).
   - **Currency** — `CurrencySelect` (existing; `CURRENCY_KEYS`).
   - **Default language** — language select (reuse the one the admin org dialog uses; add a small `LanguageSelect` if none is shared yet).
   - **Industry** — `IndustrySelect` (existing).
   - Pre-filled edit form: RHF + `zodResolver(makeOrganizationProfileSchema(t))`, `mode: "onTouched"`, gated on `isValid && isDirty` so an unchanged save cannot fire a no-op audit row.
   - Inline `HelpMorphButton` next to **currency** and **default language** (the two domain-flavored terms), `dashboard.help.*` keys.
   - A link to `/audit-log` ("View organization activity") at the bottom of the tab.

Name persists through the org-name path; settings (currency/country/language/industry) through `updateOrganizationSettings`; logo through its own upload control. (The form may save name + settings in one submit by calling both paths; exact wiring is a plan detail.)

## Members tab

`members/page.tsx` renders:

1. **Invite control** — a primary "Invite member" button (standalone, above the roster per the table-actions convention) opening a dialog: email input + role `Select` (admin/editor) → `authClient.organization.inviteMember`. Standard dialog anatomy (header, body, footer: cancel outline first, primary last).
2. **Roster** (`organization-members-section.tsx`) — each member row shows name, email, and a role badge. A trailing `...` `DropdownMenu` per row:
   - **Change role** (admin ⇄ editor) → `updateMemberRole` mutation.
   - **Remove** (`variant="destructive"`) → `AlertDialog` confirm → `removeMember` mutation.
   - When the target is the sole admin, both items are disabled with an inline explanation (and the backend re-checks; see guards).
3. **Pending invitations** (`organization-invitations-section.tsx`) — unaccepted invitations (email, role, expiry) from `authClient.organization.listInvitations`, each with a **Revoke** action → `authClient.organization.cancelInvitation`.

Layout shift is avoided per CLAUDE.md (reserved slots, overlay reveals); list add/remove animates via Motion `AnimatePresence` + `layout`.

## DRY file architecture (user avatar + org logo)

The current avatar code in `packages/backend/convex/accounts/account.ts` and `apps/dashboard/components/account/avatar-upload.tsx` is hardcoded to the `users` table. Extract the shared pieces while keeping the per-table binding **typed** (no stringly-typed table names — that would defeat the type system and violate the project's typed-by-default rule).

### Backend — new `packages/backend/convex/lib/files.ts`

- `IMAGE_UPLOAD_MAX_BYTES` — moved from `account.ts`'s `AVATAR_MAX_BYTES`.
- `isAllowedImageBlob(meta, maxBytes): boolean` — pure validation (non-null, size ≤ max, content-type empty or `image/*`).
- `blobMeta` — generic `internalQuery({ storageId }) → { size, contentType } | null`, reading `ctx.db.system.get(storageId)` (replaces the account-specific `avatarBlobMeta`).
- `generateImageUploadUrl` — one authed mutation returning `ctx.storage.generateUploadUrl()`, reused by both surfaces.
- `assertValidImageBlob(actionCtx, storageId, maxBytes)` — async helper for actions: reads `blobMeta`, validates; on invalid `ctx.storage.delete(storageId)` then throws `invalidInput`. (The validate-then-delete-rejected-blob shell, shared.)
- `replaceStoredImage(mutationCtx, { previousId, storageId }): Promise<string>` — deletes `previousId` if set, returns `getUrl(storageId)` (throws `notFound` if null). `clearStoredImage(mutationCtx, previousId)` — deletes if set. **The typed `ctx.db.patch` stays in each caller**, so `users.imageId` and `organizations.imageId` are patched type-safely.

### Backend — user side (refactor `accounts/account.ts`)

- `generateAvatarUploadUrl` → reuse `generateImageUploadUrl` (thin re-export or direct use).
- `setMyAvatar` (action) → `assertValidImageBlob(...)` then `runMutation(applyUserAvatar)`.
- `applyUserAvatar` (internalMutation) → fetch `users` row by `authId`; `const url = await replaceStoredImage(ctx, { previousId: row.imageId, storageId })`; `ctx.db.patch(row._id, { imageId: storageId })`; return url.
- `removeMyAvatar` → `clearStoredImage` + patch `imageId: undefined`.
- Behavior, validation limits, and the **no-audit / GDPR-erasure** semantics for the user avatar are unchanged (user avatar is PII, lives only on the `users` mirror, deleted on both erase paths, and writes no audit row).

### Backend — org side (`accounts/organization.ts`)

- `setOrgAvatar` (action) → resolve identity, **assert caller is admin of `orgId`** (a shared `assertOrgAdmin(actionCtx, orgId)` helper that mirrors `resolveOrgContext`'s role check for action ctx), `assertValidImageBlob(...)`, then `runMutation(applyOrgAvatar, { orgId, storageId, actorId })`.
- `applyOrgAvatar` (internalMutation) → fetch `organizations` row by `orgId`; `replaceStoredImage`; patch `imageId`; **write `organization.logoUpdated` audit** (org-domain content, so audited — unlike the user avatar). Also set the Better Auth org `logo` (via `updateOrganizationIdentity`) if anything reads it (org switcher); confirm during planning.
- `removeOrgAvatar` (adminMutation) → `clearStoredImage` + patch `imageId: undefined` + `organization.logoRemoved` audit.

### Frontend — shared upload

- `apps/dashboard/hooks/use-image-upload.ts` — headless hook: client-side validate (type + 5MB), object-URL preview, `generateImageUploadUrl` → POST blob → `setImage(storageId)` → optional mirror callback → revoke preview; exposes `{ onSelect, onRemove, isUploading, isRemoving, error }`.
- `apps/dashboard/components/avatar-upload.tsx` — presentational, moved to the components root (reusable primitive): clickable avatar + hidden file input + remove control + inline error, parameterized by `{ imageUrl, fallback, onSelect, onRemove, busy, error, labels }`.
- `account` and `organization` each provide a thin wrapper passing their own Convex bindings (`setMyAvatar`/`removeMyAvatar` + `authClient.updateUser` mirror for the user; `setOrgAvatar`/`removeOrgAvatar` for the org) and fallback initials.

## Backend gaps to build (summary)

- **Schema**: add `imageId: v.optional(v.id("_storage"))` to the `organizations` table (`accounts/tables.ts`). It is org-domain content, not PII, so it is not subject to person-erasure.
- **Org logo**: `setOrgAvatar`, `applyOrgAvatar`, `removeOrgAvatar` (above).
- **Org name**: an admin path (adminMutation) wrapping `provisioning.updateOrganizationIdentity(orgId, name)`, audited as `organization.nameUpdated`. (`updateOrganizationSettings` already covers currency/country/language/industry/employeeCount.)
- **Members**: `listOrgMembers` (adminQuery, wraps `provisioning.listMembers`); `updateMemberRole` and `removeMember` (adminMutations wrapping `provisioning.setMemberRole`/`removeMember`, with the last-admin guard). The existing member triggers (`onMemberUpdate`/`onMemberDelete`) already write `member.roleChanged` / `member.removed` audit rows, so these mutations do not log directly.
- **Invitations**: invite / list-pending / revoke go through `authClient.organization.inviteMember` / `listInvitations` / `cancelInvitation` from the client. Admin is enforced by the Better Auth access-control roles (editors lack the member/invitation statements); the email + `invitation.created` / `invitation.revoked` audit rows are already wired via `sendInvitationEmail` and the invitation triggers.

### New audit events

Add to `AUDIT_EVENTS` (`lib/audit.ts`) and the `AuditPayloads` discriminated union (`lib/auditPayloads.ts`), keeping the compile-time key-drift guards green:

- `organizationNameUpdated: "organization.nameUpdated"` — payload `{ changes: Changes }` over `["name"]`.
- `organizationLogoUpdated: "organization.logoUpdated"` — payload `{}` (or `{ removed: false }`).
- `organizationLogoRemoved: "organization.logoRemoved"` — payload `{}`.

All map to the `organization` category via the existing prefix matcher.

## Permissions & guards

- The surface is admin-only end to end: the `org-switch-menu` link is admin-gated (UI), and `organization/layout.tsx` server-checks admin and redirects editors (authoritative).
- New settings/member mutations use the existing `adminMutation` wrapper (`lib/functions.ts`): requires `role === "admin"`, injects `ctx.orgId` / `ctx.authUserId` / `ctx.audit`.
- `setOrgAvatar` is an **action** (so a rejected blob can be deleted outside a transaction without rollback), with a manual admin check via the new `assertOrgAdmin` action helper.
- **Last-admin guard**: `updateMemberRole` (demotion to editor) and `removeMember` reuse the `soleAdminOrgs` logic from `accounts/account.ts` (or extract it to a shared helper) and throw `ERROR_CODES.lastAdmin` when the target is the org's only admin. The frontend disables those actions for the sole admin and surfaces `lastAdmin` inline if it slips through.
- Invitations need no last-admin concern; admin is enforced by Better Auth's access control.

## i18n

- New keys under `organization.*` in `packages/i18n/messages/en.json` (source), mirrored to `sv`, `nb`, `da`, `fi`. Validation messages reuse `dashboard.validation.*`; help text under `dashboard.help.*`.
- Machine-translated Nordic strings are drafts: flag for native review in `docs/go-live-checklist.md`.

## Testing (same-commit)

- Backend (convex-test, edge-runtime):
  - `updateMemberRole` / `removeMember`: success, admin-required, and the **last-admin guard** (cannot demote/remove the sole admin).
  - `setOrgAvatar` validate/reject path (size cap; content-type rejection is e2e-only, as in the user-avatar tests) and the admin gate; `removeOrgAvatar`.
  - Org name update audit (`organization.nameUpdated`) and logo audit events.
  - `lib/files.ts` pure helpers (`isAllowedImageBlob`).
- Component tests: profile form (valid/dirty gating, save), members dropdown (role change, remove confirm, sole-admin disabling), invite dialog, pending-invitations revoke.
- i18n parity test stays green (all locales mirror `en`).

## File-by-file change list (anticipated)

New:
- `apps/dashboard/app/(app)/organization/{layout,page}.tsx`, `organization/general/page.tsx`, `organization/members/page.tsx`
- `apps/dashboard/components/organization/{organization-tabs,organization-logo-section,organization-profile-form,organization-members-section,organization-invitations-section,invite-member-dialog}.tsx`
- `apps/dashboard/components/avatar-upload.tsx` (moved from `components/account/`, generalized) + `apps/dashboard/hooks/use-image-upload.ts`
- `packages/backend/convex/lib/files.ts`
- i18n: `organization.*` keys in all five message files
- Tests alongside each of the above

Changed:
- `apps/dashboard/components/site-header.tsx` (register `OrganizationTabs` for `section === "organization"`)
- `apps/dashboard/components/org-switch-menu.tsx` (admin-only "Organization" link)
- `apps/dashboard/components/account/*` avatar wrapper (consume the shared component/hook)
- `packages/backend/convex/accounts/account.ts` (refactor avatar functions onto `lib/files.ts`)
- `packages/backend/convex/accounts/organization.ts` (org logo + org-name mutations, member mutations)
- `packages/backend/convex/accounts/tables.ts` (`organizations.imageId`)
- `packages/backend/convex/lib/audit.ts` + `lib/auditPayloads.ts` (new events)

## Open questions

None blocking. Two confirm-during-planning details: (a) whether to mirror the org logo URL into the Better Auth org `logo` field (do any consumers read it — e.g. the org switcher?); (b) whether a shared `LanguageSelect` already exists or one should be added for the default-language field.
