# Account dossier

Scope: the per-user `/account` settings surface (profile, email, language,
password, two-factor authentication, avatar, account deletion), plus the
adjoining auth flows that touch personal account state (sign-in 2FA challenge,
mandatory 2FA enrollment, forgot/reset password, the change-email double
opt-in). Organization-level settings (org name, members, invitations) belong to
the `organization` section, not here.

## Behavior today

### Route structure and entry points
- `/account` redirects server-side to `/account/profile`.
  `apps/dashboard/app/(app)/account/page.tsx`.
- Two sub-routes, both under the authenticated `(app)` route group (inherits
  `TwoFactorGate` -> `OnboardingGate`): `/account/profile` and
  `/account/security`. `apps/dashboard/app/(app)/account/{profile,security}/page.tsx`.
- The tab bar (Profile / Security) is NOT rendered inside the account layout;
  it lives in the app's top header (`site-header.tsx` branches on the first
  path segment and renders `AccountTabs` for `section === "account"`), matching
  the header-tab pattern used by the model/admin sections.
  `apps/dashboard/components/account/account-tabs.tsx`.
- `apps/dashboard/app/(app)/account/layout.tsx` only wraps children in a
  `w-full` container; no title block, no in-content tab bar (moved to the
  header per the 2026-06-27 polish plan).
- Entry points into `/account` are the `NavUser` sidebar dropdown and the
  auth-shell `AccountMenu` (both above/near Sign out).

### Profile tab (`/account/profile`)
Composed (per `docs/superpowers/plans/2026-06-27-account-settings-polish.md`)
as a stack of shadcn `Card`s: Avatar, Name, Change email, Language. Each is its
own client component under `apps/dashboard/components/account/`.
- **Avatar** (`avatar-section.tsx`): clickable avatar upload backed by Convex
  file storage. Upload flow: `api.files.generateImageUploadUrl` -> POST the
  file to the returned URL -> `api.accounts.account.setMyAvatar({ storageId })`
  (a Convex **action**, not a mutation) -> `authClient.updateUser({ image })`
  mirrors the served URL onto Better Auth for nav/session display. Remove flow:
  `api.accounts.account.removeMyAvatar` -> `updateUser({ image: "" })`.
  `setMyAvatar` re-validates the blob server-side (size + content type) and
  deletes a rejected upload immediately (this is why it must be an action: a
  mutation's rollback on throw would undo the `storage.delete` and leave an
  orphaned blob). Replacing an existing avatar deletes the previous file first
  (`applyAvatar` internal mutation, `packages/backend/convex/accounts/account.ts`).
- **Name** (`profile-name-form.tsx`): single `name` field, RHF + Zod
  (`makeProfileNameSchema`), gated on `isValid && isDirty` (pre-filled edit
  form). Submits via `authClient.updateUser({ name })`; the Better Auth ->
  `users` mirror trigger keeps Convex in sync, no dedicated backend mutation.
