# Model dossier

Source material for the docs section "model" (pages: model-overview,
criteria-and-scale, weighting-and-point-budget, ai-weighting-review,
method-documentation, method-appendix-pdf).

## Behavior today

**One live model per organization, never versioned.** Each org has exactly
one active evaluation model (`models` table, `by_org` index; `assertNoModel`
in `packages/backend/convex/evaluationModel/model.ts` throws `modelExists` if
a second create is attempted). Roles never store a score or level: both are
derived at read time from saved ratings (0-5) plus the current model
(`packages/core/src/scoring.ts` `computeResults`/`scoreRole`/`assignLevel`).
Changing the model (weights, criteria, thresholds) recomputes every role's
score/level immediately (ADR-0002).

**Starting a model: template or scratch.** `createModelFromTemplate`
(`evaluationModel/model.ts`) seeds the 9-criterion standard template
(`STANDARD_TEMPLATE_KEY = "standard-template-v1"`, defined in
`evaluationModel/standardTemplate.ts`) in the org's own product locale
(`contentLocale` resolves `clampLocale(settings.language)`, one of the 5
configured locales, not a binary sv/en split). Template-seeded criteria carry
a `templateKey`; `getModel`/`getMethodModel` re-localize `name`/`description`/
`helpText`/anchors/weightMeanings from that key at read time until an edit
clears it. A from-scratch model has no template rows from the start.

**The Define phase (0-5 assessment scale).** Route `/model`
(`apps/dashboard/app/(app)/model/page.tsx`), rendered by `ModelBuilder`
(`components/model/model-builder.tsx`) with `phase="define"`. Each criterion
has `name`, `description`, `helpText`, and exactly 6 anchor texts
(`anchors[].step` 0-5, `criteria.anchors` in the schema). `addCriterion`
(`evaluationModel/criteria.ts`) requires `anchors.length === 6` and a
non-empty trimmed name, else `invalidInput`; it always assigns the neutral
weight (`NEUTRAL_WEIGHT_POINTS = 3`) and writes a `criterion.added` audit
change with `buildCreateChanges`. `updateCriterion` edits only the four text
fields (name/description/helpText/anchors), never `weightPoints`; editing a
template-seeded criterion's text clears its `templateKey` so it becomes
org-authored content that stops re-localizing. Removal below the floor is
blocked once onboarding is complete (see Edge cases).

**The Weight phase (1-5 weight points, point budget).** Route
`/model/weighting`, same `ModelBuilder` component with `phase="weight"` and
`withAiReview`. Weight points are an integer 1-5 per criterion
(`WEIGHT_POINT_VALUES = [1,2,3,4,5]`, `isWeightPoints` in
`packages/core/src/weighting.ts`). The point budget is
`criteria count x 3` (`pointBudget`); the sum of all weight points must equal
the budget exactly (`isBalanced`/`budgetDelta`). The UI edits the whole
allocation locally with a live "points remaining" meter and saves atomically
via `rebalanceWeights` (`evaluationModel/criteria.ts`), which requires a
bijection (every model criterion present exactly once, each an integer 1-5)
and the exact sum, else `invalidInput` or `weightsUnbalanced`. A no-op save
(nothing changed) writes no audit row. A balanced save writes one
`level.shift` diff (via `ctx.audit.levelShifts`, comparing `deriveResults`
before/after) plus one `modelUpdated` audit row with
`change: "weights.rebalanced"` and a per-criterion `{criterionId, label,
changes: {weightPoints: {from, to}}}` item list.

**Removing a criterion redistributes the budget deterministically.**
`removeCriterion` deletes the criterion (its anchors ride along on the
document) and its ratings, then must keep the survivors balanced: the budget
shrinks by 3 while the removed criterion's own points leave the sum, so the
difference `(3 - points)` is absorbed by a deterministic repair walk (pull
the heaviest down while over budget, push the lightest up while under; ties
resolve in display order) shared with the AI-draft repair path
(`repairDraftWeights` in `packages/backend/convex/ai/weights.ts`). Every
adjustment is recorded in the removal's audit payload; removal is always a
single click (the earlier stand-at-3 precondition was removed 2026-06-07).

