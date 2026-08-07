# Iteration 3: the analysis ladder

> **For agentic workers:** each slice is sized for its own build cycle and ends Biome-clean, typecheck-clean and test-clean. Slices 1 to 4 do not touch the completion gate. Slice 7 only runs after ADR-0016 is in place.

**Goal:** Make the pay-mapping analysis surface feel step-by-step and structured instead of overwhelming, and make it the single surface for the statutory journey.

**Architecture:** The page becomes a ladder of four rungs (progress, chapter, step, evidence) where exactly one thing is open at each rung, so attention descends one level at a time and never fans out sideways. Everything that does not affect completion lives in one drawer whose heading says exactly that. Everything that does affect completion is reachable through exactly one door (ADR-0016).

**Tech stack:** unchanged. Next 16 App Router, Convex, TanStack Table v9, Base UI via `@workspace/ui`, Motion, next-intl in five locales.

## Global constraints

- **No backend change in this programme.** No schema change, no new mutation, no new audit event, no change to `payMappingRunStatus`. If a slice appears to need one, it is out of scope and gets its own plan.
- **The gate math is untouched.** `buildReviewQueue`, `isStepDone`, `isActionable`, `progress`, the client Complete button's disabled rule and `completePayMappingRun`'s server re-check are not modified by any slice. Slice 5 hoists where the queue is built, never how.
- **No group may silently disappear from the UI.** Slice 4 ships the invariant test: the union of rows rendered across the whole surface equals `gap.equalWork` + `gap.womenDominated` + `excluded.reverse` + `excluded.genderPure`, with `excluded.singletonCount` accounted for in the set-aside line.
- All new copy lives in i18n in en/sv/nb/da/fi, Nordic values flagged as drafts for native review (extend the existing go-live entry).
- Animations follow `docs/ui-animation.md`. Collapses split outer geometry from inner box model; exits stage fade before collapse; `MotionConfig reducedMotion="user"` is never bypassed.
- Every new surface ships its content-shaped skeleton, and controls whose labels are static i18n text render as real components while data loads.

## Resolved decisions

1. **`/review` is deleted, with no focus mode.** ADR-0016 records the rule: a full-screen takeover is for transactions (onboarding, imports), incremental persisted work lives in the normal layout, and distraction-free is a shell-level affordance if we ever want it, never a duplicated flow.
2. **The tvärnivå check is not gate-wired**, and it gets two mandatory touchpoints instead: the drawer's first item carries its case count in brand ink whenever `cases > 0`, and the completion panel lists it as a non-blocking observation right where the user is about to finish ("N tvärnivåfall är identifierade och inte genomgångna. De hindrar inte slutförande."). The statute names group comparisons, not individual cross-level pairs; gating our own operationalisation would turn an analytical aid into a duty the law does not name at that granularity, and would change `progress.overall.total` for every existing org. Revisiting this is a queue decision with its own ADR.
3. **Analysis owns chapter progress and Complete/Reopen.** `PayMappingJourneyCard` is demoted to an overall progress line plus one CTA into Analysis; the four-chapter breakdown and the Complete/Reopen controls live in `PayMappingCompletionPanel` on Analysis. Overview becomes purely communicative (Läget plus the statistics charts).
4. **Samverkan is a read-only strip on the spine.** Participants plus a Change link that opens the start step, with help text stating plainly that the strip shows what was recorded at the start and does not by itself discharge the 11-12 §§ duty at this step. A per-chapter samverkan record is a separate product slice with its own mutation, audit event and copy.

Derived decisions (settled here, not open):

