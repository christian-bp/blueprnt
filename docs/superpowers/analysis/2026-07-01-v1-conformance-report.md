# blueprnt V1 Conformance Report

**Question:** Does the blueprnt implementation follow its own documentation (PLAN-V1.md, the ADR set, the context glossaries, and the criteria/band spec documents)?

**Date:** 2026-07-01
**Method:** Eight per-domain audits, each independently re-verified by an adversarial adjudicator against the live source under `/Volumes/development/blueprnt/frontend`. This report consolidates the verified verdicts. Every claim below is backed by a file:line or doc reference carried up from the adjudicated findings. The Reporting & V2 salary-import domain is excluded here (it belongs in the V2 report) and appears only as a dependency note.

---

## 1. Executive Summary and Overall Verdict

**Overall verdict: CONFORMANT (with a small set of scoped, non-critical gaps).**

Across seven V1 domains, 105 documented requirements were verified. **Zero critical deviations** were found. The load-bearing architecture invariants — the ones the docs mark as "never break without a new ADR" — are all implemented correctly and defended by construction, not by discipline:

- Score and band are **never stored**; they are always derived at read time by the pure `packages/core` engine (ADR-0002).
- `packages/core` is genuinely pure: zero runtime dependencies, no Convex/Next/React imports (ADR-0002).
- Weight points are integers 1–5 under an exact zero-sum point budget (n×3), enforced in core, backend, and UI (ADR-0004).
- AI never touches the score/band path, never auto-decides (except the one documented onboarding prefill), and runs only in server-side Convex actions against an EU-hosted model (ADR-0003).
- Band 1 = highest, no manual band override anywhere, tracks are a literal union with no `tracks`/`levels` tables, level is never on the role (ADR-0005, ADR-0006).
- Role ≠ Person: no person/salary/performance field on any domain table; PII confined to the users mirror + Better Auth tables (GDPR).

The two domains rated "conformant" outright are **Weighting/Point-budget** (17/17 upheld) and **Tracks/Levels/Bands/Families**. The remaining five are "mostly-conformant": their core machinery is correct and the deviations are naming, seeded-locale, aspirational-fallback, or E2/E5-deferred-UI issues — not violations of a stated invariant.

**Top findings to act on before go-live:**

1. **(Important) Standard-template anchor texts are condensed paraphrases, not the approved "NYA texter" v3 (2026-06-16) verbatim.** Legal-defensibility risk under EU pay transparency. `standardTemplate.content.sv.ts`.
2. **(Important) Criterion rationale / bias-review write path is absent.** The schema fields exist but no mutation writes them and no UI surfaces them — the directive's objectivity/bias-review evidence cannot yet be produced. `criteria.ts`.
3. **(Important) Exportable methodology annex is not built.** i18n key exists; no component or export endpoint. Directive "level-2" compliance artifact. 
4. **(Important) `PLAN-V1.md` overclaims four-factor coverage:** the 9 default criteria do not address "working conditions" (arbetsförhållanden). Mitigated by custom criteria + the annex, but the prose is an overstatement.
5. **(Minor, cluster) Deferred configurability / seeded-locale / fallback gaps:** band-threshold editing (E2), nb/da/fi criteria seeded in English, and the documented Azure fallback not implemented.

Nothing found blocks the core V1 loop. The important items are compliance-evidence and copy-fidelity issues, appropriate to resolve during the pre-launch hardening pass.

---

## 2. Per-Domain Findings

### 2.1 Weighting & Point Budget (ADR-0004) — CONFORMANT

**Conforms (all 17 requirements upheld, no disputes):**

