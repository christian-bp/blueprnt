# Role Evaluation Phase 2: Schema and Backend Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the app over from the 9-criterion template world (0-5 scale, 7 levels, free-form criteria) to the masterdokument world: library-only criteria selection with fixed texts, the 1-5 scale, model approval + materiality, assessment locking, and 12 levels with profile-gated zones, ending with a dev reset and a full browser pass.

**Architecture:** The monorepo's pre-commit gate (Biome + typecheck + full turbo test across core/backend/dashboard) binds every commit, so the cutover is sequenced as green stages: relocate what the template module owns beyond the template (T1), widen the schema (T2), then the coordinated criteria-selection cutover (T3, the big one), zones (T4), the 1-5 scale (T5), the approval lifecycle (T6), assessment locking (T7), the frozen evidence (T8), and reconciliation + dev reset + browser pass (T9). Dashboard changes in this phase are MINIMAL adaptations that keep every surface working on the new wire shapes; the real builder/assessment/results UX arrives in phases 3-5.

**Tech Stack:** Convex (object-form functions, org-scoped, audit machinery), TypeScript, Vitest 4 via `bun run test` (never `bun test`), convex-test on edge-runtime, Next.js dashboard, next-intl.

**Spec:** `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md` as amended: decision 8 (library-only criteria, fixed texts, §2.2 is a pure selection table), the §3.2 working-conditions profile exemption, the §3.4 twelve-check checklist with overlap acknowledgement, and §10.2's named cutover obligations. ADR-0021 (tillägg), ADR-0022 (beslutsnot 1-2), ADR-0023 govern. The phase-1 hardening wave (committed just before this plan executes) already delivered: `PEOPLE_LEADERSHIP_LIBRARY_KEY` exported from core, `MethodCheckInput` carrying `levelRules` + `zoneProfileRules` + per-criterion `hasOverlapNotes`, the twelve checks, `profileCriteria` excluding workingConditions, `LevelRule = LevelThreshold`, and the six-key industry hints.

## Global Constraints

- English code/comments/commits; no em dashes anywhere; no AI attribution; conventional commits; comments state constraints only.
- Every commit passes the full pre-commit gate; never `--no-verify`. Stage only each task's named files (the tree may hold unrelated uncommitted docs).
- Backend functions stay org-scoped; every state-changing mutation writes its audit row with typed payloads, categories via prefix, a declared subject (or reviewed null), labels in ALL FIVE locales for events, fields, and coded values, and the drift-guard tests (`audit-labels.test.ts`, backend category test) must stay green.
- The backend returns error codes, never display text; new codes get `errors.*` translations in all five locales.
- i18n parity guard binds every message change; never write non-ASCII locale text via shell pipelines.
- Score/level/zone are always derived, never stored (ADR-0002). No legacy: retired fields, tables, constants, and i18n keys are deleted in the same change.
- Forms follow the house react-hook-form + Zod factory pattern; toasts for user-initiated CRUD; skeletons for new data surfaces (minimal adaptations reuse existing patterns).
- `packages/core` purity holds. Convex guidance: read `packages/backend/convex/_generated/ai/guidelines.md` before writing Convex code.
- Dev deployment: after T3's schema narrowing, the running `convex dev` cannot push until data conforms; T3 ends with `bun db:reset`. Do not run resets against anything but the local dev deployment (seed guards this, keep it that way).

---

### Task T1: Relocate track schema and locale clamp out of the template module

**Files:**
- Create: `packages/backend/convex/evaluationModel/trackSchema.ts`
- Modify: `packages/backend/convex/evaluationModel/localize.ts`, `packages/backend/convex/evaluationModel/criteriaLibrary.ts` (fold the locale clamp), every importer of `standardTemplate`'s `TRACK_KEYS`/`TrackKey`/`TemplateLocale` (find with `grep -rn "from \"./standardTemplate\"\|from \"../evaluationModel/standardTemplate\"" packages/backend/convex --include="*.ts"`; the review counted 15 files, including `assessment/{names,starters,tables}.ts`, `people/assignments.ts`, `ai/{suggest,prefillData}.ts`)
- Test: existing suites (pure relocation; no behavior change), plus `trackSchema.test.ts` asserting the bijection test that `standardTemplate.test.ts` carried for TRACK_KEYS moves along

