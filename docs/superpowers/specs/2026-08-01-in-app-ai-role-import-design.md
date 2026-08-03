# In-app AI role import

**Goal:** Give the role register the same paste-your-roles AI flow onboarding has, reachable from the roles page, as a full-screen wizard that only ever ADDS. New roles land in existing families where they fit, duplicates are skipped, nothing existing is renamed or archived, and the created roles get their job profiles drafted so they are immediately evaluatable.

## Context (audit)

Onboarding screen 6 (`apps/dashboard/components/onboarding/families-step.tsx` over `hooks/use-families-draft-flow.ts`) already does the hard part: the user pastes a role list, `requestStarterImport` schedules `generateStarterImport`, the AI groups the list into role families, and the proposal seeds an editable review (`components/onboarding/families-review.tsx`) that the user confirms. There is no equivalent inside the app: the roles page offers only `CreateRoleDialog`, one role at a time.

That flow cannot be mounted as-is, because both of its persist paths are destructive against an org that already has roles:

- `confirmStarterImport` calls `insertStarterSet`, which throws `roleFamilyExists` the moment a proposed family name collides with an existing one (`assessment/starters.ts:148`). In-app, "Engineering" almost certainly already exists.
- `reconcileStarterSet` archives every active role NOT present in the payload (`assessment/starters.ts:562`). That is the onboarding revisit's whole-org semantics and would silently retire the register.

The in-app flow therefore needs its own persist contract. Everything below the flow orchestration (the AI request, the suggestion lifecycle, the sanitizer, the editable review, the prefill span) is reusable as-is.

Shape reference: the people import (`app/(app)/people/import/page.tsx` over `components/people/import/import-wizard.tsx`) is a full-screen `WizardShell` takeover reached from a `Link` styled as the primary header button. This wizard follows that shape.

## Decisions

1. **Purely additive.** The wizard only adds. Nothing existing is archived, renamed, or re-tracked. A proposed family name matching an existing family means "add these roles into it".
2. **Paste only.** One textarea, no file upload, no industry template.
3. **Prefill the created roles.** `prefillRoleProfiles` gains an optional `roleIds` scope so the import drafts profiles for what it created and nothing else.
4. **Extend `FamiliesReview`, do not fork it.** It moves to the components root and gains one optional annotations prop; onboarding renders unchanged.
5. **Roles page only**, with the import as the filled primary action and `New role` demoted to outline, matching the people header.

## Non-goals

- No entry point on the family page, and no family-scoped mode.
- No file upload (CSV/XLSX) input.
- No industry starter template in-app.
- No change to what onboarding does. The refactor in step 1 is behaviour-preserving; its contract is that all 32 existing `families-step.test.tsx` tests pass unchanged.
- No new schema fields or tables. Nothing to migrate.

## Global constraints

- `packages/ui/src/*` is vendor code and is not touched.
- No new suggestion table fields. The new kind reuses the existing `suggestions` row shape.
- The AI receives role-level and org-level content: the pasted text, the org's existing family names, and its company profile (industry, country code, employee count, locale). Nothing person-shaped is read from our own tables, and the `people` context is never touched (Role != Person). Two things are worth stating exactly rather than reassuringly. First, the pasted free text is forwarded verbatim, and people do paste "Anna Andersson, HR Manager"; the prompt (`ai/generate.ts`) instructs the model to extract the title and drop the personal name. Second, that instruction is the only programmatic control: the output schema's `title` is a plain string, so a model that ignored the instruction could return a name embedded in a title, and `sanitizeStarterImport` clamps length, track and duplicates but does no name detection. Such a title would then reach `roles.title` and its `role.created` audit diff, neither of which is erasable as person data. What actually prevents it is the human review: every title is on screen and editable before confirm, and the payload is built from the edited draft. So the honest position is that a pasted name can reach the EU-hosted model and is stopped by prompt plus human review, not by a filter. Relative to onboarding's import this adds one new field to the prompt (`existingFamilies`, org-level); the pasted-text exposure is identical.
- Every new user-facing string goes through i18n in all five locales (en, sv, nb, da, fi). The Nordic ones are drafts and get flagged for native review.
- The AI proposal stays a suggestion the user confirms (ADR-0003). The scoped prefill softening is the same one onboarding already documents in `ai/prefill.ts`.

