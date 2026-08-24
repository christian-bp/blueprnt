# Fas 5: Resultatet försvarar sig — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The result becomes explainable and defensible: the 12 levels render inside their four zones with their own descriptions, the calibration queue turns the engine's flags into human acts, and the approval chapter shows what approving would do before it is done.

**Architecture:** The engine already places (zones, profile caps, kalibrering-krävs since phase 2); this phase renders and operationalizes. New content modules (zone/level descriptions), rebuilt levels surfaces on the Verve anatomy, one new act (confirm placement) on an existing mutation, one new derivation query (consequence diff against the lastApprovedModel buffer), a minimal rules surface over existing mutations.

**Tech Stack:** as fas 4.

**Spec:** `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md` §6, §10.1 Fasning v2 (fas 5), deviations 4 and 11. Behind it: `docs/rollvardering-masterdokument.md` §14 (whole), §17.4, §18.

## Global Constraints

Same as fas 4's (five-locale production quality, framing-prose law, wire-level weight firewall on assessor surfaces, the audit law in full for every new event, reading floor, collision law, skeletons, tests-with-code, Biome zero, docs:sync on any MDX change, branch `feat/role-evaluation-phase-4-6`, no push/merge). Additionally:
- **Zones and results never reach assessor surfaces** (§14.5.1: no zone on the rating view; the reveal-behind-lock discipline stands).
- **Aggregates only, never individuals**, in the consequence analysis (gender-dominance per role/family aggregation; no person rows on any wire this phase adds).
- **Org-scaled derivations stay bounded**: the consequence query derives results twice (current + buffer); it must ride indexes and be measured against the seeded org; if it exceeds sane read counts, chunk or precompute and say so.

---

### Task 1: Zone and level description content

**Files:**
- Create: `packages/backend/convex/evaluationModel/zoneContent.{en,sv,nb,da,fi}.ts` + accessor in the criteriaLibrary content idiom
- Test: content guard test (parity across locales, shape totality)

**Interfaces:**
- Produces: `zoneContent(locale)` returning the four zones (key A-D, name, character, description, typical-profile line; masterdokument §14.5 verbatim for sv) and per-level function texts (12 levels: entry/established/upper per §14.6, keyed by level number and zone).

- [ ] Author sv verbatim from §14.5/§14.6; en/nb/da/fi at production quality, same register as the criteria library content.
- [ ] Shape totality: a compile-time-total record over the zone keys and levels 1-12 so a missing text does not compile; a parity test across the five modules.
- [ ] Commit: `feat(levels): the zones and levels get their own words`

### Task 2: The levels surfaces go zonal

**Files:**
- Modify: `apps/dashboard/components/levels/level-ladder.tsx`, `level-matrix.tsx`, `family-level-matrix.tsx`, `pending-roles.tsx` (+ tests), the /work page composition
- Modify: i18n (zone band labels; content itself comes from Task 1)

**Interfaces:**
- Consumes: Task 1's `zoneContent`; the existing results wires (level, zone already derivable from level per ADR-0022's fixed 3-per-zone mapping — verify where zone comes from on the wire and reuse the engine's mapping, never re-derive in the UI).
- Produces: ladder and matrices grouped in four zone bands (A-D) on the GroupedFrameTable idiom: band header = zone name + level span + description (reading measure), levels inside, the hatch for empty levels stays, the pending list intact, drift/calibrated chips ride along from fas 4.

- [ ] Verify what the results wire carries (level, zone, profileLimited, calibrated) and where the ladder gets rows today.
- [ ] Rebuild grouped-by-zone on the Verve grouped anatomy; collapse/expand per band; filters reopen bands (the GroupedFrameTable convention).
- [ ] Zone descriptions render at the band header (reading measure, text-sm); level rows can reveal their §14.6 function text (entry/established/upper) in the existing disclosure idiom.
- [ ] Skeletons mirror the zonal shape; assessor surfaces untouched (grep-pin: no zone strings on the rate route).
- [ ] Tests: band grouping, empty-level hatch, pending intact, zone-from-engine (mutation: UI re-deriving zone from level must fail), skeleton shape.
- [ ] Commit: `feat(levels): the ladder reads as four zones`

### Task 3: The calibration queue

**Files:**
- Modify: /work page (a queue section), new `apps/dashboard/components/levels/calibration-queue.tsx` (+ test)
- Modify: backend `assessment/` (verify `calibrateAssessment` exists and its audit event; wire it), i18n + audit labels if the event chain is incomplete

