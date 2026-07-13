# P1 gender-gap primary view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a kartläggning's detail page, show two always-on gender pay-gap tables (lika arbete + likvärdigt arbete) with four severity flags, computed by a pure `packages/core` engine over the frozen snapshot.

**Architecture:** A pure, deterministic gap engine in `packages/core` (`classifyPayGap` + `computeGenderGap`, reusing `fteTotalMonthlyComp`) is the single source of the math. An org-scoped Convex query `getPayMappingGap` reads a run's frozen rows, groups them, calls the engine, and masks statistically-insufficient (⚪) groups on the way out. A grouped-table UI renders the two views with a traffic-light flag chip and content-shaped skeleton, placed above the population table on the detail page.

**Tech Stack:** TypeScript, `packages/core` (pure), Convex (edge-runtime + convex-test), Next.js 16 App Router, shadcn/Base UI + Tailwind v4, next-intl, Vitest 4, Bun.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-p1-gender-gap-view-design.md`. ADR-0012 (primary view), ADR-0002 (engine purity), ADR-0011 (frozen snapshot is read-only).
- `packages/core` stays pure and deterministic: no Convex/Next/React imports, no clock, no I/O, no randomness. A pure dependency (`@workspace/constants`) is allowed.
- Flag thresholds are exact: insufficient (⚪) if `womenCount === 0 || menCount === 0 || womenCount + menCount < 4 || gapPct === null`; else critical (🔴) if `|gap| > 10`; else elevated (🟠) if `|gap| >= 5`; else ok (✅). Flag on `Math.abs(gapPct)`. `MIN_GROUP_SIZE = 4`.
- Gap metric: mean FTE-adjusted total monthly comp via `fteTotalMonthlyComp` from `@workspace/constants/pay`. Signed gap `= (menMean - womenMean) / menMean * 100` (positive = women earn less).
- Grouping: lika = `(roleTitle, band, level)`; likvärdigt = `band`. Priced rows only (`basicMonthly !== null`). Null-band priced rows are excluded from likvärdigt and counted into `unbandedCount`.
- Masking: an `insufficient` group returns `womenMeanComp`, `menMeanComp`, `gapPct` as `null`. Counts + flag are always returned.
- Every Convex function is org-scoped via the `orgQuery`/`orgMutation` wrappers (`lib/functions.ts`); the client passes `orgId`, the wrapper injects `ctx.orgId`. A new Convex module requires `bunx convex codegen` and staging `convex/_generated/api.d.ts`.
- i18n: add keys to `packages/i18n/messages/en.json` FIRST, then mirror to sv, nb, da, fi. Edit locale JSON ONLY with the Edit tool (never shell: it double-encodes non-ASCII). Nordic strings are drafts flagged for native review. The i18n parity test fails if any locale's key set differs from en.
- No em dashes anywhere (UI copy, comments, commit messages). Use hyphens for ranges ("5-10 %").
- All user-facing text via next-intl; internal navigation via the `Link` component; forms/tables/skeletons per the CLAUDE.md conventions.
- Commits: Conventional Commits, imperative, lowercase, no trailing period, no AI/Claude attribution. New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + full `turbo run test`.
- shadcn vendor code (`packages/ui/src/{components,hooks,lib,styles}`) is excluded from Biome and must stay diffable against upstream; a deliberate local edit there (the flag token in `globals.css`) must be documented in the commit message.

---

### Task 1: The gender pay-gap engine (`packages/core`)

**Files:**
- Create: `packages/core/src/pay-gap.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/pay-gap.test.ts`

**Interfaces:**
- Consumes: `fteTotalMonthlyComp` from `@workspace/constants` (already a dep of `@workspace/core`). Not called here directly, but re-exported consumers use it; this task only needs the flag + mean math.
- Produces:
  - `MIN_GROUP_SIZE = 4` (number)
  - `type PayGapFlag = "critical" | "elevated" | "ok" | "insufficient"`
  - `interface GenderGapResult { womenCount: number; menCount: number; womenMeanComp: number | null; menMeanComp: number | null; gapPct: number | null; flag: PayGapFlag }`
  - `classifyPayGap(womenCount: number, menCount: number, gapPct: number | null): PayGapFlag`
  - `computeGenderGap(womenComp: number[], menComp: number[]): GenderGapResult`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/pay-gap.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  classifyPayGap,
  computeGenderGap,
  MIN_GROUP_SIZE,
} from "./pay-gap"

describe("MIN_GROUP_SIZE", () => {
  it("is 4", () => {
    expect(MIN_GROUP_SIZE).toBe(4)
  })
})

describe("classifyPayGap", () => {
  it("is insufficient when a gender is missing", () => {
    expect(classifyPayGap(0, 5, 0)).toBe("insufficient")
    expect(classifyPayGap(5, 0, 0)).toBe("insufficient")
  })

  it("is insufficient when the group has fewer than 4 people", () => {
    expect(classifyPayGap(1, 2, 0)).toBe("insufficient") // 3 total
    expect(classifyPayGap(2, 2, 3)).toBe("ok") // 4 total, both genders
  })

  it("is insufficient when the gap is null", () => {
    expect(classifyPayGap(5, 5, null)).toBe("insufficient")
  })

  it("is critical above 10%", () => {
    expect(classifyPayGap(5, 5, 10.1)).toBe("critical")
    expect(classifyPayGap(5, 5, -10.1)).toBe("critical") // magnitude
  })

  it("is elevated from 5% up to and including 10%", () => {
    expect(classifyPayGap(5, 5, 5)).toBe("elevated")
    expect(classifyPayGap(5, 5, 10)).toBe("elevated")
    expect(classifyPayGap(5, 5, -7)).toBe("elevated")
  })

  it("is ok below 5%", () => {
    expect(classifyPayGap(5, 5, 4.9)).toBe("ok")
    expect(classifyPayGap(5, 5, 0)).toBe("ok")
    expect(classifyPayGap(5, 5, -4.9)).toBe("ok")
  })
})

describe("computeGenderGap", () => {
  it("computes means and a signed gap (positive = women earn less)", () => {
    const result = computeGenderGap([90, 90], [100, 100])
    expect(result.womenCount).toBe(2)
    expect(result.menCount).toBe(2)
    expect(result.womenMeanComp).toBe(90)
    expect(result.menMeanComp).toBe(100)
    expect(result.gapPct).toBeCloseTo(10, 5)
    expect(result.flag).toBe("elevated")
  })

  it("produces a negative gap when women earn more", () => {
    const result = computeGenderGap([110, 110], [100, 100])
    expect(result.gapPct).toBeCloseTo(-10, 5)
    expect(result.flag).toBe("elevated") // flagged by magnitude
  })

  it("returns null means for an empty gender and is insufficient", () => {
    const result = computeGenderGap([], [100, 100, 100, 100])
    expect(result.womenMeanComp).toBeNull()
    expect(result.menMeanComp).toBe(100)
    expect(result.gapPct).toBeNull()
    expect(result.flag).toBe("insufficient")
  })

  it("returns a null gap when the men mean is zero (no divide by zero)", () => {
    const result = computeGenderGap([0, 0], [0, 0])
    expect(result.menMeanComp).toBe(0)
    expect(result.gapPct).toBeNull()
    expect(result.flag).toBe("insufficient") // gapPct null
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && bunx vitest run src/pay-gap.test.ts`
Expected: FAIL, cannot import `./pay-gap` (module does not exist).