**Score formula and level assignment.** Role score:
`score = floor(20 * sum(rating * weightPoints) / sum(weightPoints))`, an
integer 0-100 (`scoreRole` in `packages/core/src/scoring.ts`, dividing by the
sum of the model's own weight points rather than the theoretical budget, so
the engine stays well-defined for any input). Flooring makes the comparison
against integer level thresholds exact: displayed score >= threshold iff the
unfloored score is. `assignLevel` picks, among `levelThresholds`
(`{level, minScore}`), the threshold with the highest `minScore` the score
reaches (ties broken by lowest level number); level 1 is highest. A role has
a score/level only when every model criterion is rated
(`computeResults`: `complete = ratedCount === totalCriteria`); partial
ratings yield `score: null, level: null` plus `ratedCount`/`totalCriteria`
counters.

**Per-criterion share (contribution breakdown).** `criterionShares`
(`packages/core/src/scoring.ts`) computes
`contribution_i = rating_i * weightPoints_i`, `share_i = contribution_i /
sum(contribution)`; when every rating is 0 every share is 0 (no
division-by-zero). Used by the role result contribution-breakdown UI
(evaluation section), not persisted.

**The AI weighting review** (Weight phase only, `withAiReview`).
`WeightReviewPanel` (`components/model/weight-review-panel.tsx`) requests a
review (`ai.suggest.requestWeightReview`) that returns balanced "move N
points from X to Y" suggestions with a motivation per move; each move is
itself zero-sum, so the HR admin can check/uncheck any subset of moves
(`useSuggestionSelection`) without ever breaking the budget, and confirms via
`ai.suggest.confirmWeightReview` with the accepted move indexes
(`SUGGESTION_KINDS.weightReview`). This follows ADR-0003's suggestion/confirm
model: the AI never writes weights directly. The panel can auto-request on
popover open (`autoRequest`) if no suggestion is already open; a suggestion
that already exists is shown again rather than silently replaced by a fresh
request. `noMoves` state (nothing to suggest) offers only a reject/dismiss.
The AI draft's own allocation is validated and deterministically repaired to
exactly match the budget before it is ever shown or saved
(`repairDraftWeights`).

**The Method tab (compliance evidence).** Route `/model/method`
(`components/model/method-panel.tsx`, backend
`evaluationModel/method.ts`). Per criterion, HR documents: rationale
(`purpose`, `whyRelevant`, `overlapNotes`) and bias review (`biasRisk`:
low/medium/high, `biasComment`, `biasAction`), then an explicit `approved`
sign-off (`setCriterionApproval`) that stamps `decidedBy`/`decidedAt`. A
criterion is "documented" when the required subset (`purpose`, `whyRelevant`,
`biasRisk`, `biasComment`) is non-empty/set (`overlapNotes`/`biasAction`
optional); status is a 4-state machine: `notStarted` / `inProgress` /
`documented` / `approved` (`complianceStatus` in `method.ts`, the single
source of truth reused by the query and the approval gate). Approving
requires `documented`, else `invalidInput`. Saving content on an `approved`
criterion is blocked (`criterionLocked`); editing requires an explicit reopen
via `setCriterionApproval(false)` first, which clears the stamp. A save
writes `complianceEdited: true` so `getMethodModel` stops re-localizing that
criterion's compliance text (it becomes org-authored, stored verbatim).
Compliance edits and approval changes write `modelUpdated` audit rows
(`criterion.complianceUpdated`, `criterionApproved`/`criterionReopened`
event) but never a level-shift diff (documentation cannot move a score).
Text fields cap at 2000 characters (`MAX_COMPLIANCE_TEXT`).

**Standard model ships pre-documented.** `createModelFromTemplate` seeds each
of the 9 standard criteria with curated compliance content (`purpose`,
`whyRelevant`, `overlapNotes`, `biasRisk`, `biasComment`, `biasAction`) from
the per-locale `standardTemplate.content.*.ts` modules, so a fresh
standard-model org shows "9/9 documented" immediately. Status is seeded to
`documented`, never `approved`. Seeded compliance re-localizes at read time
like criterion names, until HR edits it (then `complianceEdited: true` locks
it to the stored text).

