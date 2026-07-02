# Criterion compliance AI fill

**Date:** 2026-07-02
**Status:** Approved (design)
**Context:** Extends the model compliance-evidence feature (`docs/superpowers/specs/2026-07-01-model-compliance-evidence-design.md`) with an AI draft for the per-criterion compliance fields. Follows the job-profile AI-fill precedent (`convex/ai/draft.ts` `draftRoleProfile` + `components/roles/role-ai-panel.tsx`) and ADR-0003.

## Goal

Let an admin draft a criterion's rationale (purpose, why relevant, overlap) and bias review (risk, comment, mitigation) with one click in the compliance dialog. The AI produces a suggestion; the admin reviews, edits, and confirms by saving. This cuts the effort of documenting each criterion while keeping the human sign-off meaningful.

## Scope

This spec is **sub-project 1 of 2**. Sub-project 2 (pre-seed the standard model's nine criteria with curated compliance text, drafted with this AI fill and then human-curated) is a separate follow-up spec.

**In scope:** a `draftCriterionCompliance` action, its context query + generate helper, a "Draft with AI" button in the compliance dialog that overwrites the six form fields on success.

**Out of scope:** the standard-model seed (sub-project 2); a bulk "draft all criteria" action (per-criterion in the dialog only); any persistent per-criterion "AI-assisted" flag; AI touching the score/band path or the approval decision.

## Users

The only users are HR / comp-reward admins (domain experts). "Confirm/approve" means the acting admin confirms. The fill is an expert-in-the-loop draft, not automation.

## Architecture

Three units, mirroring `draftRoleProfile`:

```
Dialog "Draft with AI" button
  → useAction(api.ai.draft.draftCriterionCompliance)({ orgId, criterionId, locale })
      → collectCriterionComplianceContext (internal query: auth + admin re-check, no-PII input)
      → generateCriterionComplianceText (model call, structured output)
      → recordAiUsageDirect (telemetry, best-effort)
      → returns { purpose, whyRelevant, overlapNotes, biasRisk, biasComment, biasAction }
  → overwrite the six form fields; mark dirty
  → HR edits → Save (existing saveCriterionCompliance) → Approve (separate)
```

### Unit 1 — `draftCriterionCompliance` action (`packages/backend/convex/ai/draft.ts`, `"use node"`)
- Args: `{ orgId: string, criterionId: Id<"criteria">, locale?: string }`.
- Returns: `{ purpose: string, whyRelevant: string, overlapNotes: string, biasRisk: "low" | "medium" | "high", biasComment: string, biasAction: string }`.
- Auth check, then `collectCriterionComplianceContext` (re-checks org + admin, ADR-0003: AI in actions, EU model, role/org content only). No suggestion row, no auto-apply.
- Calls `generateCriterionComplianceText`; on failure maps to `aiUnavailable` (missing key) or `aiGenerationFailed` (generation/schema).
- Records usage via `recordAiUsageDirect` with a new `SUGGESTION_KINDS.criterionCompliance`, best-effort (a usage-write failure must not discard a successful generation).
- Returns the six trimmed fields.

### Unit 2 — context query + generate helper
- `collectCriterionComplianceContext` (`ai/suggest.ts`, internal query): re-checks org membership + admin role; loads the criterion (org-scoped) and the model's other criteria; builds the prompt input from **only** model/org content:
  - the criterion's `name`, `description`, `helpText`, and its 0–5 anchor texts;
  - the **names** of the other criteria in the model (for overlap detection);
  - org context: `industry`, `country`, `employeeCount` (via the existing `companyLines` builder).
  - **No person, role, salary, or performance data** (Role ≠ Person; GDPR). The `users` table is never read here.
  - Resolves the generation locale via `promptLocale(locale, settings.language)`.
- `generateCriterionComplianceText` (`ai/generate.ts`): runs the EU model (`AI_PROVIDER` / a profile-class model id) with a structured-output Zod schema and a prompt that:
  - describes the task (draft rationale + bias review for one criterion of a job-evaluation model);
  - embeds the **fixed bias diagnostic checklist** (from the source doc `Är detta rätt startpunkt enligt EU:s lönetransparensdirektiv`, §2), so the bias output is grounded, not arbitrary:
    1. Does the criterion risk over-valuing traditionally male-coded roles?
    2. Does it risk under-valuing relational, coordination, or care-oriented work?
    3. Does it reward visible mandate more than actual impact?
    4. Does it rest on formal status rather than actual work content?
    5. Is the language in the level descriptions gender-neutral?
    6. Is there a risk that "big budget" or "number of direct reports" gets too much weight relative to complexity, responsibility, and specialist knowledge?
  - instructs the output language (the resolved display locale);
  - returns `{ compliance, usage }` where `compliance` matches the six-field schema (`biasRisk` a strict `low|medium|high` enum; texts length-bounded, e.g. ≤ 2000 to match the form/backend max).

### Unit 3 — dialog "Draft with AI" button (`components/model/criterion-compliance-dialog.tsx`, inner `CriterionComplianceForm`)
- A button near the top of the form (drafts the whole form). Disabled + spinner while generating (`useAction` + a local `drafting` state).
- On success: **overwrite all six fields** via per-field `setValue(name, value, { shouldDirty: true })` (NOT `form.reset`, which would reset the dirty baseline and leave Save disabled), so the form becomes dirty and Save is enabled. Nothing persists until Save; Cancel discards.
- After a successful fill, show a subtle muted line: **"AI-drafted. Review and edit before approving."** (reinforces the human sign-off; matches the role surface's AI-provenance note + ADR-0003).
- **No button when the criterion is locked** (`status === "approved"`) — reopen first, consistent with the lock/reopen behavior.
- On failure: an inline error (mapped from `aiUnavailable` / `aiGenerationFailed`); no fields are changed.
- Provenance = the AI-usage event (telemetry) + the Save audit row (`criterion.complianceUpdated`). No new persistent per-criterion AI flag (same as `draftRoleProfile`).

## Data flow / confirmation

The AI output is a suggestion that the admin confirms by editing and saving. The `approved` sign-off remains a separate, deliberate human action (and reopening is required to edit an approved criterion). The AI never sets `approved`, never touches score/band, and its result is discardable (Cancel).

## i18n

New keys under `dashboard.model.method.*`: the button label ("Draft with AI"), a generating/loading label, an error message, and the "AI-drafted, review before approving" note. Added to `en.json` first, mirrored to sv/nb/da/fi (sv native; nb/da/fi machine drafts flagged for native review). The AI *output* text is in the caller's current display locale.

## Error handling

- Backend: `notAuthenticated` / `adminRequired` / `notFound` from the context query; `aiUnavailable` / `aiGenerationFailed` from generation. All are `appError` codes; the client translates.
- Client: the button's failure state shows the localized error; the form is left untouched.

## Testing

- **Backend (convex-test):** `draftCriterionCompliance` returns the six fields, records a usage event, maps generation errors to the right codes, and is admin-only + org-scoped (a foreign criterion → `notFound`). Assert the context input carries **no person data** (only criterion/model/org content). Mock the model (as the prefill/draft tests do) rather than calling a real model.
- **Pure test:** the structured-output schema accepts a valid draft and rejects a bad `biasRisk`.
- **Frontend (Vitest + RTL):** the button triggers the action, overwrites all six fields on success, shows the error on failure, and is absent when the criterion is approved. Mock the action like `role-ai-panel.test.tsx`.
- New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + full `turbo run test`.

## Invariants upheld

- AI runs only in a Convex action against the EU-hosted model (ADR-0003).
- **No PII in the prompt** — only criterion/model/org content; the `users` table is not read (Role ≠ Person, GDPR).
- AI never touches the deterministic score/band path and never auto-decides; output is a suggestion the admin confirms by saving.
- The approval sign-off stays a human decision; locked criteria are untouched.
- Org-scoped, admin-only. All user-facing text is i18n in every locale; AI output is in the display locale.

## Build order (for the plan)

1. Backend: `SUGGESTION_KINDS.criterionCompliance` + the structured-output schema + `generateCriterionComplianceText` + `collectCriterionComplianceContext` + the `draftCriterionCompliance` action (+ tests).
2. i18n keys (all locales).
3. Dialog: the "Draft with AI" button, overwrite-on-success, the review note, the locked/error states (+ tests).
