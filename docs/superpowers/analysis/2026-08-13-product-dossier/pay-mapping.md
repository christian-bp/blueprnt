# Pay-mapping dossier

Research for the user-docs "pay-mapping" section. Code outranks documents; every
behavioral claim below was checked against the current codebase (2026-08-13).

## Behavior today

**Starting a pay mapping (kartläggning).**
`StartPayMappingDialog` (`apps/dashboard/components/pay-mapping/start-pay-mapping-dialog.tsx`)
is the only entry point: it takes one field, a label, and always stays open and
clickable (never silently disabled). The dialog first reads
`api.payMapping.runs.getPayMappingPreconditions`; while `preconditions.ready` is
false it swaps the label form for `PayMappingPreconditionsPanel`
(`apps/dashboard/components/pay-mapping/pay-mapping-preconditions-panel.tsx`), a
plain-language list of unmet conditions, each a link to where the work happens:
"import people" (when `peopleCount === 0`, links to `/people/import`),
"N people need classifying" (links to `/people/classify`), and "N roles need
evaluating" (links to `/roles`, then up to `MAX_ITEMS` individual role links).
The server (`startPayMappingRun`, `packages/backend/convex/payMapping/runs.ts`)
re-derives the identical check via `computePayMappingPreconditions` and is the
actual authority; the client panel is convenience only.

Preconditions (`computePayMappingPreconditions`, `packages/backend/convex/payMapping/runs.ts`):
ready requires `peopleCount > 0` AND `unclassifiedCount === 0` AND
`unevaluatedRoles.length === 0`. A person is "classified" when they carry a
confirmed (`senioritySource === "confirmed"`) open assignment to an active
(non-archived) role — the same definition used by the people tab's classify
badge. A role is "unevaluated" only if it is staffed (holds at least one open
assignment) and `deriveResults` resolves no level for it; an unstaffed role
never blocks. Archived roles are excluded from both checks.

On submit, `startPayMappingRun`: rejects an empty label
(`errors.invalidInput`), fails the gate with `errors.payMappingPreconditionsUnmet`
if unmet, generates a unique slug from the label, freezes the model config
(`frozenModel`: criteria name/weightPoints/anchorCount, and `levelThresholds`),
derives level/score per role once via `deriveResults`, and inserts one
`payMappingSnapshotRows` document per active person with an open assignment,
copying name, gender, birthDate, employmentType, department, ftePercent,
employmentStartDate, roleTitle, trackKey, seniority, level, score,
basicMonthly, pay components, currency, and payYear as of that instant. It then
computes the org-level gap (`orgGap`, `packages/backend/convex/payMapping/orgGap.ts`)
over the frozen rows and patches `populationCount`, `withPayCount`,
`womenCount`, `menCount`, `orgGapPct`, `orgGapFlag` onto the run row. Toast:
`dashboard.toast.payMappingStarted`. Audit event: `payMappingRunStarted`.

**Run shell and navigation.**
`/pay-mappings/[slug]` and its sub-routes are owned by `PayMappingRunShell`
(`apps/dashboard/components/pay-mapping/pay-mapping-run-shell.tsx`), mounted
once from `[slug]/layout.tsx` so it persists across sub-page navigation (no
re-fetch, no skeleton flash on tab switch). It subscribes to the run
(`getPayMappingRunBySlug`), the gap aggregate (`getPayMappingGap`), the
documentation rows (`listGroupAnalyses`), the work-layer actions and notes
(`listActions`, `listNotes`), and the org's other runs
(`listPayMappingRuns`), and provides them via `PayMappingRunProvider`
(`pay-mapping-run-context.tsx`), which also derives the review queue
(`buildReviewQueue`) once and a `locked` flag (`run.status === "completed"`).
If the slug does not resolve in-org, it shows a not-found message and a link
back to `/pay-mappings`.

Header tabs (`PayMappingTabs`, `apps/dashboard/components/pay-mapping/pay-mapping-tabs.tsx`):
Overview (`/pay-mappings/<slug>`), Analysis (`/pay-mappings/<slug>/analysis`,
lands on the `start` chapter), Actions (`/pay-mappings/<slug>/actions`), Report
(`/pay-mappings/<slug>/report`).

**Overview tab.** `PayMappingOverview`
(`apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx`) is a
KPI-strip-plus-charts dashboard: the population card, the unadjusted org gap
figure (unsigned %, with direction/means in a finding card below), the
equality clock (`EqualityClock`, animated digit boxes deriving hours:minutes:seconds
from `|gap%|` of an 8-hour day), a whole-survey gender donut, a
gender-by-pay-quartile chart (glass-ceiling view, `quartileGenderTallies`),
and an age-by-gender chart. Every widget renders its own real title with
inline help and its own loading/empty state (no page-level skeleton needed
since `PayMappingRunShell` already resolves the queries).

