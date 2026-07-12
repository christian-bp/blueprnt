# V2 Readiness Report: Salary Import + Connect-to-Roles + Pay-Gap Reporting

Date: 2026-07-01
Scope: the next V2 step — importing a company's salaries, connecting them to the
V1 role register, and producing EU pay-transparency reporting (lönekartläggning
+ Directive 2023/970 gap reporting).

Verdict: **Foundation-ready, nothing built.** V1 deliberately laid every seam this
step needs (stable role ids, Role != Person, org = legal entity, live-recompute
with a designed frozen-snapshot escape hatch, Level-per-individual deferred to
exactly this phase). No people, pay, level, comparable-work-group, or report-run
table exists. This is a clean greenfield build on a correct foundation, not a
retrofit. The one genuine tension — V1 kept PII out of domain tables, V2 must
introduce person + salary PII — is anticipated by the reserved `people`/`pay`
contexts and by ADR-0005/0007/0008, and is resolvable by isolating PII in a
minimal, erasable `people` context that never contaminates `roles`/`ratings`.

---

## 1. What the docs require for V2

### 1.1 Salary import (CSV)
The customer's source-of-truth is a payroll export. The test file
(`Import Anonymiserad - testfil.csv`) is the concrete contract:

- Delimiter `;`, UTF-8-BOM, Swedish headers, ~122 employee rows, ~40 distinct titles.
- Columns (order): `Anstallningsdatum`, `Fornamn`, `Efternamn`, `Chef`, `Kon`,
  `Land`, `Löneår`, `Födelsedatum`, `Befattning`, `Statistikkod`, `Månadslön`,
  `Tjänstebil`, `Målbonus`, `Valuta`, `Anstnr`, `Sysselssättningsgrad`.
- Data is messy in exactly the ways real payroll data is: title typos
  (`Techincal Solutions Architect`), blank `Befattning` cells (4 rows), titles
  that will not string-match a V1 role name 1:1, money formatted as `"94 500 kr"`
  (space thousands-sep + suffix), currency padded `" SEK "`.

Import must: parse -> validate -> **map each person to a V1 role** (the hard step)
-> normalise salary to a comparable FTE-adjusted monthly figure -> persist person
+ pay + assignment rows.

### 1.2 Connect people to V1 roles (classification)
`Befattning` (job title) is the join key from a person to the role in the V1 job
architecture. The Kravbild requires each individual be mapped to a **standardised
role, track, and level**. Track already lives on the role (IC/Lead/M). Level is
per-individual (ADR-0005) and is assigned *here*, at import/placement time. The
mapping is many-to-one (29 "Software Developer" rows -> one role) and lossy
(typos, blanks, near-synonyms) so it needs a human-confirmed mapping step, not a
blind string join.

### 1.3 Pay-gap analysis + lönekartläggning
- **Normalise:** convert `Månadslön` to a comparable monthly figure, FTE-adjusted
  by `Sysselssättningsgrad`. Separate **basic salary** (`Månadslön`) from
  **variable/benefit** components (`Målbonus`, `Tjänstebil`) — Directive Art. 9
  mandates this split.
- **Comparable-work groups:** two kinds. *Equal work* = same role. *Work of equal
  value* = equivalent band-derived group (but NOT raw "same band" — see 1.5).
- **Gender dominance flag** per group (60% threshold).
- **Unadjusted gap:** median + mean pay per group x gender, quartile distribution.
- **Thresholds:** 5% unexplained gap in a category, unremediated 6 months, at a
  reporting-obligated employer -> joint pay assessment (gemensam lönebedömning).
- **Swedish Discrimination Act** annual lönekartläggning applies TODAY to all 10+
  employers (the immediate SMB driver); Directive gap-reporting thresholds
  (100/150/250) are the larger-employer layer.

