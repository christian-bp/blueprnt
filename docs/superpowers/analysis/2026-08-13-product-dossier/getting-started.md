# Getting started dossier

Scope: first sign-in through a working role register (auth gate, the
onboarding wizard, and the Overview/front page a finished org lands on).
Current code (2026-08-13) has evolved well past most of the assigned design
docs; where code and doc disagree, code wins and the doc's plan is noted as
superseded.

## Behavior today

**Auth gate and shell.** Sign-up is disabled server-side
(`disableSignUp: true`, `packages/backend/convex/auth.ts:146`). Accounts are
provisioned by the company; the first user of an org signs in and builds the
workspace themselves. The dashboard root (`apps/dashboard/app/(app)/layout.tsx`
composes `Authenticated`/`Unauthenticated`/`AuthLoading`) shows the sign-in
screen (`apps/dashboard/components/auth/sign-in-screen.tsx`) when signed out,
then a two-factor gate, then the onboarding gate.

**Onboarding gate.** `apps/dashboard/components/onboarding/onboarding-gate.tsx`:
resolves the active organization (Better Auth `session.activeOrganizationId`,
falling back to the first membership via `resolveActiveOrgId`), persists a
default active org when none is set, and queries
`api.accounts.onboarding.getOnboardingStatus({ orgId })`. If the signed-in
user belongs to zero organizations, nothing renders (provisioning is
back-office; sign-up stays disabled). `OnboardingSession` computes
`incomplete = organization === null || !settingsComplete || !hasModel ||
!completed` and keeps the wizard mounted for the whole session once started
(`sessionStarted`/`sessionFinished` state), even if the derived signals flip
mid-flow, until the wizard calls `onFinished`. Once done it renders
`AppShell` with the resolved `{ orgId, name, role }`.

**getOnboardingStatus** (`packages/backend/convex/accounts/onboarding.ts`):
not org-scoped by wrapper (it exists to find the org before any org call is
possible); returns `null` when signed out, and otherwise
`{ organization, settingsComplete, hasModel, hasRoles, completed }`.
`settingsComplete` requires `country && currency && language && industry` all
set on the `organizations` row. `hasModel` is `models` row existence.
`completed` is the explicit persisted flag `onboardingCompletedAt` (never
inferred from `hasModel`).

**The wizard itself has exactly 4 steps today**, defined in the `STEPS`
array of `apps/dashboard/components/onboarding/onboarding-wizard.tsx`:

1. `name` — `NameScreen` (`components/onboarding/name-screen.tsx`): a single
   text input. Fresh flow calls `authClient.organization.create({ name, slug
   })` (Better Auth org plugin; creator becomes admin). A revisit renames via
   `authClient.organization.update` only if the name changed. `isComplete`:
   `status.organization !== null`.
2. `country` — `CountryScreen` (`components/onboarding/country-screen.tsx`):
   option cards for `se | no | dk | fi | other` (`COUNTRY_KEYS` from
   `@workspace/constants`). Picking a country auto-advances
   (`useAutoAdvance`) and persists country, a derived currency
   (`defaultCurrencyFor`), and a derived org language
   (`defaultLanguageFor`) in one `updateOrganizationSettings` call. There is
   no separate language screen: the org's default language is derived from
   the country, not asked. `isComplete`: `country && currency` both set.
3. `industry` — `IndustryScreen` (`components/onboarding/industry-screen.tsx`):
   option cards for the 9 industry keys (`INDUSTRY_KEYS`, also used to key
   the industry starter sets): `publicSector, manufacturing, consulting,
   retail, itTelecom, healthcare, finance, realEstateConstruction, other`.
   Auto-advances on pick. `isComplete`: `industry` set.