- [ ] **Step 3: Implement the engine**

Create `packages/core/src/pay-gap.ts`:

```ts
// Deterministic gender pay-gap engine for the lönekartläggning P1 primary view
// (ADR-0012). Pure and side-effect-free (ADR-0002): the same math runs on the
// server (the aggregate query) and could run identically on the client. The
// FTE/total-comp formula is NOT re-derived here; callers pass values already
// computed with fteTotalMonthlyComp (@workspace/constants/pay).

// Minimum people in a group before a gap is meaningful, and the small-cell
// threshold: a sub-4-person mean is effectively an individual salary (ADR-0012).
export const MIN_GROUP_SIZE = 4

export type PayGapFlag = "critical" | "elevated" | "ok" | "insufficient"

export interface GenderGapResult {
  womenCount: number
  menCount: number
  // Mean FTE-adjusted total comp per gender; null when that gender is absent.
  womenMeanComp: number | null
  menMeanComp: number | null
  // Signed gap %: positive = women earn less than men. Null when either mean
  // is null or the men mean is 0 (undefined ratio).
  gapPct: number | null
  flag: PayGapFlag
}

// The single source of the flag thresholds (ADR-0012), consumed by the
// aggregate query. Flags on the gap's magnitude: an unexplained gap in either
// direction is a finding.
export function classifyPayGap(
  womenCount: number,
  menCount: number,
  gapPct: number | null
): PayGapFlag {
  if (
    womenCount === 0 ||
    menCount === 0 ||
    womenCount + menCount < MIN_GROUP_SIZE ||
    gapPct === null
  ) {
    return "insufficient"
  }
  const magnitude = Math.abs(gapPct)
  if (magnitude > 10) return "critical"
  if (magnitude >= 5) return "elevated"
  return "ok"
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

// Given the per-person FTE-adjusted total-comp values already split by gender,
// return counts, per-gender means, the signed gap %, and the flag.
export function computeGenderGap(
  womenComp: number[],
  menComp: number[]
): GenderGapResult {
  const womenMeanComp = mean(womenComp)
  const menMeanComp = mean(menComp)
  const gapPct =
    womenMeanComp !== null && menMeanComp !== null && menMeanComp !== 0
      ? ((menMeanComp - womenMeanComp) / menMeanComp) * 100
      : null
  return {
    womenCount: womenComp.length,
    menCount: menComp.length,
    womenMeanComp,
    menMeanComp,
    gapPct,
    flag: classifyPayGap(womenComp.length, menComp.length, gapPct),
  }
}
```

- [ ] **Step 4: Export from the package barrel**

Add to `packages/core/src/index.ts` (after the existing exports):

```ts
export * from "./pay-gap"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/core && bunx vitest run src/pay-gap.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/pay-gap.ts packages/core/src/pay-gap.test.ts packages/core/src/index.ts
git commit -m "feat(core): add the gender pay-gap engine"
```

---

### Task 2: The `getPayMappingGap` aggregate query (`packages/backend`)

**Files:**
- Create: `packages/backend/convex/payMapping/gap.ts`
- Test: `packages/backend/convex/payMapping/gap.test.ts`
- Regenerate: `packages/backend/convex/_generated/api.d.ts` (via codegen)

