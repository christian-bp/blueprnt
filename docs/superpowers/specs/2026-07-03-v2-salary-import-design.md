# V2 Salary Import and Lönekartläggning: Design Spec

**Date:** 2026-07-03
**Status:** Design approved (Phase-0 decisions settled); ready for an implementation plan.
**Sources:** the V1 conformance + V2 readiness reports (`docs/superpowers/analysis/2026-07-01-*`), `PLAN-V1.md §11`, ADR-0002/0003/0005/0007/0008, and the customer source docs under `/Users/ce/Downloads/blueprnt docs` (Kravbild för lönekartläggning, Implementationsunderlag rapportering, the directive/criteria analyses, the anonymized payroll test file, the band-model spreadsheet, the track/level/band and job-family explainers).

**Goal:** Import a company's payroll, connect each employee to the V1 role architecture (role, track, level), and produce a defensible EU pay-transparency analysis (Swedish lönekartläggning + Directive 2023/970 gap reporting) as a frozen, auditable report run.

**Architecture:** Two new org-scoped bounded contexts (`people`, `pay`) kept strictly separate from `assessment`, joined to the V1 roles through a third table (`personAssignments`). A pure, deterministic gap engine in `packages/core`. Report runs freeze a reproducible copy of ratings + model config + population + outcomes (ADR-0008). AI never touches the gap or grouping path.

---

## 1. Scope

**In scope (initial V2 build): the core lönekartläggning loop.**
1. CSV payroll import via a full-screen column-mapping wizard that adapts any company's file, auto-detects columns, and warns on missing data (§5).
2. Classify each employee to a standardized V1 role, track, and level (level suggested from title / `Statistikkod` / tenure, HR-confirmed).
3. Normalize pay to a comparable FTE-adjusted monthly basic figure; separate basic from variable/benefit components.
4. Form comparison groups: equal work (same role) and work of equal value (score-tolerance, see §6).
5. Gap analysis per group × gender (median, mean, quartiles, gender-dominance flag) with small-group masking.
6. Freeze a report run (ADR-0008) and export the lönekartläggning report.

**Deferred (data model must accommodate, not built now):**
- **Recruitment pay-range transparency** (explicitly out of product scope per `PLAN-V1 §11`; the track/band substrate stays compatible with a future salary-range-per-band view).
- **Joint pay assessment (gemensam lönebedömning)** case workflow (the 5% unexplained-gap trigger). Keep the entity shape reserved.
- **Art. 7 employee self-service** (individual pay info + aggregated group averages). Introduces employee-facing users; the app is HR-only today.
- **Pay-criteria version publication** beyond what the V1 method appendix already covers.

---

## 2. Decision log (Phase 0)