**AI-drafting a criterion's compliance text.** `draftCriterionCompliance`
(`packages/backend/convex/ai/draft.ts`, a Convex action) lets an admin
generate the 6 compliance fields with one click in the compliance dialog.
Context (`collectCriterionComplianceContext`, `ai/suggest.ts`) carries only
the criterion's name/description/helpText/anchors, the other criteria's
names (for overlap detection), and org context (industry, country, employee
count); no person, salary, or performance data, and the `users` table is
never read. The bias output is grounded in a fixed 6-question diagnostic
checklist (`BIAS_CHECKLIST` in `ai/generate.ts`), sourced from the EU
pay-transparency bias-diagnostic questions (over-valuing male-coded work,
under-valuing relational/care work, visible-mandate bias, formal-status bias,
gender-neutral language, budget/headcount over-weighting). The draft
overwrites all six form fields via per-field `setValue(..., {shouldDirty:
true})` (never `form.reset`, which would reset the dirty baseline and disable
Save); nothing persists until the admin clicks Save. No button is shown when
the criterion is `approved` (locked). Because the admin reviews, edits, and
saves the text through the normal form (not the suggestion-confirm layer),
the saved audit row does NOT carry AI provenance: the human who edited and
saved is the row's author (ADR-0003, 2026-07-10 addendum). This differs from
suggestion-layer flows (model draft, weight review, starter import), which
stay fully AI-attributed until confirmed.

**Model draft in onboarding (from-scratch path).** Onboarding's model step
offers AI-drafted criteria (name, description, helpText, weightMeaning
label, and 6 anchor texts) when starting from scratch, and suggested weight
adjustments in the template path. Both go through the suggestion layer with
provenance (`source: "ai"`, status suggested -> confirmed) per ADR-0003;
nothing is auto-applied. The AI draft's weight allocation is validated and
deterministically repaired to exactly match the point budget before being
shown or saved (same repair walk as removal).