### 1.4 Reporting dimensions (incl. legal entity)
- **Population unit = legal entity + country + headcount** decides which regime
  applies. Per ADR-0007, **org = legal entity**; `organizations.country` and
  `employeeCount` are already per-org, so the reporting axis is free — but
  `employeeCount` must become **authoritative** (derived from imports) before it
  can gate the 100/150/250 thresholds.
- Pay components split (basic vs variable), gender breakdown, worker category,
  gap metric, action threshold, hiring transparency, criteria publication.

### 1.5 Frozen report-run snapshots (ADR-0008)
A report run must be **reproducible and auditable after the fact**, with full
historisation and traceability from the aggregate figure back to the computation.
Because the live model recomputes (ADR-0002) and never stores score/band, a run
must **freeze a copy** of: freeze timestamp, population (with exclusions), the
**ratings**, the **model config** (criteria, weight points, anchors, band
thresholds), the derived outcomes, and approvals. Equivalent-work grouping is its
own concept: band boundaries are sensitive, so raw "same band" is legally fragile;
V2 defines its own tolerance-band/clustering logic. AI never touches gap
calculation or grouping (must stay deterministic and explainable).

---

## 2. What already exists vs what is missing

### 2.1 Exists (foundation — all confirmed in code + ADRs)
| Foundation | Status | Evidence |
|---|---|---|
| Org = legal entity, org switcher | Built | ADR-0007 accepted 2026-06-17; `organizations.country`, `employeeCount`; org-switch UI |
| Per-org tenant isolation, no cross-org rollup | Built | `orgQuery`/`orgMutation` inject `ctx.orgId`; all assessment reads `withIndex("by_org")` |
| Stable, permanent role ids (never reused, soft-archive only) | Built | `roles` comment + `archiveRole` (archivedAt); "V2 equal-work grouping depends on it" |
| Role != Person invariant | Built | `roles`/`ratings` carry no person/salary/gender/perf fields |
| Track on role (IC/Lead/M) | Built | `roles.trackKey` literal union (ADR-0006) |
| Live-recompute; score/band derived, never stored | Built | ADR-0002; `packages/core` pure engine; `compute.ts` |
| Frozen-snapshot design (copy ratings + model config) | Designed, not built | ADR-0008: "Byggs inte nu"; no `payGapReportRun` table |
| Level-per-individual deferred to V2 | Deferred by design | ADR-0005; no `level` field anywhere; defs live in `standardmall.md` |
| Track guardrail ranges (per level/criterion) | Reference data | `standardmall.md`; reusable as V2 placement aid |
| Audit trail w/ actor + erasure anonymization | Built (single-actor) | `auditLog`, `logAudit`, actorName tombstone on erasure |
| PII isolation + GDPR hard-delete pattern | Built | `users` mirror hard-deleted on erasure; PII never on domain tables |
| Method-appendix data fields (bias/criteria rationale) | Partial (V1 gap) | `criteria.purpose/whyRelevant/biasRisk/...`; no UI, no export |

### 2.2 Missing (all V2 scope, correctly deferred)
- **`people` context:** no employee/person entity, no person-role assignment.
- **`pay` context:** no salary/compensation/pay-component table.
- **`level`:** no per-individual level entity.
- **Comparable-work groups:** no equal-work / equal-value grouping entity or logic.
- **`payGapReportRun`:** no frozen-snapshot table; no gap-computation engine.
- **CSV import:** no parser, no import route, no import/mapping UI.
- **Small-group privacy / cell masking:** not designed (must be designed-in, not bolt-on).
- **Multi-actor / report-run audit events:** `auditLog` is single-actor and its
  payload is `v.any()`; no events for report created/approved, pay disclosure,
  joint assessment, worker-rep sign-off.
- **Export (gap report PDF/CSV/XLSX):** not built. (Method appendix export is a
  separate *V1* gap.)
- **Authoritative `employeeCount`:** field exists but is only an AI hint; never
  populated from data; cannot yet gate thresholds.

---

