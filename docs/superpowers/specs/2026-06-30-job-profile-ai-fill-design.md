# Job profile: AI draft fills the edit form

Date: 2026-06-30
Status: Approved (design)
Surface: apps/dashboard (role detail page), packages/backend/convex/ai

## Problem

Today the job profile's AI draft is always visible in read mode as a
self-contained MorphPopover flow. It requests a suggestion, shows per-field
checkboxes, and applies the accepted fields directly to the role through
`confirmRoleProfileDraft` (a separate write with its own provenance). This is a
second, parallel write path next to the normal Edit/Save flow, and the assist
is decoupled from editing.

We want the AI draft to be a helper INSIDE edit mode: visible only once editing
is active, it fills the form fields, and the existing Save/Cancel governs
whether anything persists. The user can edit the AI text before saving.

## Goals

- The AI draft trigger is visible only in edit mode.
- Generating fills the purpose and responsibilities fields in the edit form
  (client only, nothing persisted yet).
- The user can edit the filled text, then Save (persist) or Cancel (discard).
- One persistence path: the normal `updateRole`.

## Non-goals

- No new AI-drafted fields (purpose and responsibilities only; title, function,
  team, family stay user-entered).
- No react-hook-form migration of RoleProfileCard (it stays manual draft state).
- No change to save gating beyond current behavior.
- No per-field AI provenance on save (see Decisions).

## Decisions

1. Fields AI fills: purpose and responsibilities (today's scope).
2. Save model: the normal `updateRole`, audited as a manual role edit. The AI
   request is recorded via usage telemetry. We drop the per-field
   "AI-confirmed" audit provenance and remove `confirmRoleProfileDraft`.
   Rationale: the user can edit the AI text before saving, so the saved value is
   theirs, and there is no longer a review-and-confirm step.
3. Trigger: an AI draft button in the edit header opens a short prompt (optional
   guidance input plus Generate), then fills the fields.
4. Backend shape: a direct `draftRoleProfile` action returns the text to the
   client. No suggestion table for roleProfile. Rationale: the new UX has no
   review-and-confirm step, so the suggestion lifecycle is the wrong tool; the
   prefill flow already generates role profiles and records usage without the
   suggestion table.

## Design

### Interaction

Read mode: header shows only the actions menu (Edit; Archive for admins). No AI
trigger.

Edit mode: header shows `[AI draft]  [Cancel]  [Save]`.

- AI draft: an outline sm MorphPopover trigger with a sparkle icon. The panel is
  the AI heading, the provenance line, an optional guidance input, and a
  Generate button.
- Generate: calls `draftRoleProfile`. The button becomes a spinner
  ("Generating"), the input is disabled. On success, the returned purpose and
  responsibilities are written into the edit draft and the morph closes. On
  failure, an inline error shows and Generate stays enabled to retry.
- Cancel (new): discards the draft and exits edit mode. No confirm dialog
  (nothing is persisted; low stakes).
- Save: unchanged. `updateRole` patches only changed fields, gated on
  `!pending && !duplicate`.

Regenerate = reopen the morph (fresh guidance each time) and overwrite the draft
fields again. Nothing persists until Save.

### Client

RoleProfileCard (`components/roles/role-profile-card.tsx`):

- Render the AI morph only when `editing`.
- Add a Cancel button and `cancelEditing()` (reset draft, draftFamilyId,
  failure; setEditing(false)).
- `onFilled({ purpose, responsibilities })` calls `setField` for each.

RoleAiPanel (`components/roles/role-ai-panel.tsx`): repurposed to
generate-and-fill.

- Props: `{ orgId, roleId, onFilled, onDone }`.
- Uses `useAction(api.ai.suggest.draftRoleProfile)`.
- Renders: optional guidance input plus Generate; a generating spinner; a failed
  state with retry.
- On success: `onFilled(values)` then `onDone()`.
- Removed: `useSuggestionFlow`, `useSuggestionSelection`, the per-field
  checkboxes, and the apply/reject buttons. `useSuggestionSelection` stays in
  the repo (weight-review-panel still uses it).
- Guards against set-state-after-unmount if the morph closes mid-generation.

### Backend (`convex/ai/suggest.ts`, `generate.ts`, `prefillData.ts`)

Add `draftRoleProfile` (public action), modeled on `prefillRoleProfiles`:

- args: `{ orgId: string, roleId: Id<"roles">, description?: string, locale?: string }`;
  returns `{ purpose: string, responsibilities: string }`.
- `getUserIdentity()`; throw notAuthenticated if null.
- `ctx.runQuery(internal ai.suggest.collectRoleDraftContext, { orgId, roleId, userId, locale? })`:
  re-check membership, load the role (org-scoped, reject archived with
  roleLocked), resolve settings (industry, country, employeeCount), trackName
  (fixed constant per ADR-0006), and family name. Returns the prompt context and
  actorId. This mirrors the current body of `requestRoleProfileDraft`.
- Single-profile model call (reuse the model-call logic currently inside
  `generateRoleProfileDraft`).
- Sanitize with the shared helper (below).
- `ctx.runMutation(internal ai.usage.recordAiUsageDirect, { orgId, kind roleProfile, provider AI_PROVIDER, model AI_PROFILE_MODEL_ID, actorId, ...usage })`.
- Return the sanitized values.
- On model failure: throw a mapped appError (aiUnavailable or
  aiGenerationFailed) so the client renders the right message.

Extract `sanitizeRoleProfileFields(profile)`:

- Whitelist `ROLE_PROFILE_FIELDS`, require string, trim, enforce `maxLengthFor`.
  Drop empty or over-length values.
- Currently inline in `confirmRoleProfileDraft` and mirrored in `applyPrefill`.
  Both `applyPrefill` and `draftRoleProfile` use it (DRY, per the repo rule).

Remove:

- `requestRoleProfileDraft` (mutation), `confirmRoleProfileDraft` (mutation),
  `generateRoleProfileDraft` (internal action). Fold the model call into the
  shared path the action uses.
- roleProfile no longer touches the suggestions table. The
  `SUGGESTION_KINDS.roleProfile` constant stays (a usage-telemetry label; prefill
  uses it too).

Audit:

- No new audit event. Save is the normal role.updated (source manual) via
  `updateRole`. Usage telemetry via `recordAiUsageDirect` (exempt from the audit
  invariant, per CLAUDE.md: it is not a user-initiated domain change and the
  event table is the record).
- `aiSuggestionConfirmed` and `aiSuggestionRejected` remain for model kinds
  (modelDraft, weightReview) but no longer carry roleProfile. Remove the
  roleProfile-specific label branch and tests in `audit-detail`.

### States and edge cases

- Overwrite: AI fill overwrites the draft's purpose and responsibilities (client
  only). Cancel reverts, since nothing is saved.
