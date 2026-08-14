# Glossary dossier

Source material for the docs "glossary" page: one canonical term list covering
accounts, evaluation-model, and assessment (the three written glossaries),
plus the people and pay-mapping vocabulary that has no CONTEXT.md yet. Terms
below use current (post-ADR-0014) names; every old-word source is translated.

## Behavior today

- **Organization is the tenant.** Every record is scoped to an organization (a
  Better Auth organization). A user can belong to several organizations and
  switches the active one via the org switcher in the sidebar
  (`docs/adr/0007-legal-entity-reporting-dimension.md`). Only the *first*
  organization is created in-app (onboarding's name step via
  `authClient.organization.create`); additional organizations are provisioned
  by the platform admin, not by a self-service flow (ADR-0007, 2026-07-10
  addendum).
- **Member roles gate write access.** Admin can configure the evaluation
  model, weights, and level thresholds and manage members; Editor registers
  roles and enters ratings but cannot change model configuration
  (`docs/contexts/accounts/CONTEXT.md`).
- **Model building is two phases, never shown together.** "Define" edits the
  0-5 anchor scale per criterion; "Weight" edits the 1-5 weight points. See
  `apps/dashboard/components/model/model-builder.tsx` and
  `apps/dashboard/components/model/model-tabs.tsx`.
  `packages/core/src/weighting.ts` enforces `MIN_CRITERIA = 5` and
  `pointBudget(criterionCount) = criterionCount * 3` with
  `NEUTRAL_WEIGHT_POINTS = 3`; a criterion always enters at 3 points, and a
  removal redistributes the delta deterministically to the remaining
  criteria (`packages/backend/convex/evaluationModel/criteria.ts`).
- **Score and level are always derived, never stored.**
  `packages/core/src/scoring.ts` `scoreRole` computes
  `floor(20 * sum(rating * weightPoints) / sum(weightPoints))`, an integer on
  a fixed 0-100 scale; `assignLevel` picks the highest-minScore threshold the
  score reaches, with level 1 being highest. `computeResults` returns
  `score: null, level: null` unless every model criterion has a rating
  (completeness is by distinct criterion id, duplicates never inflate the
  count).
- **Rating is a blind stepper, one criterion at a time.**
  `apps/dashboard/components/rating/rating-stepper.tsx`: the assessor sees
  only the current criterion's 0-5 anchor texts and an optional motivation
  field; it "NEVER renders score, level, weights, or other criteria's
  values" per its own comment. The reveal happens in the result step
  (`rating-result.tsx`) after `onCompleted`.
- **Anchor roles calibrate after the fact, admin-only.**
  `apps/dashboard/components/roles/role-anchor-control.tsx`: designating or
  editing an anchor role requires a completed assessment (else
  `errors.ratingsIncomplete`, thrown in
  `packages/backend/convex/assessment/anchorRoles.ts`), records an expected
  level, motivation, review date, and a status of `active`, `underReview`,
  or `replaced` (never deleted, so calibration history stays traceable).
- **A role has no level override.** The level is always the deterministic
  outcome of score plus thresholds; to change it, HR adjusts ratings or the
  model, never the role directly (`docs/contexts/assessment/CONTEXT.md`,
  "Ingen nivåöverride").
- **Seniority lives on the person assignment, never the role.**
  `packages/backend/convex/people/assignments.ts` validates a seniority
  against the role's track ladder and throws `errors.invalidSeniority` when
  it does not fit (e.g. an `M`-track seniority on an `IC`-track role). A
  role track change resets affected assignments' seniority and requires
  re-confirmation (`senioritiesReset`), per ADR-0014's addendum to ADR-0005.
- **Pay mapping is a lifecycle entity over a frozen snapshot.** Status flow:
  not started, active, paused, under review, completed/archived
  (ADR-0011). `packages/backend/convex/payMapping/runs.ts` blocks further
  edits once completed (`errors.payMappingRunCompleted`) and enforces a
  completion gate (`errors.payMappingGateUnmet`) requiring P1 (the gender
  pay gap view) to be computed and every critical/elevated flagged group to
  carry a documented objective reason or action plan before the transition
  to completed.