**Interfaces:**
- Consumes: `computeGenderGap`, `type PayGapFlag` from `@workspace/core`; `fteTotalMonthlyComp` from `@workspace/constants`; `orgQuery` from `../lib/functions`.
- Produces (Convex query `api.payMapping.gap.getPayMappingGap`), args `{ runId: v.id("payMappingRuns") }` (client also passes injected `orgId`), returns `null` or:
  ```ts
  {
    currency: string | null
    lika: GapGroup[]
    likvardigt: GapGroup[]
    unbandedCount: number
  }
  // GapGroup:
  {
    key: string
    roleTitle: string | null   // lika only; null for likvärdigt
    level: string | null       // lika only
    band: number | null
    womenCount: number
    menCount: number
    womenMeanComp: number | null
    menMeanComp: number | null
    gapPct: number | null
    flag: PayGapFlag
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/payMapping/gap.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { api } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Directly seed a run + snapshot rows (freeze logic is covered by runs.test.ts);
// this gives exact control over gender/band/level/pay per row.
const OPERATOR = "HR Person"

interface SeedRow {
  gender: "Man" | "Kvinna"
  roleTitle: string
  level: string
  band: number | null
  basicMonthly: number | null
  ftePercent?: number
}

async function seedRun(
  t: ReturnType<typeof initConvexTest>,
  rows: SeedRow[]
): Promise<{ orgId: string; runId: Id<"payMappingRuns">; asHr: ReturnType<typeof t.withIdentity> }> {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: OPERATOR, role: "admin" }
  )
  const asHr = t.withIdentity({ subject: userId })
  const runId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("payMappingRuns", {
      orgId,
      slug: "test-run",
      label: "Test run",
      status: "active",
      referenceDate: 1_700_000_000_000,
      initiatedBy: userId,
      initiatedAt: 1_700_000_000_000,
      systemVersion: "test",
      populationCount: rows.length,
      withPayCount: rows.filter((r) => r.basicMonthly !== null).length,
      unclassifiedExcludedCount: 0,
      frozenModel: { criteria: [], bandThresholds: [] },
    })
    let i = 0
    for (const r of rows) {
      i += 1
      await ctx.db.insert("payMappingSnapshotRows", {
        orgId,
        runId: id,
        personPublicId: `p${i}`,
        displayName: `Person ${i}`,
        erased: false,
        gender: r.gender,
        ...(r.ftePercent !== undefined ? { ftePercent: r.ftePercent } : {}),
        roleTitle: r.roleTitle,
        trackKey: "engineering",
        level: r.level,
        band: r.band,
        score: r.band === null ? null : 50,
        basicMonthly: r.basicMonthly,
        components: [],
        ...(r.basicMonthly !== null ? { currency: "SEK" } : {}),
      })
    }
    return id
  })
  return { orgId, runId, asHr }
}

describe("getPayMappingGap", () => {
  it("groups lika by (roleTitle, band, level) and computes the gap", async () => {
    const t = initConvexTest()
    // One lika group: SWE, band 3, Senior, 2 women @ 90k, 2 men @ 100k.
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", level: "Senior", band: 3, basicMonthly: 90000 },
      { gender: "Kvinna", roleTitle: "SWE", level: "Senior", band: 3, basicMonthly: 90000 },
      { gender: "Man", roleTitle: "SWE", level: "Senior", band: 3, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "SWE", level: "Senior", band: 3, basicMonthly: 100000 },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result).not.toBeNull()
    expect(result?.currency).toBe("SEK")
    expect(result?.lika).toHaveLength(1)
    const group = result?.lika[0]
    expect(group?.roleTitle).toBe("SWE")
    expect(group?.level).toBe("Senior")
    expect(group?.band).toBe(3)
    expect(group?.womenCount).toBe(2)
    expect(group?.menCount).toBe(2)
    expect(group?.gapPct).toBeCloseTo(10, 5)
    expect(group?.flag).toBe("elevated")
  })

  it("groups likvärdigt by band across different roles", async () => {
    const t = initConvexTest()
    // Band 2 spans two roles; 2 women @ 80k + 2 men @ 100k => 20% gap.
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 80000 },
      { gender: "Kvinna", roleTitle: "PM", level: "Mid", band: 2, basicMonthly: 80000 },
      { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "PM", level: "Mid", band: 2, basicMonthly: 100000 },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.likvardigt).toHaveLength(1)
    const band2 = result?.likvardigt[0]
    expect(band2?.band).toBe(2)
    expect(band2?.roleTitle).toBeNull()
    expect(band2?.womenCount).toBe(2)
    expect(band2?.gapPct).toBeCloseTo(20, 5)
    expect(band2?.flag).toBe("critical")
  })

  it("FTE-adjusts a part-timer up to full-time equivalent", async () => {
    const t = initConvexTest()
    // A 50% woman at 50k grosses to 100k, matching the men => no gap.
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 50000, ftePercent: 50 },
      { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.lika[0]?.womenMeanComp).toBeCloseTo(100000, 0)
    expect(result?.lika[0]?.gapPct).toBeCloseTo(0, 5)
    expect(result?.lika[0]?.flag).toBe("ok")
  })

  it("masks an insufficient group: counts kept, means and gap nulled", async () => {
    const t = initConvexTest()
    // 3 people (< 4) => insufficient => no means/gap exposed.
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "Lead", level: "Staff", band: 1, basicMonthly: 90000 },
      { gender: "Man", roleTitle: "Lead", level: "Staff", band: 1, basicMonthly: 100000 },
      { gender: "Man", roleTitle: "Lead", level: "Staff", band: 1, basicMonthly: 100000 },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    const group = result?.lika[0]
    expect(group?.flag).toBe("insufficient")
    expect(group?.womenCount).toBe(1)
    expect(group?.menCount).toBe(2)
    expect(group?.womenMeanComp).toBeNull()
    expect(group?.menMeanComp).toBeNull()
    expect(group?.gapPct).toBeNull()
  })

  it("excludes null-band priced rows from likvärdigt and counts them", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "New", level: "Mid", band: null, basicMonthly: 70000 },
      { gender: "Man", roleTitle: "New", level: "Mid", band: null, basicMonthly: 70000 },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.likvardigt).toHaveLength(0)
    expect(result?.unbandedCount).toBe(2)
    // The rows still form a lika group (title, none, level).
    expect(result?.lika).toHaveLength(1)
    expect(result?.lika[0]?.band).toBeNull()
  })

  it("ignores rows with no pay", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: null },
      { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: null },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.lika).toHaveLength(0)
    expect(result?.likvardigt).toHaveLength(0)
    expect(result?.unbandedCount).toBe(0)
    expect(result?.currency).toBeNull()
  })

  it("returns null for a run in another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, [
      { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 90000 },
    ])
    // A member of a different org cannot read org A's run.
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    const result = await asOther.query(api.payMapping.gap.getPayMappingGap, {
      orgId: otherOrg,
      runId,
    })

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`
Expected: FAIL, `api.payMapping.gap` does not exist (module not created / not codegen'd).

- [ ] **Step 3: Implement the query**

Create `packages/backend/convex/payMapping/gap.ts`:

```ts
import { fteTotalMonthlyComp } from "@workspace/constants/pay"
import { computeGenderGap, type PayGapFlag } from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { orgQuery } from "../lib/functions"

// One gender-gap group in the wire shape. roleTitle/level are populated for
// lika groups only (null for likvärdigt). Means + gap are null when the group
// is insufficient (masked) or a gender is absent.
const gapGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.union(v.number(), v.null()),
  womenCount: v.number(),
  menCount: v.number(),
  womenMeanComp: v.union(v.number(), v.null()),
  menMeanComp: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  flag: v.union(
    v.literal("critical"),
    v.literal("elevated"),
    v.literal("ok"),
    v.literal("insufficient")
  ),
})

// A mutable bucket while grouping: the per-gender comp arrays plus the display
// attributes shared by every row in the bucket.
interface Bucket {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  women: number[]
  men: number[]
}

type SnapshotRow = Doc<"payMappingSnapshotRows">

// Build one wire-shape GapGroup from a bucket: run the engine, then mask the
// means + gap when the flag is insufficient (a sub-4 mean is an individual
// salary; a gap on under-4 is meaningless). Counts + flag are always exposed.
function toGapGroup(bucket: Bucket) {
  const stats = computeGenderGap(bucket.women, bucket.men)
  const masked = stats.flag === "insufficient"
  return {
    key: bucket.key,
    roleTitle: bucket.roleTitle,
    level: bucket.level,
    band: bucket.band,
    womenCount: stats.womenCount,
    menCount: stats.menCount,
    womenMeanComp: masked ? null : stats.womenMeanComp,
    menMeanComp: masked ? null : stats.menMeanComp,
    gapPct: masked ? null : stats.gapPct,
    flag: stats.flag as PayGapFlag,
  }
}

function comp(row: SnapshotRow): number {
  // basicMonthly is non-null here (callers filter priced rows first).
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    row.components,
    row.ftePercent
  )
}

function pushByGender(bucket: Bucket, row: SnapshotRow): void {
  if (row.gender === "Kvinna") bucket.women.push(comp(row))
  else bucket.men.push(comp(row))
}

export const getPayMappingGap = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.union(
    v.null(),
    v.object({
      currency: v.union(v.string(), v.null()),
      lika: v.array(gapGroupShape),
      likvardigt: v.array(gapGroupShape),
      unbandedCount: v.number(),
    })
  ),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    // Org isolation: a run id from another tenant resolves to null.
    if (run === null || run.orgId !== ctx.orgId) return null

    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()

    // Only rows with a frozen salary participate in the gap.
    const priced = rows.filter((r) => r.basicMonthly !== null)
    const currency = priced.find((r) => r.currency !== undefined)?.currency ?? null

    // Steg 1, lika arbete: (roleTitle, band, level).
    const likaMap = new Map<string, Bucket>()
    for (const row of priced) {
      const key = `${row.roleTitle}|${row.band ?? "none"}|${row.level}`
      let bucket = likaMap.get(key)
      if (bucket === undefined) {
        bucket = {
          key,
          roleTitle: row.roleTitle,
          level: row.level,
          band: row.band,
          women: [],
          men: [],
        }
        likaMap.set(key, bucket)
      }
      pushByGender(bucket, row)
    }

    // Steg 2, likvärdigt arbete: band. Null-band priced rows are excluded and
    // counted (band is the equivalence key, so they cannot be placed).
    const likvMap = new Map<number, Bucket>()
    let unbandedCount = 0
    for (const row of priced) {
      if (row.band === null) {
        unbandedCount += 1
        continue
      }
      const key = `${row.band}`
      let bucket = likvMap.get(row.band)
      if (bucket === undefined) {
        bucket = {
          key,
          roleTitle: null,
          level: null,
          band: row.band,
          women: [],
          men: [],
        }
        likvMap.set(row.band, bucket)
      }
      pushByGender(bucket, row)
    }

    // Deterministic order: band asc (null last), then title, then level.
    const byBandTitleLevel = (a: Bucket, b: Bucket): number => {
      const ba = a.band ?? Number.POSITIVE_INFINITY
      const bb = b.band ?? Number.POSITIVE_INFINITY
      if (ba !== bb) return ba - bb
      const ta = a.roleTitle ?? ""
      const tb = b.roleTitle ?? ""
      if (ta !== tb) return ta.localeCompare(tb)
      return (a.level ?? "").localeCompare(b.level ?? "")
    }

    const lika = [...likaMap.values()].sort(byBandTitleLevel).map(toGapGroup)
    const likvardigt = [...likvMap.values()]
      .sort((a, b) => (a.band ?? 0) - (b.band ?? 0))
      .map(toGapGroup)

    return { currency, lika, likvardigt, unbandedCount }
  },
})
```

- [ ] **Step 4: Run codegen and stage the generated api**

Run: `cd packages/backend && bunx convex codegen`
Expected: updates `convex/_generated/api.d.ts` to include `payMapping/gap`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/payMapping/gap.ts packages/backend/convex/payMapping/gap.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(pay-mapping): add the getPayMappingGap aggregate query"
```

---

### Task 3: i18n strings for the P1 gender-gap view (all 5 locales)

**Files:**
- Modify: `packages/i18n/messages/en.json` (source), then `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Produces: `dashboard.payMapping.gap.*` and `dashboard.help.payGap*` keys, consumed by Tasks 4 and 5.

Add a `gap` object inside the existing `dashboard.payMapping` object (a sibling of `heading`, `detail`, etc.), and three pairs of keys inside the existing `dashboard.help` object. Edit each file with the Edit tool only. After editing all five, the i18n parity test must pass.

- [ ] **Step 1: Add the `gap` block to `dashboard.payMapping` in `en.json`**

```json
"gap": {
  "likaTitle": "Equal work",
  "likaDescription": "Women compared with men in the same role at the same level.",
  "likvardigtTitle": "Equivalent work",
  "likvardigtDescription": "Women compared with men whose different roles weigh the same (same band).",
  "columns": {
    "group": "Group",
    "women": "Women",
    "womenMean": "Avg (women)",
    "men": "Men",
    "menMean": "Avg (men)",
    "gap": "Pay gap",
    "flag": "Flag"
  },
  "flag": {
    "critical": "Over 10%",
    "elevated": "5-10%",
    "ok": "Under 5%",
    "insufficient": "Not enough data"
  },
  "summary": "Flagged: {critical} over 10%, {elevated} at 5-10%",
  "unbanded": "{count, plural, one {# person not shown: role not yet evaluated} other {# people not shown: role not yet evaluated}}",
  "masked": "Fewer than 4 people or only one gender, so no gap is shown.",
  "empty": "No salaries in this survey yet."
}
```

- [ ] **Step 2: Add the help keys to `dashboard.help` in `en.json`**

```json
"payGapLikaLabel": "Equal work (lika arbete)",
"payGapLikaBody": "People doing the same job at the same level. We compare the average pay of women and men in each such group.",
"payGapLikvardigtLabel": "Equivalent work (likvärdigt arbete)",
"payGapLikvardigtBody": "Different jobs that the evaluation weighs equally end up in the same band. We compare women's and men's average pay within each band.",
"payGapFlagsLabel": "What the flags mean",
"payGapFlagsBody": "The flag is the pay gap between women and men in the group: over 10% needs action, 5-10% is worth watching, under 5% is fine. Groups with fewer than 4 people, or only one gender, show no gap: the sample is too small to judge."
```

- [ ] **Step 3: Mirror the `gap` block + help keys to `sv.json`**

`dashboard.payMapping.gap`:

```json
"gap": {
  "likaTitle": "Lika arbete",
  "likaDescription": "Kvinnor jämfört med män i samma roll på samma nivå.",
  "likvardigtTitle": "Likvärdigt arbete",
  "likvardigtDescription": "Kvinnor jämfört med män vars olika roller väger lika (samma band).",
  "columns": {
    "group": "Grupp",
    "women": "Kvinnor",
    "womenMean": "Medel (kvinnor)",
    "men": "Män",
    "menMean": "Medel (män)",
    "gap": "Lönegap",
    "flag": "Flagga"
  },
  "flag": {
    "critical": "Över 10 %",
    "elevated": "5-10 %",
    "ok": "Under 5 %",
    "insufficient": "Otillräckligt underlag"
  },
  "summary": "Flaggat: {critical} över 10 %, {elevated} på 5-10 %",
  "unbanded": "{count, plural, one {# person visas inte: rollen är inte färdigvärderad} other {# personer visas inte: rollen är inte färdigvärderad}}",
  "masked": "Färre än 4 personer eller bara ett kön, så inget gap visas.",
  "empty": "Inga löner i den här kartläggningen ännu."
}
```

`dashboard.help`:

```json
"payGapLikaLabel": "Lika arbete",
"payGapLikaBody": "Personer som utför samma arbete på samma nivå. Vi jämför kvinnors och mäns genomsnittslön i varje sådan grupp.",
"payGapLikvardigtLabel": "Likvärdigt arbete",
"payGapLikvardigtBody": "Olika arbeten som värderingen väger lika hamnar i samma band. Vi jämför kvinnors och mäns genomsnittslön inom varje band.",
"payGapFlagsLabel": "Vad flaggorna betyder",
"payGapFlagsBody": "Flaggan är lönegapet mellan kvinnor och män i gruppen: över 10 % kräver åtgärd, 5-10 % bör bevakas, under 5 % är ok. Grupper med färre än 4 personer, eller bara ett kön, visar inget gap: underlaget är för litet för att bedöma."
```

- [ ] **Step 4: Mirror to `nb.json` (draft, flag for native review)**

`dashboard.payMapping.gap`:

```json
"gap": {
  "likaTitle": "Likt arbeid",
  "likaDescription": "Kvinner sammenlignet med menn i samme rolle på samme nivå.",
  "likvardigtTitle": "Likeverdig arbeid",
  "likvardigtDescription": "Kvinner sammenlignet med menn hvis ulike roller veier likt (samme band).",
  "columns": {
    "group": "Gruppe",
    "women": "Kvinner",
    "womenMean": "Snitt (kvinner)",
    "men": "Menn",
    "menMean": "Snitt (menn)",
    "gap": "Lønnsgap",
    "flag": "Flagg"
  },
  "flag": {
    "critical": "Over 10 %",
    "elevated": "5-10 %",
    "ok": "Under 5 %",
    "insufficient": "Utilstrekkelig grunnlag"
  },
  "summary": "Flagget: {critical} over 10 %, {elevated} på 5-10 %",
  "unbanded": "{count, plural, one {# person vises ikke: rollen er ikke ferdig vurdert} other {# personer vises ikke: rollen er ikke ferdig vurdert}}",
  "masked": "Færre enn 4 personer eller bare ett kjønn, så ingen gap vises.",
  "empty": "Ingen lønninger i denne kartleggingen ennå."
}
```

`dashboard.help`:

```json
"payGapLikaLabel": "Likt arbeid",
"payGapLikaBody": "Personer som utfører samme arbeid på samme nivå. Vi sammenligner gjennomsnittslønnen til kvinner og menn i hver slik gruppe.",
"payGapLikvardigtLabel": "Likeverdig arbeid",
"payGapLikvardigtBody": "Ulike arbeider som vurderingen veier likt havner i samme band. Vi sammenligner kvinners og menns gjennomsnittslønn innenfor hvert band.",
"payGapFlagsLabel": "Hva flaggene betyr",
"payGapFlagsBody": "Flagget er lønnsgapet mellom kvinner og menn i gruppen: over 10 % krever tiltak, 5-10 % bør følges med, under 5 % er ok. Grupper med færre enn 4 personer, eller bare ett kjønn, viser ingen gap: grunnlaget er for lite til å vurdere."
```

- [ ] **Step 5: Mirror to `da.json` (draft, flag for native review)**

`dashboard.payMapping.gap`:

```json
"gap": {
  "likaTitle": "Lige arbejde",
  "likaDescription": "Kvinder sammenlignet med mænd i samme rolle på samme niveau.",
  "likvardigtTitle": "Ligeværdigt arbejde",
  "likvardigtDescription": "Kvinder sammenlignet med mænd, hvis forskellige roller vejer lige (samme band).",
  "columns": {
    "group": "Gruppe",
    "women": "Kvinder",
    "womenMean": "Gns. (kvinder)",
    "men": "Mænd",
    "menMean": "Gns. (mænd)",
    "gap": "Løngab",
    "flag": "Flag"
  },
  "flag": {
    "critical": "Over 10 %",
    "elevated": "5-10 %",
    "ok": "Under 5 %",
    "insufficient": "Utilstrækkeligt grundlag"
  },
  "summary": "Flaget: {critical} over 10 %, {elevated} ved 5-10 %",
  "unbanded": "{count, plural, one {# person vises ikke: rollen er ikke færdigvurderet} other {# personer vises ikke: rollen er ikke færdigvurderet}}",
  "masked": "Færre end 4 personer eller kun ét køn, så intet gab vises.",
  "empty": "Ingen lønninger i denne kortlægning endnu."
}
```

`dashboard.help`:

```json
"payGapLikaLabel": "Lige arbejde",
"payGapLikaBody": "Personer, der udfører samme arbejde på samme niveau. Vi sammenligner gennemsnitslønnen for kvinder og mænd i hver sådan gruppe.",
"payGapLikvardigtLabel": "Ligeværdigt arbejde",
"payGapLikvardigtBody": "Forskellige job, som vurderingen vægter lige, havner i samme band. Vi sammenligner kvinders og mænds gennemsnitsløn inden for hvert band.",
"payGapFlagsLabel": "Hvad flagene betyder",
"payGapFlagsBody": "Flaget er løngabet mellem kvinder og mænd i gruppen: over 10 % kræver handling, 5-10 % bør holdes øje med, under 5 % er ok. Grupper med færre end 4 personer, eller kun ét køn, viser intet gab: grundlaget er for lille til at vurdere."
```

- [ ] **Step 6: Mirror to `fi.json` (draft, flag for native review)**

`dashboard.payMapping.gap`:

```json
"gap": {
  "likaTitle": "Sama työ",
  "likaDescription": "Naiset verrattuna miehiin samassa roolissa samalla tasolla.",
  "likvardigtTitle": "Samanarvoinen työ",
  "likvardigtDescription": "Naiset verrattuna miehiin, joiden eri roolit painavat saman verran (sama vaativuustaso).",
  "columns": {
    "group": "Ryhmä",
    "women": "Naiset",
    "womenMean": "Ka. (naiset)",
    "men": "Miehet",
    "menMean": "Ka. (miehet)",
    "gap": "Palkkaero",
    "flag": "Merkintä"
  },
  "flag": {
    "critical": "Yli 10 %",
    "elevated": "5-10 %",
    "ok": "Alle 5 %",
    "insufficient": "Riittämättömät tiedot"
  },
  "summary": "Merkitty: {critical} yli 10 %, {elevated} välillä 5-10 %",
  "unbanded": "{count, plural, one {# henkilöä ei näytetä: roolia ei ole vielä arvioitu} other {# henkilöä ei näytetä: roolia ei ole vielä arvioitu}}",
  "masked": "Alle 4 henkilöä tai vain yksi sukupuoli, joten eroa ei näytetä.",
  "empty": "Tässä kartoituksessa ei ole vielä palkkoja."
}
```

`dashboard.help`:

```json
"payGapLikaLabel": "Sama työ",
"payGapLikaBody": "Henkilöt, jotka tekevät samaa työtä samalla tasolla. Vertaamme naisten ja miesten keskipalkkaa kussakin tällaisessa ryhmässä.",
"payGapLikvardigtLabel": "Samanarvoinen työ",
"payGapLikvardigtBody": "Eri työt, jotka arviointi painottaa yhtä paljon, päätyvät samalle vaativuustasolle. Vertaamme naisten ja miesten keskipalkkaa kullakin tasolla.",
"payGapFlagsLabel": "Mitä merkinnät tarkoittavat",
"payGapFlagsBody": "Merkintä on naisten ja miesten välinen palkkaero ryhmässä: yli 10 % vaatii toimia, 5-10 % kannattaa seurata, alle 5 % on ok. Ryhmät, joissa on alle 4 henkilöä tai vain yksi sukupuoli, eivät näytä eroa: otos on liian pieni arvioitavaksi."
```

- [ ] **Step 7: Verify parity and no mojibake**

Run: `cd packages/i18n && bun run test`
Expected: PASS (parity test: every locale has the same key set as en).

Run: `rg -n "Ã|Ã¥|Ã¤|Ã¶|â€"" packages/i18n/messages/*.json || echo "no mojibake"`
Expected: `no mojibake` (confirms the Edit tool wrote clean UTF-8, not double-encoded bytes).

- [ ] **Step 8: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): strings for the P1 gender-gap view"
```

---

### Task 4: The pay-gap flag badge (`PayGapFlagBadge`) + the amber flag token

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (add the amber `--flag-elevated` token; vendor file, documented)
- Create: `apps/dashboard/components/pay-mapping/pay-gap-flag-badge.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-gap-flag-badge.test.tsx`

**Interfaces:**
- Consumes: `type PayGapFlag` from `@workspace/core`; `dashboard.payMapping.gap.flag.*` (Task 3); `Badge` from `@workspace/ui/components/badge`; `cn` from `@workspace/ui/lib/utils`.
- Produces: `PayGapFlagBadge({ flag }: { flag: PayGapFlag })` React component (renders a `Badge` with a `data-flag={flag}` attribute and the localized label).

- [ ] **Step 1: Add the amber flag token to `globals.css`**

The traffic-light needs an amber for the "elevated" flag (`--destructive`, `--success`, `--muted` already cover the other three). Add it in both theme blocks and map it in `@theme`, mirroring the existing `--gender-*` data-viz tokens. This is a deliberate local edit to vendor code, called out in the commit message.

In the light `:root` block (near `--success`/`--gender-*`):

```css
    --flag-elevated: oklch(0.76 0.145 78);
    --flag-elevated-foreground: oklch(0.28 0.05 78);
