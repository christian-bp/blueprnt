# Takeover Wizard + Summary-as-Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the review wizard into the app's full-screen takeover pattern (like the people import) at `/pay-mappings/[slug]/review`, and make the Analysis tab the run's summary with clickable rows, plus a dead-code audit over the whole uncommitted pile.

**Architecture:** Presentation-only rework: the wizard engine (queue, step cards, autosave, resume, focus) is reused; `pay-mapping-review.tsx` re-frames into `WizardShell`, the finish step slims to a finale, and a new `pay-mapping-summary.tsx` owns the documentation listing with in-place step-card overlays. No backend changes.

**Tech Stack:** Next.js 16 App Router client components, WizardShell (existing frame), next-intl, Motion, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-22-pay-mapping-summary-steady-state-design.md` (read first). Pattern reference: `app/(app)/people/import/page.tsx` + `components/people/import/import-wizard.tsx` + `components/wizard-shell.tsx`.

## Global Constraints

- **NO COMMITS** (held-uncommitted mode; controller snapshots trees). Vitest 4 via `bunx vitest run` / root `bun run test`; never `bun test`. Locale JSON via the Edit tool only, all five files per task, en first; the language-purity guard test must stay green. No em dashes; never a signed percent in prose. Biome via `bun x biome check --write`. Skeleton/loading, toast, dialog, color-alone, and animation (transform+opacity, docs/ui-animation.md) rules as established. Step components' internals are out of scope.
- After the route/presentation swap: browser-verify on localhost:3001 (signed-in MCP tab) per the schema-change-live-dev process rule; no Convex schema changes in this plan, so no data migration.

---

### Task 1: pay-mapping-summary.tsx (the listing with clickable rows)

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-summary.tsx`, `pay-mapping-summary.test.tsx`
- Modify: locale files ×5 (new keys), `review-jump-menu.tsx` ONLY if a status helper needs exporting (they already are).

**Interfaces:**
- Consumes: `usePayMappingRun()` (run/gap/analyses), `useQuery(listPayMappingRuns)` for `hasPreviousCompletedRun` (mirror `pay-mapping-review.tsx:63-70` byte-for-byte), `buildReviewQueue`/`stepKey`/`isStepDone` (`review-queue.ts`), the status/gap-text helpers exported from `review-jump-menu.tsx` (`stepDoneFor`, `equalWorkGroupStatusText`, `womenDominatedGroupStatus`, `percentText`), the step components (`review-start-step`, `review-praxis-step`, `review-group-step`), the complete-flow anatomy from `review-finish.tsx` (gate section: Complete button + `documentation.remaining` hint + completed note; copy it, Task 2 slims the original).
- Produces: `export function PayMappingSummary()` (self-contained, no props), mounted by Task 2 on the analysis page.

