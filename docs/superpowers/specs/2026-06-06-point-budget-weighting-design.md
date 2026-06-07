# Point-budget weighting: design

**Date:** 2026-06-06. **Decision record:** `docs/adr/0004-point-budget-weighting.md` (authoritative). **Source document:** `docs/contexts/evaluation-model/viktning-poangbudget.md`. This spec records the slice scope and the implementation-facing decisions; the why lives in the ADR.

## What changes

Criteria are weighted with visible **1-5 weight points** under a hard **point budget = criteria count x 3** (exact sum, zero-sum reprioritization). This replaces the fixed 7-level importance scale with hidden Excel weights (8-18). Percent shares are derived display values. Role scores normalize to a fixed **0-100 integer scale**.

## Decisions (confirmed by the founder 2026-06-06)

1. **Score formula:** `score = floor(20 * sum(rating * weightPoints) / sum(weightPoints))`, an integer 0-100. Flooring makes comparison against integer thresholds exact (displayed >= threshold iff the unfloored score is). Division by `sum(weightPoints)` (not the theoretical budget) keeps the engine well-defined for any input; persisted models are always balanced anyway.
2. **Default template allocation** follows the source document's section 6 example verbatim (normative): scope 5, complexity 4, autonomy 4, risk 3, knowledge 3, stakeholders 3, financial 2, people 2, formal 1 (sum 27). Display order follows that table. This deliberately reprioritizes against the Excel prototype (risk down, autonomy up).
3. **Default band thresholds** translate the prototype's thresholds as share of max: 98/83/74/63/53/41/0. To be calibrated before launch.
4. **AI weight review suggests balanced moves** (take N points from criterion X, give to criterion Y). Each move is itself zero-sum, so HR can confirm any subset (checkbox UX preserved). The AI model draft must emit a balanced allocation; the server validates and deterministically repairs toward 3s before saving.

## Invariant enforcement (always-balanced database)

- `addCriterion` always assigns 3 points (budget grows by 3 simultaneously, balance preserved). The importance argument is removed.
- Reweighting is atomic: one `rebalanceWeights` mutation receives the full allocation, validates integers 1-5 and the exact sum, produces one band-shift diff and one audit row per save. The editor edits locally with a live remaining-points meter.
- `removeCriterion` deterministically redistributes the difference (3 - points) across the survivors with the same repair walk as AI drafts, and records every adjustment in the audit payload. (Revised 2026-06-07: the original stand-at-3 requirement forced a backwards flow where a light criterion had to be weighted UP before it could be removed.)
- AI draft confirmation inserts a full balanced set in one mutation.

## Out of scope

- Band threshold editing UI (E2).
- Recalibration of the default thresholds against real data (pre-launch task).
- Renaming the i18n `assessment.score` label ("Totalpoäng" stays; only the scale changes).

## Consequences for tests

Excel-parity goldens (540 scale) are obsolete by design; new goldens on the 0-100 scale. The all-3 allocation and the standard template allocation are the two canonical fixtures.
