# Onboarding Design: First Login to Working Evaluation Model

Design spec for the onboarding slice. Read together with the implementation plan
`docs/superpowers/plans/2026-06-04-onboarding.md`.

## Goal

A brand-new admin user signs in for the first time and is guided through:
creating the workspace, filling the company profile, and setting up the
evaluation model (standardmall template OR from scratch, with embedded AI
assistance). When done, the dashboard unlocks. This is the entry point to the
V1 core loop modell -> roller -> poang -> band (PLAN-V1 section 1 and 6).

## Decisions (founder, 2026-06-04)

1. **Workspace creation is part of onboarding.** Accounts are provisioned by us
   (sign-up stays disabled, `disableSignUp: true`). The first user of a company
   is created as the intended admin; on first login they create the workspace
   themselves (Better Auth org plugin, `creatorRole: "admin"` already
   configured in `packages/backend/convex/auth.ts`).
2. **Template choice with a real scratch path.** Onboarding offers both: the
   standardmall (full seed) and from scratch (empty criteria set + a minimal
   criterion editor that E2 will later reuse). Scratch still seeds the fixed
   track schema (IC/Lead/M is fixed in V1, PLAN-V1 9.6) and the 7 default band
   thresholds (configurable later in E2).
3. **AI is part of the onboarding slice** (extends ADR-0003's V1 scope; the
   plan amends the ADR). Two embedded affordances, both pure suggestion flows:
   - Scratch path: "Generera kriterieutkast" drafts criteria (name,
     description, help text, importance label, 0-5 anchors) from the company
     profile + an optional free-text business description.
   - Template path: "Lat AI ga igenom betydelserna" suggests importance-level
     adjustments per criterion with motivations.
   HR reviews and confirms per item; nothing is applied automatically.
4. **Template content comes from the Excel prototype.** The exact criterion
   descriptions, help texts, all 54 anchor texts, level definitions, and
   guardrail intervals live only in the Excel file. The founder provides it in
   `~/Downloads`; the plan has an extraction task that pauses if the file is
   missing.

## Flow

```
Authenticated user
  └─ getOnboardingStatus (reactive query, no orgId arg)
       ├─ workspace == null            -> Step 1: Create workspace
       │     authClient.organization.create({ name, slug })
       │     (onOrganizationCreate trigger seeds empty workspaceProfile + audit)
       ├─ !profileComplete             -> Step 2: Company profile
       │     updateWorkspaceProfile (existing adminMutation, audited)
       │     fields: country, currency, language, employeeCount, businessType
       ├─ !hasModel                    -> Step 3: Model setup
       │     ├─ Template:  createModelFromTemplate (one transaction, audited)
       │     │             -> review sub-step (+ AI importance review)
       │     └─ Scratch:   createEmptyModel -> criterion editor
       │                   (+ AI criteria drafts)
       └─ all done                     -> DashboardShell
```

- The gate is a reactive component swap inside `<Authenticated>` (same pattern
  as the existing sign-in swap). No new routes, no URL locale (PLAN-V1 7).
- The wizard OWNS the session once started: `hasModel` flips reactively the
  moment the model row is created, so the gate keeps the wizard mounted until
  it calls `onFinished` (otherwise the model review screen and the AI panels
  would unmount mid-flow). On a later sign-in the session never starts and
  the dashboard renders directly.
- Non-admin members in an unfinished workspace see a "waiting for admin"
  screen (admin mutations would reject them anyway).
- V1 assumption: one workspace per user; the status query uses the first
  membership.

## Backend surface (all org-scoped except the status query)

