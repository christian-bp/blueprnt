# Adaptable role evaluation model: design

**Date:** 2026-08-18
**Source:** `Masterdokument for anpassningsbar rollvardering` (2026-08-18), adopted into the repo as `docs/rollvardering-masterdokument.md` in this program's first phase.
**Status:** approved design, pending implementation plan.

## 1. What this program does

The masterdokument specifies the company-adaptable, objective, gender-neutral role evaluation model: a fixed constitution of four evaluation dimensions (EU 2023/970), a controlled library of 21 criteria, guided method building with per-dimension caps and a fixed weight budget, model approval before assessment, a 1-5 assessment scale behind a methodological firewall, and a 4-zone / 12-level architecture with profile requirements and calibration.

The app already conforms in several places (weight points 1-5 under the count x 3 budget per ADR-0004, the Define/Weight phase split, the rating stepper firewall, anchor roles, criterion rationale + bias review, Level 1 = highest). This program closes the rest.

### Decisions taken in brainstorming (2026-08-18)

1. **No model versioning.** ADR-0002 stands: one living model, live recompute. The only freeze is the kartlaggning snapshot (`payMappingRuns.frozenModel`), which grows into the full method evidence. New ADR-0023 records the mapping.
2. **Full masterdokument §14 in one go**: 12 levels in 4 zones, profile requirements, and the kalibrering-kravs state land together.
3. **The library replaces the standard template.** The 21-criterion library becomes the canonical source; the 9-criterion standard template retires completely; industry starters become recommendation hints in the picker.
4. **Metodbyggnad = guided flow + calm overview.** A six-station guided builder for building and revising; a calm overview for daily life.
5. **Approval re-confirms after method changes.** Method-affecting edits flip `approved` back to `draft`; re-approval is one click when the checklist is green.
6. **Criteria stay items.** No new storage concept: the org's criteria remain rows as today, tagged with a dimension; the criteria page groups them into four dimension sections with an add-from-library picker per section.
7. **Pay-mapping grouping keeps level as its key** (finer groups with 12 levels is accepted and honestly reported by the existing entry conditions).

## 2. Domain model and schema

Pre-launch: clean replacements, dev-data reset, no compat shims. Schema phases end with a dev-deployment migration and a browser pass.

### 2.1 Dimensions (the constitution)

A fixed structural constant, not a table (ADR-0006 pattern, like tracks):

