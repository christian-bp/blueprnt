# Conversational Onboarding Design: One Question per Screen + Family Starters

Design spec for the conversational-onboarding slice. Read together with the
implementation plan
`docs/superpowers/plans/2026-06-06-conversational-onboarding.md`.

## Goal

The onboarding becomes conversational: one question per screen, centered with
a large heading and big option cards (inspired by the founder's reference
screenshot), navigated by a reusable animated dots component at the bottom
where completed steps are clickable. A new final step sets up rollfamiljer
and roller, pre-filled from an industry starter set matching the industry
chosen earlier. Nothing is written to the database from the starter until the
user proceeds.

## Decisions (founder, 2026-06-06)

1. **Industry starter sets contain families + example roles**, each role with
   a suggested track and level (e.g. IT/Telekom: Engineering with Software
   Developer IC2, Tech Lead Lead2; Vård: Vård with Sjuksköterska IC2).
2. **Pre-filled and adjustable**: the families step opens with the starter
   set as an editable local list (remove, add, rename); the database is
   untouched until "create and continue". No cleanup of unwanted seeds.
3. **One question per screen**: the merged organization form splits into
   small screens; selects become large option cards; currency is derived
   from the country (with an inline override) so it needs no own screen.
4. **Reusable animated dots**: a bottom-centered step indicator where the
   active dot stretches into a pill, completed steps are clickable to jump
   back, future steps are disabled.
5. **Background deferred**: no gradient backdrop in this slice.

## Screen flow (6 dots)

```
1 Namn       text input; create mode creates the Better Auth org on
             continue; revisit prefills and renames only when changed
             (authClient.organization.update, already used today)
2 Språk      5 option cards; keeps the instant preview behavior
             (setPreviewLocale on select; browser-locale detection on the
             create flow's first mount)
3 Land       5 option cards; picking a country derives the currency
             (se->SEK, no->NOK, dk->DKK, fi->EUR, other->EUR) shown as a
             small inline override Select under the cards; continue saves
             country + currency together
4 Bransch    9 option cards (3-column grid)
5 Modell     the existing choice (template recommended / scratch) as two
             large cards, then the model review/editor as today; the
             step's CTA becomes "Continue" on BOTH terminal screens
             (ModelReview for the template path AND CriterionEditor for
             the scratch path); completeOnboarding moves to screen 6
6 Familjer   the new step: industry starter pre-filled, editable, skip
             link; "create and continue" runs createStarterSet (when the
             list is non-empty) and then completeOnboarding
```

- Screens 2-4 each save their field(s) via the existing partial
  `updateOrganizationSettings` (already an upsert with optional args).
- Resume mapping from server state: organization null -> 1; language unset
  -> 2; country or currency unset -> 3; industry unset -> 4; otherwise -> 5
  (the model screen, which opens in its review sub-flow when a model already
  exists). The families screen (6) is reached ONLY via the model step's
  continue (session-local progress): a reload after the model exists but
  before completion resumes at the model review, whose continue is an
  idempotent no-op. The wizard still OWNS the session once started (the
  established gate behavior is unchanged).
- The waiting-for-admin state and the OnboardingHeader (logo + account menu)
  stay. Screens center vertically with large headings; the dots sit fixed at
  the bottom center.

## Components

- **OnboardingDots** (reusable): props `steps: { key, label }[]`,
  `activeIndex`, `maxReachedIndex`, `onSelect(index)`. Renders one dot per
  step; the active dot stretches into a pill (Motion layout spring, shared
  SPRING, reduced motion respected globally); steps with index <=
  maxReachedIndex are buttons (aria-label = step label, aria-current="step"
  on the active one); future steps render disabled. Sibling dots reposition
  with a layout spring when the pill moves (legitimate animated transition).