**Method appendix export (metodbilaga).** A client-side PDF built with
`@react-pdf/renderer` (no headless Chrome, no server generation; data never
leaves the browser and is model-only, no PII). Sections: cover -> methodology
preamble (scoring mechanics, blinding, audit trail, Role != Person, and the
mandatory "biasreducerande, aldrig biasfri" / "bias-reducing, never
bias-free" statement) -> point-budget + criteria/weights table ->
per-criterion rationale + bias review -> level-threshold table. Labelled
**FINAL** when every criterion is `approved` (implying all documented), else
**DRAFT**. Export is a client-side read with no audit row (no domain-state
change). Built via a pure, tested assembler
(`lib/pdf/method-appendix-data.ts`) that turns `getMethodModel` data into
structured sections and computes the DRAFT/FINAL status; the React-PDF
template stays presentational.

**Anchor roles as calibration reference** (roles surface, listed here for the
model boundary): an anchor role carries an `expectedLevel` (agreed level) that
the ladder/matrix overview compares against the computed level; a mismatch
shows a deviation flag. Level itself is always derived from the score, never
set by hand (out of scope for the Overview design: "drag to reband" was
explicitly rejected).

## Terms and history

Canonical term pairs (Swedish / English), from
`docs/contexts/evaluation-model/CONTEXT.md`:

- **Rollfamilj / Role family**: a broad family of related roles; not a
  track. Own entity since 2026-06-06.
- **Track**: what *kind* of job a role is (IC / Lead / M), an archetype on
  the role, never on the person.
- **Senioritet / Seniority** (code `seniority`): the individual's seniority
  *within* the role's track (IC1-IC5, Lead-1-Lead-3, M1-M3), set on the
  person at role placement (V2, ADR-0005), scoped per track. Was called
  **Nivå/Level** before ADR-0014 (2026-08-05).
- **Nivå / Level** (code `level`): how *heavy* a role is versus all other
  roles, the output classification derived from the weighted score via
  thresholds. **Level 1 is highest.** Was called **Band** before ADR-0014.
- **Kriterium / Criterion**: a thing a role is evaluated on; has a name,
  description, and a 0-5 anchor scale; fully configurable, HR can add
  custom criteria.
- **Ankare / Anchor** (code `criteria.anchors`): the text describing what
  each 0-5 point means for a criterion. Canonical term in speech/code is
  "ankare"; the UI label for the criterion's six texts is "bedömningsskala"
  (assessment scale) since the 2026-06-24 rename (previously
  "bedömningsankare", then briefly "bedömningsnivå" per the 2026-06-13
  model-surface-clarity rename), chosen specifically so it is never confused
  with the criterion's WEIGHT (1-5 weight points) shown in the Weight phase.
  The Define/Weight two-phase split exists to keep these two scales from ever
  being shown together.
- **Steg / Step** (code `step`, field `anchors[].step`): one position on a
  criterion's 0-5 assessment scale. Was called "nivå" before ADR-0014.
- **Viktpoäng / Weight points** (code `weightPoints`): a criterion's weight,
  an integer 1-5 (1 = relatively lowest, 3 = neutral, 5 = relatively
  highest), visible and editable, constrained by the point budget. Since
  2026-06-06 (ADR-0004); replaced the earlier 7-level "Betydelse"/importance
  scale with hidden weights (8-18) from the Excel prototype.
- **Poängbudget / Point budget**: total weight points to distribute =
  criteria count x 3. Sum of all weight points must equal the budget exactly
  (zero-sum). New criteria always enter at 3.
- **Andel / Share**: the derived percent weight per criterion (weight
  points / sum of weight points); a display consequence, never an input.
- **Mall / Template**: a reusable pre-configured model (criteria, anchors,
  weight points, track schema, level thresholds) for a job/org type. An org
  starts from a template (or empty) then adapts; its model is independent
  thereafter.
- **Nivåtröskel / Level threshold** (code `levelThreshold`): the lowest
  score (inclusive) for a level, an integer on the normalized 0-100 scale.
  Was "Bandtröskel/Band threshold" before ADR-0014.
- **Modell / Model**: an org's one living evaluation configuration; no
  versioning in V1; changing it recomputes every role's score/level.
- **Kriterieurvalsprotokoll / Criterion rationale**: the documented
  justification per criterion (purpose, why relevant, bias risk, decided
  weight points, decision-maker, date).
- **Bias-granskning / Bias review**: per-criterion gender/bias-risk
  assessment (risk level, comment, action, approved yes/no).
- **Metodbilaga / Method appendix**: the exportable document collecting
  criteria, weight points (with shares), criterion rationale, and bias
  review as compliance evidence.

**ADR-0014 rename (2026-08-05), no semantics changed, only words:**

1. **Band** (the role's computed weight, the outcome of the score via
   thresholds) is renamed **Nivå/Level** (code `level`). Level 1 is still
   highest.
2. The prior **Nivå/Level** (the employee's seniority within the role's
   track, ADR-0005) is renamed **Senioritet/Seniority** (code `seniority`).
   The ladder values (IC1-IC5, Lead-1-Lead-3, M1-M3) are unchanged.
3. A criterion's six 0-5 assessment-scale positions, previously called
   "nivåer" (levels), are renamed **Steg/Step** (code `step`).

Rationale for the rename: "Nivå" is the word HR already used for the role's
weight class; "Band" is jargon requiring explanation on every surface. The
rename was forced because the old "Nivå" meant something else entirely (the
individual's seniority) and numbered in the OPPOSITE direction (IC1 lowest vs
Level 1 highest) -- two same-named concepts with reversed numbering was a
guaranteed mix-up. The assessment scale's "nivåer" was the third colliding
usage (in both code `anchors[].level` and UI text), which had already forced
the earlier "bedömningsskala" UI rename. Per-language word choices: Level =
Level/Nivå/Nivå/Niveau/Vaativuustaso (short form "Taso {n}" in fi); Seniority
= Seniority/Senioritet/Senioritet/Senioritet/Senioriteetti; Step =
Step/Steg/Trinn/Trin/Porras.

**Code identifiers renamed without migration (pre-launch, no legacy):**
`models.bandThresholds` -> `levelThresholds`; `anchorRoles.expectedBand` ->
`expectedLevel`; `personAssignments.level` -> `seniority`; criteria's
`anchors[].level` -> `anchors[].step`; classification's
`suggestedLevel`/`levelSource` -> `suggestedSeniority`/`senioritySource`; in
`packages/core`, `Band`/`BandThreshold` -> `Level`/`LevelThreshold` and
`assignBand` -> `assignLevel`; in `packages/constants`, `TRACK_LEVELS` ->
`TRACK_SENIORITIES`; criteria's per-weight-point texts `weightLevels` ->
`weightMeanings`. Audit event `band.shift` -> `level.shift`. Older ADR bodies
(0002, 0004, 0005, 0011, 0012) intentionally keep their original words as
history; read them with the ADR-0014 key.

**Pre-ADR-0005 history (superseded):** the source document
`track-level-band.md` originally modeled roles as "level roles" (e.g.
"Software Developer - IC2" as its own role, with Track and Level both set on
the role). ADR-0005 (2026-06-07) revised this: a role carries only a
**track**; the individual's seniority is set at role placement (V2, people
context), not on the role, so "System Developer" is one role and can host
both an IC1 and an IC4 person. This matches Swedish pay-mapping practice
(DO guidance): the "equal work" grouping is the role, not a level-split
sub-role. If a senior's actual work differs, the org creates it as its own
role instead of a level variant.