**Interfaces:**
- Produces: `evaluationModel/trackSchema.ts` exporting `TRACK_KEYS`, `type TrackKey`, and `trackName(locale, key): string` (the localized track display names, a small inline 5-locale record moved from the template content). `localize.ts` exporting `clampLocale` returning the five-locale union `ProductContentLocale` defined locally (no template import), `isTrackKey` re-pointed to trackSchema, `promptLocale` unchanged. `criteriaLibrary.ts`'s `CriteriaLibraryLocale` becomes an alias of `ProductContentLocale` and `criteriaLibraryContent` uses `clampLocale`.
- `standardTemplate.ts` keeps re-exporting `TRACK_KEYS`/`TrackKey` from trackSchema temporarily so this task stays a pure move; T3 deletes the module.

- [ ] **Step 1:** Create trackSchema.ts with TRACK_KEYS/TrackKey and the localized names lifted from the five template content modules' `trackNames`; move the bijection test.
- [ ] **Step 2:** Re-point `localize.ts` (locale set defined locally as `ProductContentLocale`), `tables.ts`'s validator import, and every consumer found by the grep; standardTemplate re-exports the moved symbols; `criteriaLibrary.ts` drops its own clamp for `clampLocale`.
- [ ] **Step 3:** Run `cd packages/backend && bun run test`; expect all green (pure moves).
- [ ] **Step 4:** Commit: `refactor(backend): move track schema and locale clamp out of the template module` (all touched files).

---

### Task T2: Widen the schema for the cutover

**Files:**
- Modify: `packages/backend/convex/evaluationModel/tables.ts`, `packages/backend/convex/assessment/tables.ts`, `packages/backend/convex/payMapping/tables.ts`
- Test: `packages/backend/convex/schema.test.ts` extended

**Interfaces (all optional in this task; nothing reads them yet):**

```ts
// evaluationModel/tables.ts additions
export const libraryKeyValidator = v.union(
  v.literal("knowledge-depth"), v.literal("knowledge-breadth"), v.literal("formal-qualifications"),
  v.literal("domain-knowledge"), v.literal("advisory-judgment"),
  v.literal("complexity-ambiguity"), v.literal("analytical-effort"), v.literal("communication-effort"),
  v.literal("operational-intensity"), v.literal("physical-sensory"),
  v.literal("scope-impact"), v.literal("autonomy-mandate"), v.literal("risk-consequence"),
  v.literal("people-leadership"), v.literal("resource-capacity"), v.literal("business-customer"),
  v.literal("compliance-control"),
  v.literal("safety-exposure"), v.literal("on-call"), v.literal("irregularity-mobility"),
  v.literal("restricted-environments")
)
// criteria: + libraryKey: v.optional(libraryKeyValidator), weightMotivation: v.optional(v.string())
// models: + approval: v.optional(v.object({ approvedBy: v.string(), approvedAt: v.number() })),
//   workingConditions: v.optional(v.object({
//     status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
//     motivation: v.string(), decidedBy: v.string(), decidedAt: v.number() })),
//   levelRules: v.optional(v.array(v.object({ level: v.number(), minScore: v.number() }))),
//   zoneProfileRules: v.optional(v.array(v.object({
//     zone: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
//     minStep: v.number() })))
// roles: + assessment: v.optional(v.object({ lockedBy: v.string(), lockedAt: v.number(),
//   calibratedBy: v.optional(v.string()), calibratedAt: v.optional(v.number()),
//   calibrationNote: v.optional(v.string()) }))
// payMappingRuns.frozenModel: criteria items + dimensionKey: v.optional(v.string()),
//   libraryKey: v.optional(v.string()); frozenModel + levelRules/zoneProfileRules (optional arrays,
//   same shapes as models), workingConditions (optional, same shape), approval (optional, same shape)
```

A `schema.test.ts` structural test asserts `libraryKeyValidator`'s member set equals `CRITERIA_LIBRARY_KEYS` (import both; a library key added without the validator, or vice versa, fails compile or test).

- [ ] **Step 1:** Failing schema test (validator/key-set equality), Step 2: widen the tables exactly as above, Step 3: `bun run test` in backend green, Step 4: Commit `feat(backend): widen the schema for the method cutover`.

---

### Task T3: The criteria selection cutover (the coordinated commit)

The epicenter. One task, one large green commit; everything below lands together because the monorepo gate binds them.