- 1–5 integer weight points, no other scheme: `WEIGHT_POINT_VALUES = [1..5]` (`packages/core/src/weighting.ts:6`), `isWeightPoints` integer+range check (`weighting.ts:21-23`), backend rejects non-1–5 (`evaluationModel/criteria.ts:194-201`), UI only offers buttons 5→1 (`apps/dashboard/lib/weighting.ts:4`).
- Exact budget = n×3, enforced server-side before any write: `pointBudget(n)=n*3` (`weighting.ts:26-31`), `isBalanced` gate with `ERROR_CODES.weightsUnbalanced` (`criteria.ts:210-211`).
- Percent share is derived display-only: `formatShare` (`apps/dashboard/lib/weighting.ts:9-20`); `criterionShares` marked "never stored" (`scoring.ts:74-75`, `types.ts:19`).
- New criterion enters at 3 (`criteria.ts:67`); removal redistributes deterministically, heaviest-down/lightest-up, ties in display order, logged in the removal audit row (`criteria.ts:317,350-363`, `ai/weights.ts:16-31`).
- Atomic batch reweight, one audit row per save, no-op returns early (`criteria.ts:175-257,219`).
- Real-time budget meter "X weight points left to distribute" with save gate (`model-builder.tsx:119-123,203`; `en.json:687`).
- Legacy 7-level importance scale fully retired — no `model.importance.*` keys, no schema field (grep clean; ADR-0004 line 32).
- Score formula `floor(20*raw/totalPoints)` producing integer 0–100 (`scoring.ts:71`); floor makes threshold comparison exact (`scoring.ts:34-36`).
- AI weight-review moves are zero-sum; any accepted subset stays balanced (`ai/suggest.ts:307-312,367-401`).
- Standard template: 9 criteria summing to 27, thresholds 98/83/74/63/53/41/0 (`standardTemplate.ts:37-71`).

**Deviations / gaps:** None substantive. Three minor line-number citation drifts in the original audit, corrected without status change.

**Severity:** none.

---

### 2.2 Criteria & the 0–5 Evaluation Scale — MOSTLY CONFORMANT

**Conforms:** 0–5 scale with exactly 6 embedded anchors, guarded on add and update (`evaluationModel/tables.ts:27`, `criteria.ts:42,123`; enforced integer rating in `scoring.ts:24-28`, and again at mutation level `assessment/ratings.ts:21`). 9 criteria in the correct display order (`standardTemplate.ts:20-31`). Criterion `description`/`helpText` **match the "NYA texter Kriteriebeskrivningar" spec verbatim** for all 9. Blinded rating flow — no weight points in the rating stepper interface, reveal only in the result step (`rating-stepper.tsx:25-31,48-49`). Motivation optional (`tables.ts:69`). Custom criteria enter at 3 with `isCustom` (`criteria.ts:67-69`). `MIN_CRITERIA = 5` enforced on removal and at onboarding completion (`weighting.ts:19`, `criteria.ts:294-296`). Score formula, never-store-score/band, and "Weighting" (not "Score") terminology all met. 0-lowest→5-highest direction shown in the editor (`criterion-form.tsx:139,163-169`).

**Deviations:**

- **Anchor per-level texts are condensed paraphrases, not the approved v3 verbatim texts — DEVIATES, IMPORTANT.** The 6 per-level anchors in `standardTemplate.content.sv.ts` are shortened rewrites of the "Rollbeskrivning" column from "NYA texter till ROLL värdering.md" v3 (2026-06-16). Example — Scope level 0: spec "Ansvarar för egna, avgränsade uppgifter. Resultatet påverkar det omedelbara arbetsflödet." vs code "Ansvar för egna uppgifter inom ett tydligt begränsat område." Note the `description`/`helpText` fields **do** match verbatim; the deviation is limited to the anchor texts. This affects legal defensibility of the instrument.
- **Compliance field names deviate — DEVIATES, MINOR.** `overlapNotes` (spec `overlapWithOthers`), `decidedBy` (spec `decisionMaker`), `decidedAt` (spec `date`) in `evaluationModel/tables.ts`. Semantics identical; E2 UI not yet built, so a rename now is cheap.
- **nb/da/fi orgs seed criteria text in English — DEVIATES, MINOR.** `contentLocale()` is binary sv-vs-en (`model.ts:37-46`), so a Norwegian org's stored criterion rows get English text. `getModel` re-localizes pristine (`templateKey`-tagged) criteria at read time via `clampLocale`, so unedited templates render correctly; the latent bug materializes only once an E2 edit clears `templateKey`, freezing English into nb/da/fi rows. Fix before E2 editing ships.

**Extra (benign):** per-criterion `weightLevels` explanation texts (5 per criterion, all locales) — additive UI aid, no spec conflict (`standardTemplate.content.en.ts:13`).

