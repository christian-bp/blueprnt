# Account Settings Implementation Design

**Goal:** Give every signed-in user a self-service `/account` area to edit their profile (name, email, display language), manage security (password, two-factor), and delete their account, all behind the existing app gates and following the project's form/i18n/audit conventions.

**Status:** Design approved 2026-06-27. Next step: implementation plan (writing-plans).

---

## Scope

**In V1:**
- Profile: edit display name; change login email (verified via the new mailbox); change display language.
- Security: change password; manage two-factor (change method, regenerate backup codes); delete account (danger zone).

**Out of V1 (non-goals):**
- Profile avatar/image upload.
- Disabling 2FA entirely (it is mandatory; only method change + code regeneration).
- Multiple enrolled 2FA methods per user (the model stays one `mfaMethod`).
- Active-session listing / per-session revoke (password change still revokes other sessions).
- Organization settings (those are a separate admin surface).
- Self-service organization deletion or admin-rights transfer UI (`disableOrganizationDeletion` stays true; the last-admin case routes to support).

---

## Resolved decisions

1. **Layout:** tabbed sections that are real sub-routes (`/account/profile`, `/account/security`), bookmarkable, with a tab bar.
2. **Route name:** `/account`.
3. **Email change:** the verification link is sent to the **new** email address; clicking it (proving control of the new mailbox) completes the switch. Gated by the current password.
4. **2FA controls:** change method + regenerate backup codes. No full disable.
5. **Last-admin delete guard:** if the user is the only `admin` of any organization, self-deletion is blocked and the UI shows a note to **contact support** for more information (no transfer UI in V1). Editors, and admins where another admin exists, delete freely.
6. **Audit/PII:** profile/email/password/2FA changes are per-person account state and write **no org audit rows** (same carve-out as the existing per-user 2FA state). Account deletion keeps the existing platform-audit log + `actorName` tombstone behavior.

---

## Architecture & routing

New route group under the authenticated layout (inherits `AuthGate` / `TwoFactorGate` / `OnboardingGate`):

```
apps/dashboard/app/(app)/account/
  layout.tsx          # page title + tab bar (links), renders children
  page.tsx            # redirect -> /account/profile
  profile/page.tsx    # Profile tab
  security/page.tsx   # Security tab
```

- Tab bar: `@workspace/i18n` `Link`s to the two sub-routes; active tab derived from `usePathname()`. No layout shift between tabs (fixed tab bar; content swaps below).
- `/account` redirects to `/account/profile` (server `redirect`).
- **Entry points:** add an "Account settings" item to `NavUser` (sidebar dropdown, above Sign out) and to the auth-shell `AccountMenu`, both using `@workspace/i18n` `Link`.

The pages are thin shells; each section is its own client component in `apps/dashboard/components/account/` (e.g. `profile-name-form.tsx`, `change-email-form.tsx`, `language-section.tsx`, `change-password-form.tsx`, `two-factor-section.tsx`, `delete-account-section.tsx`), so each is independently testable.

**Data:** a new `getMyAccount` query returns the per-user fields the page needs (`name`, `email`, `locale`, `mfaMethod`). Name/email also exist on the Better Auth session; the query is the single source for the page so the locale and method render server-consistently.

---

## Profile tab (`/account/profile`)

### Name
- Form: RHF + `zodResolver(makeProfileSchema(t))`, `mode: "onTouched"`, gated on `isValid && isDirty` (pre-filled edit form — must change before Save).
- Save: `authClient.updateUser({ name })`. The existing Better Auth -> `users` mirror trigger (`onUserUpdate`) keeps Convex in sync. No new backend.
- Validation messages under `dashboard.validation.*`.