**Files:**
- Modify: `packages/backend/convex/evaluationModel/tables.ts` (criteria final shape; models drops `templateKey`, `levelThresholds` becomes required `levelRules` + required `zoneProfileRules`), `evaluationModel/model.ts` (rewrite), `evaluationModel/criteria.ts` (rewrite), `evaluationModel/method.ts` (localized names via library), `evaluationModel/criteriaLibrary.ts` (+ `modelName` string per locale in the five content modules), `assessment/compute.ts` (levelRules), `assessment/devCompany.ts` + `assessment/seed.ts` (library-key demo), `seed.ts` mirrors, `lib/audit.ts` + `lib/auditPayloads.ts` (criterion.activated/deactivated events; model.created payload without templateKey), suggestion kinds (`@workspace/constants` suggestions.ts: retire the model.draft kind) and `ai/draft.ts`/`ai/persist.ts` criterion-draft paths, dashboard: `components/model/model-builder.tsx` (dimension-grouped sections), NEW `components/model/library-picker-dialog.tsx` (minimal), DELETE `components/model/add-criterion-dialog.*` + `edit-criterion-dialog.*`, `components/onboarding/ensure-default-model.tsx` (createDefaultModel), `app/(app)/model/page.tsx`, weighting/method surface reads, `components/pdf/method-appendix*` minimal adaptation, i18n message files (all five: new keys for dimensions sections, picker, removed keys for criterion editing)
- Delete: `evaluationModel/standardTemplate.ts` + the five `standardTemplate.content.*.ts` + their tests; `localize.ts`'s `isCriterionKey`
- Test: rewritten `evaluationModel/*.test.ts`, `assessment/seed.test.ts`, dashboard component tests for the touched surfaces