- **The gender pay gap view is the mandatory, always-on primary view (P1).**
  `packages/core/src/pay-gap.ts` `classifyPayGap`: flag is `insufficient`
  when either gender is absent or the gap is null, `critical` above 10%
  magnitude, `elevated` at 5-10%, else `ok`. The small-cell minimum (>= 4
  people total, >= 2 per gender) is an export-boundary concern, not an
  in-app gate, per the comment in `pay-gap.ts` and ADR-0012's 2026-07-16
  addendum.
- **Equal-work groups gate on entry conditions, not group size.**
  `packages/core/src/pay-analysis.ts` `classifyEqualWorkGroup` outcomes:
  `shown`, `reverse` (women earn more, moved to an information view),
  `genderPure` (moves to opt-in deep analysis), `singleton` (hidden, only a
  counter survives) per ADR-0015.
- **The equal-work group key is `roleTitle | level`, without seniority**
  (ADR-0017); the level shows as its own badge, never appended to the group
  label.

## Terms and history

Canonical term pairs (Swedish / English / code identifier), by glossary.

### Accounts (`docs/contexts/accounts/CONTEXT.md`)
- **Organisation / Organization** (`Organization`): the tenant; a Better
  Auth organization. Avoid: Arbetsyta (retired 2026-06-05), Konto, Företag,
  Tenant, Org.
- **Medlem / Member** (`Member`): a user's membership in one organization,
  carrying their role there. Avoid: Användare (the user is the global
  identity; a member is identity *within* an org).
- **Admin**: a member who configures the model, weights, level thresholds,
  and manages members.
- **Editor**: a member who registers roles and enters ratings, not model
  configuration. Boundary flagged as unresolved in the source: in a
  single-HR-role org, Editor and "assessor" (bedomare) are often the same
  person; distinguish only if a separate review/calibration step needs it.

### Evaluation-model (`docs/contexts/evaluation-model/CONTEXT.md`)
- **Rollfamilj / Role family** (`Role family`): a broad family of similar
  roles (e.g. Software Engineering groups System Developer, Tech Lead,
  Engineering Manager). Not a track. Hierarchy: role family -> role ->
  (V2) employee with seniority. Membership per role is optional, at most
  one family per role; families never affect score or level, only grouping,
  filtering, and progression views.
- **Track**: what *kind* of job a role is: Individual Contributor (IC),
  Lead, or Manager (M). Describes the role, never the person. Not a role
  family.
- **Senioritet / Seniority** (`Seniority`) -- renamed by ADR-0014, was
  "Nivå"/"Level": the employee's seniority within the role's *track*
  (IC1-IC5, Lead-1-Lead-3, M1-M3), set on the individual at role assignment
  (V2, ADR-0005), never on the role. Scoped per track: an IC5 and an M3 are
  not the same seniority. Ladder values live in `TRACK_SENIORITIES`
  (`@workspace/constants`).
- **Nivå / Level** (`Level`) -- renamed by ADR-0014, was "Band": how *heavy*
  a role is company-wide, the outcome classification computed from the
  normalized weighted score via thresholds. **Level 1 is highest.** Never
  confuse with Seniority: Level is org-wide output, Seniority is track-scoped
  input.
- **Kriterium / Criterion** (`Criterion`): a thing a role is evaluated on
  (e.g. Scope & Impact, Complexity). Has a name, description, and a 0-5
  anchor scale. Fully configurable.
- **Ankare / Anchor** (`Anchor`): the text describing what each 0-5 rating
  means for a criterion (field `criteria.anchors`). UI label is
  "bedomningsskala" (assessment scale) so it is never confused with the
  criterion's weight. Not the same as **Ankarroll / Anchor role** (a
  calibration reference role); same Swedish word, different concepts.
- **Steg / Step** (`Step`) -- renamed by ADR-0014, was "nivå": one position
  on a criterion's 0-5 anchor scale (field `anchors[].step`). Not the
  individual's seniority.
- **Viktpoäng / Weight points** (`Weight points`): a criterion's weight, an
  integer 1-5 (1 = relatively lowest, 3 = neutral, 5 = relatively highest)
  set by HR. Visible and editable but bounded by the point budget.
- **Poängbudget / Point budget** (`Point budget`): total weight points to
  distribute, `criteria count x 3`. Sum of all weight points must equal the
  budget exactly (zero-sum). A new criterion always gets 3 points; removing
  one redistributes the delta deterministically to the remainder (logged in
  the audit log).
- **Andel / Share** (`Share`): the derived percent weight per criterion
  (weight points / sum of all weight points). Never an input.