```

In the dark block (`.dark`, near its `--success`/`--gender-*`):

```css
    --flag-elevated: oklch(0.78 0.15 80);
    --flag-elevated-foreground: oklch(0.24 0.04 80);
```

In the `@theme inline` block (near `--color-success`/`--color-success-foreground`):

```css
    --color-flag-elevated: var(--flag-elevated);
    --color-flag-elevated-foreground: var(--flag-elevated-foreground);
```

This makes the Tailwind utilities `bg-flag-elevated` and `text-flag-elevated-foreground` available (same mechanism as `bg-success`).

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/components/pay-mapping/pay-gap-flag-badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"

function renderBadge(flag: "critical" | "elevated" | "ok" | "insufficient") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayGapFlagBadge flag={flag} />
    </NextIntlClientProvider>
  )
}

describe("PayGapFlagBadge", () => {
  it("renders the localized label for each flag", () => {
    renderBadge("critical")
    expect(screen.getByText("Over 10%")).toBeInTheDocument()
  })

  it("carries a data-flag attribute for the severity", () => {
    const { container } = renderBadge("insufficient")
    expect(container.querySelector('[data-flag="insufficient"]')).not.toBeNull()
    expect(screen.getByText("Not enough data")).toBeInTheDocument()
  })

  it("renders the elevated and ok flags", () => {
    renderBadge("elevated")
    expect(screen.getByText("5-10%")).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-gap-flag-badge.test.tsx`
