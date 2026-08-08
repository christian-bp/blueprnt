# Iteration 4: chapters as pages

> **For agentic workers:** each slice ends Biome-clean, typecheck-clean and test-clean. No backend change anywhere in this programme. The completion gate math is not touched by any slice.

**Goal:** Make the analysis lighter by turning the four chapters into their own pages, so choosing a chapter is a navigation decision instead of a state on one crowded surface.

**What this replaces:** the single-open accordion built in Iteration 3 (rung 1). Routes do not sit on top of it. They take its place, or we would ship two navigation models for the same choice.

## The number that shapes this

In a real run: 29 steps total, split samverkan 1, praxis 4, equal work 3, equivalent work 21. **72% of all the work lives in one chapter**, and 21 of the 24 remaining steps (88%) are there.

Two consequences the design has to answer:

1. Splitting equal from equivalent work does not, by itself, make the analysis lighter. It moves three steps to their own page and leaves the heavy page exactly as heavy. The equivalent-work page must therefore be built for 21+ rows from the start, not inherit a list designed for 3.
2. The chapters are wildly unequal in size and in kind (one form fill, four yes/no questions, two group analyses). Presenting them as four equal accordion sections was itself part of the weight.

## Resolved decisions

1. **A chapter tab row under the run's own.** Decided against a card hub: switching chapters must be one click from anywhere, not a trip back through an index. The row is `Läget / Samverkan / Praxis / Lika arbete / Likvärdigt arbete`, mirroring `PayMappingTabs`' anatomy (a `nav`, `aria-current="page"`, one `layoutId` underline, and its own layoutId so the two rows never cross-animate). `/analysis` itself is the "Läget" tab: what is next, the completion panel, the search across every step, and the supplementary drawer.

   The known cost is visual weight from two stacked rows. It is paid down by the chapter row carrying progress its parent does not (`Praxis 4/4`), so the row is a status readout as well as a switcher, which is exactly what the accordion's chapter headers were doing before.
2. **The spine lives in the layout.** `analysis/layout.tsx` renders `AnalysisSpine` once and persists it across Läget and every chapter page, so the standing readout is never repeated, never re-fetched, and never flashes. This mirrors `[slug]/layout.tsx`, which already persists the run shell across Overview / Analysis / Actions.
3. **No new data subscriptions.** `PayMappingRunShell` already holds every query and `PayMappingRunProvider` already derives the queue once. Chapter pages read the same context. Splitting the surface must not multiply the reads.
4. **"Mark done and continue" navigates when it crosses a chapter boundary.** Today `advanceAfter` walks one flat row order across all four chapters. With chapters as pages it keeps that order but pushes a route when the next remaining row belongs to another chapter. That is more honest than silently swapping a pane, and the user sees the chapter change.
5. **The cross-chapter search lives on Läget.** It is the only surface that can see all steps, which is exactly what a search is for.
6. **Route segments are English**, like every existing segment (`analysis`, `actions`, `report`): `start`, `praxis`, `equal-work`, `equivalent-work`. The chapter keys already exist as `ANALYSIS_CHAPTERS`; the segments map to them through one exported table, never a literal per call site.

## The structure

```
             Overview   Analysis   Actions   Report        <- the run's row
             Läget   Samverkan   Praxis 4/4   Lika 0/3   Likvärdigt 0/21

  (layout)   Documented 5 / 29 ................ progress bar
             Samverkan: <participants> · Change

/analysis                     LÄGET
  next step: one sentence, one button into the owning chapter page
  search across every step
  completion panel: chapter breakdown, Complete/Reopen, cross-level observation
  supplementary drawer: does not affect completion

/analysis/equal-work          CHAPTER
  the chapter's OWN rows (no accordion) + the pane
  the statutory duty for this chapter

/analysis/equivalent-work     CHAPTER, built for 21+
  the worklist table is the DEFAULT view, not a link off a list
```

## Flow decisions (2026-08-07, from review of the built surface)

7. **A chapter page opens its own next remaining step on arrival.** Iteration 3 auto-opened nothing, on the reasoning that landing should not put a chart, a table and a form on screen unasked. That reasoning belonged to one surface carrying all four chapters, where landing there was not a choice. Opening a chapter IS the request, so answering it with a button that repeats what was just asked for is a step backwards.

8. **The next-step panel is Läget's alone.** It names the next remaining step across all four chapters. On a chapter page it therefore advertised, and opened, a step that page does not list, and the tab row stayed on the wrong chapter. A chapter page answers with its own chapter's work.