## 3. Data-model proposal: connect people + salaries to V1 roles

Two new bounded contexts, kept strictly separate from `assessment` so the
Role != Person wall holds. All tables org-scoped (`by_org`).

### 3.1 `people` context

**`people`** (the person / employment master — the only home for identity PII)
| Field | Source column | Notes |
|---|---|---|
| orgId | — | tenant scope |
| externalRef | `Anstnr` | employer's employee number; the stable import re-match key; treat as PII |
| displayName | `Fornamn` + `Efternamn` | **PII.** Store only if a customer needs a readable roster; ideally optional. Prefer a pseudonym. Erasable. |
| gender | `Kon` | **Sensitive PII** (Art. 9 special category). Normalise Man/Kvinna -> enum; leave room for an inclusive/unknown value (V2 design question). |
| birthDate | `Födelsedatum` | **PII.** Consider storing only birthYear (cohort analysis needs a year, not a day) to minimise. |
| employmentStartDate | `Anstallningsdatum` | tenure; semi-PII |
| ftePercent | `Sysselssättningsgrad` | normalisation input |
| country | `Land` | jurisdiction (usually inherited from org/legal entity) |
| isManager | `Chef` | structural hint, aids classification (Ja/Nej) |
| statisticalCode | `Statistikkod` | SSYK/SNI occupational code; secondary classification signal |
| archivedAt | — | leavers; but erasure is a true hard delete, not archive (see 3.4) |

**`personAssignments`** (person <-> role, the join to V1 job architecture)
| Field | Notes |
|---|---|
| orgId | scope |
| personId | id("people") |
| roleId | id("roles") — the permanent V1 role id; the whole point of stable ids |
| level | per-individual level within the role's track (ADR-0005): e.g. IC1..IC5, Lead-1..2, M1..M3. Validated against the role's `trackKey`. |
| validFrom / validTo | assignment validity period (Kravbild) |

Rationale: the assignment table (not `people`, not `roles`) is where person meets
role. `roles` stays pure; `people` never references criteria/scores. Level lands
here because it is per-individual (ADR-0005), and this is "exactly V2".

### 3.2 `pay` context

**`payRecords`** (compensation per person per pay year)
| Field | Source column | Notes |
|---|---|---|
| orgId | — | scope |
| personId | id("people") | |
| payYear | `Löneår` | temporal scope |
| basicMonthly | `Månadslön` | parse `"94 500 kr"` -> 94500 integer minor-unit or SEK; **basic salary**, the primary metric (Art. 9) |
| variableBonus | `Målbonus` | **variable pay** component |
| benefitInKind | `Tjänstebil` | benefit component (car allowance) |
| currency | `Valuta` | trim `" SEK "` |
| fteAdjustedBasicMonthly | derived | `basicMonthly / (ftePercent/100)`; the comparison figure. Store derived-at-import for report stability, or derive live in-run and freeze in the snapshot. |

### 3.3 CSV column -> model mapping (summary)
- **Role join:** `Befattning` -> `personAssignments.roleId` via a **human-confirmed
  title->role mapping** (not a blind join). `Statistikkod` + `Chef` are auxiliary
  auto-classification signals. Titles with no V1 role become "create role" or "map
  to existing" prompts; blank/typo titles are surfaced for manual resolution.
- **Identity PII (`Fornamn`/`Efternamn`/`Födelsedatum`/`Anstnr`/`Kon`):** land
  ONLY in `people`. Never in `roles`/`ratings`/`auditLog` payloads.
- **Pay (`Månadslön`/`Målbonus`/`Tjänstebil`/`Valuta`):** land ONLY in `payRecords`.
- **Structure (`Land`/`Löneår`/`Sysselssättningsgrad`/`Anstallningsdatum`):** split
  between `people` (fte, country, start) and `payRecords` (year).

