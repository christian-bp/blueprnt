# Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service `/account` area (tabbed sub-routes Profile + Security) where a signed-in user edits their name, email, and display language, changes their password, manages two-factor (change method, regenerate backup codes), and deletes their account.

**Architecture:** New `app/(app)/account/` route group behind the existing auth/2FA/onboarding gates, with `/account` redirecting to `/account/profile` and a tab bar linking the two sub-routes. Each section is its own client component under `components/account/`, composed onto the two pages. Per-user account state (name/email/2FA) writes NO org audit rows (same carve-out as the existing per-user 2FA state); deletion reuses the existing GDPR erasure cascade + platform audit + actorName tombstone. Email change uses Better Auth 1.6.17's built-in `changeEmail` double opt-in; "change 2FA method" reuses the existing `TwoFactorGate` + `TwoFactorSetup` by clearing the app's `mfaConfirmedAt` marker.

**Tech Stack:** Convex + Better Auth 1.6.17 (`@convex-dev/better-auth`), Next.js 16 App Router, React 19, next-intl, Tailwind v4 + shadcn, react-hook-form + Zod, motion/react, Vitest 4 + convex-test, Bun, Turborepo.

**Spec:** `docs/superpowers/specs/2026-06-27-account-settings-design.md`.

## Global Constraints

- No em dashes (" — ") anywhere we write (UI copy, comments, commit messages). Use period/comma/colon/parentheses.
- All user-facing text via next-intl i18n. Add keys to `packages/i18n/messages/en.json` FIRST, then mirror to `sv.json`, `nb.json`, `da.json`, `fi.json`. Write non-ASCII characters with the Edit/Write tools, never shell `sed`/`perl` (double-encodes). The i18n parity test fails if any locale's key set differs from en.
- Machine-translated Nordic strings are drafts: flag every new one for native review in `docs/go-live-checklist.md` (final task).
- Forms: `useForm({ resolver: zodResolver(makeXSchema(t)), mode: "onTouched" })`, shadcn `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`, `SubmitButton`. Schema factories `makeXSchema(t)` build messages from `t = useTranslations("dashboard.validation")`. Pre-filled edit forms gate the submit on `!isValid || !isDirty` (read `isDirty` so RHF tracks it). Inline error alerts (`role="alert"`) render BELOW the submit button.
- No org audit rows for name/email/password/2FA/language changes (per-user account state, not org domain). Deletion keeps the existing platform-audit + tombstone path.
- New code ships with tests in the SAME commit. Run with `bun run test` (never `bun test`). The pre-commit hook runs Biome + full typecheck + `turbo run test`; all must pass. Never `--no-verify`.
- Internal navigation uses `next/link` `Link` (or `@workspace/i18n/navigation`). Pages are `"use client"` and set their title via `usePageTitle(...)`.
- Reduced motion is respected globally; read `docs/ui-animation.md` before adding any animation. Reuse `SubmitButton`, `CopyButton`, `AsyncActionButton`, `OtpField`, `PasswordInput`, `isPasswordPwned`, `TwoFactorSetup`.
- Better Auth 1.6.17 facts (verified from installed source): `authClient.updateUser({ name })`; `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })`; `authClient.changeEmail({ newEmail, callbackURL })` (verified user => double opt-in: confirm link to CURRENT email, then verify link to NEW email; requires top-level `emailVerification.sendVerificationEmail` configured, and `user.changeEmail.sendChangeEmailConfirmation`); `authClient.twoFactor.generateBackupCodes({ password }) => { backupCodes }`; `authClient.twoFactor.enable({ password })` is a destructive re-mint. Breached-password rejection surfaces code `PASSWORD_COMPROMISED`.
- Convex: per-user functions use `authedQuery`/`authedMutation` from `convex/lib/functions.ts` (inject `ctx.authUserId`). Errors via `appError(ERROR_CODES.x)`; the frontend translates `errors.*`.

---

### Task 1: Backend — `getMyAccount` query + `clearMfaConfirmed` mutation

**Files:**
- Create: `packages/backend/convex/accounts/account.ts`
- Test: `packages/backend/convex/accounts/account.test.ts`
- Reference (do not edit): `packages/backend/convex/accounts/twoFactor.ts` (the `getMyMfaStatus`/`confirmMfaSetup` shape, `authedMutation`, error codes), `packages/backend/convex/accounts/tables.ts` (the `users` table fields), `packages/backend/convex/accounts/organization.ts` (`getLanguageForUser` uses `components.betterAuth.membership.listMembershipsForUser`).