9. **A one-step chapter renders no list.** The 320px column exists to choose between rows. With one row there is nothing to choose, so the step takes the full width. The rule is `rows.length > 1`, not a per-chapter special case.

10. **A finished chapter points onward, it does not offer Complete.** Completing the run belongs to Läget, which owns the whole mapping's standing. A finished chapter says so and links to the chapter holding the next remaining step, or back to Läget when nothing is left.

11. **The tab row uses SHORT chapter names** (`review.chaptersShort.*`): Samverkan / Praxis / Lika arbete / Likvärdigt arbete. Five descriptive titles plus five counts overflowed the row and read as a paragraph. The statute's own terms are both shorter and more precise. The descriptive titles stay on the chapter page, where there is room for them to explain.

## Status (2026-08-07)

Slices 1 and 2 are **built and verified in the browser**, uncommitted. Biome and typecheck are clean; the route split, the chapter tab row with per-chapter progress, the shared spine, and the drawer confined to Läget all render correctly.

**Blocking:** 19 tests in `pay-mapping-analysis.test.tsx` still fail (every other test file passes). They are not mechanical renames. The accordion they drove no longer exists, so each needs a decision:

- `renders each countable chapter trigger…` / `advances each countable chapter's count…` and `opens one chapter at a time…` tested accordion triggers. The count assertions belong on a new `analysis-chapter-tabs.test.tsx`; the single-open one has nothing left to test and should go.
- `filters the checklist by label while searching, flattening the chapters` assumed a search across all four. A chapter page can only search its own, so this moves to Läget **once Läget has a search** (still to build; see the gap below).
- `renders every group the engine produced, or accounts for it in words` is the statutory coverage invariant. It now has to render all four chapter pages and union their rows, which is the right shape but a real rewrite.
- The rest (`selects a praxis row`, `selects the start row`, the equivalent-work ones) just need their own chapter passed to `renderSummary`.

**Known gap, not yet built:** Läget has no search. The plan calls for the cross-chapter search to live there and it is currently nowhere, so a user cannot find a step by name without knowing its chapter. This must land before the accordion's removal is complete.

## Slices

### Slice 1: the layout and Läget

**Files:** create `analysis/layout.tsx`, `components/pay-mapping/analysis-chapter-tabs.tsx` and `analysis-standing.tsx`; modify `analysis/page.tsx`, `pay-mapping-tabs.tsx` (its `payMappingSubPageKey` must keep resolving the deeper segments to the Analysis tab).

The spine moves out of `PayMappingAnalysis` into the layout. `/analysis` becomes the Läget tab: next-step, search, completion panel, drawer.

### Slice 2: the chapter pages

**Files:** create `analysis/{start,praxis,equal-work,equivalent-work}/page.tsx` and `components/pay-mapping/analysis-chapter-page.tsx`.

One component parameterised by chapter, because the four differ only in which rows they list and which duty they state. Equivalent work defaults to the worklist table.

### Slice 3: crossing boundaries

**Files:** modify `analysis-chapter-page.tsx`, `actions-overview.tsx`.

`advanceAfter` pushes a route when the next remaining row is in another chapter. Every `?step=` producer retargets to the owning chapter page. Grep-verify none remains pointing at bare `/analysis`.

### Slice 4: retire the accordion

**Files:** delete the accordion path out of `pay-mapping-analysis.tsx` (or the file, if Läget plus the chapter pages have absorbed it); remove every i18n key that lost its consumer, in all five locales.

The phone's sticky context bar and steps sheet from Iteration 3 slice 6 are re-evaluated here: with one chapter per page the sheet may have nothing left to do, and a control that survives only out of habit is exactly the weight this programme is removing.

### Slice 5: tests, i18n, phone

Port the Iteration 3 assertions onto the new surfaces one describe block at a time BEFORE deleting anything. New Nordic strings are machine drafts; extend the go-live entry.

## Risks

**The gate.** No slice touches `buildReviewQueue`, `isStepDone`, `progress`, or the server re-check. Läget's completion panel is the same component.

**Statutory reachability.** Every step must stay reachable: from its chapter page, from Läget's search, and from a `?step=` deep link. The coverage invariant test from Iteration 3 slice 4 moves to Läget and must keep passing.

**Losing the all-at-once view.** Läget's search plus the equivalent-work worklist together replace what the flat checklist showed. Neither is deleted before both exist.

**Doing this right after Iteration 3.** The accordion shipped days ago. The honest framing: Iteration 3 built the rungs and proved which one was carrying too much. This programme moves rung 1 from a state to a route. The components below it (the pane, the step, the evidence disclosure, the worklist, the completion panel) are reused, not rebuilt.
