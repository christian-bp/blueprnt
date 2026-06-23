# Design: platform create-user sends a welcome email and requires an organization

Date: 2026-06-23
Status: Approved design, pending spec review

## Problem

Two faults in the platform-admin "create user" flow:

1. **Wrong email.** `create-user-dialog.tsx` calls `createUser` (which provisions
   a passwordless Better Auth user) then `authClient.requestPasswordReset(...)`.
   That fires the `sendResetPassword` hook, which always sends the
   **`resetPassword`** template ("Reset your password / We received a request to
   reset the password for your blueprnt account"). For a brand-new user who has
   never set a password, that wording is wrong. The reset link itself is fine
   (the `/reset-password` page doubles as "set your password"); only the email
   is mis-framed.
2. **Orgless users.** `createUser({ name, email })` only provisions the user; it
   never adds a membership, and the dialog has no organization field. So a user
   can be created with zero org memberships.

## Goal

- A newly-created (passwordless) user receives a **welcome / set-password**
  email; a user who already has a password who requests a reset still gets the
  **reset** email.
- Creating a user **requires** selecting an organization (and a role); no orgless
  users can be created.
- Transactional email is sent from a **named, replyable** address:
  `blueprnt <hello@blueprnt.se>`, replacing the unnamed `no-reply@blueprnt.se`.

## Decisions

1. **Welcome template, chosen by account state.** Add a new `welcome` email
   template. The `sendResetPassword` hook branches: if the target user has **no
   password yet** (no credential `account` row), send `welcome`; otherwise send
   `resetPassword` (unchanged). This automatically fixes both the create-user
   flow and the admin "resend" button (re-inviting an unactivated user sends the
   welcome), while the forgot-password flow we shipped keeps sending the reset
   email. The single `requestPasswordReset` trigger and the `/reset-password`
   landing page are unchanged.
2. **Org-agnostic welcome copy.** The welcome email does not name the
   organization ("An account was created for you on blueprnt. Set your password
   below to get started."). This avoids an awkward empty-org rendering and keeps
   the send hook from resolving the org name. Naming the org is a possible
   later enhancement.
3. **Require an org and a role at creation, atomically.** `createUser` takes
   `{ name, email, orgId, role }` and, after provisioning the user, adds the
   membership in the **same mutation**, so an orgless user is never created. The
   dialog gains a required organization picker (from the existing
   `listOrganizations`) and a role picker (admin/editor, default editor).
4. **Named, replyable sender.** Send from `blueprnt <hello@blueprnt.se>` instead
   of `no-reply@blueprnt.se`. Sweego's `parseEmailAddress` already parses the
   `Name <addr>` form and preserves the display name. The `hello@` mailbox must
   be a real, monitored inbox (so replies are received); the `blueprnt.se`
   domain is already verified at Sweego, so sending as `hello@` needs no new
   verification.

## Architecture

### Email (backend)

- **`packages/constants/src/email.ts`**: add `"welcome"` to `EMAIL_TEMPLATE_KEYS`
  -> `["invitation", "resetPassword", "welcome"]`. The send/log validators and
  admin-log filter derive from this automatically.
- **`packages/email/src/templates/welcome.tsx`** (new): mirrors
  `reset-password.tsx` (a `LinkEmailProps` template: `{ url, locale }`). Title +
  body + CTA + note from `welcome.*` i18n. No org name, no placeholders.
- **`packages/email/src/render.ts`**: add a `welcome` case (it is a
  `LinkEmailProps` template like `resetPassword`); add `welcome: LinkEmailProps`
  to `EmailProps`.
- **`packages/backend/convex/betterAuth/provisioning.ts`**: add a `hasPassword`
  query: `{ userId }` -> `boolean`, true iff an `account` row exists for the user
  (the `account` table has a `userId` index; provisioned users have no account
  until they set a password, and the app is email/password-only, so "any account
  row" means "has set a password").
- **`packages/backend/convex/auth.ts`** `sendResetPassword`: resolve the locale
  (existing `getLanguageForUser`) and call `hasPassword`; if the user has a
  password -> enqueue `resetPassword`, else -> enqueue `welcome`. Same `to`,
  `props: { url: data.url }`, and `locale`.

The hook calls `hasPassword` via the app boundary: add a thin internal query
`userHasPassword` in `accounts/organization.ts` that runs
`components.betterAuth.provisioning.hasPassword` (keeps the hook calling app
`internal.*` functions, consistent with `getLanguageForUser`). `getLanguageForUser`
is unchanged.

### Require org (backend)

- **`packages/backend/convex/platform/admin.ts`** `createUser`: change args to
  `{ name, email, orgId, role }` (role = `admin | editor`). After
  `provisionUser` + `onUserCreate`, call `components.betterAuth.provisioning.addMember`
  with the org and role (reusing `assertUserAndOrg` to validate the org exists),
  and log the existing `membershipGranted` audit alongside `userCreated`. The
  separate `addMembership` mutation stays (used elsewhere); `createUser` no longer
  leaves the user orgless.

### Require org (frontend)

- **`apps/dashboard/lib/admin-schemas.ts`** `createUserSchema`: add
  `orgId: z.string().min(1)` and `role: z.enum(["admin", "editor"])`.
- **`apps/dashboard/components/admin/create-user-dialog.tsx`**: add a required
  organization `Select` (options from `useQuery(api.platform.admin.listOrganizations)`,
  showing `name`) and a role `Select` (admin/editor, default `editor`). Submit
  calls `createUser({ name, email, orgId, role })` then the unchanged
  `requestPasswordReset({ email, redirectTo: "/reset-password" })` (which now
  sends the welcome email because the user has no password). The submit button is
  disabled until name, a valid email, and an org are present.

### Sender identity

- **`packages/backend/convex/email/outbox.ts`**: change the `FROM_EMAIL` default
  to `"blueprnt <hello@blueprnt.se>"`. The value is read from the `EMAIL_FROM`
  env var, which currently overrides the default with `no-reply@blueprnt.se`, so
  the deployment env must also be updated:
  `bunx convex env set EMAIL_FROM "blueprnt <hello@blueprnt.se>"`. No template or
  send-path change; Sweego parses the display name out of the `from` string.

### i18n

New `welcome.*` keys (en first, mirrored to sv/nb/da/fi; drafts for native
review), and new create-dialog labels:

- `email.welcome.{subject,heading,body,cta,note}` (English):
  - subject: "Welcome to blueprnt"
  - heading: "Welcome to blueprnt"
  - body: "An account was created for you on blueprnt. Set your password below to get started."
  - cta: "Set your password"
  - note: "If you weren't expecting this, you can ignore this email."
- `dashboard.admin.users.create.orgLabel` = "Organization", `.roleLabel` = "Role",
  and role option labels reuse the existing `accounts.role.{admin,editor}` keys.
- `dashboard.admin.emailLog.templates.welcome` (the admin-log filter label).

No em dashes anywhere.

## Data flow (create user)

1. Admin opens the dialog, enters name + email, selects an org and role, submits.
2. `createUser({ name, email, orgId, role })` provisions the passwordless user and
   adds the membership atomically (no orgless state).
3. The client calls `requestPasswordReset({ email, redirectTo: "/reset-password" })`.
4. `sendResetPassword` sees the user has no password -> enqueues the `welcome`
   email (localized to the org language) with the set-password URL.
5. The user clicks the link -> `/reset-password` page -> sets a password (the
   credential `account` row is created) -> signed in.
6. A later genuine forgot-password for that user now has a password -> the reset
   email is sent.

## Error handling

- `createUser` throws `invalidInput` on empty name/email (existing) and the org
  is validated via `assertUserAndOrg` (throws `notFound` if the org is missing).
- The email send remains non-fatal in the dialog (the account exists; resend
  covers a failed send).
- The hook's `hasPassword` defaults safely: if the lookup somehow fails the user
  still gets an email; the only difference is welcome vs reset wording.

## Testing

- `provisioning.test` (or platform/admin test): `hasPassword` is false for a
  freshly provisioned user and true after an `account` row exists.
- `platform/admin` test: `createUser` adds the membership (the user is a member
  of the chosen org with the chosen role) and a missing/invalid org is rejected.
- `auth`/hook coverage: the `sendResetPassword` branch picks `welcome` for a
  passwordless user and `resetPassword` for one with a password. If driving the
  Better Auth reset hook is e2e-only here, cover the decision via the
  `userHasPassword`/`hasPassword` query test and rely on the hook's simple branch.
- `packages/email` render test: the `welcome` template renders in all five
  locales (distinct subjects) and contains the set-password URL.
- `create-user-dialog` test: the submit is disabled without an org; submitting
  calls `createUser` with `{ name, email, orgId, role }`.

## Out of scope / non-goals

- No change to the `/reset-password` page, the forgot-password page, or the
  invitation (org-invite) flow.
- The welcome email does not name the organization (Decision 2).
- No change to `requestPasswordReset` rate limits or `revokeSessionsOnPasswordReset`.
- Provisioning the `hello@blueprnt.se` mailbox (so replies are received) is an
  operational step, not code; this change only sets the sending address.