**Pre-ADR-0004 history (superseded):** criteria were weighted on a fixed
7-level "Betydelse" (importance) scale with hidden Excel weights (8, 10, 11,
12, 13, 14, 18); the raw weighted sum was the role's total (max 540 for the
9-criterion standard template, fragile because the max shifted whenever a
criterion was added/removed). ADR-0004 (2026-06-06) replaced both: visible
1-5 weight points under a point budget, and a normalized 0-100 score.

## Rationale

- **Point budget over free weighting** (ADR-0004, source doc
  `viktning-poangbudget.md`): free weighting lets everyone mark their factor
  "critical," which the source document identifies as inflation -- when
  everything is high priority, nothing actually is. The budget forces
  zero-sum tradeoffs: raising one criterion requires lowering another. This
  also replaces "hidden numbers" (opaque Excel weights) with "bounded
  numbers" (visible 1-5 integers under a hard budget), preserving the old
  invariant that weights are never entered as free percentages while fixing
  the inflation problem from the other direction.
- **Normalized 0-100 score over raw weighted sum** (ADR-0004): a raw sum's
  maximum shifts every time a criterion is added or removed (a known
  fragility in the old model, where max=540 only held for the standard
  template). On the 0-100 scale, thresholds mean the same thing regardless
  of how many criteria the model has.
- **Live recompute, no model versioning** (ADR-0002): chosen for simplicity
  and because it fits Convex's reactive model well; deliberately deviates
  from the CTO brief's requirement that "model changes must not retroactively
  overwrite historical assessments without versioning." Consequence: a model
  change can silently move roles between levels without preserving prior
  outcomes. Mitigated by the audit log (in V1) capturing who/what/when and
  which roles shifted level as a result.
- **Seniority on the individual, not the role** (ADR-0005): matches how
  Swedish pay-mapping practice groups "equal work" (the role, not a
  level-split sub-role); simpler setup (one job = one role, not five); the
  escape valve is that if a senior's actual work differs, the org models it
  as its own role.
- **AI never touches the deterministic score/level path** (ADR-0003):
  letting AI move score/level or auto-decide would destroy the "objective,
  defensible, non-gameable" property that is the entire point of the EU
  directive. Suggestion-plus-confirmation-plus-log preserves it. Embedded
  assistance (never a chatbot, prior to ADR-0018) keeps AI to well-defined,
  auditable, in-context points in the flow.
- **Compliance evidence is non-blocking (DRAFT/FINAL, not a hard gate)**
  (`2026-07-01-model-compliance-evidence-design.md`): a hard export gate
  would be "formal model governance," explicitly deferred per PLAN-V1 §125's
  chosen compliance stance ("light compliance posture, level 2"). The binding
  wording rule "bias-reducing, never bias-free" makes an honest DRAFT/FINAL
  self-description the right model: a document that hides its gaps is weaker
  evidence than one that states its own completeness.
