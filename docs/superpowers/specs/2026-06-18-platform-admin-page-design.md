# Platform Admin page: design

Date: 2026-06-18
Status: approved for planning
Worktree: `feat/admin-platform`

## 1. Goal

Give a blueprnt operator (platform administrator) a single secure page to provision tenants and accounts across the whole installation:

- create users,
- create organizations,
- connect a user to an organization with a role,
- change a membership role,
- remove a user from an organization,
- edit an organization's settings,
- delete (erase) a user,
- list and browse all users and all organizations.

The page is reachable from the avatar menu and is visible and usable only to platform admins. Security is the primary constraint: the feature deliberately crosses tenant boundaries, which no existing code path does.

## 2. Why this needs new infrastructure

The codebase is strictly multi-tenant. Every client-callable Convex function runs through `resolveOrgContext` (`packages/backend/convex/lib/functions.ts`) and requires a valid `(orgId, userId)` membership row. The only roles that exist are org-local `admin` and `editor`. There is no platform/super/cross-org administrator, no admin allowlist, and no admin-gating env var. The only cross-org reads (`ai/usage`) are `internalQuery` and never client-callable.

Therefore a platform admin needs a brand-new authorization path that resolves from the JWT subject alone, independent of any org membership, plus functions that deliberately operate across org boundaries. This is a documented exception to the "every Convex function is org-scoped" invariant and ships with a new ADR.

## 3. Decisions (resolved)

1. **Platform-admin identity:** a boolean `isPlatformAdmin` column on the existing `users` mirror. No new table.
2. **Granting the flag is out-of-band only:** set by an `internalMutation` (run from the Convex CLI/dashboard by an operator with backend access) and by the dev seed for the demo user. No client-callable mutation ever writes this field. The page does not grant or revoke platform-admin.
3. **V1 capability scope:** all of the operations listed in section 1, including set-membership-role, remove-from-org, edit-org-settings, and delete-user.
4. **New-user access:** email invitation. The admin creates the account and the user sets their own password through an emailed link (built on the existing password-reset plumbing, not the stubbed accept-invitation flow).
5. **Delete is a GDPR erasure (hard delete):** never a soft "deactivated" flag.

## 4. Security model

- **Field:** add `isPlatformAdmin: v.optional(v.boolean())` to `users` (`packages/backend/convex/accounts/tables.ts`). Absent or `false` means not a platform admin.
- **Single source of truth:** a helper `requirePlatformAdmin(ctx)` resolves `ctx.auth.getUserIdentity()`, reads the `users` mirror by `authId` (`by_auth_id` index), and throws `appError(ERROR_CODES.platformAdminRequired)` unless the flag is `true`. It returns `{ authUserId }`. It never takes an `orgId`.
- **Builders:** add `platformQuery` and `platformMutation` to `lib/functions.ts`, modeled on the existing `orgQuery`/`orgMutation` but taking **no `orgId` arg** and calling `requirePlatformAdmin`. The absence of the `orgId` arg is the structural guard against confusing them with the org-scoped builders.
- **Write guardrail for the flag:** `onUserUpdate` (`accounts/mirrors.ts`) already patches only `{name, email}`, so the flag survives Better Auth profile updates. Nothing else writes it except the out-of-band bootstrap path. This is an invariant: no org-scoped or self-service mutation may write `isPlatformAdmin`.
- **Frontend gating is cosmetic.** Hiding the avatar-menu link and rendering a not-authorized page are UX only. The `platformMutation`/`platformQuery` guard is the only real boundary.
- **New error code:** `ERROR_CODES.platformAdminRequired` -> `"errors.platformAdminRequired"` (`lib/errors.ts`).

### Bootstrap

- Dev: the seed (`packages/backend/convex/seed.ts`) sets `isPlatformAdmin: true` on the demo user `hej@blueprnt.se` so the page is reachable locally.
- Prod: a new `internalMutation` `internal.platform.bootstrap.grantPlatformAdminByEmail({ email })` looks up the `users` mirror by email and sets the flag. It is `internalMutation`, so it is only runnable by an operator with backend access (Convex CLI/dashboard). This is the deliberate out-of-band channel. A symmetric `revokePlatformAdminByEmail` is provided.