- **Mall / Template** (`Template`): a reusable preconfigured model (criteria,
  anchors, weight points, track schema, level thresholds) tailored to an
  industry. An org starts from a template (or empty) then its model is
  independent thereafter.
- **Nivåtröskel / Level threshold** (`Level threshold`) -- renamed by
  ADR-0014, was "Bandtröskel": the minimum score for a level, an integer on
  the normalized 0-100 scale. Configurable per level.
- **Modell / Model** (`Model`): an organization's live evaluation
  configuration (criteria, anchors, weight points, track schema, level
  thresholds). Exactly one active model per org (no versioning in V1); a
  model change recomputes every role's score/level live.
- **Revisionslogg / Audit log** (`Audit log`): traceable log of
  outcome-affecting changes, mainly model changes (who, what, when) and
  which roles shifted level as a result.
- **Kriterieurvalsprotokoll / Criterion rationale** (`Criterion rationale`):
  documented justification per criterion (purpose, why relevant, bias risk,
  decided weight points, decision-maker, date).
- **Bias-granskning / Bias review** (`Bias review`): per-criterion
  gender/bias risk assessment (risk level low/medium/high, comment, action,
  approved yes/no).
- **Metodbilaga / Method appendix** (`Method appendix`): the exportable
  compliance document collecting criteria, weight points with shares,
  criterion rationale, and bias review.

### Assessment (`docs/contexts/assessment/CONTEXT.md`)
- **Roll / Role** (`Role`): a job/position evaluated by its content,
  requirements, responsibilities, and impact -- never by the person holding
  it. Has a title and a track; seniority sits on the individual, not the
  role (ADR-0005). Role id is permanent, never reused (equal/equivalent-work
  grouping depends on it). Avoid: Nivåroll (retired concept), Person,
  Anställd, Individ.
- **Jobbprofil / Job profile** (`Job profile`): the standardized description
  required before evaluation: identity (title, function/department, team,
  track) plus purpose and responsibilities. No seniority field (ADR-0005).
  The seven structured optional fields (decision authority, stakeholders,
  knowledge requirements, financial responsibility, people management,
  risk/consequence, deliverables) were deleted pre-launch for simplicity and
  can return later without migration cost.
- **Värdering / Assessment** (`Assessment`): the record of evaluating a role
  against the model: its ratings, computed score, assigned level, plus
  motivations.
- **Betyg / Rating** (`Rating`): the raw 0-5 an assessor gives a role on one
  criterion, judged against the criterion's anchor text. The only
  hand-entered value. Avoid: Poäng (that is the weighted total).
- **Motivering / Motivation** (`Motivation`): a short free-text explanation
  for a rating. Always optional, never required, can be per-rating or
  per-role.
- **Poäng / Score** (`Score`): the weighted total for a role, normalized to
  0-100: `20 * sum(rating * weightPoints) / sum(weightPoints)`, floored.
  Max is always 100 regardless of criteria count. UI label is "Viktning"
  (Weighting) by deliberate product decision, distinct from the
  "weighting" process of allocating weight points; not a terminology
  confusion.
- **Nivåutfall / Level outcome** (`Level outcome`) -- renamed by ADR-0014,
  was "Bandutfall": the level a role lands in, always computed
  automatically from the score via level thresholds. No manual override.
- **Ankarroll / Anchor role** (`Anchor role`): a chosen internal reference
  role with an agreed level, used to sanity-check other roles' assessments
  *after* the ordinary criterion rating (decision support, never final
  say). Deliberately designated by admin, requires a complete assessment.
  2-5 anchor roles is normally enough for small/medium orgs. Each carries
  agreed level, motivation, last-review date, and status (active,
  under review, replaced; never deleted).
- **AI-förslag / AI suggestion** (`AI suggestion`): an AI-proposed value
  (job profile text, later ratings), always with provenance (source, model)
  and status proposed -> confirmed/rejected. HR always confirms; AI never
  decides and never touches the deterministic score/level path (ADR-0003).
  Also has technical states generating and failed (error code as i18n key).
- **Blindning / Blinding**: since only trusted HR uses the tool, blinding
  exists to keep the total score from steering individual ratings, not to
  prevent cheating. Working default: weight points are set in model
  configuration; during rating entry the assessor sees only criteria +
  anchors (no weight points); score and suggested level appear only in the
  result step.