### 3.4 How this respects V1 invariants
- **Role != Person:** person and pay live in `people`/`pay`; `roles`/`ratings`
  gain nothing. The join is a third table (`personAssignments`), so neither side
  absorbs the other's fields.
- **Band derived, not stored:** the assignment carries no band. A person's band =
  the band of their role, derived live by the engine (or frozen in a report run
  per ADR-0008). Pay data never touches the deterministic score/band path.
- **PII minimal + erasable:** identity PII is confined to `people`. Erasing a
  person is a **true hard delete** of their `people` + `personAssignments` +
  `payRecords` rows (mirror the existing `users` erasure pattern), NOT a
  soft flag. Minimise at import: prefer pseudonym over name, birthYear over
  birthDate. Any residual reference in audit rows is anonymized, not retained.
- **EU residency:** all tables in the same EU Convex deployment (ADR-0001). No
  new subprocessor; CSV parsed in a Convex action, no external call.
- **Level = per individual:** exactly ADR-0005 — level lands on `personAssignments`,
  never on `roles`.
- **AI stays out:** classification may *suggest* a title->role mapping through the
  existing suggestion layer (provenance + human confirm, ADR-0003), but gap
  calculation and grouping are deterministic engine code, never AI.

### 3.5 The GDPR tension, explicitly
V1's central privacy stance is "keep PII out of domain tables; a person is
erasable; PII lives only in the `users` mirror + Better Auth." V2 **must**
introduce person + salary PII — the whole feature is analysing individuals' pay
by gender, which is special-category data (Art. 9 GDPR). This is not a violation
of the invariant; it is the invariant working as designed:

- The invariant was always "PII lives in a dedicated, minimal, erasable place,
  never smeared across domain tables." V2 adds a second such place (`people`),
  built to the same rules as `users`: hard-delete erasure, minimal fields,
  no leakage into `roles`/`ratings`/audit payloads.
- ADR-0005 pre-planned the person layer ("nivån sätts på medarbetaren när
  people-kontexten byggs (V2)"). ADR-0007 pre-planned the reporting axis (org =
  legal entity, `employeeCount` from imports). ADR-0008 pre-planned that a report
  run freezes a reproducible copy so live PII need not be re-read to defend an old
  report. The reserved `people`/`pay` contexts in CONTEXT-MAP.md are the
  designated landing zone.
- New privacy work V2 must add on top: legal basis + retention policy for salary
  data, sensitive-data handling for `Kon`, **small-group cell masking** (min group
  size before a gap figure is shown — must be designed into the query layer, not
  bolted on), and a data-processing/erasure story for imported people who are not
  app users.

---

## 4. Phased build plan, risks, open questions

### Phase 0 — Decisions before code (blockers)
Resolve the open questions in 4.6 first; several are schema-shaping.

### Phase 1 — People + assignment (the join, no pay yet)
- `people` + `personAssignments` tables; org-scoped; erasure hard-delete path
  wired into the existing GDPR flow.
- CSV parser (Convex action): decode BOM, `;` split, money/currency normalisers,
  robust to blanks/typos. Validation + row-level error reporting.
- **Title->role mapping UI:** the load-bearing step. Group identical titles,
  fuzzy-suggest a V1 role per title, human confirms; unmatched titles route to
  create-role or map-to-existing; blanks flagged. Assign level per person here.
- Populate authoritative `employeeCount` from the import.
- Tests + i18n in the same commit.

### Phase 2 — Pay import + normalisation
- `payRecords` table; parse basic/variable/benefit split; FTE-adjust.
- No analysis yet — just clean, comparable pay data connected to people connected
  to roles.

### Phase 3 — Comparable-work groups + gap engine (deterministic, in `packages/core`)
- Equal-work groups (same role) and equal-value groups (own tolerance-band /
  clustering logic — NOT raw same-band).
- Gender-dominance flag (60%). Median/mean per group x gender, quartiles.
- Small-group cell masking baked into the query layer.
- Pure, deterministic, explainable; no AI.

