# Role result contribution breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the role detail per-criterion breakdown on the role's own assessed values plus each criterion's contribution share (sorted biggest-driver-first, animated on reweight), dropping the org-global model-weight column.

**Architecture:** A new pure helper `criterionShares` in `packages/core` derives each criterion's contribution share (ADR-0002: derived, never stored). The `RoleResultCard` calls it client-side from the data `getRoleResult` already returns (no backend payload change), sorts by share, and renders an assessed-value-and-bar list with a Motion reorder/width animation. New i18n strings land in all five locales.

**Tech Stack:** TypeScript, Vitest 4, React + next-intl, Convex (`useQuery`), Motion (`motion/react`), Biome.

**Spec:** `docs/superpowers/specs/2026-06-18-role-result-contribution-breakdown-design.md`

---

## File Structure

- `packages/core/src/types.ts` (modify): add the `CriterionShare` interface next to `CriterionWeight`/`RatingInput`.
- `packages/core/src/scoring.ts` (modify): add the pure `criterionShares()` function next to `scoreRole`. Re-exported automatically by `packages/core/src/index.ts` (`export * from "./scoring"` / `"./types"`).
- `packages/core/src/scoring.test.ts` (modify): add a `describe("criterionShares")` block.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` (modify): add three keys to `dashboard.rating.result` and two to `dashboard.help`.
- `apps/dashboard/components/roles/role-result-card.tsx` (modify): replace the three-column table with the assessed-value + contribution-bar list.
- `apps/dashboard/components/roles/role-result-card.test.tsx` (create): component test.
- `packages/backend/convex/assessment/results.ts` (modify, comment only): update the stale "contributions deliberately absent" note on `getRoleResult`.

Conventions to honor (from CLAUDE.md): no em dashes in any text we write; all code/comments in English; new code ships with tests in the same commit; the pre-commit hook runs Biome + full typecheck + full `turbo run test` and must pass (never `--no-verify`); never push without explicit approval.

---

## Task 1: `criterionShares` pure helper in `packages/core`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/scoring.ts`
- Test: `packages/core/src/scoring.test.ts`

- [ ] **Step 1: Add the `CriterionShare` type**

In `packages/core/src/types.ts`, add this interface immediately after the `CriterionWeight` interface (after its closing brace, around line 15):

```ts
// Per-criterion contribution to a role's score. contribution = value *
// weightPoints; share is its fraction (0..1) of the role's total
// contribution. Derived for display (ADR-0002), never stored.
export interface CriterionShare {
  criterionId: string
  contribution: number
  share: number
}
```

- [ ] **Step 2: Write the failing tests**

In `packages/core/src/scoring.test.ts`, change the `./scoring` import to add `criterionShares`, and add a `WeightPoints` type import from `./weighting`. The top imports become:

```ts
import { describe, expect, it } from "vitest"
import {
  assignBand,
  computeResults,
  criterionShares,
  scoreRole,
} from "./scoring"
import {
  STANDARD_CRITERIA,
  STANDARD_THRESHOLDS,
  allRated,
} from "./scoring.fixtures"
import type { CriterionWeight, RatingInput, RoleRatings } from "./types"
import type { WeightPoints } from "./weighting"
```

Then append this block at the end of the file:

```ts
describe("criterionShares", () => {
  it("splits an all-equal rating purely by weight points", () => {
    // every value 3 => contribution_i = 3 * w_i => share_i = w_i / sum(w).
    const shares = criterionShares(allRated(3), STANDARD_CRITERIA)
    const byId = new Map(shares.map((s) => [s.criterionId, s]))
    expect(byId.get("scope")?.share).toBeCloseTo(5 / 27, 10)
    expect(byId.get("formal")?.share).toBeCloseTo(1 / 27, 10)
    const total = shares.reduce((sum, s) => sum + s.share, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it("returns one entry per criterion, in input order", () => {
    const shares = criterionShares(allRated(4), STANDARD_CRITERIA)
    expect(shares.map((s) => s.criterionId)).toEqual(
      STANDARD_CRITERIA.map((c) => c.criterionId)
    )
  })

  it("gives a higher share to a higher value * weight", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 2 },
      { criterionId: "b", weightPoints: 4 },
    ]
    const ratings: RatingInput[] = [
      { criterionId: "a", value: 5 }, // contribution 10
      { criterionId: "b", value: 5 }, // contribution 20
    ]
    const byId = new Map(
      criterionShares(ratings, criteria).map((s) => [s.criterionId, s])
    )
    expect(byId.get("a")?.share).toBeCloseTo(10 / 30, 10)
    expect(byId.get("b")?.share).toBeCloseTo(20 / 30, 10)
  })

  it("gives equal shares to equal contributions", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
    ]
    const shares = criterionShares(
      [
        { criterionId: "a", value: 4 },
        { criterionId: "b", value: 4 },
      ],
      criteria
    )
    expect(shares[0]?.share).toBeCloseTo(0.5, 10)
    expect(shares[1]?.share).toBeCloseTo(0.5, 10)
  })

  it("zeroes a zero rating's share and leaves the rest summing to 1", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
      { criterionId: "c", weightPoints: 3 },
    ]
    const byId = new Map(
      criterionShares(
        [
          { criterionId: "a", value: 0 },
          { criterionId: "b", value: 4 },
          { criterionId: "c", value: 4 },
        ],
        criteria
      ).map((s) => [s.criterionId, s])
    )
    expect(byId.get("a")?.share).toBe(0)
    expect(byId.get("b")?.share).toBeCloseTo(0.5, 10)
    expect(byId.get("c")?.share).toBeCloseTo(0.5, 10)
  })

  it("returns all-zero shares (no division by zero) when every rating is 0", () => {
    const shares = criterionShares(allRated(0), STANDARD_CRITERIA)
    expect(shares.every((s) => s.share === 0)).toBe(true)
    expect(shares.every((s) => s.contribution === 0)).toBe(true)
  })

  it("treats a criterion with no rating as a zero contribution", () => {
    const criteria: CriterionWeight[] = [
      { criterionId: "a", weightPoints: 3 },
      { criterionId: "b", weightPoints: 3 },
    ]
    const byId = new Map(
      criterionShares([{ criterionId: "a", value: 4 }], criteria).map((s) => [
        s.criterionId,
        s,
      ])
    )
    expect(byId.get("a")?.share).toBe(1)
    expect(byId.get("b")?.share).toBe(0)
  })

  it("throws on weight points outside the 1-5 scale", () => {
    expect(() =>
      criterionShares(
        [{ criterionId: "a", value: 3 }],
        [{ criterionId: "a", weightPoints: 0 as WeightPoints }]
      )
    ).toThrow(/invalid weight points/)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bunx turbo run test --filter=@workspace/core`
Expected: FAIL. `criterionShares` is not exported yet, so the import / `describe` block errors.

- [ ] **Step 4: Implement `criterionShares`**

In `packages/core/src/scoring.ts`, add `CriterionShare` to the type import (it lives in `./types`) and append the function after `scoreRole` (after its closing brace, around line 71). The type import block at the top becomes:

```ts
import type {
  BandThreshold,
  ComputeInput,
  CriterionShare,
  CriterionWeight,
  RatingInput,
  RoleResult,
} from "./types"
```

Function body:

```ts
// Per-criterion share of the weighted total that produces the score (ADR-0002
// derivation; never stored). contribution_i = value_i * weightPoints_i;
// share_i = contribution_i / sum(contribution). When the total is 0 (every
// rating is 0) every share is 0, so there is no division by zero. A criterion
// with no rating contributes 0. Output order follows the criteria order; the
// last value wins for a duplicated rating (display leniency, unlike scoreRole).
export function criterionShares(
  ratings: RatingInput[],
  criteria: CriterionWeight[]
): CriterionShare[] {
  assertUniqueCriteria(criteria)
  const valueById = new Map<string, number>()
  for (const rating of ratings) {
    assertValidRating(rating.value)
    valueById.set(rating.criterionId, rating.value)
  }
  const contributions = criteria.map((criterion) => {
    if (!isWeightPoints(criterion.weightPoints)) {
      throw new Error(`invalid weight points: ${criterion.weightPoints}`)
    }
    const value = valueById.get(criterion.criterionId) ?? 0
    return {
      criterionId: criterion.criterionId,
      contribution: value * criterion.weightPoints,
    }
  })
  const total = contributions.reduce((sum, c) => sum + c.contribution, 0)
  return contributions.map((c) => ({
    criterionId: c.criterionId,
    contribution: c.contribution,
    share: total === 0 ? 0 : c.contribution / total,
  }))
}
```