- Keys: `competence`, `effort`, `responsibility`, `workingConditions` (A-D order fixed).
- Caps without special decision: 2 / 2 / 3 / 1 active criteria. Model total: 6-8 (hard bounds in V1; the masterdokument's "sarskilt beslut" escape above 8 is deferred until a customer needs it).
- Localized dimension content (name, guiding question, why it exists) lives in the library content modules.

### 2.2 `criteria` table

- `dimensionKey` (required literal union of the four keys). Custom criteria must declare one at creation (masterdokument §17.6).
- `templateKey` becomes `libraryKey` (optional). Pristine library rows re-localize at read; any text edit clears the key and the org owns the words (exactly today's template + `complianceEdited` mechanics, unified).
- `anchors`: steps from {1..5}; texts at 1/3/5 required, 2/4 optional. Step 0 no longer exists as an anchor. Store only steps that have texts.
- New content fields (stored per row, pristine rows re-localize, shown in the assessment view per §13.2): `measures`, `notMeasures`, `assessmentQuestion`.
- New optional `weightMotivation` (viktmotiv, captured when §12.4 warnings trigger).
- Existing kriterieurvalsprotokoll + bias-review fields stay unchanged and remain the documentation gate. No separate selection-motivation field: adding from the library pre-drafts `purpose`/`whyRelevant` from library content; documentation completes before model approval, not at add time.
- `order` orders criteria within their dimension section.

### 2.3 `models` table

- `levelThresholds` (7) becomes `levelRules`: exactly 12 entries `{ level: 1..12, minScore }` on the normalized 0-100 scale (ADR-0004 stands). Level 1 = highest, unchanged.
- Zone membership is structural, never stored: A = levels 1-3, B = 4-6, C = 7-9, D = 10-12.
- New `zoneProfileRules`: per zone an optional `{ zone, minStep }`. Profile criteria are derived (see §3); nothing about them is stored.
- New `workingConditions` (optional until first decided): `{ status: "active" | "testedNotMaterial", motivation, decidedBy, decidedAt }` (§10.1 materiality test). When no working-conditions criterion is active the status must be `testedNotMaterial` for approval.
- New `approval`: `{ status: "draft" | "approved", approvedBy?, approvedAt? }`. Approving runs the §17.2 checklist (see §3.4). Method-affecting mutations on an approved model flip status to `draft` (see list below). Re-approval writes a fresh audit row; approval events are the de facto version boundaries.
- `templateKey` on models is deleted.

**Method-affecting (flips approval to draft):** criterion add/remove; edits to criterion name, description, helpText, anchors, `measures`, `notMeasures`, `assessmentQuestion`, `dimensionKey`; weight changes; `levelRules`; `zoneProfileRules`; the materiality decision. **Not method-affecting (approval survives):** kriterieurvalsprotokoll and bias-review fields (`purpose`, `whyRelevant`, `overlapNotes`, `biasRisk`, `biasComment`, `biasAction`, per-criterion approval metadata) and `weightMotivation`.

### 2.4 `roles` table

- New optional aggregate `assessment`: `{ status: "locked" | "calibrated", lockedBy, lockedAt, calibratedBy?, calibratedAt?, calibrationNote? }`. Absent = draft. Locking requires a complete, valid rating set against an approved model. Unlocking is explicit and audited. `calibrated` is set from the calibration queue with a note.
- `anchorRole.expectedLevel` range becomes 1-12.
- Method drift is derived, never stored: `assessment.lockedAt < model.approval.approvedAt` renders "bedomd enligt tidigare metod" (§17.5 marking); re-locking clears it.

### 2.5 `ratings` table

- `value`: 1-5. The value 0 is valid only when the criterion's dimension is `workingConditions` and means "omfattas inte" (§10.1).
- `motivation` becomes required when value is 1, 4, or 5 (§17.3), enforced in the mutation and mirrored in the form. A working-conditions 0 needs no motivation.

### 2.6 `payMappingRuns.frozenModel` (the only freeze)

Grows into full method evidence, frozen at run creation: per-criterion `{ name, dimensionKey, weightPoints, anchorCount }`, `levelRules`, `zoneProfileRules`, the `workingConditions` decision, and approval metadata (`approvedBy`, `approvedAt`). Existing frozen runs are self-contained and untouched.

### 2.7 Onboarding and seed

- `EnsureDefaultModel` seeds an empty draft model shell (name, default `levelRules`, no criteria, materiality undecided) via a new `createDefaultModel` mutation; `createModelFromTemplate` retires with the template. Onboarding is otherwise unchanged; the dashboard todo gains "Bygg och godkann er metod" as the leading task.
- `seed.ts` builds the demo org the new way: select from the library, document, weight, approve, lock assessments. `devReset` and `testing.helpers` follow.

## 3. Engine (`packages/core`)

Pure, deterministic; score/level/zone always derived, never stored (ADR-0002).

### 3.1 Scale and scoring

- `CriterionWeight` input gains `dimensionKey`. Rating validation: integer 1-5, or 0 iff the criterion's dimension is `workingConditions`.
- Normalization unchanged: `floor(20 * sum(value * weight) / sum(weight))` on 0-100. A fully rated role lands in 20-100 unless working-conditions 0 pulls lower.

### 3.2 Levels, zones, profile requirements

- `zoneForLevel(level)`: fixed A/B/C/D mapping.
- Profile criteria: `criteria.filter(weightPoints >= 4)` (the masterdokument's high-impact weight classes). A flat all-3s model has none, hence no profile gates, which is principled: no declared priorities, no profile requirements.
- Placement: preliminary level from `levelRules` thresholds (same tie-break as today), then the role lands in the **highest zone whose profile requirement it meets** (every profile criterion rated >= the zone's `minStep`, where a rule exists). When the cap binds, the role takes the capped zone's first level (its highest, e.g. level 4 for zone B) and `profileLimited: true` plus the failing criteria are reported; otherwise the score-implied level stands. This keeps "no level override" intact: placement is always defined and derived; kalibrering kravs is a review flag, not an unresolved state (documented deviation from §17.4's pseudocode, same intent).
- `computeResults` output per role grows: `{ score, level, zone, profileLimited, profileFailures? }`, still null-scored until every criterion is rated.

### 3.3 Default level rules

New 12-entry `DEFAULT_LEVEL_RULES` spanning the realistic 20-100 range, plus default `zoneProfileRules`: A minStep 4, B minStep 3, C and D none. Marked calibrate-before-launch like today's constants. Editable in builder step 5.

### 3.4 Method validation as pure rule sets

- `validateMethod(model)` returns the §17.2 checklist as structured results, consumed by both the approval mutation (blockers refuse) and the builder UI (live checklist). **Blockers:** competence/effort/responsibility each have >= 1 active criterion; workingConditions has an active criterion or `testedNotMaterial` with motivation; 6-8 criteria total; per-dimension caps 2/2/3/1; every criterion has a dimension, anchors at 1/3/5, and documented + approved kriterieurvalsprotokoll; budget exact (holds by construction). **Warnings (approval allowed, motivation asked):** a dimension over 40 % of total weight; `people-leadership` at weight 4-5; overlap pairs from the library map among selected criteria.
- `weightWarnings(criteria)` powers the same warnings inline in the weighting step.

## 4. Criteria library content

Follows the standardTemplate pattern and replaces it: `criteriaLibrary.ts` (structure) + five locale content modules, in `packages/backend/convex/evaluationModel/`.

**Structural per entry:** stable English key, `dimensionKey`, overlap pairs (§7-10 overlap columns as a machine-readable pair map powering picker warnings), industry hints (§7-10 combination tables + §15 mapped against the org's onboarding industry; rendered as "recommended" chips, never auto-selected).

**Prose per entry and locale:** name, short picker one-liner, full definition, measures, notMeasures, when suitable, when normally not, control question, assessment question, anchors (1/3/5 required; 2/4 omitted initially, rendered from the shared §13.4 midpoint copy; orgs can author their own via normal editing).

**The 21 keys:**

| Dimension | Keys |
|---|---|
| competence (5) | knowledge-depth, knowledge-breadth, formal-qualifications, domain-knowledge, advisory-judgment |
| effort (5) | complexity-ambiguity, analytical-effort, communication-effort, operational-intensity, physical-sensory |
| responsibility (7) | scope-impact, autonomy-mandate, risk-consequence, people-leadership, resource-capacity, business-customer, compliance-control |
| workingConditions (4) | safety-exposure, on-call, irregularity-mobility, restricted-environments |

**Content reuse:** the nine current template criteria map onto library keys (scope -> scope-impact, complexity -> complexity-ambiguity, autonomy -> autonomy-mandate, risk -> risk-consequence, knowledge -> knowledge-depth, stakeholders -> communication-effort, financial -> resource-capacity, people -> people-leadership, formal -> formal-qualifications); their five-locale content is adapted (anchors reshaped to 1/3/5, texts revised to the masterdokument's definitions). `standardTemplate.*` retires in the same change.

**Authoring:** Swedish first, straight from the masterdokument (it is the source); English as the type-defining translation; nb/da/fi machine-drafted and flagged for native review. The masterdokument supplies full anchors for three criteria (§13.5); the other 18 get authored anchors following the §13.3 shared scale semantics. The shared scale's five named steps become i18n content used in rating UI and docs.

**Guard test:** 21 keys, 5/5/7/4 per dimension, anchors 1/3/5 present, overlap references resolve, industry hints reference real keys, locale parity.

## 5. Metodbyggnad surface

The model section simplifies to two surfaces: **Oversikt** (`/model`) and the **guided builder** (`/model/method`). The separate Weighting and Method tabs retire; their content becomes builder steps 4 and 3.

**Oversikt (calm home):** four dimension sections with selected criteria as items (name, weight chip, documentation state), dimension weight shares, the approval status card (who/when, or "utkast" with checklist summary), a compact levels-and-zones summary. Every edit affordance routes into the relevant builder step. Empty org: the overview is the entry into step 1.

**Builder (the §4 journey):** a stepper of six stations, 1-5 marked METODBYGGNAD, 6 ROLLBEDOMNING (quiet chips). Every step opens with the three-line §4.1 framing (Varfor ar vi har / Vad ska ni ta stallning till / Vad hander sedan).

1. **Konstitutionen:** the four dimensions as cards with guiding questions; the working-conditions materiality question answered here.
2. **Kriterieval:** the four-section criteria page. Per-section Add opens the library picker scoped to that dimension: cards with name + one-liner, industry-recommended chips, overlap warning chips against already-selected criteria, expandable full detail, the control question as the add-confirm prompt. "Skapa eget kriterium" sits at the bottom of the picker, pre-scoped to the dimension. Live count chips ("1 av max 2") and the 6-8 total indicator.
3. **Avgransning:** per selected criterion, confirm measures/notMeasures and complete kriterieurvalsprotokoll + bias review with the existing AI drafting (today's Method panel relocated).
4. **Viktning:** today's weighting surface grouped by dimension, budget bar unchanged, §12.4 warnings inline capturing `weightMotivation` where triggered.
5. **Kontroll och godkannande:** the live §17.2 checklist (green/red with plain-language explanations and jump links), the consequence summary (criteria count, dimension shares, level rules and zone profile rules, editable here), the Approve action (explains what it unlocks and that later method changes re-open approval).
6. **Rollbedomning:** a done-state panel linking to roles, not a completable step.

**Step state is derived from data, never stored** (no visit-tracking): a step is complete when its data conditions hold. Changing an earlier decision re-reddens later checks, which is §4.2.6's redo-marking for free.

House rules apply: wizard/morph animation patterns, content-shaped skeletons per step, all framing copy in five locales, help popovers for each new concept.

## 6. Rollbedomning, results, calibration

**Rating stepper:** steps 1-5 with full anchors at 1/3/5 and shared midpoint copy at 2/4; the criterion's assessment question as the step question; measures/notMeasures as collapsible context; motivation required inline at 1, 4, 5; working-conditions criteria offer "omfattas inte" (0) with its explanation. The existing firewall stays (no weights, score, or other roles). Rating is gated on an approved method, stated in words on the entry surface.

**Locking is the reveal:** while rating, no results exist anywhere. Complete roles show "klar att lasa"; the lock action triggers today's rating-result reveal (score, level, zone). Unlock to re-rate is explicit and audited. The derived method-drift chip ("bedomd enligt tidigare metod") appears when `lockedAt < approvedAt`; re-locking under the current method clears it.

**Levels surfaces:** the ladder and matrix render 12 levels grouped into the four zones with zone descriptions (§14.5.1 architecture overview). Only locked assessments place; complete-but-unlocked roles appear as "klar att lasa" in the pending list. The §14.3 numbering-direction parameter is deferred (Level 1 = highest is an app invariant; recorded in ADR-0022).

**Calibration queue (derived, on the levels surface):** roles with `profileLimited` and not yet calibrated ("kalibrering kravs"), anchor roles whose computed level deviates from `expectedLevel`, and stale locks after method changes. Per role: confirm placement (sets `calibrated` + note, audited) or jump to the builder.

**Pay mapping:** grouping keeps **level** as its key (decision 7). New runs snapshot 12-level rules; old frozen runs are untouched. Run creation includes people whose roles have locked assessments, the same way incomplete assessments are excluded today (verify the exact exclusion seam at plan time).

## 7. Governance and content

**ADRs (Swedish):**
- **ADR-0021** Konstitution, dimensioner och kriteriebibliotek: adopts the masterdokument's constitution; four dimensions as constants; library replaces the standard template; caps and 6-8; materiality test; scale 1-5 with 0 for arbetsforhallanden; anchors 1/3/5 + optional 2/4.
- **ADR-0022** Zoner, tolv nivaer och profilkrav: 12 levels in 4 zones; profile criteria derived as weight 4-5; deterministic zone capping with kalibrering-kravs as a review flag; numbering-direction parameter deferred.
- **ADR-0023** Modellgodkannande utan versionering: approval status on the live model; re-confirm after method changes; kartlaggning snapshot as the only freeze; audit approval events as version boundaries; annotates ADR-0002 (which stays accepted, gains a pointer note).

**Repo documents:** the masterdokument lands as `docs/rollvardering-masterdokument.md`. The evaluation-model glossary (`docs/contexts/evaluation-model/CONTEXT.md`) gains Dimension, Kriteriebibliotek, Materialitetsprovning, Zon, Profilkrav, Last bedomning, Kalibrering; updates Steg/Ankare (1-5, anchors 1/3/5), Niva (1-12), Nivaregel (replacing Nivatroskal), and retires Mall in favor of the library; the i18n term table grows accordingly.

**Audit events** (full house machinery: typed payloads, categories, subjects, labels in five locales, drift-guard tests): model approval + re-opening, the materiality decision, criterion activation/deactivation from the library, level-rule and zone-profile-rule diffs, assessment locked/unlocked/calibrated (subject: role). `level.shift` continues to cover result movement. Toasts for approve, lock, unlock, calibrate, materiality.

**Docs (MDX, five locales, `docs:sync` in the same change, `docs:eval` after):** new building-your-method page; updates to criteria-and-scale, evaluating-a-role, levels-views, key-concepts, glossary, anchor-roles.

**Metodbilaga PDF** grows: dimension coverage table, materiality decision, zone/level architecture with profile rules, approval metadata.

**AI touchpoints:** custom-criterion drafting requires a dimension (§17.6 stop rule as a validator); compliance drafting feeds from library boundaries; AI weighting review learns the §12.4 warnings. No-PII prompt rule untouched (ADR-0003). The §17.6 stop-and-ask table maps to deterministic validation errors; the chat assistant stays read-only (ADR-0018).

## 8. Deviations from the masterdokument (deliberate, recorded)

1. **No model versioning or locking** (§2, §13, §16.7, §17.5, §18): approval status + audit boundaries + the kartlaggning freeze instead (ADR-0023).
2. **Firewall is flow-level, not permission-level** (§3.2, §17.5): the audience is HR-only (no assessor user class); stage separation is carried by surfaces and states, and org roles cover "behoriga anvandare".
3. **Numbering-direction parameter deferred** (§14.3).
4. **Deterministic zone capping** instead of §17.4's unresolved kalibrering state; calibration confirms a defined placement.
5. **Steps 2/4 anchor texts** ship as shared midpoint copy; per-criterion texts are org-authorable later.
6. **Activation motivation at add time** (§11.1.5) becomes control-question confirm + documentation-before-approval via the existing protokoll.
7. **6-8 hard bounds**; the ">8 med sarskilt beslut" escape deferred.

## 9. Testing

- **Core:** engine tests for the scale (0-rule edges), zone capping, profile derivation, validators; fixtures updated; property-style checks around budget/caps.
- **Backend (convex-test):** library guard test (§4 above), selection mutations (caps, overlap, materiality), approval gate + checklist, method-affecting flip list, rating validations, locking lifecycle + gates, frozenModel growth, seed/devReset, audit events (label coverage auto-guards).
- **Dashboard:** builder steps + derived step state, picker, overview, stepper scale UI, reveal-behind-lock, ladder zones, calibration queue; existing i18n-parity, audit-label, help-cap, skeleton guards extended.
- E2E stays out of scope (Playwright later, per house rule).

## 10. Phasing

Each phase lands uncommitted for review, then focused commits on approval. Tests ship in the same commits.

1. **Engine + library content:** core changes (§3), `criteriaLibrary.ts` + sv/en content authored, nb/da/fi drafted, guard tests. No schema changes yet.
2. **Schema + backend:** §2 schema changes, selection/approval/locking mutations, audit events, frozenModel growth, seed/devReset; ends with dev migration + reset + browser pass.
3. **Builder UI:** overview rebuild + six-station builder + picker + i18n.
4. **Assessment UI:** stepper scale, motivation, lock/reveal, gates, role-page states.
5. **Results:** 12-level ladder/matrix with zones, calibration queue, anchor deviations, pay-mapping touchpoints.
6. **Content closure:** docs MDX + `docs:sync` + `docs:eval`, metodbilaga, help texts, assistant pass, ADR finalization, full browser verification.

ADRs and the tracker-artifact update (Rollvardering program section: conformance matrix + phase board, same URL) land with this spec as phase 0.
