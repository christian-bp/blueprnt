# V2 Salary Import + Lönekartläggning: Coverage Audit

**Date:** 2026-07-04
**Audits:** `docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` against the codebase (`packages/import`, `packages/backend`, `packages/constants`, `packages/core`, `apps/dashboard`).
**Method:** six area verifiers (import wizard/parsing; people/assignments/classification; payRecords/manual/normalization; grouping/gap engine; report runs/reporting/export; privacy/GDPR), each returning done/partial/absent items with file+line evidence, synthesized here against the five build phases in spec §8.

---

## Verdict

Phase 1 of the build (§8.1) landed in two clean, well-tested halves and then stopped short of its own finish line. The full-screen import wizard, the deterministic multi-locale auto-detection engine, the readiness check, the full validator rule set, and the `people` / `personAssignments` / `payRecords` / `importMappingProfile` schema with erasure hard-delete and authoritative `employeeCount` are all implemented, tested, and in fact carry meaningful robustness hardening beyond spec. But everything that turns imported rows into a defensible pay-gap analysis is absent: there is no classification flow (title→role, level suggestion, unmatched-title routing, HR confirm), no manual salary-entry form, no FTE-adjusted total-comp helper, no grouping or gap engine in `packages/core`, no `payGapReportRun` snapshot, no report audit events, and no reporting UI or PDF export. Phases 3 through 5 are entirely unstarted, phase 2 is roughly half-built (persistence yes, manual UI + FTE-adjust no), and phase 1 has two loose ends (classification and mapping-profile re-apply). In build-phase terms: Phase 1 is partial, Phase 2 is partial, Phases 3, 4, and 5 are absent.

---

## Build-phase status (spec §8)

| Phase | Scope | Status | Key evidence |
|---|---|---|---|
| **1. Import wizard + people/assignment** | Wizard, parse/validate, `people` / `personAssignments` / `importMappingProfile`, title→role + level-suggestion UI, erasure, `employeeCount` | **partial** | Wizard + parsing + validation done (`packages/import/*`, `components/people/import/*`); schema + erasure + `employeeCount` done (`convex/people/*`). Missing: classification UI (title→role, level suggestion, unmatched routing, HR confirm) entirely absent; saved `importMappingProfile` never loaded back to pre-seed/skip the map step. |
| **2. Salary history + manual + normalization** | `payRecords` append-on-change, manual add/adjust form, component split, FTE-adjust (engine) | **partial** | `payRecords` table, append-on-change history, `getCurrentSalary` as-of, `totalMonthlyComp` helper, `PAY_COMPONENT_KINDS`, basic-vs-variable split, and the `setSalary` (source `manual`) mutation all done. Missing: the manual salary-entry UI form in the dashboard, and a named FTE-adjusted total-comp helper (spec §6 formula has no implementation). |
| **3. Grouping + gap engine** | Equal-work + score-tolerance equal-value groups, dominance flag, median/mean/quartiles, masking in the query layer | **absent** | No grouping or statistics code anywhere in `packages/core`, `packages/backend`, or `apps/dashboard`. Grep for equalValue/scoreTolerance/median/quartile/dominance/masking returns zero logic hits. |
| **4. Frozen report runs** | `payGapReportRun` snapshot table; multi-actor report audit events + payloads + locale labels | **absent** | No `payGapReportRun` table in `schema.ts`; `AUDIT_EVENTS` has no reportCreated/Reviewed/Approved keys; no report labels in any of the five locale files. |
| **5. Reporting UI + export** | Lönekartläggning report view + PDF export; threshold-driven cadence display | **absent** | No report/lonekartlaggning/gap route under `app/(app)/`; no pay-gap PDF component in `components/pdf/` (only the metodbilaga kit); no employer-size threshold or cadence logic referencing `employeeCount`. |

---

## Per-section breakdown

### §5 + §4.6 — Import wizard, parsing, validation

