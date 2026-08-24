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
8. **Library-only criteria with fixed texts** (decided 2026-08-18, after phase 1): custom criterion creation is removed entirely, and a selected criterion's texts are never editable. A criteria row stores only the selection (libraryKey, weight points, order, weight motivation, the org's protokoll and bias documentation, per-criterion approval); name, definition, measures, notMeasures, anchors and the assessment question always render localized from the library content, and the dimension derives from the key. This supersedes §2.2's stored-content fields, the ownership-transfer mechanics, and the custom-criterion path below wherever they conflict.
9. **Builder direction for phase 3** (decided 2026-08-19, after phase 2): (a) onboarding completion routes to the OVERVIEW, never into the model editor; the overview's top-priority todo becomes "build the company's model" and is the entry into the method work. (b) The model page becomes a guided build view: four dashed-border dimension drop zones at the top carrying the dimension titles, with the library's criteria listed below and dragged into the zones to form the model (keyboard-accessible drag-and-drop; the click-to-add path stays as the accessible complement). An EMPTY drop zone renders with the same diagonal hatch pattern the level ladder uses for an empty level row (reuse the existing hatch treatment from components/levels/hatch.ts as the app's one "empty slot" language; direction given with a ladder screenshot 2026-08-19). (c) The kriterier-viktning-metod sequence takes its guidance pattern from the kartläggning journey, and kriterier + viktning may merge into one view. (d) The bedömningsskala accordion leaves the model page entirely (the scale is not editable); anchors render only in rollbedömning. Copy nuance: the builder speaks of assembling "företagets blueprnt-modell" (the owner's own framing), to be confirmed in the phase-3 copy pass. Layout detail left open for the design step: whether the criteria below the drop zones render as one library list or as per-dimension lists ("listor" plural in the direction). Phase 3 also verifies and changes the CURRENT post-onboarding destination (wherever the wizard lands today, it becomes the overview). This refines §5's step 2; the six-station journey and calm overview otherwise stand. Points (b) and (c) are refined by decision 10 after the owner reviewed the built combined view.
10. **Chapter structure for the model section** (decided 2026-08-20, after reviewing the built phase-3 view in the browser; supersedes decision 9's combined view and its drag-and-drop): (a) Kriterier and viktning do NOT share a page: one page carrying both was "för mycket och för otydligt". (b) The model section adopts the kartläggning analysis pattern literally: steps as route-backed chapter "tabbar" under a shared layout with the weighted progress spine, exactly the anatomy of /pay-mappings/[slug]/analysis (chapter registry, numbered tab row, segmented bar); the tab row and the spine's bar become SHARED components consumed by both sections (owner 2026-08-20: reuse between modell and kartläggning, never reinvent), with the per-section registries and i18n staying their own. (c) The steps are four: Kriterier, Viktning, Metod, Godkännande; the owner explicitly placed godkännandet and metod as steps in the same tab row. (d) The Kriterier step keeps the four dimension columns (dashed border, count chip, hatch empties) but never shows unselected library criteria on the page: adding returns to a DIALOG (the scoped per-dimension picker, decision 6's original sketch), and drag-and-drop retires entirely, since removing the on-page library removes the drag source and a dialog add needs no zone choice (the dimension derives from the criterion). A selected criterion's card shows its one-line description inside the card alongside the name (owner 2026-08-20, screenshot: the lighter page has room for it now), at the Item family's default type size, not the small variant (owner 2026-08-20: with the full-width columns the small size under-reads; the same card component serves the Viktning step, so both scale together). The add affordance is a quiet "+ Lägg till kriterium" row INSIDE the dimension column at its bottom, kanban-style (owner 2026-08-20 with reference screenshot); a FULL dimension simply drops the row, with NO explanatory cap prose under the column (the count chip and the dimension help carry the cap; a deliberate owner exception to preconditions-in-words for this surface). The five-button weight row carries a MAX width (owner 2026-08-20, screenshot: stretched across a full-width column the buttons stop reading as a scale); it stays left-aligned in the card at its capped width while the card itself may grow. The section's spine heading names THE MODEL (the established "företagets blueprnt-modell" framing or a tight derivative), never an abstract progress word like "Beslutat" (owner 2026-08-20); the progress reading lives in the bar and its counts. The under-segment count carries the active chapter's NAME ("Kriterier · 2 av 6"), not a bare figure (owner 2026-08-20, choosing name-in-count over per-segment titles: the work-weighted segments cannot carry labels of their own, Godkännande's segment being a sliver, and the tab row already names every chapter; the reserved count row overflows narrow segments gracefully). The card's remove affordance is the shared RemoveConfirm morph (the ghost trashcan arming into an inline confirm pill), not a one-item dropdown menu (owner 2026-08-20: remove is the card's ONLY action, and the morph family is the app's signature; the house dropdown rule governs rows with several actions). (f) The model section uses the FULL viewport width: no max-width cap on this layout (owner 2026-08-20: "använd hela bredden, ingen max width"; it resolves the ~264px column squeeze under the 72rem shell cap and is the first per-section application of the planned app-wide full-width rework). The section keeps the app's standard page padding and one consistent left edge for spine, tabs, framing and chapters. (e) The Viktning step carries the selected criteria with the inline five-button weight rows, the budget readout and the atomic save; it does NOT offer criterion removal (owner 2026-08-20: "man borde inte kunna ta bort kriterier i viktningssteget"). Changing WHICH criteria are in the model is the Kriterier step's job alone; the weighting step only distributes points. The budget readout + save + AI review sit in a block at the TOP of the step, reformatted to fit there in the same way the Metod step opens (owner 2026-08-20, with screenshot): the sticky bottom bar existed for a page with much more content, and with selection moved to its own step the page is light enough that the action belongs at the top. The phase-1/2 primitives this retires (the DnD law module, announcements, drag machinery) are deleted completely per the no-legacy rule.

11. **Restore to last approved** (decided 2026-08-20, owner request + approved design): every `approveModel` stores the full method evidence (the `frozenModel` builder's shape: criteria with dimensions, weights, weight motivation, protokoll/bias documentation, materiality decision, level/zone rules) as a single `lastApprovedModel` buffer on the model; no history, so ADR-0023's no-versioning stands (beslutsnot added). An admin `restoreApprovedModel` atomically restores the live model to that state (bounded: max 8 criteria), writes a `model.restored` audit event with a diff, and leaves approval re-opened with the checklist green for the standard one-click re-approve (exactly one path to approved; no second approval provenance). Honesty both ways in the confirm dialog, as a CONCRETE CHANGE LIST (owner 2026-08-20): the dialog renders the computed diff between the live state and the buffer, every change that the restore will undo listed human-readably (criteria added since approval: removed, ratings deleted, named per criterion; criteria returning: named, with the re-assessment consequence; weight changes as before-to-after per criterion; materiality, motivation, and rule changes likewise), derived by the same diff builder that feeds the `model.restored` audit payload so the preview and the trail can never disagree; scrollable when long, and the confirm button is the only way forward. UI on the Godkännande chapter, visible only when approval is re-opened AND a buffer exists: "Återställ till senast godkända" with the approval date, AlertDialog confirm.

12. **The Arbetsförhållanden column ASKS the materiality question** (decided 2026-08-20, owner approved the controller's recommendation over both the Metod placement and a dedicated tab; shipped form): the väsentlighetsprövning (status + required motivation, unchanged backend) IS the fourth dimension column on the Kriterier chapter. The column leads with the question in plain words and two equal answers ("Ja, materiellt" / "Nej, inte materiellt"), and the criterion slot does not exist before an answer, so "materiell" and "a criterion belongs here" are one state rather than two the reader has to connect. Five states: (1) undecided: the question, the reassurance that no criterion is required, the two answers, no hatch and no add row; (2) materiell with nothing chosen: a sentence naming the decision AND its consequence, then the empty slot, then the add row; (3) inte materiell: the documented decision (sentence, motivation, date) and no slot at all; (4) materiell with the criterion chosen: the card with the decision as a short footnote under it; (5) legacy (a criterion with no recorded decision): the card plus the question. Every decided state speaks in a SENTENCE, never a status badge: the block is read cold by a colleague who did not make the decision. Answering "inte materiellt" while a criterion is selected is an OFFER, not an errand: the dialog names the criterion and the consequence and the button does both ("Ta bort kriteriet och spara beslutet"), deactivating the criterion and then saving the decision, in that order because the backend refuses the decision while the criterion is active. Help is anchored on the DIALOG's title (never floating in the column), and the change affordance is inline at the end of the state's own sentence. The spine's unit moves with the work: Metod becomes activeCount (its +1 drops) and Kriterier becomes MODEL_MIN_CRITERIA+1, the new unit reading the engine's own `workingConditionsTested` check so the bar and the approval gate cannot disagree. The motivation stays REQUIRED for BOTH statuses. The dimension help popovers switch from guiding questions to CONTENT descriptions (what the dimension covers, with example criteria), within the body caps. The Godkännande checklist row and the frozen evidence are unchanged.

## 2. Domain model and schema

Pre-launch: clean replacements, dev-data reset, no compat shims. Schema phases end with a dev-deployment migration and a browser pass.

### 2.1 Dimensions (the constitution)

A fixed structural constant, not a table (ADR-0006 pattern, like tracks):

- Keys: `competence`, `effort`, `responsibility`, `workingConditions` (A-D order fixed).
- Caps without special decision: 2 / 2 / 3 / 1 active criteria. Model total: 6-8 (hard bounds in V1; the masterdokument's "sarskilt beslut" escape above 8 is deferred until a customer needs it).
- Localized dimension content (name, guiding question, why it exists) lives in the library content modules.

### 2.2 `criteria` table (superseded by decision 8: a pure selection table)

- `libraryKey` (required literal union of the 21 library keys; one row per (model, libraryKey), enforced in the activation mutation). The dimension is derived via `LIBRARY_DIMENSION`, never stored.
- No stored texts at all: name, description, measures, notMeasures, anchors (1/3/5 plus optional 2/4 for the three §13.5 entries), and the assessment question always render localized from the library content modules. `templateKey`, `isCustom`, `complianceEdited`, and the stored name/description/helpText/anchors fields are deleted with the template.
- New optional `weightMotivation` (viktmotiv, captured when §12.4 warnings trigger).
- Existing kriterieurvalsprotokoll + bias-review fields stay unchanged and remain the documentation gate; activating a criterion pre-drafts `purpose`/`whyRelevant` from library content as the org's editable documentation start. Documentation completes before model approval, not at add time.
- `order` orders criteria within their dimension section (selection order; no manual reorder in this program).
- Mutations: `addCriterion`/`updateCriterion` retire; `activateCriterion(libraryKey)` and `deactivateCriterion(criterionId)` replace them (deactivation deletes the row's ratings and redistributes its weight points, like removal today). The AI custom-criterion drafting flow and the `model.draft` suggestion kind retire; AI drafting of protokoll texts stays.

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
- Profile criteria: `criteria.filter(weightPoints >= 4 && dimensionKey !== "workingConditions")` (the masterdokument's high-impact weight classes, minus working conditions: its 0 means "not covered", a structural zero, so letting it gate zones would systematically cap every non-exposed role; the contribution to the total stays, only zone gating is exempt; recorded in ADR-0022). A flat all-3s model has none, hence no profile gates, which is principled: no declared priorities, no profile requirements.
- Placement: preliminary level from `levelRules` thresholds (same tie-break as today), then the role lands in the **highest zone whose profile requirement it meets** (every profile criterion rated >= the zone's `minStep`, where a rule exists). When the cap binds, the role takes the capped zone's first level (its highest, e.g. level 4 for zone B) and `profileLimited: true` plus the failing criteria are reported; otherwise the score-implied level stands. This keeps "no level override" intact: placement is always defined and derived; kalibrering kravs is a review flag, not an unresolved state (documented deviation from §17.4's pseudocode, same intent).
- `computeResults` output per role grows: `{ score, level, zone, profileLimited, profileFailures? }`, still null-scored until every criterion is rated.

### 3.3 Default level rules

New 12-entry `DEFAULT_LEVEL_RULES` spanning the realistic 20-100 range, plus default `zoneProfileRules`: A minStep 4, B minStep 3, C and D none. Marked calibrate-before-launch like today's constants. Editable in builder step 5.

### 3.4 Method validation as pure rule sets

- `validateMethod(model)` returns the §17.2 checklist as structured results, consumed by both the approval mutation (blockers refuse) and the builder UI (live checklist). **Blockers:** competence/effort/responsibility each have >= 1 active criterion; workingConditions has an active criterion or `testedNotMaterial` with motivation; 6-8 criteria total; per-dimension caps 2/2/3/1; every criterion documented + approved (kriterieurvalsprotokoll; definitions and anchors are guaranteed by construction under decision 8, so §17.2 items 5-6 need no check); `weightBudget` (sum exactly criteria x 3 AND every weight an integer 1-5, guarding non-UI write paths); `levelRulesValid` (12 entries, levels 1-12 unique, minScore strictly decreasing to a 0 floor); `zoneProfileMonotonic` (configured minSteps non-increasing A through D, so a higher zone is never gated more leniently than a lower one). The input therefore carries `levelRules` and `zoneProfileRules` alongside the criteria. **Warnings (approval allowed):** a dimension over 40 % of total weight, cleared when at least ONE criterion in that dimension carries a `weightMotivation` (the dimension's justification, not one per member); `people-leadership` at weight 4-5; overlap pairs from the library map among selected criteria, where a matched pair reads acknowledged once at least one member's `overlapNotes` (the existing protokoll field) is filled, because §17.2 item 7 requires the check to have been PERFORMED, not that no overlap exists, and the library's own industry hints legitimately recommend overlapping pairs in regulated industries.
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
2. **Kriterieval:** the four-section criteria page. Per-section Add opens the library picker scoped to that dimension: cards with name + one-liner, industry-recommended chips, overlap warning chips against already-selected criteria, expandable full detail, the control question as the add-confirm prompt. The library is the only source (decision 8): no create-your-own path anywhere. Live count chips ("1 av max 2") and the 6-8 total indicator.
3. **Avgransning:** per selected criterion, confirm measures/notMeasures and complete kriterieurvalsprotokoll + bias review with the existing AI drafting (today's Method panel relocated).
4. **Viktning:** today's weighting surface grouped by dimension, budget bar unchanged, §12.4 warnings inline capturing `weightMotivation` where triggered.
5. **Kontroll och godkannande:** the live §17.2 checklist (green/red with plain-language explanations and jump links), the consequence summary (criteria count, dimension shares, level rules and zone profile rules, editable here), the Approve action (explains what it unlocks and that later method changes re-open approval).
6. **Rollbedomning:** a done-state panel linking to roles, not a completable step.

**Step state is derived from data, never stored** (no visit-tracking): a step is complete when its data conditions hold. Changing an earlier decision re-reddens later checks, which is §4.2.6's redo-marking for free.

House rules apply: wizard/morph animation patterns, content-shaped skeletons per step, all framing copy in five locales, help popovers for each new concept.

## 6. Rollbedomning, results, calibration

**Rating stepper:** steps 1-5 with full anchors at 1/3/5 and shared midpoint copy at 2/4; the criterion's assessment question as the step question; measures/notMeasures as collapsible context; motivation required inline at 1, 4, 5; working-conditions criteria offer "omfattas inte" (0) with its explanation. The existing firewall stays (no weights, score, or other roles). Rating is gated on an approved method, stated in words on the entry surface.

**Completion is the reveal** (reworded by decision 14): while rating, no results exist anywhere. The assessment flow's FINAL act completes the assessment, and completion triggers the rating-result reveal (score, level, zone) in the same gesture; there is no separate lock errand. Reopening to re-rate is a light, audited act (the trail is the record). The derived method-drift chip ("bedomd enligt tidigare metod") appears when `completedAt < approvedAt`; re-completing under the current method clears it.

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
8. **No custom criteria at all** (decision 8): the masterdokument contemplates new criteria entering with a declared dimension and overlap control (§6.2, §17.6); we go stricter, library-only with fixed texts, so those rules apply to nothing. Revisit only if a customer's material difference genuinely has no library criterion.
9. **§4.1 standard text lives in the help layer, not as standing prose** (decision 13, 2026-08-23): the masterdokument asks every step to open with VARFOR/VAD/VAD HANDER blocks; the framing-prose law (CLAUDE.md, 2026-08-21) rules standing explainer sentences a defect. The §4.1 content is carried by titles, HelpMorphButton bodies, preconditions-in-words, and the stage eyebrows (deviation 10) instead. The pedagogy is kept; the prose form is not.
10. **Stage visibility as eyebrows, not blocking modes** (§4.2.2, §17.5): METODBYGGNAD/ROLLBEDOMNING render as scanned stage labels on their surfaces, and the assessment route links to no builder or results surface; we do not hard-block navigation for the HR-only audience (extends deviation 2).
11. **Zone and level descriptions ship as seeded library content** (§14.7 steps 1, 5): the five-locale texts are authored in the repo and rendered read-only; org-authored descriptions and the full six-step anchoring process are deferred. Calibration is the queue + confirm-placement act (deviation 4); level rules stay editable through the existing validated mutations with a minimal surface.
12. **§17.3.3's second motivation trigger is deferred, not relaxed** (fas 4, 2026-08-23): the rule reads "vid niva 1, 4 eller 5, eller nar tillgangligt rollunderlag motsager bedomningen". The first clause ships and is enforced on both the client and the backend, pinned domain-completely. The second has no input: nothing in V1 ingests role documentation, so there is no source for a rating to contradict. It is a rule with no data, not a rule we chose to soften; it becomes implementable when role documentation is ingested.

## 9. Testing

- **Core:** engine tests for the scale (0-rule edges), zone capping, profile derivation, validators; fixtures updated; property-style checks around budget/caps.
- **Backend (convex-test):** library guard test (§4 above), selection mutations (caps, overlap, materiality), approval gate + checklist, method-affecting flip list, rating validations, locking lifecycle + gates, frozenModel growth, seed/devReset, audit events (label coverage auto-guards).
- **Dashboard:** builder steps + derived step state, picker, overview, stepper scale UI, reveal-behind-lock, ladder zones, calibration queue; existing i18n-parity, audit-label, help-cap, skeleton guards extended.
- E2E stays out of scope (Playwright later, per house rule).

## 10. Phasing

Each phase lands uncommitted for review, then focused commits on approval. Tests ship in the same commits.

1. **Engine + library content:** core changes (§3), `criteriaLibrary.ts` + sv/en content authored, nb/da/fi drafted, guard tests. No schema changes yet.
2. **Schema + backend:** §2 schema changes, selection/approval/locking mutations, audit events, frozenModel growth, seed/devReset; ends with dev migration + reset + browser pass. Named engine-cutover obligations from phase 1's final review (easy to miss when scoping from the schema side): swap `scoring.ts`'s internal `assertValidRating` for the dimension-aware `assertValidRatingValue` at every call site (or retire the old guard); reconcile `weighting.ts`'s `MIN_CRITERIA` (5) with `MODEL_MIN_CRITERIA` (6) by retiring or re-pointing its consumers; pin `method-checks.ts`'s `people-leadership` key against `CRITERIA_LIBRARY_KEYS` with a test (or an exported constant) so a library rename cannot silently disarm the warning; and decide whether `criteriaLibraryContent`'s locale clamp folds into the shared `clampLocale` when `standardTemplate.*` retires.
3. **Builder UI:** overview rebuild + six-station builder + picker + i18n.
4. **Assessment UI:** stepper scale, motivation, lock/reveal, gates, role-page states.
5. **Results:** 12-level ladder/matrix with zones, calibration queue, anchor deviations, pay-mapping touchpoints.
6. **Content closure:** docs MDX + `docs:sync` + `docs:eval`, metodbilaga, help texts, assistant pass, ADR finalization, full browser verification.

### Decision 14: "låsning" means completion, not a lock (2026-08-24, author clarification)

The masterdokument's author (Karl) clarified that "låsning" was never meant literally: *"Jag tror nog att ordet låsning tas för ordagrant... syftet va nog mer att fastställa, godkänna, vara klar"*; the owner and the author agreed the act belongs as *"godkännandet i sista steget av bedömningen"*. Consequences, per no-legacy:
- **The completion act merges into the assessment flow's final step**: finishing the last criterion offers "complete the assessment" as the flow's own ending; completing reveals the result in the same gesture. The separate lock errand on the role page retires.
- **Reopening is light**: re-evaluating is a one-click audited act with a toast, no confirm ceremony; the audit trail is the record (the author's explicit answer to "räcker ändringsloggen?" was yes).
- **The vocabulary renames end to end**: `lockedAt/lockedBy` -> `completedAt/completedBy`, `lockAssessment` -> `completeAssessment`, `unlockAssessment` -> `reopenAssessment`, audit events `role.assessmentLocked/Unlocked` -> `role.assessmentCompleted/Reopened` with fresh five-locale labels, UI copy from the lås family to the slutför/omvärdera families, the glossary term Låst bedömning -> Slutförd bedömning (kod: completed). §3.2's sequencing invariant is untouched: weights apply only after completion, and no result renders before it.
- **The author's audit-filter wish** (view only assessment changes in the log) is satisfied today by the log's role category filter; a finer per-event filter is noted for later, not built.

### 10.1 Fasning v2 (decision 13, 2026-08-23; replans phases 4-6 after the phase-3 closing review and the Verve shell migration)

Ground truths the replan builds on: much of the original phase 4 shipped early (the stepper with 1/3/5 anchors + midpoints, "omfattas inte", motivation machinery, lock-as-reveal, unlock audit, drift chip, and a wire-level weight firewall via `getRatingModel`); the levels surfaces still render the pre-zone flat world and no calibration UI exists; every new surface composes the Verve anatomy (`FrameTable`/`GroupedFrameTable`/`SettingsFrame`, `NAV_AREAS`); the translation-ownership policy (2026-08-21) retires every "native review" go-live item in favour of owned cross-locale QA passes.

**Fas 4 - bedomningen berattar (assessment pedagogy and trust; existing surfaces):**
- Stage eyebrows METODBYGGNAD/ROLLBEDOMNING on the model section and the rate surface (deviation 10), plus a verified absence of builder/results links from the rate route.
- The shared 1-5 scale (§13.3: the five named grades) rendered as the stepper's constant frame, with the criterion anchors as the criterion's own voice and the midpoint rule explained; the WC 0 step keeps its explanation.
- Motivation trued to §17.3: required at 1, 4, 5 (verify the current gate empirically and pin it).
- Role-page states pass: klar-att-lasa / last / kalibrerad and the drift chip against §6's wordings.
- The §11 decision-support picker: every card surfaces short text, suitability ("nar det ar lampligt" / "nar det inte bor anvandas"), the control question, overlap warnings against already-selected criteria, and the dimension cap; activation stays one click (deviation 6 stands).
- Audit gestureId correlation: multi-row acts stamp a shared id; the log renders them as one story with sub-rows (PROVENANCE_KEYS idiom). Named `gestureId` rather than `batchId` because `batchId` is already a payload field on the same table (the server-minted starter-seed run id, which PROVENANCE_KEYS renders to the reader); two correlation ids may not share one name.
- AI weight-review enrichment: org's roles (family-aggregated, no PII) into the prompt, protokoll and materiality coherence, the never-feed-outcomes rule as a hard prompt invariant; the confirm-save audit row gets its own labeled variant.

**Fas 5 - resultatet forsvarar sig (zones, levels, calibration, consequence):**
- Zone + level description content: seeded five-locale texts for the four zones (§14.5) and twelve levels (§14.6 entry/established/upper functions), rendered read-only (deviation 11).
- The ladder and matrix rebuilt zone-grouped on the Verve anatomy: zones A-D as collapsible bands with descriptions, levels 1-12 inside, pending list intact, assessor surfaces untouched (§14.5.1's firewall).
- The calibration queue: profileLimited roles ("kalibrering kravs"), anchor roles whose computed level deviates from expectation, stale locks after method changes; per role confirm placement (new audited act + toast) or jump to the builder.
- §18 consequence analysis on the approval chapter: level/zone distribution current-model vs last-approved (both derivable; the evidence buffer exists), the roles that move, aggregated per role family and per gender-dominance group (aggregates only, no individuals).
- The minimal level-rules surface over the existing validated mutations (thresholds visible and correctable in-app).
- Pay-mapping touchpoints verified: level as grouping key for new runs, the locked-assessment exclusion seam.

**Fas 6 - appen lar ut (content closure):**
- Docs corpus alignment to phases 4-5 (new + changed pages, five locales), `docs:sync`, `docs:eval` against ADR-0020's recall numbers.
- Metodbilaga PDF growth: dimension coverage, materiality decision, zone/level architecture with profile rules, approval metadata.
- Help-text sweep for every concept phases 4-5 introduced (zone, level description, calibration, consequence analysis), per the help laws.
- ONE corpus-wide cross-locale QA pass (nb/da/fi against sv/en) covering everything the program-range pass did not reach, retiring every "native review" go-live entry under the ownership policy.
- Assistant pass (prompt + knowledge alignment), ADR finalization, tracker update, full browser verification of the whole program.

Execution: on the feature branch `feat/role-evaluation-phase-4-6` (owner instruction 2026-08-23, overriding the no-branches convention for this arc); one plan document per phase at phase start; SDD with per-task review; merge to main only on the owner's word after review.

ADRs and the tracker-artifact update (Rollvardering program section: conformance matrix + phase board, same URL) land with this spec as phase 0.