**Severity:** one Important (anchor-text fidelity), two Minor.

---

### 2.3 Score → Band Derivation (ADR-0002) — MOSTLY CONFORMANT

**Conforms (14 requirements, all upheld):**

- Score/band never stored on any domain document — verified by reading every `db.insert`/`db.patch` call site; none touch a `score` or `band` field (`assessment/tables.ts`, whole-backend grep). `computedBand` in audit payloads is an in-memory value written to the append-only `auditLog`, not domain state.
- Single derivation path: `computeResults` from `@workspace/core` is imported and called only in `assessment/compute.ts:8-9,79`; all queries and result-affecting mutations flow through it.
- `packages/core` is pure: `package.json` has zero `dependencies`; no Convex/Next/React import anywhere in the package.
- Band 1 = highest via the tie-break sort `(a,b)=>b.minScore-a.minScore || a.band-b.band` (`scoring.ts:117-118`; `types.ts:6`).
- No manual band override (grep across mutations clean); `anchorRole.expectedBand` is a calibration reference, not an override.
- On-read derivation, no caching layer.
- Completeness gate: score/band are null unless every criterion is rated, with a duplicate-rating guard (`scoring.ts:142-143,158-160`; tests `scoring.test.ts:178-215,247-265`).
- Band thresholds embedded on the `models` document, no separate table (`evaluationModel/tables.ts:14`).

**Deviations / gaps:**

- **Band thresholds cannot be edited after model creation — DEVIATES, IMPORTANT (E2 gap, ADR-0004 configurability, not an ADR-0002 violation).** The schema supports arbitrary per-org thresholds, but no mutation patches `bandThresholds` after creation; all three creation paths call `defaultBandThresholds()` only. Comment at `standardTemplate.ts:62` ("editable in E2") is the honest deferral marker. The docs promise "configurable per organization" (digest-spec §3); today only the data model is ready, the mutation and UI are not.

**Corrections:** schema has 12 tables, not 10 (no finding impact). Added R15: client-side `criterionShares` use (`role-criterion-breakdown.tsx:36`) is display-only, consistent with the invariant.

**Severity:** one Important (deferred configurability). No derivation-correctness issue.

---

### 2.4 Tracks / Levels / Bands / Families (ADR-0005, ADR-0006) — CONFORMANT