**Done**
- Full-screen 4-step wizard (Upload → Map → Check → Review) on the onboarding frame, launched from the "Import salaries" action. (`components/people/import/import-wizard.tsx:51`; entry via `people-section.tsx:50` → `app/(app)/people/import/page.tsx`)
- Deterministic client-side auto-detection: multi-locale header-synonym dictionary + value-shape heuristics, no AI, PII never leaves the browser. (`packages/import/src/detect.ts:61`, `fields.ts:76`, `shape.ts:206`)
- Required-vs-recommended field warnings: required unmapped fields block advancement, recommended soft-warn with consequence. (`packages/import/src/validate.ts:154,159`; `check-step.tsx:141,178,228`; `map-step.tsx:188`; gate at `import-wizard.tsx:98`)
- Full validator rule set: money strip, currency trim, FTE integer + typo tolerance, blank-row skip, duplicate-id flag, non-numeric Statistikkod flag, blank/unreadable gender flag, gender/name mismatch flag. (`packages/import/src/parse.ts:86,110,130`; `validate.ts:192,239,257,268`)
- `importMappingProfile` saved on confirm, with audit row and no-op-safe upsert. (`convex/people/import.ts:419-436`; `convex/people/importProfile.ts:55`; `convex/people/tables.ts:92`)

**Partial**
- Map step is column-first (one row per CSV column with a field selector) vs the spec's field-first wording (§5.2). Functionally equivalent; the detection confidence score (0 / 0.7 / 1.0) is computed but not surfaced in the map table. (`map-step.tsx:209`)

**Absent**
- Saved `importMappingProfile` is never applied on re-import. `getImportMappingProfile` exists (`importProfile.ts:133`) but is never called from any dashboard file; the wizard always starts from fresh auto-detection, so the annual re-run cannot skip or pre-seed the map step (breaks §4.6 / Decision 7 intent).

### §4.1 / §4.2 / §6 — people, personAssignments, classification

**Done**
- `people` table with all 11 required fields and both indexes. (`convex/people/tables.ts:8-34`)
- `assignPersonToRole` mutation closes the current open assignment and inserts a new one; `getCurrentAssignment` + `listAssignmentsForPerson` present and tested. (`convex/people/assignments.ts:69-148`)
- Authoritative `employeeCount` derived from the import (counts non-archived people, patches the org), called after upserts. (`convex/people/employeeCount.ts:10-55`, invoked at `import.ts:441`)
- Erasure hard-delete of a person (people row + payRecords + personAssignments, child-first, audit carries no PII). (`convex/people/erase.ts:19-81`)

**Partial**
- `personAssignments` field names diverge from the spec: implemented as `effectiveAt` / `endedAt` rather than the spec's `validFrom` / `validTo`. Functionally equivalent. (`tables.ts:40-55`)

**Absent (the whole classification pillar, §6 / Kravbild §6+§10)**
- Title→role mapping UI/flow (group identical/near titles, suggest a V1 role per title from Befattning + Statistikkod + Chef signal). No such component, mutation, or function exists.
- Per-individual level-suggestion layer (suggested from Befattning + Statistikkod + tenure, HR-confirmed). The `levelSource` enum exists in schema but no code ever writes `"suggested"`.
- Unmatched-title routing (create-role or map-to-existing for title groups with no V1 match).
- Every imported person linked to role + track + level: `importPayroll` never calls `assignPersonToRole`; imported people land unassigned.
- Org display setting `pseudonymizeNames` (see §9 below) is also absent here.

### §4.3 / §6 — payRecords, manual entry, normalization