Expected: FAIL, cannot import `./pay-gap-flag-badge`.

- [ ] **Step 4: Implement the badge**

Create `apps/dashboard/components/pay-mapping/pay-gap-flag-badge.tsx`:

```tsx
"use client"

import type { PayGapFlag } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"

// Traffic-light severity chip for a gender-gap group (ADR-0012). A deliberate
// custom indicator: severity is not one of the shadcn Badge variants, so each
// flag maps to explicit semantic-color utilities here (the single place the
// mapping lives). The color encodes state in form; the text label keeps it
// legible without relying on color alone. The amber `flag-elevated` utilities
// come from the token added to globals.css.
const FLAG_STYLES: Record<PayGapFlag, string> = {
  critical: "border-transparent bg-destructive text-white",
  elevated: "border-transparent bg-flag-elevated text-flag-elevated-foreground",
  ok: "border-transparent bg-success text-success-foreground",
  insufficient: "border-transparent bg-muted text-muted-foreground",
}

export function PayGapFlagBadge({ flag }: { flag: PayGapFlag }) {
  const t = useTranslations("dashboard.payMapping.gap")
  return (
    <Badge data-flag={flag} className={cn(FLAG_STYLES[flag])}>
      {t(`flag.${flag}`)}
    </Badge>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-gap-flag-badge.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/styles/globals.css apps/dashboard/components/pay-mapping/pay-gap-flag-badge.tsx apps/dashboard/components/pay-mapping/pay-gap-flag-badge.test.tsx
git commit -m "feat(pay-mapping): add the pay-gap flag badge

Adds an amber --flag-elevated data-viz token to the vendor globals.css
(same pattern as the existing --gender-* tokens) so the traffic-light
flag chip has a middle color; the other three reuse destructive/success/
muted."
```