**Interfaces produced (later tasks rely on these exact names):**
- `criteria` row final: `{ orgId, modelId, libraryKey (required), weightPoints, order, weightMotivation?, purpose?, whyRelevant?, overlapNotes?, biasRisk?, biasComment?, biasAction?, approved?, decidedBy?, decidedAt? }`. Dimension always derived `LIBRARY_DIMENSION[libraryKey]`; uniqueness per (model, libraryKey) enforced in `activateCriterion`.
- `models` final for this task: `{ orgId, name, levelRules (12, required), zoneProfileRules (required, seeded from DEFAULT_ZONE_PROFILE_RULES), approval?, workingConditions? }`.
- Mutations: `createDefaultModel()` (no args; name from library content `modelName`; levelRules from `DEFAULT_LEVEL_RULES`, zoneProfileRules from `DEFAULT_ZONE_PROFILE_RULES`; audit model.created with source "default"); `activateCriterion({ libraryKey })` (registered key, not already selected via a per-model scan, dimension cap via `DIMENSION_MAX_ACTIVE`, total < `MODEL_MAX_CRITERIA`; enters at weight 3 which keeps the budget exact by construction; pre-fills purpose/whyRelevant from the org-locale library content's whenSuitable/fullDefinition as editable documentation starts; audit `criterion.activated` carrying criterionId + libraryKey + derived dimension; clears `models.approval` if set, auditing `model.approvalReopened`); `deactivateCriterion({ criterionId })` (deletes the row's ratings, redistributes its weight points deterministically reusing removeCriterion's existing redistribution helper, audit `criterion.deactivated`, clears approval likewise; NO count floor here, the checklist owns 6-8; wrap with level-shift diffs like removeCriterion did).
- Retired: `addCriterion`, `updateCriterion`, `createModelFromTemplate`, `createEmptyModel`, `seedStandardModel`, `discardModel`, the `model.draft` suggestion kind and its AI drafting path (AI protokoll drafting in `generateCriterionComplianceText` STAYS, re-pointed to library texts for context). New internal `seedDefaultModel` twin for the dev seed (idempotent, explicit orgId/actorId, selects nothing).
- `getModel` wire: `{ modelId, name, approval: { approvedBy, approvedAt } | null, workingConditions: {...} | null, criteria: [{ criterionId, libraryKey, dimensionKey, name, shortUiText, fullDefinition, measures, notMeasures, assessmentQuestion, anchors: [{step, text}] (1/3/5 always, 2/4 when the library has them), weightPoints, order, weightMotivation }], sharedScale, midpoints, dimensions (the four localized dimension blocks), tracks (from trackSchema), levelRules, zoneProfileRules }`. `weightMeanings` is GONE (generic §12.2 semantics come from i18n; the weighting UI already falls back when null, now always).
- `getMethodModel` keeps its compliance machinery; row names/dimension labels localize from library content.
- Demo company: 8 selected keys `["knowledge-depth","knowledge-breadth","complexity-ambiguity","communication-effort","scope-impact","autonomy-mandate","risk-consequence","people-leadership"]`, `DEMO_WEIGHT_POINTS` re-keyed summing exactly 24, `RATINGS_BY_TITLE` re-keyed to those 8 (values unchanged 0-5 in this task; T5 lifts), workingConditions decision seeded `testedNotMaterial` with a Swedish motivation string, `DEMO_ANCHOR_ROLES` expectedLevels mapped into 1-12 (double the old 1-7 roughly: old level n maps to a sensible 1-12 placement; pick per role so the seeded anchors stay plausible against the new thresholds).
- Dashboard minimal: model page renders four dimension sections (headers from wire `dimensions`, criteria grouped by `dimensionKey`); a minimal `LibraryPickerDialog` per section (lists that dimension's unselected library entries: name + shortUiText, an Add button calling activateCriterion, cap errors surfaced as toasts); row menu keeps remove (deactivateCriterion with confirm); the edit dialog and AI criterion drafting UI are deleted; `EnsureDefaultModel` calls `createDefaultModel`; weighting page unchanged except the generic weight-meaning fallback text; method page unchanged reads; the PDF method appendix renders the new wire (names + dimension labels; full redesign is phase 6). New i18n keys in all five locales; retired keys deleted; parity green.

**Steps:**
- [ ] **Step 1:** Backend first, tests-first per area: rewrite tables (final shapes), then model.ts/criteria.ts with the new mutations and retirements, method.ts localization, audit events + payloads + labels (`criterion.activated`/`criterion.deactivated` under the model category by prefix; payload fields labeled in five locales; the libraryKey VALUE renders via a localized value label, reusing the library criterion names, per the coded-value rule), seed/devCompany rework. convex-test suites green package-locally.
- [ ] **Step 2:** Dashboard adaptation (grouped page, picker, deletions, ensure-default-model, i18n). Dashboard suite green.
- [ ] **Step 3:** Delete standardTemplate modules; fix stragglers; full `bun run test` at root green; Biome zero.
- [ ] **Step 4:** Commit `feat!: cut criteria over to library-only selection` (single commit; the `!` marks the breaking data change).
- [ ] **Step 5:** `bun db:reset` against local dev (reseeds the demo world on the new schema; convex dev now pushes clean). Quick sanity: open /model in the browser, confirm sections + picker render.

---

### Task T4: Zones and profile-gated placement in the derivation path

**Files:**
- Modify: `packages/core/src/types.ts` (`CriterionWeight` gains required `dimensionKey: DimensionKey`; `ComputeInput` gains `zoneProfileRules: ZoneProfileRule[]`; `RoleResult` gains `zone: ZoneKey | null`, `profileLimited: boolean | null`, `profileFailures: ProfileFailure[] | null`), `packages/core/src/scoring.ts` (`computeResults` calls `placeRole` for complete roles; incomplete roles carry nulls), `packages/core/src/scoring.fixtures.ts` + tests, `packages/backend/convex/assessment/compute.ts` (pass `dimensionKey: LIBRARY_DIMENSION[row.libraryKey]` and the model's zoneProfileRules), `assessment/results.ts` (wire exposes zone/profileLimited), `payMapping` gap derivation unaffected (levels still key groups), dashboard `role-sheet`/`rating-result`/levels surfaces: tolerate the extra wire fields (render nothing new yet; phase 5 owns display)
- Test: core suites; backend results tests assert zone appears for a complete role

Semantics: exactly `placeRole` as hardened (candidate zone from score level, walk down, WC-exempt profile criteria, cap-never-lift, D admits, failures against the candidate). `assignLevel` keeps its role for the score-implied level inside `placeRole`; `computeResults` no longer calls `assignLevel` directly for complete roles.

- [ ] Steps: failing core tests for the grown output → implement → backend wiring + tests → full gate → Commit `feat(core): derive zones and profile-gated placement in results`.

---

### Task T5: The 1-5 scale cutover

**Files:**
- Modify: `packages/core/src/scoring.ts` (both internal validation call sites swap to `assertValidRatingValue(value, criterion.dimensionKey)`; delete the private `assertValidRating`; `RatingValue` keeps 0 in its union for the workingConditions case), core tests/fixtures (ratings become 1-5; add a WC-0 case), `packages/backend/convex/assessment/ratings.ts` (`setRating`: dimension-aware range via the criterion's libraryKey dimension; motivation REQUIRED when value is 1, 4, or 5, new error code `motivationRequired`; 0 allowed only for a workingConditions criterion), `lib/errors.ts` (+ `motivationRequired`), `assessment/devCompany.ts` (lift every 0 to 1; add a seeded motivation string for every 1/4/5 value so the demo data satisfies its own law), dashboard `components/rating/rating-stepper.tsx` (five options 1-5 built from wire anchors with the shared midpoints at 2/4; a sixth "omfattas inte" (0) option only when `dimensionKey === "workingConditions"`, with its explanation; motivation textarea required at 1/4/5 with inline message before advancing; the criterion's `assessmentQuestion` as the step question; measures/notMeasures as collapsible context per §13.2), rating page copy (i18n "0 till 5" strings become 1-5 wording), all five message files, error translations
- Test: core scale tests; backend setRating validation matrix (0 rejected on non-WC, accepted on WC; motivation enforcement; untouched-motivation edit paths); stepper component tests

- [ ] Steps: core swap tests-first → backend validation matrix tests-first → devCompany data lift → stepper adaptation with tests → i18n sweep (five locales, parity) → full gate → Commit `feat!: cut the assessment scale over to 1-5`.

---

### Task T6: Model approval lifecycle and the materiality decision

**Files:**
- Create: `packages/backend/convex/evaluationModel/approval.ts`
- Modify: `evaluationModel/criteria.ts` + `model.ts` (approval-reset wiring), `evaluationModel/method.ts` or approval.ts (`getMethodChecks` query), `lib/audit.ts` + `lib/auditPayloads.ts` + audit labels (5 locales), `lib/errors.ts` (+ `methodBlocked`, `modelNotApproved`), `assessment/ratings.ts` (the approved-model gate on setRating), `assessment/seed.ts` (demo model approved after selection so seeded rating flows work), dashboard: method page approval card (checklist rows from `getMethodChecks` with localized per-check labels + Approve button + approval state; minimal), rating entry surface shows the unapproved-gate message in words, i18n all five locales
- Test: convex-test lifecycle suite; audit label coverage auto-guards

**Interfaces:**
- `buildMethodCheckInput(ctx, model): Promise<MethodCheckInput>` (one shared builder: criteria rows mapped with `dimensionKey` derived, `documented` = complianceStatus in {documented, approved}... exactly `approved === true` per the spec's blocker (documented + approved), `hasWeightMotivation`, `hasOverlapNotes`, libraryKey; the model's levelRules + zoneProfileRules; `LIBRARY_OVERLAP_PAIRS` as the pair map). Consumed by `approveModel` and `getMethodChecks` so gate and UI can never disagree.
- `setWorkingConditionsDecision({ status, motivation })`: motivation required non-empty; `testedNotMaterial` refused while a workingConditions criterion is selected (deactivate first, coded error `invalidTransition`); audit `model.workingConditionsDecided` with the coded status value labeled in five locales; resets approval if set.
- `approveModel()`: runs the twelve checks; any blocker not ok throws `methodBlocked`; writes `approval: { approvedBy, approvedAt }`; audit `model.approved` (payload: criteria count, dimension shares snapshot as flat stats).
- `updateLevelRules({ levelRules })` + `updateZoneProfileRules({ zoneProfileRules })`: validated by the same engine checks (levelRulesValid / zoneProfileMonotonic as hard errors here), audited as diffs (`model.levelRulesUpdated`, `model.zoneProfileRulesUpdated`), reset approval.
- Approval reset helper `reopenApprovalIfSet(ctx, model, cause)`: deletes the approval field and audits `model.approvalReopened` once; wired into activate/deactivate/rebalanceWeights/setWorkingConditionsDecision/updateLevelRules/updateZoneProfileRules. Compliance saves do NOT reset (spec §2.3).
- `setRating` gains: model must carry `approval` (else `modelNotApproved`).
- New audit events declare subjects: reviewed `null` for model-level events (no model subject kind; the org has one model).

- [ ] Steps: engine-input builder + approval mutations tests-first → gates → dashboard minimal card + i18n (per-check labels under `dashboard.method.checks.*` in five locales) → seed approves demo → full gate → Commit `feat(backend): model approval lifecycle and materiality decision` + `feat(dashboard): minimal approval checklist card` (two commits if cleanly separable, else one).

---

### Task T7: Assessment locking with lock-as-reveal

**Files:**
- Create: `packages/backend/convex/assessment/locking.ts` (lock/unlock/calibrate mutations)
- Modify: `assessment/results.ts` (results wire: score/level/zone only for LOCKED roles; complete-but-unlocked reads `readyToLock: true` with nulls; per-role `assessment` state + derived `methodDrift: lockedAt < approvedAt`), `assessment/ratings.ts` (setRating refused while locked, error `assessmentLocked`), `lib/errors.ts` (+ `assessmentLocked`), audit events + labels (`role.assessmentLocked`/`role.assessmentUnlocked`/`role.assessmentCalibrated`, subject kind `role`), `computePayMappingPreconditions` (evaluated roles must be LOCKED), `assessment/seed.ts` (lock all complete demo assessments so the ladder and pay-mapping preconditions hold), dashboard: role rate flow ends in a "Lås bedömningen" action that triggers the existing reveal (rating-result) after `lockAssessment`; the role page shows locked state + unlock in the row menu (confirm dialog) + the drift chip text when methodDrift; levels surfaces place only locked roles (pending list wording gains ready-to-lock); toasts for lock/unlock; i18n five locales
- Test: locking lifecycle convex-test suite (lock requires completeness + approved model + motivations valid; unlock; calibrate note; setRating refusal; preconditions change); results wire tests; dashboard flow tests

- [ ] Steps: backend lifecycle tests-first → results wire + preconditions → dashboard reveal rewire + i18n → full gate → Commit `feat: assessment locking with lock-as-reveal`.

---

### Task T8: Freeze the full method evidence

**Files:**
- Modify: `packages/backend/convex/payMapping/runs.ts` (frozenModel: criteria `{ libraryKey, name (localized in the org language at freeze), dimensionKey, weightPoints, anchorCount }`, plus `levelRules`, `zoneProfileRules`, `workingConditions`, `approval` snapshot), its tests, `docs/go-live-checklist.md` (the default-thresholds calibration entry updated to name `levelRules`/`DEFAULT_LEVEL_RULES` AND `DEFAULT_ZONE_PROFILE_RULES` as uncalibrated pre-launch constants)
- Test: run-start freeze test asserting the full evidence shape; old frozen fixtures untouched

- [ ] Steps: failing freeze-shape test → implement → checklist doc update → full gate → Commit `feat(backend): freeze the full method evidence in pay-mapping runs`.

---

### Task T9: Reconciliation, retirement, dev reset, browser pass

**Files:**
- Modify: `packages/core/src/weighting.ts` (DELETE `MIN_CRITERIA`; its export leaves the index), `packages/backend/convex/accounts/organization.ts` (onboarding completion no longer gates on criteria count: model building is a post-onboarding journey and approval owns the floor; delete the check), `apps/dashboard/app/(app)/model/page.tsx` (removalFloor logic replaced: removal is always allowed, the checklist communicates 6-8), `lib/errors.ts` + translations (retire `tooFewCriteria` if now unconsumed; verify by grep), `@workspace/constants` suggestions cleanup verification, i18n sweep for orphaned keys (five locales, parity green), memory of the glossary is phase 6 (not here)
- Test: full turbo suite; grep-verified zero references to retired symbols (`MIN_CRITERIA`, `standardTemplate`, `templateKey`, `isCustom`, `complianceEdited`, `addCriterion`, `model.draft`)

- [ ] **Step 1:** Reconciliation edits + orphan sweep, tests green.
- [ ] **Step 2:** Commit `chore!: retire the template-era floors and finish the cutover`.
- [ ] **Step 3:** `bun db:reset`; then the browser pass on http://localhost:3001 against the reseeded org: model page (four sections, 8 selections), picker add + remove (toasts, caps), weighting (budget + generic meanings), method page (twelve-check card, approve, re-open on a weight change, re-approve), rate one role end-to-end on 1-5 (motivation demanded at 1/4/5), lock it (reveal fires), ladder shows 12 levels with only locked roles, start a pay-mapping run (preconditions honest, freeze succeeds), audit log renders every new event/field/value as localized labels (no raw keys), zero console errors. Record findings; fix-or-file each.

---

## Self-review notes (already applied)

- The spec's §10.2 obligations are all placed: scoring swap (T5), MIN_CRITERIA (T9), people-leadership pin (hardening wave), clampLocale consolidation (T1), standardTemplate relocation (T1/T3), go-live entry (T8).
- Decision 8 removes the custom-criterion path everywhere: no task creates criteria outside `activateCriterion`.
- Ordering keeps every commit green: T3 is the only breaking-data commit and ends with the dev reset; T4-T7 each re-run the full gate.

**Phases 3-6 remain out of this plan's scope** (builder journey UX, assessment UX polish, results/calibration surfaces, content closure), planned at their starts per the program pattern.
