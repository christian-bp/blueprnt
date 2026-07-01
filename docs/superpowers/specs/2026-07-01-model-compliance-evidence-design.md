# Model compliance evidence: criterion rationale, bias review, and the exportable metodbilaga

**Date:** 2026-07-01
**Status:** Approved (design)
**Context:** Closes three of the Important items from the 2026-07-01 V1 conformance audit (`docs/superpowers/analysis/2026-07-01-v1-conformance-report.md`): the criterion rationale / bias-review write path (E2), the exportable methodology annex (E5). Band-threshold editing is explicitly out of scope (separate configurability follow-up).

---

## Goal

Let HR document, per criterion, **why the criterion exists** (kriterieurvalsprotokoll / criterion rationale) and its **gender/bias risk and mitigation** (bias-granskning / bias review), and export the model plus that evidence as a branded, localized **metodbilaga** (method appendix) PDF. This delivers the EU pay-transparency directive's objectivity/bias-review evidence at the decided V1 compliance level ("lätt compliance-ställning, nivå 2"; PLAN-V1 §125).

## Non-goals (out of scope)

- **Band-threshold editing** (E2 configurability). Separate follow-up; the data model already supports it.
- **Mandatory governance:** obligatory calibration, formal model governance, dual-rater / inter-rater reliability (deferred per PLAN-V1 §125).
- **Chart embedding in PDFs.** The PDF foundation is designed so charts *can* be embedded later; the metodbilaga is chartless, so no chart code is built now.
- **A general report engine** (Word/PDF reports = E7). This spec builds only the metodbilaga document on a reusable branded kit.
- **Server-side PDF generation.** Generation is client-side (see Decisions).

## Decisions (with rationale)