**Interfaces:**
- Produces:
  - `api.accounts.account.getMyAccount` query, args `{}`, returns `null | { name: string; email: string; locale: string | null; mfaMethod: "totp" | "email" | null; lastAdminOrgs: { orgId: string; name: string }[] }`. `lastAdminOrgs` lists organizations where the caller is the ONLY member with role `"admin"` (drives the delete-account guard UI). Returns `null` when unauthenticated (plain query, like `getMyMfaStatus`, so a token-refresh blip does not throw).
  - `api.accounts.account.clearMfaConfirmed` mutation (`authedMutation`), args `{}`, returns `null`. Sets the caller's `users.mfaConfirmedAt` to `undefined` (re-stamped by the existing `confirmMfaSetup`). Used by "change 2FA method".

**Notes for the implementer:**
- `name`/`email` live in the `users` mirror (kept in sync from Better Auth). Read the mirror row by `by_auth_id`.
- For `lastAdminOrgs`: get the caller's memberships (use `components.betterAuth.membership.listMembershipsForUser`, already used in `organization.ts`); for each membership whose `role === "admin"`, count the admins in that org. If the caller is the sole admin, include it. You will need a members-by-org listing from the betterAuth component (look for an existing `listMembersForOrg`/equivalent in `convex/betterAuth/*`; if none exists, add a small `internalQuery` there that lists `member` rows by `organizationId`). Resolve each org's display name from the betterAuth `organization` table (add a tiny component query if needed). Keep these helpers in the betterAuth component dir, mirroring `eraseUser`/`hasTwoFactorEnabled`.

- [ ] **Step 1: Write the failing tests** in `account.test.ts` (convex-test, edge-runtime). Cover: (a) `getMyAccount` returns the mirror's name/email/locale/mfaMethod for an authed user; (b) `lastAdminOrgs` includes an org where the user is the only admin and excludes one with a second admin; (c) `clearMfaConfirmed` sets `mfaConfirmedAt` to undefined. Follow the convex-test setup used in the sibling backend tests (seed a user + membership rows). Assert with `expect(...).toBe/toEqual`.

- [ ] **Step 2: Run the tests, confirm they fail** (functions not defined).
Run: `bun run --filter @workspace/backend test -- account`
Expected: FAIL (cannot find `getMyAccount`/`clearMfaConfirmed`).

- [ ] **Step 3: Implement `account.ts`.** `getMyAccount` as a plain `query` (returns null when `getUserIdentity()` is null); `clearMfaConfirmed` as `authedMutation` patching `mfaConfirmedAt: undefined`. Add any needed betterAuth-component member/org-name queries.