5. **The spine does not reuse `WizardProgress`.** Verified: it renders an unconditional `<Spinner>` and clamps its bar monotonically (`setPct(current => Math.max(current, ...))`), so it cannot move backwards when a user un-marks a step. Both are wrong for a steady-state gate readout. The spine is built directly on `Progress` plus `NumberFlow`.
6. **The checklist stays a visible search field**, never a command palette. This user opens the app once a year.
7. **Evidence is collapsed inside its step, never moved out of it.** The task on that screen is writing a sakligt skäl that survives a DO review, so the member table and the underlying data must remain on that screen. The member table also carries the per-row documentation menu, and its default sort puts the lowest-paid members first, so an excerpt would mean documenting against a systematically skewed subset.
8. **Non-required groups never enter the queue.** `buildReviewQueue` computes progress by filtering `kind === "group"` with no required flag; folding non-required groups in would inflate `overall.total` and leave `completePayMappingRun` throwing for every org. They render as ordinary worklist rows labelled "No duty", openable, never counted.
9. **Singleton rows are not built.** `ExcludedGroupsWire.singletonCount` is a bare number on the wire; rendering rows would need an engine change plus a backend gap change plus tests in both. The set-aside line states the count in words instead.

## The structure

```
RUNG 0  AnalysisSpine
        Pay-mapping analysis            12 of 31 documented   (?)
        progress bar
        one sentence: four chapters, all must be done to complete
        Samverkan: <participants>  ·  Change                  (?)

RUNG 1  checklist (320px, sticky, height-capped)   RUNG 2  the pane, one of four states
        search + All/Remaining                             1  NextStepPanel (landing)
        1 Samverkan          done                          2  ChapterWorklist
        2 Praxis             5/5                           3  one step + ChapterBar
        3 Lika arbete        1/4  (open)                   4  PayMappingCompletionPanel
          rows, max 8, then "Show all N as a list"
        4 Likvärdigt         0/21                  RUNG 3  EvidenceDisclosure inside the step
        Complete the mapping   locked · 19 left

RUNG 4  SupplementaryAnalysis
        "Further analysis · does not affect completion"     (?)
        tvärnivå (count in brand ink) · pay by level · women ahead ·
        single-gender groups · one-person job titles
```

## File structure

Created:
- `apps/dashboard/components/pay-mapping/analysis-spine.tsx` (+ test): progress, description, samverkan strip.
- `apps/dashboard/components/pay-mapping/next-step-panel.tsx` (+ test): the calm landing state.
- `apps/dashboard/components/pay-mapping/supplementary-analysis.tsx` (+ test): the one drawer.
- `apps/dashboard/components/pay-mapping/evidence-disclosure.tsx` (+ test): the collapse inside a step.
- `apps/dashboard/components/pay-mapping/chapter-worklist.tsx` (+ test): the register table per chapter.
- `apps/dashboard/components/pay-mapping/chapter-bar.tsx` (+ test): position plus the statutory sentence.
- `apps/dashboard/components/pay-mapping/pay-mapping-completion-panel.tsx` (+ test): one completion component.

Renamed: `pay-mapping-summary.tsx` to `pay-mapping-analysis.tsx` (slice 7), with the checklist column and the pane extracted as they grow.

