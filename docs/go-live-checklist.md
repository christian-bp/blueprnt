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
- [ ] **Decide whether `/docs` and `/docs/[slug]` need a server-side session
  check.** The docs surface (ADR-0019) renders inside the `(app)` shell, but
  the shell's `AuthGate` (`apps/dashboard/components/auth/auth-gate.tsx`) is
  client-side: it only chooses which subtree the browser displays after
  hydration. Neither the page components nor `lib/docs/docs.ts` run a
  server-side session check before reading and returning the MDX, so the
  rendered documentation reaches an unauthenticated request today. This
  exposes no tenant or personal data (the corpus is identical for every
  organization and contains neither), so it is not a leak, but it is an open
  decision: add a real server-side session check before go-live, or record
  shipping it ungated as the deliberate choice, and update ADR-0019 to match.

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
- [ ] **Native review of the CRUD toast strings.** `dashboard.toast.*` (sv/nb/da/fi) were machine-drafted from English (sv authored in-house). Have a native speaker review before launch.
- [ ] **Native review of the ADR-0014 terminology strings (Nivå/Senioritet/Steg).** Every key the ADR-0014 change renamed or rewrote carries machine-drafted nb/da/fi values (sv/en reviewed in-house); review them from that change's i18n diff rather than any fixed list. Among others it spans `dashboard.levels.*`, `dashboard.overview.widgets.levels.*`, the `dashboard.model.editor.*` step scale, `dashboard.rating.result.*`, `dashboard.roles.anchor.*`, `dashboard.payMapping.gap.*`, the `dashboard.help.*` level/seniority/step explanations, `model.level`/`model.seniority`/`model.step`, the audit event/field labels, the "track" loanword normalization, and the seeded standardTemplate content. Pay particular attention to the fi short form (`Taso {level}` on numbered labels: `assessment.levelNumbered`, `dashboard.levels.levelRow`, the gap and deviation chips; long `Vaativuustaso` in prose), nb `Trinn`, da `Trin`, and the seniority help copy. Have a native speaker review before launch.
- [ ] **Label the audit payload field `count`.** Every other payload field now
  resolves to a `dashboard.auditLog.fields.*` label; `count` deliberately does
  not, so the `ai.suggestionConfirmed` flat-stat line is the one place the audit
  detail still prints a raw payload key. It was left unlabelled on purpose: two
  unrelated events write it with two different meanings, `ai.suggestionConfirmed`
  (`model.weightReview`: weight moves applied) and `roleFamily.removed` (roles
  moved out of the removed family). The latter carries a `changes` map, so it
  renders as a diff and hides `count` today, but the label namespace is shared,
  so one string would have to fit both. Make the cross-surface wording decision
  (one neutral term, or split into per-event flat-stat keys), then ship the
  label in all five locales and register `count` in `OTHER_AUDIT_FIELDS`
  (`apps/dashboard/lib/audit-labels.test.ts`).