### People and pay (no CONTEXT.md yet; derived from ADRs, specs, code)
- **Person** (`people` table): a minimized-PII employee record. Erasure is a
  true hard delete of `people`, `payRecords`, `personAssignments`
  (`erasePersonAsOrg`), never a soft "deactivated" flag.
- **Rollplacering / Person assignment** (`personAssignments`): links an
  employee to a role and carries their seniority within the role's track
  (ADR-0005). Validated against the role's track ladder
  (`isValidSeniorityForTrack`, formerly `isValidLevelForTrack`).
- **Kartläggning / Pay mapping (lönekartläggning)** (`payMappingRun`,
  working name; internal table `payMappingRuns`): a first-class lifecycle
  entity (ADR-0011) built on a frozen data-layer snapshot taken at a
  reference date. Two layers: the frozen data layer (salaries, role
  level/track, demographics, level policy ranges, ratings, and model
  configuration at the reference date; immutable) and the mutable work
  layer (comparison groups, statistics/gaps, objective reasons, action
  plans, notes; locked only when the mapping is signed and archived).
- **Likaarbete / Equal work**: comparison group key `roleTitle | level`
  (ADR-0017, no seniority). Legal basis: Diskrimineringslagen 3 kap. 8-10 §§.
- **Likvärdigtarbete / Equivalent work**: comparison group key = level
  (ADR-0012); the score-derived tolerance clustering from PLAN-V1 is a
  stricter legal-defense refinement layered on top, not a replacement.
- **Sakligt skäl / Objective reason**: a documented justification for a
  flagged pay difference within a group (e.g. experience, competence,
  performance), drawn from the `PayGapReason` taxonomy.
- **Åtgärd / Action** (`payMappingActions`): a work-layer entity: issue,
  planned action, objective reason, owner, planned date, optional cost,
  priority, status (`notStarted`/`inProgress`/`done`).
- **Notering / Note** (`payMappingNotes`): free text plus a type (objective
  reason documented / further discussion / no action needed).
- **Ankarroll vs Ankare**: see Evaluation-model above; both Swedish
  glossaries flag this collision explicitly.
- **Track/senioritet vs nivå**: a role's track/seniority does not determine
  its level; the level comes only from the score. They correlate but are
  not causal (`docs/contexts/evaluation-model/CONTEXT.md`).

### ADR-0014 renames, summarized
Band (a role's computed weight) became **Level** (code `level`, level 1 is
still highest). The old "Nivå" (an individual's seniority within the role's
track) became **Seniority** (code `seniority`); ladder values (IC1-IC5,
Lead-1-Lead-3, M1-M3) unchanged. The criterion's six 0-5 scale positions,
formerly "nivåer" in code and UI, became **Step** (code `step`). No
semantics changed, only the words. Documents predating 2026-08-05 (ADR-0002,
0004, 0005, 0011, 0012, and the companion explainers `track-level-band.md`
and `viktning-poangbudget.md`) keep their original wording as history; this
dossier has translated every such claim into current terms above.

## Rationale

- **Why Level replaced Band:** "Level" (Nivå) is the word HR already uses
  for a role's weight; "Band" is a compensation jargon term requiring
  explanation on every surface, and the product's top goal is
  comprehensibility (`docs/adr/0014-terminologi-niva-senioritet-steg.md`,
  citing PLAN-V1 §1).
- **Why the old "Nivå" had to become Seniority:** it meant something
  different (individual seniority) and numbered in the *opposite* direction
  (IC1 is lowest, but Level 1 is highest); two same-named, oppositely
  numbered concepts in one app was judged a guaranteed mix-up (ADR-0014).
- **Why seniority sits on the individual, not the role:** matches how
  Swedish pay-mapping practice (DO guidance) groups "equal work" -- the role
  itself is the group, and seniority explains pay differences *within* it.
  Level-per-role also means fewer objects to create/maintain
  (`docs/adr/0005-level-per-individual.md`).
- **Why weight points instead of free percentages:** free weighting let
  every criterion be rated "critical" simultaneously (inflation); a
  zero-sum point budget forces real prioritization while keeping numbers
  small and bounded (`docs/adr/0004-point-budget-weighting.md`).
- **Why the score is normalized to 0-100 rather than a raw sum:** a raw sum's
  maximum shifts whenever a criterion is added or removed, breaking level
  thresholds' meaning; normalizing over the model's own point sum keeps
  thresholds stable regardless of criteria count (ADR-0004,
  `packages/core/src/scoring.ts` comment).