---

### Task 5: The P1 gender-gap view + detail wiring (`PayMappingGap`)

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx` (insert the gap view + a "Population" heading)
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-gap.test.tsx`

**Interfaces:**
- Consumes: `api.payMapping.gap.getPayMappingGap` (Task 2); `type PayGapFlag` from `@workspace/core`; `PayGapFlagBadge` (Task 4); `dashboard.payMapping.gap.*` + `dashboard.help.payGap*` (Task 3); `useMoney` (`@/hooks/use-money`); `useFormatter`, `useTranslations` (next-intl); `HelpMorphButton`, `Table*` (`@workspace/ui`), `Skeleton`.
- Produces: `PayMappingGap({ orgId, runId }: { orgId: string; runId: Id<"payMappingRuns"> })`, rendered by `PayMappingDetail`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/pay-mapping/pay-mapping-gap.test.tsx`. It renders the two inner table components with fixed props (no Convex), mirroring how `pay-comparison-section.test.tsx` unit-tests the tooltip without a live query. The section owns the query; the table is a pure prop-driven child.

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { PayGapTable, type GapGroup } from "./pay-mapping-gap"

function group(overrides: Partial<GapGroup>): GapGroup {
  return {
    key: "k",
    roleTitle: "SWE",
    level: "Senior",
    band: 3,
    womenCount: 2,
    menCount: 2,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
    ...overrides,
  }
}

function renderTable(groups: GapGroup[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayGapTable variant="lika" groups={groups} currency="SEK" />
    </NextIntlClientProvider>
  )
}

describe("PayGapTable", () => {
  it("renders a group's counts and its flag label", () => {
    renderTable([group({})])
    expect(screen.getByText("SWE")).toBeInTheDocument()
    expect(screen.getByText("5-10%")).toBeInTheDocument() // elevated flag
  })

  it("shows a dash for a masked (insufficient) group's means and gap", () => {
    renderTable([
      group({
        flag: "insufficient",
        womenMeanComp: null,
        menMeanComp: null,
        gapPct: null,
      }),
    ])
    expect(screen.getByText("Not enough data")).toBeInTheDocument()
    // Means + gap render as "-" (at least three dashes across the three cells).
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3)
  })

  it("renders the column headers", () => {
    renderTable([group({})])
    expect(screen.getByText("Pay gap")).toBeInTheDocument()
    expect(screen.getByText("Flag")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-gap.test.tsx`