- [ ] **Docs corpus alignment to the masterdokument world.** At least 8 MDX
  pages x 5 locales (`criteria-and-scale`, `evaluating-a-role`,
  `score-and-levels`, `key-concepts`, `glossary`, `model-overview`,
  `anchor-roles`, `method-appendix-pdf`, under
  `apps/dashboard/content/docs/`) still teach the pre-cutover model: a
  uniform 0-5 evaluation scale on every criterion (now 1-5, with 0 reserved
  for the working-conditions dimension's "not applicable" case, ADR-0021),
  and `criteria-and-scale.mdx`'s "Add criterion" walkthrough still describes
  a free-text form for hand-writing a name, description, and all six scale
  steps (criteria are now library-only selections from a fixed 6-8 range,
  decision 8/ADR-0021, replacing the old nine-criterion standard template).
  Owner: a dedicated pre-phase-3 task, not folded into this wave. Rewrite the
  corpus (en source first, then sv/nb/da/fi) against the current model, and
  end with `bun run docs:sync` and `bun run docs:eval` compared against the
  recall numbers ADR-0020 recorded, per the corpus conventions in CLAUDE.md.
- [ ] **Native review of the docs corpora (sv, nb, da, fi).** The sv, nb, da,
  and fi docs corpora under `apps/dashboard/content/docs/` are machine-drafted
  from the en source (2026-08-13/14) and must each be reviewed by a native
  speaker before launch; en is the source of truth on conflict. Sequence
  after the alignment rewrite above, not before it: reviewing a translation
  of content that is about to be rewritten wastes the review.

## Security and compliance

- [ ] **Re-check the CRA / security hardening plan.** Cross-reference
  `docs/superpowers/specs/2026-06-26-cra-hardening-design.md` and confirm its
  go-live items are done.
- [ ] **Confirm Sweego's EU hosting region and sign a DPA.** ADR-0001 attaches
  this as an explicit pre-go-live action for the email subprocessor: welcome,
  reset, invitation, change-email, and 2FA-code mail all carry recipient email
  addresses (and bodies) through Sweego. Confirm the hosting region is EU,
  execute a data-processing agreement, and add Sweego to the subprocessor / DPA
  register before go-live.
- [x] **Criterion compliance drafting ships end to end.** `draftCriterionCompliance`
  (`SUGGESTION_KINDS.criterionCompliance`, `ai/draft.ts`) generates the six
  rationale + bias-review fields and is consumed live by the compliance
  dialog's AI action (`apps/dashboard/components/model/criterion-compliance-dialog.tsx`,
  rendered from the method panel at `/model/method`), feeding from the
  library boundaries per spec section 7. No open work; kept as a record that
  an earlier revision of this entry wrongly claimed zero consumers.
  (`SUGGESTION_KINDS.modelDraft` and `model.draft`, the sibling flow this item
  used to also cover, are fully retired; `getWeightReviewLock` no longer reads
  suggestion rows for its lock at all. It now compares the latest confirmed
  `weightReview` suggestion against the latest `model.updated` /
  `criterion.activated` / `criterion.deactivated` audit row, so that
  cross-reference is gone too.)