4. `families` — the terminal step. `isComplete`: `status.completed`
   (server-derived `onboardingCompletedAt`), so a reload mid-families resumes
   there until completion. Wrapped in `EnsureDefaultModel`
   (`components/onboarding/ensure-default-model.tsx`), which seeds the
   standard-template evaluation model as a side effect (there is no user
   facing model-choice screen anymore): it queries `getModel`, and if `model
   === null` calls `createModelFromTemplate({ orgId })` exactly once (a ref
   guards double-fire), showing a spinner meanwhile and a retry button on
   failure (`dashboard.model.error`/`retry`). `createModelFromTemplate`
   (`packages/backend/convex/evaluationModel/model.ts:84`) inserts the model
   with `templateKey: STANDARD_TEMPLATE_KEY` and `levelThresholds:
   defaultLevelThresholds()`, then loops `CRITERION_KEYS` (9 keys; confirmed
   by `evaluationModel/method.test.ts:259`, "standard template has 9
   criteria") inserting one criterion per key with 6 anchors each (steps 0
   to 5), using the content localized to the org's language
   (`contentLocale`). It throws `errors.modelExists` if a model already
   exists (`assertNoModel`), which `EnsureDefaultModel`'s null-check avoids
   in normal flow.

   `FamiliesStep` (`components/onboarding/families-step.tsx`, orchestrated by
   `hooks/use-families-draft-flow.ts`) then asks "What role families and
   roles are there at {name}?" with a paste-your-own-roles textarea
   (`PastedRolesField`). Two ways forward:
   - **Paste and analyze**: the user pastes role titles (one per line or
     comma separated); an AI suggestion request groups them into families
     and roles with a suggested track, following the same suggestion
     lifecycle as elsewhere in the app (`generating -> suggested -> confirmed
     | rejected | failed`, ADR-0003: review and confirm, nothing
     auto-applied). The result renders in an editable review table
     (`FamilyReviewTable`, the same component the in-app role import review
     uses), with per-role track selects. Import size is capped at
     `MAX_ROLES = 100` roles across `MAX_FAMILIES = 20` families
     (`packages/constants/src/starterSet.ts:8-9`); anything past that is
     dropped with a truncation notice
     (`dashboard.onboarding.families.importTruncated`).
   - **Use an industry template** (`templateCta`): seeds the industry
     starter set for the org's chosen industry directly into the same
     review table (no AI call), also fully editable before creation.

   Either path lands in the same review screen; nothing is written to the
   database until the user proceeds ("Next"/"finish"). Finishing runs
   `reconcileStarterSet` (creates the families and draft roles in one
   transaction, `source: "starter"` or the AI-import provenance) then, for
   any created role with an empty profile, an automatic AI **prefill** pass
   drafts `purpose`/`responsibilities` per role from its title, shown as its
   own "Drafting role profiles" phase with a live progress bar
   (`prefillProgress`, driven reactively off `listRoles` as each prefill
   chunk commits — no new plumbing). "Start over" is available in review; if
   a role set is already persisted (a revisit, or the just-created template
   set) it is gated behind a two-step inline confirm before it archives the
   set and returns to the paste view, because that path is destructive.
   Finishing (any path, including an emptied list) calls
   `completeOnboarding` and hands control back to the gate. There is no
   separate "skip" outcome distinct from finishing with zero families/roles.

**completeOnboarding** (`packages/backend/convex/accounts/organization.ts:106`,
an `adminMutation`, no args, org-scoped via context): if a model exists, it
requires the model's criteria count to be `>= MIN_CRITERIA` (5,
`packages/core/src/weighting.ts:19`), throwing `errors.tooFewCriteria`
otherwise. It then stamps `onboardingCompletedAt = Date.now()` on the
`organizations` row (inserting the row if it did not exist). Because
`EnsureDefaultModel` always seeds the 9-criterion standard template before
the families step is reachable, this gate is not reachable by the wizard in
normal flow (9 > 5); it exists as a defensive floor.

**Non-admin members** in an unfinished org see a "waiting for admin" screen
(`dashboard.onboarding.waitingForAdmin`) instead of the wizard, since setup
mutations are admin-only and would reject them.

**Resume logic.** No client-side "resume index" state beyond `acked`
(a UI-only ratchet that prevents the screen from being yanked away the
instant a save reactively completes, before its own fade has played) and
`backTo` (dot-driven back-navigation, which still walks forward screen by
screen on continue rather than jumping to the frontier). The actual resume
point on reload is fully server-derived: `resumeIndex()` finds the first
`STEPS` entry whose `isComplete(status, settings)` is false. `settings` here
is `getOrganizationSettings` (org row: country/currency/industry), read
independently of `getOnboardingStatus`. There is no session-local latch
carrying progress past a step boundary; every step's completion is provable
from server state, including the terminal `families` step (`completed`).