Deleted (slice 7): `app/(app)/pay-mappings/[slug]/review/page.tsx`, `pay-mapping-review.tsx`, `review-progress.tsx`, `continue-review-item.tsx`, `review-finish.tsx`, `review-chapter-intro.tsx` (its only consumer is the wizard; its copy survives as the chapter bar's help body), and the `sub === "review"` branches in `pay-mapping-tabs.tsx` and `pay-mapping-run-shell.tsx`.

Unchanged components with unchanged call sites: `ReviewStartStep`, `ReviewPraxisStep`, `ReviewGroupStep`, `GroupMemberTable`, `WomenDominatedUnderlyingData`, `PayGapDotPlot`, `PayMappingScatter`, `PayMappingGroupAnalysisForm`, `EqualWorkDetail`, `CrossLevelSection`, `EquivalentWorkLevelAnalysis`, `GenderPureDeepDive`, `WomenAheadGroups`.

## Slice 1: calm the first screen

Highest perceived improvement, lowest risk, gate untouched.

**Files:** create `analysis-spine.tsx`, `next-step-panel.tsx`; modify `pay-mapping-summary.tsx`.

- Delete the `firstUndone` landing branch (`const openStep = selected ?? (locked || gateMet ? null : firstUndone?.openStep ?? null)`); the landing state becomes `NextStepPanel`, which shows the chapter position, the next undone row's label, its one-sentence finding, one primary button and "N steps left after this one". No chart, no table, no form.
- `AnalysisSpine` renders `Progress` plus `NumberFlow` for the done count in a pre-reserved `tabular-nums` slot, one description line, a `HelpMorphButton` on lika arbete / likvärdigt arbete, and the read-only samverkan strip (decision 4). The h3 focus target (`headingRef`, `tabIndex={-1}`, `outline-none`) moves onto the spine heading.
- `ContinueReviewItem` moves into the spine's right slot until slice 7 deletes it.
- Replace the fixed four-line skeleton with a content-shaped one: real spine chrome with the count slot reserved, real search field and filter, row placeholders.
- Replace the `gap.currency === null` one-liner with `PayMappingPreconditionsPanel` inside the house `Empty` primitive.
- Add `scrollIntoView({ block: "start" })` to the existing `focusPaneContainer` callback ref.

**Tests:** rewrite the landing-default block in `pay-mapping-summary.test.tsx`; new tests that the landing renders no form and no chart, that the spine count matches `queue.progress.overall`, and that the samverkan strip renders participants read-only.

**i18n:** roughly 12 leaves under `dashboard.payMapping.analysis.*` plus one help pair.

## Slice 2: one drawer

**Files:** create `supplementary-analysis.tsx`; modify `pay-mapping-summary.tsx`, `equivalent-work-level-analysis.tsx`, `excluded-groups-sections.tsx`, `cross-level-section.tsx`.

- Move `CrossLevelSection`, `EquivalentWorkLevelAnalysis`, `WomenAheadGroups`, `GenderPureDeepDive` and `SingletonNote` into five `AccordionSection` items inside one single-open `Accordion`, in that fixed order, each with its count in the meta slot.
- Delete every bespoke Show/Hide control: the dashed-border `Collapsible` in `equivalent-work-level-analysis.tsx` and both `CollapsibleTrigger`s in `excluded-groups-sections.tsx`.
- Drop `hideWhenEmpty`; an empty item renders a plain sentence instead of vanishing, so the user can see that the check ran.
- The cross-level item is first and its count renders in brand ink whenever `cases > 0` (decision 2, mandatory).
- The drawer heading is "Further analysis · does not affect completion", never "not required by law": cross-level pairs carry åtgärder that belong to the statutory action plan under 13-14 §§. The claim is about the gate, not the law.
- Feed a sixth virtual "Further analysis" section into the checklist search results whose rows scroll to and open the matching drawer item.

**Tests:** update the chrome assertions in `excluded-groups-sections.test.tsx`, `equivalent-work-level-analysis.test.tsx`, `cross-level-section.test.tsx`; new tests that the heading states the gate claim, that an empty item still renders, that the cross-level count is tinted when non-zero, and that search reaches the drawer.

**i18n:** roughly 14 leaves plus one help pair.

## Slice 3: one chapter at a time, one evidence rung

**Files:** create `evidence-disclosure.tsx`; modify `pay-mapping-summary.tsx`, `equal-work-detail.tsx`, `women-dominated-underlying-data.tsx`.

- Drop `multiple` from the checklist `Accordion` (Base UI's `multiple` defaults to false and the value is an array), and control it: the open chapter is the one holding the next undone row, and it changes on deep link and on advance. A collapsed chapter always shows its `chapterMeta` count, so folding never hides an obligation.
- Add an All / Remaining segmented filter beside the search, defaulting to **All**: a default that hides documented rows would make the evidence record invisible on arrival.
- Cap each chapter's inline list at 8 rows plus a `Show all N as a list` row that opens the chapter worklist in the pane (the worklist itself lands in slice 4; until then the row opens the chapter's first step).
- Add a permanent "Complete the mapping" row below the four chapters, always reporting `locked · N left` or `ready`, opening the completion panel at any time.
- `EvidenceDisclosure` is a thin `AccordionSection` wrapper keyed on the pane key, so every newly opened step starts short with the form at the bottom. Wrap `GroupMemberTable` inside `EqualWorkDetail` ("Show the N people in this group") and rewrap `WomenDominatedUnderlyingData`. The summary strip and `PayGapDotPlot` stay visible: they are why the group is flagged.

**Tests:** every row reachable through a collapsed chapter; the disclosure resets between steps; the filter defaults to All; the Complete row states the locked count.

**i18n:** roughly 8 leaves.

## Slice 4: the chapter worklist and the statutory chapter bar

The scale answer and the guidance answer.

**Files:** create `chapter-worklist.tsx`, `chapter-bar.tsx`; modify `pay-mapping-summary.tsx`.

- `ChapterWorklist` is a full house register table: `table-fixed`, widths on header cells, `TableSortButton` with `aria-sort`, default sort equal to the current attention order (flag rank, then absolute gap, then key), `TablePagination` at 25 sharing one `PAGE_SIZE` constant with its `TableSkeleton`, and a no-matches empty state. Columns: group, women, men, gap, flag, status (Needs documenting / Documented / No duty), opening the step.
- The trailing set-aside line states the full comparison universe in words and links into the drawer: "57 groups were formed. 4 are compared here. 42 job titles have only one person, 7 groups have women ahead and 4 have a single gender."
- `ChapterBar` renders above every opened step: `Chapter N of 4 · <name>` plus a `HelpMorphButton` carrying the statutory sentence and the existing `review.chapters.intro.*` method copy. **Built with the duty in the help rather than on the page:** the step already carries a finding sentence and a form, and a permanent third sentence above every step would spend the calm this rework exists for. Start and praxis get their own method copy (`analysis.dutyHelp.*`), since only the two statutory chapters had an intro.
- The `Show all N as a list` row appears only past `INLINE_ROW_CAP` (8) and only for the two group chapters; start and praxis are never long enough to need it.
- Ship the coverage invariant test named in the global constraints.

**Tests:** the worklist renders every group including non-required ones labelled "No duty"; sort, filter and pagination; the chapter bar renders per chapter; the coverage invariant.

**i18n:** 4 statutory sentences, 4 help bodies, roughly 10 table and status leaves.

## Slice 5: one queue, one gate, one advance

**Reordered during the build:** slice 7 (delete `/review`) ran first, because slice 5 would otherwise consolidate code slice 7 deletes. `PayMappingCompletionPanel` and the journey-card demotion shipped inside slice 7 for the same reason (deleting `ReviewFinish` requires its replacement). What remains of this slice is the `useReviewQueue()` hoist over the two surviving consumers.

Zero pixels. The existing tests passing unmodified is the proof.

**Files:** modify `pay-mapping-run-shell.tsx`, `pay-mapping-run-context.tsx`, `pay-mapping-summary.tsx`, `pay-mapping-review.tsx`, `pay-mapping-journey-card.tsx`; create `pay-mapping-completion-panel.tsx`.

- Add `listPayMappingRuns` to the shell's shared subscriptions and expose `useReviewQueue()` returning `{ queue, locked, resumeStep, hasPreviousCompletedRun }` plus one memoised done-map, which also removes the per-row `stepDoneFor` calls.
- Rewire all three consumers; delete the three duplicated `status === "completed"` checks.
- Extract `PayMappingCompletionPanel` replacing both `renderGatePanel` and `ReviewFinish`: the actions note, the Complete button with its remaining hint, `isGateUnmetError` handling, the completed note, Reopen, the four-chapter breakdown moved from the journey card (decision 3), and the non-blocking tvärnivå observation (decision 2).
- Extract one `nextUndoneRow` replacing both `goForward` (index+1) and `advanceAfter` (next undone).
- Demote `PayMappingJourneyCard` to an overall progress line plus one CTA.

**Tests:** a new test pinning `progress.overall.done/total` for the fixture org before and after the hoist; a test that one queue instance feeds all consumers; `review-queue.test.ts`, `pay-mapping-journey-card.test.tsx` and `review-finish.test.tsx` must pass with their assertions ported, not rewritten.

## Slice 6: the phone

**Files:** modify `pay-mapping-analysis.tsx`.

Replace the all-or-nothing checklist hide and the back-to-summary ghost button with a sticky `Step 7 of 26 · Lika arbete` context bar that opens a step sheet. **Not built on `ReviewJumpMenu`:** that component jumped by wizard queue index and died with the wizard in slice 7, so the sheet is built fresh on `ChecklistRows` and the analysis surface's own OpenStep model. Animation pass against `docs/ui-animation.md` for the single-open accordion and the drawer.

**i18n:** roughly 4 leaves.

**Built:** the checklist body is one definition (`checklistBody`) rendered both in the sticky column and, below `lg` while a step is open, inside a left `Sheet`, so the phone can never drift from the desktop list. The bar states the position (`Step 2 of 10 · Praxis`) rather than the way back, because the phone's problem is orientation, not history. Selecting a row closes the sheet.

**Removed with it:** `handleBackToSummary`, the `suppressPaneFocusRef` machinery that existed only to stop its explicit heading-focus being stolen back, and the `payMapping.review.backToSummary` key in all five locales. The way out of an opened step on every screen size is now the checklist's own always-reachable completion row, which is where the mapping ends anyway.

**Animation pass (`docs/ui-animation.md`):** nothing new to write. The chapter accordion and the supplementary drawer animate through the vendor's own `accordion-down`/`accordion-up` keyframes, and Base UI clears the measured height on open-complete, so an idle open panel is `height: auto` and a filter or search change inside it reflows without clipping; a Motion height animation there would fight the reopen keyframes for no gain. The sheet carries the vendor's fade plus 2.5rem slide. The new context bar sits INSIDE the pane's existing `AnimatePresence mode="wait"` crossfade rather than appearing on its own, so it never pops in against content that is simultaneously being replaced.

## Slice 7: one door

Runs last, after ADR-0016.

**Files:** delete `review/page.tsx`, `pay-mapping-review.tsx`, `review-progress.tsx`, `continue-review-item.tsx`, `review-finish.tsx`, `review-chapter-intro.tsx`; modify `pay-mapping-tabs.tsx`, `pay-mapping-run-shell.tsx`, `actions-overview.tsx`, `pay-mapping-journey-card.tsx`, `lib/todo.ts`; rename `pay-mapping-summary.tsx` to `pay-mapping-analysis.tsx`.

- Port the assertions in `pay-mapping-review.test.tsx` and `review-jump-menu.test.tsx` onto the analysis surface one describe block at a time **before** deleting anything: the extra-group hatch, the search-flattens-the-accordion rule, the deep-link parse, the locked state.
- Retarget every `?step=` producer in the same commit and grep-verify that none remains.
- Remove every i18n key that lost its consumer, in all five locales.
- The `animated` and `headingLevel` fork in the step components disappears with the second renderer.

## Risks and mitigations

**Gate correctness.** Slices 1 to 4 fold or filter rows, never remove them, and touch none of the gate math. Slice 5 is a pure hoist with a before-and-after pin on `progress.overall`. The failure mode guarded against is not an illegal completion (the server re-validates from the frozen snapshot) but a client that says done while Complete throws.

**Statutory reachability.** Every step stays reachable from the checklist, the chapter worklist, the search field and `?step=` deep links. Non-required groups appear as worklist rows labelled "No duty". Excluded groups keep their documentation affordances in the drawer. The coverage invariant test makes a silent disappearance a test failure.

**Burying a non-gating but legally meaningful finding.** The tvärnivå item is first in the drawer with a tinted count, and it is named again in the completion panel at the moment of finishing. Neither touchpoint is optional polish.

**Large-org scale.** At 210 likvärdigt rows the checklist shows 8 plus "Show all 210" and the worklist is a paginated, sorted, filtered register table at 25. `buildCrossLevelCases` stays O(women x men) but runs only when its drawer item is open, instead of on every render of the page. Virtualization for a 1000-person org is explicitly not solved here.

**Losing the all-at-once view.** No such surface is deleted at any point: the checklist survives and the chapter worklist is a stronger version of what an auditor or a facklig representant needs to be shown.