- [ ] **Rate-limit the AI request surfaces per org.** Every `request*` mutation
  in `ai/suggest.ts` (`requestModelDraft`, `requestWeightReview`,
  `requestStarterImport`, `requestRoleImport`, plus `prefillRoleProfiles`)
  schedules a model call, and `ai/usage.ts` records spend without enforcing any
  quota. **There is no bound of any kind today**, and the obvious cheap ones do
  not work: reusing an in-flight generation is wrong (the second caller pasted
  different text and would be shown the first caller's proposal), and any guard
  keyed on an open row is defeated with no delay at all, because
  `rejectSuggestion` accepts a `generating` row and is member-scope, so
  request → reject → request loops freely and each iteration bills a full model
  call. A real per-org quota (a rate-limit component, or a ceiling read from
  `ai/usage.ts`) is required before go-live, together with a decision on what
  the UI shows when it is hit.

- [ ] **Verify the pay-mapping freeze scales past ~1000 employees.** The
  pay-mapping freeze (`startPayMappingRun`) is currently a single transaction.
  Verify it against Convex's per-transaction read/write limits and convert it
  to the batched-action pattern (mirror `people/import`) before onboarding an
  org above ~1000 employees.
- [ ] **Fix the shared destructive/success Badge tint contrast (app-wide).**
  The shared `Badge` `destructive` and `success` variants
  (`packages/ui/src/components/badge.tsx`) render `text-destructive`/
  `text-success` on their own `bg-destructive/10`/`bg-success/10` tint, which
  measures ~3.4-4.0:1 in LIGHT mode (dark mode already clears the 4.5:1 AA
  bar), below WCAG AA, for every badge using those variants app-wide. The
  pay-gap flag chips (`components/pay-mapping/pay-gap-flag-badge.tsx`,
  ADR-0012) were hardened locally with dedicated `--flag-critical`/
  `--flag-ok` text tokens (`packages/ui/src/styles/globals.css`) that keep
  the same tint but pass AA in both themes. Before go-live, consider fixing
  the shared variants themselves (a darker text token or a stronger tint) so
  every destructive/success badge passes AA without a per-surface override,
  with a visual regression pass across their usages.
- [ ] **Decide the erasure path for samverkan participant names
  (`payMappingRuns.collaboration.participants`).** The collaboration record
  (`setPayMappingCollaboration`) stores free-text participant names as
  statutory samverkansredogörelse content, but no erasure or anonymization
  path touches it (`erasePersonAsOrg` only hard-deletes `people`,
  `payRecords`, and `personAssignments`). Decide before go-live whether to add
  an erasure/anonymization hook for these names or record an explicit ADR
  exception, and implement whichever is decided.
- [ ] **Decide the erasure path for person- and pair-targeted actions and
  notes (`payMappingActions`/`payMappingNotes`).** A record whose target is
  `person` or `pair` carries the employee's `personPublicId` plus
  user-authored free text (`problem`, `plannedAction`, note `text`) and an
  optional `estimatedCost` (on a person-targeted action effectively that
  individual's planned raise), and `erasePersonRecords` does not touch these
  tables. The structured link is safe (the publicId becomes a dead pseudonym
  once the `people` row and snapshot identity are gone, and the overview
  never denormalizes a name), but the free text can name the person and no
  hook can reach it today: neither table is indexable by person without a
  new index. Decide before go-live: (a) add the index + a hook that
  hard-deletes or tombstones person/pair-targeted rows on erasure, or (b)
  record an explicit ADR exception, mirroring the collaboration-participants
  entry above. Consider also whether `estimatedCost` should be allowed on
  person targets at all (restricting it to group targets removes the
  salary-adjacent half of the problem). ADR-0015 §7 carries the matching
  raderingsförbehåll.
- [ ] **Native review of the Iteration 2 pay-mapping strings (nb/da/fi).**
  The 2026-08-06 analysis-views rebuild added ~140 keys per locale
  (`dashboard.payMapping.detail/scatter/crossLevel/actions/actionsOverview/
  deepDive/womenAhead.*`, the `finding.lessTcc`/`lessTccWorse` variants,
  action/note toasts, audit event/field/value labels, and the five new
  `dashboard.help.*` pairs), plus slice C2's two new reason labels
  (`geographicDifferentiation`, `retention`). The nb, da, and fi values are
  machine-drafted and flagged in the feature commits; have native speakers
  review them before launch. Slice C2's own `levelAnalysis` section, the
  level-table columns and the `levelAnalysis` help pair are NOT in scope:
  the surface they belonged to was removed (see the further-analysis entry
  below) and their keys went with it.
- [ ] **Native review of the Iteration 3 analysis-ladder strings (nb/da/fi).**
  The 2026-08-06/07 IA rebuild added the `dashboard.payMapping.analysis.*`
  namespace (the spine's progress readout and samverkan strip, the chapter
  position and statutory duty copy, the worklist, the completion row, and the
  phone's step position and steps sheet). The nb, da, and fi values are
  machine-drafted; have native speakers review them before launch. The
  supplementary drawer, the next-step panel and the cross-level observation
  were in this entry's original scope and are no longer: the chapter rebuild
  removed all three and their keys went with them.
- [ ] **Native review of the Iteration 4 dashboard strings (nb/da/fi).**
  The 2026-08-08/09 rebuild added the overview's widget copy
  (`dashboard.overview.widgets.*` including both trend titles and the two
  empty-state sentences, and the `quickActions.*` label/detail pairs), the
  run overview's population deltas
  (`dashboard.payMapping.overview.population*`), and the numbered chapter tab
  format (`dashboard.payMapping.analysis.chapterTab`). All machine-drafted.
  One phrasing needs particular care because a reader may take it as a claim
  about their own data: `widgets.gapTrend.unmeasuredEmpty`, which says a
  mapping had no MEASURABLE gap, not that it had no gap. The same wave's
  `dashboard.help.payGapScatterMeansBody` (the sentence explaining the two
  average lines the equal-work scatter draws) is machine-drafted too and
  belongs in this review.
- [ ] **Gate `deletePayMappingRun` on run status.** The mutation currently
  hard-deletes a run (and its snapshot rows + group analyses) regardless of
  `status`, including a `completed` run, which is the statutory kartläggning
  evidence document. Decide the go-live policy (e.g. block deleting completed
  runs, or require a separate unlock step) and add the corresponding
  server-side status gate.
- [ ] **Collapse the double per-person assignment query in
  `startPayMappingRun`.** `computePayMappingPreconditions` (the gate) and the
  freeze loop right after it each run their own per-person
  `personAssignments` query over the same `active` population, so every
  person's assignments are read twice in one mutation. Fine at today's org
  sizes; before onboarding a large org, collapse the two loops so each
  person's assignments are fetched once.
- [ ] **Implement kartlaggning access + export logging in the export slice.**
  ADR-0011 section 3 (Atkomst- och exportloggning) decided that views and
  exports of a kartlaggning get logged, but the first snapshot slice shipped
  without it (see the ADR's 2026-07-13 update): the change-log requirement is
  already covered by the domain audit trail, and the real value is at the
  export boundary, which does not exist yet. Guide Modul 9 / line 735 covers
  the same requirement. Before go-live, build this logging in the future
  export/report module (guide Modul 8) at the point data leaves the system,
  not as a per-view log on the detail page.

- [ ] **Wire `bun run docs:sync` into the production deploy flow.** The docs
  search index (the `@convex-dev/rag` component, ADR-0020) is populated by
  running `bun run docs:sync` (`apps/dashboard/scripts/sync-docs.ts`) against
  a Convex deployment. Today it is a manual step run against the dev
  deployment only; it must run after `convex deploy` in the production
  deploy flow, wired into CI before go-live. A fresh deployment has an
  empty index, so until this sync runs against it the assistant's
  `search_docs` tool answers with no documentation at all, not degraded
  results. A `CHUNKER_VERSION` bump (`apps/dashboard/lib/docs/chunk.ts`)
  also requires this sync to run before the new chunking takes effect in
  search, since the sync is the only path that rebuilds the index from the
  MDX source.

- [ ] **Move the `@convex-dev/rag` dependency off the pinned alpha version.**
  `packages/backend/package.json` pins `@convex-dev/rag` to the exact
  version `0.8.0-alpha.0`, not a range (ADR-0020). The stable line (0.7.5)
  hard-depends on AI SDK 6, while the assistant's streaming loop is written
  against AI SDK 7; `0.8.0-alpha.0` is the only published build whose peer
  range accepts AI SDK 7. Move to a stable release before go-live once one
  supports AI SDK 7, and re-run the search evaluation from ADR-0020 against
  it before switching.

- [ ] **Assistant: decide the retention policy for archived assistant threads.** ADR-0018 stage-gates this decision: auto-delete after N days vs keep until user erasure. Implement the chosen policy before onboarding real organizations.

- [ ] **Assistant: revisit the simple per-user hourly message cap.** The V1 cost guard is a naive 30 messages per user per hour. If real usage shows abuse patterns or if per-org token budgets become policy, upgrade to @convex-dev/rate-limiter.

- [ ] **Assistant: decide a spend cap / circuit breaker for assistant AI usage.** The `aiUsageEvents`/`aiUsageMonthly` rows already exist, but nothing enforces a ceiling today (the per-message output token cap only bounds a single reply). Options: a Mistral account budget alarm, or an internal cap read from the monthly rollup that refuses new generations once an org crosses it.

- [ ] **Admin AI usage: bound `usageByOrgDaily`'s month read.** The daily chart's query (`convex/platform/aiUsage.ts`) collects every `aiUsageEvents` row platform-wide for the selected month; the window rides the creation-time index but is not paginated, so it grows with total cross-org event volume. Fine at V1 scale; before onboarding many active organizations, either aggregate into a daily rollup table or paginate the read.

- [ ] **Assistant: revisit the word-cadence flush rate under real load.** `ASSISTANT_FLUSH_INTERVAL_MS` is 40ms so replies appear word by word (the whole visible typing flow rides on it; the client deliberately has no animation). That is ~25 snapshot writes per second per streaming reply, each rewriting the message's parts array. Fine at V1 scale; at many concurrent streaming users, either raise the interval (the flow gets chunkier per step) or move the hot path off per-flush document rewrites before this becomes the deployment's dominant write load.

## V1 conformance follow-ups (from the 2026-07-01 audit)

Re-verified 2026-07-03: the audit's build/copy/doc gaps (the rationale +
bias-review UI, the metodbilaga export, the verbatim anchor texts, the
`PLAN-V1.md` four-factor prose) are closed. These remain, and none of them block
starting V2:

- [ ] **Level-rule editing UI (E2 configurability).** `updateLevelRules` and
  `updateZoneProfileRules` (`evaluationModel/approval.ts`) already let an org
  patch `levelRules`/`zoneProfileRules` after model creation; the remaining
  gap is UI only, no dashboard surface calls either mutation yet. The docs
  promise per-org configurability; add the editing UI.
- [x] **Calibration queue UI (spec section 6).** Shipped on the levels
  surface (`components/levels/calibration-queue.tsx`, fas 5): the derived
  queue lists the three classes with the reason in words per row, and
  confirming a placement calls `calibrateAssessment` with an optional note.
- [ ] **Bound the calibration queue for a large register.** The queue derives
  from rows the levels page has already fetched, so it costs no extra reads,
  but it renders EVERY row that needs review with no cap and no pagination.
  Re-approving a method puts every locked role into the stale-lock class at
  once, so an org with a thousand roles gets a thousand-row list on one page.
  Cap it, paginate it, or collapse it per class before large-org onboarding.
- [ ] **Calibrate `DEFAULT_LEVEL_RULES` and `DEFAULT_ZONE_PROFILE_RULES`
  against real data.** Both (`packages/core/src/zones.ts`) are the starting
  points every model's `levelRules`/`zoneProfileRules` seed from at creation,
  translated from the Excel prototype at a different weight spread
  (`docs/contexts/evaluation-model/standardmall.md`); uncalibrated level and
  zone-profile rules yield unreliable comparable-work groupings and zone
  placements. Best done with the real salary data the V2 import brings.
- [ ] **Rename the compliance fields to spec** (`overlapNotes`→`overlapWithOthers`,
  `decidedBy`→`decisionMaker`, `decidedAt`→`date`). The Method UI now uses the
  current names, so the rename touches `evaluationModel/tables.ts`, `method.ts`,
  the compliance dialog, and the PDF. Cosmetic, non-blocking.
- [ ] **Azure OpenAI EU Data Zone fallback.** `ai/provider.ts` wires only Mistral
  (EU-hosted, so residency is fine); implement the documented Azure fallback so
  Mistral is not a single point of failure, or explicitly de-scope it in the
  spec + ADR-0003.
- [ ] **Aggregate anchor-comparison panel.** The levels/work overview shows
  per-role deviation chips (`getResults`) but not the agreed-vs-computed table
  (`listAnchorRoles`); the data seam exists, the panel is not built.
- [x] **Doc housekeeping.** Fixed the stale "with guardrails" test description in
  `roles.test.ts` and added the starter import + criterion-compliance/bias-review
  drafts to the V1 AI-scope list (ADR-0003 tillägg 2026-07-10).

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

- [ ] **Person `title` (Befattning) field: PII review.** V2 classification added
  `title` to the `people` table (imported from the payroll Befattning column) and
  it now drives the deterministic title->role suggestion.
  (1) RESOLVED 2026-07-31 by ADR-0013: `title` is now a diffed audit field, along
  with the other identity fields, so a title edit that shifts a level is recorded
  in the people audit and not only as a `level.shift`.
  (2) STILL OPEN: `title` is imported free text, so a customer could stuff a
  person name into a Befattning cell. This is the same latent risk already
  carried by other role-level free-text fields (motivation/purpose) and needs no
  code change, but flag it for the pre-launch privacy review. Note that since
  ADR-0013 a `title` value reaches the audit trail, where erasure tombstones it
  like any other identity field, so a name hidden in a title is erasable.

- [ ] **P1 gender-gap small-cell masking: enforce the export minimums at the
  Art. 9 boundary.** In-app, the gap engine (`packages/core/pay-gap.ts` +
  `payMapping/gap.ts`, ADR-0012 amendment 2026-07-16) computes a gap for every
  group with at least 1 woman AND 1 man; ⚪ insufficient now means only that a
  gender is missing. This is deliberate: the app is HR-only and HR already sees
  every individual salary, so a 4-person floor protected nothing in-app while
  making small orgs' analyses unusable. But the SAME `getPayMappingGap`
  aggregate will feed the Art. 9 export (M8), where the data leaves the HR
  context. Before that export ships, apply the full small-cell minimums at the
  export boundary: mask any group mean/gap where total < 4 OR `womenCount < 2`
  OR `menCount < 2` (a 1-person "mean" is an individual's salary). This lives
  in the export slice, not the engine; the in-app view keeps the loose rule.
  Not an in-app blocker.

- [ ] **Report methodology note for entry-condition-excluded groups (M8).**
  ADR-0015's entry conditions silently drop singleton groups and route
  gender-pure and women-ahead groups out of the primary lika arbete flow;
  none of them appear in the report's equal-work section. So the statutory
  documentation stays honest, the M8 report must carry an aggregate
  methodology note ("N groups excluded for lacking a comparison basis": the
  wire already exposes `excluded.singletonCount` plus the gender-pure and
  reverse lists from `getPayMappingGap`). Belongs to the report slice, not
  the engine. Not an in-app blocker.

- [ ] **Chunk the remaining org-scaled single-transaction writes.** Per the
  CLAUDE.md scalability rule, write paths whose work grows with org size must
  run as bounded chunks. Known single-transaction paths to convert before
  onboarding a large org: `classifyOrg` (one suggested assignment per matched
  person, people/classification.ts), the import apply step if it writes
  per-person in one mutation, and `deletePayMappingRun`'s child-first delete
  loop (which since Iteration 2 also removes the run's `payMappingActions`
  and `payMappingNotes`). Verify each against Convex's per-transaction
  document limits at the target org size (~8-12 writes per person for
  assignment-writing paths).
  Same class, read-side, added by Iteration 2: every work-layer create/update
  (`payMapping/actions.ts`, `notes.ts`) `.collect()`s the run's entire
  `payMappingSnapshotRows` inside the mutation to validate one target
  (`validateTarget` runs `buildGapAggregates` over the whole snapshot). At
  ~10k employees that is a 10k-document read set (transaction budget + OCC
  conflict surface) per saved action. Before large-org onboarding, bound it:
  a `by_run_group` index on (orgId, runId, roleTitle, level, seniority)
  lets validation fetch just the target group; the same index also makes the
  person-membership check a point lookup. Client-side sibling: the tvärnivå
  scan (`crossLevelPairs`, O(women x men) over the whole frozen population)
  runs in the browser on the analysis tab; it is memoized per data change,
  but at very large populations the single pass itself deserves a
  measurement before onboarding.
  The read side needs the same bounding: `listPeopleByTitle`
  (people/classificationQueries.ts, the classify surface's data source)
  collects every active person via `by_org`, then runs one `personAssignments`
  index query per person to find their open assignment. That is an N+1 read
  fan-out, not a single bounded query; it needs bounding (e.g. a batched or
  paginated lookup) before large-org onboarding.
  Same class, smaller blast radius: `listPeopleForRole`
  (people/assignments.ts, the role page's employee list) collects ONE role's
  whole assignment history via `by_role` and resolves one person document per
  open assignment (concurrently, but unbounded), then returns every holder for
  client-side pagination. Bounded by a role rather than the org, so it is safe
  for ordinary roles; a role held by hundreds of people (one title across a
  large org) wants a paginated query before large-org onboarding.
  Also here: **`erasePersonRecords`** (people/erase.ts) now does all of one
  person's erasure in a single transaction: delete their `payRecords` and
  `personAssignments`, patch their frozen `payMappingSnapshotRows`, AND patch
  every audit row about them (`anonymizePersonAuditRows`, ADR-0013). It is
  bounded by ONE person's history, not the org's, so it is far smaller than the
  paths above, but an org that writes a `person.updated` row per person per
  nightly sync accumulates hundreds of rows per person over a couple of years.
  The failure mode is not partial PII (the mutation is atomic) but that erasure
  becomes permanently impossible for that person, with only a generic error to
  diagnose it, which would block an Art. 17 request. When chunking it, INVERT
  the order: scrub the trail in bounded chunks first and delete the `people` row
  last (or write a resumable pending-erasure marker), because today's order
  (delete at step 3, scrub at step 5) is exactly the order that would leave
  un-scrubbed rows with no live row to resume from once split across
  transactions.
  Same class, payload-bounded rather than org-bounded: `insertStarterSet` and
  `insertAdditiveRoles` (assessment/starters.ts) each write up to 20 families
  plus 100 roles plus roughly 120 audit rows and their aggregate updates in ONE
  transaction. The cap is a payload constant (`MAX_FAMILIES` / `MAX_ROLES`), not
  the org's size, so neither write grows with a large customer. The org-scaled
  READ cost is not shared between them, though. `insertStarterSet` only
  collects the org's `roleFamilies` (for family-name uniqueness); its per-role
  slug check against `roles` (`uniqueSlug`, lib/slug.ts) is a bounded indexed
  point lookup, not an org-wide collect, so it does not grow with the org's
  role count. `insertAdditiveRoles` does grow: on top of that same
  `roleFamilies` collect, it also collects every role in the org to build its
  title-uniqueness set (the same pattern `reconcileStarterSet` and
  `assertUniqueRoleTitle` already use). On top of its writes it also issues one
  `uniqueSlug` call per created role and per created family (roughly 120 at a
  full import), and each of those is at least one `by_org_slug` index probe,
  more when the base slug is taken (the prefixed form, then a short-id suffix
  per retry). Those reads are bounded and indexed, but they count against the
  transaction's budget, so include them in the estimate rather than counting
  writes alone. Verify the total against Convex's per-transaction document
  limits at a full 100-role import before large-org onboarding, and bound
  `insertAdditiveRoles`' uniqueness read if a register ever reaches thousands
  of roles.
  Same class, read-side, added by the assistant's input-side PII screen and
  its own data tool: `containsEmployeeName` (convex/assistant/insights.ts)
  collects every person in the org via `by_org` once per assistant generation
  request, to check the user's message against every employee's full display
  name before it can reach the model (ADR-0018). `payStats` (same file) is
  the heavier of the two: it collects that same org's `people` rows AND every
  one of the org's `payRecords` rows in one transaction, and payRecords is
  multi-row-per-person, so its read set outgrows `containsEmployeeName`'s as
  the org's pay history accumulates. Both scale with the org's headcount on a
  per-message hot path, not a per-org-onboarding one, so both deserve
  bounding (e.g. a cached/derived per-org name set for the screen, and an
  indexed or pre-aggregated read for the pay stats) before large-org
  onboarding.
  Same class, on the model-editing surface: `updateLevelRules` and
  `updateZoneProfileRules` (`evaluationModel/approval.ts`) each wrap
  `ctx.audit.levelShifts` (a before/after full-org `deriveResults`) in the
  same transaction as the rules patch, logging one `level.shift` row per role
  whose level moved; a level-rule or zone-profile-rule edit can move every
  role in the org at once, so the write scales with org size, not with the
  size of the edit. `deactivateCriterion` (`evaluationModel/criteria.ts`) is
  the same shape from the other direction: before it even reaches its own
  level-shift diff, it deletes one `ratings` row per role that had rated the
  deactivated criterion, all inside the same mutation that deletes the
  criterion. `restoreApprovedModel` (`evaluationModel/approval.ts`) is the
  heaviest of the group because it combines both shapes: it performs
  `deactivateCriterion`'s per-role rating deletion once per criterion the
  restore removes (up to 8), runs TWO whole-org `deriveResults` passes around
  the writes, and then logs one `level.shift` row per role whose level moved,
  all in the one transaction that also rewrites every criterion row and the
  model. It is bounded in criteria (8) but not in roles or ratings, and it is
  deliberately atomic (a half-restored model would be off the ADR-0004 point
  budget), so bounding it means chunking the restore itself, not relaxing the
  transaction. Bound all four before large-org onboarding.

  Note (data, not scale, same surface): the model-evidence shape shared by
  `models.lastApprovedModel` and `payMappingRuns.frozenModel`
  (`evaluationModel/tables.ts`) now carries HR-authored free text per criterion
  (`weightMotivation`, `purpose`, `whyRelevant`, `overlapNotes`, `biasComment`,
  `biasAction`). That is role/model-level content, never person data, but it is
  retained indefinitely inside frozen runs with no erasure hook, the same
  posture as `payMappingRuns.collaboration`; fold it into that entry's
  pre-launch decision rather than treating it as a separate one.

- [ ] **Re-introducing an erased employee: decide suppression vs controller
  process.** Nothing records that an `externalRef` has been erased, so a later
  payroll import that still contains the number simply re-creates the person
  (`upsertPersonByExternalRef`'s insert path) with their full identity, no
  warning, and since ADR-0013 a fresh identity-bearing `person.created` audit
  row. Narrower variant: an erasure that commits between two rows of a running
  import is undone by the rest of that same import. This predates ADR-0013 (the
  `people` row was always re-created); what changed is that the trail now
  records the identity too. Decide before launch: either a suppression record
  keyed on org + a salted hash of `externalRef` (no plaintext identifier
  retained) that the import checks and surfaces as an explicit row issue in the
  review step, so a re-add is deliberate; or an explicit statement that this is
  a controller process, not a product control. Do not leave it unexamined.
- [ ] **Audit-log count/offset aggregates: backfill on restored data + watch
  write contention.** The audit pager's exact totals come from two
  `@convex-dev/aggregate` instances maintained by `logAudit`; rows that reach
  a deployment WITHOUT going through `logAudit` (restoring an environment
  from a pre-aggregate snapshot, importing data) silently under-report totals
  until `devReset:backfillAuditLogAggregates` is run. Any environment seeded
  from existing data must run the backfill before the pager is trusted. Post
  go-live, watch the OCC-conflict rate on audit-writing mutations (each org's
  aggregates serialize concurrent inserts per namespace; bulk fan-outs like
  `level.shift` amplify this) and tune node size / laziness per the component
  README if it shows up.

## How to add to this list

When you introduce anything that is acceptable only because we are pre-launch (a
test bypass, a seed mutation, a relaxed check, a hardcoded value), add a checkbox
here describing exactly what to remove or change and how to verify it is gone.