**Analysis tab (Iteration 3/4 "ladder").** `AnalysisSectionShell`
(`apps/dashboard/components/pay-mapping/analysis-section-shell.tsx`), mounted
from `analysis/layout.tsx`, renders the spine (`AnalysisSpine`: overall
done/total + per-chapter bars) and the chapter tab row
(`AnalysisChapterTabs`) once, persisting across chapter pages. The bare
`/analysis` route is a redirect to `/analysis/start` (per ADR-0016, the
former "Läget" index page was removed: it carried finishing and the drawer
but listed no steps of its own).

The four chapters, each its own page rendering `PayMappingAnalysis`
(`apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`) with
`chapter` set to `start` | `praxis` | `equalWork` | `equivalentWork`
(`ANALYSIS_CHAPTERS`, `analysis-chapters.ts`; URL segments are
`start`/`praxis`/`equal-work`/`equivalent-work`):
- **start**: the samverkan (collaboration) step — `ReviewStartStep`, editing
  `participants` and `description` via `setPayMappingCollaboration`.
- **praxis**: one step per applicable praxis review area
  (`PRAXIS_AREA_KEYS`: `payPolicy`, `collectiveAgreements`, `benefits`,
  `payPractices`, `previousActions`) — `ReviewPraxisStep`, each recording a
  `finding` (`none`/`found`) and, when found, requiring a note.
  `previousActions` is applicable only when the org has an earlier
  **completed** run with an earlier `referenceDate` (`applicablePraxisKeys`).
- **equalWork**: one step per group that requires documentation
  (`equalWorkGroupRequiresDocumentation`, i.e. flag != "ok") —
  `ReviewGroupStep`, recording reasons (from `PAY_GAP_REASONS`) and/or a note.
- **equivalentWork**: one step per women-dominated group with at least one
  out-earning comparator (`womenDominatedGroupRequiresDocumentation`) —
  `ReviewGroupStep` again, scoped to the cross-level comparison.

Each chapter page is a two-column master-detail: a checklist (rows built from
the run's real gap/analyses data, capped at `INLINE_ROW_CAP = 8` inline
before falling back to a full sortable `ChapterWorklist` table) beside a
pane that holds exactly one open step, the whole-chapter worklist, or
`PayMappingCompletionPanel` once every remaining row in the chapter is done.
"Mark done and continue" (`advanceAfter`) walks the checklist's flat order
(start, then praxis, then every equalWork row, then every equivalentWork row)
and, if the next remaining row lives on a different chapter page, navigates
there (`router.push(chapterHref(...))`). A `?step=<scope>:<groupKey>` query
param (used by deep links from the Actions tab) pre-selects that group's
step on mount.

A completed run (`locked === true`) makes every documentation step
read-only; only `payMappingActions` status updates remain writable
(ADR-0015: "the plan runs over years").

**Actions tab.** `PayMappingActionsOverview`
(`apps/dashboard/components/pay-mapping/actions-overview.tsx`) is the run's
action-plan workspace (M7), reachable directly from the run's tabs rather
than nested in the analysis, "since the follow-up work happens here long
after the analysis itself is documented." Actions
(`payMappingActions`: problem, plannedAction, optional reason, ownerUserId
resolved from org members, plannedDate, optional estimatedCost, priority
high/medium/low, status notStarted/inProgress/done) and notes
(`payMappingNotes`: free text + type objectiveReason/discussionNeeded/
noActionNeeded) target a group, a person (`personPublicId` only), or one
women-dominated group's specific comparator (`kind: "comparison"`). Content
edits lock with the run (`errors.payMappingRunCompleted`); status changes on
actions stay open on a completed run.

**Report tab.** `PayMappingReport`
(`apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`) is
currently a coming-soon placeholder card (`comingSoonTitle`/`comingSoonBody`),
pending the M8 export slice (signable summary, per-employee/action XLSX
exports, EU Art. 9 filing).