### Email
- Shows the current email (read-only) and a "Change email" form: new email + current password (`makeChangeEmailSchema(t)`: valid email, not equal to current, password required).
- On submit: `authClient.changeEmail({ newEmail, callbackURL })`. Better Auth 1.6.17 runs a **double opt-in** for a verified user (our case): a confirmation link goes to the **current** mailbox first (approve the change); clicking it then sends a verification link to the **new** mailbox; clicking that finally applies the change and marks the new email verified. This satisfies "verify the new mailbox" and additionally makes the current mailbox approve, which is strictly more secure than a single-hop flow and is the supported, low-code path. (Decision 3 stands; the exact flow is BA's two-hop default.)
- UI: after submit, show a "We've emailed your current address to confirm, then your new address to verify" state. The current password is verified before the flow starts (see backend).
- Verification landing: a `callbackURL` page shows success ("Your email has been updated") and a generic invalid/expired state, mirroring the reset-password page. The link is clickable from any browser (the BA token is self-contained; an unrelated logged-in session is rejected).
- Email templates: enabling `user.changeEmail` in 1.6.17 also requires a top-level `emailVerification.sendVerificationEmail` sender. So we add **two** localized email flows: a `changeEmailConfirm` (sent to the current address, hop 1) and a `verifyEmail` (sent to the new address, hop 2), both via `enqueueEmail` with the user's locale. Authored in `en`, mirrored to all locales.

### Display language
- Surfaces the existing locale switcher on the page (reuses the `LanguageMenuSub` mechanism / `users.locale`), so users find language where they expect it. Selecting a language updates the stored locale and re-renders in that language.

---

## Security tab (`/account/security`)

### Change password
- Form: current password + new password + confirm (`makeChangePasswordSchema(t)`; confirm must match, mirrors the reset-password schema).
- Client-side HIBP pre-check via the existing `lib/pwned-password.ts` before calling Better Auth, so a breached new password is caught early.
- Submit: `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`. Wrong current password and breached password surface as inline errors **below** the submit button (matches the rest of auth).

### Two-factor
- Shows the current method ("Authenticator app" or "Email", from `getMyAccount.mfaMethod`) with inline help explaining 2FA.
- **Change method:** opens the existing `TwoFactorSetup` flow in a "re-enroll" mode (choose method -> password -> `enable({ password })` re-mints secret + backup codes -> verify the new method's code -> `confirmMfaSetup({ method })` updates `mfaMethod`). Reuses the component and its backup-code save/ack UI (`CopyButton`). Mandatory 2FA is never left off mid-change: `mfaConfirmedAt` is only re-stamped after the new method verifies.
- **Regenerate backup codes:** password-gated; mints fresh codes (without changing the TOTP secret), shown with the existing save/ack + `CopyButton` UI.

### Danger zone: delete account
- Destructive card: explains the consequence (permanent, irreversible erasure), a type-to-confirm gate (e.g. type the email), and the current password.
- **Last-admin guard:** if `getMyAccount` (or a dedicated check) reports the user is the only admin of any org, the delete control is replaced by a note: "You're the last administrator of {org name(s)}. To delete your account, please contact support." (support contact via existing channel). No password/confirm UI in that state.
- Otherwise, submit calls a new `deleteMyAccount` mutation (below); on success, sign out and redirect to `/`.

---

## Backend additions (`packages/backend/convex/accounts/`)

### `account.ts` (new)
- `getMyAccount` (query): returns `{ name, email, locale, mfaMethod }` for the current user from the `users` mirror (+ a `lastAdminOrgNames: string[]` field, or a sibling query, listing org names where the user is the sole admin, for the delete guard).
- `deleteMyAccount` (**action**, authed): an action (not a plain mutation) because the password is verified through Better Auth's server API.
  1. Re-auth check: verify the current password server-side via `createAuth(ctx).api.verifyPassword({ body: { password }, headers })` (BA's `/verify-password`; valid-session-gated). Mismatch -> error code shown inline.
  2. Then `ctx.runMutation` an internal erasure mutation that:
     - Last-admin guard: query `member` rows for `ctx.authUserId`; for each org where the user's role is `admin`, count other admins; if any org has zero other admins, throw `appError(ERROR_CODES.lastAdmin)` (new code) so the client can show the support note. (The UI also pre-checks via `getMyAccount`, but the mutation re-validates.)
     - Erase: reuse `components.betterAuth.provisioning.eraseUser({ userId: ctx.authUserId })` (member/account/session/invitation/user rows), schedule `internal.email.erasure.purgeRecipientEmails` for the returned email, delete the `users` mirror row, and anonymize `auditLog`/`platformAuditLog` `actorName` to the existing `ERASED_ACTOR_NAME` tombstone. This mirrors the existing platform `deleteUser`, minus the platform-admin gate and self-delete block.
     - Log a platform-audit erasure row (org count only, no PII).

### `twoFactor.ts` (extend)
- Backup-code regeneration is a pure client call (`authClient.twoFactor.generateBackupCodes({ password })` -> `{ status, backupCodes }`); no new backend needed.
- Re-enrollment ("change method") reuses `enable({ password })` (-> `{ totpURI, backupCodes }`, which **re-mints** the secret + codes and deletes the old row) -> verify the new method's code -> `confirmMfaSetup({ method })` (already updates `mfaMethod` + `mfaConfirmedAt`). See the re-enroll safety note in Risks.

### `auth.ts` (extend)
- Enable Better Auth `changeEmail` with `sendChangeEmailVerification` configured to `enqueueEmail` the verification link to the **new** address (template `changeEmail`, locale from the user's stored language).

### `auth-client.ts` (extend)
- Confirm `twoFactorClient()` exposes `disable` / `generateBackupCodes` (standard methods); use `generateBackupCodes({ password })` for regeneration. Add config only if the methods are not already available.

### Error codes / constants
- Add `lastAdmin` to `ERROR_CODES` and the frontend translation map.
- Add `changeEmail` to the email template keys + a React email template + i18n.

---

## Better Auth specifics (resolved from installed 1.6.17 source)

1. **changeEmail:** config is `user.changeEmail.enabled = true` + `sendChangeEmailConfirmation({ user, newEmail, url, token }, request)` (NOT `sendChangeEmailVerification`), and it additionally requires a top-level `emailVerification.sendVerificationEmail` sender or the call throws "Verification email isn't enabled". For a verified user it's the two-hop double opt-in described in the Email section (current mailbox confirms -> new mailbox verifies -> applied). Client: `authClient.changeEmail({ newEmail, callbackURL? })`. Tokens are self-contained signed JWTs; the link works in any browser (a mismatched logged-in session is rejected). If `newEmail` already belongs to another user, BA silently no-ops (no enumeration leak).
2. **Password re-auth:** Better Auth exposes `/verify-password` (`auth.api.verifyPassword({ body: { password }, headers })`), valid-session gated (not fresh-session). Call it from a Convex action, then run the erasure mutation. (Sensitive ops in BA use `sensitiveSessionMiddleware` = valid session only; freshness is not auto-enforced, so we gate explicitly on the password.)
3. **2FA client methods:** `authClient.twoFactor.enable({ password }) -> { totpURI, backupCodes }`, `disable({ password }) -> { status }`, `generateBackupCodes({ password }) -> { status, backupCodes }` all exist. `enable` is destructive: every call rotates the secret and backup codes and deletes the prior row, and (with `skipVerificationOnEnable`) flips `twoFactorEnabled`/`verified` immediately. We never call `disable` (2FA mandatory); we use `enable` for re-enroll and `generateBackupCodes` for regeneration.

---

## Cross-cutting conventions

- **Forms:** every data-entry form uses RHF + `zodResolver(makeXSchema(t))` + shadcn `Form` components + `SubmitButton`; pre-filled forms gate on `isValid && isDirty`; sensitive actions (email, password, 2FA, delete) require the current password; errors render below the submit button. Backend re-validates independently with `appError` codes.
- **i18n:** new `dashboard.account.*` namespace (tab labels, section titles, field labels, help, confirmations, the support note) plus needed `dashboard.validation.*` additions, authored in `en.json` first and mirrored to sv/nb/da/fi (parity test guards it). New Nordic strings flagged for native review in the go-live checklist. The `changeEmail` email template copy is localized in all five locales.
- **Guidance:** each domain concept gets inline help (`HelpMorphButton` + `dashboard.help.*`): why we email a verification link to the new address, what backup codes are, what "last administrator" means. One help popover per row.
- **Layout shift:** reveal inline confirmations/spinners in pre-reserved slots; the tab bar stays put; new content extends below. Reuse `AsyncActionButton`/`SubmitButton` patterns.
- **Animation:** legitimate enters/leaves (e.g. backup-code panel, confirmation states) animate with Motion, respecting reduced motion (read `docs/ui-animation.md` before adding any).
- **Optional cleanup folded in:** while touching `AccountMenu`, migrate its `onboarding.accountMenu` i18n key to the `dashboard.*` namespace (noted in CLAUDE.md as desired), since we are adding the settings link there anyway.

---

## Testing

New code ships with tests in the same commit:
- **Components:** each section/form (name, change-email, language, change-password, two-factor, delete-account) gets a component test covering the happy path, validation gating, the password gate, and error states. The delete section tests both the normal state and the last-admin "contact support" state.
- **Backend (convex-test):** `deleteMyAccount` — full cascade (member/account/session/invitation/user/mirror removed, audit `actorName` tombstoned, email purge scheduled) and the last-admin guard (blocked when sole admin, allowed otherwise). `getMyAccount` shape. `changeEmail` wiring (verification email enqueued to the new address).
- **i18n:** parity test stays green (all new keys in all locales).
- Full `turbo run test` passes in the pre-commit hook.

---

## File structure summary

**Create:**
- `apps/dashboard/app/(app)/account/{layout,page}.tsx`, `account/profile/page.tsx`, `account/security/page.tsx`, and the email-change verification callback page.
- `apps/dashboard/components/account/*` section components (+ their tests).
- `apps/dashboard/lib/account-schemas.ts` (the `makeXSchema(t)` factories).
- `packages/backend/convex/accounts/account.ts` (`getMyAccount`, `deleteMyAccount`) + tests.
- A `changeEmail` React email template under the email package + i18n.

**Modify:**
- `packages/backend/convex/auth.ts` (changeEmail config), `accounts/twoFactor.ts` (backup-code regen), `auth-client.ts` (if needed), `ERROR_CODES`, email template keys.
- `components/nav-user.tsx` and `components/account-menu.tsx` (settings link; account-menu i18n key migration).
- i18n message files (all five locales).
- `docs/go-live-checklist.md` (native-review flags for new Nordic strings).

---

## Risks / notes

- The email-change flow is the one genuinely new subsystem (BA `changeEmail` + `emailVerification.sendVerificationEmail` config + two email templates + callback landing page). Build it as its own task with backend wiring verified before the UI.
- **2FA re-enroll footgun:** `enable({ password })` immediately rotates the secret and invalidates the old authenticator/backup codes, and `skipVerificationOnEnable` flips `twoFactorEnabled` at once. If a user starts "change method" and abandons before verifying the new method, their old method is already dead while `mfaConfirmedAt` still points at the old state, so the gate would let them in but the next sign-in challenge expects the new (unscanned) secret. The change-method flow MUST clear `mfaConfirmedAt` at the moment it calls `enable` (forcing the TwoFactorGate to hold them in setup until they re-confirm), and only re-stamp it via `confirmMfaSetup` after the new method verifies. Backup-code regeneration uses `generateBackupCodes` (does NOT rotate the TOTP secret), so it is safe and needs no gate change.
- Account deletion runs through a Convex action (password verify) + internal mutation (cascade); test the cascade and the last-admin guard with convex-test.
