# Role Evaluation Phase 1: Engine and Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure engine law (dimensions, method checks, zones, profile placement) and the complete 21-criterion library content, fully additively, so the repo stays green while phase 2 does the schema cutover.

**Architecture:** New pure modules in `packages/core` (no framework imports, no side effects, deterministic; ADR-0002) plus new content modules in `packages/backend/convex/evaluationModel` following the standardTemplate pattern. Nothing existing is modified or removed in this phase: `scoring.ts`, `standardTemplate.*`, schema, and all callers are untouched. Phase 2 swaps them over.

**Tech Stack:** TypeScript, Vitest 4 (`bun run test`, never `bun test`), Bun workspaces, Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md` (read it first; this plan implements its §2.1 constants, §3 engine, and §4 library content for phase 1 of its §10 phasing).

## Global Constraints

- All code, comments, and commit messages in English. No em dashes anywhere. No AI attribution in commits.
- Conventional commits: `type(scope): summary`, lowercase, imperative.
- `packages/core` stays pure: no Convex/Next/React imports, no side effects, no new dependencies.
- Tests ship in the same commit as the code. Run tests per package with `bun run test` from the package directory; the pre-commit hook runs Biome + typecheck + the full turbo test suite and must pass (never `--no-verify`).
- Biome must end at zero: no errors, no warnings.
- Comments state constraints only, never provenance (no task/date/spec references in code comments).
- This phase is additive: do not modify `scoring.ts`, `types.ts` existing exports, `weighting.ts`, `standardTemplate.*`, any schema file, or any caller. New modules and new exports only.
- Do not push. Leave each task committed locally; the phase ends with a file-by-file summary for review.

---

### Task 1: Core dimensions module

**Files:**
- Create: `packages/core/src/dimensions.ts`
- Create: `packages/core/src/dimensions.test.ts`
- Modify: `packages/core/src/index.ts` (add one export line)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces (later tasks and phase 2 rely on these exact names):
  - `DIMENSION_KEYS: readonly ["competence", "effort", "responsibility", "workingConditions"]`, `type DimensionKey`
  - `DIMENSION_MAX_ACTIVE: Record<DimensionKey, number>` (2/2/3/1)
  - `MODEL_MIN_CRITERIA = 6`, `MODEL_MAX_CRITERIA = 8`
  - `DIMENSION_WEIGHT_WARNING_SHARE = 0.4`
  - `isDimensionKey(value: string): value is DimensionKey`
  - `assertValidRatingValue(value: number, dimensionKey: DimensionKey): void`
  - `interface DimensionCriterionInput { criterionId: string; dimensionKey: DimensionKey; weightPoints: number }`
  - `dimensionWeightShares(criteria: DimensionCriterionInput[]): Record<DimensionKey, number>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/dimensions.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  assertValidRatingValue,
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  dimensionWeightShares,
  isDimensionKey,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
} from "./dimensions"

describe("dimension constants", () => {
  it("defines the four dimensions in constitution order", () => {
    expect(DIMENSION_KEYS).toEqual([
      "competence",
      "effort",
      "responsibility",
      "workingConditions",
    ])
  })

  it("caps active criteria per dimension at 2/2/3/1 within a 6-8 model", () => {
    expect(DIMENSION_MAX_ACTIVE).toEqual({
      competence: 2,
      effort: 2,
      responsibility: 3,
      workingConditions: 1,
    })
    expect(MODEL_MIN_CRITERIA).toBe(6)
    expect(MODEL_MAX_CRITERIA).toBe(8)
  })

  it("narrows dimension keys", () => {
    expect(isDimensionKey("effort")).toBe(true)
    expect(isDimensionKey("Effort")).toBe(false)
    expect(isDimensionKey("")).toBe(false)
  })
})

describe("assertValidRatingValue", () => {
  it("accepts 1-5 for every dimension", () => {
    for (const dimension of DIMENSION_KEYS) {
      for (const value of [1, 2, 3, 4, 5]) {
        expect(() => assertValidRatingValue(value, dimension)).not.toThrow()
      }
    }
  })

  it("accepts 0 only for workingConditions", () => {
    expect(() => assertValidRatingValue(0, "workingConditions")).not.toThrow()
    expect(() => assertValidRatingValue(0, "competence")).toThrow()
    expect(() => assertValidRatingValue(0, "effort")).toThrow()
    expect(() => assertValidRatingValue(0, "responsibility")).toThrow()
  })

  it("rejects out-of-range and non-integer values", () => {
    expect(() => assertValidRatingValue(6, "competence")).toThrow()
    expect(() => assertValidRatingValue(-1, "workingConditions")).toThrow()
    expect(() => assertValidRatingValue(2.5, "effort")).toThrow()
    expect(() => assertValidRatingValue(Number.NaN, "effort")).toThrow()
  })
})