**Completing and reopening a run.** `completePayMappingRun`
(`packages/backend/convex/payMapping/runs.ts`) re-derives the full
requirement set server-side from the frozen snapshot (never trusts the
client's queue): every group in `equalWorkRequired` must be marked done
(orphaned groups, i.e. keys the current entry conditions no longer produce,
are excluded from the required set but their history rows are kept), every
group in `womenDominatedRequired` must be done, every applicable praxis area
must be done, and `collaboration` must have both fields non-empty after
trim. Unmet -> `errors.payMappingGateUnmet`. On success, status ->
`completed`, audit event `payMappingRunCompleted`. `reopenPayMappingRun`
requires `status === "completed"` (else `errors.invalidTransition`), sets
status back to `active`, audit event `payMappingRunReopened`.

**Dashboard to-do integration.** The overview page's to-do list (`apps/dashboard/lib/todo.ts`) surfaces a final `startPayMapping` group with one item, linking to `/pay-mappings`, exactly when the preconditions are met AND no non-completed run already exists (`c.payMappingReady && !c.hasOpenRun`); it renders last, after the model/role blocker groups, since it is the journey's next step once those are cleared (`docs/superpowers/specs/2026-07-23-pay-mapping-preconditions-gate-design.md`).

**List page.** `/pay-mappings` (`PayMappingsSection`,
`apps/dashboard/components/pay-mapping/pay-mappings-section.tsx`) is a
TanStack data table of runs with search/filter, a per-row `...` menu, and the
same `StartPayMappingDialog` as the primary action and as the Empty-state
action. Runs can be renamed (`renamePayMappingRun`, regenerates the slug,
allowed in any status including completed since the label is not frozen
evidence) or deleted (`deletePayMappingRun`, hard-deletes the run and every
child row — snapshot rows, group analyses, actions, notes — child-first; any
status is deletable pre-launch, with the "cannot be undone" warning carried
by the confirm dialog instead of a server-side status gate).

**Erasing a person's snapshot data.** `pseudonymizePersonInSnapshots`
(`packages/backend/convex/payMapping/erasure.ts`) is called on person
erasure: it finds every `payMappingSnapshotRows` row for that
`personPublicId` across every run and sets `erased: true`,
`displayName: ERASED_ACTOR_NAME`, `birthDate: undefined`, while keeping
gender/role/level/pay so the statutory evidence document survives (ADR-0011).

## Terms and history

- **Lönekartläggning / pay mapping (kartläggning, "run")**: the frozen
  survey entity. Table: `payMappingRuns`. Status lifecycle: `active`,
  `paused`, `underReview`, `completed` (`payMappingRunStatus`,
  `packages/backend/convex/payMapping/tables.ts`; ADR-0011). Note: the UI code
  currently exercises only `active` <-> `completed`; no surface reviewed
  writes `paused` or `underReview`.
- **Referensdatum / reference date**: the instant the population and pay are
  frozen at (`referenceDate`, = `initiatedAt` in this slice).
- **Datalagret / work layer**: ADR-0011's two-layer model. The data layer
  (pay, role, demographics, model config) freezes once and is immutable; the
  work layer (group analyses, actions, notes, collaboration) is mutable and
  locks only when the run completes.
- **Lika arbete / equal work**: Diskrimineringslagen 3 kap. 8-9 §'s first
  comparison. Grouping key: `roleTitle | level` (`equalWorkGroupKey`,
  `packages/backend/convex/payMapping/gap.ts`). **Seniority is explicitly
  NOT part of the key** (ADR-0017, superseding the earlier
  `roleTitle | level | seniority` key): splitting on seniority hid 96 people
  in singleton groups and double-counted individual variation that the
  reasons taxonomy already covers (Erfarenhet/Experience is a reason, not a
  grouping axis).
- **Likvärdigt arbete / equivalent work**: 3 kap. 9-10 §'s second and third
  comparisons. In this codebase, "equivalentWork" denotes the per-level
  grouping (key = `level` alone) plus the women-dominated cross-level
  comparison (`womenDominatedComparisons`); the UI's "Likvärdigt" chapter is
  the women-dominated worklist.
- **Könsdominans / women-dominance**: `WOMEN_DOMINANCE_THRESHOLD = 0.6`
  (`packages/core/src/pay-gap.ts`), `isWomenDominated(women, men)`. DO
  practice ("brukar anses"), not statute.
- **Flag levels**: `critical` (magnitude > 10%), `elevated` (5% <= magnitude
  <= 10%), `ok` (magnitude < 5%), `insufficient` (a gender is absent or the
  gap is undefined) — `classifyPayGap`, `packages/core/src/pay-gap.ts`. These
  are distinct from the entry-condition outcomes below and from the 60%
  women-dominance threshold; the docs must never conflate the three.
- **Entry-condition outcomes (ADR-0015)**: `classifyEqualWorkGroup`
  (`packages/core/src/pay-analysis.ts`) returns one of `shown` (both genders
  present, women trail on base or, if `tccDriven`, on TCC), `reverse` (women
  lead on both metrics; shown only in a low-key info view, no flag, no
  documentation duty), `genderPure` (2+ members of one gender only; opt-in
  deep-dive, out of the primary flow and the gate), `singleton` (fewer than 2
  members total; silently dropped except for a surfaced count).
- **Grundlön vs TCC**: base salary (FTE-adjusted monthly, `baseComp`) is the
  primary group measure; total comp (`tccComp`, base + components) rides
  parallel. A group whose base gap is zero/reversed but whose TCC gap is
  positive is admitted anyway and marked `tccDriven` (ADR-0015).
- **Sakligt skäl / objective reason**: `PayGapReason`
  (`packages/constants/src/payGapReasons.ts`), grouped `market`
  (alternativeLabourMarket, recruitmentPayLevel, geographicDifferentiation,
  retention), `individual` (experience, historicalPay, competence,
  performance), `work` (responsibility).
- **Samverkan / collaboration**: the DL 3 kap. 11-14 § co-determination
  record (`participants`, `description`) on the run itself, edited via the
  "start" step.
- **Praxisområden / praxis review areas**: `PRAXIS_AREA_KEYS`
  (`payPolicy`, `collectiveAgreements`, `benefits`, `payPractices`,
  `previousActions`) — DL 3 kap. 8 § punkt 1 (bestämmelser och praxis).
- **Tvärnivå / cross-level pair (superseded, twice)**: the design went through
  three shapes before settling. The 2026-07-16 slice (`docs/superpowers/specs/
  2026-07-16-analysis-documentation-and-scatter-design.md`) shipped
  `womenDominatedComparisons`, a **group**-vs-**group** comparison (a
  women-dominated group against every equally-or-lower-valued group that
  out-earns it). The 2026-08-06 Iteration 2 plan
  (`docs/superpowers/plans/2026-08-06-iteration-2-analysis-views-rebuild.md`)
  proposed replacing it with an individual-level per-woman pair check
  ("tvärnivå") aggregated per woman with an expandable pair list; Iteration 3
  (`docs/superpowers/plans/2026-08-06-iteration-3-analysis-ladder.md`)
  carried a non-gated "tvärnivå" drawer item for this. Neither the per-woman
  pair engine nor a "tvärnivå" i18n key exists in the current codebase (grep
  clean): the group-vs-group `womenDominatedComparisons`/`ComparatorTable`
  design shipped instead and is what `actionTargetValidator`'s `"comparison"`
  kind targets today (`packages/backend/convex/payMapping/tables.ts` comment:
  "It replaces the former 'pair' kind" refers to this same simplification).
  Docs must describe only the shipped group-vs-group comparator table, never
  an individual cross-level pair check.
- **ADR-0014 renames** apply throughout this section's older sources: what
  ADR-0008/0011/0012 call **"band"** is today **level** (code `level`; level
  1 is highest); what those documents call an individual's **"level"** is
  today **seniority** (code `seniority`); the anchor scale's positions are
  **steps**. This dossier already translates every claim into current terms;
  any pre-2026-08-05 source document must be read with that substitution.

## Rationale

- **Live model, frozen run (ADR-0002, ADR-0008, ADR-0011).** Score and level
  are never stored for the live workspace; a pay-mapping run is the one
  place scores/levels ARE stored, because it is a local, immutable copy tied
  to the run, not a model version. Reproducibility requires freezing both
  the input data (pay, role, demographics) AND the model/ratings that
  produced level/score, not just the outcome — ADR-0008 extended this
  because "freezing only the outcome preserves the number, not why."
- **Org-per-legal-entity (ADR-0007).** A pay mapping compares within one
  employer, matching how the law scopes "lika/likvärdigt arbete"; no
  cross-organization rollup is built, by design.
- **P1 gender gap is the mandatory primary view (ADR-0012).** Kön-mot-kön
  for lika and likvärdigt work cannot be turned off; it is the survey's
  legally required, always-on starting point. Four flags share one pure
  helper (`classifyPayGap`) so the backend query and the UI can never
  disagree. Minimum group size for the ⚪/masking rule was originally 4,
  matching the small-cell EXPORT boundary; ADR-0012's 2026-07-16 addendum
  split that: in-app, HR already sees every salary, so masking by size adds
  no protection and only hid signal — the export boundary (M8, unbuilt) is
  where the >=4-total/>=2-per-gender rule will apply.
- **Entry conditions replace the ⚪ presentation (ADR-0015).** Showing a
  group with no real comparison as "insufficient, please document" produced
  noise and forced HR to "document" groups where no comparison existed.
  Singletons and gender-pure groups carry no documentation duty; the
  women-behind direction rule matches the law's actual target (an unfair
  disadvantage to women), while an org-level EU aggregate keeps the
  bidirectional reading because it is a different kind of figure (a
  headline metric, not a gated group view).