## Part 1: the refactor

`useFamiliesDraftFlow` is 546 lines carrying 13 pieces of state and two adjust-state-during-render seed blocks that guard against each other. Seven of its concerns are identical to what the in-app flow needs; six differ, and four of those six exist only in onboarding (the industry template path, resume-from-existing, the three-way `restart()`, the org-wide prefill scope).

A `mode` flag would put all thirteen in one hook with roughly seven branch points, and would make the in-app path carry template and resume logic it never runs. Instead the shared concerns are extracted into units both surfaces compose.

### `hooks/use-pasted-role-draft.ts`

Owns: `rawText` and the `starterImportInputSchema` gate, `useSuggestionFlow`, `requestPending` / `requestFailed`, `onAnalyze`, the AI seed block (Zod-parse the stored value, coerce unknown track keys against `model.tracks`, seed the draft), the `lastDismissedId` latch and the dismiss-the-proposal restart, `useDraftFamilies`, and `trackOptions`.

Parameterised by:

| Input | Onboarding | In-app |
| --- | --- | --- |
| `kind` | `SUGGESTION_KINDS.starterImport` | `SUGGESTION_KINDS.roleImport` |
| `request` | `requestStarterImport` | `requestRoleImport` |
| `canSeed` | today's guard: `existingRoles` resolved and empty, and `!createdViaTemplate` | `true` |
| `resume` | `true`: the step is a stage of a longer flow, so a proposal opened before a reload is the same piece of work | `false`: every visit starts over, so a proposal that was already open is dismissed on entry and only this visit's own may seed |

`canSeed` is the parameterisation that replaces the mode flag, and it is the one place where a mistake silently regresses onboarding (the AI block hijacking the screen from the template create). It gets dedicated tests.

`resume` is the second such switch. With it false the hook remembers the id its own `analyze()` opened (the request mutation returns it), gates the seed on that id, reports `ownStatus` as `idle` for any other row so a leftover cannot put a wait or an error on the paste screen, and sends one `rejectSuggestion` per leftover row it sees.

### `hooks/use-profile-prefill.ts`

Owns the prefill span: the `prefilling` flag, the progress pair, the single best-effort retry when `failed > 0`, and the hard-reject path. Takes an optional `roleIds` scope, which also selects the progress denominator (all roles for onboarding, the created ids in-app).

### `components/pasted-roles-field.tsx`

The labelled textarea block: `Label` plus `HelpMorphButton`, `Textarea` with `TypewriterPlaceholder` and the `MAX_STARTER_IMPORT_TEXT` cap, and the `aria-describedby` hint. i18n keys are injected, so each surface keeps its own copy. The footer is NOT part of it (onboarding's footer carries the template CTA; the wizard's does not).

### What stays where

`useFamiliesDraftFlow` keeps the template path, resume-from-existing, and the reconcile finish, composing the two hooks above. It sheds roughly 200 lines. `useRoleImportFlow` keeps the existing-families resolution, the additive finish, and the exit navigation.

`components/onboarding/families-review.tsx` moves to `components/families-review.tsx`. Two surfaces own it, so per the file-ownership rule it belongs at the components root. It has no test today (only indirect coverage through `families-step.test.tsx`) and gains one.

`hooks/use-draft-families.ts` and `lib/family-dnd.ts` are NOT modified. The additive annotations are derived, not stored (see Part 3).

## Part 2: backend contract

### Suggestion kind

`packages/constants/src/suggestions.ts` gains `roleImport: "role.import"`.

Separate from `starter.import` for two reasons: `useSuggestionFlow` is kind-scoped, so neither surface can ever pick up the other's open proposal; and AI spend is attributed per kind, where "roles imported in-app" and "the onboarding starter set" are genuinely different lines.

### `requestRoleImport(rawText, locale)`

`orgMutation`, member scope, in `convex/ai/suggest.ts` beside its twin. Identical to `requestStarterImport` except that it also reads the org's family names via the `roleFamilies` `by_org` index and passes them to the generate action.

