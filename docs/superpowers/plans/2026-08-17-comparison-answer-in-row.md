# The Answer Lives in the Row (Equivalent Work)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the equivalent-work chapter, answering a comparison happens IN the comparator table's own row, and the free-text analysis belongs to that comparison rather than to the group.

**Architecture:** The comparator table gains an expandable row: selecting a comparison opens a full-width panel directly beneath it holding that comparison's reasons and note. `ComparisonReasonsPanel` moves from the bottom of the step into that panel and grows a note field; the group's own documentation form stops rendering for this scope entirely, because nothing group-level is left to answer there. No backend change: `upsertGroupAnalysis` already accepts `note` alongside `comparisonKey`.

**Tech Stack:** React 19 + Next.js 16 + Tailwind v4 (`apps/dashboard`), next-intl, Vitest 4.

**Spec:** This document. Follows `2026-08-17-per-comparison-reasons-equivalent-work.md`, which moved the reasons per comparison; this moves the ANSWERING SURFACE to match.

## Why (the problem being fixed)

The step reads as three equal-weight blocks with no hierarchy: the table (the
finding), the scatter (the evidence), the chips (the task). Three consequences,
all observed on the real surface:

1. The task sits below the fold, because the evidence stands between the
   finding and the answer.
2. The selected comparison loses its context: which row you are answering for
   is carried only by a faint row wash in a table you have already scrolled
   past, while the heading naming the pair sits far below it.
3. "Fördjupad analys" is still group-level while everything above it is now per
   comparison. That is the same mismatch the row popover ran into: the prose
   that motivates a reason belongs to the comparison the reason explains.

## Global Constraints

- All code, comments, commit messages in English; UI copy through i18n
  (`en.json` first, then sv, nb, da, fi). New non-English strings are machine
  drafts and must be flagged for native review.
- No em dashes in any text we write.
- Biome ends at zero errors AND zero warnings; `bun run test` (never `bun test`).
- New behaviour ships with tests in the same change.
- Leave the work uncommitted for review.
- Minimize layout shift: expanding a row must not move the rows above it.

---

### Task 1: The note moves to the comparison

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/comparison-reasons-panel.tsx`
- Modify: `packages/i18n/messages/*.json`
- Test: `apps/dashboard/components/pay-mapping/comparison-reasons-panel.test.tsx` (create)

**Interfaces:**
- Produces: `ComparisonReasonsPanel` renders a note field under the chips, saving to the same row (`upsertGroupAnalysis` with `comparisonKey` + `note`).

**Behaviour:**
- The note saves on blur and on an 800ms typing debounce, the same discipline
  the group form uses, and re-seeds from the subscription only when the
  textarea is not focused and the local value is not dirty.
- It uses `REVIEW_NOTE_FIELD_CLASS` so it cannot grow and move the controls
  under it.
- Unlike the group form, this note needs no imperative flush before mark-done:
  the group's klarmarkering writes a DIFFERENT document, so a pending note
  save cannot round-trip a stale `done` over it. Say that in a comment, since
  the group form's own handle exists precisely because of that race.

- [ ] **Step 1: Write the failing test** covering: typing then blurring saves
  the note against the comparison's row (`comparisonKey` present, `done:false`),
  and the field carries the fixed-height class.
- [ ] **Step 2: Run it, see it fail.** `cd apps/dashboard && bun run test comparison-reasons`
- [ ] **Step 3: Add the note field and its save discipline.**
- [ ] **Step 4: Add `dashboard.payMapping.review.comparisonNoteLabel` and
  `comparisonNoteHelper` in all five locales.**
- [ ] **Step 5: Run the tests.** Expect PASS.

---

### Task 2: The answer opens inside the row

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/comparator-table.tsx`
- Modify: `apps/dashboard/components/pay-mapping/review-group-step.tsx`
- Test: `apps/dashboard/components/pay-mapping/review-group-step.test.tsx`

**Interfaces:**
- Consumes: `ComparisonReasonsPanel` from Task 1.
- Produces: `ComparatorTable` accepts `renderExpanded?: (comparisonKey: string) => ReactNode`, rendered in a full-width row directly beneath the selected comparison.

**Behaviour:**
- Selecting a comparison expands it; selecting another moves the panel; the
  scatter's highlight keeps following the same selection (unchanged).
- The expanded content sits in its own `<tr>` with a `<td colSpan>` covering
  every column, so the table's own column widths are untouched.
- The row's selection control carries `aria-expanded`, because it now controls
  disclosure as well as selection.
- The group's `PayMappingGroupAnalysisForm` does not render at all for
  `scope === "equivalentWork"`: with the chips already hidden and the note
  moved, it would be an empty box. Equal work keeps it exactly as today.
- The step's "pick a comparison" line stays for the state where nothing is
  selected, since the table alone does not say that answering is the task.

- [ ] **Step 1: Write the failing tests** covering: the panel is absent until a
  row is selected; selecting a row renders the panel in a row beneath it;
  selecting another row moves it; the equal-work step still renders the group
  form.
- [ ] **Step 2: Run them, see them fail.**
- [ ] **Step 3: Add `renderExpanded` to the table and move the panel into it.**
- [ ] **Step 4: Stop rendering the group form for equivalent work.**
- [ ] **Step 5: Run the tests.** Expect PASS.

---

### Task 3: The row's hover card shows the whole answer

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/comparator-table.tsx`
- Test: `apps/dashboard/components/pay-mapping/comparator-table.test.tsx`

**Behaviour:**
- The hover card opened from the reason cell lists the comparison's reasons AND
  its note, which is what makes the collapsed table readable at a glance: a
  reader sees the whole answer for a row without expanding it.
- A row with a note but no reasons still shows the card, since the note alone
  is an answer worth reading. The cell's own text stays the first reason plus
  the count, or the note's first line when there are no reasons.

- [ ] **Step 1: Write the failing test** covering both cases.
- [ ] **Step 2: Run it, see it fail.**
- [ ] **Step 3: Pass the notes into the table beside the reasons and render them.**
- [ ] **Step 4: Run the tests, then the full gates** (`bunx biome check
  --error-on-warnings apps packages`, `bunx turbo typecheck`, `bunx turbo test`).
- [ ] **Step 5: Verify in the browser**: expand a row, type a note, confirm the
  controls below do not move, confirm the hover card shows reasons and note,
  confirm equal work is untouched.