- [ ] **Step 4: Run the tests, confirm they pass.**
Run: `bun run --filter @workspace/backend test -- account`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add packages/backend/convex/accounts/account.ts packages/backend/convex/accounts/account.test.ts packages/backend/convex/betterAuth/
git commit -m "feat(accounts): add getMyAccount query and clearMfaConfirmed mutation"
```

---

### Task 2: Backend — self-service account deletion

**Files:**
- Modify: `packages/backend/convex/lib/errors.ts` (add `lastAdmin: "errors.lastAdmin"` to `ERROR_CODES`)
- Modify: `packages/backend/convex/accounts/account.ts` (add the action + internal mutation)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `errors.lastAdmin`)
- Test: `packages/backend/convex/accounts/account.test.ts` (extend)
- Reference: `packages/backend/convex/platform/admin.ts` lines 643–704 (`deleteUser`, `ERASED_ACTOR_NAME`, the exact erasure sequence), `packages/backend/convex/betterAuth/provisioning.ts` (`eraseUser`), `packages/backend/convex/email/erasure.ts`, `packages/backend/convex/lib/audit.ts` (`logPlatformAudit`, `PLATFORM_AUDIT_EVENTS.userDeleted`).

**Interfaces:**
- Produces: `api.accounts.account.deleteMyAccount` action, args `{ password: string }`, returns `null`. Verifies the password, then erases the caller. Throws `appError(ERROR_CODES.lastAdmin)` if the caller is the sole admin of any org; throws an invalid-credentials/`invalidInput` error if the password is wrong.

**Re-auth (the one integration unknown — resolve in Step 3a before the cascade):**
- Primary approach: a Convex **action** that verifies the password through Better Auth's server API, e.g. `await createAuth(ctx).api.verifyPassword({ body: { password }, headers })` where `headers` are obtained from the `@convex-dev/better-auth` component (read its source for the header/session helper, e.g. `authComponent.getHeaders(ctx)` or the documented server-API pattern). On `INVALID_PASSWORD` it throws; map that to an error shown inline.
- Documented fallback if `auth.api.verifyPassword` is not callable in this Convex setup: enable Better Auth `user.deleteUser` and call `authClient.deleteUser({ password })` from the client (Better Auth verifies the password in its HTTP route), with a `user.deleteUser.beforeDelete` hook running the app-side cleanup (member/invitation cleanup is BA's; do the `users` mirror delete + audit tombstone + email purge + last-admin guard there). If you take the fallback, the client call replaces the action, and the internal mutation moves into `beforeDelete`. Note the change in the commit message.
- After the password check, run an internal mutation `eraseSelf` that mirrors `platform/admin.ts deleteUser` exactly for `ctx.authUserId`: last-admin guard FIRST (re-validate, do not trust the client), then `components.betterAuth.provisioning.eraseUser`, schedule `internal.email.erasure.purgeRecipientEmails`, delete the `users` mirror, tombstone `auditLog`/`platformAuditLog` `actorName` to `"deleted user"`, and `logPlatformAudit({ type: PLATFORM_AUDIT_EVENTS.userDeleted, ... })`.

- [ ] **Step 1: Write the failing tests.** (a) `eraseSelf`/`deleteMyAccount` with a valid password removes the user's member/account/session rows (via eraseUser), deletes the `users` mirror, tombstones their audit `actorName`, and schedules the email purge. (b) When the caller is the sole admin of an org, it throws `lastAdmin` and erases nothing. (c) A wrong password throws and erases nothing. Test the internal mutation directly for the cascade/guard; test the password gate at whatever boundary the chosen approach exposes (mock/stub the BA verify if needed, documenting why).

- [ ] **Step 2: Run, confirm fail.** `bun run --filter @workspace/backend test -- account` => FAIL.

- [ ] **Step 3a: Resolve the password-verify mechanism** (primary vs fallback above). Write the smallest code that makes the password gate test pass first.

- [ ] **Step 3b: Implement `eraseSelf` + `deleteMyAccount`** and add `ERROR_CODES.lastAdmin` + `errors.lastAdmin` in all five locales (en: "You're the last administrator of an organization. Contact support to delete your account."; mirror to sv/nb/da/fi as drafts).

- [ ] **Step 4: Run, confirm pass.** `bun run --filter @workspace/backend test -- account` and `bun run --filter @workspace/i18n test` => PASS.

- [ ] **Step 5: Commit.**
```bash
git add packages/backend/convex/accounts/account.ts packages/backend/convex/accounts/account.test.ts packages/backend/convex/lib/errors.ts packages/i18n/messages/*.json
git commit -m "feat(accounts): add self-service account deletion with last-admin guard"
```

---

### Task 3: Backend — Better Auth change-email config + email templates

**Files:**
- Modify: `packages/backend/convex/auth.ts` (add `user.changeEmail` + top-level `emailVerification.sendVerificationEmail`)
- Modify: `packages/constants/src/email.ts` (`EMAIL_TEMPLATE_KEYS`: add `"changeEmailConfirm"`, `"verifyEmail"`)
- Modify: `packages/email/src/render.ts` (`EmailProps` + `renderEmail` cases)
- Create: `packages/email/src/templates/change-email-confirm.tsx`, `packages/email/src/templates/verify-email.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `email.changeEmailConfirm.*` and `email.verifyEmail.*`)
- Test: extend `packages/email`'s render test (if present) or add one asserting both templates render subject/html/text; rely on the i18n parity test for key coverage.
- Reference: `packages/email/src/templates/reset-password.tsx` + `welcome.tsx` (template shape), `packages/email/src/render.ts` (registration), `packages/email/src/messages.ts` (`emailMessages(locale)`), `auth.ts` `sendResetPassword`/`sendInvitationEmail` (the `enqueueEmail` + locale-resolution pattern via `getLanguageForUser`).

**Interfaces:**
- Produces: a working `authClient.changeEmail({ newEmail, callbackURL })` flow. Hop 1 sends `changeEmailConfirm` to the current email (the `url` Better Auth passes to `sendChangeEmailConfirmation`); hop 2 sends `verifyEmail` to the new email (the `url` passed to `emailVerification.sendVerificationEmail`).

**Notes:**
- `user.changeEmail`: `{ enabled: true, sendChangeEmailConfirmation: async ({ user, newEmail, url }) => enqueueEmail(to: user.email, templateKey: "changeEmailConfirm", props: { url, newEmail }, locale) }`.
- Top-level `emailVerification: { sendVerificationEmail: async ({ user, url }) => enqueueEmail(to: user.email, templateKey: "verifyEmail", props: { url }, locale) }` (Better Auth calls this with `user.email = newEmail` during hop 2, so it goes to the new address). Resolve `locale` with `getLanguageForUser` exactly as the other senders do.
- Templates mirror `WelcomeEmail`: a `BaseEmailTemplate` + `Text` + `CtaButton href={url}`, strings from `emailMessages(locale).changeEmailConfirm` / `.verifyEmail`. `changeEmailConfirm` shows the `newEmail` in the body (use `fillTemplate`).

- [ ] **Step 1: Write the failing test** asserting `renderEmail("changeEmailConfirm", { url, newEmail, locale: "en" })` and `renderEmail("verifyEmail", { url, locale: "en" })` return non-empty `subject`/`html`/`text`.

- [ ] **Step 2: Run, confirm fail.** `bun run --filter @workspace/email test` => FAIL.

- [ ] **Step 3: Implement** the two templates, register them in `EMAIL_TEMPLATE_KEYS`/`EmailProps`/`renderEmail`, add the auth.ts config, and add `email.changeEmailConfirm.*` + `email.verifyEmail.*` (subject/heading/body/cta/note) to all five locales.

- [ ] **Step 4: Run, confirm pass.** `bun run --filter @workspace/email test`, `bun run --filter @workspace/i18n test`, `bun run --filter @workspace/backend test` => PASS.

- [ ] **Step 5: Commit.**
```bash
git add packages/backend/convex/auth.ts packages/constants/src/email.ts packages/email/src/ packages/i18n/messages/*.json
git commit -m "feat(auth): enable change-email double opt-in with localized templates"
```

---

### Task 4: Frontend — account form schemas

**Files:**
- Create: `apps/dashboard/lib/account-schemas.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add any new `dashboard.validation.*` keys used below; reuse existing `required`/`invalidEmail`/`minLength`/`passwordsMatch`)
- Test: none standalone (exercised by the form component tests). Type-only file.
- Reference: `apps/dashboard/lib/auth-schemas.ts` (factory style + `MIN_PASSWORD_LENGTH` + the `passwordsMatch` refine), `apps/dashboard/lib/validation.ts` (`ValidationT`).

**Interfaces — Produces (consumed by Tasks 5/6/8):**
```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-schemas"

export function makeProfileNameSchema(t: ValidationT) {
  return z.object({ name: z.string().trim().min(1, t("required")) })
}
export type ProfileNameValues = z.infer<ReturnType<typeof makeProfileNameSchema>>

export function makeChangeEmailSchema(t: ValidationT, currentEmail: string) {
  return z.object({
    email: z
      .string()
      .trim()
      .email(t("invalidEmail"))
      .refine((v) => v.toLowerCase() !== currentEmail.toLowerCase(), {
        message: t("emailUnchanged"),
      }),
  })
}
export type ChangeEmailValues = z.infer<ReturnType<typeof makeChangeEmailSchema>>

export function makeChangePasswordSchema(t: ValidationT) {
  return z
    .object({
      currentPassword: z.string().min(1, t("required")),
      newPassword: z
        .string()
        .min(MIN_PASSWORD_LENGTH, t("minLength", { min: MIN_PASSWORD_LENGTH })),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t("passwordsMatch"),
      path: ["confirmPassword"],
    })
}
export type ChangePasswordValues = z.infer<
  ReturnType<typeof makeChangePasswordSchema>
>
```

- [ ] **Step 1: Add `dashboard.validation.emailUnchanged`** ("Enter a different email address.") to en + 4 locales.
- [ ] **Step 2: Create `account-schemas.ts`** with the three factories above.
- [ ] **Step 3: Typecheck + i18n parity.** Run: `bun run --filter dashboard typecheck` and `bun run --filter @workspace/i18n test` => PASS.
- [ ] **Step 4: Commit.**
```bash
git add apps/dashboard/lib/account-schemas.ts packages/i18n/messages/*.json
git commit -m "feat(account): add account form schema factories"
```

---

### Task 5: Frontend — `ProfileNameForm`

**Files:**
- Create: `apps/dashboard/components/account/profile-name-form.tsx`
- Create: `apps/dashboard/components/account/profile-name-form.test.tsx`
- Modify: i18n (`dashboard.account.profile.*`)
- Reference: `app/reset-password/page.tsx` (Form + FormField + SubmitButton + error placement), `components/auth/two-factor-setup.tsx` (`authClient.useSession()`), `app/reset-password/reset-password.test.tsx` (test scaffolding: `NextIntlClientProvider`, `vi.mock("@/lib/auth-client")`).

**Interfaces:**
- Consumes: `authClient.useSession()` (initial name), `authClient.updateUser({ name })`.
- Produces: `ProfileNameForm` (no props).

**Behavior:** Pre-filled with the session name. RHF + `makeProfileNameSchema`. Submit disabled until `isValid && isDirty` (`disabled={!form.formState.isValid || !form.formState.isDirty}`). On submit `await authClient.updateUser({ name })`; on error show an inline alert below the button; on success reset the form's dirty baseline (`form.reset({ name })`). i18n: `dashboard.account.profile.nameLabel`, `.saveName`, `.nameSaved` (optional toast/inline), `.error`.

- [ ] **Step 1: Write the failing test** — renders the current name; Save disabled until the name changes; changing + submitting calls `updateUser({ name: "New Name" })`; an error result shows the error alert. Mock `@/lib/auth-client` (`useSession` returning `{ data: { user: { name, email } } }`, `updateUser` a `vi.fn`).
- [ ] **Step 2: Run, confirm fail.** `bun run --filter dashboard test -- profile-name-form` => FAIL.
- [ ] **Step 3: Implement** the component + add i18n keys (5 locales).
- [ ] **Step 4: Run, confirm pass.** `bun run --filter dashboard test -- profile-name-form`; `bun run --filter @workspace/i18n test` => PASS.
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/profile-name-form.tsx apps/dashboard/components/account/profile-name-form.test.tsx packages/i18n/messages/*.json
git commit -m "feat(account): add profile name edit form"
```

---

### Task 6: Frontend — `ChangeEmailForm` + verification landing page

**Files:**
- Create: `apps/dashboard/components/account/change-email-form.tsx` (+ test)
- Create: `apps/dashboard/app/(app)/account/email-verified/page.tsx` (the `callbackURL` landing; success + generic states, `"use client"`, `usePageTitle`)
- Modify: i18n (`dashboard.account.email.*`)
- Reference: `app/reset-password/page.tsx` (states + Suspense for any `useSearchParams`), `change-email` BA facts in Global Constraints.

**Interfaces:**
- Consumes: `authClient.useSession()` (current email), `authClient.changeEmail({ newEmail, callbackURL })`.
- Produces: `ChangeEmailForm` (no props).

**Behavior:** Shows current email (read-only). Form (just `email`, `makeChangeEmailSchema(t, currentEmail)`, gated on `isValid` — a create-style action, not isDirty). On submit `await authClient.changeEmail({ newEmail: values.email, callbackURL: "/account/email-verified" })`; on success show a persistent confirmation state ("Check your current inbox to confirm, then your new inbox to verify"); on error an inline alert. The `email-verified` page shows `dashboard.account.email.verifiedTitle/Body` and a Link back to `/account/profile`; if BA appended an error param, show a generic "link invalid or expired" message. Include inline help (`HelpMorphButton`) explaining the two-email flow.

- [ ] **Step 1: Write the failing test** — current email rendered; submitting a new valid email calls `changeEmail({ newEmail, callbackURL: "/account/email-verified" })` and shows the confirmation copy; the same email as current is blocked by validation (no call). Mock `@/lib/auth-client`.
- [ ] **Step 2: Run, confirm fail.** `bun run --filter dashboard test -- change-email-form` => FAIL.
- [ ] **Step 3: Implement** the form + landing page + i18n (5 locales) + help text (`dashboard.help.changeEmailLabel/Body` in 5 locales).
- [ ] **Step 4: Run, confirm pass.** test + i18n parity => PASS.
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/change-email-form.tsx apps/dashboard/components/account/change-email-form.test.tsx "apps/dashboard/app/(app)/account/email-verified/page.tsx" packages/i18n/messages/*.json
git commit -m "feat(account): add change-email form and verification landing"
```

---

### Task 7: Frontend — `LanguageSection`

**Files:**
- Create: `apps/dashboard/components/account/language-section.tsx` (+ test)
- Modify: i18n (`dashboard.account.profile.languageLabel`, `.languageHelp`)
- Reference: `components/language-menu.tsx` (the `setUiLocale` mutation + `useSetPreviewLocale` + `FLAG_BY_LOCALE`/`LANGUAGE_LABEL_KEYS`/`routing.locales`).

**Interfaces:**
- Consumes: `useMutation(api.accounts.onboarding.setUiLocale)`, `useSetPreviewLocale()`, `useLocale()`.
- Produces: `LanguageSection` (no props).

**Behavior:** Same optimistic logic as `LanguageMenuSub`, but rendered INLINE for a settings page (a shadcn `Select` or a radio list of `routing.locales` with flag + autonym), not a dropdown submenu. Selecting a locale calls `setPreviewLocale(value)` then `await setUiLocale({ locale: value })` (rollback preview on error). No submit button (changes apply on select).

- [ ] **Step 1: Write the failing test** — renders the locales; selecting one calls `setUiLocale({ locale })`. Mock `convex/react` `useMutation` and the locale-provider hook.
- [ ] **Step 2: Run, confirm fail.** `bun run --filter dashboard test -- language-section` => FAIL.
- [ ] **Step 3: Implement** + i18n (5 locales).
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/language-section.tsx apps/dashboard/components/account/language-section.test.tsx packages/i18n/messages/*.json
git commit -m "feat(account): add inline display-language section"
```

---

### Task 8: Frontend — `ChangePasswordForm`

**Files:**
- Create: `apps/dashboard/components/account/change-password-form.tsx` (+ test)
- Modify: i18n (`dashboard.account.security.password.*`)
- Reference: `app/reset-password/page.tsx` (HIBP pre-check, `isPasswordCompromised`, confirm field, error states), `lib/pwned-password.ts`, `components/password-input.tsx`.

**Interfaces:**
- Consumes: `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`, `isPasswordPwned`.
- Produces: `ChangePasswordForm` (no props).

**Behavior:** Three `PasswordInput` fields (current/new/confirm), `makeChangePasswordSchema`. Gated on `isValid`. On submit: `if (await isPasswordPwned(newPassword)) -> show compromised`; else `changePassword({...})`; map `PASSWORD_COMPROMISED` -> compromised, a wrong-current-password error code -> a specific "current password is incorrect" message, else generic. Errors below the button. On success, reset the form and show a brief confirmation.

- [ ] **Step 1: Write the failing test** — too-short new password blocked (no call); mismatch blocked; valid submit calls `changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`; breached pre-check (mock `isPasswordPwned -> true`) shows compromised and does not call; a wrong-password error result shows the wrong-current-password message. Mock `@/lib/auth-client` + `@/lib/pwned-password` (as the reset-password test does).
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** + i18n (5 locales: `currentLabel`, `newLabel`, `confirmLabel`, `cta`, `saved`, `error`, `wrongPassword`, `compromised`).
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/change-password-form.tsx apps/dashboard/components/account/change-password-form.test.tsx packages/i18n/messages/*.json
git commit -m "feat(account): add change-password form with breach pre-check"
```

---

### Task 9: Frontend — `TwoFactorSection` (method + backup codes)

**Files:**
- Create: `apps/dashboard/components/account/two-factor-section.tsx` (+ test)
- Modify: i18n (`dashboard.account.security.twoFactor.*`)
- Reference: `components/auth/two-factor-setup.tsx` (the backup-codes panel markup + `CopyButton` + ack checkbox; `enable`/`generateBackupCodes` usage), `components/auth/two-factor-gate.tsx` (the gate that takes over when `mfaConfirmedAt` is null), `components/password-input.tsx`, `api.accounts.account.getMyAccount`/`clearMfaConfirmed`.

**Interfaces:**
- Consumes: `useQuery(api.accounts.account.getMyAccount)` (current `mfaMethod`), `useMutation(api.accounts.account.clearMfaConfirmed)`, `authClient.twoFactor.generateBackupCodes({ password })`.
- Produces: `TwoFactorSection` (no props).

**Behavior:**
- Shows the current method label ("Authenticator app" / "Email") from `getMyAccount.mfaMethod`, with a `HelpMorphButton` (reuse `dashboard.help.twoFactorLabel/Body`).
- **Change method:** a button opening an `AlertDialog` ("This restarts two-step setup. Your current method keeps working until you finish."). On confirm: `await clearMfaConfirmed()`. This nulls `mfaConfirmedAt`; the always-mounted `TwoFactorGate` detects `needsSetup` and takes over the screen with the real `TwoFactorSetup` wizard (choose method -> password -> enable -> verify -> `confirmMfaSetup` re-stamps). No new wizard code. (Confirm in the test that clicking confirm calls `clearMfaConfirmed`.)
- **Regenerate backup codes:** a password-gated control (a small inline form or dialog with one `PasswordInput`) -> `await authClient.twoFactor.generateBackupCodes({ password })` -> render the returned codes in the SAME panel markup as setup (grid + `CopyButton` + "I've saved them" ack). Errors (wrong password) inline below the button.

- [ ] **Step 1: Write the failing test** — shows the current method from a mocked `getMyAccount`; confirming "change method" calls `clearMfaConfirmed`; submitting the regenerate password calls `generateBackupCodes({ password })` and renders the returned codes. Mock `convex/react` (`useQuery`/`useMutation`) + `@/lib/auth-client`.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** + i18n (5 locales: `currentMethod`, `methodTotp`, `methodEmail`, `changeMethod`, `changeMethodConfirmTitle`, `changeMethodConfirmBody`, `regenerate`, `regeneratePasswordLabel`, `regenerateCta`, `wrongPassword`; reuse `dashboard.twoFactorSetup.backup.*` for the codes panel).
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/two-factor-section.tsx apps/dashboard/components/account/two-factor-section.test.tsx packages/i18n/messages/*.json
git commit -m "feat(account): add two-factor management section"
```

---

### Task 10: Frontend — `DeleteAccountSection`

**Files:**
- Create: `apps/dashboard/components/account/delete-account-section.tsx` (+ test)
- Modify: i18n (`dashboard.account.security.delete.*`)
- Reference: any existing type-to-confirm delete (CLAUDE.md cites a delete-user gate; search `components/` for the pattern), `components/password-input.tsx`, `api.accounts.account.getMyAccount`/`deleteMyAccount`, `authClient.signOut`.

**Interfaces:**
- Consumes: `useQuery(api.accounts.account.getMyAccount)` (`lastAdminOrgs`, `email`), `useAction(api.accounts.account.deleteMyAccount)` (or the fallback client call from Task 2), `authClient.signOut`.
- Produces: `DeleteAccountSection` (no props).

**Behavior:** A destructive "Danger zone" card.
- If `getMyAccount.lastAdminOrgs.length > 0`: render the support note (`dashboard.account.security.delete.lastAdmin`, listing the org names) and NO delete control.
- Else: a type-to-confirm gate (type the email) + a `PasswordInput`, both required to enable the destructive button (`variant="destructive"`). On submit: `await deleteMyAccount({ password })`; map `lastAdmin` (race re-check) to the support note, wrong password to an inline error; on success `await authClient.signOut(); router.push("/")`.

- [ ] **Step 1: Write the failing test** — with `lastAdminOrgs` non-empty, shows the support note and no delete button; otherwise the button is disabled until the email matches and password is filled, and submitting calls `deleteMyAccount({ password })` then `signOut`. Mock `convex/react` + `@/lib/auth-client` + `next/navigation`.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** + i18n (5 locales: `title`, `body`, `confirmLabel` (type your email), `passwordLabel`, `cta`, `lastAdmin`, `wrongPassword`, `error`).
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit.**
```bash
git add apps/dashboard/components/account/delete-account-section.tsx apps/dashboard/components/account/delete-account-section.test.tsx packages/i18n/messages/*.json
git commit -m "feat(account): add delete-account danger zone"
```

---

### Task 11: Frontend — route group, tabs layout, pages, nav entries

**Files:**
- Create: `apps/dashboard/app/(app)/account/layout.tsx` (tab bar), `account/page.tsx` (redirect to `/account/profile`), `account/profile/page.tsx`, `account/security/page.tsx`
- Create: `apps/dashboard/components/account/account-tabs.tsx` (+ test) — the tab bar (Link list, active from `usePathname`)
- Modify: `apps/dashboard/components/nav-user.tsx` (add an "Account settings" `DropdownMenuItem` linking `/account`, above the sign-out separator, with a `UserCircle`/settings icon)
- Modify: `apps/dashboard/components/account-menu.tsx` (add the same link; migrate the `onboarding.accountMenu` aria-label key to `dashboard.accountMenu`)
- Modify: i18n (`dashboard.account.title`, `dashboard.account.tabs.profile`, `dashboard.account.tabs.security`, `dashboard.nav.accountSettings`, move `onboarding.accountMenu` -> `accountMenu`)
- Reference: `app/(app)/model/page.tsx` + `model/weighting` (the ModelTabs header pattern for sub-route tabs), `app/(app)/layout.tsx`, `components/nav-user.tsx`, `components/account-menu.tsx`.

**Behavior:**
- `account/layout.tsx`: renders `dashboard.account.title`, `<AccountTabs />`, then `children`. `AccountTabs` links `/account/profile` + `/account/security`, marking the active one from `usePathname()` (mirror the existing ModelTabs active-state approach; no layout shift).
- `account/page.tsx`: `redirect("/account/profile")`.
- `profile/page.tsx`: `usePageTitle`, composes `<ProfileNameForm/>`, `<ChangeEmailForm/>`, `<LanguageSection/>` (cards/sections).
- `security/page.tsx`: composes `<ChangePasswordForm/>`, `<TwoFactorSection/>`, `<DeleteAccountSection/>`.
- Nav: both menus get an "Account settings" item linking `/account` (use `Link`).

- [ ] **Step 1: Write the failing test** for `account-tabs.tsx` — renders both tab links with correct hrefs and marks the active one (mock `usePathname` to `/account/security`). Optionally a NavUser test asserting the new link is present.
- [ ] **Step 2: Run, confirm fail.** `bun run --filter dashboard test -- account-tabs` => FAIL.
- [ ] **Step 3: Implement** the layout/pages/tabs/nav edits + key migration + i18n (5 locales). Verify `onboarding.accountMenu` references are updated everywhere (`account-menu.tsx`) and the old key is removed (no-legacy).
- [ ] **Step 4: Run, confirm pass.** `bun run --filter dashboard test`; `bun run --filter @workspace/i18n test` => PASS. Manually note: `/account` redirects to profile; tabs switch routes.
- [ ] **Step 5: Commit.**
```bash
git add "apps/dashboard/app/(app)/account/" apps/dashboard/components/account/account-tabs.tsx apps/dashboard/components/account/account-tabs.test.tsx apps/dashboard/components/nav-user.tsx apps/dashboard/components/account-menu.tsx packages/i18n/messages/*.json
git commit -m "feat(account): wire account settings route, tabs, and nav entries"
```

---

### Task 12: Docs — go-live native-review flags

**Files:**
- Modify: `docs/go-live-checklist.md`

- [ ] **Step 1: Append** an entry listing every new Nordic (sv/nb/da/fi) string added in Tasks 2–11 (the `dashboard.account.*`, `errors.lastAdmin`, `email.changeEmailConfirm.*`, `email.verifyEmail.*`, `dashboard.help.changeEmail*`, `dashboard.accountMenu` keys) as machine-translated drafts pending native review before go-live.
- [ ] **Step 2: Commit.**
```bash
git add docs/go-live-checklist.md
git commit -m "docs: flag account-settings Nordic strings for native review"
```

---

## Self-Review

**Spec coverage:** Profile name (T5), email change incl. double-opt-in templates + landing (T3, T6), display language (T7), change password (T8), 2FA change-method + regen codes (T9, T1's `clearMfaConfirmed`), delete account + last-admin guard + cascade (T1's `lastAdminOrgs`, T2), `/account` tabbed sub-routes + nav entries + account-menu key migration (T11), audit/PII stance (no org audit rows; deletion tombstone — T2), i18n in 5 locales + parity (every UI task) + native-review flags (T12). All spec sections map to a task.

**Placeholder scan:** The two genuine integration unknowns (server-side password verify in T2; betterAuth member/org-name component queries in T1) are isolated with a concrete primary approach, a documented fallback, and a test that proves the behavior — not "figure it out later". UI tasks cite exact reference files (quoted in the design research) for established boilerplate rather than reproducing 300-line components.

**Type consistency:** `getMyAccount` returns `{ name, email, locale, mfaMethod, lastAdminOrgs }` (T1) and is consumed with those names in T9/T10. `clearMfaConfirmed`/`deleteMyAccount` signatures match between producer (T1/T2) and consumers (T9/T10). Schema factory names (`makeProfileNameSchema`, `makeChangeEmailSchema`, `makeChangePasswordSchema`) are defined in T4 and used by name in T5/T6/T8. Email template keys (`changeEmailConfirm`, `verifyEmail`) are consistent between T3's constants, render cases, and auth config.