`assertValidRating` and `isWeightPoints` are already in scope in this file (a local function and an existing import). No other imports change.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx turbo run test --filter=@workspace/core`
Expected: PASS, including the existing `scoreRole`/`assignBand`/`computeResults` suites. Coverage stays above the 95% thresholds in `packages/core/vitest.config.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/scoring.ts packages/core/src/scoring.test.ts
git commit -m "feat(core): add criterionShares to derive per-criterion contribution

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Contribution-breakdown i18n strings (all five locales)

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/sv.json`
- Modify: `packages/i18n/messages/nb.json`
- Modify: `packages/i18n/messages/da.json`
- Modify: `packages/i18n/messages/fi.json`

English is the source locale; add to `en.json` first, then mirror the SAME keys to every other file (the parity test fails if any locale's key set differs). The sv/nb/da/fi values below are drafts and must be flagged for native review. Add every value with the editor (Write/Edit), NEVER via shell `perl`/`sed`, which double-encodes the non-ASCII characters.

- [ ] **Step 1: Add the three `dashboard.rating.result` keys**

In each file, the `dashboard.rating.result` object currently ends with `"farFromAnchors": "..."` (no trailing comma before its closing brace). Add a comma after `farFromAnchors` and insert these three keys. Use the per-locale values:

`en.json`:
```json
      "ratingOutOf": "rated {value} / 5",
      "contributionShare": "{share}%",
      "breakdownLabel": "Contribution"
```
`sv.json`:
```json
      "ratingOutOf": "bedömd {value} / 5",
      "contributionShare": "{share}%",
      "breakdownLabel": "Bidrag"
```
`nb.json`:
```json
      "ratingOutOf": "vurdert {value} / 5",
      "contributionShare": "{share}%",
      "breakdownLabel": "Bidrag"
```
`da.json`:
```json
      "ratingOutOf": "vurderet {value} / 5",
      "contributionShare": "{share}%",
      "breakdownLabel": "Bidrag"
```
`fi.json`:
```json
      "ratingOutOf": "arvioitu {value} / 5",
      "contributionShare": "{share}%",
      "breakdownLabel": "Osuus"
```

- [ ] **Step 2: Add the two `dashboard.help` keys**

In each file's `dashboard.help` object, add these two keys (add a comma after the existing last key in that object first). Per-locale values:

`en.json`:
```json
      "contributionLabel": "What does the contribution bar show?",
      "contributionBody": "Each criterion's share of this role's weighting: your rating times the criterion's weight in the model. The bars are relative to the biggest contributor."
```
`sv.json`:
```json
      "contributionLabel": "Vad visar bidragsstapeln?",
      "contributionBody": "Varje kriteriums andel av rollens viktning: din bedömning gånger kriteriets vikt i modellen. Staplarna är relativa till det största bidraget."
```
`nb.json`:
```json
      "contributionLabel": "Hva viser bidragssøylen?",
      "contributionBody": "Hvert kriteriums andel av rollens vekting: din vurdering ganger kriteriets vekt i modellen. Søylene er relative til det største bidraget."
```
`da.json`:
```json
      "contributionLabel": "Hvad viser bidragssøjlen?",
      "contributionBody": "Hvert kriteriums andel af rollens vægtning: din vurdering gange kriteriets vægt i modellen. Søjlerne er relative til det største bidrag."
```
`fi.json`:
```json
      "contributionLabel": "Mitä osuuspalkki näyttää?",
      "contributionBody": "Kunkin kriteerin osuus roolin painotuksesta: arviosi kerrottuna kriteerin painolla mallissa. Palkit ovat suhteessa suurimpaan osuuteen."