**Done**
- `payRecords` table with all required fields + `by_org` / `by_person` indexes. (`convex/people/tables.ts:61-88`)
- `PAY_COMPONENT_KINDS` constant (seven kinds). (`packages/constants/src/pay.ts:4-14`)
- Append-on-change history (always insert, never overwrite) + `getCurrentSalary` as-of resolution. (`convex/people/pay.ts:66-89,146,207-233`)
- `totalMonthlyComp` pure helper, derived on read, never stored. (`packages/constants/src/pay.ts:19-24`; `pay.ts:51-64`)
- `setSalary` orgMutation writing `source: "manual"`. (`convex/people/pay.ts:72-119`)
- Basic-vs-variable split retained (Art. 9): `basicMonthly` distinct top-level, `components[]` separate. (`tables.ts:69-84`; `pay.ts:51-64`)

**Absent**
- FTE-adjusted total-comp helper (`totalMonthlyComp / (ftePercent/100)`), the actual comparison metric per §6/§4.3. Only the numerator (`totalMonthlyComp`) exists; no `fteAdjusted*` function in `constants` or `core`.
- Manual salary-entry UI form in the dashboard. `setSalary` has zero dashboard callers; there is no per-person detail page or salary form.

### §6 / Phase 3 — grouping + gap engine

**Absent (entire phase)**
- Equal-work grouping (same `roleId`).
- Work-of-equal-value grouping (score-tolerance window on the 0-100 score, HR/Legal-tunable, independent of band edges).
- Per-group × gender statistics (median, mean, quartiles).
- Gender-dominance flag at ≥ 60%.
- Unadjusted pay gap per group × gender.
- Small-group masking (< 3) enforced as a query-layer invariant.

No file named group*/equal-value* exists in `packages/core`; no tolerance/median/quartile/dominance/masking logic anywhere.

### §4.4 / §4.5 / §7 — report runs, reporting UI, export, thresholds

**Absent (entire pillar)**
- `payGapReportRun` frozen-snapshot table (population + exclusions, copy of ratings, copy of model config incl. band thresholds + equal-value tolerance, derived outcomes, approvals; immutable per ADR-0008).
- Multi-actor audit events (report created / reviewed / approved) with typed payloads + locale labels in all five locales.
- Lönekartläggning report view (gap at total + per worker category by gender, component split, quartiles, scoped to entity + country + period).
- Pay-gap PDF export via the `@react-pdf/renderer` branded kit.
- Employer-size thresholds gated by authoritative `employeeCount` (<100 none, 100-249 every 3 years, 250+ annually) and cadence display.

### §9 / Decision 1 — privacy / GDPR

**Done**
- Erasure = true hard delete of the people row (admin-gated). (`convex/people/erase.ts:67`)
- Erasure deletes all `payRecords` and all `personAssignments` for the person, tested. (`erase.ts:44-64`; `erase.test.ts`)
- Erasure audit payload carries no PII (excludes displayName/gender/birthDate/salary). (`lib/audit.ts:380-389`; `erase.ts:29-42`)
- RBAC: all people/pay access is org-member-gated; erasure is admin-only. (`lib/functions.ts:108-142`; `erase.test.ts:217-232`)

**Absent**
- `pseudonymizeNames` org setting (no field on `organizations`; explicitly deferred in a `people-section.tsx:29-30` comment).
- UI rendering `Anställd #<externalRef>` when pseudonymization is on (renders `displayName` unconditionally, `people-section.tsx:94`).
- Erasure UI wired into the GDPR flow: `erasePerson` has no dashboard caller.
- Audit `actorName` tombstone on person erasure. Likely correctly out of scope (an erased person is not an app user and never appears as an audit `actorName`), but flagged for a decision.

---

## What remains (concrete unbuilt V2 work, roughly ordered)

Ordered to keep each block shippable with tests + i18n in the same commit, following the §8 phase order and finishing partials before opening the next phase.