### `generateStarterImport` gains `existingFamilies?: string[]`

One prompt line when the array is non-empty: the organization already has these role families; reuse an exact name when a pasted role fits one, and create a new family only for roles that fit none. The output schema, `sanitizeStarterImport`, the 20/100 caps, and the save/markFailed paths are unchanged.

One generate action serves both kinds. The generation is identical; only the kind stored on the suggestion row differs. The name is kept (a wide rename would add diff noise for no behaviour change) because the action produces the shared starter-set contract in both cases.

### `confirmRoleImport(suggestionId, families)`

`orgMutation`, member scope, in `convex/ai/suggest.ts`, backed by a new `insertAdditiveRoles` helper in `convex/assessment/starters.ts` beside `insertStarterSet`.

Payload shape:

```ts
const additiveFamilyShape = v.object({
  // Present: add into this existing family. Absent: create it from `name`.
  familyId: v.optional(v.id("roleFamilies")),
  name: v.string(),
  roles: v.array(v.object({ title: v.string(), trackKey: trackKeyValidator })),
})
```

Validate the whole payload before any write, the discipline `reconcileStarterSet` already uses, so a rejection rolls back cleanly:

- the suggestion is this org's, has kind `role.import`, and is `suggested`, else `notFound`
- `families.length <= MAX_FAMILIES` and total roles `<= MAX_ROLES` (the existing per-payload constants)
- every present `familyId` resolves inside the org, else `notFound`
- every new family name, trimmed, is non-empty, within `MAX_FAMILY_NAME`, and collides case-insensitively with neither an existing family nor another new name in the payload, else `roleFamilyExists`
- every role title, trimmed, is non-empty and within `MAX_ROLE_TITLE`, and `isTrackKey(trackKey)` holds

Then write:

- new families insert with `uniqueSlug(ctx, "roleFamilies", orgId, name)` and log `roleFamilyCreated` with `source: "aiImport"` and a per-run `batchId`
- roles insert with empty `function` / `team` / `purpose` / `responsibilities` and `uniqueSlug(ctx, "roles", orgId, title, { prefix: familySlug })`, logging `roleCreated` with the same `source` and `batchId` and the same `buildCreateChanges` field list `insertStarterSet` uses

The family-slug prefix is deliberate: `createRole` passes it, `insertStarterSet` does not, so an onboarding-created duplicate title falls straight to a random short-id suffix. The additive path matches its in-app peer.

#### The skip rule

A role is **skipped, not rejected**, when its lowercased title already matches a non-archived role in its target family. Duplicates within the payload skip the same way, keeping the first occurrence.

Rationale: the DB duplicate is the expected case the additive design exists to handle, re-pasting an overlapping list must stay safe, and failing a 40-role import after the user has finished reviewing it would be hostile. The review flags both cases live, so a skip is never a surprise.

A payload family whose roles are ALL skipped creates nothing: an existing family is simply left alone, and a new family is not inserted (an empty family would be pure noise in the register). When every role in the whole payload is skipped, nothing is written and the suggestion closes as `rejected`, the same close-out an emptied list gets.

The comparison must be the one `assertUniqueRoleTitle` (`assessment/roles.ts:74`) already uses: case-insensitive, scoped to the family, ignoring archived rows. To keep one source of truth, extract an exported `roleTitleKey(familyId, title)` from it and build the lookup set in `insertAdditiveRoles` from the same helper. Consequence worth stating: an ARCHIVED role with a matching title does not block, so the import creates a fresh active one, exactly as `createRole` does today.

#### Close-out

The suggestion patches to `confirmed` when anything landed and `rejected` when nothing did, mirroring `confirmStarterImport`. The `aiSuggestionConfirmed` row carries `kind`, `familyCount` (new families only), `roleCount`, `skipped`, and the created tree.

Return value, unlike `confirmStarterImport`'s `v.null()`:

```ts
{ createdRoleIds: Id<"roles">[], familyCount: number, roleCount: number, skipped: number }
```

`createdRoleIds` is what scopes the prefill; the counts drive the done screen.

### Prefill scope