- Archived or locked role: no edit mode, so no AI button. The backend also
  rejects with roleLocked.
- Non-admin members: may edit and draft (drafting was never admin-gated).
  Archive stays admin-only.
- Close morph mid-generation: the in-flight result is dropped; the user
  regenerates.

## i18n

- Keep: `dashboard.roles.ai.descriptionLabel`, `draftCta`, `error`;
  `dashboard.ai.heading`, `provenance`, `closeLabel`, `generating`.
- Add: an edit-mode Cancel label (`dashboard.roles.detail.cancelCta`) in all 5
  locales, unless an existing reusable Cancel key fits.
- Remove only if unused elsewhere (verify first): none expected.
  `dashboard.ai.applyCta` and `rejectCta` stay (model builder uses them).
- Nordic values are drafts; flag for native review.

## Testing

- `role-profile-card.test.tsx`: AI trigger hidden in read mode, present in edit
  mode; Cancel discards changes and exits; generate fills the textareas; the
  save path is unchanged.
- `role-ai-panel.test.tsx`: rewritten to mock `draftRoleProfile`; guidance plus
  Generate calls `onFilled` and `onDone`; error shows retry. Drops the
  checkbox/confirm assertions.
- `suggest.test.ts`: remove the `confirmRoleProfileDraft` test; add
  `draftRoleProfile` (foreign-org reject, archived reject, sanitize and bound,
  returns values, usage recorded, model failure maps to an error).
- Backend via convex-test on edge-runtime. Full suite green with `bun run test`.
  i18n parity green.

## Removal / no-legacy

Pre-launch, delete completely in the same change: the two removed mutations, the
internal single-draft action, the now-dead client suggestion wiring for
roleProfile, and the roleProfile branch in `audit-detail` plus its tests. Reset
dev data as needed.

## Risks and trade-offs

- Loss of per-field AI provenance on the role (accepted; usage telemetry retains
  "AI was used here").
- roleProfile diverges from the shared suggestion pattern (justified: it no
  longer reviews or confirms; model drafts keep the pattern).

## References

- ADR-0002 (band derived, never stored), ADR-0003 (AI is a suggestion HR
  confirms; never auto-decides; EU-hosted; actions only).
- `prefill.ts` (`prefillRoleProfiles`) as the action template; `prefillData.ts`
  (`applyPrefill`) for the sanitize logic; `use-suggestion-flow.ts`.