**Finish Phase 1**
1. **Classification flow (§6, largest single gap).** Backend: a deterministic title→role suggestion (Befattning + Statistikkod + Chef signal) and a per-individual level suggestion (Befattning + Statistikkod + tenure), both writing `levelSource: "suggested"` with provenance, plus an HR-confirm mutation that calls `assignPersonToRole`. UI: a classification step (or post-import surface) that groups titles, shows suggestions, routes unmatched titles to create-role / map-to-existing, and requires HR confirm. Wire `importPayroll` so every imported person ends linked to role + track + level. (ADR-0003: AI may suggest, never auto-decide; keep suggestion deterministic here.)
2. **Re-import mapping profile re-apply.** Load `getImportMappingProfile` in the wizard to pre-seed (and let the annual re-run skip) the map step when a saved profile matches the file's headers.

**Finish Phase 2**
3. **FTE-adjusted total-comp helper** in `packages/constants` (or `core`): `totalMonthlyComp / (ftePercent/100)`, the actual comparison metric. Pure, tested.
4. **Manual salary-entry UI:** a per-person detail surface with an add/adjust salary form (react-hook-form + Zod factory, `FormMessage`, `isDirty` gate on edit) wired to `setSalary`, with a success toast.

**Phase 3 — grouping + gap engine (`packages/core`, pure/deterministic)**
5. Equal-work grouping by `roleId`; equal-value grouping by a documented HR/Legal-tunable score-tolerance window on the 0-100 score.
6. Per-group × gender statistics: median, mean, quartiles; unadjusted gap; gender-dominance flag at ≥ 60%.
7. Small-group masking (< 3, configurable default) enforced at the query layer so masked cells never leave the backend.

**Phase 4 — frozen report runs**
8. `payGapReportRun` table (ADR-0008): freeze population + exclusions, ratings copy, model-config copy (criteria, weight points, anchors, band thresholds, equal-value tolerance), derived outcomes, approvals; immutable/reproducible.
9. Multi-actor report audit events (created / reviewed / approved): `AUDIT_EVENTS` keys, typed `AuditPayloads` entries, and readable labels under `dashboard.auditLog.events` in all five locales (guarded by the audit-label coverage test).

**Phase 5 — reporting UI + export**
10. Lönekartläggning report view: gap at total + per worker category by gender, basic-vs-variable component split, quartiles, scoped to legal entity + country + period; with a data-shaped skeleton.
11. Pay-gap PDF export via the `@react-pdf/renderer` branded kit (extend `components/pdf/`).
12. Employer-size thresholds + cadence display, parametrized and gated by authoritative `employeeCount` (<100 none, 100-249 every 3 years, 250+ annually).

**Privacy follow-ups (small, can ride alongside any phase)**
13. `pseudonymizeNames` org setting + conditional `Anställd #<externalRef>` rendering across people surfaces (Decision 1 / §9).
14. Erasure UI wired into the GDPR flow (dashboard trigger for `erasePerson`).
15. Decide whether an audit `actorName` tombstone applies to person erasure (likely out of scope; record the decision).

**Minor spec-alignment items**
16. Surface the detection confidence score in the map table, or note it as intentionally hidden.
17. Reconcile `personAssignments` field names (`effectiveAt`/`endedAt`) with the spec's `validFrom`/`validTo`, or update the spec.

---

## Built beyond spec (import-robustness hardening)

Phase 1 shipped several robustness features not required by the spec, which materially improve real-world file handling:
- Comma-decimal and dot-thousands money normalization. (`parse.ts:29`)
- Non-ISO and mixed date formats: DD.MM.YYYY, DD/MM/YYYY, YYYY/MM/DD, datetime, Excel serial, compact YYYYMMDD. (`parse.ts:240`)
- Fraction-FTE detection (`fractionScaled` issue) for columns expressed as fractions rather than percentages. (`validate.ts:289`)
- File-level warnings (`noDelimiter`, `mojibake`) surfaced in the check step. (`validate.ts:30`; `check-step.tsx:244`)
- A manual Man/Kvinna assign-gender UI for rows whose gender was blank or unrecognized. (`components/people/import/assign-gender.tsx`)