`prefillRoleProfiles` (`convex/ai/prefill.ts`) gains `roleIds: v.optional(v.array(v.id("roles")))`, forwarded to `collectPrefillTargets` (`convex/ai/prefillData.ts`) which filters targets to that set. The org scope, the membership re-check, and the exclusion of non-empty profiles are untouched.

Onboarding passes nothing and behaves exactly as today. Without this, an in-app import of 3 roles would draft profiles for every empty-profile role in the org: real spend, and an audit row each.

### Reserved role slugs

`uniqueSlug` (`convex/lib/slug.ts`) reserves nothing today, so a role titled "Families" already slugs to `families` and becomes permanently unreachable behind `/roles/families/[familySlug]`. Adding `/roles/import` adds "Import" to that set.

Fix in the same change: a module constant keyed by slug table, `roles: ["import", "families"]`, consulted by `isTaken` so a reserved base falls through to the prefixed form and then the short-id suffix. `roleFamilies` needs no entries (a family slug sits under `/roles/families/`, where no static sibling exists).

## Part 3: the wizard and the review

### Route and frame

`app/(app)/roles/import/page.tsx` sets the page title and renders `components/roles/import/role-import-wizard.tsx`. The static segment beats `[roleSlug]`; `/roles/families/[familySlug]` is the precedent.

The wizard uses `WizardShell` with a ghost "Back to roles" in `headerLeft`, `OnboardingDots` in the footer over two steps (Paste, Review), and the people wizard's `AnimatePresence` crossfade with the lagged `displayedStep` scroll reset. `contentClassName="max-w-3xl"`: the review cards need more than the 2xl reading column and nothing like the map step's 5xl.

Phases: `paste` -> `generating` -> `review` -> `prefilling` -> `done`.

The model, families and roles queries fire on mount, so the paste step never waits on data. Its controls are static i18n text and render as their real components immediately, per the skeleton rule.

### Paste step

`PastedRolesField` plus a `NextButton` gated on `starterImportInputSchema`. No template CTA, so the footer holds one action. A failed request or a failed generation renders an alert BELOW the CTA (so nothing on screen reflows) with the textarea contents intact, matching onboarding.

### Review step

**Family identity is derived live from the name.** The name input stays editable on every card, and a badge reflects what the current name resolves to: matching an existing family case-insensitively shows `existing` and means "add into it", anything else shows `new`.

This deviates from the first sketch, which locked an AI-matched family's name as static text. Locking makes an AI match impossible to undo: if the model folds "Sales Engineer" into the existing Sales family and the user wants it separate, there is no way out of the review. Deriving identity from the name handles both directions with one rule, and makes renaming a new family onto an existing name merge instead of erroring. The badge flipping as the user types doubles as the signal that this name is a lookup key and not an org-wide rename.

Remove on a family drops those roles from the import. It never touches the real family.

**Duplicate marking is derived the same way**, from each title against its CURRENT target family, so it updates on a rename and on a drag between families with no stored flag to keep in sync. A duplicate row renders muted with an "already exists" note; its input stays editable, because editing the title is the natural fix (rename to "Senior Backend Engineer" and it becomes creatable).

All of this is a pure function in a new `apps/dashboard/lib/role-import.ts`:

```
resolveImportTargets(draft, existingFamilies, existingRoles)
  -> families: { familyId | name, badge: "existing" | "new", colliding: boolean,
                 nameMissing: boolean }
     roles:    { title, trackKey, duplicate: boolean }
     payload:  the confirmRoleImport families argument
     counts:   { roles, families, skipped }
```

**`nameMissing` was added during implementation**, after a review found that a card with a blank name but real roles broke the very invariant this function exists to protect. It reported `colliding: false` and every role `duplicate: false`, so both signals said the roles would be created, while the payload silently dropped the whole card. A consumer reading only the resolved output could not tell those roles were dead.

The flag is set when the trimmed name is empty AND the card holds at least one non-blank title, so an empty card the user has just added is not treated as a problem. It renders as a message on that card and joins `colliding` in blocking Create: silently discarding a role the user typed is worse than blocking and saying why.

The same review found a colliding card still contributing to `counts.skipped`, which attributed a skip to title duplication when the real and only reason nothing lands is the name clash. A card that will submit nothing now contributes nothing to the counts either.