| Function | Kind | Notes |
| --- | --- | --- |
| `betterAuth.membership.listMembershipsForUser` | component query | member by `userId` index + org name |
| `accounts/onboarding.getOnboardingStatus` | query (authed) | `{ workspace, profileComplete, hasModel }`, null when signed out |
| `evaluationModel/model.createModelFromTemplate` | adminMutation | seeds 1 model + 9 criteria + 54 anchors + 3 tracks + 11 levels + guardrails + 7 thresholds in one transaction; guard `errors.modelExists`; audit `model.created` |
| `evaluationModel/model.createEmptyModel` | adminMutation | model + fixed tracks/levels + default thresholds, zero criteria |
| `evaluationModel/model.getModel` | orgQuery | full model readout; returns `importanceLevel` (1-7), never weights |
| `evaluationModel/criteria.addCriterion` / `removeCriterion` | adminMutation | minimal editor; validates importance against the fixed scale and exactly 6 anchors |
| `ai/suggest.requestModelDraft` / `requestImportanceReview` | adminMutation | insert `generating` suggestion + `ctx.scheduler.runAfter(0, internal action)` |
| `ai/generate.generateModelDraft` / `reviewImportances` | internalAction ("use node") | AI SDK v6 `generateText` + `Output.object`, EU provider |
| `ai/persist.saveDraft` / `saveImportanceReview` / `markFailed` | internalMutation | status flips; failures persist an error CODE (i18n key), never text |
| `ai/suggest.confirmModelDraft` / `confirmImportanceReview` / `rejectSuggestion` | adminMutation | apply accepted parts, audit `ai.suggestionConfirmed` + `model.updated` |
| `ai/suggest.getOpenSuggestions` | orgQuery | drives the reactive AI panel |

## AI architecture (researched + adversarially verified 2026-06-04)

- **Plain action pattern, not `@convex-dev/agent`.** The agent component is
  built for threaded chat (threads/messages/streams/files tables, memory,
  tool loops); our flow is one-shot structured suggestions that HR confirms
  (ADR-0003: embedded assistant, never a chatbot). Background execution =
  `ctx.scheduler.runAfter(0, ...)`; the reactive suggestions query updates the
  UI, no streaming, no polling.
- **AI SDK v6:** `generateObject` is deprecated in v6; new code uses
  `generateText` + `Output.object({ schema })` (zod). Floor `ai@^6.0.35`,
  `@ai-sdk/mistral@^3`. `@convex-dev/workflow` only becomes relevant if AI
  flows turn multi-step with checkpoints; not now.
- **EU provider:** Mistral La Plateforme direct (EU processing, no training on
  the paid API per DPA; request Zero Data Retention in the DPA, it is
  approval-gated, not a self-serve toggle). Fallback: Azure OpenAI EU Data
  Zone (Sweden Central). **Vercel AI Gateway is excluded:** it cannot pin EU
  routing (verified against open feature requests), which violates ADR-0001.
- **Provenance:** every suggestion row carries `source: "ai"`,
  `model: { provider, model }`, status lifecycle
  `generating -> suggested -> confirmed | rejected` (+ `failed` with
  `errorCode`). Confirming is the only path into real model rows, and it is
  audit-logged. AI never touches score/band (ADR-0002 untouched).
- ADR-0003 gets an amendment: V1 scope extension (model-setup assistance) +
  the provider decision + the gateway exclusion.

## Suggestion lifecycle (suggestions table, extended)

```
target.kind            suggestedValue                              confirm action
"model.draft"          { criteria: [{ name, description,           confirmModelDraft inserts
                         helpText, importanceLevel, anchors[6] }] }  accepted criteria + anchors
"model.importanceReview" { adjustments: [{ criterionId,            confirmImportanceReview
                         suggestedImportanceLevel, motivation }] }   patches importanceLevel
```

Status: `generating | suggested | confirmed | rejected | failed`;
`errorCode` holds an `errors.*` i18n key on failure. The table is empty in
every deployment, so widening the validators is a safe schema change.

## Template data

`evaluationModel/standardmall.ts` (structure: keys, orders, importance
defaults, thresholds 530/450/400/340/285/220/0, track/level keys, Lead-3
definition + guardrails from standardmall.md) + per-locale content modules
(`standardmall.content.sv.ts`, `.en.ts`) holding the user-facing prose
(criterion name/description/helpText, anchors, level definitions). Seeding
copies the workspace-language content (sv if `language == "sv"`, else en)
into the org's own rows; after seeding it is workspace data, freely editable
in E2. Swedish prose comes from the Excel; English starts as flagged drafts.

## Out of scope (deliberately)

