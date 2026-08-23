# Fas 4: Bedömningen berättar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assessment experience teaches its own method: stage identity, the shared scale, decision-support in the picker, and an audit trail that reads as stories, on the surfaces that already exist.

**Architecture:** No new routes. Every change lands on existing surfaces (model section, rate page, role page, library picker, audit log) composed from the Verve anatomy and the app's primitives. Backend changes are additive (batchId on auditLog, prompt enrichment); the engine is untouched.

**Tech Stack:** Next 16 / Convex / next-intl / Motion / Verve-Frame anatomy / convex-test + Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md` §10.1 Fasning v2 (fas 4), deviations 9-11. Source of truth behind it: `docs/rollvardering-masterdokument.md` §3-4, §11, §13, §17.3, §17.5.

## Global Constraints

- All five locales (en/sv/nb/da/fi) at production quality in the same commit; no native-review flagging (ownership policy 2026-08-21). i18n parity guarded.
- The framing-prose law: no standing explainer sentences; pedagogy lives in titles, scanned labels (eyebrows), and HelpMorphButton bodies (two-sentence cap, placement after titles).
- The weight firewall is wire-level: nothing in this phase may add weight-family data to `getRatingModel` or any rate-surface read.
- Every state-changing mutation writes its audit row with the full audit-law chain (event key, typed payload, category, subject, five-locale labels, drift guards).
- Reading text floors at `text-sm`; eyebrows/labels are the scanned exception.
- Every anchored floating panel uses the collision authority; every data surface keeps its skeleton in sync.
- New code ships with tests in the same commit; Biome zero warnings; `bun run test` never `bun test`.
- Any change under `content/docs/` ends with `bun run docs:sync` in the same change (docs alignment itself is fas 6; only touch docs here if a fas-4 change falsifies a page).
- Work lands on `feat/role-evaluation-phase-4-6`; per-task commits; no push, no merge (owner reviews the branch).

---

### Task 1: Stage eyebrows and rate-route isolation

**Files:**
- Modify: the model section's title row component (`SectionTitleRow` consumer in the model shell), the rate page's heading area (`app/(app)/roles/[roleSlug]/rate/page.tsx`)
- Modify: `packages/i18n/messages/*.json` (two eyebrow keys)
- Test: co-located component tests + a link-scan test on the rate page

**Interfaces:**
- Produces: `dashboard.model.stageEyebrow` ("Method building" family) and `dashboard.rating.stageEyebrow` ("Role assessment" family) rendered as uppercase `text-xs` scanned labels above/beside the respective titles (masterdokument §4.2.2, deviation 10: label, never a sentence).

- [ ] Verify empirically where the model shell's title renders and where the rate page's heading renders; place each eyebrow per the app's eyebrow idiom (check for an existing eyebrow pattern first and reuse it).
- [ ] Add the two keys in all five locales (sv: "METODBYGGNAD" / "ROLLBEDÖMNING" per §17.5; en: "Method building" / "Role assessment"; nb/da/fi idiomatic equivalents).
- [ ] Rate-route isolation test: walk the rate page's rendered link hrefs and assert none targets `/model`* or a levels/results surface (§17.5; deviation 10 chooses absence-of-links over hard blocking).
- [ ] Tests: eyebrows render with the scanned classes; i18n parity green.
- [ ] Commit: `feat(assessment): the two stages name themselves`

### Task 2: The shared scale as the stepper's frame

**Files:**
- Modify: `components/rating/rating-stepper.tsx` (+ its test)
- Modify: `packages/i18n/messages/*.json` (five grade names + five grade meanings + one midpoint explanation, ×5 locales)

**Interfaces:**
- Consumes: `getRatingModel` (criterionId, anchors, midpoints) — unchanged wire.
- Produces: each step 1-5 carries the shared grade NAME (§13.3: Avgränsat krav / Grundläggande till måttligt / Självständigt och etablerat / Avancerat eller brett / Mycket avancerat...) as a scanned label; the criterion's anchor text remains the body; steps 2/4 keep the shared midpoint copy and gain the between-steps explanation; the WC 0 step keeps its explanation. A `HelpMorphButton` after the scale's own heading carries the two-sentence "shared scale vs criterion anchors" boundary (§13.3's closing rule).

- [ ] Read the stepper's current step anatomy; add the grade-name label per step without breaking the existing selection/motivation flow or its tests.
- [ ] Author the five names + meanings in five locales from the masterdokument's own Swedish (§13.3 verbatim for sv; en/nb/da/fi to the same register).
- [ ] The help body: what the shared scale is; the one dominant mistake (a 4 on one criterion is not a 4 on another — §13.3's closing sentence). Respect the char caps.
- [ ] Tests: grade labels render per step; midpoint explanation on 2/4 only; WC 0 unchanged; no weight-family strings anywhere in the rendered output (firewall pin).
- [ ] Commit: `feat(assessment): the shared scale frames every criterion`

### Task 3: Motivation trued to §17.3

**Files:**
- Modify (if needed): `components/rating/rating-stepper.tsx`, the backend rating mutation's validator
- Test: stepper test + backend rating test

**Interfaces:**
- Produces: motivation REQUIRED at values 1, 4, 5 (and the existing WC-0 explanation path), client-gated and backend-revalidated.

- [ ] Verify empirically which values require motivation today (client and backend); report the found state in the task report.
- [ ] True both sides to {1,4,5}; keep inline FormMessage-style errors; backend returns error codes.
- [ ] Tests: each of 1/4/5 without motivation refused on both sides; 2/3 without motivation accepted; mutation-check by widening the set.
- [ ] Commit: `fix(assessment): motivation is required exactly where the method says`

### Task 4: Role-page states pass

**Files:**
- Modify: `components/rating/rating-result.tsx`, `components/roles/role-evaluation-card.tsx` (and whatever renders klar-att-läsa/låst/kalibrerad)
- Test: co-located

**Interfaces:**
- Produces: the three states and the drift chip render per spec §6's wordings ("klar att läsa" as the pre-reveal state; the lock action as the reveal; "bedömd enligt tidigare metod" chip when `lockedAt < approvedAt`; calibrated marker where set).

- [ ] Inventory the current renderings against spec §6; list divergences in the task report before fixing.
- [ ] True wordings/states in all five locales; word-only statuses (no status icons, the owner's standing ruling).
- [ ] Tests: one pin per state + the drift-chip condition both ways.
- [ ] Commit: `fix(assessment): the role page states speak the spec's words`

### Task 5: Decision support in the picker

**Files:**
- Modify: `components/model/library-picker-dialog.tsx` (+ test)
- Possibly modify: `packages/backend/convex/evaluationModel/criteriaLibrary.content.*.ts` accessors (content exists; no new content authored)

**Interfaces:**
- Consumes: `criteriaLibraryContent` client-side (the established seam): shortText, fullDefinition, measures/notMeasures, whenSuitable, whenNotSuitable, controlQuestion, overlap declarations, dimension caps.
- Produces: each picker card surfaces suitability + the control question + overlap warnings against ALREADY-SELECTED criteria + the dimension's cap state (§11's table minus the activation gate; deviation 6 stands: one-click activation).

- [ ] Verify which §11 fields the card already shows (fullDefinition landed earlier); add the missing ones in the card's expanded state, reading text at `text-sm`, scanned chips for overlap/cap.
- [ ] Overlap warnings: compute against the current selection from the library's overlap declarations; render as a warning chip naming the selected counterpart, only when a counterpart IS selected.
- [ ] Tests: a card with a selected overlap counterpart shows the warning naming it; without, none; control question renders; cap chip reflects the dimension's count; activation still one click.
- [ ] Commit: `feat(model): the picker becomes the decision support the method promises`

### Task 6: Audit batchId correlation

**Files:**
- Modify: `packages/backend/convex/lib/audit.ts` (+ `auditPayloads.ts`), `schema` (auditLog gains optional `batchId: v.string()`), the multi-mutation gestures' mutations (compliance dialog sequence; restore; any gesture the inventory finds), their client call sites
- Modify: `apps/dashboard/components/org-audit-log-section.tsx` + `lib/audit-detail.tsx` (+ tests), five-locale labels if any new
- Test: backend audit tests + dashboard log rendering tests

**Interfaces:**
- Produces: a client-generated `batchId` (crypto.randomUUID) passed by gestures that span multiple mutations; `logAudit` stamps it; the log UI groups consecutive same-batch rows into one story row with expandable sub-rows. Single-mutation acts carry none and render exactly as today.

- [ ] Inventory every client gesture that fires >1 audited mutation (the compliance dialog's three-call sequence is the known case; sweep for others and list them).
- [ ] Schema + logAudit: optional batchId, no PII, indexed only if the render path needs it (verify; pagination is by time, grouping is within a page — say so in a comment if unindexed).
- [ ] Log UI: group within the fetched page; the story row shows the gesture's summary (the most specific event's label) and count; sub-rows render the existing detail anatomy unchanged.
- [ ] Tests: the dialog gesture writes N rows sharing one batchId; the log groups them; a lone row renders ungrouped; pager totals unaffected (aggregates count rows, not stories — assert and document).
- [ ] Commit: `feat(audit): one gesture reads as one story`

### Task 7: AI weight-review enrichment and the confirm-save label

**Files:**
- Modify: `packages/backend/convex/ai/suggest.ts` (prompt assembly), its tests
- Modify: `lib/audit-constants.ts` / `lib/audit-detail.tsx` + five-locale labels (confirm-save variant)
- Test: backend prompt tests (structural, no live AI), audit-label coverage

**Interfaces:**
- Produces: the weight-review prompt gains the org's role landscape aggregated per role family (counts + titles are role-level data, permitted; NEVER individual data) and coherence context (current protokoll motivations, the materiality decision); a hard NEVER-FEED-OUTCOMES invariant: no scores, levels, zones, or assessment values may enter any AI prompt, expressed as a code-level guard + a test that greps the assembled prompt fixture for the forbidden families. The `weights.rebalanced` row with zero point changes renders as its own labeled story ("weighting confirmed") instead of "0 items changed".

- [ ] Prompt: extend the assembly with family-aggregated role data (existing org reads; bounded); document the aggregation in a comment.
- [ ] The invariant: a single assembly-time assertion function every AI prompt path calls (extend if one exists) refusing outcome-family fields; test feeds a poisoned context and asserts the refusal.
- [ ] Audit: the zero-change rebalance renders via a dedicated label path in all five locales (reuse the existing payload; label on `count: 0`).
- [ ] Tests: prompt contains family aggregates and no outcome values; poisoned-context refusal; label coverage green.
- [ ] Commit: `feat(ai): the weight review knows the organization it advises`

---

## Self-review

Spec coverage: fas 4's seven spec bullets map 1:1 to tasks 1-7. No placeholders; wordings that require empirical verification are marked as verify-first steps with report-back. Types: no cross-task interface couplings beyond i18n keys and the untouched `getRatingModel` wire.