Deterministic, no React, unit-tested directly. `FamiliesReview` takes one new optional `annotations` prop; onboarding passes nothing and renders exactly as today. The badge sits in a slot reserved at the wider label's width so the flip shifts nothing.

Create is gated on at least one non-duplicate role AND no two new families colliding on a name. Its label is "Create {count} roles": a number inside a translated sentence, so plain text, not NumberFlow.

### Prefilling and done

The prefilling phase reuses onboarding's screen (spinner, heading, brand-accented `Progress`, and the "{done} of {total} roles" line) with the denominator scoped to `createdRoleIds`.

The done phase mirrors `ImportDoneStep`: `SuccessCheck` above a `ScreenShell`, the three counts (roles added, families created, already existed), and a primary link to `/roles`. No toast; the done screen is the confirmation, matching the people import.

### Roles page

The header action becomes `New role` (outline) plus `Add roles with AI` (filled `Link`), matching the people header's hierarchy. `CreateRoleDialog` gains a trigger `variant` prop, defaulting to today's behaviour so the family page call site is unaffected. The zero-roles `Empty` gains an outline link to the wizard, mirroring the people empty state.

## Edge cases

| Case | Behaviour |
| --- | --- |
| User leaves mid-generation and returns | The wizard always opens on an empty paste screen. Nothing is written until Create, so a proposal in flight is not work to preserve: on entry the open `role.import` row is DISMISSED (`rejectSuggestion`, which accepts a `generating` row for exactly this), and only a proposal this visit's own Analyse click opened may seed the review. The generation that finishes afterwards cannot resurrect it: `patchOpenSuggestion` (`ai/persist.ts`) drops a terminal row's late outcome. |
| User leaves mid-review | Discard `AlertDialog` plus `beforeunload`, guarding the local draft edits. Discard rejects the proposal then and there; leaving any other way (reload, browser back) leaves it to the next visit's entry dismissal. Either way nothing resumes. |
| Every proposed role already exists | All rows render muted, Create stays disabled with an explanation, Start over returns to paste with the text intact. |
| Generation fails / `aiUnavailable` | Alert below the CTA, textarea preserved, retry available. |
| Partial prefill failure | One best-effort retry, then continue. The done screen still shows; any role left empty reads "needs a job profile" on the roles page. |
| Two tabs importing at once | The skip rule absorbs overlapping roles. A genuine new-family name collision throws `roleFamilyExists` and surfaces in review. |
| Org has no evaluation model | Cannot occur in-app (onboarding creates it), but the review holds until `model.tracks` resolve, as onboarding does. |

## Audit and compliance

No new event keys, no new category, no new subject kind. `roleFamilyCreated`, `roleCreated` and `aiSuggestionConfirmed` already carry all three.

`AI_KIND_KEY` (`apps/dashboard/lib/audit-detail.tsx:529`) is an untyped `Record<string, string>` and is ALREADY missing `role.profile`, so a rejected role-profile suggestion renders an empty detail string today. Since this change touches it, it becomes `Record<SuggestionKind, string>`, which makes a kind without a label a compile error and fixes that gap in passing.

`aiAuditDetail` gains a `case "role.import"` returning the new summary message, mirroring the `starter.import` case.

`AiConfirmedPayload` (`convex/lib/auditPayloads.ts:108`) is a discriminated union keyed on `kind` and is compile-time-guarded, so it gains a `role.import` variant in the same change. The skip count is named `skippedCount`, matching the `model.weightReview` variant's existing field rather than inventing a second spelling for the same concept.

**Correction, established during implementation.** An earlier version of this section claimed these counts render only through `aiAuditDetail` and therefore need no `dashboard.auditLog.fields.*` entry. That was wrong, and it was verified wrong against the code. `aiAuditDetail` produces the TABLE CELL summary, but the detail SHEET runs a separate path: `payloadStats` (`lib/audit-detail.tsx:282`) filters out only `changes`, keys ending in `Id`, and `source`, keeping every other string or number, and `fieldLabel` falls back to the raw key when no label exists. An `ai.suggestionConfirmed` row carries no `changes` map, so the sheet would render `kind: role.import . familyCount: 1 . roleCount: 1 . skippedCount: 1`, the raw dump CLAUDE.md forbids.