- **Group key drops seniority (ADR-0017).** Measured against a real
  snapshot: keying on `title · level · seniority` produced 57 groups, 46 of
  them gender-pure, with 96 people excluded from any real comparison; keying
  on `title · level` alone produced 38 groups, only 19 gender-pure. DL 3 kap.
  8 § is about the work, not the worker's tenure in it; seniority already has
  a home as a documented reason inside a group.
- **Full-screen wizard vs normal layout (ADR-0016).** A full-screen takeover
  is reserved for single-commit transactions with no valid partial state
  (onboarding, the two import wizards). The pay-mapping review journey is
  incrementally saved (each documentation click persists) and spans weeks to
  years (action follow-up), so it belongs in normal layout with the app's
  own navigation intact — the prior `/review` full-screen route was removed
  entirely (no redirect shim, pre-launch "no legacy" policy) and its
  responsibilities folded into the Analysis tab's chapter pages.
- **GDPR pseudonymize-not-retain on the frozen snapshot (ADR-0011).** The
  frozen kartläggning is itself evidence for a DO audit or legal dispute, so
  erasure pseudonymizes the individual's identity fields in every snapshot
  row rather than hard-deleting the row, while all live person data (people/
  payRecords/personAssignments/users/Better Auth) still gets a true hard
  delete. This is a scoped, confirmed exception to the "always hard delete a
  person" invariant.
