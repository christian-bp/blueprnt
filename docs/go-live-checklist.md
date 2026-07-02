# Go-live checklist

Things to remove, disable, or harden before blueprnt serves real customer
organizations. We are pre-launch (see CLAUDE.md: "No legacy before launch"), so
test affordances and seed surfaces live in the codebase for now and must be
cleared here before go-live.

Keep this list current: when you add a pre-launch-only shortcut, add a line here
in the same change.

## Auth and access

- [ ] **Remove the seeded founder accounts.** `seedProduction` creates two
  pre-launch bootstrap accounts (`karl@blueprnt.se` / Karl Stolt and
  `christian@blueprnt.se` / Christian Ek), both flagged `isPlatformAdmin` and
  sharing a bootstrap password. Before go-live, delete or re-provision them
  properly (real per-person passwords, platform-admin granted out-of-band via
  `internal.platform.bootstrap.grantPlatformAdminByEmail`), and rotate the
  bootstrap password. There is no 2FA exemption: these accounts use real email
  2FA like everyone else.
- [ ] **Confirm the dev OTP log is inert in production.** The `sendOTP` callback
  logs the code only when `NODE_ENV !== "production"`, so a real production
  build never logs it. Confirm the production deployment runs with
  `NODE_ENV=production` and grep the logs to be sure no OTP is printed.
- [ ] **Lock down seed / reset surfaces.** `packages/backend/convex/seed.ts`
  (`seedProduction` and `resetDatabase`) and `packages/backend/convex/devReset.ts`
  (`wipeAppTables`) must not be runnable against production data. Remove them or
  guard them behind an environment check that is impossible to satisfy in
  production.
- [ ] **Reset pre-launch data.** Clear dev/demo organizations, users, and seeded
  content from the production deployment so launch starts clean.
- [ ] **Clear or backfill before the slug schema deploys.** `roles` and
  `roleFamilies` carry a required `slug` (the route handle). A required field
  cannot be pushed against populated tables, so any environment that already has
  roles/families must have them cleared (the reset above) or backfilled with a
  one-off mutation before this schema is deployed. A freshly reset deployment
  needs nothing further: new rows get slugs at creation via `lib/slug.ts`.

## Content and localization

- [ ] **Native review of machine-translated locale drafts.** The 2FA strings in
  `sv.json`, `nb.json`, `da.json`, `fi.json` (and any other drafts flagged in
  commits) were machine-drafted from English. Have a native speaker review
  before launch. Specific items flagged in review to check:
  - nb/da use a different 2FA term in `twoFactorSetup.complete.description`
    (`Tofaktorautentisering`/`Tofaktorgodkendelse`) than the rest of the flow
    (`Tostegsbekreftelse`/`Totrinsbekræftelse`); pick one term per locale.
  - sv `email.twoFactorCode.note` "upphör" reads stiff; consider "går ut".
  - fi `twoFactorSetup.complete.heading` "Valmista tuli" is too colloquial for a
    security screen.
  - sv mixes "mejl" and "e-post" across the new keys; standardize.
- [ ] **Native review of account-settings machine-translated strings.** The
  account-settings feature (Tasks 2-11) added new Nordic (sv/nb/da/fi) strings
  that were machine-drafted from English. Have a native speaker review before
  launch. Affected key namespaces:
  - `dashboard.account.*` (sub-keys: profile, email, security.password,
    security.twoFactor, security.delete, tabs, title)
  - `dashboard.nav.accountSettings`
  - `dashboard.accountMenu`
  - `dashboard.help.changeEmailLabel` / `dashboard.help.changeEmailBody`
  - `dashboard.validation.emailUnchanged`
  - `errors.lastAdmin`
  - `email.changeEmailConfirm.*`
  - `email.verifyEmail.*`
  - Note: the nb `changeMethodConfirmTitle` typo (`to-trinnsmétode` with an
    accented e) was fixed in the same commit that flagged this item.
- [ ] **Native review of organization-settings machine-translated strings.** The
  organization-settings feature added new Nordic (sv/nb/da/fi) strings that were
  machine-drafted from English. Have a native speaker review before launch.
  Affected key namespaces:
  - `dashboard.organization.*` (tabs, notAuthorized, general, logo, members,
    invite, invitations)
  - `dashboard.nav.organization`
  - `dashboard.help.orgCurrencyLabel` / `orgCurrencyBody` /
    `orgLanguageLabel` / `orgLanguageBody`
  - Role-label consistency: the new `organization.members.roleAdmin` /
    `roleEditor` follow each locale's existing convention, but those conventions
    are not uniform (e.g. fi pairs "Muokkaaja" with a top-level
    `accounts.role.editor` of "Editor"; da uses "Redaktør"). Standardize the
    Admin/Editor terms per locale.