**Interfaces:**
- Consumes: existing flags on the results wire: `profileLimited && !calibrated` ("kalibrering krävs"), anchor roles where computed level ≠ `expectedLevel`, stale locks (`lockedAt < approvedAt`, the drift condition fas 4 renders).
- Produces: one queue listing the three classes with the reason stated per row (preconditions-in-words), per row: confirm placement (calls `calibrateAssessment`, audited, toast) or open the role; anchor deviations link the role; stale locks link the role's rate page.

- [ ] Verify `calibrateAssessment`'s existence, signature, audit event, and label chain; complete whatever is missing per the audit law (event, payload, category, subject role, five-locale labels).
- [ ] The queue renders only rows that need action; an empty queue renders the Empty idiom with the way back; the section states its own precondition in words when the model is unapproved.
- [ ] Tests: each class enters the queue on its condition and leaves on resolution; confirm writes the act + audit row; empty state; a non-admin/editor sees per current access rules (member-level per the access model).
- [ ] Commit: `feat(levels): the calibration queue turns flags into acts`

### Task 4: §18 consequence analysis on approval

**Files:**
- Create: backend query in `evaluationModel/` (consequence diff), new `apps/dashboard/components/model/consequence-panel.tsx` (+ tests)
- Modify: approval chapter composition, i18n

**Interfaces:**
- Consumes: the live model + `lastApprovedModel` buffer (both exist); the org's locked assessments; role families; role gender-dominance aggregates derived from assignments (aggregate counts only).
- Produces: on the approval chapter, when a buffer exists AND results would move: the distribution across zones/levels now vs at last approval, the movers (role display names + from→to level; role-level data, allowed), aggregated shifts per family and per gender-dominance group (e.g. women-dominated/men-dominated/mixed by 60% threshold; counts only, no names of people).

- [ ] Backend: derive results under both models (reuse the engine + existing derivation seams; bounded, indexed; measure reads on the seeded org and state the count in the report).
- [ ] The panel renders nothing when there is no buffer or nothing moves (the silence rule); when it speaks: distribution bars per zone (chart law applies if drawn as a chart; a simple table/stat list is acceptable and preferred at first), movers list bounded with a count, the family/gender aggregate table.
- [ ] Gender encoding: if any mark is drawn, the gender-mark law applies in full; prefer plain counts first.
- [ ] Tests: no-buffer silence, no-movement silence, a moved fixture renders from→to, gender aggregates never contain person identifiers (grep-pin), read-bound assertion if the seam allows.
- [ ] Commit: `feat(model): approval shows its consequences first`

### Task 5: The level-rules surface

**Files:**
- Create: `apps/dashboard/components/model/level-rules-panel.tsx` (+ test); modify the approval (or method) chapter composition
- Consumes: `updateLevelRules` / `updateZoneProfileRules` (existing, validated, audited)

**Interfaces:**
- Produces: a minimal read+edit surface for thresholds and zone profile rules: SettingsFrame/SettingsRow idiom, form per the form laws (zod factory, onTouched, isDirty gate), engine validation errors surfaced as codes→messages.

- [ ] Place it where the method work lives (the approval chapter's vicinity; state the placement choice); admin/editor per current access model.
- [ ] Tests: renders current rules, a valid edit saves + audits + toasts, an invalid edit surfaces the engine's refusal inline, isDirty gate.
- [ ] Commit: `feat(model): the level rules become visible and correctable`

### Task 6: Pay-mapping touchpoints verified

**Files:**
- Verify/modify: `packages/backend/convex/payMapping/runs.ts` (grouping key, exclusion seam), tests

**Interfaces:**
- Produces: proof (pins) that new runs group on the 12-level key and exclude non-locked assessments exactly as spec §6 says; fixes only if the verification finds drift.

- [ ] Verify-first like fas 4's task 3: report the found state; pins if correct, fixes if not.
- [ ] Commit: `test(pay): the run pins its level grouping and exclusion seam` (or `fix(pay): ...` if drift found)

---

## Self-review

Spec coverage: fas 5's six spec bullets map to tasks 1-6. The §14.7 six-step anchoring process stays deferred per deviation 11; the §14.3 numbering parameter per deviation 3. No placeholders; verify-first steps marked. Task 2 consumes Task 1's accessor; Task 3-4 consume existing wires; no other cross-task interfaces.