- **OptionCard** (reusable): a large selectable button card with title,
  optional description, optional badge (the template card's "Recommended"),
  selected state (ring). Used by the language/country/industry screens and
  the model choice.
- Screen components: `name-screen`, `language-screen`, `country-screen`,
  `industry-screen` (thin wrappers over the existing logic lifted from
  organization-setup-step, which is deleted), the restyled model step, and
  `families-step`.

## Industry starter sets (backend)

- Content modules `industryStarters.content.{sv,en}.ts` keyed by the nine
  industry keys (publicSector, manufacturing, consulting, retail, itTelecom,
  healthcare, finance, realEstateConstruction, other): per industry a list
  of families `{ name, roles: { title, trackKey, levelKey }[] }`. Track and
  level keys reference the fixed schema (IC1..IC5, Lead1..Lead3, M1..M3).
  Localized like the standard template content; the org language picks the
  variant (sv, else en).
- `assessment/starters.getIndustryStarter` (orgQuery, locale arg): reads the
  org's saved industry and returns the starter list. Display only; no
  writes.
- `assessment/starters.createStarterSet` (orgMutation, member scope): takes
  the user-adjusted list `{ families: { name, roles: { title, trackKey,
  levelKey }[] }[] }` and creates everything in ONE transaction: family
  names validated like createRoleFamily (trimmed, bounded, case-insensitive
  unique incl. against existing families); role titles trimmed, bounded;
  trackKey/levelKey resolved against the org's model (unknown keys ->
  errors.invalidInput). Roles insert as drafts with EMPTY function, team,
  purpose, and responsibilities: starter roles are honest drafts the user
  completes later (no invented data; rollfamilj stays separate from
  funktion/avdelning per the 2026-06-06 decision). Audited with the
  existing events (roleFamily.created, role.created), each payload carrying
  `source: "starter"`.
- Bounds: at most 20 families and 100 roles per call (defensive; the
  starter sets are far smaller).

## Settled design

- The families step is LAST so roles can reference the model's tracks and
  levels; completeOnboarding moves from the model review to this step.
- Skip is a first-class affordance: skipping creates nothing and completes
  onboarding.
- Editing in the step is local state only: rename family, edit role title,
  change track/level (selects), remove rows, add family, add role.
- Empty starter (industry "other" still has a generic set; a fully emptied
  list) simply enables skip semantics on the primary CTA.
- The dots' jump-back keeps server state authoritative: revisiting a screen
  re-saves on continue; the resume frontier (maxReachedIndex) derives from
  the same server state as the resume mapping, plus session-local progress
  past screen 5.
- organization-setup-step.tsx is deleted; its tests are replaced by
  per-screen tests. The model-setup-step keeps its internal logic (choice,
  resume via templateKey, discard/change-choice) restyled with OptionCards.
- No schema changes: families/roles reuse the existing tables. The new
  starters module needs `bun x convex codegen` (api.d.ts map entry).

## i18n

New namespace `dashboard.onboarding.screens.*` (name/language/country/
industry headings + the currency override label), `dashboard.onboarding.families.*`
(heading, description, skipCta, createCta, addFamilyCta, addRoleCta, labels,
error), `dashboard.onboarding.dots.*` (aria labels). The old step-header keys
(`step`, `steps.*`) are removed with the header text they powered. en first,
sv mirrored, nb/da/fi machine drafts. Existing organization/profile keys are
reused where the labels still fit (languages.*, countries.*, industries.*).

## Out of scope

- The gradient background (deferred by the founder)
- AI assistance inside the families step
- Drag-and-drop or reordering in the starter list
- Org logo upload; company-size question (still derived later)
- Editing starter content after creation (the register owns that)

## Acceptance criteria

1. All suites green; typecheck + Biome clean; i18n parity holds.
2. A fresh user walks: name -> language -> country (currency derived,
   override works) -> industry -> model -> families (pre-filled from the
   chosen industry, in the org language) -> dashboard; reload mid-flow
   resumes at the right screen.
3. The families step creates exactly the adjusted list in one transaction
   (families + draft roles with suggested track/level), audited with
   source "starter"; skip creates nothing; both paths complete onboarding.
4. Starter roles never carry invented function/team/purpose text; they are
   drafts completable in the register.
5. The dots component animates the active pill, allows jumping to completed
   screens only, and is reusable (no onboarding-specific imports).
6. Duplicate family names against existing org families are rejected with
   the translated errors.roleFamilyExists.
7. The instant language preview behavior survives the split (selecting a
   language switches the UI immediately).
8. No em dashes; no hardcoded display text; weights still never shown as
   numbers anywhere.