Expected: FAIL, cannot import `./pay-mapping-gap`.

- [ ] **Step 3: Implement the gap view**

Create `apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapFlag } from "@workspace/core"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"

// Structural subset of getPayMappingGap's GapGroup (kept local like
// PayMappingSnapshotRow in pay-mapping-detail, not imported from generated).
export interface GapGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
}

// Shared header for a gap table, rendered by both the loaded table and the
// skeleton so the two measure identical and the static labels never gray out
// (same precedent as PayMappingRowsHeader).
function PayGapTableHeader() {
  const t = useTranslations("dashboard.payMapping.gap.columns")
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t("group")}</TableHead>
        <TableHead className="w-20 text-right">{t("women")}</TableHead>
        <TableHead className="w-32 text-right">{t("womenMean")}</TableHead>
        <TableHead className="w-20 text-right">{t("men")}</TableHead>
        <TableHead className="w-32 text-right">{t("menMean")}</TableHead>
        <TableHead className="w-24 text-right">{t("gap")}</TableHead>
        <TableHead className="w-32">{t("flag")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

// The label for a group's first cell: role + level for lika, the band for
// likvärdigt.
function groupLabel(
  group: GapGroup,
  variant: "lika" | "likvardigt",
  bandLabel: (band: number | null) => string
): string {
  if (variant === "likvardigt") return bandLabel(group.band)
  const parts = [group.roleTitle ?? "", group.level ?? ""].filter(
    (p) => p !== ""
  )
  return parts.join(" · ")
}

// One gap table (lika or likvärdigt). Pure and prop-driven so it unit-tests
// without a live query.
export function PayGapTable({
  variant,
  groups,
  currency,
}: {
  variant: "lika" | "likvardigt"
  groups: GapGroup[]
  currency: string | null
}) {
  const t = useTranslations("dashboard.payMapping.gap")
  const format = useFormatter()
  const money = useMoney()

  const bandLabel = (band: number | null) =>
    band === null ? "-" : `Band ${band}`
  const dash = "-"

  const gapText = (gapPct: number | null) =>
    gapPct === null
      ? dash
      : format.number(gapPct / 100, {
          style: "percent",
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        })
  const meanText = (value: number | null) =>
    value === null || currency === null ? dash : money(value, currency)

  return (
    <Table className="table-fixed">
      <PayGapTableHeader />
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.key}>
            <TableCell className="truncate font-medium">
              {groupLabel(group, variant, bandLabel)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {group.womenCount}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {meanText(group.womenMeanComp)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {group.menCount}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {meanText(group.menMeanComp)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {gapText(group.gapPct)}
            </TableCell>
            <TableCell>
              <div className="flex min-h-5 items-center">
                <PayGapFlagBadge flag={group.flag} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// One section: a title with inline help, a one-line flagged-count summary, the
// table, and (likvärdigt only) the unbanded note.
function GapSection({
  variant,
  groups,
  currency,
  unbandedCount,
}: {
  variant: "lika" | "likvardigt"
  groups: GapGroup[]
  currency: string | null
  unbandedCount?: number
}) {
  const t = useTranslations("dashboard.payMapping.gap")
  const tHelp = useTranslations("dashboard.help")

  const criticalCount = groups.filter((g) => g.flag === "critical").length
  const elevatedCount = groups.filter((g) => g.flag === "elevated").length
  const hasFlagged = criticalCount + elevatedCount > 0

  const titleKey = variant === "lika" ? "likaTitle" : "likvardigtTitle"
  const descKey =
    variant === "lika" ? "likaDescription" : "likvardigtDescription"
  const helpLabel =
    variant === "lika" ? "payGapLikaLabel" : "payGapLikvardigtLabel"
  const helpBody = variant === "lika" ? "payGapLikaBody" : "payGapLikvardigtBody"

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-sm">{t(titleKey)}</h2>
          <HelpMorphButton label={tHelp(helpLabel)}>
            {tHelp(helpBody)}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">{t(descKey)}</p>
      </div>
      {hasFlagged && (
        <p className="text-muted-foreground text-sm">
          {t("summary", { critical: criticalCount, elevated: elevatedCount })}
        </p>
      )}
      <PayGapTable variant={variant} groups={groups} currency={currency} />
      {variant === "likvardigt" && (unbandedCount ?? 0) > 0 && (
        <p className="text-muted-foreground text-sm">
          {t("unbanded", { count: unbandedCount ?? 0 })}
        </p>
      )}
    </section>
  )
}

// Loading skeleton: static titles + column headers render real; only the
// group rows are bars, measured identical to data rows.
function GapSectionSkeleton({ variant }: { variant: "lika" | "likvardigt" }) {
  const t = useTranslations("dashboard.payMapping.gap")
  const titleKey = variant === "lika" ? "likaTitle" : "likvardigtTitle"
  const descKey =
    variant === "lika" ? "likaDescription" : "likvardigtDescription"
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-medium text-sm">{t(titleKey)}</h2>
        <p className="text-muted-foreground text-sm">{t(descKey)}</p>
      </div>
      <Table className="table-fixed">
        <PayGapTableHeaderExported />
        <TableBody>
          {[0, 1, 2].map((i) => (
            <TableRow key={i}>
              {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                <TableCell key={c}>
                  <div className="flex items-center">
                    <Skeleton className="h-4 w-16 max-w-full" />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

// Header re-exported under a stable name for the skeleton (the internal
// PayGapTableHeader is not exported; alias it here).
function PayGapTableHeaderExported() {
  return <PayGapTableHeader />
}

// The P1 primary view: issues the aggregate query and renders both sections.
export function PayMappingGap({
  orgId,
  runId,
}: {
  orgId: string
  runId: Id<"payMappingRuns">
}) {
  const t = useTranslations("dashboard.payMapping.gap")
  const gap = useQuery(api.payMapping.gap.getPayMappingGap, { orgId, runId })

  if (gap === undefined) {
    return (
      <div className="space-y-6">
        <GapSectionSkeleton variant="lika" />
        <GapSectionSkeleton variant="likvardigt" />
      </div>
    )
  }
  if (gap === null) return null

  if (gap.currency === null) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>
  }

  return (
    <div className="space-y-6">
      <GapSection variant="lika" groups={gap.lika} currency={gap.currency} />
      <GapSection
        variant="likvardigt"
        groups={gap.likvardigt}
        currency={gap.currency}
        unbandedCount={gap.unbandedCount}
      />
    </div>
  )
}
```

