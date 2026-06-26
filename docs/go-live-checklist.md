# Go-live checklist

Things to remove, disable, or harden before blueprnt serves real customer
organizations. We are pre-launch (see CLAUDE.md: "No legacy before launch"), so
test affordances and seed surfaces live in the codebase for now and must be
cleared here before go-live.

Keep this list current: when you add a pre-launch-only shortcut, add a line here
in the same change.

## Auth and access

- [ ] **Remove the 2FA test-user exemption.** Unset `TWO_FACTOR_EXEMPT_EMAILS`
  on the production deployment and delete the exempt test account(s). With the
  var empty, `getMyMfaStatus` enforces setup for everyone. Verify a fresh
  sign-in for a previously-exempt email now requires 2FA setup.
  (Added with the mandatory-2FA work; see
  `docs/superpowers/plans/2026-06-26-mandatory-2fa.md`.)
- [ ] **Confirm the dev OTP log is inert in production.** The `sendOTP` callback
  logs the code only when `NODE_ENV !== "production"`, so a real production
  build never logs it. Confirm the production deployment runs with
  `NODE_ENV=production` and grep the logs to be sure no OTP is printed.
- [ ] **Lock down seed / reset surfaces.** `packages/backend/convex/seed.ts` and
  `packages/backend/convex/devReset.ts` (e.g. `resetDatabase`) must not be
  runnable against production data. Remove them or guard them behind an
  environment check that is impossible to satisfy in production.
- [ ] **Reset pre-launch data.** Clear dev/demo organizations, users, and seeded
  content from the production deployment so launch starts clean.

## Content and localization

- [ ] **Native review of machine-translated locale drafts.** The 2FA strings in
  `sv.json`, `nb.json`, `da.json`, `fi.json` (and any other drafts flagged in
  commits) were machine-drafted from English. Have a native speaker review
  before launch.

## Security and compliance

- [ ] **Re-check the CRA / security hardening plan.** Cross-reference
  `docs/superpowers/specs/2026-06-26-cra-hardening-design.md` and confirm its
  go-live items are done.

## How to add to this list

When you introduce anything that is acceptable only because we are pre-launch (a
test bypass, a seed mutation, a relaxed check, a hardcoded value), add a checkbox
here describing exactly what to remove or change and how to verify it is gone.