**Conforms:** Track is a literal union `"IC"|"Lead"|"M"` with **no** `tracks` table (`evaluationModel/tables.ts`, `schema.ts` — 12 tables, none named tracks/levels). Level is **not** on the role — no `level`/`levelId` on `roles`/`ratings` (grep clean); the `DevLevel` type is seed-fixture-only. `checkGuardrails`/`guardrails.ts` do not exist in `packages/core/src` (retired per ADR-0005). Band derived-never-stored and Band 1 = highest confirmed in engine and UI (`role-evaluation-card.tsx`). Role family is a separate entity with optional membership and **no scoring effect** (`scoreRole`/`computeResults` take no family param). Family and role slugs unique per org via `by_org_slug`. 3 track types localized in all 5 locales (`trackNames` in all content files). Lead-3 fully defined in `standardmall.md:65-85` (auditor's UNCLEAR corrected to MET).

**Deviations / gaps (informational only):**

- Stale test description "resolves a role with guardrails" (`roles.test.ts:92`) — the test body has no guardrail logic. Cosmetic.
- `model.level` i18n key exists as an unreferenced glossary label, wired to no picker (correct: level is per-individual, V2).
- `anchor.level` (0–5 rating index) shares the word "Level" with the seniority Level term, but no logic conflates them.

**Severity:** info only.

---

### 2.5 Anchor Roles — MOSTLY CONFORMANT

**Conforms:** Anchor is a post-scoring sanity check, "supports a decision, never replaces the assessment" (`anchorRoles.ts:14-19`; `en.json:740`). Designation preconditions enforced: complete assessment (throws `ratingsIncomplete` when `band===null`), agreed band integer in range, non-empty motivation ≤1000 chars, status init "active" (`anchorRoles.ts:41-57,83-95`; tests confirm). Never-deleted lifecycle — no delete mutation; archive patches status to "replaced" and keeps the field (`roles.ts:480-534`; test at line 416). Three-value status model with reactivation guard (`updateAnchorRole:154-158`). Admin scope only (`adminMutation`; UI gated `isAdmin`). Full audit trail with typed payload contracts and labels in all 5 locales (`audit.ts:33-34`, `auditPayloads.ts:246-259`). Deviation flags: per-role `role.band !== expectedBand` badge in the overview (`role-chip.tsx:25-27`) and the rating reveal flags ≥2 bands from the nearest anchor (`rating-result.tsx:63-70,126`). Term distinction anchor role vs criterion anchor is clean. i18n complete.

**Deviations / gaps (minor):**

- **Review date is auto-set, not user-supplied — INFO.** `reviewedAt: Date.now()` on designate/update, shown read-only (`anchorRoles.ts:89,161,301`). The spec lists "review date" as a field but does not require user input; auto-capture is a defensible simplification.
- **No dedicated aggregate anchor-comparison panel in the bands overview — MINOR GAP.** `work/page.tsx` uses `getResults` (per-role deviation chips) rather than `listAnchorRoles` (which returns agreed vs live computed band side by side). The data seam exists; the aggregate table UI is not built. Spec's "results view compares agreed vs computed per anchor" is only partially satisfied.

**Correction:** the "2–5 anchors" rule is recommendation language ("recommended"/"normalt"), so the soft UI warning with no hard cap is conformant (auditor's "PARTIAL DEVIATION" downgraded to "met as guidance").

**Severity:** one Minor gap, one info.

---

### 2.6 AI Assistance (ADR-0003) — MOSTLY CONFORMANT

**Conforms (13 of 14 requirements):** AI never in the score/band path — `packages/core`'s `scoreRole`/`assignBand`/`computeResults` are never called from any generation path; `deriveResults` appears in `ai/suggest.ts` only inside human-confirmation mutations to compute band-shift audit diffs, after confirmation. All AI output flows through the suggestion lifecycle (`generating|suggested|confirmed|rejected|failed`, `shared/tables.ts:91-98`) with provenance and separate confirmedBy/rejectedBy; HR confirms via `acceptedIndexes`/`acceptedMoveIndexes`. Embedded surfaces (panels, wizard steps), no chatbot. Onboarding prefill exception implemented exactly to ADR-0003 §3: `PREFILL_MAX_PER_CALL=5`, targets only `!isProfileComplete` non-archived roles, index-echo alignment check fails the whole call on mismatch, one `aiUsageEvents` row per call, one `role.updated` audit row per applied role (`prefill.ts`, `prefillData.ts`). AI runs only in server-side Convex actions (`"use node"`; no AI API routes). Usage logged in `aiUsageEvents` with cost/tokens folded into `aiUsageMonthly`. Confirmations/rejections audit-logged with labels in all 5 locales. **No PII in prompts** — `companyLines()` sends only industry/country/employeeCount + role-level content; the `users` table is never read under `convex/ai/`. Output language uses the caller's display locale (`promptLocale`). No AI for pay-gap/grouping; AI rating suggestions correctly deferred.

**Deviations / gaps:**

- **Azure OpenAI EU Data Zone fallback documented but not implemented — DEVIATES, MINOR.** `provider.ts` wires only Mistral (`createMistral`); a missing key returns `null → aiUnavailable` with no fallback. Both the spec (§7) and ADR-0003 document Azure as fallback. EU residency is **not** broken (Mistral La Plateforme is EU-hosted); this is a single-point-of-failure gap, not a compliance breach.

**Info:** `starter.import` (onboarding paste-import) is a fully lifecycle-correct AI feature that is absent from the spec's V1 AI-scope enumeration (the architecture digest describes it; spec §7 should list it). Evidence correction: the AI modules **do** import pure validation predicates (`isWeightPoints`, `isBalanced`, `pointBudget`) from `@workspace/core` — not score/band functions — contrary to the original audit's blanket claim.

**Severity:** one Minor (fallback), one info.

---

### 2.7 EU Pay-Transparency Alignment — MOSTLY CONFORMANT

**Conforms:** Role ≠ Person invariant (no person/salary/performance field on `assessment/tables.ts`). Blind weighting (no `weightPoints` in `StepperCriterion`). Zero-sum budget (rebalance throws `weightsUnbalanced`; new criterion enters neutral). Score/band derived never stored. 6-entry anchor texts guarded. AI excluded from scoring; EU residency (Mistral direct, AI Gateway forbidden, Convex eu-west-1). Org-scoped tenant isolation on every wrapper (`resolveOrgContext`). Audit trail on all result-affecting mutations (`ctx.audit.bandShifts` + `ctx.audit.log`). GDPR hard-delete via `eraseSelf`. Equivalent-work grouping correctly deferred to V2 with a stable-role-ID seam. The product uses "bias-reducing / gender-neutrally designed," never "bias-free" (formulation rule honored).

**Deviations / gaps:**

- **Criterion rationale / bias-review write path absent — GAP, IMPORTANT.** Schema fields exist (`evaluationModel/tables.ts:39-51`: purpose, whyRelevant, overlapNotes, biasRisk, biasComment, biasAction, approved, decidedBy, decidedAt) but **no mutation in `criteria.ts` writes any of them** (confirmed by full read; the line-22 comment "E2 extends this surface — rationale, bias review" is the deferral signal), and **no dashboard component references them**. The directive's objectivity/bias-review evidence therefore cannot be produced yet.
- **Exportable methodology annex absent — GAP, IMPORTANT.** i18n key `model.methodAppendix` exists (`en.json:70`) but grep of `apps/dashboard/components` returns zero hits. This is a V1 "level-2" compliance deliverable (E5), not a V2 deferral.
- **`PLAN-V1.md` overclaims four-factor coverage — DEVIATES, IMPORTANT for the prose.** Line 152 claims the criteria measure "arbetsförhållanden" (working conditions), but none of the 9 default criterion keys (scope, complexity, autonomy, risk, knowledge, stakeholders, financial, people, formal) address physical conditions, ergonomics, shift work, or hazardous exposure. Mitigated by: near-zero differentiation for knowledge-work SMBs, custom criteria, and the (still-unbuilt) annex as the place to document the caveat. The **code is correct** (custom criteria addable); the planning-doc prose is the overstatement — hence Important for the doc claim, structural gap mitigated by extensibility.
- **Band thresholds not calibrated to real data — MINOR.** Default thresholds translated from the Excel prototype at a different weight spread; `standardmall.md:59` documents this as pre-launch debt. Uncalibrated thresholds would yield unreliable comparable-work groupings. Tracked, not a code defect.

**Severity:** three Important (two build gaps + one doc overclaim), one Minor.

**V2 dependency note (excluded domain):** the reporting/V2 audit confirms the structural seams these compliance items sit on are correctly in place — org = legal entity, stable role IDs, Role ≠ Person, no cross-org rollup — and that the method-appendix schema is partially built but has no UI/export. That gap is the same one flagged here as Important; it is a V1 obligation, not a V2 deferral.

---

## 3. Prioritized Fix List (Critical / Important)

**Critical:** none.

**Important — resolve before go-live:**

1. **Replace condensed anchor texts with the approved "NYA texter" v3 verbatim.** File: `standardTemplate.content.sv.ts` (and mirror to nb/da/fi after native review). Legal defensibility of the evaluation instrument. (Domain 2.2)
2. **Build the criterion rationale / bias-review write path + UI.** The schema is ready; add the mutation(s) in `criteria.ts`, the E2 editing surface, and audit events. Without it the directive's objectivity/bias evidence cannot be produced. (Domain 2.7)
3. **Build the exportable methodology annex (E5).** Collects criteria, weight points with shares, rationale, and bias review as compliance evidence; the i18n key already exists. (Domain 2.7)
4. **Correct the `PLAN-V1.md` four-factor overclaim** (line ~152): state that "working conditions" is not covered by the default template and is added via custom criteria / documented in the annex. (Domain 2.7)
5. **Add the band-threshold editing mutation + UI (E2).** Docs promise per-org configurability; only the schema is ready. (Domain 2.3)
6. **Calibrate band thresholds against real data** before launch (tracked in `standardmall.md:59`). (Domain 2.7)

**Minor — clean up opportunistically (ideally before E2 ships):**

7. Fix the nb/da/fi criteria seeding so stored rows carry the org's locale, not English — trivial (`contentLocale` → `clampLocale` in `createModelFromTemplate`); prevents a latent wrong-locale freeze on the first E2 edit. (Domain 2.2)
8. Rename compliance fields to spec (`overlapNotes→overlapWithOthers`, `decidedBy→decisionMaker`, `decidedAt→date`) before the E2 UI hardens them. (Domain 2.2)
9. Implement (or explicitly de-scope in the docs) the Azure OpenAI EU fallback so Mistral is not a single point of failure. (Domain 2.6)
10. Add the aggregate anchor-comparison panel to the bands overview (data seam already exists via `listAnchorRoles`). (Domain 2.5)
11. Fix the stale "with guardrails" test description (`roles.test.ts:92`) and add `starter.import` to the spec's V1 AI-scope enumeration. (Domains 2.4, 2.6)

---

## 4. Notable Strengths (Documentation Faithfully Implemented)

- **The no-store / pure-engine invariant (ADR-0002) is airtight.** Score and band exist only as derived values from one call site (`assessment/compute.ts:79`), the engine has zero runtime dependencies, and no `db.insert`/`db.patch` anywhere writes a score or band. This is the hardest invariant to hold and it is held by construction.
- **The zero-sum point budget (ADR-0004) is enforced at every layer.** Core predicates, server-side `isBalanced` guard before any write, and a live UI meter with a save gate — a client bug cannot persist an unbalanced allocation, and even AI-proposed moves are individually zero-sum so any subset is safe to confirm.
- **The blind rating flow is real, not cosmetic.** Weight points are structurally absent from the rating stepper's data interface, and both the mutation (`setRating → v.null()`) and the role query refuse to return score/band — the reveal is genuinely gated to the result step.
- **ADR-0006 aggregate-vs-entity discipline is exact:** anchors (exactly 6) embedded in criteria, band thresholds (exactly 7) embedded in models, `tracks`/`levels` tables eliminated, `trackKey` a literal union. Cardinality and existential dependence are enforced by the schema, not by convention.
- **AI governance (ADR-0003) is thorough:** every output carries provenance and a full status lifecycle, HR confirmation is required (with the single documented prefill exception implemented precisely to spec), every call is usage-logged and every confirm/reject is audit-logged in all five locales, and no PII ever reaches a prompt.
- **Role ≠ Person and GDPR erasability** are structurally guaranteed: PII lives only in the users mirror + Better Auth tables, domain tables carry none, and erasure is a true hard delete with audit-actor tombstoning.
- **i18n and audit coverage are held to parity across all five locales** for every anchor-role, AI, and audit label checked — the machinery the docs describe (parity test + audit-label coverage test) is actually wired.

---

## 5. Scorecard

| Domain | Verdict | Upheld | Disputed | Critical | Important | Minor/Info |
|---|---|---|---|---|---|---|
| Weighting & point budget (ADR-0004) | Conformant | 17 | 0 | 0 | 0 | 0 |
| Criteria & 0–5 scale | Mostly conformant | 15 | 0 | 0 | 1 | 2 + 1 info |
| Score → band (ADR-0002) | Mostly conformant | 14 | 0 | 0 | 1 | — |
| Tracks/Levels/Bands/Families (0005/0006) | Conformant | 14 | 1 | 0 | 0 | 3 info |
| Anchor roles | Mostly conformant | 14 | 1 | 0 | 0 | 1 + 1 info |
| AI assistance (ADR-0003) | Mostly conformant | 13 | 1 | 0 | 0 | 1 + 1 info |
| EU pay-transparency alignment | Mostly conformant | 18 | 0 | 0 | 3 | 1 |

**Totals:** 105 requirements verified · 0 critical · 6 important (2 build gaps, 1 anchor-text fidelity, 1 config gap, 1 calibration debt as minor, 1 doc overclaim) · remainder minor/info.

**Bottom line:** the implementation follows its documentation. Every architectural invariant the docs treat as non-negotiable is correctly implemented and defended by construction. The open items are compliance-evidence surfaces (rationale/bias-review UI, methodology annex), one copy-fidelity issue (anchor texts), and a handful of scoped E2 deferrals and doc corrections — all appropriate to close in the pre-launch hardening pass, none of them blocking the V1 loop.