## 5. Provisioning approach (backend)

Platform mutations perform **direct Better Auth component-table inserts**, the proven pattern already used by the dev seed (`packages/backend/convex/betterAuth/seed.ts`), wrapped in `platformMutation`. They do **not** call Better Auth's org-permission API (`auth.api.addMember`, `auth.api.createOrganization`, etc.), because those enforce that the actor is an admin of the target org, and a platform admin is intentionally not an org member.

New component module `packages/backend/convex/betterAuth/provisioning.ts` holds production-grade siblings of the seed mutations (the seed module stays dev-only). New app context `packages/backend/convex/platform/` holds the client-facing platform functions.

Because direct component inserts bypass the Better Auth triggers (confirmed: the seed must call the mirror functions explicitly), the platform mutations call the mirror/audit helpers themselves and pass the real platform-admin actor id, replacing the `"system"` placeholder noted in `accounts/mirrors.ts:259-261`.

### Functions (app side, `convex/platform/`)

Queries (`platformQuery`):
- `isPlatformAdmin` -> boolean for the current caller (used by the menu and the page guard; returns false rather than throwing, so non-admins simply see no link).
- `listUsers` -> all users (id, name, email, createdAt, membership count).
- `listOrganizations` -> all orgs (id, name, slug, member count, onboarding state).
- `getOrganizationDetail({ orgId })` -> org settings plus its members (user, role).

Mutations (`platformMutation`):
- `createUser({ name, email })` -> inserts BA `user` (`emailVerified: true`) and a `credential` `account` with a non-hash sentinel password, plus the `users` mirror row. Returns the new auth id. Idempotent by email.
- `createOrganization({ name, slug })` -> inserts BA `organization` (unique slug) and the app `organizations` row. Optional `firstMember: { authId, role }`.
- `addMembership({ authId, orgId, role })` -> inserts a `member` row, idempotent on `(org, user)`.
- `setMembershipRole({ authId, orgId, role })` -> patches the `member` row role.
- `removeMembership({ authId, orgId })` -> deletes the `member` row.
- `updateOrganization({ orgId, name?, slug?, country?, currency?, language?, industry? })` -> patches BA `organization` (name/slug) and the app `organizations` row (settings).
- `deleteUser({ authId })` -> GDPR erasure (section 7).

Note: `createUser` is a plain mutation, not an action, because the sentinel-password approach avoids hashing at create time. The set-password email is triggered separately (section 6).

## 6. New-user password flow

1. Admin submits name + email. `createUser` provisions the account with a sentinel password (login impossible until set) and `emailVerified: true`.
2. The client then calls Better Auth's password-reset request (`authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`). This fires the configured `sendResetPassword` handler (`auth.ts:105`), which enqueues the existing `resetPassword` email template through the outbox.
3. The new user opens the emailed link to a new public page `/reset-password`, sets a password (`authClient.resetPassword({ newPassword, token })`), and is redirected to sign in.
4. A "resend invite" row action re-triggers step 2.

The `/reset-password` page is a net-new public route (sibling of `accept-invitation`, outside the auth gates). It also gives the app a real password-set/reset capability, which it lacks today.

**Verification required before coding:** confirm against the installed Better Auth version that (a) the client method is `requestPasswordReset` (vs `forgetPassword`), and (b) `resetPassword` works on a directly-provisioned credential account. If reset does not operate on such an account, fall back to triggering the token server-side. Membership connection is authoritative (admin attaches directly); it does not use the invitation-accept flow.

## 7. GDPR erasure (`deleteUser`)

Deleting a user is a true erasure, not a flag:

1. Remove every identity row: BA `user`, its `credential` `account`, all `session` rows, every `member` row across all orgs, and the app `users` mirror.
2. Anonymize residual PII in append-only logs instead of destroying the trail: for `auditLog` and `platformAuditLog` rows authored by the deleted user, replace the `actorName` snapshot with a tombstone (the orphaned auth id). The rows are kept for the audit trail's legitimate-interest basis. This needs a new `by_actor` index on `auditLog` (and on `platformAuditLog`) so the rows can be found without a full scan.
3. The erasure is itself audited (`platform.userDeleted`) without re-introducing the erased PII: the record stores the orphaned auth id, the acting admin, and a timestamp, never the deleted person's name or email.
4. Self-delete is blocked. The UI requires a type-to-confirm step.

Referential safety: roles and ratings never reference persons (Role != Person), and audit rows snapshot a name rather than joining live, so erasure does not break history or domain data.

**Documented V1 limitation:** a few audit payloads (today only the not-yet-shipped invitation events) embed an email string with no index to find it. V1 erasure covers identity rows plus `actorName` anonymization; payload-email scrubbing is a follow-up to handle when the invitation flow ships. This limitation is recorded in the ADR.

## 8. Audit

- New table `platformAuditLog` (org-free): `actorId`, `actorName`, `type`, `targetUserId` (optional), `targetOrgId` (optional), `payload`. Indexes: `by_actor` (for erasure anonymization) and a time-ordered default. Every platform action writes one row: the operator activity trail.
- New `logPlatformAudit(ctx, entry)` helper alongside `logAudit`.
- Org-affecting actions (org create, member add/role/remove, settings update) also write the existing org-scoped `auditLog` event, now attributed to the real platform admin actor id rather than `"system"`. This keeps each tenant's local audit trail intact.
- New `AUDIT_EVENTS` keys: `platform.userCreated`, `platform.userDeleted`, `platform.orgCreated`. Existing org events (`organization.created`, `member.added`, `member.roleChanged`, `member.removed`, `organization.settingsUpdated`) are reused for the org-scoped rows.

## 9. Frontend

### Routing and shell

- New route group `app/(admin)/` with its own `layout.tsx`:
  - Reuses the `AuthLoading` / `Unauthenticated` (sign-in) / `Authenticated` gate from `(app)/layout.tsx` (a small, explicit duplication), but does **not** wrap children in `OnboardingGate`. This is required because `OnboardingGate` renders `null` for a user with zero org memberships (`onboarding-gate.tsx:57`), which would blank the page for an org-less operator.
  - Inside `Authenticated`, a guard component calls the `isPlatformAdmin` query: false renders a not-authorized view; true renders a minimal, org-independent `AdminShell` plus the page.
- `AdminShell` is a lightweight chrome (no org switcher, no org-scoped nav) that still mounts the avatar menu (`NavUser` uses `authClient.useSession()`, so it works without an org). The route is `/admin` (route groups do not affect the URL).

### Avatar menu

- In `components/nav-user.tsx`, insert `<DropdownMenuItem asChild><Link href="/admin">{t("nav.admin")}</Link></DropdownMenuItem>` before the separator that precedes sign-out (around line 104), rendered only when the `isPlatformAdmin` query returns true.

### Page UI

- Two sections, Users and Organizations, each a `@tanstack/react-table` list following `components/roles/roles-table.tsx`.
- Create dialogs and row-action dialogs follow the standard shadcn dialog anatomy (header, body, footer with cancel-outline-then-primary), per the conventions and the `roles/create-role-dialog.tsx` pattern.
- Row actions: connect to org (pick org + role), change role, remove from org, edit org settings, delete user (type-to-confirm), resend invite.
- Inline guidance (`HelpMorphButton`) explains platform-admin scope and the erasure semantics, per the "guide the user" rule.
- Client validation with Zod in `apps/dashboard/lib/admin-schemas.ts` (create-user, create-org, connect, edit-org-settings); the backend re-validates independently.
- Layout-shift and animation rules apply (reserve slots, animate genuine enter/leave, respect reduced motion). Read `docs/ui-animation.md` before any animation.

