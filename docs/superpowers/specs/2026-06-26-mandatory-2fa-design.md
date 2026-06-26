# Mandatory two-factor authentication (2FA)

Status: design, pending review.
Date: 2026-06-26.

## 1. Overview

Add mandatory two-step verification to the dashboard app. Every user must have a
confirmed second factor before they can use the product. Two methods are
supported:

- **Authenticator app (TOTP)**, the recommended method.
- **Email codes (OTP)**, the simplest method, and also the universal recovery
  fallback for authenticator users who lose their device.

Enforcement is built into the authenticated app shell: a user who has not
confirmed a second factor is held in a setup flow and cannot reach the dashboard
or the org-onboarding wizard. This makes the account-setup front door identical
for the org creator and for invited members: set password, then set up 2FA.

The mechanism is Better Auth's official `twoFactor` plugin (already on
`better-auth@1.6.17`, with `@convex-dev/better-auth@0.12.4`). The login-page and
email look are adapted from the polyform reference (segmented 6-digit code input,
"Didn't receive the email? Try again", a boxed monospace code email), rebuilt on
our stack (Better Auth, Sweego, React Email, brand `#eb3e5d`, i18n in en/sv/nb/da/fi).

## 2. Decisions (locked)

1. **Method model.** Each user picks one method at mandatory setup: authenticator
   (recommended) or email. Email codes are always available as a recovery channel
   for authenticator users. No separate backup-code sheet in V1.
2. **Flow structure.** A shared account-setup gate (password, then 2FA), styled
   like the wizard, runs for everyone. The org creator then continues into the
   existing 4-step org-onboarding wizard. Invited members land on the dashboard.
3. **Sign-in.** The second factor is required on every sign-in. No "remember this
   device" trust window (Better Auth's `trustDevice` is not used).
4. **Invited-user password path (resolved).** The live invite flow already sends a
   set-password link and produces an authenticated session, so no invite rebuild
   is needed. See section 6.
5. **Re-authenticate before enabling 2FA (resolved).** The setup flow re-confirms
   the user's password at the `enable()` step. See section 7.

## 3. Better Auth 2FA facts this design relies on

- Server plugin: `twoFactor({ issuer, skipVerificationOnEnable, otpOptions: { sendOTP } })`.
- Client plugin: `twoFactorClient()`.
- `enable({ password })` returns `totpURI` and `backupCodes`, and requires the
  password.
- `verifyTotp({ code })`, `sendOtp()`, `verifyOtp({ code })`.
- Sign-in with 2FA enabled returns `twoFactorRedirect: true` and `twoFactorMethods`
  instead of a session.
- Schema additions: a `twoFactor` table (`secret`, `backupCodes`, `verified`,
  `failedVerificationCount`, `lockedUntil`) and `user.twoFactorEnabled`.
- `skipVerificationOnEnable: true` flips `twoFactorEnabled` true at `enable()`,
  before the user confirms the method works. This is required so an email-method
  user can enroll without ever owning an authenticator app. The consequence is in
  section 8.

## 4. Architecture

### 4.1 Gate placement

`apps/dashboard/app/(app)/layout.tsx` currently nests:

```
AuthLoading -> Unauthenticated(SignInScreen) -> Authenticated( OnboardingGate -> children )
```

We insert a new gate before `OnboardingGate`:

```
AuthLoading -> Unauthenticated(SignInScreen) -> Authenticated( TwoFactorGate -> OnboardingGate -> children )
```

`TwoFactorGate` queries the current user's MFA status. If the user has not
confirmed a second factor, it renders the 2FA setup wizard and blocks everything
below it. Otherwise it renders its children unchanged. Placing it before
`OnboardingGate` enforces the order: password, then 2FA, then (org wizard or
dashboard).

### 4.2 Two halves of the feature

The feature has two distinct user experiences:

- **Enrollment** (a user who has no confirmed factor yet): the `TwoFactorGate`
  setup wizard. Hit by every new user once.