```

- [ ] **Step 3: Verify parity and that the JSON is valid**

Run: `bunx turbo run test --filter=@workspace/i18n`
Expected: PASS. The parity test confirms all five locales share the same key set; a JSON syntax error (e.g. a missing comma) would fail here.

- [ ] **Step 4: Verify no mojibake crept into the non-ASCII values**

Run: `rg -n 'Ã|Â' packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json`
Expected: no output. Any match means a value was double-encoded; re-enter it with the editor. Spot-check that `bedömd`, `søylen`, `vægtning`, `näyttää` render as those exact letters.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): add role result contribution breakdown strings

sv/nb/da/fi values are machine-translation drafts, flagged for native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Contribution-forward `RoleResultCard` + test

**Files:**
- Modify: `apps/dashboard/components/roles/role-result-card.tsx`
- Create: `apps/dashboard/components/roles/role-result-card.test.tsx`
- Modify: `packages/backend/convex/assessment/results.ts` (comment only)

- [ ] **Step 1: Read the animation rules**

Read `docs/ui-animation.md` before writing any Motion code. The relevant rules here: animate the bar with `width` (a value animation), never `scaleX` (FLIP scale distortion); use `layout="position"` on reordering rows so the move never scales their text; do not bypass the global `MotionConfig reducedMotion="user"`. The existing `apps/dashboard/components/bands/band-ladder.tsx` is the reference for `layout="position"` + `SPRING`.

- [ ] **Step 2: Write the failing component test**

Create `apps/dashboard/components/roles/role-result-card.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

vi.mock("convex/react", async () =>
  (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () =>
  (await import("@/test/convex-mocks")).apiModule
)

import { RoleResultCard } from "@/components/roles/role-result-card"

type Result = {
  roleId: string
  title: string
  complete: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  band: number | null
  criteria: {
    criterionId: string
    name: string
    weightPoints: number
    value: number | null
    motivation: string | null
  }[]
}

let result: Result

function setResult(next: Result) {
  result = next
  onQuery((ref) =>
    ref === "assessment.results.getRoleResult" ? result : undefined
  )
}

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleResultCard orgId="org_1" roleId="role_1" />
    </NextIntlClientProvider>
  )
}