- [ ] **Native review of the role-slug error string.** `errors.roleExists`
  (sv/nb/da/fi) was machine-drafted from English; have a native speaker confirm
  the "in this family" phrasing matches each locale's role-family term.
- [ ] **Native review of the compliance-dialog acknowledgement strings.**
  `dashboard.model.method.aiAckLabel` (confirm the AI draft was reviewed) and
  `dashboard.model.method.approveAckLabel` (confirm the documentation before
  approval) were machine-drafted into sv/nb/da/fi from English. Both gate a
  formal sign-off, so the wording must read unambiguously as an attestation in
  each locale. Have a native speaker review before launch.
- [ ] **Native review of the overview greeting + to-do strings.** `dashboard.overview.greeting.*` and `dashboard.overview.todo.*` (sv/nb/da/fi) were machine-drafted from English. Have a native speaker review before launch, and confirm the "evaluate" term matches each locale's existing usage (`dashboard.roles.evaluated`).
- [ ] **Native review of the dashboard side-card + chart strings.** `dashboard.overview.chart.*`, `dashboard.overview.modelReadiness.*`, and `dashboard.overview.gettingStarted.*` (sv/nb/da/fi) were machine-drafted from English. Have a native speaker review before launch.

## Security and compliance

- [ ] **Re-check the CRA / security hardening plan.** Cross-reference
  `docs/superpowers/specs/2026-06-26-cra-hardening-design.md` and confirm its
  go-live items are done.

## E2E-only coverage to verify before launch

These boundaries cannot be exercised by convex-test (they run only inside Better
Auth's session-gated endpoints, the same limitation that scoped
`deleteMyAccount`'s valid-password path to e2e). Make sure the e2e/Playwright
suite covers them before go-live:

- [ ] **Change-email two-hop senders (`auth.ts`).** Confirm the e2e suite
  exercises the full double opt-in: hop 1 enqueues `changeEmailConfirm` to the
  CURRENT address, hop 2 enqueues `verifyEmail` to the NEW address, and clicking
  hop 2 applies the change and lands on `/change-email?step=done`. The pure
  callbackURL rewrite (`rewriteChangeEmailCallback`) is unit-tested in
  `convex/auth.test.ts`; the templateKey + recipient binding inside the senders
  are e2e-only.
- [ ] **Organization member + invitation flows.** convex-test cannot drive the
  Better Auth organization client. Confirm the e2e suite covers: inviting a
  member (`authClient.organization.inviteMember` fires the wired
  `sendInvitationEmail` + the `invitation.created` audit), listing and revoking
  pending invitations (`listInvitations` / `cancelInvitation`, the latter firing
  `invitation.revoked`), and accepting an invite (`/accept-invitation/[id]`
  creating the member + `member.added`). The Convex `updateMemberRole` /
  `removeMember` mutations and the last-admin guard ARE unit-tested.
- [ ] **Org logo content-type rejection (`setOrgAvatar`).** convex-test storage
  does not record an upload's content type, so the non-image rejection path is
  e2e-only (the 5 MB size cap and the admin gate ARE unit-tested). Same
  limitation as the user-avatar `setMyAvatar` path.
- [ ] **Metodbilaga PDF visual rendering.** The unit tests cover the PDF only
  partially: `method-appendix-download.test.tsx` mocks `@react-pdf/renderer`
  entirely, and `method-appendix-render.test.tsx` renders for real but only
  asserts a non-trivial blob plus page-number advancement. Neither catches
  browser-build-only faults (the fixed-footer disappearance and the SVG
  viewBox-transform crash both surfaced only in `pdf().toBlob()` in a real
  browser) or silent layout regressions (blank, oversized, or overlapping
  content that still produces a valid blob). Add an e2e check that generates
  the PDF in a real browser and rasterizes it to assert the cover, TOC,
  per-criterion pages, footer page numbers, and logo actually render.

- [ ] **Standard model compliance evidence in nb/da/fi.** The `compliance`
  fields (purpose/whyRelevant/overlapNotes/biasComment/biasAction) on the 9
  standard-model criteria in `standardTemplate.content.{nb,da,fi}.ts` are
  machine-drafted translations of the Swedish source (`sv` is the source, `en`
  is curated). Have a native speaker review them before go-live.

## How to add to this list

When you introduce anything that is acceptable only because we are pre-launch (a
test bypass, a seed mutation, a relaxed check, a hardcoded value), add a checkbox
here describing exactly what to remove or change and how to verify it is gone.