- **AI-drafted compliance text carries no AI provenance marker once saved**
  (ADR-0003 addendum, 2026-07-10): the human who reviews, edits, and saves
  the text through the normal form is that content's author and responsible
  for it; a `source: "ai"` marker would be misleading because the save
  mutation only ever sees the final text and cannot know how much of the AI
  draft survived editing. This is deliberately different from the
  suggestion-layer flows (weight review, model draft, starter import), whose
  full-AI-until-confirmed provenance is meaningfully different.
- **EU-hosted model, no AI gateway in the data path** (ADR-0003 addendum):
  Mistral La Plateforme is called directly from Convex actions (AI SDK v7,
  `generateText` + `Output.object`); EU processing, no training on paid API
  per DPA, Zero Data Retention requested. Vercel AI Gateway is never used in
  the data path because it cannot pin EU routing, which would break the
  EU-data-residency invariant (ADR-0001).

## Edge cases and error states

- **`errors.modelExists`** ("This organization already has an evaluation
  model."): thrown by `assertNoModel` when a second `createModelFromTemplate`
  (or scratch create) is attempted for an org that already has one.
- **`errors.invalidInput`**: thrown by `addCriterion`/`updateCriterion` when
  the name is empty after trim or `anchors.length !== 6`; by
  `rebalanceWeights` when an allocation entry is not an integer 1-5, is
  duplicated, or the bijection against the model's criteria fails (missing
  or extra criterion ids); by `saveCriterionCompliance` when any compliance
  text exceeds 2000 characters; by `setCriterionApproval` when approving a
  criterion that is not yet `documented`.
- **`errors.notFound`**: thrown when a model is missing for the org (e.g.
  `addCriterion`, `rebalanceWeights`, method mutations), or a criterion id
  does not belong to the caller's org (`updateCriterion`, `removeCriterion`,
  `saveCriterionCompliance`, `setCriterionApproval`).