| # | Decision | Notes |
|---|----------|-------|
| 1 | Identity: store `Anstnr` (`externalRef`) + real `displayName`; an **org display setting** pseudonymizes names in the frontend only (data keeps the real name, erasable). | Deliberate override of the docs' "no name if possible" minimization preference; justified in §9. |
| 2 | Store the **full** birth date (`Födelsedatum`). | Kept for future features; rides on the §9 legal basis. Not required by the Kravbild but present in the CSV. |
| 3 | Gender: **required binary `Man`/`Kvinna`**, no "unspecified". | Confirmed by the test data (120 rows, no third value) and by DL's binary 60% comparison. A blank/unreadable `Kön` is an import-validation item, never stored blank. Gender is **not** GDPR Art. 9 special-category data; it is regular-but-sensitive personal data. |
| 4 | Level (per-individual, on `personAssignments`, validated against the role's `trackKey`): **suggested** from `Befattning` + `Statistikkod` + tenure via the suggestion layer, **HR-confirmed**. | Per ADR-0005 (level is per-individual, set in V2). Reconciles the source explainer's "level-role" framing against the accepted ADR. |
| 5 | Equal-value grouping: **score-tolerance** on the 0-100 role score, independent of band boundaries. | Reverses an earlier "use bands" choice after the docs (`PLAN-V1 §11`: "likvärdigt arbete ≠ band rakt av") flagged band-direct grouping as legally fragile. Tolerance width is a documented, HR/Legal-tunable parameter. |
| 6 | Small-group masking: hide any group with fewer than **3** people. | Parametrized (configurable default), flagged for HR/Legal sign-off; several regimes use 5. |
| 7 | Re-import: **upsert on `Anstnr`**; archive leavers (never hard-delete on re-import); pay stored per `Löneår`; frozen report runs untouched. | |
| 8 | Pay: store **raw** components (basic monthly + variable + benefit, currency, FTE); derive the FTE-adjusted comparator **live** and freeze it in the report run. Never store the derived figure. | Consistent with ADR-0002/0008. Pay is component-based and extensible (Art. 9 split). |

Legal basis: **legal obligation** (Swedish Discrimination Act annual lönekartläggning, in force today for 10+ employers; Directive 2023/970 layered on top). Erasure = **true hard delete** (mirrors the `users` erasure). Report runs freeze ratings + full model config (ADR-0008).

---

## 3. Invariants preserved

- **Role ≠ Person:** `roles`/`ratings` gain no person, pay, gender, or performance field. Person and pay live only in `people`/`pay`; the join is a third table.
- **Derived never stored (ADR-0002):** score/band stay derived live for the live model. A frozen report run is the one bounded, explicit exception (ADR-0008): it stores a copy so an old report is defensible without re-reading the live model.
- **AI out of the path (ADR-0003, extended):** classification may *suggest* a title→role mapping and a level (provenance + human confirm), but normalization, grouping, and gap calculation are deterministic engine code. No AI in the gap/grouping path.
- **EU residency (ADR-0001):** all new tables in the same Convex EU deployment; CSV parsed in a Convex action, no external call.
- **Org = legal entity (ADR-0007):** import, analysis, and reporting are per-org; no cross-org rollup.
- **PII minimal and erasable:** identity/pay PII confined to `people`/`pay`; residual references in audit rows anonymized, not retained.

---

## 4. Data model

All tables org-scoped (`by_org`). New contexts: `people`, `pay`.

### 4.1 `people` (identity + employment master; the only home for identity PII)
- `orgId`, `externalRef` (`Anstnr`, the stable upsert/re-match key), `displayName` (real name, PII, erasable), `gender` (`"Man" | "Kvinna"`, required), `birthDate` (full date), `employmentStartDate` (`Anstallningsdatum`, tenure), `ftePercent` (`Sysselsättningsgrad`), `country` (`Land`), `isManager` (`Chef` Ja/Nej, a track-suggestion signal), `statisticalCode` (`Statistikkod`, SSYK/SCB code, secondary classification signal), `department` (`Avdelning`, optional: mandatory per the Kravbild but absent from the test CSV, so nullable), `archivedAt` (leavers).
- **Org display setting** `pseudonymizeNames: boolean`: when on, the UI renders `Anställd #<externalRef>` (a stable pseudonym) instead of `displayName`; stored data is unchanged.

### 4.2 `personAssignments` (person ↔ V1 role)
- `orgId`, `personId`, `roleId` (the permanent V1 role id), `level` (per-individual within the role's `trackKey`: e.g. IC1..IC5, Lead-*, M1..M3, validated against the track), `levelSource` (suggestion provenance + confirmedBy, per ADR-0003), `validFrom`, `validTo`.
- Rationale: neither `roles` nor `people` absorbs the other's fields; the assignment is where they meet. Level is per-individual (ADR-0005), so it lands here.
- Build-time reconciliation: confirm the track/level ladder against V1's live model (the sources disagree on **Lead 1-3 vs Lead-1..2**).

### 4.3 `payRecords` (compensation per person per pay year)
- `orgId`, `personId`, `payYear` (`Löneår`), `basicMonthly` (`Månadslön`, the primary comparator, parsed from `"94 500 kr"`), `currency` (`Valuta`, trimmed), plus **components** (extensible, Art. 9 split): `variable` (`Målbonus`), `benefitInKind` (`Tjänstebil`), and room for fixed supplements. Store the annual/monthly basis per component.
- **No stored FTE-adjusted figure.** The gap engine computes `fteAdjustedBasicMonthly = basicMonthly / (ftePercent/100)` live and freezes it in the report run.

### 4.4 `payGapReportRun` (frozen snapshot, ADR-0008)
Freezes: `createdAt`, population (with exclusions), a copy of the relevant `ratings`, a copy of the model config (criteria, weight points, anchors, band thresholds, and the equal-value tolerance parameter), the derived outcomes (groups, per-group × gender statistics, gaps, dominance flags, masked cells), and approvals. Immutable and reproducible without reading the live model.

### 4.5 Audit
Extend the existing `auditLog` with multi-actor report events (report created / reviewed / approved) plus typed payloads and locale labels in all five locales, per the audit conventions. `employeeCount` on the org becomes **authoritative**, derived from the import, so it can gate the reporting thresholds.

### 4.6 `importMappingProfile` (remembered column mapping)
- `orgId`, `columnMap` (canonical field → source column header), `parseRules` (delimiter, encoding, money/date formats), `updatedAt`. One active profile per org, saved on a confirmed import and auto-applied on re-import so the annual re-run skips the mapping step (Decision 7). No PII: it stores only column names and format rules.

---

## 5. CSV import: a column-mapping wizard

No two payroll exports are alike (different headers, column order, delimiters, encodings, money/date formats, and missing columns). So import is **not** a fixed-format parser; it is a **full-screen wizard** that adapts any company's CSV onto blueprnt's canonical fields and warns when important data is missing. The 16-column anonymized test file (`Anstallningsdatum; Fornamn; Efternamn; Chef; Kon; Land; Löneår; Födelsedatum; Befattning; Statistikkod; Månadslön; Tjänstebil; Målbonus; Valuta; Anstnr; Sysselssättningsgrad`) is one example the wizard must handle, not the contract.

### 5.1 Layout: reuse the onboarding wizard frame
Build it on the onboarding wizard primitives so it feels familiar: an `ImportWizard` frame (a `STEPS` single-source-of-truth array rendered in `AuthShell`, `OnboardingDots` progress, `ScreenShell` + `NextButton`, the same crossfade) as a full-screen flow launched from an "Import salaries" action. It is not the onboarding gate; it is its own surface (`components/import/`).

### 5.2 Steps
1. **Upload:** select or drop a CSV. Detect delimiter (`;` `,` tab), encoding/BOM, and the header row. Parse **client-side** (deterministic, in-browser) for the interactive preview; the file never touches an external service.
2. **Map columns (the "figure out what is what" step):** for each canonical target field, auto-guess the source column and present an editable mapping table (target field ← source-column dropdown + a live sample-value preview + a confidence hint). Unmapped or low-confidence required fields are highlighted. The user corrects any guess.
3. **Check readiness (warn on missing data):** a checklist of required vs recommended fields (§5.4) plus a row-level data-quality report with counts and fix/skip options.
4. **Review + confirm:** preview normalized rows (parsed money, trimmed currency, FTE), show the summary (N people, N flagged), confirm → persist to `people` + `payRecords`, upserting on the mapped identifier, and save the mapping profile (§4.6).

Classification (title → V1 role + level) follows the import (Kravbild sequence: import → classify → group → analyze) as later screens of the wizard or a dedicated mapping surface (§6).

### 5.3 Deterministic auto-detection (no AI; PII never leaves the EU)
Detection combines two deterministic signals:
- **Header-name matching** against a multi-locale synonym dictionary per field (sv/nb/da/fi/en). E.g. gender ← {Kön, Kon, Gender, Sex, Kjønn, Køn, Sukupuoli}; basic salary ← {Månadslön, Grundlön, Fast månadslön, Monthly/Base salary}; employee no ← {Anstnr, Anställningsnummer, EmployeeID, EmpNo}; FTE ← {Sysselsättningsgrad, FTE, Tjänstgöringsgrad, Omfattning}.
- **Value-shape heuristics** on sampled rows: money-with-suffix → salary; a `Man`/`Kvinna` two-value column → gender; `YYYY-MM-DD` → date; a 0-100 integer → FTE/percent; a stable integer id → employee no; free text → title.

This MUST be deterministic and local. The CSV carries salary + identity PII, which must never reach the AI model or any external service (GDPR "never send personal data to the AI"; ADR-0003 extended to the pay path). The confirmed import + validation re-run in a Convex action (EU).

### 5.4 Required vs recommended fields (missing-data warnings)
- **Required** (block or hard-warn; a lönekartläggning is not valid without them): employee identifier (the upsert key), basic monthly salary (the comparator), gender, a role signal (title).
- **Recommended** (soft-warn with the stated consequence): FTE (else assume 100%; part-time comparisons will be off), pay year (else default the current year), `Statistikkod` (else classification leans on title alone), variable/benefit components (else basic-only analysis), department.

### 5.5 Parsing + data-quality rules (the validator; proven by the test file)
- `"94 500 kr"` → strip space separators and the `kr` suffix → integer.
- `" SEK "` → trim.
- FTE integer percent; tolerate header typos (the test file has `Sysselssättningsgrad` with a double `s`).
- Skip blank trailing rows.
Flag for HR resolution (never a silent import): a duplicate identifier in a batch (the test file has `Anstnr` 114 twice for two people), a non-numeric `Statistikkod` (`"UX Developer"` in a code cell), a blank/unreadable gender (required), and gender/name plausibility mismatches (e.g. `Sven` with `Kvinna`).

---

## 6. Classification, normalization, grouping, gap analysis

**Classification (the load-bearing step):** group identical/near titles, suggest a V1 role per title (fuzzy on `Befattning` + `Statistikkod`; `Chef=Ja` shifts toward Lead/Manager), HR confirms. Unmatched titles route to create-role or map-to-existing; blanks flagged. Suggest and HR-confirm the per-individual level. Every imported employee must be linked to role + track + level (Kravbild §6/§10, no carve-outs).

**Normalization:** FTE-adjust basic monthly (`basicMonthly / (ftePercent/100)`); keep basic separate from variable/benefit (Art. 9). Derived live, frozen per run.

**Grouping (deterministic, `packages/core`):**
- *Equal work* = same `roleId` (exact).
- *Work of equal value* = roles whose 0-100 derived scores fall within a **documented tolerance window** of each other (default width TBD with HR/Legal, e.g. ±N points), independent of band edges. The tolerance parameter is frozen in each report run and documented in the method appendix. (Clustering is a possible future refinement; fixed tolerance first.)

**Gap analysis (deterministic, no AI):** per group × gender: median, mean, quartile distribution; gender-dominance flag at ≥60%; unadjusted gap. **Small-group masking** (default: hide groups < 3) enforced as a **query-layer invariant**, not a UI afterthought.

---

## 7. Reporting, thresholds, export

- **Employer-size thresholds** (parametrized, gated by the authoritative `employeeCount` per legal entity): < 100 no mandatory gap report (other duties still apply); 100-149 and 150-249 every 3 years; 250+ annually. Swedish DL requires annual lönekartläggning for all, written docs at 10+.
- **Report contents:** gap at total level and per worker category, broken down by gender; pay-component split; quartiles; scoped to the legal entity + country + period; population frozen at run date.
- **Parametrization:** thresholds, cadence, templates, recipients, masking threshold, and export formats are configuration (final Swedish transposition is not yet fixed), never hardcoded.
- **Export:** the branded PDF kit (pandoc/typst is for internal docs; in-app exports use the existing `@react-pdf/renderer` kit that produced the metodbilaga). CSV/XLSX and an authority API are future formats.

---

## 8. Build phasing

1. **Import wizard + people/assignment:** the full-screen column-mapping wizard (upload → deterministic auto-map → readiness check → review, §5) on the onboarding frame; deterministic CSV parse + validation (client-side preview, Convex action of record); `people`, `personAssignments`, `importMappingProfile`; the title→role mapping + level-suggestion UI; erasure hard-delete wired into the GDPR flow; authoritative `employeeCount`. Tests + i18n in the same commit.
2. **Pay import + normalization:** `payRecords` with the component split; FTE-adjust logic (engine).
3. **Grouping + gap engine (`packages/core`, pure, deterministic):** equal-work + score-tolerance equal-value groups; dominance flag; median/mean/quartiles; masking baked into the query layer.
4. **Frozen report runs (ADR-0008):** `payGapReportRun`; multi-actor audit events + payloads + locale labels.
5. **Reporting UI + export:** the lönekartläggning report view + PDF export; threshold-driven cadence display.

---

## 9. Privacy / GDPR

- **Legal basis:** legal obligation (Discrimination Act + Directive 2023/970). Gender is regular-but-sensitive personal data (not Art. 9); processed with data minimization and strict role-based access.
- **Access control:** only the correct audience sees personal data; everyone else sees aggregates. RBAC enforced throughout; the frontend name-pseudonymization setting is a display aid, not the access boundary.
- **Retention:** person + pay kept per year to support historical lönekartläggning. **Erasure = true hard delete** of `people` + `personAssignments` + `payRecords` for that person; frozen runs retain only anonymized aggregates, so an erased person leaves no PII behind.
- **Name storage justification:** storing the real `displayName` (rather than pseudonym-only, which the source docs preferred) is a deliberate product choice for a readable HR roster; mitigated by the frontend pseudonymization setting, erasability, and RBAC. Documented here as the justification.

---

## 10. Open items for HR/Legal (parametrized, confirm before go-live)
- Small-group masking threshold (provisional default 3).
- Equal-value score-tolerance width and its documented justification in the method appendix.
- Which pay components count in the statutory comparison metric (basic only vs basic + variable + benefit).
- Final Swedish transposition specifics (report form, deadlines, recipients, formats) once legislated.
- Band count (6 prototype vs 7 shipped) and the Lead track ladder (Lead 1-3 vs Lead-1..2) reconciled against V1's live model.

---

## 11. Deferred entities (reserved, not built)
Recruitment Pay Range Disclosure; Pay Transparency Request (Art. 7); Joint Pay Assessment Case (5% trigger workflow); Employment Snapshot (time-scoped FTE/title history, folded into `people` for now). The data model leaves room for each.