Note: the skeleton bars use a plain `flex items-center` wrapper and an `h-4` bar so a cell measures like a data cell (the skeleton-measurement rule). Keep the widths loose; the `table-fixed` header cells own the column widths.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-gap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the view into the detail page**

In `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx`:

1. Add the import at the top (with the other `@/components/pay-mapping` / local imports):

```tsx
import { PayMappingGap } from "./pay-mapping-gap"
```

2. Between the summary `Card` (closing `</Card>` around line 259) and the `populationNote` paragraph, insert the gap view:

```tsx
      <PayMappingGap orgId={orgId} runId={run.runId} />
```

Note: `PayMappingDetail`'s current signature ignores `orgId` (it destructures only `run`). Change the destructure to use it:

```tsx
export function PayMappingDetail({
  orgId,
  run,
}: {
  orgId: string
  run: PayMappingRunDetail
}) {
```

3. Give the population table its own heading so the two sections read as distinct. Immediately before the `run.rows.length === 0 ? (...)` block, add:

```tsx
      <h2 className="font-medium text-sm">{t("detail.population")}</h2>
```

(`t("detail.population")` is the existing "People included" key, reused as the section heading; it already exists in all locales.)

- [ ] **Step 6: Run the detail + gap tests and typecheck the app**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/`
Expected: PASS (the new gap tests plus any existing pay-mapping component tests).

Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS (no unused-var error on `orgId`; the query args typecheck).

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx apps/dashboard/components/pay-mapping/pay-mapping-gap.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx
git commit -m "feat(pay-mapping): add the P1 gender-gap view to the run detail"
```

---

## Self-Review

**Spec coverage:**
- Engine (`classifyPayGap`, `computeGenderGap`, `MIN_GROUP_SIZE`, reuse of `fteTotalMonthlyComp`) → Task 1.
- Aggregate query (grouping, FTE, masking, unbanded, ordering, org-scope, codegen) → Task 2.
- i18n in all five locales + help keys → Task 3.
- Flag chip (traffic-light, one place, amber token) → Task 4.
- The two grouped tables + summary + unbanded note + skeleton + help + detail placement + "Population" heading → Task 5.
- Non-goals (gate, median, base salary, P2/P3, export, trend) → not built; nothing in the tasks adds them.

**Placeholder scan:** No TBD/TODO; every code + test step carries complete code and exact commands.

**Type consistency:** `PayGapFlag` union identical in core (Task 1), the query validator + type (Task 2), the badge (Task 4), and the view's local `GapGroup` (Task 5). `GapGroup` fields (`womenMeanComp`, `menMeanComp`, `gapPct`, `roleTitle`, `level`, `band`, counts, `flag`, `key`) match between the query wire shape (Task 2) and the UI interface (Task 5). Query args `{ runId }` with injected `orgId` match the client call in Task 5. `getPayMappingGap` name identical across Tasks 2 and 5.

**Note for the executor:** the flag emoji (🔴🟠✅⚪) in ADR-0012 are documentation shorthand; the UI renders colored text chips (`PayGapFlagBadge`), not emoji. The `PayGapTableHeaderExported` wrapper in Task 5 exists only so the skeleton and loaded table share one header without exporting the internal component name; an implementer may instead export `PayGapTableHeader` directly and drop the wrapper if cleaner.