Full model editing beyond add/remove criterion (E2); custom anchors editing UI
polish; criterion rationale + bias-review data entry (E2); roles, ratings,
score/band engine, results views (E3-E5, next slices); calibration, import,
method appendix (E5/E7); model versioning (never, ADR-0002); manual band
override (never); role-family entity (PLAN-V1 9.14); employee placement (V2).

## Open follow-ups recorded for later slices

- Band 7 description is missing in the source material (standardmall.md notes
  this); review screen simply lists thresholds for now.
- nb/da/fi onboarding copy ships as machine drafts flagged for native review.
- Editor invites during onboarding (member management) is E1 scope already
  partially built (invitation flow exists); not surfaced in the wizard.

## Amendment 2026-06-05

The company-profile step no longer asks for the number of employees
(founder decision during the walkthrough). Employee count is derived
automatically in V2 when employees are imported (people context); the
optional `workspaceProfiles.employeeCount` field remains as the landing
spot for that derivation. Profile completeness and the AI context treat
it as optional.

Also 2026-06-05: the profile field "type of business" (businessType) is
replaced by "industry" (Swedish: bransch) with a standard taxonomy
(public sector, manufacturing, consulting, retail, IT/telecom,
healthcare, finance, real estate & construction, other). The old values
were internal template typology, not user-recognizable company
attributes.

Also 2026-06-05: the workspace default language is chosen in step 1
(create workspace) and saved right after the organization is created
(updateWorkspaceProfile is now an upsert to make that safe); step 2
keeps country, currency, and industry.

Also 2026-06-05: onboarding completion is explicit server state
(workspaceProfiles.onboardingCompletedAt, set by the audited
completeOnboarding mutation when the wizard finishes). The gate no
longer infers completion from hasModel, and step 3 resumes into the
review screen or the editor when a model already exists.

Also 2026-06-05: revisited steps walk forward sequentially (step 1 save
goes to step 2, never skips ahead), and the model choice is reversible
during onboarding: an audited discardModel mutation (blocked once
onboarding completes or any role exists) deletes the model and its
children plus stale model.* suggestions, returning the user to the
choice screen.

Also 2026-06-05: the dashboard UI language follows the resolution chain
user locale -> workspace default language -> en, reactively via the
getUiLocale query (changing the default language in step 1 switches the
page language immediately), with a locale cookie so SSR serves the
last-known language on reload. No locale in the dashboard URL (PLAN-V1
section 7).

Also 2026-06-05: standard-template model content is localized at read
time. Template-seeded criteria carry their standardmall key (criteria.
templateKey) and pristine rows are served from the per-locale content
modules in getModel's requested locale (sv/en today, en fallback);
tracks and levels localize by their stable keys. Custom and AI-authored
rows render as stored. E2 editing must clear templateKey on any text
edit (workspace takes ownership of the text).

Also 2026-06-05: criterion importance is adjustable on the model review
screen (the canonical per-workspace customization). The audited
updateCriterionImportance mutation patches only importanceLevel and
never clears templateKey, so template texts stay localized. Text and
threshold editing remain E2 scope.

Also 2026-06-05: the model review screen shows a labeled criteria list
with descriptions, supports adding and removing criteria (shared
AddCriterionForm with the scratch editor), and no longer displays band
thresholds (numeric internals belong in the result views, not the
model setup).

Also 2026-06-05: the model review starts read-only; an Edit toggle
reveals importance selects, hover-trashcan removal (shared criterion
item with the scratch editor), and the add-criterion form.

Also 2026-06-05 (amendment): criterion removal uses the same inline
two-step confirm as the model-choice change (no dialog).

Also 2026-06-05: onboarding steps 1 and 2 are merged into a single
workspace-setup screen (name, default language, country, currency,
industry); the wizard is two steps: workspace setup, then model setup.

Also 2026-06-05: the tenant concept is renamed from workspace
(arbetsyta) to organization (organisation) everywhere: domain docs,
code identifiers, i18n keys and copy, and audit event strings. Better
Auth already used organization, so the domain language now matches the
implementation. V2's org-structure tree must never be called just
"organisation" (see the accounts glossary note).