describe("RoleResultCard", () => {
  beforeEach(() => {
    setResult({
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
      criteria: [
        // contributions: 15, 20, 2 -> total 37
        { criterionId: "scope", name: "Scope", weightPoints: 5, value: 3, motivation: null },
        { criterionId: "complexity", name: "Complexity", weightPoints: 4, value: 5, motivation: null },
        { criterionId: "people", name: "People", weightPoints: 2, value: 1, motivation: null },
      ],
    })
  })
  afterEach(() => cleanup())

  it("renders criteria sorted by contribution, biggest driver first", () => {
    renderCard()
    const names = screen
      .getAllByText(/^(Scope|Complexity|People)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(["Complexity", "Scope", "People"])
  })

  it("shows the true contribution share per criterion (total 37)", () => {
    renderCard()
    // 20/37 = 54%, 15/37 = 41%, 2/37 = 5%
    expect(screen.getByText("54%")).toBeTruthy()
    expect(screen.getByText("41%")).toBeTruthy()
    expect(screen.getByText("5%")).toBeTruthy()
  })

  it("shows each role's assessed value and drops the model-weight column", () => {
    renderCard()
    expect(screen.getByText("rated 5 / 5")).toBeTruthy()
    expect(screen.queryByText("Weight points")).toBeNull()
  })

  it("renders nothing until the assessment is complete", () => {
    setResult({ ...result, complete: false })
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bunx turbo run test --filter=dashboard`
Expected: FAIL. The current card still renders the "Weight points" header and the old column layout, so the sort-order, share, `rated 5 / 5`, and "no Weight points header" assertions fail.

- [ ] **Step 4: Rewrite `RoleResultCard`**

Replace the entire contents of `apps/dashboard/components/roles/role-result-card.tsx` with:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  criterionShares,
  type RatingValue,
  type WeightPoints,
} from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// Per-role result breakdown: the role's assessed value per criterion plus each
// criterion's contribution share (rating x weight, normalized to the total),
// sorted biggest-driver-first and animated on reweight. The contribution is the
// only per-criterion number that is both role-specific and weight-dependent, so
// it answers "how was this role weighted across the criteria" and is what reacts
// when the model is reweighted. The org-global model weight is not shown here
// (it is identical on every role; it lives in the model view).
export function RoleResultCard({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  if (result === undefined || result === null || !result.complete) return null

  // Contribution shares are derived live by the engine (ADR-0002), never
  // stored. The card only renders when complete, so every rating is present.
  const shares = criterionShares(
    result.criteria.map((c) => ({
      criterionId: c.criterionId,
      value: (c.value ?? 0) as RatingValue,
    })),
    result.criteria.map((c) => ({
      criterionId: c.criterionId,
      weightPoints: c.weightPoints as WeightPoints,
    }))
  )
  const shareById = new Map(shares.map((s) => [s.criterionId, s.share]))
  // Sort by contribution descending; ties keep the model's canonical order (the
  // payload arrives sorted by criterion order, so the array index is canonical).
  const rows = result.criteria
    .map((c, index) => ({
      ...c,
      share: shareById.get(c.criterionId) ?? 0,
      order: index,
    }))
    .sort((a, b) => b.share - a.share || a.order - b.order)
  // Bars normalize to the biggest contributor so the top driver fills its
  // track; the printed percentage stays the true share.
  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("resultHeading")}
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </CardTitle>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-2xl tabular-nums">
            {tResult("scoreOutOf", { score: result.score ?? 0 })}
          </span>
          <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{tResult("bandHighest")}</p>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          {tResult("breakdownLabel")}
          <HelpMorphButton label={tHelp("contributionLabel")}>
            {tHelp("contributionBody")}
          </HelpMorphButton>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <motion.div
              key={row.criterionId}
              layout="position"
              transition={SPRING}
              className="space-y-1"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{row.name}</span>
                <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                  {tResult("ratingOutOf", { value: row.value ?? 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{
                      width: `${maxShare > 0 ? (row.share / maxShare) * 100 : 0}%`,
                    }}
                    transition={SPRING}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                  {tResult("contributionShare", {
                    share: Math.round(row.share * 100),
                  })}
                </span>
              </div>
              {row.motivation !== null && (
                <p className="text-muted-foreground text-xs">{row.motivation}</p>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

Notes:
- `bg-primary` is the neutral primary token, not the brand rose. The brand color is never used on judgement values, and the contribution bar is a judgement value, so keep `bg-primary`.
- The card title already carries the score/band help popover, so the new contribution help sits on its own `breakdownLabel` row (never two popovers on one heading).
- Biome will order the imports on commit; the grouping above is fine as written.

- [ ] **Step 5: Update the stale backend comment**

In `packages/backend/convex/assessment/results.ts`, the `getRoleResult` doc comment (around lines 113-118) says weighted contributions are "deliberately absent." That decision is now reversed on this view. Replace that comment block:

Old:
```ts
// Per-role result: score (normalized 0-100), band outcome, and the
// per-criterion breakdown (localized criterion name, weight points, rating
// value, motivation). Weighted per-criterion contributions are deliberately
// absent: the breakdown reads as ratings against criteria, not as an
// arithmetic worksheet (ADR-0004 keeps the derived percent shares in the
// model view, not here).
```

New:
```ts
// Per-role result: score (normalized 0-100), band outcome, and the
// per-criterion breakdown (localized criterion name, weight points, rating
// value, motivation). The role view derives each criterion's contribution
// share from value * weightPoints client-side (packages/core criterionShares),
// so this payload stays unchanged: weightPoints and value are all it needs.
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bunx turbo run test --filter=dashboard`
Expected: PASS, all four `RoleResultCard` cases plus the existing dashboard suite.

- [ ] **Step 7: Typecheck**

Run: `bunx turbo run typecheck --filter=dashboard`
Expected: PASS. Confirms the new i18n keys (`ratingOutOf`, `contributionShare`, `breakdownLabel`, `contributionLabel`, `contributionBody`) exist in the generated `Messages` type and that the `RatingValue`/`WeightPoints` casts hold.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/roles/role-result-card.tsx apps/dashboard/components/roles/role-result-card.test.tsx packages/backend/convex/assessment/results.ts
git commit -m "feat(roles): show assessed values and contribution share on the role result

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run the full suite the pre-commit hook runs: `bunx turbo run test` and `bunx turbo run typecheck`. Both PASS.
- [ ] Manually confirm in the dashboard (dev): open a fully-rated role (e.g. blueprnt's CEO). The breakdown lists criteria biggest-contribution-first with `rated X / 5` and a `%`; no "Weight points" column. Reweight the model in another tab and watch the rows re-sort and the bars retween.
- [ ] The change is committed but NOT pushed. Pushing requires explicit approval from the user.