- **Why there is no level override:** the level must always be the
  deterministic outcome of ratings and thresholds; changing it means
  adjusting ratings or the model (supported by live recompute + audit log),
  which strengthens objectivity (`docs/contexts/assessment/CONTEXT.md`).
- **Why the equal-work group key dropped seniority (ADR-0017):** measured on
  a real snapshot, `title | level | seniority` produced 57 groups (only 11
  comparable, 46 gender-pure, 198 people in any comparison) versus
  `title | level` producing 38 groups (19 comparable, 19 gender-pure, 294
  people in a comparison). Legally, "equal work" concerns the tasks
  performed; experience/seniority is an objective reason for a difference
  *within* a group, not grounds for splitting the group so the difference
  never surfaces.
- **Why the pay mapping snapshot freezes data, not the work:** all analysis,
  documentation, and action planning must run against a fixed point-in-time
  picture for legal defensibility, while comparison groups, notes, and
  action plans stay editable until the mapping is signed and archived
  (`docs/adr/0011-kartlaggning-livscykel-fryst-datalager.md`).
- **Why the gender pay gap view is mandatory and cannot be disabled:** it is
  the statutory primary purpose of a pay mapping under Diskrimineringslagen
  3 kap. 8-10 §§ and EU 2023/970 Art. 4 and 9
  (`docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md`).
- **Why person-identity fields are diffed in the audit log despite being
  PII:** an audit row with an empty `changes: {}` (e.g. after a name
  correction) proved nothing changed; the fix diffs identity fields and
  scrubs them to a tombstone on erasure instead of never recording them
  (`docs/adr/0013-personidentitet-i-revisionsloggen.md`).
- **Why import parsing was broadened for money/date/FTE formats:** an
  audit of 166 real-world scenarios across Visma, Hogia, Fortnox, Agda,
  Personec, SD Worx, SAP SuccessFactors, and Workday exports found the
  original integer-only/ISO-only contracts rejected the dominant Nordic
  formats (comma-decimal amounts, `DD.MM.YYYY` dates), silently
  misclassifying real salary columns as text
  (`docs/adr/0010-import-format-expansion-csv-only.md`).

## Edge cases and error states

- **`errors.tooFewCriteria`** ("A model needs at least 5 criteria."): thrown
  by `packages/backend/convex/accounts/organization.ts` (onboarding
  completion gate) and `packages/backend/convex/evaluationModel/criteria.ts`
  (criterion removal once onboarding is complete). `MIN_CRITERIA = 5`
  (`packages/core/src/weighting.ts`). While a model is still being built
  during onboarding, the count may dip below 5 freely.