- **Challenge** (a user who already has a factor): the sign-in second-factor
  screen. Hit on every login.

## 5. Flows

### 5.1 Sign-in challenge (returning users)

1. User submits email + password on `SignInScreen` (existing
   `email-password-form.tsx`).
2. Better Auth returns `twoFactorRedirect: true` (no session yet). The sign-in
   screen transitions to a "Verify it's you" phase.
3. Default screen by method:
   - Authenticator users: a 6-digit segmented input -> `verifyTotp({ code })`,
     with a secondary "Email me a code instead" link that calls `sendOtp()` and
     switches to the email screen.
   - Email users: auto `sendOtp()`, then the polyform-style screen ("We sent a
     code to your email", resend / try-again) -> `verifyOtp({ code })`.
4. The method shown by default is resolved from a device-remembered hint
   (localStorage, written on successful setup or login) with a neutral fallback
   that offers both affordances. We do not run an unauthenticated query keyed by
   email, to avoid account enumeration. Email is always reachable as the fallback.
5. On a successful verify, the full session is created and the user is routed to
   `/`.

### 5.2 Mandatory enrollment (new users)

Precondition: the user is authenticated (they set a password via the welcome /
reset-password link, or signed in) but `mfaConfirmedAt` is null.

`TwoFactorSetup` wizard, using the same centered Logo + Card shell as sign-in and
reset-password:

1. **Choose method.** Two options: "Authenticator app (recommended)" and "Email
   codes", each with a one-line plain-language explanation and a `HelpMorphButton`
   (`dashboard.help.twoFactor.*`) explaining what two-step verification is. Help
   text ships in all five locales (the "guide every concept" rule).
2. **Confirm password.** A single password field: "Confirm your password to turn
   on two-step verification." On submit, call `enable({ password })`. This is the
   re-authentication step (section 7). It applies to both methods because
   `enable()` requires the password regardless.
3. **Confirm the method:**
   - Authenticator: render the `totpURI` as a QR code plus a manual entry key,
     then a 6-digit input -> `verifyTotp({ code })`.
   - Email: show the user's email, "Send code" -> `sendOtp()` -> a 6-digit input
     -> `verifyOtp({ code })`.
4. On the confirming verify, call `confirmMfaSetup({ method })`. The gate then
   lets the user through (org wizard for the creator, dashboard for a member).

A user who abandons after step 2 but before step 4 has 2FA enabled in Better Auth
(because of `skipVerificationOnEnable`) but `mfaConfirmedAt` is still null, so the
gate keeps them in setup on the next load. They are already protected and can
always finish via the email code. See section 8.

## 6. Invited-user onboarding (resolved: no rebuild)

The live invite path is platform-admin `createUser`
(`apps/dashboard/components/admin/create-user-dialog.tsx` ->
`packages/backend/convex/platform/admin.ts`):

1. `createUser` -> `provisionUser` (creates the `user` row, `emailVerified: true`,
   no password) -> `addMember`.
2. `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`
   triggers `sendResetPassword`, which sees no password and sends the `welcome`
   (set-password) email with a `/reset-password?token=...` link.
3. The invitee sets the password and reaches an authenticated state.

So invited users already receive a set-password link and become authenticated.
The `organization.inviteMember` / `accept-invitation` machinery exists in config
but has no UI trigger today (dormant).

Because the 2FA gate lives in `(app)/layout.tsx`, it applies uniformly to:

- the seeded org creator (dev seed `insertCredentialUser`),
- the `createUser` invitee,
- and the dormant accept-invitation path, if it is ever activated (acceptance
  also lands in `(app)`).

No change to the invite flow is required. The org creator and invited member see
the identical password-then-2FA front door.

Open verification (implementation, not blocking): whether `resetPassword` returns
a session directly or requires a follow-up sign-in. The design is robust to both
because the gate triggers on the authenticated state however it is reached.

## 7. Re-authentication before enabling 2FA

The setup flow re-confirms the user's password at the `enable()` step, for both
methods.

Rationale:

- OWASP (MFA and Authentication cheat sheets) and NIST SP 800-63B treat enrolling
  or replacing an authentication factor as a high-risk action that must require
  re-authentication, not reliance on an active session (the session may be
  hijacked).
- Better Auth's `enable()` / `getTotpUri()` require the password anyway, and the
  session-after-reset behavior is undocumented, so carrying a password in memory
  across the set-password to 2FA boundary is neither reliable nor desirable.
- No plaintext password is threaded through React state across steps. The user
  types it once on the confirm step, it is passed straight to `enable()`, and is
  not retained.

The cost is one password confirmation on a once-ever setup, which is the expected
and standard UX for enabling a second factor.

## 8. MFA state, source of truth, and the confirm mutation

Because `skipVerificationOnEnable` makes `user.twoFactorEnabled` true at
`enable()` (before method confirmation), `twoFactorEnabled` alone is not a
reliable "setup complete" signal. We track our own marker.

Add to the `users` mirror (`packages/backend/convex/accounts/tables.ts`):

- `mfaMethod: v.optional(v.string())` with values `"totp"` or `"email"`.
- `mfaConfirmedAt: v.optional(v.number())`.

These are account-security state keyed to the person, removed on hard delete with
the rest of the mirror row, and never added to a domain table (Role != Person).
We do not add a per-user `mfaRequired` flag: 2FA is mandatory for everyone.

New backend functions (org-scoped where applicable, per tenant isolation):

- `getMyMfaStatus` query: reads the caller's mirror row, returns
  `{ confirmed: boolean, method: "totp" | "email" | null }`. Feeds `TwoFactorGate`.
- `confirmMfaSetup({ method })` mutation: independently verifies server-side that
  2FA is genuinely active for the caller (reads the Better Auth component's user
  record / `twoFactor` row) before stamping `mfaMethod` and `mfaConfirmedAt`, then
  writes the audit row. A client cannot mark itself confirmed without having
  passed the password-gated `enable()` and a verify. The exact Better Auth signal
  to check (`twoFactorEnabled` vs the `twoFactor.verified` flag, which may differ
  between the TOTP and email paths under `skipVerificationOnEnable`) is pinned
  during implementation with tests.

The abandon-after-enable case (2FA on, `mfaConfirmedAt` null) is a UX-completeness
concern, not a security hole: the user is already protected and the gate simply
keeps them in setup until they finish. They can always complete via the email
code.

## 9. Audit

Add to `packages/backend/convex/lib/audit.ts`:

- `AUDIT_EVENTS.mfaEnabled = "mfa.enabled"`, payload `{ method: "totp" | "email" }`.

Add the typed payload in the sibling `auditPayloads.ts`. `confirmMfaSetup` logs it.
No `mfa.disabled` event in V1, because 2FA cannot be turned off (section 11). The
audit trail records the method only, never any secret, code, or PII.

## 10. Email, i18n, and UI building blocks

### 10.1 Email template

New React Email template `packages/email/src/templates/two-factor-code.tsx`, built
on the existing `BaseEmailTemplate` (brand `#eb3e5d`, Source Sans 3, `CtaButton`
not needed here). It reproduces the polyform look: a centered, boxed, monospace
6-digit code (large size, letter-spacing, light panel) with a short security note.

- Add the key to `packages/constants/src/email.ts` `EMAIL_TEMPLATE_KEYS` (for
  example `"twoFactorCode"`) and to the template-key validator.
- Add `emailMessages` entries (subject, body, code-box label, security note) in
  all five locales. English is the source; sv/nb/da/fi are machine-drafted and
  flagged for native review.
- Wire `otpOptions.sendOTP` in `auth.ts` to `enqueueEmail` with the new key,
  resolving locale from the user's stored language (`getLanguageForUser`) with an
  `en` fallback, mirroring the reset / welcome emails.
- Add a render test (the package already has `render.test.ts`).

### 10.2 In-app i18n

New keys under `dashboard.auth.twoFactor.*` (challenge and setup copy) and
`dashboard.help.twoFactor.*` (the help-morph explanation), in all five locales.
Subject and code-box copy live in the email message module, not next-intl.

### 10.3 UI components and dependencies

- The segmented input reuses the existing shadcn `packages/ui/src/components/input-otp.tsx`
  (`input-otp@^1.4.2` already installed).
- QR rendering needs a small dependency (for example `qrcode`) to turn the
  `otpauth://` URI into an image. Add it to the dashboard app.
- Forms follow the house rules: react-hook-form + Zod factory schemas
  (`makeXSchema(t)`), the shadcn `Form` components, `FormMessage` for inline
  errors, submit gated on `isValid` and `isSubmitting`.
- Layout-shift and animation rules are respected (fixed-size slots, motion for
  genuine enter/leave, reduced-motion honored).

### 10.4 Auth wiring

- `apps/dashboard/lib/auth-client.ts`: add `twoFactorClient()` to the plugins.
- `packages/backend/convex/auth.ts`: add the `twoFactor` server plugin to the
  `plugins` array, with `sendOTP`.
- Regenerate the `@convex-dev/better-auth` component schema (adds the `twoFactor`
  table and `user.twoFactorEnabled`); add any needed index in
  `packages/backend/convex/betterAuth/schema.ts`.

## 11. Security posture

- Re-authentication before enabling 2FA (section 7).
- Rate limiting: add throttle rules in the existing `rateLimit.customRules` block
  in `auth.ts` for the 2FA endpoints (for example `/two-factor/send-otp`,
  `/two-factor/verify-otp`, `/two-factor/verify-totp`), mirroring the
  `/sign-in/email` rule. The plugin's built-in `failedVerificationCount` and
  `lockedUntil` add lockout on repeated failures.
- The second factor is required on every sign-in (no device trust).
- Email OTP locale resolves from stored user language; codes and secrets never
  appear in audit, logs, or any domain table.
- All data stays in the EU (Convex eu-west-1), unchanged.

## 12. Non-goals (V1)

- No backup-code sheet (email is the recovery fallback).
- No "remember this device" trust window.
- No self-serve surface to disable or change the method. 2FA is mandatory and
  cannot be turned off. A later settings surface to switch method can be added
  without rework, reusing `confirmMfaSetup` and the audit event.
- No SMS factor.
- No change to the dormant `organization.inviteMember` / `accept-invitation` path
  beyond confirming the 2FA gate covers it.

## 13. Testing

Per project rule, new code ships with tests in the same commit (Vitest 4;
`bun run test`).

- Backend (convex-test, edge-runtime): `getMyMfaStatus`,
  `confirmMfaSetup` including the "reject when 2FA is not genuinely enabled" guard,
  and the `mfa.enabled` audit row.
- Frontend: `TwoFactorGate` renders setup when unconfirmed and children when
  confirmed; the `TwoFactorSetup` step flow (method choice, password confirm,
  TOTP confirm, email confirm); the sign-in challenge phase (TOTP and email,
  including the "email me instead" switch).
- Email: render test for `two-factor-code`; the i18n parity test automatically
  guards the new message keys across locales.

## 14. Implementation sequencing (for the plan)

1. Backend foundation: add the `twoFactor` plugin and `twoFactorClient`, regen the
   component schema, add `sendOTP`, rate-limit rules, and the `mfa.enabled` audit
   event.
2. MFA state + functions: mirror fields, `getMyMfaStatus`, `confirmMfaSetup` (with
   the server-side verification guard), tests.
3. Email: `two-factor-code` template, constants key, five-locale messages, render
   test.
4. Enrollment: `TwoFactorGate` in the app layout, `TwoFactorSetup` wizard (method
   choice, password confirm, QR + TOTP confirm, email confirm), QR dependency,
   help text, i18n, tests.
5. Sign-in challenge: extend `SignInScreen` / `email-password-form` to handle
   `twoFactorRedirect`, the TOTP and email screens (polyform look), the device
   hint, tests.

Each slice is independently testable and reviewable.
