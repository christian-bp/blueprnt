# Role result breakdown: contribution-forward design

**Goal:** Refocus the per-criterion breakdown on the role detail view so it shows the role's own assessed values and each criterion's contribution to the role's score, instead of the org-global model weight that is identical on every role.

**Status:** Approved design. Ready for an implementation plan.

## Background

The role detail view (`apps/dashboard/app/(app)/roles/[roleId]/page.tsx`) mounts `RoleResultCard` (`apps/dashboard/components/roles/role-result-card.tsx`) once a role's assessment is complete. It renders a three-column table per criterion: criterion name (with the rating's motivation as muted sub-text), the model's **weight points**, and the role's **rating** (0-5).

Two problems:

1. The **weight points** column is the org-wide model weight (sourced from the shared `criteria` table). It is identical on every role, so it is the least informative thing to show when looking at a single role.
2. The genuinely role-specific, weight-dependent number, each criterion's **contribution** to the role's score, is rendered nowhere. It was deliberately omitted to avoid an "arithmetic worksheet" feel. But it is exactly the value that answers "how was this role weighted across the criteria," and it is the only per-criterion number that visibly reacts when the model is reweighted.

Blindness is preserved: `RoleRatingCard` still shows progress only and never the values; the values are revealed only here, after completion. This change enriches the post-completion result card, so it does not touch the blind rating flow.

## Decisions (locked with the user)

- Show the **assessed value (rating) as the hero** plus a **contribution-share bar** per criterion. Drop the redundant global weight column.
- **Sort rows by contribution, descending** (biggest driver first), with a stable tiebreak on the canonical criterion order.
- **Animate** the re-sort and the bar widths when the model is reweighted (the card is a live reactive query).
- The contribution derivation lives in **`packages/core`** (pure, deterministic, never stored), consistent with ADR-0002.
- Scope is the role result card only. The overview (`work` page) is untouched (the earlier "weights do not move the overview" report was a false alarm: the overview is correctly reactive, the apparent stillness was the fixed-budget math).

## Detailed design

### View (`role-result-card.tsx`)

The card header is unchanged: heading, the `{score} / 100`, the band badge, the existing score/band help popover, and the "Band 1 is the highest band." line.

The three-column `Table` is replaced by a vertical list, one entry per criterion, each entry:

```
Scope                                   rated 4 / 5
▓▓▓▓▓▓▓▓▓░░░  19%
  motivation text, muted, only when present

Complexity                              rated 5 / 5
▓▓▓▓▓▓▓░░░░░  16%
```

- Criterion name on the left, `rated {value} / 5` on the right of the same line.
- A horizontal bar beneath, followed by the share percentage. The percentage is unit-only inline (`19%`); the breakdown's help popover names what it is a share of (this role's weighting), so the inline copy avoids the word "Score" per the project terminology rule.
- **Bar fill is normalized to the top driver:** `barFillPct = maxShare > 0 ? (share / maxShare) * 100 : 0`. So the largest contributor's bar is full and the others are relative. This is why a 19% share can read as a long bar.
- **The numeric label is the true share** (`Math.round(share * 100)`), so the printed numbers reflect the real proportions even though the bar is normalized.
- Motivation, when present, stays as muted sub-text below the bar.

Rows render in contribution order (see helper below). The card still returns `null` until `result.complete`, so every rating is present at render.

### Contribution math (`packages/core`)

Add a pure helper co-located with `scoreRole` in `packages/core/src/scoring.ts`, exported from the package entry point. It mirrors `scoreRole`'s signature:

```ts
export type CriterionShare = {
  criterionId: string
  contribution: number // value * weightPoints
  share: number // fraction 0..1 of the total contribution
}

// Per-criterion share of the weighted total that produces the score.
// share_i = (value_i * weightPoints_i) / sum_j(value_j * weightPoints_j).
// Returns one entry per criterion, in the input order. If the total
// contribution is 0 (every rating is 0), every share is 0.
export function criterionShares(
  ratings: RatingInput[],
  criteria: CriterionWeight[],
): CriterionShare[]
```