**The Overview / front page** (route `/`, `apps/dashboard/app/(app)/page.tsx`)
is what a finished org lands on. Current anatomy, top to bottom:
1. A centered hero: `WelcomeGreeting` (time-of-day + first name, see below)
   plus `OverviewStatusLine` (one insight line: "N things to do" linking to
   `#todo` on the same page, or "all caught up"; both derived from `useTodo`,
   no separate query) plus `AssistantPrompt` (the chat entry point).
2. `TodoActions` (`components/overview/todo-actions.tsx`): a row of exactly 3
   action cards. `buildTodo`'s groups (priority order: `importPeople,
   classifyPeople, describeRoles, evaluateRoles, documentCriteria,
   approveCriteria, startPayMapping`) fill the row first; any remaining
   slots are padded with standing "quick action" shortcuts
   (import employees, classify, roles, start pay mapping), deduplicated by
   destination href. The row's own heading text is data-dependent ("To do"
   vs "Quick actions"), never guessed ahead of the query. A first-time
   arrival of outstanding work per company fires a confetti burst once per
   org per session (`burstShownFor`, module-level `Set`), gated on the whole
   page being loaded and settled (`usePageSettled`) so the animation is
   never spent on blocked frames.
3. `OverviewWidgets` (real-data cards: workforce, level/band distribution,
   pay-gap headline; not part of this section's core claims but visible on
   the same landing page).

Earlier iterations of this page (an accordion `TodoList` + `WidgetCard` grid,
and before that count cards, a "continue scoring" card, and a two-column
grid + placeholder chart) are all superseded; see Deliberately absent.

**Auth shell (visual frame).** `apps/dashboard/components/auth/auth-shell.tsx`
plus `brand-panel.tsx` and `background-aurora.tsx` implement a split-screen
frame (a branded left/background panel, a centered card-less right panel)
shared by sign-in and, per the 2026-06-26 design, intended to be shared by
onboarding too. The onboarding wizard's own chrome today is `WizardShell`
(`components/wizard-shell.tsx`) with a logo/account-menu header and a
`WizardDots` footer, not literally `AuthShell`; verify current file contents
before describing the exact visual union in a docs page (not re-verified
line-by-line here beyond confirming both components exist and are wired).

## Terms and history

- **Organization** (organisation): the tenant. Named "workspace" in the
  earliest onboarding design; renamed to organization everywhere (domain
  docs, code identifiers, i18n, audit strings) per the 2026-06-04 spec's
  final amendment, because Better Auth already used "organization".
- **Onboarding**: the guided first-run flow from first sign-in to a working
  role register. Completion is explicit server state
  (`organizations.onboardingCompletedAt`), never inferred from the presence
  of a model or roles.
- **Evaluation model** (värderingsmodell): created automatically from the
  standard template during onboarding today; there is no user-facing choice
  between "template" and "from scratch" in the current wizard (that choice
  existed in the original 2026-06-04/06-06 designs and was removed).
- **Role family** (rollfamilj) and **role** (roll): created together in the
  onboarding families step, from either a pasted-and-AI-grouped list or an
  industry starter set. Roles created this way are drafts: they carry a
  title and a suggested track, with empty `purpose`/`responsibilities`
  until the automatic AI prefill (or later manual editing) fills them.
- **Track** (spår): the fixed IC/Lead/Manager job-kind schema roles are
  drafted against; assigned per role during the families review, not asked
  again later in onboarding.
- **ADR-0014 renames** (accepted 2026-08-05; "no semantics change, only the
  words"): **Band** (the role's computed weight/outcome via the point
  thresholds) is renamed **Level** (code `level`; Level 1 is still highest).
  The **old "Nivå"** (the individual's seniority within the role's track,
  ADR-0005) is renamed **Seniority** (code `seniority`; ladder values
  IC1-IC5, Lead1-Lead3, M1-M3 are unchanged). The criterion's six 0-5
  assessment-scale positions, previously called "levels"/"nivåer" in code
  and UI, are renamed **Step** (code `step`). Schema/code renames that
  followed in the same change: `models.bandThresholds` -> `levelThresholds`
  (confirmed present in current code as `levelThresholds`,
  `defaultLevelThresholds()`), `anchorRoles.expectedBand` ->
  `expectedLevel`, `personAssignments.level` -> `seniority`,
  `anchors[].level` -> `anchors[].step`, classification's
  `suggestedLevel`/`levelSource` -> `suggestedSeniority`/`senioritySource`,
  `packages/core` `Band`/`BandThreshold`/`assignBand` ->
  `Level`/`LevelThreshold`/`assignLevel`, `packages/constants`
  `TRACK_LEVELS` -> `TRACK_SENIORITIES`, and the model's `weightLevels` ->
  `weightMeanings`. **All getting-started source documents in this
  dossier's assignment predate this rename and use the old words** ("Band"
  for the computed outcome). This dossier's claims above have been
  translated to current terms (e.g. "level/band distribution" widget,
  "levelThresholds"); a docs writer must do the same for any additional
  quote pulled from those specs.
- **"Bedömningsnivå" / Assessment level** (2026-06-13 unit 2): a UI-label-only
  rename of the criterion editor's anchor-scale display text (kept the
  `anchors`/`anchorLevel` i18n key identifiers and the `criteria.anchors`
  Convex field name). Superseded in spirit by ADR-0014's Step rename above;
  a docs writer should use "Step" for the current code's terminology and
  treat "bedömningsnivå" as the interim UI label that predates it.
- **The "Score your roles" onboarding step** (2026-06-13 spec, unit 3):
  designed as a 5th wizard step after families, opt-in with save-and-exit.
  **Not present in current code.** `onboarding-wizard.test.tsx` states
  directly: "model + score steps were removed." Do not describe a scoring
  step as part of onboarding.
- **Industry starter set**: per-industry canned families+roles (each role
  with a suggested track and, originally, a suggested level/band) used as
  a one-click alternative to pasting a role list. Still present today via
  the families step's "Use an industry template" button.

## Rationale

- Sign-up stays disabled and accounts are company-provisioned so the first
  admin's onboarding always starts from a known, single-admin state
  (spec `docs/superpowers/specs/2026-06-04-onboarding-design.md`, decision 1).
- The org's language is derived from the chosen country rather than asked,
  and the model is seeded automatically rather than offered as a choice,
  in service of the product's "one question per screen" /
  "guide the user, minimize friction" direction
  (`docs/superpowers/specs/2026-06-06-conversational-onboarding-design.md`,
  decisions 3 and 5; current code's 4-step wizard is the endpoint of that
  direction, having gone further than the spec by also removing the model
  choice screen entirely).
- Nothing is written to the database from either the pasted-role-AI-import
  or the industry-starter path until the user explicitly proceeds past
  review, per ADR-0003 (AI is embedded suggestion, HR reviews and confirms,
  nothing auto-applied) and the conversational-onboarding spec's decision 2
  ("pre-filled and adjustable... database is untouched until create and
  continue").
- The onboarding "Score your roles" step and the separate model-choice step
  were removed after being designed and (per their specs) implemented,
  reflecting the "cut to reduce overload" product direction (memory:
  `cut-to-reduce-overload`) and the "simplicity first" priority (memory:
  `simplicity-first`): fewer decisions during first-run setup.
- `completeOnboarding`'s `MIN_CRITERIA` (5) floor exists because a
  meaningful evaluation model needs a minimum composition to produce
  credible levels; ADR-0004 documents the point-budget weighting
  (`criteria count x 3` budget) that this floor protects the bottom of.
- The Overview page's To do row always fills to exactly 3 cards (outstanding
  work first, then standing shortcuts) so the top of a finished dashboard is
  never "one card and two holes"; this is a deliberate anti-emptiness rule
  recorded directly in the current code's comments
  (`apps/dashboard/components/overview/todo-actions.tsx`).
- The Overview's To do data is derived (never stored) from the same query
  results other pages already fetch (`listRoles`, `getMethodModel`, etc.),
  matching ADR-0002's "never store what can be derived" spirit as applied
  to dashboard aggregates (`docs/superpowers/specs/2026-07-02-dashboard-todo-and-welcome-design.md`,
  "Architecture" section).

## Edge cases and error states

- **No organization yet**: a signed-in user with zero memberships sees
  nothing rendered by `OnboardingGate` (provisioning is back-office; there
  is no self-serve org creation entry point reachable this way in the
  current gate, only the in-wizard "create organization" call once a
  membership already resolves an org... in practice this state is rare
  because the first admin's own org is what onboarding builds).
- **Non-admin member in an unfinished org**: shown
  `dashboard.onboarding.waitingForAdmin`, no wizard controls (admin
  mutations would reject them server-side anyway).
- **Reload mid-flow**: resumes at the first server-incomplete step per
  `isComplete`; a reload mid-families (after the model/roles exist but
  before `onboardingCompletedAt`) resumes on families, not earlier.
- **Model creation failure** (`EnsureDefaultModel`): shows
  `dashboard.model.error` with a `retry` button that re-fires
  `createModelFromTemplate`.
- **`errors.modelExists`**: thrown by `createModelFromTemplate` if a model
  row already exists for the org; guarded against by `EnsureDefaultModel`'s
  own null-check in normal flow, but is the server-side backstop.
- **`errors.tooFewCriteria`** ("A model needs at least 5 criteria."):
  thrown by `completeOnboarding` if a model exists with fewer than
  `MIN_CRITERIA` (5) criteria. Not reachable via the current wizard's
  9-criterion standard template, but reachable if criteria were removed
  before finishing (the model editor's own removal floor, see the model
  section's dossier).
- **`errors.roleFamilyExists`** ("A family with that name already exists."):
  thrown when the families step's create/reconcile tries to insert a family
  name that already exists for the org (case-insensitive uniqueness check),
  surfaced inline in the families review/paste screen.
- **`errors.aiGenerationFailed`** ("The AI suggestion could not be
  generated."): the paste-and-analyze path's AI grouping request can fail;
  surfaced via the shared suggestion-flow's `errorSubKey` in the families
  paste view.
- **`errors.aiUnavailable`** ("AI is not configured for this environment."):
  applies to any AI-backed suggestion request, including the families
  paste-to-AI path, when the AI provider is not configured for the
  deployment.
- **`errors.invalidInput`**: the generic validator-rejection code; can
  surface from `setUiLocale` (unsupported locale) or from the starter-set
  writer `insertStarterSet`/`reconcileStarterSet`
  (`packages/backend/convex/assessment/starters.ts`) when: the payload has
  more than `MAX_FAMILIES` (20) families, more than `MAX_ROLES` (100) roles
  in total, or a family name is empty or over `MAX_FAMILY_NAME`. A role's
  `trackKey` is checked earlier, at the Convex argument-validator boundary
  (`trackKeyValidator`, built from `isTrackKey`), which rejects an
  unrecognized track before the mutation body runs. There is no
  `levelKey`/`seniorityKey` field on the starter-set input at all: a drafted
  role at this stage carries only a title and a track, never a seniority.
- **Import truncation** (not an error code, a notice): pasting more than
  `MAX_ROLES` (100) roles or producing more than `MAX_FAMILIES` (20)
  families truncates the AI-grouped result, surfaced as
  `dashboard.onboarding.families.importTruncated` rather than a hard
  failure; the rest can be added later in the register.
- **Organization name save failure** (name screen): a generic
  `dashboard.onboarding.organization.error` ("The organization could not be
  created. Try again.") for both create and rename failures; not a
  dedicated `errors.*` code, this is a component-level catch on the Better
  Auth call.
- **Country/industry save failure**: the same generic
  `dashboard.onboarding.organization.error` string via `useAutoAdvance`'s
  `failed` flag, shown next to the option cards.
- **`errors.notAuthenticated` / `errors.notAMember` / `errors.adminRequired` /
  `errors.membershipConflict`**: general auth/org-scoping guards that any
  onboarding mutation (an `adminMutation`) can raise if identity or
  membership state is inconsistent (e.g. a stale session, a since-removed
  membership); not onboarding-specific but reachable from any onboarding
  screen's mutation call.
- **Waiting-for-admin is not itself an error**: it is a deliberate blocking
  state, not a thrown error code; there is no self-serve way for a
  non-admin to advance the wizard.

## Deliberately absent

- **The template-vs-scratch model choice screen** (original 2026-06-04
  design): removed. The wizard now always seeds the standard template
  automatically; there is no "build a model from scratch" path inside
  onboarding anymore. Source: current `STEPS` array (no `model` entry) and
  `EnsureDefaultModel`'s comment: "The onboarding model step was removed."
- **AI criteria drafting during onboarding** ("Generera kriterieutkast",
  original design's scratch path): absent, because the scratch path itself
  is gone.
- **AI importance-level review during onboarding** ("Lat AI ga igenom
  betydelserna"): absent for the same reason; no model-review screen exists
  in the current wizard.
- **The "Score your roles" onboarding step**: designed and, per its spec,
  implemented, then removed. Confirmed absent by the wizard's own test
  comment. A docs writer must not describe onboarding as including a
  scoring step; role evaluation is reached later, from the roles register.
- **A dedicated language-selection onboarding screen**: never built as a
  distinct step; language derives from the chosen country
  (`defaultLanguageFor`), adjustable later only in organization settings.
- **Company size / employee count as an onboarding question**: dropped in
  the very first design's own 2026-06-05 amendment ("no longer asks for the
  number of employees"); still absent today. Employee count is meant to be
  derived once people are imported (V2/people context), not asked upfront.
- **Org logo upload during onboarding**: explicitly out of scope in the
  conversational-onboarding design and still absent.
- **Drag-and-drop/reordering in the families starter list**: explicitly out
  of scope in the conversational-onboarding design.
- **A dedicated `/todo` page and a priority ("Typ"/"Prio") toggle** for the
  Overview to-do surface: repeatedly deferred to V2 across three successive
  overview specs (2026-07-02 welcome/todo, 2026-07-02 layout enrichment,
  2026-07-24 todo-and-widgets); still absent, the current `TodoActions` row
  has no such toggle or link-out page.
- **A live, real (non-placeholder) "roles per band/level" chart on the
  Overview page** was, per the 2026-07-02 layout-enrichment spec, shipped
  first with sample/placeholder data as an explicit deferred follow-up; that
  whole chart-card iteration of the page has since been superseded by the
  current hero+TodoActions+OverviewWidgets anatomy, so no docs page should
  describe a "sample data" chart badge as current behavior.
- **Manual band/level override anywhere, including onboarding-adjacent
  flows**: never allowed (ADR-0002); the level is always the engine's
  derived outcome.
- **Model versioning**: never (ADR-0002); onboarding's model seeding is a
  one-time, unversioned creation.

## Sources read

Specs (`docs/superpowers/specs/`):
- `2026-06-04-onboarding-design.md`
- `2026-06-06-conversational-onboarding-design.md`
- `2026-06-13-onboarding-role-scoring-design.md`
- `2026-06-26-auth-onboarding-split-layout-design.md`
- `2026-07-02-dashboard-layout-enrichment-design.md`
- `2026-07-02-dashboard-todo-and-welcome-design.md`
- `2026-07-23-pay-mapping-preconditions-gate-design.md`
- `2026-07-24-overview-todo-and-widgets-design.md`

Implementation plans (`docs/superpowers/plans/`), companions to the specs above;
skimmed for facts beyond what the corresponding spec already states. None
contradicted the current-code claims above (all describe steps/screens the
code has since removed or superseded, consistent with the specs):
- `2026-06-04-onboarding.md` (companion to the 06-04 spec): read, nothing new
  beyond the spec (confirms the workspace-first architecture, the AI-action
  suggestion lifecycle, and the "Band 1 is highest" convention already
  covered by the spec and ADR-0014 note above).
- `2026-06-06-conversational-onboarding.md` (companion to the 06-06 spec):
  read, nothing new; confirms the six-screen machine (name, language,
  country, industry, model, families) as originally planned and that
  `assessment/starters.ts` was introduced here as the industry-starter-set
  writer, matching the current code's `starters.ts` cited in Edge cases
  above.
- `2026-06-13-onboarding-role-scoring.md` (companion to the 06-13 spec): read,
  nothing new; confirms the score step depended on Unit 1 (role profile =
  purpose + responsibilities) and reused `RatingStepper`/`RatingResult`, and
  that it rewired `completeOnboarding` to fire from the score step rather
  than the families step, all consistent with the step being fully removed
  in current code (Deliberately absent, above).
- `2026-06-26-auth-onboarding-split-layout.md` (companion to the 06-26 spec):
  read, nothing new; confirms `AuthShell`/`BrandPanel`/`RotatingValueLine`
  and that onboarding's step dots and account menu were meant to move into
  `AuthShell`'s slots, matching this dossier's already-flagged
  not-fully-re-verified union of `AuthShell` and the wizard's own
  `WizardShell`.
- `2026-07-02-dashboard-layout-enrichment.md` (companion to the 07-02
  layout-enrichment spec): read, nothing new; confirms the sample-data
  `RolesPerBandChart` (a bar chart over a module-constant sample dataset,
  not real data) and the two-column grid, both already noted above as
  superseded by the current hero+TodoActions+OverviewWidgets anatomy.
- `2026-07-02-dashboard-todo-and-welcome.md` (companion to the 07-02
  todo-and-welcome spec): read, nothing new; confirms `buildTodo`/`useTodo`
  are pure derivations over `listRoles`+`getMethodModel` with no stored
  aggregate, and states `MAX_ITEMS = 4` per group in that iteration's list
  (superseded by the current 3-card `TodoActions` row, not a per-group cap).
- `2026-07-24-overview-todo-and-widgets.md` (companion to the 07-24 spec):
  read, nothing new; confirms the todo-section/widgets-section split and
  that `welcome-greeting.tsx`/`quick-actions.tsx`/`lib/todo.ts` were reused
  verbatim rather than rewritten in that iteration, consistent with those
  files still existing in current code.

ADR:
- `docs/adr/0014-terminologi-niva-senioritet-steg.md`

Other:
- `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md` (row
  assignment)
- `.superpowers/sdd/00-overview/section-pages.md` (target pages)

Current code read (verified behavior, takes precedence over the above docs):
- `apps/dashboard/components/onboarding/onboarding-wizard.tsx`
- `apps/dashboard/components/onboarding/onboarding-gate.tsx`
- `apps/dashboard/components/onboarding/name-screen.tsx`
- `apps/dashboard/components/onboarding/country-screen.tsx`
- `apps/dashboard/components/onboarding/industry-screen.tsx`
- `apps/dashboard/components/onboarding/ensure-default-model.tsx`
- `apps/dashboard/components/onboarding/families-step.tsx`
- `apps/dashboard/hooks/use-families-draft-flow.ts` (skimmed, first ~120
  lines read in full)
- `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx` (header
  and the "model + score steps were removed" comment)
- `apps/dashboard/app/(app)/page.tsx`
- `apps/dashboard/components/overview/todo-actions.tsx`
- `apps/dashboard/components/overview/overview-status-line.tsx`
- `apps/dashboard/components/overview/welcome-greeting.tsx`
- `apps/dashboard/components/auth/*` (directory listing only, to confirm
  `auth-shell.tsx`/`brand-panel.tsx` exist; contents not fully re-verified
  against the split-layout spec)
- `packages/backend/convex/accounts/onboarding.ts`
- `packages/backend/convex/accounts/organization.ts` (`completeOnboarding`,
  `MIN_CRITERIA` usage)
- `packages/backend/convex/evaluationModel/model.ts`
  (`createModelFromTemplate`, `seedStandardModel`)
- `packages/backend/convex/evaluationModel/method.test.ts` (9-criteria
  comment)
- `packages/backend/convex/auth.ts` (`disableSignUp`)
- `packages/core/src/weighting.ts` (`MIN_CRITERIA = 5`)
- `packages/constants/src/starterSet.ts` (`MAX_FAMILIES = 20`,
  `MAX_ROLES = 100`)
- `packages/i18n/messages/en.json` (`dashboard.onboarding.*` namespace in
  full, `errors.*` namespace in full)