- **AI never touches this surface's numbers.** Gap/level math and the
  entry-condition classification are pure `packages/core` functions
  (`packages/core/src/pay-gap.ts`, `pay-analysis.ts`); no AI call is wired
  into the analysis or gate path (ADR-0003's boundary; confirmed by the
  absence of any AI/action import in `payMapping/gap.ts`, `analyses.ts`,
  `runs.ts`).

## Edge cases and error states

- **Preconditions unmet at start.** Dialog shows `PayMappingPreconditionsPanel`
  instead of the form (never a disabled button): empty population -> link to
  import; unclassified people -> link to classify; unevaluated staffed roles
  -> link to roles register, plus up to `MAX_ITEMS` individual role links.
  Submitting anyway (a race) surfaces `errors.payMappingPreconditionsUnmet`
  ("People or roles are missing classification or evaluation, so the pay
  mapping cannot start yet.") — thrown in `startPayMappingRun`
  (`packages/backend/convex/payMapping/runs.ts:157`).
- **Empty label.** `errors.invalidInput` ("Invalid input.") — thrown for a
  blank/whitespace-only label in `startPayMappingRun`, and reused by
  `renamePayMappingRun`, `createAction`/`updateAction` (blank problem or
  plannedAction), `upsertGroupAnalysis` (praxis reasons submitted when none
  are allowed), and `notes.ts` create/update (blank text).
- **Editing a completed (locked) run.** `errors.payMappingRunCompleted`
  ("The pay mapping is completed and locked. Reopen it to edit.") — thrown by
  `setPayMappingCollaboration`, `upsertGroupAnalysis`, `createAction`,
  `updateAction`, `deleteAction`, and every notes mutation, whenever
  `run.status === "completed"`. `setActionStatus` is the one work-layer
  mutation that does NOT check this (status updates stay open post-completion
  by design).
- **Completing with unmet requirements.** `errors.payMappingGateUnmet`
  ("Steps remain in the review before the pay mapping can be completed.") —
  thrown by `completePayMappingRun` when any required equalWork/
  equivalentWork group lacks a done analysis row, any applicable praxis area
  is undone, or collaboration is unfilled.
- **Marking a group done without documentation.**
  `errors.payMappingDocumentationRequired` ("Add an objective reason or a
  deepened analysis before marking the group done.") — thrown by
  `upsertGroupAnalysis` in three cases: (1) a praxis row marked done with no
  `finding` set (carried-forward or supplied); (2) a praxis row with
  `finding: "found"` and an empty note; (3) an equalWork/equivalentWork row
  in the `required` set marked done with zero reasons AND an empty note.
- **Reopening a non-completed run, or completing a non-active one.**
  `errors.invalidTransition` ("That status change is not allowed.") —
  `completePayMappingRun` requires `status === "active"`;
  `reopenPayMappingRun` requires `status === "completed"`.
- **Run/action/note/group not found or cross-org.** `errors.notFound`
  ("Not found.") — every mutation that loads a run, action, or note checks
  `row.orgId !== ctx.orgId` and treats a foreign-org id identically to a
  missing one (tenant isolation). `getPayMappingRunBySlug` and
  `getPayMappingGap` instead return `null` on the same condition (queries
  degrade gracefully; mutations throw).
- **Targeting an invalid group/comparison.** `errors.notFound` from
  `validateTarget`/`workLayer.ts` when an action or note's `target.groupKey`
  (or `comparisonKey`) does not match a real group in the run's current
  entry-conditioned groups (`allowExcludedGroups: false` for actions/notes
  created by the current UI paths).
- **Owner not a member.** `assertOwnerIsMember` throws when
  `createAction`/`updateAction`'s `ownerUserId` is not a current org member
  (a stale reference after someone leaves the org); surfaced as a plain
  thrown error, not a translated `errors.*` code as of this review.
- **No priced rows in the run.** `PayMappingAnalysis` shows the house `Empty`
  state (`dashboard.payMapping.gap.empty`) with a link back to Overview when
  `gap.currency === null` (nobody in the frozen snapshot has a known salary).
- **Orphaned documentation rows.** If the entry conditions later exclude a
  group that already had a documentation row (e.g. because the run's
  underlying grouping rules changed — historically ADR-0017's regrouping),
  `completePayMappingRun` filters `doneKeys` down to keys that still exist
  in `keys.equalWorkAll`/`womenDominatedAll`; the orphaned row stays stored
  as history but never counts toward completion.
- **Action/note targeting a person who was later erased.** Individual
  targets carry only `personPublicId`; display values resolve from the
  snapshot row, which `pseudonymizePersonInSnapshots` already tombstones, so
  an erased person's action/note renders with the tombstoned name
  automatically. Noted gap (tracked in `docs/go-live-checklist.md`, not yet
  built): the action/note rows themselves have no erasure hook, so free text
  in `problem`/`plannedAction`/note text could still name a person after
  their data is erased elsewhere.
- **Deleting a run.** Confirm dialog carries a "cannot be undone" warning
  (no server-side status gate); any status, including `completed`, is
  deletable pre-launch.

## Deliberately absent

- **Report/export (M8).** The Report tab is a placeholder card; no PDF/XLSX
  generation, no EU Art. 9 filing, no union/employer co-sign flow exists yet
  (`docs/pay-mapping-analysis-teardown-and-plan.md` F6; confirmed by
  `pay-mapping-report.tsx`'s coming-soon body).
- **Export-boundary small-cell masking.** The stricter minimum (>= 4 people
  total AND >= 2 per gender before a group mean is exposed) is documented
  (ADR-0012's 2026-07-16 addendum) but not implemented anywhere in the
  current query/report code; it is deferred to the M8 export slice and
  tracked in `docs/go-live-checklist.md`.
- **Bestämmelser och praxis as a full document, and samverkan depth.** The
  research doc (`docs/lonekartlaggning-process-och-kravbild.md` §10) flagged
  that the tool's "praxis" chapter and "samverkan" step are the minimum
  viable capture (finding + note; participants + description); a fuller
  guided walkthrough of pay policy/collective-agreement documentation was
  explicitly named as a design gap to close, not yet built beyond the
  current one-step-per-area shape.
- **Adjusted (regression-decomposed) gap.** Explained-vs-unexplained gap
  decomposition (age, tenure, level factors) is analysed as a future F7 item
  in the teardown doc; no such computation exists in `packages/core` today.
  Deliberately deferred over false-precision risk on small orgs.
  Note: `docs/lonekartlaggning-process-och-kravbild.md` §2 records this as
  the still-open "unexplained residual" framing, separate from what the
  shipped gap engine computes.
- **Access/export view-logging.** ADR-0011 originally proposed logging every
  view/export of a snapshot; the 2026-07-13 addendum deferred this to the
  future export/report module (M8) since the current domain audit log
  already covers changes, and a per-view log at every read adds no
  protection today. Not built.
- **Third gender/non-binary value.** ADR-0010 confirms the system stays
  strictly binary (Man/Kvinna); non-binary import values are flagged for
  manual assignment, never mapped to a new value. A deliberate product
  decision, not a gap.
- **Praxis/samverkan lönekartläggning moment 1 (Bestämmelser och praxis) as
  a separate first-class module** beyond the current fixed-area checklist —
  the research doc calls for a fuller guided review; today's five
  `PRAXIS_AREA_KEYS` steps are the shipped subset.
- **Erasure hook for action/note free text targeting a person.** Explicitly
  named as unbuilt in ADR-0015 point 7 and tracked as a go-live checklist
  item, same pattern as the `payMappingRuns.collaboration` participant-name
  exception.
- **The full-screen guided review journey** (`/pay-mappings/[slug]/review`,
  `PayMappingReview`, `ReviewProgress`, `ContinueReviewItem`,
  `ReviewChapterIntro`) was built, then deliberately removed (ADR-0016) with
  no redirect shim; its logic is now the Analysis tab's chapter pages. Docs
  must never describe a `/review` route.
- **Bulk report/export of multiple runs, or a run-comparison view** — ADR-0011
  names a future "dedicated list view ... and a comparison view between two
  kartläggningar" as not built yet ("Byggs inte nu").
- **Recruitment pay-range disclosure, Art. 7 employee self-service, and the
  joint pay assessment (gemensam lönebedömning) 5%-trigger case workflow** —
  all three named as explicitly out-of-scope "deferred entities (reserved,
  not built)" in the original V2 design
  (`docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` §11); the
  data model leaves room for each but none exists in the current schema.
  Art. 7 in particular introduces an employee-facing user, which the app
  does not have (HR-only audience).
- **Employer-size reporting cadence/thresholds** (< 100 employees: no
  mandatory gap report; 100-249: every 3 years; 250+: annually, per the
  original design's reading of the Directive) are not implemented anywhere:
  no code gates a surface on `employeeCount` for cadence. The Swedish DL's
  own annual lönekartläggning duty for all 10+ employers is unaffected and
  is not itself enforced by the product (the tool assumes HR starts a run
  when their own duty requires it).
- **A per-woman individual cross-level pair check ("tvärnivå")** was designed
  in Iteration 2/3 (see Terms and history) as a possible upgrade to the
  shipped group-vs-group women-dominated comparison, then not built; the
  group-level comparator table is the final, shipped shape.
- **A supplementary/non-gating drawer surfacing the excluded-groups analysis
  (women-ahead groups, the gender-pure deep-dive, the singleton note) as one
  standalone accordion component** was built in Iteration 3
  (`SupplementaryAnalysis`, `docs/superpowers/plans/2026-08-06-iteration-3-analysis-ladder.md`)
  then folded away when the "Läget" index page it lived on was deleted in
  Iteration 4; the underlying classifications (`reverse`, `genderPure`,
  `singleton` in `packages/core/src/pay-analysis.ts`) still exist and are
  used inline by `pay-mapping-analysis.tsx`, but no dedicated
  `SupplementaryAnalysis`/`CrossLevelSection`/`EquivalentWorkLevelAnalysis`
  component file exists in the current codebase (grep clean).

## Sources read

- `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md`
- `.superpowers/sdd/00-overview/section-pages.md`
- `docs/lonekartlaggning-process-och-kravbild.md`
- `docs/pay-mapping-analysis-teardown-and-plan.md`
- `docs/adr/0007-legal-entity-reporting-dimension.md`
- `docs/adr/0008-frozen-report-run-snapshot.md`
- `docs/adr/0010-import-format-expansion-csv-only.md`
- `docs/adr/0011-kartlaggning-livscykel-fryst-datalager.md`
- `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md`
- `docs/adr/0015-instegsvillkor-och-atgardslager.md`
- `docs/adr/0016-helskarmsflode-eller-vanlig-layout.md`
- `docs/adr/0017-jamforelsegrupp-utan-senioritet.md`
- `docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` (V2 salary
  import + lönekartläggning design spec: the deferred-entities list, the
  original employer-size cadence reading, decision log incl. the original
  masking default of 3)
- `docs/superpowers/specs/2026-07-04-v2-plan-coverage-audit.md` (coverage
  audit of the above spec against the codebase as it stood 2026-07-04;
  historical, superseded by the current codebase)
- `docs/superpowers/specs/2026-07-12-pay-mapping-snapshot-design.md` (M3
  snapshot design: schema-level detail behind the current freeze flow)
- `docs/superpowers/specs/2026-07-13-p1-gender-gap-view-design.md` (original
  P1 gap engine design: `MIN_GROUP_SIZE = 4`, later removed per the
  ADR-0012 2026-07-16 addendum already cited in Rationale)
- `docs/superpowers/specs/2026-07-13-staged-survey-detail-design.md`
  (Överblick/Analysera/Rapport staging + the equality clock's origin;
  documents the routed-sub-pages and widget-grid revisions that produced
  today's Overview tab)
- `docs/superpowers/specs/2026-07-16-analysis-documentation-and-scatter-design.md`
  (M6 documentation workflow + completion gate + the original group-vs-group
  women-dominated comparison + the scatter; source of the entry-condition
  outcomes cited in Terms and history)
- `docs/superpowers/specs/2026-07-22-guided-pay-mapping-review-journey-design.md`
  (the guided wizard redesign: praxis chapter, samverkan step, the review
  queue; later superseded by Iteration 3/4, see Deliberately absent)
- `docs/superpowers/specs/2026-07-22-pay-mapping-summary-steady-state-design.md`
  (the full-screen takeover wizard + master-detail summary design, itself
  later superseded by Iteration 3's deletion of `/review`)
- `docs/superpowers/specs/2026-07-23-pay-mapping-preconditions-gate-design.md`
  (source of the preconditions gate and the dashboard to-do's
  `startPayMapping` group cited in Behavior today)
- `docs/superpowers/plans/2026-07-12-pay-mapping-snapshot.md` (implementation
  plan for the M3 snapshot spec; read, nothing new beyond the spec)
- `docs/superpowers/plans/2026-07-13-p1-gender-gap-view.md` (implementation
  plan for the P1 gap-engine spec; read, nothing new beyond the spec)
- `docs/superpowers/plans/2026-07-13-staged-survey-detail.md` (implementation
  plan for the staged-survey spec; read, nothing new beyond the spec)
- `docs/superpowers/plans/2026-07-16-analysis-documentation-and-scatter.md`
  (implementation plan for the M6 documentation/gate/scatter spec; read,
  nothing new beyond the spec)
- `docs/superpowers/plans/2026-07-22-guided-pay-mapping-review-journey.md`
  (implementation plan for the guided-journey spec; read, nothing new beyond
  the spec)
- `docs/superpowers/plans/2026-07-22-takeover-wizard-and-summary.md`
  (implementation plan for the takeover-wizard spec; read, nothing new
  beyond the spec)
- `docs/superpowers/plans/2026-08-06-iteration-2-analysis-views-rebuild.md`
  (master plan for entry conditions, the reason taxonomy, and the M7
  actions/notes layer; source of the "Systemnoteringar" deltas and the
  original per-woman tvärnivå proposal cited in Terms and history)
- `docs/superpowers/plans/2026-08-06-iteration-2-c2-level-analysis.md`
  (per-level likvärdigt detail view + reason-taxonomy additions
  `geographicDifferentiation`/`retention`, confirmed present in
  `packages/constants/src/payGapReasons.ts`)
- `docs/superpowers/plans/2026-08-06-iteration-3-analysis-ladder.md`
  (the four-rung analysis restructure: spine, chapter worklist, completion
  panel, evidence disclosure, the supplementary drawer, and the deletion of
  `/review`; source of the `SupplementaryAnalysis` history in Deliberately
  absent, cross-checked against the current component list)
- `docs/superpowers/plans/2026-08-07-iteration-4-analysis-chapters-as-pages.md`
  (the four chapters become their own routed pages, and the short-lived
  "Läget" index page is deleted; cross-checked against
  `analysis-chapters.ts`'s and `analysis/page.tsx`'s current code comments,
  which confirm this exact history)
- `docs/superpowers/analysis/2026-07-01-v2-readiness-report.md` (pre-design
  V2 readiness assessment; read, nothing new beyond the later spec)
- Code: `apps/dashboard/app/(app)/pay-mappings/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/layout.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/analysis/layout.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/analysis/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/analysis/start/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/analysis/equal-work/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/analysis/equivalent-work/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/actions/page.tsx`,
  `apps/dashboard/app/(app)/pay-mappings/[slug]/report/page.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-run-shell.tsx`,
  `apps/dashboard/components/pay-mapping/analysis-section-shell.tsx`,
  `apps/dashboard/components/pay-mapping/analysis-chapters.ts`,
  `apps/dashboard/components/pay-mapping/pay-mapping-tabs.tsx`,
  `apps/dashboard/components/pay-mapping/review-queue.ts`,
  `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`,
  `apps/dashboard/components/pay-mapping/start-pay-mapping-dialog.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-preconditions-panel.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-run-context.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mappings-section.tsx`,
  `apps/dashboard/components/pay-mapping/equal-work-detail.tsx` (grep only),
  `apps/dashboard/components/pay-mapping/chapter-worklist.tsx`,
  `apps/dashboard/components/pay-mapping/pay-mapping-completion-panel.tsx`,
  `apps/dashboard/components/pay-mapping/analysis-chapters.ts`,
  `apps/dashboard/components/pay-mapping/comparator-table.tsx`,
  `apps/dashboard/components/pay-mapping/review-group-step.tsx`,
  `apps/dashboard/lib/todo.ts`, `apps/dashboard/components/overview/todo-actions.tsx`,
  `packages/backend/convex/payMapping/tables.ts`,
  `packages/backend/convex/payMapping/runs.ts`,
  `packages/backend/convex/payMapping/gap.ts`,
  `packages/backend/convex/payMapping/orgGap.ts`,
  `packages/backend/convex/payMapping/actions.ts`,
  `packages/backend/convex/payMapping/analyses.ts`,
  `packages/backend/convex/payMapping/erasure.ts`,
  `packages/backend/convex/lib/errors.ts`,
  `packages/core/src/pay-gap.ts`, `packages/core/src/pay-analysis.ts`,
  `packages/constants/src/praxisAreas.ts`,
  `packages/constants/src/payGapReasons.ts`,
  `packages/i18n/messages/en.json` (errors + dashboard.payMapping + dashboard.toast + dashboard.help namespaces, grep).