**v3 update (ADR-0012):** Phase 3 splits into 3a and 3b. Phase 3a is the
mandatory gender-gap PRIMARY VIEW and must land first: Step 1 (lika arbete,
group = job_title + band + level) and Step 2 (likvärdigt arbete, group =
band), pre-selected, always-on, non-disableable, classified by the v3
four-level flag ladder (🔴 gap > 10% / 🟠 5-10% / ✅ < 5% / ⚪ otillräckligt
underlag: fewer than 4 individuals in the group or the group missing one
gender). Phase 3b is the secondary/complementary comparisons (equal-value
tolerance/clustering, job-family/cohort/intersectional views), layered on
top, per the P1 > P2 > P3 priority order. See ADR-0012.

### Phase 4 — Frozen report runs (ADR-0008)
- `payGapReportRun`: freeze timestamp, population + exclusions, copy of ratings,
  copy of model config (criteria/weights/anchors/thresholds), derived outcomes,
  approvals. Reproducible without reading the live model.
- New audit events (report created/approved) + typed payloads + locale labels.

### Phase 5 — Reporting UI, export, workflows
- Gap report view + export (PDF via pandoc+typst, CSV/XLSX).
- Threshold detection -> joint pay assessment (gemensam lönebedömning) workflow.
- Art. 7 employee self-service pay information.
- (Separate V1 debt to also close: method-appendix UI + export.)

### 4.5 Key risks
1. **Title matching is the whole ballgame.** 40 titles, typos, blanks, near-dupes,
   many-to-one. A bad mapping silently corrupts every downstream gap figure.
   Must be human-confirmed, re-runnable, and stable across re-imports (key on
   `Anstnr`).
2. **PII sprawl.** Easy to accidentally log a name into an audit payload or leak
   into a suggestion. Enforce the wall with types + tests, as V1 does for `users`.
3. **Small-group re-identification.** Gap figures on a 2-person group leak salary.
   Masking must be a query-layer invariant, not a UI afterthought.
4. **Snapshot completeness.** If a run freezes outcomes but not the model config
   (the ADR-0008 mistake it explicitly warns against), reports become
   indefensible. Copy ratings AND model config.
5. **Equal-value grouping legal fragility.** Raw band boundaries are sensitive;
   needs its own justified clustering logic + documentation.
6. **Level assignment has no source column.** The CSV has no level; someone must
   assign it, or it must be inferred (and inference is contestable).

### 4.6 Top open questions to resolve before building
1. **Pseudonym vs name:** is `Anstnr` the canonical person key and can we avoid
   storing names at all? (Kravbild prefers pseudonym.)
2. **Birth date granularity:** store full `Födelsedatum` or only birthYear?
3. **Gender model:** binary Man/Kvinna for the 60% flag vs an inclusive enum —
   the docs flag this as an unresolved V2 design question.
4. **Level source:** who assigns per-individual level, and is any inference from
   `Statistikkod`/title/tenure acceptable or must it be manual?
5. **Equal-value grouping algorithm:** tolerance band width? clustering method?
   How is the grouping justified in the method appendix?
6. **Min group size for masking:** what threshold, and what does the UI show for a
   suppressed cell? **CLOSED (v3/ADR-0012):** fewer than 4 individuals OR the
   group is missing one gender. This is the ⚪ statistical-insufficiency
   threshold in the gap ladder, distinct from privacy cell-masking (also
   raised to 4, but a separate concern; see ADR-0012).
7. **Retention + legal basis** for imported salary/PII of non-app-user employees,
   and their erasure/rectification path.
8. **Re-import semantics:** upsert on `Anstnr`? How are leavers, title changes, and
   pay-year rollovers handled without breaking frozen historical runs?
9. **`fteAdjustedBasic` storage:** derive-and-store at import, or derive live and
   freeze only in the run? (Affects whether pay tables hold derived values.)