**Behavior (binding):**
- Heading `review.summaryTitle` (NEW key ×5: en "Summary", sv "Sammanställning", nb "Sammendrag", da "Opsummering", fi "Yhteenveto").
- Top CTA banner while `queue.progress.overall.done < overall.total` AND run is active: `review.remainingBanner` ICU (NEW, en "{count, plural, one {# step remains in the guided review.} other {# steps remain in the guided review.}}") + a primary Link-button `review.continueWizard` (NEW, en "Continue the review") to `/pay-mappings/{slug}/review` (slug via `usePathname` split, sibling idiom). Absent when done or completed.
- Sections in order (content lifted from today's `review-finish.tsx` listing): collaboration summary or missing-warning; praxis results (undone -> `review.status.toReview`, done -> findingNone/findingFound + note excerpt); ALL equalWork groups and ALL womenDominated groups with the shared gap/status texts; the `review.finishActionsNote` line; the gate section (Complete when met + toasts + gate-unmet error handling, remaining hint when not, `documentation.completedNote` + overview link when completed) copied from the finish screen's verified logic.
- **Every row is a real button** (keyboard reachable, hover affordance): clicking opens the step card as an in-place overlay replacing the listing (state `openStep: ReviewStep | { kind: "extraGroup"; scope; key } | null`): group rows resolve to a `review-group-step` (queue members with their real `requiresDocumentation`, non-queue with `false`), praxis rows to `review-praxis-step`, the collaboration section to `review-start-step`. The overlay card gets a back control `review.backToSummary` (NEW, en "Back to the summary", sv "Tillbaka till sammanställningen" + nb/da/fi drafts) wired to `onNext`/close (both return); `onPrevious`/`onSkip` are omitted (hidden). Locked run -> cards render read-only via the existing `locked` prop. Focus moves to the opened card and back to the summary heading on return (mirror the wizard's focus ref pattern).
- Loading (run/gap/analyses undefined): real heading, skeleton rows in min-h-5 line boxes (sibling discipline). `gap.currency === null` -> the existing `gap.empty` text.

- [ ] **Step 1: failing tests** (mock convex/react + api + org-context + sonner + next/navigation like `pay-mapping-review.test.tsx`; wrap in `PayMappingRunProvider`): banner with count + href when steps remain, absent when all done; each row kind opens the right card (assert the card's heading/question renders) and backToSummary returns to the listing; a non-queue ✅ group opens with free klarmarkering (primary enabled without documentation); locked run renders the opened card read-only; gate section states (complete fires mutation + toast; remaining hint; completed note); loading shape.
- [ ] **Step 2: run RED** `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-summary.test.tsx`
- [ ] **Step 3: implement** per the behavior block; i18n keys ×5 via the Edit tool.
- [ ] **Step 4: run GREEN** + `cd packages/i18n && bun run test` (parity + purity) + root typecheck.
- [ ] **Step 5: Biome**; leave uncommitted.

---

### Task 2: The takeover wizard + route swap

**Files:**
- Create: `apps/dashboard/app/(app)/pay-mappings/[slug]/review/page.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-review.tsx` (+ test), `review-progress.tsx` (+ test), `review-finish.tsx` (+ test), `app/(app)/pay-mappings/[slug]/analysis/page.tsx`, `pay-mapping-journey-card.tsx` (+ test), locale files ×5.

**Interfaces:**
- Consumes: `WizardShell` (`components/wizard-shell.tsx`: headerLeft/headerRight/footer/contentKey props), the import page's takeover wrapper (`app/(app)/people/import/page.tsx`: copy the `fixed inset-0 z-50 overflow-hidden bg-background` wrapper and adapt its comment), `PayMappingSummary` (Task 1).
- Produces: `/review` renders the takeover wizard; `/analysis` renders `<PayMappingSummary />`.

**Behavior (binding):**
- `pay-mapping-review.tsx` reworks its frame: renders `WizardShell` with `headerLeft` = exit ghost button `review.exit` (NEW ×5, en "Exit the review", sv "Avsluta granskningen") navigating (`useRouter().push`) to `/pay-mappings/{slug}/analysis`, NO confirm dialog; `headerRight` = the jump-menu trigger (moved from the progress row); `footer` = the progress counter + thin bar (rework `review-progress.tsx` for the footer slot: counter left, bar filling the row; the jump trigger prop is removed from it); `contentKey` = the active step key (WizardShell resets scroll per step). The step area keeps the AnimatePresence slide, focus management, and live region unchanged. The all-done chrome-fading rule from the spec's earlier version is superseded: the finale is a step like any other inside the wizard; the SUMMARY is the chromeless surface.
- `review-finish.tsx` slims to the finale: the affirmation (`review.finish.title` "Everything reviewed" stays correct here), the gate section (unchanged logic), and a primary Link `review.openSummary` (NEW ×5, en "Open the summary") to `/analysis`. DELETE the listing sections from it (Task 1 copied them; note the handoff in both files' comments). Its tests slim accordingly.
- `review.autosaveHint` (NEW ×5, en "Everything you enter is saved automatically.") renders as a muted line on the START step card (add to `review-start-step.tsx` copy area, no behavior change).
- Route wiring: `/review/page.tsx` = the takeover wrapper + `<PayMappingReview />` (adapt the import page's comment verbatim-in-spirit); `/analysis/page.tsx` = `<PayMappingSummary />` (thin). The journey card's unmet-CTA href changes from `/analysis` to `/review` (+ test).
- i18n sweep: delete keys orphaned by the finale slimming and the progress rework (grep each candidate across code first; the summary reuses most listing keys).

- [ ] **Step 1: failing tests first**: adapt `pay-mapping-review.test.tsx` (WizardShell chrome present: exit button navigates via the router mock, jump trigger in header, counter + bar in footer; step navigation/resume/focus tests stay green with the new frame); `review-finish.test.tsx` (finale = affirmation + gate + summary link; listing sections GONE); `review-progress` footer form; journey-card CTA href.
- [ ] **Step 2: RED**, **Step 3: implement + route files + key sweep**, **Step 4: GREEN**: the whole `components/pay-mapping/` folder + parity/purity + root typecheck + root `bun run test`.
- [ ] **Step 5: Biome**; leave uncommitted. Controller then browser-verifies the takeover + summary live.

---

### Task 3: Dead-code audit over the whole uncommitted pile

Christian's finding: ~20k uncommitted lines across several refactors; leftovers are likely. This audits the FINAL state (post Task 2).

**Files:** removals only where proven dead; a written inventory in the report.

- [ ] **Step 1: tool-assisted sweep.** Try `bunx knip` from the repo root with a minimal `knip.json` written to the SCRATCHPAD... no: knip needs the config in-repo; create a THROWAWAY `knip.json` at the root (deleted again in this task after use, never left in the tree) marking entries: `apps/dashboard/app/**/{page,layout,proxy}.tsx`, `packages/backend/convex/**/*.ts` (Convex functions are runtime entry points), `packages/*/src/index.ts`, test files as project files. Run `bunx knip --no-exit-code` and collect: unused files, unused exports, unused dependencies. Knip output is a LEAD LIST, not a verdict.
- [ ] **Step 2: manual verification per lead.** For every reported file/export: grep for dynamic references (string-based imports, i18n key usage, Convex `api.` paths, test-only consumers). Classify: (a) truly dead from our refactors -> DELETE (source + its test + orphaned i18n keys ×5); (b) intentional API surface (e.g. constants exported for future slices named in the roadmap/specs) -> keep with a one-line comment naming the consumer-to-be; (c) vendor/shadcn (`packages/ui/src/*`) -> NEVER delete (policy).
- [ ] **Step 3: known suspects to check explicitly** (from the refactor history): remnants of the deleted master-detail (any helper still exported for it), `review-jump-menu` helpers after Task 1/2 rewiring, `review-progress` props orphaned by the footer rework, `equality-clock.ts` types (were de-exported: are the TYPES still used?), `mean-comparison-bars` `data-testid`, old `documentation.*` i18n keys, `pay-mapping-gap-types.ts` types with zero importers, unused audit `FIELD_DISPLAY_ORDER` entries, `dashboard.help.*` bodies with zero call sites, `payMapping.toolbar.*`/`gap.columns.*` keys the deleted tables used.
- [ ] **Step 4: delete + verify.** Remove the confirmed-dead set; delete the throwaway `knip.json`; run root `bun run typecheck` + `bun run test` + parity/purity + the standing grep sweep (deleted names = zero hits). Biome.
- [ ] **Step 5:** Report the inventory (deleted: path + why dead; kept-despite-lead: why) to `.superpowers/sdd/` for the controller.

---

### Task 4: Final gate + whole-slice review

- [ ] Full `bun run typecheck` (9/9) + `bun run test` (8/8); em-dash/mojibake/dead-key greps clean.
- [ ] Controller: tree snapshot, whole-slice review dispatch (opus) over the plan-base diff incl. the dead-code removals, fix wave if needed, browser pass checklist, ledger, report to Christian. Everything stays uncommitted.

---

## Self-review notes

- Spec coverage: §1 -> Task 2; §2 -> Task 1 (+2 route); §3 -> Task 2; §4 -> Tasks 1-2; §5 -> distributed; the dead-code audit is Christian's added scope -> Task 3.
- Type consistency: `PayMappingSummary()` self-contained (no props) consumed by the Task 2 route; helper names match their current exports in `review-jump-menu.tsx`; the exit/back key names (`review.exit`, `review.backToSummary`, `review.openSummary`, `review.continueWizard`, `review.remainingBanner`, `review.autosaveHint`, `review.summaryTitle`) are used consistently across Tasks 1-2.
- Judgment pinned: no discard dialog on exit (autosave); the finale keeps full wizard chrome (the chrome-fading idea from the superseded spec version is dropped: the summary is the chromeless surface); the jump menu lives only in the wizard.
