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
- On submit: trigger Better Auth `changeEmail` so a verification link is emailed to the **new** address; show a "Check your new inbox" confirmation state. The change only applies after the link is clicked.
- Verification landing: a callback page shows success ("Your email has been updated") and an expired/invalid state, mirroring the reset-password page's states.
- New email template `changeEmail` (subject + body with the verification link), authored in `en` and mirrored to all locales.

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
- `deleteMyAccount` (mutation, authed): 
  1. Re-auth check: require the current password (verified before any destructive work) — exact verification mechanism confirmed in planning (see below).
  2. Last-admin guard: query `member` rows for `ctx.authUserId`; for each org where the user's role is `admin`, count other admins; if any org has zero other admins, throw `appError(ERROR_CODES.lastAdmin)` (new code) so the client can show the support note. (The UI also pre-checks via `getMyAccount`, but the mutation re-validates.)
  3. Erase: reuse `components.betterAuth.provisioning.eraseUser({ userId: ctx.authUserId })` (member/account/session/invitation/user rows), schedule `internal.email.erasure.purgeRecipientEmails` for the returned email, delete the `users` mirror row, and anonymize `auditLog`/`platformAuditLog` `actorName` to the existing `ERASED_ACTOR_NAME` tombstone. This mirrors the existing platform `deleteUser` exactly, minus the platform-admin gate and minus the self-delete block.
  4. Log a platform-audit erasure row (org count only, no PII), consistent with the existing flow.

### `twoFactor.ts` (extend)
- A password-gated backup-code regeneration path (server confirm if needed; the actual minting is a Better Auth client call — confirm in planning).
- `confirmMfaSetup` already updates `mfaMethod` + `mfaConfirmedAt`, so re-enrollment reuses it as-is.

### `auth.ts` (extend)
- Enable Better Auth `changeEmail` with `sendChangeEmailVerification` configured to `enqueueEmail` the verification link to the **new** address (template `changeEmail`, locale from the user's stored language).

### `auth-client.ts` (extend)
- Confirm `twoFactorClient()` exposes `disable` / `generateBackupCodes` (standard methods); use `generateBackupCodes({ password })` for regeneration. Add config only if the methods are not already available.

### Error codes / constants
- Add `lastAdmin` to `ERROR_CODES` and the frontend translation map.
- Add `changeEmail` to the email template keys + a React email template + i18n.

---

## Better Auth specifics to confirm in planning

These are the only API-level unknowns; resolve them first in the plan (convex-expert + Better Auth 1.6.17 source/docs), then implement:

1. **changeEmail flow:** confirm `user.changeEmail` config shape and that emailing the BA-generated verification `url` to `newEmail` completes the change when clicked; confirm whether the verification click needs the initiating session (it is opened from the new mailbox, possibly unauthenticated) and design the callback landing page accordingly.
2. **Server-side password re-auth for delete:** confirm how to verify the current password before erasing (a BA verify call, BA `deleteUser({ password })` semantics, or fall back to BA's `sendDeleteAccountVerification` email confirmation). The delete must be re-authenticated; pick the mechanism BA actually supports.
3. **2FA client methods:** confirm `authClient.twoFactor.generateBackupCodes`/`disable` are exposed by `twoFactorClient()` (they should be by default); if not, expose them.

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

- The email-change verification is the only genuinely new subsystem (config + template + landing page + token semantics); plan it first and verify the BA flow before building the UI.
- Server-side password re-auth for deletion may require a fallback to BA's email-confirmation delete if BA can't verify a password inline; the plan resolves this before the delete UI is built.
- Reusing `TwoFactorSetup` for re-enrollment must keep mandatory 2FA intact (never leave `mfaConfirmedAt` cleared without an immediate re-confirm).