- **Change email** (`change-email-form.tsx`): shows the current email
  read-only, a single `newEmail` field (`makeChangeEmailSchema`, must differ
  from current). Submit calls `authClient.changeEmail({ newEmail, callbackURL:
  "/change-email?step=confirmed" })`. This is Better Auth's **double opt-in**:
  hop 1 sends a confirmation link to the CURRENT mailbox; clicking it re-issues
  a token and emails the NEW mailbox (hop 2); clicking that applies the change.
  No password field on this form: the current-mailbox confirmation IS the
  re-authentication gate (`changeEmail` takes no password in Better Auth
  1.6.17). After submit the form is replaced by a confirmation card ("we've
  emailed your current/new address"). The landing page for both hops is
  `apps/dashboard/app/change-email/page.tsx` (outside the `(app)` group, works
  signed out, in any browser): `?step=confirmed` (hop 1 done, new mailbox now
  being verified, NOT yet changed), `?step=done` (hop 2 done, email now
  updated), `?error=...` (invalid/expired link), or no param (neutral
  fallback). Uses `AuthShell` + a `SuccessCheck` icon.
- **Language** (`language-section.tsx`): no submit button; selecting a locale
  in the `Select` immediately previews it (`useSetPreviewLocale`, optimistic)
  and persists via `api.accounts.onboarding.setUiLocale`; on failure the
  preview is dropped and the UI reverts to the server value. Same mechanism as
  the sidebar `LanguageMenuSub`. Toasts `dashboard.toast.languageUpdated` on
  success.

### Security tab (`/account/security`)
Composed as Change password, Two-factor, Danger zone (delete) cards.
- **Change password** (`change-password-form.tsx`): current + new + confirm
  password (`makeChangePasswordSchema`; new password minimum length is
  `MIN_PASSWORD_LENGTH = 8`, shared constant `apps/dashboard/lib/auth-schemas.ts`).
  Submits `authClient.changePassword({ currentPassword, newPassword,
  revokeOtherSessions: true })`, so changing the password signs out every
  other active session. A wrong current password surfaces as
  `code === "INVALID_PASSWORD"` from Better Auth, mapped to the
  `wrongPassword` inline message (not the generic `error`).
- **Two-factor** (`two-factor-section.tsx`): shows the current method
  ("Authenticator app" or "Email", from `getMyAccount.mfaMethod`) with a
  `HelpMorphButton`. Two actions:
  - **Change method**: a confirm `AlertDialog` calling
    `api.accounts.account.clearMfaConfirmed` (clears `mfaConfirmedAt` only,
    does not touch Better Auth's 2FA state). This forces the mandatory
    `TwoFactorGate` to treat setup as incomplete on next check, so the user is
    routed back into the full `TwoFactorSetup` wizard (method choice, password
    re-confirm via `enable({ password })` which re-mints the TOTP secret and
    backup codes, then verify) to pick and confirm a new method.
  - **Regenerate backup codes**: an inline password-gated form calling
    `authClient.twoFactor.generateBackupCodes({ password })`, which does NOT
    rotate the TOTP secret (safe, no re-verification needed). Shows the fresh
    codes with the same save/copy UI as initial setup (`CopyButton`).
  - There is no "disable 2FA" control anywhere in the UI (2FA is mandatory;
    Better Auth's `disable()` is never called by this app).
- **Delete account** (`delete-account-section.tsx`): a `border-destructive`
  Card. Clicking the destructive button opens an `AlertDialog` with a
  type-to-confirm field (must type the account's own email, case-insensitive)
  plus the current password. Submit calls
  `api.accounts.account.deleteMyAccount({ password })` (a Convex **action**).
  On success: best-effort `authClient.signOut()` then redirect to `/`. If the
  account is the SOLE admin of any organization
  (`getMyAccount.lastAdminOrgs`), the whole delete UI is replaced by a
  support-contact note listing the org name(s), no password/confirm form is
  shown at all.

### Backend (`packages/backend/convex/accounts/account.ts`, `twoFactor.ts`)
- `getMyAccount` (plain `query`, not `authedQuery`): returns
  `{ name, email, locale, mfaMethod, lastAdminOrgs }` or `null` when signed
  out. Deliberately non-throwing on a missing identity (same rationale as
  `getMyMfaStatus`: a token-refresh blip during 2FA enable must not crash the
  settings page).
- `lastAdminOrgs` / `soleAdminOrgs` helper: queries the caller's memberships
  via the Better Auth component, filters to `admin` role, and for each such org
  counts other admins; an org is included only if the caller is the ONLY
  admin. Shared by the UI guard (`getMyAccount`) and the server-side
  re-validation in `eraseSelf` (never trusts the client).
- `deleteMyAccount` (`action`): re-authenticates via Better Auth's
  `auth.api.verifyPassword` (any failure, including an unresolvable session,
  is mapped to `appError(ERROR_CODES.invalidInput)`, never silently bypassed),
  then runs the internal `eraseSelf` mutation.
- `eraseSelf` (`internalMutation`): re-checks `soleAdminOrgs` FIRST and throws
  `ERROR_CODES.lastAdmin` if non-empty (server is authoritative even though the
  UI pre-checks). Then: `components.betterAuth.provisioning.eraseUser` (member/
  account/session/invitation/user rows), schedules
  `internal.email.erasure.purgeRecipientEmails` for the user's email,
  schedules `internal.assistant.erase.eraseAssistantDataForUser` (hard-deletes
  every assistant chat thread/message the user owns, across all orgs, per
  ADR-0018), deletes the stored avatar file (if any) BEFORE deleting the
  `users` mirror row, anonymizes the person's `actorName` (and derived
  `searchText`) across both audit logs via `anonymizeAuthoredAuditRows`, and
  logs a platform-audit `userDeleted` row (org count only, no PII, actor ===
  target since this is self-deletion).
- `confirmMfaSetup` (`twoFactor.ts`, `authedMutation`): independently verifies
  via `components.betterAuth.provisioning.hasTwoFactorEnabled` that 2FA is
  genuinely active for the caller before stamping `mfaMethod` +
  `mfaConfirmedAt = Date.now()`; throws `invalidInput` otherwise. This is the
  single source of truth for "2FA setup complete", because Better Auth's own
  `twoFactorEnabled` flips true at `enable()` time (via
  `skipVerificationOnEnable`), before the user has actually verified the
  method.
- **No org audit rows** are written for any per-user account change (profile,
  email, password, 2FA, avatar): these are per-person account state, not
  org-domain state, so they are explicitly carved out of the org-scoped audit
  log. Account deletion IS recorded, but only in the platform-admin audit log,
  never the org log.

### Mandatory two-factor authentication (enrollment and challenge)
- `TwoFactorGate` (`apps/dashboard/components/auth/two-factor-gate.tsx`) sits
  between `Authenticated` and `OnboardingGate` in `(app)/layout.tsx`: every
  authenticated user without a confirmed second factor is held in the
  `TwoFactorSetup` wizard before reaching the org-onboarding wizard or the
  dashboard. This makes the front door identical for the org creator and an
  invited member: set password, then set up 2FA, then (org wizard or
  dashboard).
- `TwoFactorSetup` (`apps/dashboard/components/auth/two-factor-setup.tsx`)
  steps: `choose` (Authenticator app, recommended, vs Email codes, each with
  inline help) -> `password` (re-confirm password, calls
  `authClient.twoFactor.enable({ password })`, which returns a `totpURI` +
  fresh `backupCodes` and rotates any prior secret/codes) -> `confirm` (QR code
  + manual entry key for TOTP, or a "send code" + 6-digit field for email;
  `verifyTotp`/`verifyOtp`) -> `done` (shows backup codes with a save/copy
  acknowledgment checkbox that gates the finish button when codes are present;
  `onFinish` calls `confirmMfaSetup({ method })`, only at this point is setup
  considered complete).
- Sign-in challenge (returning users):
  `apps/dashboard/components/auth/two-factor-challenge.tsx` (not fully read
  but referenced by design/tests): TOTP users see a 6-digit input with an
  "email me a code instead" fallback; email users get an auto-sent code. The
  second factor is required on EVERY sign-in; there is no "remember this
  device" trust window (Better Auth's `trustDevice` is not used).
- Rate limits (`packages/backend/convex/auth.ts` `rateLimit.customRules`):
  `/request-password-reset` 3/min, `/sign-in/email` 5/min,
  `/two-factor/send-otp` 3/min, `/two-factor/verify-otp` 5/min,
  `/two-factor/verify-totp` 5/min, `/two-factor/verify-backup-code` 5/min.
  Better Auth's own `failedVerificationCount`/`lockedUntil` add lockout on
  repeated 2FA failures.
- Password policy: `minPasswordLength: 8` is configured server-side in
  `packages/backend/convex/auth.ts` (Better Auth). The client's
  `MIN_PASSWORD_LENGTH` constant (`apps/dashboard/lib/auth-schemas.ts`) mirrors
  this for the reset/change forms. A client-side HIBP (Have I Been Pwned)
  pre-check (`lib/pwned-password.ts`, per the account-settings design) runs
  before submitting a new password, to catch a breached password early.

### Forgot / reset password
- `/forgot-password` (root level, outside `(app)`, reachable signed out):
  single email field; submit calls `authClient.requestPasswordReset({ email,
  redirectTo: "/reset-password" })` inside try/catch, and shows the SAME
  neutral confirmation regardless of success, unknown email, or rate-limit
  (enumeration-safe: the request is fire-and-forget for UX purposes).
- `/reset-password?token=...` (also root level): sets a new password via
  `authClient.resetPassword({ newPassword, token })`. An invalid/expired/spent
  token surfaces as Better Auth's `code === "INVALID_TOKEN"`, mapped to an
  "expired, request a new link" message with a link back to
  `/forgot-password`; a request with NO token at all shows a distinct
  "missing token" message. On success, redirects to `/`.
- The backend `sendResetPassword` hook (in `auth.ts`) branches by whether the
  target user already has a password (an `account` row exists): a brand-new
  passwordless user (platform-admin `createUser`, or an unactivated invite
  "resend") gets the **`welcome`** email ("set your password"); a user who
  already has a password gets the **`resetPassword`** email. Both use the same
  `requestPasswordReset` trigger and the same `/reset-password` landing page;
  only the email wording differs. The welcome email does not name the
  organization (avoids resolving/rendering an org name in a generic template).

### Split-screen auth shell
- `AuthShell` (`apps/dashboard/components/auth/auth-shell.tsx`) is the single
  shared layout for sign-in, 2FA setup/challenge, forgot/reset password, the
  change-email landing page, and onboarding: a branded dark left `BrandPanel`
  (wordmark, tagline, a `RotatingValueLine` that cross-fades 3-4 short value
  statements every ~6s, hidden below `lg`) and a card-less centered right panel
  that hosts the actual screen content. `headerRight` (the `AccountMenu`
  avatar dropdown: org switch, language, sign out) and `footer` (onboarding's
  step dots) are optional slots used only during onboarding.

## Terms and history

- **Account** (this section) = the signed-in individual's own settings:
  profile (name, email, avatar, display language) and security (password,
  2FA, deletion). Distinct from **Organization** settings (the tenant's own
  configuration: name, members, invitations), which is a separate admin
  surface (`docs/superpowers/specs/2026-06-27-organization-settings-design.md`,
  not this section).
- **Member** vs **User**: per `docs/contexts/accounts/CONTEXT.md`, a "User" is
  the global identity (what `/account` manages); a "Member" is that identity's
  membership *within* one organization (role: Admin or Editor). The account
  settings surface is entirely about the User identity, never about a Member
  role.
- **Admin** / **Editor**: organization-scoped permission roles (glossary,
  `docs/contexts/accounts/CONTEXT.md`). The account section only surfaces
  admin-ness indirectly, via the "last administrator of an organization" delete
  guard; it never lets a user change their own role.
- **`mfaMethod` / `mfaConfirmedAt`**: the app's own markers of 2FA state (on the
  `users` mirror), distinct from and more authoritative than Better Auth's own
  `user.twoFactorEnabled` flag, which can be true before the method is actually
  confirmed (because of `skipVerificationOnEnable`). Docs should describe
  "confirmed" as "the second factor has been verified at least once", not
  merely "turned on".
- **Organization** (the tenant) must never be conflated with the future V2 org
  structure (departments/reporting lines); see the accounts glossary's flagged
  ambiguity. Not directly relevant to account settings but worth carrying into
  any docs that use the word "organization" on this page.
- ADR-0014 terminology renames (Band -> Level (Niva), old Niva -> Seniority,
  anchor-scale positions -> Steps) do not touch account/auth vocabulary at all;
  no pre-0014 account documents use the old words. No translation needed for
  this section.

## Rationale

- **Managed Convex EU + Better Auth** (`docs/adr/0001-convex-eu-better-auth.md`):
  identity and organization data live in the same EU Convex deployment
  (`eu-west-1`) because blueprnt handles EU employee personal data and must
  keep it EU-resident; Better Auth's organization plugin supplies multitenancy
  without building it from scratch. Consequence: region choice is effectively
  one-way (a region move needs backup + restore).
- **Password re-authentication before enrolling/changing 2FA**
  (`docs/superpowers/specs/2026-06-26-mandatory-2fa-design.md` section 7):
  OWASP and NIST SP 800-63B treat enrolling or replacing an auth factor as
  high-risk, requiring re-authentication rather than trusting an active
  session (which could be hijacked). Better Auth's `enable()` already requires
  the password, so this is enforced by the platform, not just convention.
- **No email change password field** (account-settings design, decision 3):
  the double opt-in's current-mailbox confirmation IS the re-auth gate;
  Better Auth's `changeEmail` API takes no password at all, and requiring one
  anyway would add friction without adding security (the confirmation link
  already proves control of the current inbox).
- **`deleteMyAccount` / `setMyAvatar` are actions, not mutations**
  (account-settings design + account.ts comments): a Convex mutation is
  transactional, so a deliberate side effect that must survive a subsequent
  throw (verifying a password via an external API call, or deleting an
  already-rejected storage blob) cannot live inside one; both operations are
  actions that call an internal mutation only after the side effect succeeds.
- **No org audit rows for personal account changes** (account-settings
  design, decision 6; mandatory-2fa plan, Global Constraints and Task 4):
  profile/email/password/2FA state is per-person, not org-domain, so it is
  deliberately excluded from the org-scoped audit log. The mandatory-2FA
  implementation plan documents this as an explicit DEVIATION from its own
  design spec, which had proposed an `mfa.enabled` org-scoped audit event: the
  plan drops it because a per-user MFA method sits awkwardly in a tenant log
  (which org, for a user in several?) and edges toward person-data; the system
  of record for MFA state stays `mfaConfirmedAt` on the `users` mirror plus
  Better Auth's own `twoFactor` table. Account deletion is the one exception
  that IS logged, but only to the platform-admin log (never the org log),
  because it is a platform-level identity event, not an org-domain change.
- **Last-admin delete guard, no self-serve admin transfer**
  (account-settings design, decisions 5): rather than build an
  admin-succession UI for V1, self-deletion is simply blocked when it would
  leave an org admin-less, with a "contact support" note. Server-side
  re-validation in `eraseSelf` exists because the client's guard is UX only,
  not a security boundary (CLAUDE.md's "the backend always re-validates
  independently" rule).
- **Welcome vs reset email branching on `hasPassword`**
  (`docs/superpowers/specs/2026-06-23-create-user-invite-and-org-design.md`,
  `docs/superpowers/plans/2026-06-23-create-user-invite-and-org.md`):
  a single `requestPasswordReset` trigger is kept for both "invite a new user"
  and "forgot my password" so no second code path is needed; the email hook
  alone decides the wording by checking whether a credential `account` row
  exists yet (`components.betterAuth.provisioning.hasPassword`, wrapped by an
  internal `userHasPassword` query). The plan also fixes the sender identity:
  `from` is `blueprnt <hello@blueprnt.se>` (a named, replyable address, since
  the email component parses the display name), and the welcome email body is
  deliberately org-agnostic ("An account was created for you on blueprnt. Set
  your password below to get started.") to avoid resolving/rendering an org
  name in a generic template.
- **Email transport is the Sweego Convex component, superseding the original
  Scaleway TEM design.** The Fas 1 foundation design
  (`docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md`,
  section 5) specified a hand-built durable outbox posting to Scaleway TEM
  (chosen for EU data residency over Resend, which stores account data/logs in
  the US). That outbox shape (an `emails` table with
  `queued|sending|sent|failed` status, retry/cleanup) is what the account
  section's password-reset and 2FA emails still conceptually ride on, but the
  actual sender is now `@christian-ek/sweego`
  (`packages/backend/convex/email/client.ts`,
  `packages/backend/convex/email/outbox.ts`
  `FROM_EMAIL = "blueprnt <hello@blueprnt.se>"`), not Scaleway TEM; Sweego also
  owns retention (`email/cleanup.ts`) and per-recipient erasure
  (`email/erasure.ts`, scheduled by `eraseSelf`). The design doc's org-scoped
  audit events for the Fas 1 slice (`workspace.created`, `member.added`,
  `member.roleChanged`, `member.removed`, `invitation.*`) and its 1-7
  `importanceLevel` scale are likewise historical: current weighting is the
  1-5 weight-point model under ADR-0014's renamed terms, not this document's
  original scale. Treat this design doc as superseded scaffolding history for
  account/auth infrastructure, not a current source of behavioral facts.
- **Branded transactional email layout**
  (`docs/superpowers/specs/2026-06-21-email-template-branding-design.md`,
  `docs/superpowers/plans/2026-06-21-email-template-branding.md`): the
  forgot-password, welcome, and 2FA-adjacent emails share one `BaseEmailTemplate`
  (wordmark header, title, content, footer) built in `packages/email`, with the
  CTA button styled in the brand rose as a deliberate, spec-recorded exception
  to the app's "primary buttons stay neutral" rule (email is treated as a
  marketing-adjacent surface). Copy flows through `email.*` i18n keys in all
  five locales, machine-translated sv/nb/da/fi strings flagged as drafts for
  native review.
- **Enumeration-safe forgot-password** (forgot-password design, decision 2):
  the confirmation text and its timing never reveal whether an email is
  registered, satisfying a standard auth-security expectation without any
  extra backend work (the existing rate limit already caps abuse).
- **Avatar as personal data with its own erasure hook** (account-settings
  polish plan; CLAUDE.md PII/erasure invariant): the `_storage` id lives only
  on the per-user `users` mirror (never a domain table), and BOTH erasure
  paths (self-delete and platform-admin delete) must delete the stored file
  before deleting the row, so no avatar PII survives a hard delete.
- **Card-less split-screen `AuthShell`**
  (`docs/superpowers/specs/2026-06-26-auth-onboarding-split-layout-design.md`):
  unifies sign-in, 2FA, forgot/reset password, and onboarding under one
  branded frame instead of divergent centered-Card layouts, because these
  screens are all "pre-app" and benefit from a single, recognizable shell.

## Edge cases and error states

- **Last administrator, blocking delete**: `getMyAccount.lastAdminOrgs`
  non-empty replaces the entire delete UI with a support-contact note (no
  form at all). A race (another tab confirms deletion, or admin count changes
  between the client check and submit) is handled by catching the
  `lastAdmin` error message on submit, closing the dialog, and showing the
  same note (using `lastAdminUnknown` copy if the org name list is not yet
  available reactively). Error code: `errors.lastAdmin` = "You're the last
  administrator of an organization. Contact support to delete your account."
  Thrown by `eraseSelf` (`ERROR_CODES.lastAdmin`, `packages/backend/convex/lib/errors.ts`).
- **Wrong password on delete / password change / 2FA regenerate / 2FA
  enable**: `deleteMyAccount` re-auth failure (any cause, including an
  unresolvable session) maps to `errors.invalidInput` ("Invalid input."),
  shown inline as `wrongPassword` copy in `delete-account-section.tsx` (string
  match on `"errors.invalidInput"`). `change-password-form.tsx` detects
  Better Auth's `code === "INVALID_PASSWORD"` directly and shows a distinct
  `wrongPassword` message (not the generic error). `two-factor-section.tsx`'s
  backup-code regeneration and `two-factor-setup.tsx`'s password step both
  show a local `pwError`/`wrongPassword` state on any Better Auth error.
- **Abandoned 2FA re-enrollment**: if a user starts "change method" (which
  clears `mfaConfirmedAt` via `clearMfaConfirmed`) but never finishes, Better
  Auth's `enable()` has already rotated the secret and codes
  (`skipVerificationOnEnable`), so the OLD method is already dead while the
  gate now holds them in setup on next load. This is treated as safe-by-design
  (they are still protected; they can always finish via email) rather than an
  error state, but the docs should mention that starting "change method" is
  not reversible mid-flow.
- **Email already taken during change-email**: Better Auth silently no-ops if
  `newEmail` already belongs to another user (no enumeration leak); the UI
  still shows the same "we've emailed you" confirmation regardless.
- **Change-email landing page four states**: `?step=confirmed` (hop 1 done,
  do NOT imply the email changed yet), `?step=done` (hop 2 done, email now
  live), `?error=...` (invalid/expired link), or no recognized param (neutral
  fallback, never claims success). `apps/dashboard/app/change-email/page.tsx`.
- **Reset-password token states**: no token in the URL at all ("missing
  token" message) vs `?error=INVALID_TOKEN` (expired/spent link, distinct
  "expired, request a new one" message with a link to `/forgot-password`) vs
  a token rejected on submit (same expired message).
- **Forgot-password is always enumeration-safe**: success, unknown email, and
  rate-limited requests all render the identical confirmation text; the
  request's outcome is swallowed in the UI.
- **Rate limiting** (`packages/backend/convex/auth.ts`): `/request-password-reset`
  3/min, `/sign-in/email` 5/min, `/two-factor/send-otp` 3/min,
  `/two-factor/verify-otp` 5/min, `/two-factor/verify-totp` 5/min,
  `/two-factor/verify-backup-code` 5/min. Better Auth's own
  `failedVerificationCount`/`lockedUntil` add an additional lockout window on
  repeated 2FA failures. No dedicated UI copy confirms this dossier found for
  a rate-limited state on the sign-in/2FA screens beyond the generic error
  messaging; the forgot-password flow explicitly folds it into the neutral
  confirmation.
- **Pre-launch 2FA test affordances (env-gated, tracked for removal at
  go-live)**: (1) `sendOTP` (`packages/backend/convex/auth.ts`) logs the real
  6-digit email code to the Convex console whenever `NODE_ENV !== "production"`,
  so local testing needs no real inbox; never active on a production build.
  (2) An account whose email is listed in the backend env var
  `TWO_FACTOR_EXEMPT_EMAILS` (comma-separated) is exempt from mandatory 2FA:
  `getMyMfaStatus` reports `confirmed: true` for it so the `TwoFactorGate`
  passes, and since it never enables 2FA it signs in with email + password
  alone. Scoped to known test identities, not a guessable global bypass; see
  `docs/superpowers/plans/2026-06-26-mandatory-2fa.md` and
  `docs/go-live-checklist.md`.
- **Avatar upload rejects**: oversized or non-image files are rejected
  client-side before upload (`invalidType`/`tooLarge` inline errors,
  `dashboard.account.profile.avatar.*`); the server (`setMyAvatar` action)
  independently re-validates size and content type and deletes any blob that
  fails validation, so a bypassed client check cannot leave orphaned or
  invalid avatar data.
- **`notAuthenticated`** ("You need to sign in."): the generic guard for any
  account query/mutation reached without a valid identity; `getMyAccount` and
  `getMyMfaStatus` deliberately return `null` instead of throwing this, to
  avoid crashing the settings page or the 2FA gate during a token-refresh
  blip; `deleteMyAccount` and other actions still throw it for a genuinely
  unauthenticated caller.
- **`notFound`** ("Not found."): thrown by `applyAvatar` if the caller's
  `users` mirror row cannot be found, and by `confirmMfaSetup` similarly if
  the mirror row is missing.
- **`invalidInput`** ("Invalid input."): the catch-all for account-security
  re-authentication failures (wrong password on delete, or a `confirmMfaSetup`
  call that arrives without genuine Better Auth 2FA state, i.e. reached
  without ever passing the password-gated `enable()` + verify).

## Deliberately absent

- **No self-service full 2FA disable.** 2FA is mandatory for every user; the
  only self-service actions are "change method" (which forces a full
  re-enrollment) and "regenerate backup codes". (Non-goal, mandatory-2FA
  design section 12 and account-settings design scope.)
- **No support for multiple enrolled 2FA methods per user**; the data model
  keeps exactly one `mfaMethod`. (Account-settings design, non-goals.)
- **No avatar upload in the original account-settings design**; it shipped
  later in the separate "Account Settings Polish" plan
  (`docs/superpowers/plans/2026-06-27-account-settings-polish.md`), so the
  base design explicitly listed it as out of V1.
- **No active-session listing or per-session revoke.** Changing the password
  still revokes all other sessions as a side effect, but there is no UI to
  view or selectively kill sessions. (Account-settings design, non-goals.)
- **No self-service organization deletion or admin-rights transfer UI.** The
  last-admin case always routes to "contact support"; `disableOrganizationDeletion`
  stays true. (Account-settings design, non-goals.)
- **No SMS as a 2FA factor.** Only TOTP (authenticator app) and email codes.
  (Mandatory-2FA design, non-goals.)
- **No "remember this device" trust window.** Better Auth's `trustDevice` is
  not used; the second factor is required on every sign-in. (Mandatory-2FA
  design, decisions and non-goals.)
- **No backup-code sheet as a THIRD standalone recovery mechanism separate
  from the method-specific flow**; backup codes exist only as part of the TOTP
  enrollment/regeneration flow itself, and email is the universal recovery
  fallback for authenticator users, not a separate backup-code login path.
  (Mandatory-2FA design, decisions 1 and non-goals.)
- **No change to the dormant `organization.inviteMember` / accept-invitation
  UI trigger** as part of any account-settings or 2FA work; the invite path in
  production use is exclusively the platform-admin "create user" flow. (Design
  docs for both 2FA and create-user-invite.)
- **No video or rich media in the `AuthShell` left panel**; it is deliberately
  text-and-brand only (no asset exists, and this is a serious B2B product).
  (Split-layout design, non-goals.)
- **No organization name in the welcome email**, to avoid an awkward
  empty/unresolved-org rendering; naming the org was noted as a possible later
  enhancement, not built. (Create-user-invite design, decision 2.)

## Sources read

- `docs/adr/0001-convex-eu-better-auth.md`
- `docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md`
  (Fas 1 foundation design; read in full. Superseded on email transport
  (specifies Scaleway TEM; current code uses the Sweego Convex component) and
  on the importance scale (1-7/weights 8-14-18; current model is the 1-5
  weight-point/ADR-0014 terminology). Still accurate on: no self-serve
  sign-up (`disableSignUp`), email+password sign-in, the `users` mirror table
  and its triggers, organization deletion disabled for every role, and the
  general Local Install/org-scoping architecture.)
- `docs/superpowers/plans/2026-06-04-convex-backend-better-auth.md` (3543-line
  implementation plan for the design above; skimmed for deviations from its
  own spec via targeted grep, none found specific to account/auth beyond what
  the design doc already states; not a source of new facts for this section)
- `docs/superpowers/specs/2026-06-27-account-settings-design.md`
- `docs/superpowers/plans/2026-06-27-account-settings.md` (implementation plan
  for the design above; matches it task-for-task, no new facts)
- `docs/superpowers/specs/2026-06-26-mandatory-2fa-design.md`
- `docs/superpowers/plans/2026-06-26-mandatory-2fa.md` (implementation plan;
  added facts folded in above: the documented deviation dropping the
  `mfa.enabled` org-audit event, and the env-gated pre-launch test
  affordances `sendOTP` console-logging and `TWO_FACTOR_EXEMPT_EMAILS`)
- `docs/superpowers/specs/2026-06-22-forgot-password-design.md`
- `docs/superpowers/plans/2026-06-22-forgot-password.md` (implementation plan
  for the design above; skimmed, no deviations found, no new facts)
- `docs/superpowers/specs/2026-06-23-create-user-invite-and-org-design.md`
- `docs/superpowers/plans/2026-06-23-create-user-invite-and-org.md`
  (implementation plan; added facts folded in above: the exact sender
  `from` address and its Sweego display-name rationale, and the org-agnostic
  welcome-email body wording)
- `docs/superpowers/specs/2026-06-26-auth-onboarding-split-layout-design.md`
- `docs/superpowers/plans/2026-06-26-auth-onboarding-split-layout.md`
  (implementation plan for the design above; skimmed, no new facts beyond the
  design doc)
- `docs/superpowers/specs/2026-06-21-email-template-branding-design.md`
- `docs/superpowers/plans/2026-06-21-email-template-branding.md`
  (implementation plan; added facts folded in above: the shared
  `BaseEmailTemplate` composition and the brand-rose CTA button as a
  documented exception to the neutral-button rule)
- `docs/superpowers/plans/2026-06-27-account-settings-polish.md`
- `docs/superpowers/plans/2026-06-05-instant-language-preview.md`
- `docs/contexts/accounts/CONTEXT.md`
- `packages/backend/convex/accounts/account.ts`
- `packages/backend/convex/accounts/twoFactor.ts`
- `packages/backend/convex/lib/errors.ts`
- `packages/i18n/messages/en.json` (`errors.*` namespace)
- `apps/dashboard/app/(app)/account/layout.tsx`
- `apps/dashboard/app/(app)/account/page.tsx`
- `apps/dashboard/app/change-email/page.tsx`
- `apps/dashboard/app/reset-password/page.tsx`
- `apps/dashboard/app/forgot-password/page.tsx`
- `apps/dashboard/components/account/delete-account-section.tsx`
- `apps/dashboard/components/account/two-factor-section.tsx`
- `apps/dashboard/components/account/change-email-form.tsx`
- `apps/dashboard/components/account/change-password-form.tsx`
- `apps/dashboard/components/account/profile-name-form.tsx`
- `apps/dashboard/components/account/language-section.tsx`
- `apps/dashboard/components/account/avatar-section.tsx`
- `apps/dashboard/components/auth/two-factor-gate.tsx`
- `apps/dashboard/components/auth/two-factor-setup.tsx`
- `apps/dashboard/lib/auth-schemas.ts` (`MIN_PASSWORD_LENGTH`)
- `apps/dashboard/lib/account-schemas.ts`
- `packages/backend/convex/auth.ts` (rate limits, `minPasswordLength`)
- Directory listings of `apps/dashboard/app/(app)/account/`,
  `apps/dashboard/components/account/`, `packages/backend/convex/accounts/`
- `packages/backend/convex/email/client.ts`, `outbox.ts`, `cleanup.ts`,
  `erasure.ts` (confirms current email transport is
  `@christian-ek/sweego`/Sweego, not the design doc's Scaleway TEM; confirms
  `FROM_EMAIL = "blueprnt <hello@blueprnt.se>"`)
