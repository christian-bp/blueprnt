# Design: user-facing forgot-password flow

Date: 2026-06-22
Status: Approved design, pending spec review

## Problem

A user who forgets their password has no way to reset it themselves. The
backend and the landing page already exist: `authClient.requestPasswordReset`
triggers the localized reset email (via the `sendResetPassword` hook in
`packages/backend/convex/auth.ts`), and `app/reset-password/page.tsx` is a
complete page that reads the token and sets a new password. But the only way to
*trigger* a reset today is an admin action (`components/admin/users-section.tsx`
"resend", `create-user-dialog.tsx`). There is no link on the sign-in screen and
no page for a logged-out user to request a reset.

## Goal

A "Forgot your password?" link on the sign-in card that leads to a page where a
logged-out user enters their email and receives the reset email. Reuse the
existing client method, backend hook, email, and reset page unchanged.

## Scope

Frontend only. No backend, email, or `/reset-password` changes. Specifically:
1. A `/forgot-password` page (root-level, unauthenticated).
2. A "Forgot your password?" link on the sign-in form.
3. New `dashboard.auth.forgotPassword.*` i18n keys in all five locales.
4. Tests for the new page and the link.

## Decisions

1. **Separate `/forgot-password` page**, placed at the app root (a sibling of
   `app/reset-password/` and `app/accept-invitation/`), not under the `(app)`
   auth-gated group, so a logged-out user can reach it. This mirrors the
   existing `reset-password` page exactly (same placement, same card pattern,
   same inline form). Rejected: an inline expand/dialog on the sign-in screen
   (more state, diverges from the established per-page pattern).
2. **Enumeration-safe confirmation.** After the request completes, the page
   swaps the form for one neutral message regardless of whether the email has an
   account: it never reveals which addresses are registered. The
   `requestPasswordReset` call is treated as fire-and-forget for UX: the
   confirmation shows on completion whether the call resolved or threw (so
   response/timing does not leak existence, and a rate-limit or unknown-email
   response looks identical to success).
3. **Reuse `redirectTo: "/reset-password"`**, identical to the admin call sites,
   so the email's reset URL lands on the existing reset page. No new routing.

## Architecture / components

- **`apps/dashboard/app/forgot-password/page.tsx`** (new). A client page mirroring
  `reset-password/page.tsx`: the same `<main>` + centered `Logo` + `Card`
  layout, an inline form component, wrapped in `<Suspense>` only if it reads
  search params (it does not, so `<Suspense>` is unnecessary here). State:
  `email` (controlled input), `pending`, `submitted`.
  - On submit: `setPending(true)`, then
    `await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`
    inside try/catch, then `setSubmitted(true)` in a `finally` (so the neutral
    confirmation shows regardless of outcome), `setPending(false)`.
  - When `submitted` is true: render the neutral confirmation text in the card
    instead of the form, plus a "Back to sign in" link to `/`.
  - When not submitted: render the email `Field` + a submit `Button`
    (`disabled={pending}`), and a "Back to sign in" link.
  - Uses `usePageTitle(t("title"))` like the reset page.

- **`apps/dashboard/components/auth/email-password-form.tsx`** (modify). Add a
  "Forgot your password?" link below the password field (the shadcn login-block
  convention), using `next/link` (the dashboard's internal-link convention; the
  dashboard does not use URL locales and there is no `@workspace/i18n/navigation`
  Link export), pointing to `/forgot-password`. Reserve its space so adding it does not shift the button
  (place it inside the existing `FieldGroup` as its own small row).

No new shared component is needed: the forgot-password page inlines its form, as
the reset page does. The `requestPasswordReset` method, the `sendResetPassword`
backend hook, the reset email, and `/reset-password` are all unchanged.

## Data flow

1. Logged-out user on `/` (sign-in) clicks "Forgot your password?" -> `/forgot-password`.
2. Enters email, submits -> `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`.
3. Backend `sendResetPassword` hook fires -> localized reset email with a
   `{SITE_URL}/reset-password?token=…` URL.
4. Page shows the neutral confirmation.
5. User clicks the email link -> existing `/reset-password?token=…` page -> sets
   a new password -> redirected to `/`.

## Error handling

- The request is enumeration-safe: success, unknown email, and rate-limit
  (`/request-password-reset` is capped at 3/min) all yield the same neutral
  confirmation. No inline error is shown for the request itself.
- The `/reset-password` page already handles an invalid/expired/used token (its
  `missingToken` message and `resetPassword` error path). Out of scope here.

## i18n

New keys under `dashboard.auth` in `packages/i18n/messages/en.json` first, then
mirrored to `sv`, `nb`, `da`, `fi` (parity-guarded):

- `dashboard.auth.forgotPasswordLink` = "Forgot your password?" (the sign-in link)
- `dashboard.auth.forgotPassword.title` = "Reset your password"
- `dashboard.auth.forgotPassword.description` = "Enter your account email and we'll send you a link to choose a new password."
- `dashboard.auth.forgotPassword.cta` = "Send reset link"
- `dashboard.auth.forgotPassword.confirmation` = "If an account exists for that email, a reset link is on its way. Check your inbox."
- `dashboard.auth.forgotPassword.backToSignIn` = "Back to sign in"

The email field reuses the existing `dashboard.auth.email` label. No em dashes
in any copy. sv/nb/da/fi strings are drafts flagged for native review.

## Testing

- **`apps/dashboard/app/forgot-password/forgot-password.test.tsx`** (new),
  mirroring `reset-password.test.tsx`'s setup: renders the page; submitting with
  an email calls `authClient.requestPasswordReset` with that email and
  `redirectTo: "/reset-password"` (mock the client); after submit the neutral
  confirmation renders and the form is gone; the confirmation also renders even
  when the mocked `requestPasswordReset` rejects (enumeration-safe).
- **Sign-in link**: extend the existing sign-in/email-password-form test (or add
  one) to assert the "Forgot your password?" link is present and points to
  `/forgot-password`.

## Out of scope / non-goals

- No backend, `auth.ts`, email-template, or `/reset-password` changes.
- No rate-limit changes (the existing 3/min stands).
- No self-serve signup (`disableSignUp: true` is unchanged; reset is independent).
- No per-user locale work.