1. **One cohesive spec** covering rationale capture + bias-review capture + metodbilaga export. They are one compliance story (capture the evidence, then export it); the appendix is a thin read-layer over the captured data.
2. **Placement: a new `/model/method` route-tab** ("Method" / "Metod") beside Criteria and Weighting, co-locating capture and export. Keeps the Criteria and Weighting screens focused; matches the existing route-tab pattern (`ModelTabs`).
3. **PDF engine: `@react-pdf/renderer`**, adopted as the app's reusable branded PDF foundation.
   - Branded reusable templates are its strength (compose documents from React chrome components).
   - Charts are supported later via `react-pdf-charts` (SVG, `isAnimationActive={false}`) with PNG rasterization as fallback.
   - Runs as a Next 16 App Router **client component** (`'use client'` + dynamic import, SSR disabled; it relies on browser APIs). Supports React 19.
   - No headless Chrome (aligns with the repo's pandoc+typst rule and avoids runtime Chromium infrastructure). Deterministic output. Data never leaves the browser and is model-only (no PII).
   - Cost accepted: its own layout primitives (not HTML/CSS).
4. **Gating: non-blocking, with a DRAFT/FINAL metodbilaga.** Capture is encouraged evidence, never a hard gate.
   - A hard export gate is "formell modellgovernance," explicitly deferred (PLAN-V1 §125).
   - The binding wording rule "**biasreducerande, aldrig biasfri**" makes honest self-description (DRAFT until fully reviewed, FINAL when complete) the right model; a document that hides its gaps is weaker evidence.
   - Matches the product's simplicity-first priority and the CLAUDE.md rule "flows state preconditions in words instead of disabling controls."
5. **"Approved" is an explicit admin sign-off** per criterion, with `decidedBy`/`decidedAt` auto-captured (the anchor-review-date pattern). **Editing content after approval reopens it** (clears `approved`/`decidedBy`/`decidedAt`), because the sign-off attested to that specific text.
6. **Band-threshold table appears in the appendix** (model context / compliance evidence) even though threshold *editing* is out of scope.
7. **The branded PDF kit lives in `apps/dashboard`** for now (the only app), not a `packages/pdf`; extract to a package if a second consumer appears ("don't pre-extract").

## Data model (already present, no schema change)

`packages/backend/convex/evaluationModel/tables.ts` already carries every field, marked "filled in E2":

- **Rationale (kriterieurvalsprotokoll):** `purpose?`, `whyRelevant?`, `overlapNotes?` (all `v.string()` optional).
- **Bias review (bias-granskning):** `biasRisk?` (`"low" | "medium" | "high"`), `biasComment?`, `biasAction?`.
- **Sign-off:** `approved?` (bool), `decidedBy?` (string), `decidedAt?` (number).
- **Band thresholds:** `models.bandThresholds` (already an editable set of 7 `{ band, minScore }`).

These fields are **org-authored**, never template content — a template-seeded criterion has none until HR fills them. `getModel` localizes template rows but does **not** return the compliance fields, so a dedicated query is required.

## Completeness & status semantics (single source of truth)

To keep the light compliance stance, only a required subset counts toward completeness; the rest are genuinely optional:

- **Required content:** `purpose`, `whyRelevant`, `biasRisk`, `biasComment`.
- **Optional content:** `overlapNotes` (not every criterion overlaps another) and `biasAction` (low risk may need no action).
- **A criterion is "documented"** when all four required fields are present (non-empty after trim; `biasRisk` set).
- **Per-criterion status pill:** *Not started* = no content fields set; *In progress* = at least one content field set but not documented-and-approved; *Approved* = `approved === true`.
- **Approval precondition:** `setCriterionApproval(true)` requires the criterion to be **documented** (the required subset), so `approved` always implies documented.
- **Metodbilaga status:** **FINAL** when every criterion is `approved` (which implies all documented); otherwise **DRAFT**. The progress indicator shows both `{documented}/{total}` and `{approved}/{total}`.

This required/optional split drives the Zod schema (`makeCriterionComplianceSchema`), the aggregate counts in `getMethodModel`, and the approval gate, so they cannot drift.

## Architecture: three units

The source of truth is the backend compliance module. The Method tab consumes it via the new query + mutations. The metodbilaga consumes the same query data through a pure, tested assembler; the `@react-pdf/renderer` template is presentational only.

```
getMethodModel (query) ──► Method tab (list + editor + progress + export button)
        │                        │ saveCriterionCompliance / setCriterionApproval (mutations)
        │                        ▼
        └──► lib/pdf assembler (pure) ──► components/pdf metodbilaga document ──► client-side PDF download
```

### Unit 1 — Backend compliance module (`evaluationModel/method.ts`)

Stays in the evaluation-model bounded context. Every function is org-scoped and admin-only (`adminQuery`/`adminMutation`); the backend re-validates independently of the client.

- **`getMethodModel` (adminQuery, org-scoped).** Returns:
  - `modelName`, `pointBudget` (criteria count × 3),
  - per criterion: `_id`, localized `name` + `description` (reuse the existing localize path so template rows render in the caller's locale), `weightPoints`, derived `share` (percent), and the raw compliance fields (`purpose`, `whyRelevant`, `overlapNotes`, `biasRisk`, `biasComment`, `biasAction`, `approved`, `decidedBy`, `decidedAt`),
  - aggregate `{ documented, approved, total }` for the progress indicator and DRAFT/FINAL.
  - New wire validator; no PII.
- **`saveCriterionCompliance` (adminMutation).** Args: `criterionId` + the six content fields. Validates, patches. If any content field changed **and** the criterion was `approved`, clears `approved`/`decidedBy`/`decidedAt` (reopen-on-edit). Writes one `modelUpdated` audit row, `change: "criterion.complianceUpdated"`, diffed with the existing `buildChanges`. **No band-shift** (documentation cannot move a score).
- **`setCriterionApproval` (adminMutation).** Args: `criterionId`, `approved` (bool). Setting `true` requires rationale + bias present (`appError(invalidInput)` otherwise) and stamps `decidedBy` = current admin, `decidedAt` = now; setting `false` clears them. Writes one `modelUpdated` audit row, `change: "criterion.approvalChanged"`. No band-shift.
- **Audit plumbing (DRY, typed):** add the two change discriminants to `AuditPayloads` in `lib/auditPayloads.ts` (compile-time-guarded), reuse/extend the criterion field-list constant, and add labels under `dashboard.auditLog.events.*` in all five locales (the audit-label coverage test guards them).

### Unit 2 — The Method tab (`apps/dashboard`, roles/model surface)

- Route `apps/dashboard/app/(app)/model/method/page.tsx`; add `{ labelKey: "method", href: "/model/method" }` to `ModelTabs`' `TABS` (third route-tab, same `layoutId` underline pattern). Active-state logic mirrors the existing tabs.
- **Header:** title + inline explainer of the metodbilaga concept (`HelpMorphButton`, `dashboard.help.*`), and the right-aligned **"Export method appendix (PDF)"** button.
- **Progress indicator:** "`{documented}/{total} documented`, `{approved}/{total} approved`" — derived, non-blocking.
- **Criterion list:** reuses the criterion-row look; each row shows name, weight (points + share %), and a **status pill** (Not started / In progress / Approved) computed from the fields. A trailing action opens the compliance editor dialog (standard shadcn dialog anatomy: header, body, footer with Cancel outline + primary).
- **Compliance editor** (one combined per-criterion form): react-hook-form + Zod factory `makeCriterionComplianceSchema(t)`, `mode: "onTouched"`, shadcn `Form` components.
  - Rationale: `purpose`, `whyRelevant`, `overlapNotes` (textareas).
  - Bias review: `biasRisk` (select low/medium/high), `biasComment`, `biasAction` (textareas).
  - Inline help per concept (`dashboard.help.*`), never stacked on one heading.
  - Footer Save gated on `isValid && isDirty` (pre-filled-edit pattern); `SubmitButton` handles submitting state.
  - **Approval** is a separate explicit control ("Approve" / "Reopen"), shown once content exists; on approve, `decidedBy`/`decidedAt` render read-only. Editing content reopens (per Decision 5).
- No layout shift: reveal controls in reserved slots; animate genuine enter/leave per the animation rules.

### Unit 3 — Branded PDF kit + metodbilaga (`apps/dashboard`)

- **Dependency:** add `@react-pdf/renderer` (pinned) to the dashboard.
- **Kit (`components/pdf/`):** reusable chrome, all strings passed in as props (localized by the caller; no i18n inside the vendor-style layer):
  - `BrandedDocument` — page size, margins, registered brand font with full Nordic glyph coverage (å ä ö ø æ …).
  - `Cover` — org + model name + date + logo + brand rose (`#f43f5e`).
  - `PageFrame` — running header/footer + page numbers.
  - Typed primitives: `Section`, `KeyValue`, `DataTable`.
  - A short `docs/` note records the **chart seam** (react-pdf-charts SVG path, PNG fallback) as designed-in, not built.
- **Metodbilaga document (`components/pdf/method-appendix.tsx`):** presentational; consumes the assembler's output. Sections: cover → methodology preamble (how scoring works, blinding, audit trail, Role ≠ Person, and the mandatory **"biasreducerande, aldrig biasfri"** statement) → point-budget + criteria/weights table → per-criterion rationale + bias review → band-threshold table. Labelled **FINAL** when every criterion is `approved` (which implies all documented), else **DRAFT** (see Completeness & status semantics).
- **Assembler (`lib/pdf/method-appendix-data.ts`):** pure, fully unit-tested. Turns `getMethodModel` data into the appendix's structured sections, computes shares and the DRAFT/FINAL status. No React, no side effects.
- **Export trigger (`components/pdf/method-appendix-download.tsx`):** `'use client'`, dynamically imported with `ssr: false`. Builds the document from `getMethodModel` data via the assembler and downloads the blob. Export is a client-side read → **no audit row** (no domain-state change; a future "export logged" telemetry is noted, not built).

## i18n

- New keys under `dashboard.model.method.*` (tab label, statuses, form labels + help, export button, DRAFT/FINAL) and `dashboard.model.methodAppendix.*` (document copy including the methodology preamble and the bias statement). Added to `en.json` first, then mirrored to sv/nb/da/fi.
- Swedish is the authoritative compliance copy (native, primary market). nb/da/fi are machine drafts flagged for native review.
- Validation messages under `dashboard.validation.*`. The parity test guards all five locales.
- AI/UI/document text renders in the caller's **current display locale** (next-intl), never the org's stored default. User-entered rationale/bias text is stored and rendered verbatim.

## Error handling

- Backend `appError` codes: `invalidInput` (bad/empty required fields on approve), `notFound` (criterion not in org), approve-without-content rejection.
- Client Zod schema is the gate; fields validate on blur and surface errors inline via `FormMessage`.
- The backend re-validates independently of the client (Convex validators + `appError` codes).

## Testing

- **Backend (convex-test, edge-runtime):** `getMethodModel` shape + localization + aggregate; `saveCriterionCompliance` field writes, reopen-on-edit, audit row, no band-shift; `setCriterionApproval` stamp/clear, approve-without-content rejection; admin-only + org-scoping on all three.
- **Audit-label coverage test** (all five locales) for the two new event discriminants.
- **i18n parity test** for the new keys across all five locales.
- **Frontend (Vitest + RTL):** Method tab list, status pills, progress indicator, DRAFT/FINAL surfacing, and the compliance form (validation, save gating, approve/reopen).
- **Pure-function tests** for the appendix assembler (shares, section assembly, DRAFT/FINAL).
- The `@react-pdf/renderer` template stays thin/presentational; logic lives in the tested assembler.
- New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + the full `turbo run test`.

## Invariants upheld

- Role ≠ Person: no person/salary/performance data enters the compliance fields, the appendix, or the audit trail.
- Score/band derived-never-stored: compliance edits write no score/band and no band-shift.
- Every state-changing mutation writes an audit row via `logAudit` with an `AUDIT_EVENTS` key + typed payload + localized label.
- Org-scoped, admin-only; EU data residency (client-side generation of model-only content).
- No hardcoded UI text; everything through i18n in every configured locale.

## Build order (for the plan)

1. Backend: `getMethodModel` + `saveCriterionCompliance` + `setCriterionApproval` + audit plumbing (+ tests).
2. i18n keys (all locales) + Zod schema factory.
3. Method tab: route + `ModelTabs` entry + list + status/progress + compliance editor form (+ tests).
4. Branded PDF kit + pure assembler (+ assembler tests).
5. Metodbilaga document + export trigger, wired to the Method tab button.