- **`errors.weightsUnbalanced`** ("The weighting must match the point
  budget."): `rebalanceWeights` rejects any allocation whose sum is not
  exactly `criteria count x 3`.
- **`errors.tooFewCriteria`** ("A model needs at least 5 criteria."):
  `MIN_CRITERIA = 5` is the composition floor. It is enforced in two places:
  `removeCriterion` blocks removal below 5 only once onboarding is complete
  (`organizations.onboardingCompletedAt` is set) -- while the model is still
  under construction during onboarding, removal is free at any count, and the
  wizard's own Next-step gates enforce the floor before completion instead.
  `completeOnboarding` is the server-side backstop that re-checks the count
  and throws `tooFewCriteria` if fewer than 5 criteria exist. The AI
  model-draft schema also enforces a minimum of 5 criteria
  (`packages/backend/convex/ai/generate.ts`), rejecting an undersized draft
  outright rather than surfacing content that could never pass the floor.
- **`errors.criterionLocked`** ("This criterion is approved and locked.
  Reopen it first."): `saveCriterionCompliance` rejects edits on a criterion
  whose `approved === true`; the UI hides the "Draft with AI" button under
  the same condition. Reopening (`setCriterionApproval(false)`) is required
  first, which clears `approved`/`decidedBy`/`decidedAt`.
- **`errors.aiUnavailable`** / **`errors.aiGenerationFailed`**: mapped from
  `draftCriterionCompliance` and the model-draft/weight-review actions when
  the AI key is missing or generation/schema validation fails; the UI
  surfaces these as an inline error, leaves the form untouched, and offers a
  manual retry.
- **`errors.notAuthenticated`** / **`errors.adminRequired`**: standard
  auth/authorization gates on every model mutation (`adminMutation`) and the
  AI context queries (re-checked independently of the client per ADR-0003).
- **No-op reweight save**: `rebalanceWeights` writes no audit row when the
  requested allocation matches the current one exactly (avoids spurious
  audit rows for a save that changes nothing).
- **AI weight-review "no moves" state**: when the AI finds nothing worth
  reallocating, the panel shows only a reject/dismiss control (`noMoves`
  copy), no confirm action.
- **Removing a criterion that is not at the neutral 3**: absorbed
  automatically by the deterministic repair walk; no precondition, no
  pre-staging step required (explicitly revised 2026-06-07 after user
  testing found the earlier stand-at-3 requirement forced a backwards flow).
- **Approving a criterion pre-seeded from the standard template**: allowed
  without any edit, because `isDocumented` reads the stored (seeded) fields
  directly; the standard model ships "documented," never "approved."
- **Metodbilaga export with incomplete evidence**: never blocked; the
  document self-labels DRAFT (not every criterion approved) vs FINAL (every
  criterion approved), rather than refusing to export.

## Deliberately absent

- **Model versioning** (ADR-0002): the CTO brief's requirement that model
  changes must not retroactively overwrite historical assessments without
  versioning is deliberately not implemented in V1. A single live model per
  org is recomputed in place; the audit log is the accepted mitigation, not
  a substitute for true history.
- **Free/percentage weighting**: never available at any level; weights are
  always integer weight points 1-5 within the budget, even for fully custom
  criteria. Shares are always derived, never entered.
- **A 0-weight-point option**: no zero level on the weight scale (unchanged
  from the old 7-level scale's rule) -- a criterion that should not count is
  removed, not zeroed.
- **Level (role weight class) editing by hand**: level is always derived
  from score via thresholds; there is no drag-to-relevel or manual override
  anywhere (ADR-0002, ADR-0004). The band/role Overview design explicitly
  rejected "drag to reband" for this reason.
- **Track guardrails in the rating flow** (ADR-0005): the Excel prototype's
  advisory min/max ranges per (track, seniority, criterion) are retired from
  V1's rating flow; `checkGuardrails` is removed from the engine and the
  `trackGuardrails` table from the schema. The ranges remain as reference
  data in `standardmall.md` for possible V2 reuse (e.g. placement support);
  they are documentation, not enforced logic.
- **Career-step (per-seniority) banding**: retired from V1; one role gets
  one level regardless of which seniorities are staffed in it.
- **Band-threshold editing UI**: explicitly out of scope for the
  point-budget-weighting slice and for the compliance-evidence slice (the
  data model already supports editable `levelThresholds`, but no UI exists
  yet); tracked as a separate configurability follow-up.
- **Mandatory governance**: obligatory calibration, formal model governance,
  and dual-rater / inter-rater reliability checks are deferred (PLAN-V1
  §125's "light compliance posture, level 2").
- **Chart embedding in the metodbilaga PDF**: the branded PDF kit is
  designed with a chart seam (`react-pdf-charts` SVG path, PNG fallback
  documented) but no chart code is built; the metodbilaga ships chartless.
- **A general report engine**: this build is scoped to the metodbilaga
  document only, on a reusable branded kit; a broader Word/PDF report engine
  is separate future scope (E7).
- **Persistent per-criterion "AI-assisted" flag**: not built for the
  criterion-compliance AI fill (mirrors the job-profile AI-fill precedent);
  provenance is the AI-usage telemetry event plus the ordinary save audit
  row, not a stored flag on the criterion.
- **A bulk "draft all criteria" AI action**: the AI compliance draft is
  per-criterion, triggered from the compliance dialog only; no batch
  generation across the whole model.
- **Recalibration of the default level thresholds against real data**: the
  standard template's thresholds (98/83/74/63/53/41/0) are a translation of
  the Excel prototype's share-of-max thresholds and are explicitly flagged
  as needing calibration against real data before launch; not yet done.
- **A Level 7 competency-matrix description**: the source competency matrix
  covers Level 1-6 descriptive text; Level 7 (the lowest entry level) has no
  written description in the reference data, an open item noted in
  `standardmall.md`.

## Sources read

- `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md` (row
  assignment for this section)
- `.superpowers/sdd/00-overview/section-pages.md` (target pages for "model")
- `docs/adr/0002-live-recompute-no-versioning.md`
- `docs/adr/0003-ai-embedded-assistant.md` (including all three addenda:
  2026-06-04, 2026-06-14, 2026-07-10)
- `docs/adr/0004-point-budget-weighting.md`
- `docs/adr/0005-level-per-individual.md` (including both addenda,
  2026-07-10 and 2026-08-05)
- `docs/adr/0014-terminologi-niva-senioritet-steg.md`
- `docs/contexts/evaluation-model/CONTEXT.md`
- `docs/contexts/evaluation-model/standardmall.md`
- `docs/contexts/evaluation-model/track-level-band.md`
- `docs/contexts/evaluation-model/viktning-poangbudget.md`
- `docs/superpowers/specs/2026-06-06-point-budget-weighting-design.md`
- `docs/superpowers/specs/2026-07-01-model-compliance-evidence-design.md`
- `docs/superpowers/specs/2026-07-02-criterion-compliance-ai-fill-design.md`
- `docs/superpowers/specs/2026-07-02-standard-model-compliance-seed-design.md`
- `docs/superpowers/specs/2026-06-15-band-role-overview-design.md` (band/role
  overview design, superseded terminology; read for the level/track matrix
  and anchor-role deviation-flag behavior at the model/roles boundary)
- `docs/superpowers/plans/2026-06-13-model-surface-clarity.md` (skimmed for
  the bedömningsnivå/bedömningsskala UI-label rename history)
- `docs/superpowers/plans/2026-06-06-point-budget-weighting.md` (the
  implementation-plan companion to the point-budget-weighting design; task
  list only, executed inline in one session; confirms
  `NEUTRAL_WEIGHT_POINTS = 3`, the 98/83/74/63/53/41/0 threshold fixtures, and
  that `importance.ts` was renamed `weighting.ts` -- superseded by the design
  spec already cited, nothing new for this dossier)
- `docs/superpowers/plans/2026-06-15-band-role-overview.md` (implementation
  plan for the roles/work Overview surface at the model boundary; confirms
  band/level is always derived and never stored, a replaced anchor role's
  `expectedBand` (now `expectedLevel`) reads back as `null` rather than as a
  calibration point, and that "drag to reband" style manual override was
  never built; superseded by the design spec already cited for this section)
- `docs/superpowers/plans/2026-07-01-model-compliance-evidence.md` (the
  implementation-plan companion to the model-compliance-evidence design;
  confirms no schema change was needed (all compliance fields pre-existed on
  `criteria`), the exact required-field completeness rule, and that
  compliance edits/approval log under the existing `modelUpdated` event with
  no new audit event key or label; superseded by the design spec already
  cited)
- `docs/superpowers/plans/2026-07-02-criterion-compliance-ai-fill.md` (the
  implementation-plan companion to the criterion-compliance-AI-fill design;
  confirms the AI draft mirrors the job-profile AI fill exactly, the prompt
  never reads the `users` table, and the six BIAS_CHECKLIST questions verbatim
  as quoted in Behavior today; superseded by the design spec already cited)
- `docs/superpowers/plans/2026-07-02-standard-model-compliance-seed.md` (the
  implementation-plan companion to the standard-model-compliance-seed design;
  confirms compliance is seeded as `documented` never `approved`, the
  `complianceEdited` flag's re-localization gate, and that sv is the source
  language with nb/da/fi as machine drafts flagged in
  `docs/go-live-checklist.md`; superseded by the design spec already cited)
- `packages/core/src/weighting.ts`
- `packages/core/src/scoring.ts`
- `packages/backend/convex/evaluationModel/model.ts`
- `packages/backend/convex/evaluationModel/criteria.ts`
- `packages/backend/convex/evaluationModel/method.ts`
- `packages/backend/convex/evaluationModel/standardTemplate.ts`
- `packages/backend/convex/accounts/organization.ts` (`completeOnboarding`
  MIN_CRITERIA backstop)
- `packages/backend/convex/ai/generate.ts` (MIN_CRITERIA schema floor, bias
  checklist reference)
- `apps/dashboard/app/(app)/model/page.tsx`
- `apps/dashboard/components/model/model-builder.tsx`
- `apps/dashboard/components/model/model-tabs.tsx`
- `apps/dashboard/components/model/weight-review-panel.tsx`
- `packages/i18n/messages/en.json` (`errors.*` namespace: modelExists,
  invalidInput, notFound, weightsUnbalanced, tooFewCriteria, criterionLocked,
  aiUnavailable, aiGenerationFailed, notAuthenticated, adminRequired)