- **`errors.weightsUnbalanced`** ("The weighting must match the point
  budget."): the sum of weight points must equal `criteria count x 3`
  exactly before saving.
- **`errors.roleLocked`** ("This role is approved and locked. Reopen it
  first."): thrown on an archived/approved role by
  `packages/backend/convex/assessment/ratings.ts`,
  `assessment/anchorRoles.ts`, `assessment/roles.ts`, `assessment/starters.ts`,
  and `ai/suggest.ts` when a write is attempted against a locked role.
- **`errors.criterionLocked`** ("This criterion is approved and locked.
  Reopen it first."): thrown by `evaluationModel/method.ts`.
- **`errors.ratingsIncomplete`** ("All criteria must be rated first."):
  thrown by `assessment/anchorRoles.ts` when designating or updating an
  anchor role against a role without a complete assessment.
- **`errors.invalidSeniority`** ("That seniority is not valid for this
  role's track."): thrown by `people/assignments.ts` when the seniority
  does not fit the role's track ladder (e.g. `M1` on an `IC` role).
- **`errors.personRefExists`** ("An employee with that employee number
  already exists."): thrown by `people/people.ts` on a duplicate
  `externalRef` within the org.
- **`errors.invalidEffectiveDate`** ("The effective date must be after the
  current assignment's start date."): a person-assignment edit precondition.
- **`errors.payMappingRunCompleted`** ("The pay mapping is completed and
  locked. Reopen it to edit."): thrown across `payMapping/runs.ts`,
  `payMapping/actions.ts`, `payMapping/notes.ts` when any work-layer write
  is attempted on a completed/archived run.
- **`errors.payMappingDocumentationRequired`** ("Add an objective reason or
  a deepened analysis before marking the group done."): thrown by
  `payMapping/analyses.ts` when a group lacks its required documentation.
- **`errors.payMappingGateUnmet`** ("Steps remain in the review before the
  pay mapping can be completed."): thrown by `payMapping/runs.ts` on the
  transition to completed when the P1 completion gate (ADR-0012) is unmet.
- **`errors.payMappingPreconditionsUnmet`** ("People or roles are missing
  classification or evaluation, so the pay mapping cannot start yet."):
  thrown by `payMapping/runs.ts` before a mapping can even start.
- **`errors.modelExists`** ("This organization already has an evaluation
  model."): exactly one active model per org (no versioning).
- **`errors.profileIncomplete`** ("Complete the company profile first."):
  a precondition for AI generation and other flows needing org context.
- **`errors.roleFamilyExists`** / **`errors.roleExists`**: duplicate-name
  guards for role families and roles within a family.
- **`errors.lastAdmin`** ("You're the last administrator... Contact support
  to delete your account."): an org must always retain at least one admin.
- **Assistant edge cases**: `errors.assistantBusy` (a reply is already
  streaming), `errors.assistantRateLimited`, `errors.assistantInvalidMessage`
  (empty message), `errors.assistantPersonalData` (message appears to
  include an employee's personal details; the assistant's own reply is
  dropped and this error code is attached instead, see
  `packages/backend/convex/assistant/generate.ts` and `assistant/chat.ts`).
- **AI/model edge cases**: `errors.aiUnavailable` (AI not configured for
  this environment), `errors.aiGenerationFailed`.
- **Anchor role designation preconditions**: role must have a complete
  assessment (else `ratingsIncomplete`); status never disappears, only
  transitions active -> underReview -> replaced, so calibration history
  stays visible (`role-anchor-control.tsx`).
- **Group-suppression / floors**: in-app, an equal-work or equivalent-work
  group is `insufficient`/hidden only when a gender is entirely absent
  (`classifyPayGap`) or the group is a singleton or gender-pure
  (`classifyEqualWorkGroup`, ADR-0015); the export-boundary small-cell
  minimum (>= 4 total, >= 2 per gender) is separate and applies only when
  aggregates leave the HR context (ADR-0012 2026-07-16 addendum).
- **Import caps**: file input is CSV-only, guarded by a typed binary
  signature check (`invalidFileFormat` for `PK\x03\x04` / `\xD0\xCF\x11\xE0`
  headers); gender is stored strictly binary (`v.union(v.literal("Man"),
  v.literal("Kvinna"))`, no third or null value in the schema,
  `packages/backend/convex/people/tables.ts`). A row whose gender cell is
  blank, unrecognized, non-binary, or an ambiguous numeric code is never
  written with a null gender: `parseGender` returns `null` for it and the
  row is flagged with the `unresolvedGender` error issue
  (`packages/import/src/validate.ts`), blocking that row until the importer
  assigns one of the two values in-app (ADR-0010).

## Deliberately absent

- **No manual level override**, even though an early brief mentioned a
  documented manual adjustment; removed to keep the level strictly
  deterministic (`docs/contexts/assessment/CONTEXT.md`, "Ingen
  nivåöverride").
- **No model versioning in V1**: one live model per org; a model change
  recomputes every role live instead of creating a new version
  (`docs/adr/0002-live-recompute-no-versioning.md`).
- **No level on the role itself**: "nivåroller" (level-roles, one role per
  seniority step) were the original design and are explicitly retired;
  track-only roles plus individual seniority replaced them
  (`docs/adr/0005-level-per-individual.md`).
- **Track guardrails (min/max per track+seniority+criterion) are retired
  from the V1 rating flow**: they had no anchor once roles carried no
  seniority; kept only as reference data in `standardmall.md` for a
  possible V2 placement-support use (ADR-0005).
- **A third canonical gender value was considered and rejected**: the
  system stays binary (Man/Kvinna/null); unresolved or non-binary import
  values are flagged for manual assignment rather than mapped to a new
  value (ADR-0010, "Decision C").
- **A binary spreadsheet (XLSX/XLS/ODS) parser is explicitly out of scope
  for V1**: import is CSV-only behind a binary-signature guard; a
  client-side XLSX parser is a documented future option, not built
  (ADR-0010).
- **Access/export view-logging for pay mapping snapshots was deferred**:
  ADR-0011 originally called for logging every view of frozen snapshot
  data; a 2026-07-13 update deferred this to the future export/report
  module (M8), since the existing domain audit log already covers v1's
  change-log requirement and per-view logging of already-visible HR data
  added no protection.
- **The seven structured optional job-profile fields were deleted
  pre-launch** (decision authority, stakeholders, knowledge requirements,
  financial responsibility, people management, risk/consequence,
  deliverables) for simplicity; recorded as re-addable without migration
  cost (`docs/contexts/assessment/CONTEXT.md`).
- **A shared job architecture or group rollup across an organization's
  multiple tenants was deliberately not built**: each organization (legal
  entity) has its own independent model; no cross-org rollup exists yet
  (`docs/adr/0007-legal-entity-reporting-dimension.md`).
- **An erasure hook for person/pair-linked pay-mapping actions and notes
  does not exist yet**: these rows carry `personPublicId` plus free text
  and survive a person's erasure as a dead pseudonym reference; tracked as
  an open go-live-checklist item, not built (`docs/adr/0015`).
- **Track guardrail "Impact on Exit"-style free adjustment columns from the
  Excel prototype are not seeded** as a criterion; if wanted, an org adds it
  as an ordinary custom criterion weighted within the point budget
  (`standardmall.md`).

## Sources read

- `CONTEXT-MAP.md`
- `docs/contexts/accounts/CONTEXT.md`
- `docs/contexts/assessment/CONTEXT.md`
- `docs/contexts/evaluation-model/CONTEXT.md`
- `docs/contexts/evaluation-model/standardmall.md`
- `docs/contexts/evaluation-model/track-level-band.md`
- `docs/contexts/evaluation-model/viktning-poangbudget.md` (via ADR-0004
  citation; content summarized in ADR-0004)
- `docs/adr/0002-live-recompute-no-versioning.md` (via CONTEXT-MAP and
  ADR-0004 citations)
- `docs/adr/0004-point-budget-weighting.md`
- `docs/adr/0005-level-per-individual.md`
- `docs/adr/0007-legal-entity-reporting-dimension.md`
- `docs/adr/0010-import-format-expansion-csv-only.md`
- `docs/adr/0011-kartlaggning-livscykel-fryst-datalager.md`
- `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md`
- `docs/adr/0013-personidentitet-i-revisionsloggen.md`
- `docs/adr/0014-terminologi-niva-senioritet-steg.md`
- `docs/adr/0015-instegsvillkor-och-atgardslager.md`
- `docs/adr/0017-jamforelsegrupp-utan-senioritet.md`
- `.superpowers/sdd/00-overview/section-pages.md`
- `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md`
- `packages/core/src/scoring.ts`
- `packages/core/src/weighting.ts`
- `packages/core/src/pay-gap.ts`
- `packages/i18n/messages/en.json` (`errors` namespace, full key dump)
- `packages/backend/convex/lib/errors.ts`
- `packages/backend/convex/accounts/organization.ts`
- `packages/backend/convex/evaluationModel/criteria.ts`
- `packages/backend/convex/evaluationModel/method.ts`
- `packages/backend/convex/assessment/ratings.ts`
- `packages/backend/convex/assessment/anchorRoles.ts`
- `packages/backend/convex/assessment/roles.ts`
- `packages/backend/convex/assessment/starters.ts`
- `packages/backend/convex/ai/suggest.ts`
- `packages/backend/convex/people/people.ts`
- `packages/backend/convex/people/tables.ts`
- `packages/backend/convex/people/assignments.ts`
- `packages/import/src/validate.ts`
- `packages/import/src/parse.ts`
- `packages/backend/convex/payMapping/runs.ts`
- `packages/backend/convex/payMapping/analyses.ts`
- `packages/backend/convex/payMapping/actions.ts`
- `packages/backend/convex/payMapping/notes.ts`
- `packages/backend/convex/assistant/chat.ts`
- `packages/backend/convex/assistant/generate.ts`
- `apps/dashboard/components/rating/rating-stepper.tsx`
- `apps/dashboard/components/roles/role-anchor-control.tsx`
- directory listings of `apps/dashboard/components/rating`,
  `apps/dashboard/components/model`, `apps/dashboard/components/roles`, and
  `apps/dashboard/app/(app)/` route tree (roles, model, people, pay-mappings)