So the change ships labels for `kind`, `familyCount`, `roleCount` and `skippedCount` in all five locales, registers them in `OTHER_AUDIT_FIELDS` (the hand-maintained list in `audit-labels.test.ts` that the coverage test reads, and the reason this gap was invisible), and renders `kind` through `resolveCodedValue` against the `ai.kind.*` labels so it reads "Imported roles" rather than the raw code. This incidentally fixes `starter.import` and `model.weightReview`, which render the same way today. That is in scope rather than creep: the rule is absolute and this change adds a new row to the offending class.

## i18n

A new `dashboard.roles.import.*` namespace mirroring `dashboard.people.import.*`:

- step labels and the dots nav label
- paste label, hint, help label and body, three placeholder phrases, the analyse CTA
- review heading, the `existing` and `new` badges, the already-exists note, the name-collision message, the pluralised create CTA, the disabled-because-all-duplicates explanation
- prefilling heading, body and progress
- done title, description and the three counts
- discard dialog title, description, keep and discard
- back label and the error strings

Plus `dashboard.auditLog.ai.roleImport` (with plural forms) and `dashboard.auditLog.ai.kind.roleImport`, and the `ai.kind.roleProfile` label the typing tightening exposes.

Existing keys are reused rather than duplicated: `dashboard.help.familiesReviewLabel` / `familiesReviewBody` for the review's help popover, the already-present `dashboard.roles.detail.backToRoles` for the wizard's exit control (the people wizard reuses `backToPeople` the same way), and `errors.roleFamilyExists` / `errors.roleExists` for the backend failures. The paste help, placeholder phrases and prefilling copy are NOT reused from `dashboard.onboarding.families.*`: the wizard's copy addresses an org that already has roles, so the strings differ even where the controls are shared.

English lands first (the `Messages` type is generated from it), then all four others in the same change. The parity test in `packages/i18n` guards the key sets. New Nordic strings are drafts and get flagged for native review.

## Testing

Following the commit sequence:

**1. Refactor**
- `hooks/use-pasted-role-draft.test.tsx`: request, generating, seed-on-suggested, unknown-track coercion, dismiss and the `lastDismissedId` latch, the `canSeed` gate holding the seed off, and the `resume: false` policy (a pre-existing proposal dismissed once and never seeded, this visit's own proposal seeding normally).
- `hooks/use-profile-prefill.test.tsx`: the `roleIds` scope reaching the action, the progress denominator, the single retry on partial failure, and the hard-reject path.
- `components/families-review.test.tsx` (new): the existing rendering, then the annotated rendering.
- Contract: all 32 `families-step.test.tsx` tests pass UNCHANGED.

**2. Backend**
- `requestRoleImport`: existing family names reach the scheduled action, the length gate, the incomplete-settings gate, and the row's kind.
- `confirmRoleImport`: merge into an existing family; create a new family; skip a DB duplicate; skip an intra-payload duplicate; reject a foreign `familyId`; reject a new-name collision; enforce both caps; the audit rows and their `batchId`; the returned ids and counts.
- `insertAdditiveRoles` slug behaviour, including the family-slug prefix and the reserved-slug fallthrough.
- `lib/role-import.ts` pure tests for the derivation and the payload it emits.

**3. Wizard**
- paste -> generating -> review -> create -> prefill -> done
- merge and skip visible in review; badge flip on rename; duplicate re-derivation on drag; Create gating on both conditions
- discard guard; entering with an open suggestion (suggested or failed) shows the paste screen and dismisses the row
- roles page header hierarchy and the empty-state link

The audit field-label coverage test runs unchanged and picks up any field that lacks a label in any locale.

## File map

**New**

| File | Purpose |
| --- | --- |
| `apps/dashboard/app/(app)/roles/import/page.tsx` | Route: page title, renders the wizard |
| `apps/dashboard/components/roles/import/role-import-wizard.tsx` (+ test) | The wizard frame and its phases |
| `apps/dashboard/hooks/use-role-import-flow.ts` | Additive flow: existing-families resolution, finish, exit |
| `apps/dashboard/hooks/use-pasted-role-draft.ts` (+ test) | Shared paste to AI to editable-draft engine |
| `apps/dashboard/hooks/use-profile-prefill.ts` (+ test) | Shared prefill span with an optional `roleIds` scope |
| `apps/dashboard/components/pasted-roles-field.tsx` | Shared labelled textarea block |
| `apps/dashboard/lib/role-import.ts` (+ test) | Pure `resolveImportTargets` derivation |
| `apps/dashboard/components/families-review.test.tsx` | First direct test for the review |

**Moved**

| From | To |
| --- | --- |
| `apps/dashboard/components/onboarding/families-review.tsx` | `apps/dashboard/components/families-review.tsx` |

**Modified**

| File | Change |
| --- | --- |
| `apps/dashboard/hooks/use-families-draft-flow.ts` | Composes the two shared hooks, sheds roughly 200 lines |
| `apps/dashboard/components/onboarding/families-step.tsx` | Import paths, `PastedRolesField` |
| `apps/dashboard/app/(app)/roles/page.tsx` | Header actions, empty-state link |
| `apps/dashboard/components/roles/create-role-dialog.tsx` | Trigger `variant` prop |
| `apps/dashboard/lib/audit-detail.tsx` | `AI_KIND_KEY` typing, `role.import` case |
| `packages/constants/src/suggestions.ts` | `roleImport: "role.import"` |
| `packages/backend/convex/ai/suggest.ts` | `requestRoleImport`, `confirmRoleImport` |
| `packages/backend/convex/ai/generate.ts` | `existingFamilies` prompt arg |
| `packages/backend/convex/ai/prefill.ts`, `prefillData.ts` | Optional `roleIds` scope |
| `packages/backend/convex/assessment/starters.ts` | `insertAdditiveRoles` |
| `packages/backend/convex/assessment/roles.ts` | Exported `roleTitleKey`, used by `assertUniqueRoleTitle` |
| `packages/backend/convex/lib/auditPayloads.ts` | `role.import` variant on `AiConfirmedPayload` |
| `packages/backend/convex/lib/slug.ts` | Reserved role slugs |
| `packages/i18n/messages/{en,sv,nb,da,fi}.json` | The new namespace and audit strings |
| `docs/go-live-checklist.md` | Transaction-size note on the existing chunking entry |

`apps/dashboard/hooks/use-draft-families.ts` and `apps/dashboard/lib/family-dnd.ts` are deliberately absent: the additive annotations are derived in `lib/role-import.ts`, not stored on the draft.

## Commit sequence

1. `refactor(roles): extract the shared pasted-role draft and prefill hooks` (onboarding behaviour unchanged, all existing tests green)
2. `feat(roles): additive AI role import backend` (kind, request, generate arg, confirm, prefill scope, reserved slugs)
3. `feat(roles): add roles with AI from the role register` (route, wizard, review annotations, roles page header)

The working tree currently holds uncommitted cosmetic changes to `families-step.tsx` and `name-screen.tsx` (the `align="start"`, the hint block, `aria-describedby`) plus their message-file edits. Those want committing first so the refactor diff stays readable.

## Open risks

- **The `canSeed` extraction.** Today's guard is entangled with the template-create hijack defence, and its failure mode is silent (the AI proposal stealing the screen from a just-created template set). It is the one part of the refactor that needs its own tests rather than relying on the component-level suite.
- **Transaction size.** `insertAdditiveRoles` writes up to 20 families plus 100 roles plus roughly 120 audit rows and their aggregate updates in one transaction, identical to `insertStarterSet` today. It is bounded by a payload constant rather than org size, so it sits outside the chunking rule, but the read side collects all org roles the way `reconcileStarterSet` and `assertUniqueRoleTitle` already do. Record the transaction size against the existing chunking entry in `docs/go-live-checklist.md` rather than solving it here.
- **AI grouping quality against a populated org.** The prompt now carries existing family names, but nothing forces the model to reuse them. When it invents "Engineering Team" alongside an existing "Engineering", the review shows a `new` badge and the user renames it to merge. Worth watching on the dev deployment with a realistic family list before calling this done.