describe("dimensionWeightShares", () => {
  it("computes each dimension's share of total weight", () => {
    const shares = dimensionWeightShares([
      { criterionId: "a", dimensionKey: "competence", weightPoints: 3 },
      { criterionId: "b", dimensionKey: "effort", weightPoints: 4 },
      { criterionId: "c", dimensionKey: "responsibility", weightPoints: 5 },
      { criterionId: "d", dimensionKey: "responsibility", weightPoints: 3 },
    ])
    expect(shares.competence).toBeCloseTo(3 / 15)
    expect(shares.effort).toBeCloseTo(4 / 15)
    expect(shares.responsibility).toBeCloseTo(8 / 15)
    expect(shares.workingConditions).toBe(0)
  })

  it("returns all zeros for an empty model", () => {
    expect(dimensionWeightShares([])).toEqual({
      competence: 0,
      effort: 0,
      responsibility: 0,
      workingConditions: 0,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun run test src/dimensions.test.ts`
Expected: FAIL, cannot resolve `./dimensions`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/dimensions.ts`:

```ts
// The four mandatory evaluation dimensions (the model's constitution, EU
// 2023/970): fixed method law, ordered A-D. Companies choose criteria WITHIN
// dimensions; the dimensions themselves are never configurable.
export const DIMENSION_KEYS = [
  "competence",
  "effort",
  "responsibility",
  "workingConditions",
] as const
export type DimensionKey = (typeof DIMENSION_KEYS)[number]

const DIMENSION_KEY_SET = new Set<string>(DIMENSION_KEYS)

export function isDimensionKey(value: string): value is DimensionKey {
  return DIMENSION_KEY_SET.has(value)
}

// Max active criteria per dimension without special decision, and the hard
// 6-8 bounds for the whole model. Responsibility gets more room because it is
// the broadest dimension, but a ceiling so leadership roles cannot collect
// several parallel point paths.
export const DIMENSION_MAX_ACTIVE: Record<DimensionKey, number> = {
  competence: 2,
  effort: 2,
  responsibility: 3,
  workingConditions: 1,
}
export const MODEL_MIN_CRITERIA = 6
export const MODEL_MAX_CRITERIA = 8

// A dimension carrying more than this share of total weight needs a
// documented motivation before approval.
export const DIMENSION_WEIGHT_WARNING_SHARE = 0.4

// Ratings are 1-5. The value 0 exists only for a working-conditions
// criterion and means "the role is not covered by the defined condition".
export function assertValidRatingValue(
  value: number,
  dimensionKey: DimensionKey
): void {
  const min = dimensionKey === "workingConditions" ? 0 : 1
  if (!Number.isInteger(value) || value < min || value > 5) {
    throw new Error(`rating out of range for ${dimensionKey}: ${value}`)
  }
}

export interface DimensionCriterionInput {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: number
}

// Share of the model's total weight per dimension; all zeros when the model
// has no criteria (no division by zero).
export function dimensionWeightShares(
  criteria: DimensionCriterionInput[]
): Record<DimensionKey, number> {
  const totals: Record<DimensionKey, number> = {
    competence: 0,
    effort: 0,
    responsibility: 0,
    workingConditions: 0,
  }
  let total = 0
  for (const criterion of criteria) {
    totals[criterion.dimensionKey] += criterion.weightPoints
    total += criterion.weightPoints
  }
  if (total === 0) return totals
  for (const key of DIMENSION_KEYS) {
    totals[key] = totals[key] / total
  }
  return totals
}
```

Add to `packages/core/src/index.ts` (after the `./weighting` line):

```ts
export * from "./dimensions"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun run test src/dimensions.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole core package**

Run: `cd packages/core && bun run test`
Expected: all existing tests still PASS (nothing existing was touched).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/dimensions.ts packages/core/src/dimensions.test.ts packages/core/src/index.ts
git commit -m "feat(core): add the four evaluation dimensions and rating scale law"
```

---

### Task 2: Core method checks (the §17.2 checklist and §12.4 warnings)

**Files:**
- Create: `packages/core/src/method-checks.ts`
- Create: `packages/core/src/method-checks.test.ts`
- Modify: `packages/core/src/index.ts` (add one export line)

**Interfaces:**
- Consumes from Task 1: `DimensionKey`, `DIMENSION_KEYS`, `DIMENSION_MAX_ACTIVE`, `MODEL_MIN_CRITERIA`, `MODEL_MAX_CRITERIA`, `DIMENSION_WEIGHT_WARNING_SHARE`, `dimensionWeightShares`.
- Produces (builder UI and the approval mutation consume these in phases 2-3):
  - `type MethodCheckKey = "dimensionCoverage" | "workingConditionsTested" | "criterionCount" | "dimensionCaps" | "anchorsComplete" | "documentationComplete" | "dimensionWeightBalance" | "peopleLeadershipWeight" | "overlapPairs"`
  - `interface MethodCheckCriterion { criterionId: string; dimensionKey: DimensionKey; weightPoints: number; hasRequiredAnchors: boolean; documented: boolean; hasWeightMotivation: boolean; libraryKey?: string }`
  - `interface MethodCheckInput { criteria: MethodCheckCriterion[]; workingConditions: { status: "active" | "testedNotMaterial"; hasMotivation: boolean } | null; overlapPairs: readonly (readonly [string, string])[] }`
  - `interface MethodCheck { key: MethodCheckKey; level: "blocker" | "warning"; ok: boolean; criterionIds?: string[]; dimensions?: DimensionKey[]; pairs?: [string, string][]; count?: number }`
  - `validateMethod(input: MethodCheckInput): MethodCheck[]` (always returns all nine checks, stable order)
  - `weightWarnings(input: MethodCheckInput): MethodCheck[]` (the three warning checks only)
  - `methodBlockersPass(checks: MethodCheck[]): boolean`

Semantics to implement exactly:
- `dimensionCoverage` (blocker): competence, effort, responsibility each have at least one criterion; failing dimensions listed in `dimensions`.
- `workingConditionsTested` (blocker): ok when (`status === "testedNotMaterial"` with motivation and zero workingConditions criteria) or (`status === "active"` and exactly one workingConditions criterion). `null` workingConditions is not ok. Contradictions (active without a criterion, testedNotMaterial with one, missing motivation) are not ok.
- `criterionCount` (blocker): total within 6-8 inclusive; `count` carries the total.
- `dimensionCaps` (blocker): no dimension exceeds `DIMENSION_MAX_ACTIVE`; failing dimensions listed.
- `anchorsComplete` (blocker): every criterion has `hasRequiredAnchors`; failures listed in `criterionIds`.
- `documentationComplete` (blocker): every criterion has `documented`; failures listed in `criterionIds`.
- `dimensionWeightBalance` (warning): for each dimension whose share exceeds `DIMENSION_WEIGHT_WARNING_SHARE`, every criterion in that dimension must have `hasWeightMotivation`; otherwise not ok, failing dimensions listed. Uses a strict `>` comparison.
- `peopleLeadershipWeight` (warning): the criterion with `libraryKey === "people-leadership"` at weightPoints >= 4 must have `hasWeightMotivation`. Custom criteria (no libraryKey) never trigger it.
- `overlapPairs` (warning): pairs from `input.overlapPairs` where BOTH keys appear among selected criteria's `libraryKey`s; matched pairs listed in `pairs`. Warnings are informational (ok stays false until no unmotivated finding exists; for overlaps, ok is false when any pair matches; the builder renders it as "check these", it never blocks).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/method-checks.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { MethodCheckCriterion, MethodCheckInput } from "./method-checks"
import {
  methodBlockersPass,
  validateMethod,
  weightWarnings,
} from "./method-checks"

function criterion(
  overrides: Partial<MethodCheckCriterion> & { criterionId: string }
): MethodCheckCriterion {
  return {
    dimensionKey: "responsibility",
    weightPoints: 3,
    hasRequiredAnchors: true,
    documented: true,
    hasWeightMotivation: false,
    ...overrides,
  }
}

// A minimal healthy 6-criterion model: 2 competence, 1 effort, 3
// responsibility, working conditions tested not material.
function healthyInput(): MethodCheckInput {
  return {
    criteria: [
      criterion({ criterionId: "a", dimensionKey: "competence" }),
      criterion({ criterionId: "b", dimensionKey: "competence" }),
      criterion({ criterionId: "c", dimensionKey: "effort" }),
      criterion({ criterionId: "d" }),
      criterion({ criterionId: "e" }),
      criterion({ criterionId: "f" }),
    ],
    workingConditions: { status: "testedNotMaterial", hasMotivation: true },
    overlapPairs: [],
  }
}

describe("validateMethod", () => {
  it("passes a healthy model and returns all nine checks", () => {
    const checks = validateMethod(healthyInput())
    expect(checks).toHaveLength(9)
    expect(checks.every((check) => check.ok)).toBe(true)
    expect(methodBlockersPass(checks)).toBe(true)
  })

  it("fails coverage when a mandatory dimension is empty", () => {
    const input = healthyInput()
    input.criteria = input.criteria.filter(
      (item) => item.dimensionKey !== "effort"
    )
    input.criteria.push(criterion({ criterionId: "g", dimensionKey: "competence" }))
    const check = validateMethod(input).find((c) => c.key === "dimensionCoverage")
    expect(check?.ok).toBe(false)
    expect(check?.dimensions).toEqual(["effort"])
  })

  it("requires the working-conditions materiality decision", () => {
    const input = healthyInput()
    input.workingConditions = null
    const check = validateMethod(input).find(
      (c) => c.key === "workingConditionsTested"
    )
    expect(check?.ok).toBe(false)
    expect(methodBlockersPass(validateMethod(input))).toBe(false)
  })

  it("rejects an active decision without a working-conditions criterion", () => {
    const input = healthyInput()
    input.workingConditions = { status: "active", hasMotivation: true }
    const check = validateMethod(input).find(
      (c) => c.key === "workingConditionsTested"
    )
    expect(check?.ok).toBe(false)
  })

  it("accepts an active decision with exactly one working-conditions criterion", () => {
    const input = healthyInput()
    input.criteria = [
      ...input.criteria.slice(0, 5),
      criterion({ criterionId: "wc", dimensionKey: "workingConditions" }),
    ]
    input.workingConditions = { status: "active", hasMotivation: true }
    const checks = validateMethod(input)
    expect(checks.find((c) => c.key === "workingConditionsTested")?.ok).toBe(true)
    expect(checks.find((c) => c.key === "dimensionCoverage")?.ok).toBe(true)
  })

  it("rejects tested-not-material without motivation", () => {
    const input = healthyInput()
    input.workingConditions = { status: "testedNotMaterial", hasMotivation: false }
    expect(
      validateMethod(input).find((c) => c.key === "workingConditionsTested")?.ok
    ).toBe(false)
  })

  it("enforces the 6-8 criterion count", () => {
    const five = healthyInput()
    five.criteria = five.criteria.slice(0, 5)
    const fiveCheck = validateMethod(five).find((c) => c.key === "criterionCount")
    expect(fiveCheck?.ok).toBe(false)
    expect(fiveCheck?.count).toBe(5)

    const nine = healthyInput()
    nine.criteria = [
      ...nine.criteria,
      criterion({ criterionId: "g", dimensionKey: "effort" }),
      criterion({ criterionId: "h", dimensionKey: "competence" }),
      criterion({ criterionId: "i", dimensionKey: "effort" }),
    ]
    expect(validateMethod(nine).find((c) => c.key === "criterionCount")?.ok).toBe(
      false
    )
  })

  it("enforces per-dimension caps", () => {
    const input = healthyInput()
    input.criteria = [
      ...input.criteria.filter((item) => item.criterionId !== "a"),
      criterion({ criterionId: "g" }),
    ]
    const check = validateMethod(input).find((c) => c.key === "dimensionCaps")
    expect(check?.ok).toBe(false)
    expect(check?.dimensions).toEqual(["responsibility"])
  })

  it("lists criteria missing anchors or documentation", () => {
    const input = healthyInput()
    input.criteria[0] = criterion({
      criterionId: "a",
      dimensionKey: "competence",
      hasRequiredAnchors: false,
    })
    input.criteria[2] = criterion({
      criterionId: "c",
      dimensionKey: "effort",
      documented: false,
    })
    const checks = validateMethod(input)
    expect(checks.find((c) => c.key === "anchorsComplete")?.criterionIds).toEqual([
      "a",
    ])
    expect(
      checks.find((c) => c.key === "documentationComplete")?.criterionIds
    ).toEqual(["c"])
    expect(methodBlockersPass(checks)).toBe(false)
  })

  it("warns on a dimension above 40 percent without motivation and clears with it", () => {
    const input = healthyInput()
    input.criteria = input.criteria.map((item) =>
      item.dimensionKey === "responsibility"
        ? { ...item, weightPoints: 5 }
        : { ...item, weightPoints: 1 }
    )
    const warning = validateMethod(input).find(
      (c) => c.key === "dimensionWeightBalance"
    )
    expect(warning?.ok).toBe(false)
    expect(warning?.dimensions).toEqual(["responsibility"])
    expect(warning?.level).toBe("warning")
    expect(methodBlockersPass(validateMethod(input))).toBe(true)

    input.criteria = input.criteria.map((item) =>
      item.dimensionKey === "responsibility"
        ? { ...item, hasWeightMotivation: true }
        : item
    )
    expect(
      validateMethod(input).find((c) => c.key === "dimensionWeightBalance")?.ok
    ).toBe(true)
  })

  it("warns on people-leadership at weight 4 without motivation", () => {
    const input = healthyInput()
    input.criteria[3] = criterion({
      criterionId: "d",
      libraryKey: "people-leadership",
      weightPoints: 4,
    })
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(false)
    input.criteria[3] = { ...input.criteria[3], hasWeightMotivation: true }
    expect(
      validateMethod(input).find((c) => c.key === "peopleLeadershipWeight")?.ok
    ).toBe(true)
  })

  it("surfaces selected overlap pairs", () => {
    const input = healthyInput()
    input.criteria[0] = criterion({
      criterionId: "a",
      dimensionKey: "competence",
      libraryKey: "knowledge-depth",
    })
    input.criteria[1] = criterion({
      criterionId: "b",
      dimensionKey: "competence",
      libraryKey: "advisory-judgment",
    })
    input.overlapPairs = [
      ["knowledge-depth", "advisory-judgment"],
      ["complexity-ambiguity", "analytical-effort"],
    ]
    const check = validateMethod(input).find((c) => c.key === "overlapPairs")
    expect(check?.ok).toBe(false)
    expect(check?.pairs).toEqual([["knowledge-depth", "advisory-judgment"]])
  })
})

describe("weightWarnings", () => {
  it("returns exactly the three warning checks", () => {
    const warnings = weightWarnings(healthyInput())
    expect(warnings.map((w) => w.key).sort()).toEqual([
      "dimensionWeightBalance",
      "overlapPairs",
      "peopleLeadershipWeight",
    ])
    expect(warnings.every((w) => w.level === "warning")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun run test src/method-checks.test.ts`
Expected: FAIL, cannot resolve `./method-checks`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/method-checks.ts`:

```ts
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  DIMENSION_WEIGHT_WARNING_SHARE,
  type DimensionKey,
  dimensionWeightShares,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
} from "./dimensions"

// The pre-approval checklist and the weighting warnings as one pure rule
// set. Both the approval mutation (blockers refuse) and the builder UI (live
// checklist) consume the same results, so the two can never disagree. The
// engine returns structured findings only; the frontend translates.

export type MethodCheckKey =
  | "dimensionCoverage"
  | "workingConditionsTested"
  | "criterionCount"
  | "dimensionCaps"
  | "anchorsComplete"
  | "documentationComplete"
  | "dimensionWeightBalance"
  | "peopleLeadershipWeight"
  | "overlapPairs"

export interface MethodCheckCriterion {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: number
  hasRequiredAnchors: boolean
  // Kriterieurvalsprotokoll documented and approved.
  documented: boolean
  hasWeightMotivation: boolean
  libraryKey?: string
}

export interface MethodCheckInput {
  criteria: MethodCheckCriterion[]
  workingConditions: {
    status: "active" | "testedNotMaterial"
    hasMotivation: boolean
  } | null
  overlapPairs: readonly (readonly [string, string])[]
}

export interface MethodCheck {
  key: MethodCheckKey
  level: "blocker" | "warning"
  ok: boolean
  criterionIds?: string[]
  dimensions?: DimensionKey[]
  pairs?: [string, string][]
  count?: number
}

const PEOPLE_LEADERSHIP_KEY = "people-leadership"
const HIGH_WEIGHT_FLOOR = 4

export function validateMethod(input: MethodCheckInput): MethodCheck[] {
  const byDimension = new Map<DimensionKey, MethodCheckCriterion[]>()
  for (const key of DIMENSION_KEYS) byDimension.set(key, [])
  for (const criterion of input.criteria) {
    byDimension.get(criterion.dimensionKey)?.push(criterion)
  }
  const count = (key: DimensionKey) => byDimension.get(key)?.length ?? 0

  const uncoveredMandatory = (
    ["competence", "effort", "responsibility"] as const
  ).filter((key) => count(key) === 0)

  const workingConditions = input.workingConditions
  const workingConditionsOk =
    workingConditions !== null &&
    workingConditions.hasMotivation &&
    ((workingConditions.status === "testedNotMaterial" &&
      count("workingConditions") === 0) ||
      (workingConditions.status === "active" &&
        count("workingConditions") === 1))

  const total = input.criteria.length

  const overCap = DIMENSION_KEYS.filter(
    (key) => count(key) > DIMENSION_MAX_ACTIVE[key]
  )

  const missingAnchors = input.criteria
    .filter((criterion) => !criterion.hasRequiredAnchors)
    .map((criterion) => criterion.criterionId)

  const undocumented = input.criteria
    .filter((criterion) => !criterion.documented)
    .map((criterion) => criterion.criterionId)

  const shares = dimensionWeightShares(input.criteria)
  const unbalanced = DIMENSION_KEYS.filter(
    (key) =>
      shares[key] > DIMENSION_WEIGHT_WARNING_SHARE &&
      (byDimension.get(key) ?? []).some(
        (criterion) => !criterion.hasWeightMotivation
      )
  )

  const peopleLeadership = input.criteria.find(
    (criterion) => criterion.libraryKey === PEOPLE_LEADERSHIP_KEY
  )
  const peopleLeadershipOk =
    peopleLeadership === undefined ||
    peopleLeadership.weightPoints < HIGH_WEIGHT_FLOOR ||
    peopleLeadership.hasWeightMotivation

  const selectedLibraryKeys = new Set(
    input.criteria
      .map((criterion) => criterion.libraryKey)
      .filter((key): key is string => key !== undefined)
  )
  const matchedPairs = input.overlapPairs
    .filter(
      ([left, right]) =>
        selectedLibraryKeys.has(left) && selectedLibraryKeys.has(right)
    )
    .map(([left, right]): [string, string] => [left, right])

  return [
    {
      key: "dimensionCoverage",
      level: "blocker",
      ok: uncoveredMandatory.length === 0,
      dimensions: uncoveredMandatory.length > 0 ? uncoveredMandatory : undefined,
    },
    {
      key: "workingConditionsTested",
      level: "blocker",
      ok: workingConditionsOk,
    },
    {
      key: "criterionCount",
      level: "blocker",
      ok: total >= MODEL_MIN_CRITERIA && total <= MODEL_MAX_CRITERIA,
      count: total,
    },
    {
      key: "dimensionCaps",
      level: "blocker",
      ok: overCap.length === 0,
      dimensions: overCap.length > 0 ? [...overCap] : undefined,
    },
    {
      key: "anchorsComplete",
      level: "blocker",
      ok: missingAnchors.length === 0,
      criterionIds: missingAnchors.length > 0 ? missingAnchors : undefined,
    },
    {
      key: "documentationComplete",
      level: "blocker",
      ok: undocumented.length === 0,
      criterionIds: undocumented.length > 0 ? undocumented : undefined,
    },
    {
      key: "dimensionWeightBalance",
      level: "warning",
      ok: unbalanced.length === 0,
      dimensions: unbalanced.length > 0 ? [...unbalanced] : undefined,
    },
    {
      key: "peopleLeadershipWeight",
      level: "warning",
      ok: peopleLeadershipOk,
    },
    {
      key: "overlapPairs",
      level: "warning",
      ok: matchedPairs.length === 0,
      pairs: matchedPairs.length > 0 ? matchedPairs : undefined,
    },
  ]
}

const WARNING_KEYS: readonly MethodCheckKey[] = [
  "dimensionWeightBalance",
  "peopleLeadershipWeight",
  "overlapPairs",
]

export function weightWarnings(input: MethodCheckInput): MethodCheck[] {
  return validateMethod(input).filter((check) =>
    WARNING_KEYS.includes(check.key)
  )
}

export function methodBlockersPass(checks: MethodCheck[]): boolean {
  return checks.every((check) => check.level !== "blocker" || check.ok)
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from "./method-checks"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun run test src/method-checks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/method-checks.ts packages/core/src/method-checks.test.ts packages/core/src/index.ts
git commit -m "feat(core): add method approval checklist and weighting warnings"
```

---

### Task 3: Core zones module (12 levels, profile requirements, placement)

**Files:**
- Create: `packages/core/src/zones.ts`
- Create: `packages/core/src/zones.test.ts`
- Modify: `packages/core/src/index.ts` (add one export line)

**Interfaces:**
- Consumes from Task 1: `DimensionKey`, `assertValidRatingValue`. Consumes from existing code: `assignLevel` from `./scoring`, `RatingInput` from `./types`.
- Produces (phase 2 wires `computeResults` and the model schema to these):
  - `ZONE_KEYS: readonly ["A", "B", "C", "D"]`, `type ZoneKey`
  - `ZONE_LEVEL_RANGES: Record<ZoneKey, { from: number; to: number }>` (A 1-3, B 4-6, C 7-9, D 10-12; `from` is the zone's highest level)
  - `LEVEL_COUNT = 12`
  - `zoneForLevel(level: number): ZoneKey` (throws outside 1-12)
  - `interface LevelRule { level: number; minScore: number }`
  - `interface ZoneProfileRule { zone: ZoneKey; minStep: number }`
  - `DEFAULT_LEVEL_RULES: readonly LevelRule[]` (12 entries), `DEFAULT_ZONE_PROFILE_RULES: readonly ZoneProfileRule[]` (A minStep 4, B minStep 3)
  - `PROFILE_WEIGHT_FLOOR = 4`
  - `profileCriteria<T extends { weightPoints: number }>(criteria: readonly T[]): T[]`
  - `interface PlacementCriterion { criterionId: string; dimensionKey: DimensionKey; weightPoints: number }`
  - `interface ProfileFailure { criterionId: string; required: number; actual: number }`
  - `interface Placement { level: number; zone: ZoneKey; profileLimited: boolean; profileFailures: ProfileFailure[] }`
  - `placeRole(input: { score: number; ratings: RatingInput[]; criteria: PlacementCriterion[]; levelRules: LevelRule[]; zoneProfileRules: ZoneProfileRule[] }): Placement`

Placement semantics (spec §3.2): score-implied level via `assignLevel`; its zone is the candidate. Walk zones from the candidate downward to the first zone whose profile rule the role meets (no rule means it admits; zone D always admits even if a rule exists and fails, because every role must place). If the walk moved, the role takes the landed zone's `from` level (its highest) and `profileLimited: true`. If the walk did not move but the role fails its own zone's rule (only possible in D), the level stays the score-implied one and `profileLimited` is still true; the profile may only ever cap a placement, never lift it. `profileFailures` always reports the candidate zone's unmet requirements (empty when none). A profile criterion without a rating counts as 0.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/zones.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { PlacementCriterion } from "./zones"
import {
  DEFAULT_LEVEL_RULES,
  DEFAULT_ZONE_PROFILE_RULES,
  LEVEL_COUNT,
  placeRole,
  profileCriteria,
  ZONE_LEVEL_RANGES,
  zoneForLevel,
} from "./zones"

describe("zone structure", () => {
  it("maps the twelve levels onto four zones", () => {
    expect(ZONE_LEVEL_RANGES).toEqual({
      A: { from: 1, to: 3 },
      B: { from: 4, to: 6 },
      C: { from: 7, to: 9 },
      D: { from: 10, to: 12 },
    })
    expect(zoneForLevel(1)).toBe("A")
    expect(zoneForLevel(3)).toBe("A")
    expect(zoneForLevel(4)).toBe("B")
    expect(zoneForLevel(9)).toBe("C")
    expect(zoneForLevel(12)).toBe("D")
  })

  it("throws outside 1-12", () => {
    expect(() => zoneForLevel(0)).toThrow()
    expect(() => zoneForLevel(13)).toThrow()
    expect(() => zoneForLevel(1.5)).toThrow()
  })

  it("ships twelve default level rules, strictly ordered, floored at zero", () => {
    expect(DEFAULT_LEVEL_RULES).toHaveLength(LEVEL_COUNT)
    expect(DEFAULT_LEVEL_RULES.map((rule) => rule.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    for (let i = 1; i < DEFAULT_LEVEL_RULES.length; i++) {
      expect(DEFAULT_LEVEL_RULES[i].minScore).toBeLessThan(
        DEFAULT_LEVEL_RULES[i - 1].minScore
      )
    }
    expect(DEFAULT_LEVEL_RULES[11].minScore).toBe(0)
    expect(DEFAULT_LEVEL_RULES[0].minScore).toBeLessThanOrEqual(100)
  })

  it("ships default profile rules for the two upper zones only", () => {
    expect(DEFAULT_ZONE_PROFILE_RULES).toEqual([
      { zone: "A", minStep: 4 },
      { zone: "B", minStep: 3 },
    ])
  })
})

describe("profileCriteria", () => {
  it("selects criteria with weight 4 or 5", () => {
    const criteria = [
      { criterionId: "a", weightPoints: 5 },
      { criterionId: "b", weightPoints: 4 },
      { criterionId: "c", weightPoints: 3 },
      { criterionId: "d", weightPoints: 1 },
    ]
    expect(profileCriteria(criteria).map((c) => c.criterionId)).toEqual([
      "a",
      "b",
    ])
  })
})

function criteria(): PlacementCriterion[] {
  return [
    { criterionId: "scope", dimensionKey: "responsibility", weightPoints: 5 },
    { criterionId: "complexity", dimensionKey: "effort", weightPoints: 4 },
    { criterionId: "knowledge", dimensionKey: "competence", weightPoints: 3 },
  ]
}

// Level rules built for readable tests: level 1 needs 90, then 80, 70, ...
// level 12 needs 0 (score 85 implies level 2, zone A).
function levelRules() {
  return [
    { level: 1, minScore: 90 },
    { level: 2, minScore: 80 },
    { level: 3, minScore: 70 },
    { level: 4, minScore: 60 },
    { level: 5, minScore: 50 },
    { level: 6, minScore: 45 },
    { level: 7, minScore: 40 },
    { level: 8, minScore: 35 },
    { level: 9, minScore: 30 },
    { level: 10, minScore: 20 },
    { level: 11, minScore: 10 },
    { level: 12, minScore: 0 },
  ]
}

describe("placeRole", () => {
  it("keeps the score-implied placement when the profile holds", () => {
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 5 },
        { criterionId: "complexity", value: 4 },
        { criterionId: "knowledge", value: 3 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement).toEqual({
      level: 2,
      zone: "A",
      profileLimited: false,
      profileFailures: [],
    })
  })

  it("caps into the highest zone whose profile the role meets", () => {
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 3 },
        { criterionId: "complexity", value: 3 },
        { criterionId: "knowledge", value: 5 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement.zone).toBe("B")
    expect(placement.level).toBe(4)
    expect(placement.profileLimited).toBe(true)
    expect(placement.profileFailures).toEqual([
      { criterionId: "scope", required: 4, actual: 3 },
      { criterionId: "complexity", required: 4, actual: 3 },
    ])
  })

  it("places without gating when no profile criteria exist", () => {
    const flat = criteria().map((c) => ({ ...c, weightPoints: 3 }))
    const placement = placeRole({
      score: 85,
      ratings: [
        { criterionId: "scope", value: 1 },
        { criterionId: "complexity", value: 1 },
        { criterionId: "knowledge", value: 1 },
      ],
      criteria: flat,
      levelRules: levelRules(),
      zoneProfileRules: [{ zone: "A", minStep: 4 }],
    })
    expect(placement.profileLimited).toBe(false)
    expect(placement.zone).toBe("A")
  })

  it("treats a missing rating on a profile criterion as 0", () => {
    const placement = placeRole({
      score: 85,
      ratings: [{ criterionId: "knowledge", value: 5 }],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
        { zone: "C", minStep: 2 },
      ],
    })
    expect(placement.zone).toBe("D")
    expect(placement.level).toBe(10)
    expect(placement.profileLimited).toBe(true)
  })

  it("keeps the score level when the role fails its own zone D rule", () => {
    const placement = placeRole({
      score: 15,
      ratings: [
        { criterionId: "scope", value: 1 },
        { criterionId: "complexity", value: 1 },
        { criterionId: "knowledge", value: 1 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [{ zone: "D", minStep: 2 }],
    })
    expect(placement.zone).toBe("D")
    expect(placement.level).toBe(11)
    expect(placement.profileLimited).toBe(true)
    expect(placement.profileFailures).toHaveLength(2)
  })

  it("never lifts a role above its score-implied zone", () => {
    const placement = placeRole({
      score: 35,
      ratings: [
        { criterionId: "scope", value: 5 },
        { criterionId: "complexity", value: 5 },
        { criterionId: "knowledge", value: 5 },
      ],
      criteria: criteria(),
      levelRules: levelRules(),
      zoneProfileRules: [
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ],
    })
    expect(placement).toEqual({
      level: 8,
      zone: "C",
      profileLimited: false,
      profileFailures: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun run test src/zones.test.ts`
Expected: FAIL, cannot resolve `./zones`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/zones.ts`:

```ts
import type { DimensionKey } from "./dimensions"
import { assignLevel } from "./scoring"
import type { RatingInput } from "./types"

// The four-zone, twelve-level architecture. Zone membership is structural
// law, never configuration: A is the highest zone and level 1 the highest
// level. A zone's profile rule gates entry on the model's profile criteria
// (weight 4-5): a role cannot reach a high zone on totals alone.

export const ZONE_KEYS = ["A", "B", "C", "D"] as const
export type ZoneKey = (typeof ZONE_KEYS)[number]

export const LEVEL_COUNT = 12

// from = the zone's highest level, to = its lowest.
export const ZONE_LEVEL_RANGES: Record<ZoneKey, { from: number; to: number }> =
  {
    A: { from: 1, to: 3 },
    B: { from: 4, to: 6 },
    C: { from: 7, to: 9 },
    D: { from: 10, to: 12 },
  }

export function zoneForLevel(level: number): ZoneKey {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) {
    throw new Error(`level out of range: ${level}`)
  }
  for (const zone of ZONE_KEYS) {
    if (level <= ZONE_LEVEL_RANGES[zone].to) return zone
  }
  throw new Error(`level out of range: ${level}`)
}

export interface LevelRule {
  level: number
  minScore: number
}

export interface ZoneProfileRule {
  zone: ZoneKey
  minStep: number
}

// Starting points to be calibrated against anchor roles before launch; the
// spread is tighter at the top like the previous seven-level defaults.
export const DEFAULT_LEVEL_RULES: readonly LevelRule[] = [
  { level: 1, minScore: 97 },
  { level: 2, minScore: 92 },
  { level: 3, minScore: 87 },
  { level: 4, minScore: 81 },
  { level: 5, minScore: 75 },
  { level: 6, minScore: 69 },
  { level: 7, minScore: 62 },
  { level: 8, minScore: 55 },
  { level: 9, minScore: 48 },
  { level: 10, minScore: 40 },
  { level: 11, minScore: 31 },
  { level: 12, minScore: 0 },
]

export const DEFAULT_ZONE_PROFILE_RULES: readonly ZoneProfileRule[] = [
  { zone: "A", minStep: 4 },
  { zone: "B", minStep: 3 },
]

// Weight points 4-5 are the high-impact weight classes; carrying one makes a
// criterion part of the model's profile.
export const PROFILE_WEIGHT_FLOOR = 4

export function profileCriteria<T extends { weightPoints: number }>(
  criteria: readonly T[]
): T[] {
  return criteria.filter(
    (criterion) => criterion.weightPoints >= PROFILE_WEIGHT_FLOOR
  )
}

export interface PlacementCriterion {
  criterionId: string
  dimensionKey: DimensionKey
  weightPoints: number
}

export interface ProfileFailure {
  criterionId: string
  required: number
  actual: number
}

export interface Placement {
  level: number
  zone: ZoneKey
  profileLimited: boolean
  profileFailures: ProfileFailure[]
}

export function placeRole(input: {
  score: number
  ratings: RatingInput[]
  criteria: PlacementCriterion[]
  levelRules: LevelRule[]
  zoneProfileRules: ZoneProfileRule[]
}): Placement {
  const scoreLevel = assignLevel(input.score, input.levelRules)
  const candidateZone = zoneForLevel(scoreLevel)

  const profile = profileCriteria(input.criteria)
  const valueById = new Map(
    input.ratings.map((rating) => [rating.criterionId, rating.value])
  )
  const ruleByZone = new Map(
    input.zoneProfileRules.map((rule) => [rule.zone, rule.minStep])
  )

  const failuresAgainst = (zone: ZoneKey): ProfileFailure[] => {
    const minStep = ruleByZone.get(zone)
    if (minStep === undefined || profile.length === 0) return []
    return profile
      .map((criterion) => ({
        criterionId: criterion.criterionId,
        required: minStep,
        actual: valueById.get(criterion.criterionId) ?? 0,
      }))
      .filter((failure) => failure.actual < failure.required)
  }

  // Walk from the score-implied zone downward to the first zone the profile
  // admits; D always admits because every role must place somewhere.
  const startIndex = ZONE_KEYS.indexOf(candidateZone)
  let landedZone: ZoneKey = "D"
  for (let i = startIndex; i < ZONE_KEYS.length; i++) {
    const zone = ZONE_KEYS[i]
    if (zone === "D" || failuresAgainst(zone).length === 0) {
      landedZone = zone
      break
    }
  }

  // The profile may only ever cap a placement, never lift it: a role that
  // fails its own zone's rule with nowhere lower to go keeps its score level
  // and is only flagged.
  const walked = landedZone !== candidateZone
  const profileLimited = walked || failuresAgainst(landedZone).length > 0

  return {
    level: walked ? ZONE_LEVEL_RANGES[landedZone].from : scoreLevel,
    zone: landedZone,
    profileLimited,
    profileFailures: failuresAgainst(candidateZone),
  }
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from "./zones"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun run test src/zones.test.ts`
Expected: PASS. Also run `cd packages/core && bun run test` to confirm the whole package stays green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/zones.ts packages/core/src/zones.test.ts packages/core/src/index.ts
git commit -m "feat(core): add zone architecture with profile-gated placement"
```

---

### Task 4: Library structural module, English content, guard tests

**Files:**
- Create: `docs/rollvardering-masterdokument.md` (copy of the source document)
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.ts`
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.content.en.ts`
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.test.ts`

**Interfaces:**
- Consumes from Task 1: `type DimensionKey` (import from `@workspace/core`). Consumes from `@workspace/constants`: `INDUSTRY_KEYS`, `type IndustryKey`.
- Produces (phase 2 mutations and phase 3 picker consume these):
  - `CRITERIA_LIBRARY_KEYS: readonly [...21 keys]`, `type CriteriaLibraryKey`
  - `LIBRARY_DIMENSION: Record<CriteriaLibraryKey, DimensionKey>`
  - `LIBRARY_OVERLAP_PAIRS: readonly (readonly [CriteriaLibraryKey, CriteriaLibraryKey])[]`
  - `LIBRARY_INDUSTRY_HINTS: Record<IndustryKey, readonly CriteriaLibraryKey[]>`
  - `type CriteriaLibraryLocale = "sv" | "en" | "nb" | "da" | "fi"`
  - `REGISTERED_LIBRARY_LOCALES: string[]` (the locales actually registered; the parity guard asserts against it)
  - `criteriaLibraryContent(locale: string): CriteriaLibraryContent` (unknown locale falls back to en)
  - From the en content module: `interface CriteriaLibraryEntryContent { name; shortUiText; fullDefinition; measures; notMeasures; whenSuitable; whenNotSuitable; controlQuestion; assessmentQuestion; anchor1; anchor3; anchor5; anchor2?; anchor4? }` (all string fields), `interface CriteriaLibraryDimensionContent { name; question; why }`, `interface CriteriaLibraryContent { dimensions: Record<DimensionKey, CriteriaLibraryDimensionContent>; workingConditionsTest: { question: string; notMaterialLabel: string }; sharedScale: Record<"1" | "2" | "3" | "4" | "5", { name: string; meaning: string }>; midpoints: { step2: string; step4: string }; criteria: Record<CriteriaLibraryKey, CriteriaLibraryEntryContent> }`

The 21 keys and their dimensions (spec §4):

| Key | Dimension | Masterdokument source |
|---|---|---|
| knowledge-depth | competence | §7.1 |
| knowledge-breadth | competence | §7.2 |
| formal-qualifications | competence | §7.3 |
| domain-knowledge | competence | §7.4 |
| advisory-judgment | competence | §7.5 |
| complexity-ambiguity | effort | §8.1 |
| analytical-effort | effort | §8.2 |
| communication-effort | effort | §8.3 |
| operational-intensity | effort | §8.4 |
| physical-sensory | effort | §8.5 |
| scope-impact | responsibility | §9.1 |
| autonomy-mandate | responsibility | §9.2 |
| risk-consequence | responsibility | §9.3 |
| people-leadership | responsibility | §9.4 |
| resource-capacity | responsibility | §9.5 |
| business-customer | responsibility | §9.6 |
| compliance-control | responsibility | §9.7 |
| safety-exposure | workingConditions | §10.1 |
| on-call | workingConditions | §10.2 |
| irregularity-mobility | workingConditions | §10.3 |
| restricted-environments | workingConditions | §10.4 |

Overlap pairs (from the §7-10 overlap columns; only cross-checkable pairs, and no workingConditions-internal pairs since that dimension caps at one):

```ts
[
  ["knowledge-depth", "knowledge-breadth"],
  ["knowledge-depth", "formal-qualifications"],
  ["knowledge-depth", "domain-knowledge"],
  ["knowledge-depth", "advisory-judgment"],
  ["complexity-ambiguity", "analytical-effort"],
  ["physical-sensory", "safety-exposure"],
  ["scope-impact", "people-leadership"],
  ["risk-consequence", "compliance-control"],
  ["compliance-control", "restricted-environments"],
]
```

Industry hints (derived from the masterdokument's per-dimension combination tables and §15; hints are picker chips, never auto-selection):

```ts
{
  itTelecom: ["knowledge-depth", "complexity-ambiguity", "scope-impact", "autonomy-mandate", "risk-consequence"],
  consulting: ["knowledge-depth", "complexity-ambiguity", "communication-effort", "scope-impact", "autonomy-mandate", "business-customer"],
  finance: ["knowledge-depth", "formal-qualifications", "complexity-ambiguity", "scope-impact", "risk-consequence", "compliance-control"],
  healthcare: ["knowledge-depth", "formal-qualifications", "complexity-ambiguity", "scope-impact", "risk-consequence", "on-call"],
  manufacturing: ["knowledge-depth", "domain-knowledge", "complexity-ambiguity", "physical-sensory", "scope-impact", "risk-consequence", "safety-exposure"],
  publicSector: ["knowledge-depth", "formal-qualifications", "complexity-ambiguity", "scope-impact", "risk-consequence", "compliance-control"],
  retail: ["knowledge-depth", "complexity-ambiguity", "operational-intensity", "scope-impact", "autonomy-mandate", "risk-consequence"],
  realEstateConstruction: ["knowledge-depth", "domain-knowledge", "complexity-ambiguity", "scope-impact", "risk-consequence", "resource-capacity", "safety-exposure"],
  other: ["knowledge-depth", "complexity-ambiguity", "scope-impact", "autonomy-mandate", "risk-consequence"],
}
```

- [ ] **Step 1: Copy the masterdokument into the repo**

```bash
cp "/Users/ce/Downloads/Masterdokument_for_anpassningsbar_rollvardering_260818.md" docs/rollvardering-masterdokument.md
```

Swedish domain documents keep Swedish filenames; this file is the content source every library entry cites.

- [ ] **Step 2: Write the failing guard test**

Create `packages/backend/convex/evaluationModel/criteriaLibrary.test.ts`:

```ts
import { INDUSTRY_KEYS } from "@workspace/constants"
import { DIMENSION_KEYS } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERIA_LIBRARY_KEYS,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
  LIBRARY_INDUSTRY_HINTS,
  LIBRARY_OVERLAP_PAIRS,
  REGISTERED_LIBRARY_LOCALES,
} from "./criteriaLibrary"

const LOCALES = ["en", "sv", "nb", "da", "fi"] as const
// sv/nb/da/fi land in Tasks 5-6; extend this list there.
const PRESENT_LOCALES = ["en"] as const

describe("library structure", () => {
  it("has 21 criteria distributed 5/5/7/4 across the dimensions", () => {
    expect(CRITERIA_LIBRARY_KEYS).toHaveLength(21)
    const counts = { competence: 0, effort: 0, responsibility: 0, workingConditions: 0 }
    for (const key of CRITERIA_LIBRARY_KEYS) {
      counts[LIBRARY_DIMENSION[key]] += 1
    }
    expect(counts).toEqual({
      competence: 5,
      effort: 5,
      responsibility: 7,
      workingConditions: 4,
    })
  })

  it("keeps overlap pairs unique, non-reflexive, and resolvable", () => {
    const seen = new Set<string>()
    for (const [left, right] of LIBRARY_OVERLAP_PAIRS) {
      expect(CRITERIA_LIBRARY_KEYS).toContain(left)
      expect(CRITERIA_LIBRARY_KEYS).toContain(right)
      expect(left).not.toBe(right)
      const id = [left, right].sort().join("|")
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })

  it("covers every industry with resolvable hints", () => {
    for (const industry of INDUSTRY_KEYS) {
      const hints = LIBRARY_INDUSTRY_HINTS[industry]
      expect(hints.length).toBeGreaterThanOrEqual(5)
      for (const key of hints) {
        expect(CRITERIA_LIBRARY_KEYS).toContain(key)
      }
    }
  })
})

describe("library content", () => {
  it.each(PRESENT_LOCALES)("locale %s is complete", (locale) => {
    // The en fallback would mask a missing locale, so registration is
    // asserted explicitly: completeness of a fallback is not parity.
    expect(REGISTERED_LIBRARY_LOCALES).toContain(locale)
    const content = criteriaLibraryContent(locale)
    for (const dimension of DIMENSION_KEYS) {
      const entry = content.dimensions[dimension]
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.question.length).toBeGreaterThan(0)
      expect(entry.why.length).toBeGreaterThan(0)
    }
    expect(content.workingConditionsTest.question.length).toBeGreaterThan(0)
    expect(content.workingConditionsTest.notMaterialLabel.length).toBeGreaterThan(0)
    for (const step of ["1", "2", "3", "4", "5"] as const) {
      expect(content.sharedScale[step].name.length).toBeGreaterThan(0)
      expect(content.sharedScale[step].meaning.length).toBeGreaterThan(0)
    }
    expect(content.midpoints.step2.length).toBeGreaterThan(0)
    expect(content.midpoints.step4.length).toBeGreaterThan(0)
    for (const key of CRITERIA_LIBRARY_KEYS) {
      const entry = content.criteria[key]
      for (const field of [
        "name",
        "shortUiText",
        "fullDefinition",
        "measures",
        "notMeasures",
        "whenSuitable",
        "whenNotSuitable",
        "controlQuestion",
        "assessmentQuestion",
        "anchor1",
        "anchor3",
        "anchor5",
      ] as const) {
        expect(entry[field].length, `${locale}.${key}.${field}`).toBeGreaterThan(0)
      }
    }
  })

  it("falls back to en for unknown locales", () => {
    expect(criteriaLibraryContent("xx")).toEqual(criteriaLibraryContent("en"))
  })

  it("will cover every configured locale", () => {
    // Reminder guard: flip PRESENT_LOCALES to LOCALES as Tasks 5-6 land.
    expect(LOCALES).toHaveLength(5)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: FAIL, cannot resolve `./criteriaLibrary`.

- [ ] **Step 4: Write the structural module**

Create `packages/backend/convex/evaluationModel/criteriaLibrary.ts` with the keys, `LIBRARY_DIMENSION`, `LIBRARY_OVERLAP_PAIRS`, and `LIBRARY_INDUSTRY_HINTS` exactly as tabled above, plus:

```ts
import type { IndustryKey } from "@workspace/constants"
import type { DimensionKey } from "@workspace/core"
import {
  criteriaLibraryContentEn,
  type CriteriaLibraryContent,
} from "./criteriaLibrary.content.en"

// The controlled criteria library (the masterdokument's sections 7-10): a
// menu of 21 defined criteria the method builder selects from. Structure
// lives here so it cannot drift between locales; prose lives in the
// per-locale content modules. Source: docs/rollvardering-masterdokument.md.

export type CriteriaLibraryLocale = "sv" | "en" | "nb" | "da" | "fi"

const CONTENT_BY_LOCALE: Partial<
  Record<CriteriaLibraryLocale, CriteriaLibraryContent>
> = {
  en: criteriaLibraryContentEn,
}

// The parity guard asserts against this: the en fallback below would
// otherwise make a missing locale look complete.
export const REGISTERED_LIBRARY_LOCALES = Object.keys(CONTENT_BY_LOCALE)

export function criteriaLibraryContent(locale: string): CriteriaLibraryContent {
  return (
    CONTENT_BY_LOCALE[locale as CriteriaLibraryLocale] ?? criteriaLibraryContentEn
  )
}
```

(Tasks 5-6 add their locales to `CONTENT_BY_LOCALE`.)

- [ ] **Step 5: Write the English content module**

Create `packages/backend/convex/evaluationModel/criteriaLibrary.content.en.ts`. It defines the content types (the en module is type-defining, like the standard template) and the complete English content. Authoring sources, field by field:

| Field | Masterdokument source |
|---|---|
| `name`, `whenSuitable`, `measures`, `notMeasures` | The criterion's row in the §7-§10 table (columns: Kriterium, Nar det ar lampligt, Vad det mater, Vad det inte mater) |
| `whenNotSuitable` | The row's Overlappningsregel column |
| `shortUiText` | One sentence condensed from `measures` |
| `fullDefinition` | Measures + boundary, 2-3 sentences composed from the row |
| `controlQuestion` | Composed from §6.2's four selection questions applied to the criterion's own distinction |
| `assessmentQuestion` | "What level of requirement does this role have for [the criterion's subject]?" following §13's pattern |
| `anchor1/3/5` | §13.5 verbatim for scope-impact, complexity-ambiguity, risk-consequence; authored for the other 18 following §13.3 (shared scale meanings) and §13.4 (anchor functions: 1 = clearly bounded requirement, 3 = independent established requirement, 5 = very advanced or business-critical requirement), phrased in the criterion's own subject matter |
| `dimensions` | §5's table (name, Grundfraga, Varfor den behovs) |
| `workingConditionsTest.question` | §10.1's boxed question |
| `sharedScale` | §13.3's table (Benamning + Gemensam betydelse per step) |
| `midpoints.step2/step4` | §13.4 ("a considered midpoint between 1 and 3" / "between 3 and 5") |

Type skeleton and one complete worked entry (write all 21 to this standard):

```ts
import type { DimensionKey } from "@workspace/core"
import type { CriteriaLibraryKey } from "./criteriaLibrary"

export interface CriteriaLibraryEntryContent {
  name: string
  shortUiText: string
  fullDefinition: string
  measures: string
  notMeasures: string
  whenSuitable: string
  whenNotSuitable: string
  controlQuestion: string
  assessmentQuestion: string
  anchor1: string
  anchor3: string
  anchor5: string
  anchor2?: string
  anchor4?: string
}

export interface CriteriaLibraryDimensionContent {
  name: string
  question: string
  why: string
}

export interface CriteriaLibraryContent {
  dimensions: Record<DimensionKey, CriteriaLibraryDimensionContent>
  workingConditionsTest: { question: string; notMaterialLabel: string }
  sharedScale: Record<"1" | "2" | "3" | "4" | "5", { name: string; meaning: string }>
  midpoints: { step2: string; step4: string }
  criteria: Record<CriteriaLibraryKey, CriteriaLibraryEntryContent>
}

export const criteriaLibraryContentEn: CriteriaLibraryContent = {
  dimensions: {
    competence: {
      name: "Competence",
      question:
        "What knowledge, skills, experience and qualifications does the role require?",
      why: "Protects specialist, professional and qualification-heavy roles from being undervalued.",
    },
    // effort, responsibility, workingConditions from the section 5 table.
  },
  workingConditionsTest: {
    question:
      "Is there at least one role family where special working conditions are a recurring, objective and material part of the role's requirements, not already captured correctly by another criterion?",
    notMaterialLabel: "Tested, not materially relevant",
  },
  sharedScale: {
    "1": {
      name: "Bounded requirement",
      meaning:
        "The requirement is clearly defined, local or limited in scope. The role works mainly within established frames.",
    },
    // steps 2-5 from the section 13.3 table.
  },
  midpoints: {
    step2: "A considered midpoint between steps 1 and 3.",
    step4: "A considered midpoint between steps 3 and 5.",
  },
  criteria: {
    "scope-impact": {
      name: "Scope and impact",
      shortUiText:
        "The role's reach: from a bounded task to team, function, several functions or the whole company.",
      fullDefinition:
        "Captures how far the role's results and decisions reach in the organization, from clearly bounded own tasks to company-wide impact. It measures reach, not formal authority.",
      measures:
        "The role's reach: from a bounded task to team, function, several functions or company.",
      notMeasures:
        "Formal people responsibility, budget size or the mandate itself.",
      whenSuitable: "Almost always relevant.",
      whenNotSuitable:
        "Should not be combined with a separate criterion that only measures organizational reach.",
      controlQuestion:
        "Does the difference in reach between your roles matter on its own, beyond mandate and consequence?",
      assessmentQuestion:
        "How far does this role's normal and lasting impact reach?",
      anchor1:
        "The role mainly affects the quality, efficiency or results of its own clearly bounded tasks.",
      anchor2:
        "The role affects a bounded work area or recurring delivery within a team.",
      anchor3:
        "The role has independent responsibility for results within a clear area and affects the delivery and priorities of the team or adjacent functions.",
      anchor4:
        "The role affects several teams, a function or a significant part of the business through choices, priorities or solutions with lasting consequences.",
      anchor5:
        "The role affects the company's overall direction, results or ability to succeed through decisions and responsibility with company-wide or strategic effect.",
    },
    // The remaining 20 entries to the same standard. scope-impact,
    // complexity-ambiguity and risk-consequence take their anchors from
    // section 13.5; the other 18 get authored anchors per the recipe above.
    // scope-impact includes anchor2/anchor4 because section 13.5 provides
    // them; entries without source midpoints omit anchor2/anchor4.
  },
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: PASS with all 21 entries complete (the guard fails on any empty field).

- [ ] **Step 7: Commit**

```bash
git add docs/rollvardering-masterdokument.md packages/backend/convex/evaluationModel/criteriaLibrary.ts packages/backend/convex/evaluationModel/criteriaLibrary.content.en.ts packages/backend/convex/evaluationModel/criteriaLibrary.test.ts
git commit -m "feat(backend): add the 21-criterion library structure and English content"
```

---

### Task 5: Swedish library content

**Files:**
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.content.sv.ts`
- Modify: `packages/backend/convex/evaluationModel/criteriaLibrary.ts` (register sv in `CONTENT_BY_LOCALE`)
- Modify: `packages/backend/convex/evaluationModel/criteriaLibrary.test.ts` (add "sv" to `PRESENT_LOCALES`)

**Interfaces:**
- Consumes from Task 4: `CriteriaLibraryContent` type, the guard test.
- Produces: `criteriaLibraryContentSv: CriteriaLibraryContent`.

- [ ] **Step 1: Extend the guard test**

In `criteriaLibrary.test.ts`, change `PRESENT_LOCALES` to `["en", "sv"] as const`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: FAIL on the registration assertion (`REGISTERED_LIBRARY_LOCALES` does not contain "sv").

- [ ] **Step 3: Write the Swedish content**

Create `criteriaLibrary.content.sv.ts` exporting `criteriaLibraryContentSv: CriteriaLibraryContent`. This is the source locale in substance: take names, definitions, measures/not-measures, suitability, overlap boundaries, the §5 dimension rows, the §10.1 question, the §13.3 scale and the §13.5 anchors **verbatim from `docs/rollvardering-masterdokument.md`** (they are already Swedish). Compose `shortUiText`, `controlQuestion`, `assessmentQuestion` and the 18 authored anchor sets as faithful Swedish counterparts of the English ones. Register it in `criteriaLibrary.ts`:

```ts
import { criteriaLibraryContentSv } from "./criteriaLibrary.content.sv"

const CONTENT_BY_LOCALE: Partial<
  Record<CriteriaLibraryLocale, CriteriaLibraryContent>
> = {
  en: criteriaLibraryContentEn,
  sv: criteriaLibraryContentSv,
}
```

Never write non-ASCII Swedish through shell perl/sed (mojibake hazard); write the file directly with the editor tool.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/evaluationModel/criteriaLibrary.content.sv.ts packages/backend/convex/evaluationModel/criteriaLibrary.ts packages/backend/convex/evaluationModel/criteriaLibrary.test.ts
git commit -m "feat(backend): add Swedish criteria library content"
```

---

### Task 6: Norwegian, Danish, Finnish drafts and full parity

**Files:**
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.content.nb.ts`
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.content.da.ts`
- Create: `packages/backend/convex/evaluationModel/criteriaLibrary.content.fi.ts`
- Modify: `packages/backend/convex/evaluationModel/criteriaLibrary.ts` (register all locales)
- Modify: `packages/backend/convex/evaluationModel/criteriaLibrary.test.ts` (PRESENT_LOCALES becomes all five; delete the reminder guard test)

**Interfaces:**
- Consumes from Tasks 4-5: the content type and the sv/en reference content.
- Produces: `criteriaLibraryContentNb`, `criteriaLibraryContentDa`, `criteriaLibraryContentFi`, and `CONTENT_BY_LOCALE` becomes a total `Record<CriteriaLibraryLocale, CriteriaLibraryContent>`.

- [ ] **Step 1: Extend the guard test**

`PRESENT_LOCALES` becomes `["en", "sv", "nb", "da", "fi"] as const`; delete the "will cover every configured locale" reminder test and the now-unused `LOCALES` constant.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: FAIL on the registration assertion for nb, da, and fi.

- [ ] **Step 3: Write the three drafts**

Translate from sv (primary) cross-checked against en. These are machine-drafted locales: keep international job-title-style terms natural per Nordic conventions, and keep terminology consistent within each locale. Register all three in `CONTENT_BY_LOCALE` and change its type to the total `Record<CriteriaLibraryLocale, CriteriaLibraryContent>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && bun run test convex/evaluationModel/criteriaLibrary.test.ts`
Expected: PASS for all five locales.

- [ ] **Step 5: Run the full backend package and the whole repo gate**

Run: `cd packages/backend && bun run test`
Expected: PASS (nothing existing consumed the new modules yet).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/evaluationModel/criteriaLibrary.content.nb.ts packages/backend/convex/evaluationModel/criteriaLibrary.content.da.ts packages/backend/convex/evaluationModel/criteriaLibrary.content.fi.ts packages/backend/convex/evaluationModel/criteriaLibrary.ts packages/backend/convex/evaluationModel/criteriaLibrary.test.ts
git commit -m "feat(backend): add nb, da and fi criteria library drafts"
```

The nb/da/fi content is a machine draft: flag it for native review in the phase summary.

---

## Phase completion

After Task 6: present the file-by-file change summary for review (house rule). The phase is done when all six tasks are committed, `bun run test` is green at the root, and the summary flags the nb/da/fi drafts plus the 18 authored anchor sets for Christian's native-language review.

**Phases 2-6 are out of this plan's scope.** They are mapped in the spec (§10) and each gets its own plan document written when its predecessors have landed, against the interfaces this phase actually produced.