### New public page

- `app/reset-password/page.tsx`: reads the token from the query, shows a new-password form, calls `authClient.resetPassword`, redirects to `/`.

## 10. i18n

New keys added to `packages/i18n/messages/en.json` first, then mirrored to `sv`, `nb`, `da`, `fi` in the same commit (parity test guards this):

- `dashboard.nav.admin`
- the `dashboard.admin.*` tree (headings, table columns, dialog labels, confirmations, help text)
- `dashboard.auth` / reset-password strings for the new page
- `errors.platformAdminRequired`

Non-`en` strings are machine-translated drafts flagged for native review. JSON is edited directly (no shell perl/sed, which double-encodes non-ASCII).

## 11. Testing

`convex-test` (Vitest 4, edge-runtime) for the platform functions, in `packages/backend/convex/platform/*.test.ts`:

- a non-platform-admin caller is rejected by every `platformMutation`/`platformQuery`;
- a platform admin can create a user, create an org, and connect them, across orgs;
- `createUser` and `addMembership` are idempotent;
- audit rows are written (both `platformAuditLog` and the org-scoped `auditLog` with the real actor);
- `deleteUser` removes all identity rows, anonymizes `actorName` in audit rows, and is blocked for self-delete.

i18n parity is auto-covered by `packages/i18n` tests. New code ships with tests in the same commit (pre-commit hook runs the full suite).

## 12. ADR

A new ADR (in `docs/adr/`, written in Swedish per the language rule) documents the platform-admin authorization carve-out: the new `isPlatformAdmin` flag and out-of-band granting, the `platformQuery`/`platformMutation` builders that bypass org-scoping, the GDPR erasure semantics (hard delete plus audit anonymization), and the documented payload-email follow-up.

## 13. File touchpoints

Backend (`packages/backend/convex`):
- `accounts/tables.ts`: add `isPlatformAdmin` to `users`.
- `lib/functions.ts`: `requirePlatformAdmin`, `platformQuery`, `platformMutation`.
- `lib/errors.ts`: `platformAdminRequired`.
- `lib/audit.ts`: new `AUDIT_EVENTS` keys; `logPlatformAudit`.
- `shared/tables.ts`: `platformAuditLog` table; `by_actor` index on `auditLog`.
- `betterAuth/provisioning.ts` (new): production component mutations (user, org, member) and listing queries.
- `platform/admin.ts` (new): the `platformQuery`/`platformMutation` functions.
- `platform/bootstrap.ts` (new): `grantPlatformAdminByEmail` / `revokePlatformAdminByEmail` internal mutations.
- `seed.ts`: set `isPlatformAdmin` on the demo user.
- `accounts/mirrors.ts`: allow real-actor attribution for member/org events triggered by platform mutations.
- `platform/*.test.ts` (new).

Frontend (`apps/dashboard`):
- `app/(admin)/layout.tsx` (new), `app/(admin)/admin/page.tsx` (new).
- `app/reset-password/page.tsx` (new).
- `components/admin/*` (new): shell, tables, dialogs.
- `components/nav-user.tsx`: conditional admin link.
- `lib/admin-schemas.ts` (new): Zod schemas.

i18n (`packages/i18n/messages`): `en`, `sv`, `nb`, `da`, `fi`.

ADR: `docs/adr/`.

## 14. Out of scope (V1)

- In-app granting/revoking of the platform-admin flag (out-of-band only).
- Soft-deactivate of users (we hard-delete).
- Scrubbing email strings embedded in audit payloads (follow-up when invitations ship).
- Editing user identity (name/email) from the admin page beyond creation, unless trivially added.
- A general "forgot password" entry point on the sign-in screen (the `/reset-password` page exists; wiring a sign-in link is optional polish).

## 15. Process

All work lands in the `feat/admin-platform` worktree and is squashed to `main` as one commit including the ADR. The CLAUDE.md erasure-invariant edit rides along in this worktree.