Presentation (sorting, rounding, bar normalization) stays in the component. The helper returns fractions in input order; the component sorts by `share` descending with the original criterion order as the tiebreak (the backend already returns criteria sorted by `order`, so array index is the canonical order).

### Data flow

`getRoleResult` already returns `value` and `weightPoints` per criterion. The component builds the helper's inputs from that payload and computes shares client-side. **No change to the `getRoleResult` validator or payload is required.** The only backend edit is to update the stale comment in `packages/backend/convex/assessment/results.ts` that says weighted contributions are "deliberately absent," since this change deliberately surfaces them on this view.

`@workspace/core` is pure and already imported by the dashboard, so the client-side call is allowed (ADR-0002: no Convex/Next imports in core; this is the reverse direction and is fine).

### Animation

- Rows use Motion (`motion/react`) with the `layout` prop so they spring to new positions when reweighting changes the order.
- Bar fill animates via `width` (a percentage), not `scaleX`, to avoid the FLIP scale distortion documented in `docs/ui-animation.md`.
- Reduced motion is respected globally via the app's `MotionConfig reducedMotion="user"`; do not bypass it.
- `docs/ui-animation.md` must be read before implementing the animation (records bugs already shipped once: FLIP scale distortion, height-vs-box-model clamping, gap collapse, overflow vs corner overlaps).

### Guidance and help

The card title already carries one help popover (score/band). Per the project rule, a second popover is not stacked on the same heading. The breakdown gets its own one-line help next to the bar/share concept, with a new `dashboard.help.*` key explaining: "Each criterion's share of this role's weighting: your rating times the criterion's weight in the model." This is also where the weight stays discoverable now that the weight column is gone.

### i18n

English is the source locale; keys are added to `packages/i18n/messages/en.json` first, then mirrored to every other file the routing lists (sv, nb, da, fi). New keys:

- `dashboard.rating.result.ratingOutOf` = `"rated {value} / 5"`.
- `dashboard.rating.result.contributionShare` = `"{share}%"` (unit-only; the help names what it is a share of).
- `dashboard.help.contributionLabel` and `dashboard.help.contributionBody` for the bar help (body avoids the word "Score"; uses "weighting").

Machine translations for sv/nb/da/fi are drafts and flagged for native review. Non-ASCII strings are added via the editor (the Write/Edit tools), never via shell `perl`/`sed`, to avoid double-encoding; a mojibake grep confirms cleanliness. The i18n parity test must stay green (every locale's key set equals `en.json`).

### Testing

New code ships with tests in the same commit (the pre-commit hook runs the full `turbo run test`).

- **Core (`packages/core`):** unit tests for `criterionShares`:
  - shares sum to 1 (within floating tolerance) for a normal vector,
  - higher `value * weightPoints` yields a higher share,
  - all-equal contributions yield equal shares,
  - a single zero rating yields a zero share for that criterion and unchanged relative order for the rest,
  - all-zero ratings yield all-zero shares with no division by zero.
- **Component (`role-result-card.test.tsx`):** mock `getRoleResult` (mirror the `convex/react` `useQuery` mocking idiom used in `org-switch-menu.test.tsx`) and assert the rows render in contribution-descending order and that the share labels match the computed values. Assert the weight-points column is gone.

## Out of scope

- The overview / `work` page (`BandLadder`, `BandMatrix`): unchanged.
- The model editor and `rebalanceWeights`: unchanged.
- The blind rating flow and `RoleRatingCard`: unchanged.
- Any change to the scoring formula, band thresholds, or the fixed point budget.

## Edge cases

- **Incomplete role:** card already returns `null` until complete; unchanged.
- **All-zero ratings:** total contribution 0, all shares 0, bars empty, labels read `0%`. No division by zero (guarded in the helper).
- **Rounded shares:** per-row rounding may make the printed shares sum to 99 or 101. Acceptable for display; not reconciled.
- **Single criterion:** its share is 100%, bar full.
