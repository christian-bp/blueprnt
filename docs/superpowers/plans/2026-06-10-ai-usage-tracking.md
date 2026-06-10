# AI Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture per-organization AI token usage and estimated cost on every successful AI generation, as append-only per-call events plus a per-org monthly rollup. Observe-only, internal-only.

**Architecture:** The three Convex generation actions in `ai/generate.ts` already receive `result.totalUsage` from the Vercel AI SDK and throw it away. They will call a best-effort internal mutation (`ai/usage.ts:recordAiUsage`) that derives org, feature kind, provider/model, and actor from the suggestion the generation belongs to, writes one `aiUsageEvents` row, and upserts the `aiUsageMonthly` rollup in the same transaction. Cost is snapshotted in integer nano-USD from a pricing constant. No enforcement, no UI, no client-callable function in V1; a future per-org quota becomes a single-row read of `aiUsageMonthly`.

**Tech Stack:** Convex (`internalMutation` / `internalQuery`, object syntax with validators, convex-test on edge-runtime), Vercel AI SDK v6 (`generateText` usage), Vitest 4, TypeScript, Biome.

**Spec:** `docs/superpowers/specs/2026-06-10-ai-usage-tracking-design.md`.

---

## Before you start

- Read `packages/backend/convex/_generated/ai/guidelines.md` (Convex rules that override training data: object-syntax functions, always declare `args` and `returns` validators, internal vs public functions).
- **Working-tree state:** the tree currently holds an unrelated uncommitted change (the `rejectSuggestion` hardening + Better Auth dep bumps). Land that on its own branch first (per the standing offer), or stash it, so this feature starts from a clean `main`. Confirm with the user how to sequence before branching.
- All user-facing text would go through i18n, but V1 adds none (no UI, no new error code), so there are no `packages/i18n` changes.
- Test/typecheck commands used throughout (run from the repo root `/Volumes/development/blueprnt/frontend`):
  - Backend tests: `bunx turbo run test --filter=@workspace/backend --force`
  - Backend typecheck: `bunx turbo run typecheck --filter=@workspace/backend --force`
  - Full gate (final): `bunx turbo run typecheck test --force`
- The pre-commit hook (`.githooks/pre-commit`) runs Biome on staged files plus the full typecheck and test suite on every commit. Never use `--no-verify`.

## File structure

| File | Responsibility | Action |
| --- | --- | --- |
| `packages/backend/convex/ai/pricing.ts` | `MODEL_PRICING` snapshot + pure `estimateCostNanos` | Create |
| `packages/backend/convex/ai/pricing.test.ts` | Unit tests for the cost helper | Create |
| `packages/backend/convex/ai/tables.ts` | `aiUsageEvents` + `aiUsageMonthly` table defs | Create |
| `packages/backend/convex/ai/usage.ts` | `recordAiUsage` mutation, `getOrgUsage` / `getTopOrgsByCost` queries, pure `monthKey` | Create |
| `packages/backend/convex/ai/usage.test.ts` | convex-test coverage for the mutation + queries + `monthKey` | Create |
| `packages/backend/convex/schema.ts` | Compose the two new tables | Modify |
| `packages/backend/convex/shared/tables.ts` | Add `requestedBy` to `suggestions` | Modify |
| `packages/backend/convex/ai/suggest.ts` | Stamp `requestedBy` at the 3 request-mutation insert sites | Modify |
| `packages/backend/convex/ai/suggest.test.ts` | Assert `requestedBy` is stamped | Modify |
| `packages/backend/convex/ai/generate.ts` | Call `recordAiUsage` after each `generateText` (best-effort) | Modify |
| `CLAUDE.md` | Scope note on the audit invariant for telemetry | Modify |

---

## Task 1: Pricing helper (pure)

**Files:**
- Create: `packages/backend/convex/ai/pricing.ts`
- Test: `packages/backend/convex/ai/pricing.test.ts`

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/ai-usage-tracking
```

- [ ] **Step 2: Write the failing test**

Create `packages/backend/convex/ai/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MODEL_PRICING, estimateCostNanos } from "./pricing"

describe("estimateCostNanos", () => {
  it("computes exact integer nano-USD for a known model", () => {
    // mistral-large-latest: 500 nano-USD per input token, 1500 per output token.
    expect(estimateCostNanos("mistral-large-latest", 1000, 200)).toBe(
      1000 * 500 + 200 * 1500
    )
  })

  it("is zero for zero tokens", () => {
    expect(estimateCostNanos("mistral-large-latest", 0, 0)).toBe(0)
  })

  it("returns null for a model with no pricing", () => {
    expect(estimateCostNanos("some-unpriced-model", 100, 100)).toBeNull()
  })

  it("pins the mistral-large-latest snapshot price", () => {
    expect(MODEL_PRICING["mistral-large-latest"]).toEqual({
      inNanosPerToken: 500,
      outNanosPerToken: 1500,
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: FAIL. `pricing.test.ts` cannot resolve `./pricing` (module does not exist yet).

- [ ] **Step 4: Implement the pricing module**

Create `packages/backend/convex/ai/pricing.ts`:

```ts
// AI usage cost is stored as integer nano-USD (1e-9 USD) so sub-dollar
// per-million rates stay exact: $0.50 per 1M tokens is exactly 500 nano-USD
// per token. Raw tokens are the source of truth; this estimate is snapshotted
// onto each usage event (ai/usage.ts) so a later price change never rewrites
// historical cost. To change a price, edit this map; do not mutate stored
// rows. Verified for mistral-large-latest against mistral.ai/pricing on
// 2026-06-10 (Mistral Large 3: $0.50/1M input, $1.50/1M output).
interface ModelPrice {
  inNanosPerToken: number
  outNanosPerToken: number
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "mistral-large-latest": { inNanosPerToken: 500, outNanosPerToken: 1500 },
}

// Returns integer nano-USD, or null when the model has no pricing entry (the
// caller still records the tokens, with cost 0, and logs the gap).
export function estimateCostNanos(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const price = MODEL_PRICING[model]
  if (price === undefined) return null
  return (
    inputTokens * price.inNanosPerToken + outputTokens * price.outNanosPerToken
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: PASS. All four `estimateCostNanos` tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/ai/pricing.ts packages/backend/convex/ai/pricing.test.ts
git commit -m "feat(ai): add nano-USD model pricing snapshot helper"
```

---

## Task 2: Schema (usage tables + suggestion `requestedBy`)

**Files:**
- Create: `packages/backend/convex/ai/tables.ts`
- Modify: `packages/backend/convex/shared/tables.ts`
- Modify: `packages/backend/convex/schema.ts`

This task is structural; its verification is typecheck plus the existing suite (no behavior change yet).

- [ ] **Step 1: Create the usage tables**

Create `packages/backend/convex/ai/tables.ts`:

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only AI usage telemetry: one row per successful AI generation,
// capturing the token usage the Vercel AI SDK reports (result.totalUsage).
// orgId, kind, provider, model, and actorId are derived from the suggestion
// the generation belongs to. estimatedCostNanos is a snapshot (ai/pricing.ts);
// raw token counts are the source of truth.
export const aiUsageEvents = defineTable({
  orgId: v.string(),
  // The suggestion target.kind: "model.draft" | "model.weightReview" | "role.profile".
  kind: v.string(),
  provider: v.string(),
  model: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
  cachedInputTokens: v.number(),
  estimatedCostNanos: v.number(),
  actorId: v.optional(v.string()),
  suggestionId: v.optional(v.id("suggestions")),
})
  .index("by_org", ["orgId"])
  .index("by_org_kind", ["orgId", "kind"])

// Per-org-per-month rollup, patched in the same transaction as each event so
// "spend per org" and a future per-org quota are a single-row read. period is
// a UTC "YYYY-MM" bucket; byKind holds the per-feature call count.
export const aiUsageMonthly = defineTable({
  orgId: v.string(),
  period: v.string(),
  callCount: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
  costNanos: v.number(),
  byKind: v.record(v.string(), v.number()),
}).index("by_org_period", ["orgId", "period"])
```

- [ ] **Step 2: Add `requestedBy` to the suggestions table**

In `packages/backend/convex/shared/tables.ts`, change:

```ts
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  confirmedBy: v.optional(v.string()),
  rejectedBy: v.optional(v.string()),
})
```

to:

```ts
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  // requestedBy: who triggered the AI generation; confirmedBy / rejectedBy:
  // who applied or dismissed it. The three are distinct provenance fields.
  requestedBy: v.optional(v.string()),
  confirmedBy: v.optional(v.string()),
  rejectedBy: v.optional(v.string()),
})
```

- [ ] **Step 3: Compose the new tables into the schema**

In `packages/backend/convex/schema.ts`, change:

```ts
import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

// Nine tables by design (ADR-0006): aggregates (anchors, band thresholds)
// live on their parent documents and the fixed V1 track schema is constants,
// so only entities with external references or independent write paths get
// a table of their own.
export default defineSchema({
  users,
  organizations,
  emails,
  auditLog,
  models,
  criteria,
  roleFamilies,
  roles,
  ratings,
  suggestions,
})
```

to:

```ts
import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { aiUsageEvents, aiUsageMonthly } from "./ai/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

// Nine domain tables by design (ADR-0006): aggregates (anchors, band
// thresholds) live on their parent documents and the fixed V1 track schema is
// constants, so only entities with external references or independent write
// paths get a table of their own. The two aiUsage* tables are append-only
// telemetry / rollup for AI cost tracking (spec 2026-06-10), outside that
// domain count.
export default defineSchema({
  users,
  organizations,
  emails,
  auditLog,
  models,
  criteria,
  roleFamilies,
  roles,
  ratings,
  suggestions,
  aiUsageEvents,
  aiUsageMonthly,
})
```

- [ ] **Step 4: Verify typecheck and the existing suite still pass**

Run: `bunx turbo run typecheck test --filter=@workspace/backend --force`
Expected: PASS. The schema compiles and all existing backend tests (including `suggest.test.ts`) stay green; the new optional fields break nothing.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/ai/tables.ts packages/backend/convex/shared/tables.ts packages/backend/convex/schema.ts
git commit -m "feat(ai): add aiUsageEvents/aiUsageMonthly tables and suggestion requestedBy"
```

---

## Task 3: `recordAiUsage` mutation + `monthKey`

**Files:**
- Create: `packages/backend/convex/ai/usage.ts`
- Test: `packages/backend/convex/ai/usage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/backend/convex/ai/usage.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { monthKey } from "./usage"

// Insert a suggestion row to attribute usage to. orgId is a plain string;
// recordAiUsage is internal and derives everything off the suggestion.
async function seedSuggestion(
  t: ReturnType<typeof initConvexTest>,
  overrides: Record<string, unknown> = {}
) {
  return t.run(async (ctx) =>
    ctx.db.insert("suggestions", {
      orgId: "org-acme",
      target: { kind: "model.draft" },
      suggestedValue: null,
      source: "ai",
      status: "suggested",
      model: { provider: "mistral", model: "mistral-large-latest" },
      requestedBy: "user-admin",
      ...overrides,
    })
  )
}

describe("monthKey", () => {
  it("buckets a timestamp by UTC year-month", () => {
    // Month is 0-indexed: 5 = June.
    expect(monthKey(Date.UTC(2026, 5, 10, 23, 30))).toBe("2026-06")
    expect(monthKey(Date.UTC(2026, 0, 1))).toBe("2026-01")
  })
})

describe("recordAiUsage", () => {
  it("writes an event and creates the monthly rollup", async () => {
    const t = initConvexTest()
    const suggestionId = await seedSuggestion(t)
    await t.mutation(internal.ai.usage.recordAiUsage, {
      suggestionId,
      inputTokens: 1000,
      outputTokens: 200,
      totalTokens: 1200,
      cachedInputTokens: 0,
    })
    await t.run(async (ctx) => {
      const events = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(events).toHaveLength(1)
      expect(events[0]?.model).toBe("mistral-large-latest")
      expect(events[0]?.kind).toBe("model.draft")
      expect(events[0]?.actorId).toBe("user-admin")
      expect(events[0]?.estimatedCostNanos).toBe(1000 * 500 + 200 * 1500)
      const monthly = await ctx.db
        .query("aiUsageMonthly")
        .withIndex("by_org_period", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(monthly).toHaveLength(1)
      expect(monthly[0]?.callCount).toBe(1)
      expect(monthly[0]?.costNanos).toBe(1000 * 500 + 200 * 1500)
      expect(monthly[0]?.byKind["model.draft"]).toBe(1)
    })
  })

  it("folds a second call into the same monthly row", async () => {
    const t = initConvexTest()
    const suggestionId = await seedSuggestion(t)
    for (let i = 0; i < 2; i++) {
      await t.mutation(internal.ai.usage.recordAiUsage, {
        suggestionId,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cachedInputTokens: 0,
      })
    }
    await t.run(async (ctx) => {
      const monthly = await ctx.db
        .query("aiUsageMonthly")
        .withIndex("by_org_period", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(monthly).toHaveLength(1)
      expect(monthly[0]?.callCount).toBe(2)
      expect(monthly[0]?.inputTokens).toBe(200)
      expect(monthly[0]?.byKind["model.draft"]).toBe(2)
      const events = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(events).toHaveLength(2)
    })
  })

  it("records tokens with zero cost for an unpriced model", async () => {
    const t = initConvexTest()
    const suggestionId = await seedSuggestion(t, {
      model: { provider: "x", model: "unpriced-model" },
    })
    await t.mutation(internal.ai.usage.recordAiUsage, {
      suggestionId,
      inputTokens: 100,
      outputTokens: 100,
      totalTokens: 200,
      cachedInputTokens: 0,
    })
    await t.run(async (ctx) => {
      const events = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(events).toHaveLength(1)
      expect(events[0]?.estimatedCostNanos).toBe(0)
    })
  })

  it("omits actorId when the suggestion has no requestedBy", async () => {
    const t = initConvexTest()
    const suggestionId = await t.run(async (ctx) =>
      ctx.db.insert("suggestions", {
        orgId: "org-acme",
        target: { kind: "role.profile" },
        suggestedValue: null,
        source: "ai",
        status: "suggested",
        model: { provider: "mistral", model: "mistral-large-latest" },
      })
    )
    await t.mutation(internal.ai.usage.recordAiUsage, {
      suggestionId,
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      cachedInputTokens: 0,
    })
    await t.run(async (ctx) => {
      const events = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", "org-acme"))
        .collect()
      expect(events[0]?.actorId).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: FAIL. `usage.test.ts` cannot resolve `./usage` / `internal.ai.usage` does not exist yet.

- [ ] **Step 3: Implement the mutation and `monthKey`**

Create `packages/backend/convex/ai/usage.ts`:

```ts
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { estimateCostNanos } from "./pricing"

// UTC "YYYY-MM" bucket for the monthly rollup. Pure, so it is unit-tested with
// fixed timestamps; the mutation passes Date.now().
export function monthKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 7)
}

// Records one usage event and folds it into the org's monthly rollup. Called
// best-effort by the generation actions after generateText returns. Derives
// org, feature kind, provider/model, and actor from the suggestion, so the
// caller passes only token counts.
//
// Deliberately writes NO audit row: this is append-only telemetry, not a
// user-initiated change to auditable domain state, and the event table is
// itself the log (see CLAUDE.md audit-invariant scope note).
export const recordAiUsage = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cachedInputTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId)
    if (suggestion === null) {
      // Suggestion vanished between generation and recording; nothing to
      // attribute. Best-effort: log and drop.
      console.error("ai usage recording: suggestion not found", {
        suggestionId: args.suggestionId,
      })
      return null
    }
    const provider = suggestion.model?.provider ?? "unknown"
    const model = suggestion.model?.model ?? "unknown"
    const kind = suggestion.target.kind
    const cost = estimateCostNanos(model, args.inputTokens, args.outputTokens)
    if (cost === null) {
      console.error("ai usage recording: no pricing for model", { model })
    }
    const costNanos = cost ?? 0

    await ctx.db.insert("aiUsageEvents", {
      orgId: suggestion.orgId,
      kind,
      provider,
      model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      cachedInputTokens: args.cachedInputTokens,
      estimatedCostNanos: costNanos,
      // Spread the optional field only when defined: explicit undefined is not
      // a valid Convex value.
      ...(suggestion.requestedBy !== undefined
        ? { actorId: suggestion.requestedBy }
        : {}),
      suggestionId: args.suggestionId,
    })

    const period = monthKey(Date.now())
    // At most one row per (orgId, period). Concurrent first-writes for the same
    // bucket are serialized by Convex OCC (the index-range read conflicts with
    // the other transaction's insert and retries), so .unique() never sees two.
    const existing = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", suggestion.orgId).eq("period", period)
      )
      .unique()
    if (existing === null) {
      await ctx.db.insert("aiUsageMonthly", {
        orgId: suggestion.orgId,
        period,
        callCount: 1,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        totalTokens: args.totalTokens,
        costNanos,
        byKind: { [kind]: 1 },
      })
    } else {
      await ctx.db.patch(existing._id, {
        callCount: existing.callCount + 1,
        inputTokens: existing.inputTokens + args.inputTokens,
        outputTokens: existing.outputTokens + args.outputTokens,
        totalTokens: existing.totalTokens + args.totalTokens,
        costNanos: existing.costNanos + costNanos,
        byKind: {
          ...existing.byKind,
          [kind]: (existing.byKind[kind] ?? 0) + 1,
        },
      })
    }
    return null
  },
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: PASS. The `monthKey` and all four `recordAiUsage` tests are green.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/ai/usage.ts packages/backend/convex/ai/usage.test.ts
git commit -m "feat(ai): record per-call AI usage events and monthly rollup"
```

---

## Task 4: Internal read queries

**Files:**
- Modify: `packages/backend/convex/ai/usage.ts`
- Test: `packages/backend/convex/ai/usage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `recordAiUsage` describe block's file (add a new describe in `packages/backend/convex/ai/usage.test.ts`):

```ts
describe("usage read queries", () => {
  it("getOrgUsage returns the org rollup and getTopOrgsByCost ranks by cost", async () => {
    const t = initConvexTest()
    const a = await t.run(async (ctx) =>
      ctx.db.insert("suggestions", {
        orgId: "org-a",
        target: { kind: "model.draft" },
        suggestedValue: null,
        source: "ai",
        status: "suggested",
        model: { provider: "mistral", model: "mistral-large-latest" },
      })
    )
    const b = await t.run(async (ctx) =>
      ctx.db.insert("suggestions", {
        orgId: "org-b",
        target: { kind: "model.draft" },
        suggestedValue: null,
        source: "ai",
        status: "suggested",
        model: { provider: "mistral", model: "mistral-large-latest" },
      })
    )
    // org-a: 100 input tokens => 50000 nanos. org-b: 1000 output tokens => 1500000 nanos.
    await t.mutation(internal.ai.usage.recordAiUsage, {
      suggestionId: a,
      inputTokens: 100,
      outputTokens: 0,
      totalTokens: 100,
      cachedInputTokens: 0,
    })
    await t.mutation(internal.ai.usage.recordAiUsage, {
      suggestionId: b,
      inputTokens: 0,
      outputTokens: 1000,
      totalTokens: 1000,
      cachedInputTokens: 0,
    })

    const aUsage = await t.query(internal.ai.usage.getOrgUsage, {
      orgId: "org-a",
    })
    expect(aUsage).toHaveLength(1)
    expect(aUsage[0]?.costNanos).toBe(100 * 500)

    const top = await t.query(internal.ai.usage.getTopOrgsByCost, {})
    expect(top[0]?.orgId).toBe("org-b")
    expect(top[1]?.orgId).toBe("org-a")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: FAIL. `internal.ai.usage.getOrgUsage` / `getTopOrgsByCost` do not exist yet.

- [ ] **Step 3: Add the queries**

In `packages/backend/convex/ai/usage.ts`, change the import line:

```ts
import { internalMutation } from "../_generated/server"
```

to:

```ts
import { internalMutation, internalQuery } from "../_generated/server"
```

Then append to the end of the file:

```ts
// Internal ops reads (V1: no client-callable usage surface). Used from the
// Convex dashboard to answer "how much has org X spent" and "where is the
// spend concentrated". Full-table scan in getTopOrgsByCost is fine at alpha
// volume; add a by_period index if the rollup ever grows large.
export const getOrgUsage = internalQuery({
  args: { orgId: v.string(), period: v.optional(v.string()) },
  returns: v.array(
    v.object({
      orgId: v.string(),
      period: v.string(),
      callCount: v.number(),
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      costNanos: v.number(),
      byKind: v.record(v.string(), v.number()),
    })
  ),
  handler: async (ctx, { orgId, period }) => {
    const rows = await ctx.db
      .query("aiUsageMonthly")
      .withIndex("by_org_period", (q) =>
        period === undefined
          ? q.eq("orgId", orgId)
          : q.eq("orgId", orgId).eq("period", period)
      )
      .collect()
    return rows.map((r) => ({
      orgId: r.orgId,
      period: r.period,
      callCount: r.callCount,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      costNanos: r.costNanos,
      byKind: r.byKind,
    }))
  },
})

export const getTopOrgsByCost = internalQuery({
  args: { period: v.optional(v.string()) },
  returns: v.array(
    v.object({
      orgId: v.string(),
      period: v.string(),
      costNanos: v.number(),
      totalTokens: v.number(),
      callCount: v.number(),
    })
  ),
  handler: async (ctx, { period }) => {
    const all = await ctx.db.query("aiUsageMonthly").collect()
    const rows =
      period === undefined ? all : all.filter((r) => r.period === period)
    return rows
      .sort((a, b) => b.costNanos - a.costNanos)
      .map((r) => ({
        orgId: r.orgId,
        period: r.period,
        costNanos: r.costNanos,
        totalTokens: r.totalTokens,
        callCount: r.callCount,
      }))
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: PASS. The read-query test is green.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/ai/usage.ts packages/backend/convex/ai/usage.test.ts
git commit -m "feat(ai): add internal usage read queries (per-org and top-by-cost)"
```

---

## Task 5: Stamp `requestedBy` in the request mutations

**Files:**
- Modify: `packages/backend/convex/ai/suggest.ts` (three insert sites)
- Test: `packages/backend/convex/ai/suggest.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/backend/convex/ai/suggest.test.ts`, add this test inside the `describe("AI suggestion lifecycle", ...)` block (place it after the first test, `requestModelDraft inserts a generating row with provenance`):

```ts
  it("requestModelDraft stamps requestedBy with the caller", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "requester@acme.se", name: "Requester", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "sv",
        industry: "itTelecom",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
      orgId,
      name: "Scratch",
    })
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.requestedBy).toBe(userId)
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: FAIL. `suggestion?.requestedBy` is `undefined` (the insert does not set it yet).

- [ ] **Step 3: Stamp `requestedBy` at the model-draft insert**

In `packages/backend/convex/ai/suggest.ts`, in `requestModelDraft`, change:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.draft", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
```

to:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.draft", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
```

- [ ] **Step 4: Stamp `requestedBy` at the weight-review insert**

In `requestWeightReview`, change:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.weightReview", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
```

to:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.weightReview", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
```

- [ ] **Step 5: Stamp `requestedBy` at the role-profile insert**

In `requestRoleProfileDraft`, change:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "role.profile", roleId },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
```

to:

```ts
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "role.profile", roleId },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bunx turbo run test --filter=@workspace/backend --force`
Expected: PASS. The new `requestedBy` test is green and every existing `suggest.test.ts` test still passes.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/ai/suggest.ts packages/backend/convex/ai/suggest.test.ts
git commit -m "feat(ai): stamp requestedBy on AI suggestions at request time"
```

---

## Task 6: Wire usage recording into the generation actions

**Files:**
- Modify: `packages/backend/convex/ai/generate.ts`

The three actions in `generate.ts` are `"use node"` modules that call the live model, so they are not unit-tested in this package (no existing `generate.test.ts`); the tested unit is `recordAiUsage` (Task 3). This task's verification is typecheck plus the full suite (no regression). The recording call is isolated in its own try/catch, so a usage-write failure can never flip a successful generation to `failed`.

- [ ] **Step 1: Add the imports and the best-effort helper**

In `packages/backend/convex/ai/generate.ts`, change the AI SDK import:

```ts
import { generateText, Output } from "ai"
```

to:

```ts
import { type LanguageModelUsage, generateText, Output } from "ai"
```

Change the server import:

```ts
import { internalAction } from "../_generated/server"
```

to:

```ts
import type { Id } from "../_generated/dataModel"
import { type ActionCtx, internalAction } from "../_generated/server"
```

Then add this helper immediately after the imports, above `const LANGUAGE_NAMES` (or any top-level position before the first action):

```ts
// Best-effort: record the token usage for a completed generation. Isolated in
// its own try/catch so a usage-write failure never turns a successful
// generation into a failure. result.totalUsage is the across-all-steps total
// (equal to result.usage for these single-step calls).
async function recordUsage(
  ctx: ActionCtx,
  suggestionId: Id<"suggestions">,
  usage: LanguageModelUsage
) {
  try {
    await ctx.runMutation(internal.ai.usage.recordAiUsage, {
      suggestionId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    })
  } catch (error) {
    console.error("ai usage recording failed", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
```

- [ ] **Step 2: Record usage in `generateModelDraft`**

In `generateModelDraft`, immediately after the `const result = await generateText({ ... })` call returns (before the `repairDraftWeights` line), add:

```ts
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
```

So the block reads:

```ts
      })
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
      // The exact-sum constraint crosses the LLM trust boundary: repair the
      // allocation deterministically before anything is persisted.
      const repairedPoints = repairDraftWeights(
```

- [ ] **Step 3: Record usage in `generateRoleProfileDraft`**

In `generateRoleProfileDraft`, immediately after its `const result = await generateText({ ... })` returns (before the `// Strip undefined optionals` comment), add:

```ts
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
```

So the block reads:

```ts
      })
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
      // Strip undefined optionals: explicit undefined is not a valid Convex
      // value and would fail runMutation arg serialization.
      const profile: {
```

- [ ] **Step 4: Record usage in `reviewWeights`**

In `reviewWeights`, immediately after its `const result = await generateText({ ... })` returns (before the `// Trust boundary: drop moves` comment), add:

```ts
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
```

So the block reads:

```ts
      })
      await recordUsage(ctx, args.suggestionId, result.totalUsage)
      // Trust boundary: drop moves with unknown ids, self-moves, or transfers
      // that leave the 1-5 scale against the current allocation snapshot, and
      const valid = distinctMoves(
```

- [ ] **Step 5: Verify typecheck and the full suite**

Run: `bunx turbo run typecheck test --filter=@workspace/backend --force`
Expected: PASS. `generate.ts` typechecks against the AI SDK `LanguageModelUsage` shape and `recordAiUsage`'s validators, and no existing test regresses.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/ai/generate.ts
git commit -m "feat(ai): record token usage after each AI generation"
```

---

## Task 7: Ratify the audit-invariant scope for telemetry

**Files:**
- Modify: `CLAUDE.md`

`recordAiUsage` deliberately writes no `AUDIT_EVENTS` row. CLAUDE.md treats the audit invariant as architecture-level, so document the carve-out rather than leaving it implicit.

- [ ] **Step 1: Amend the audit-invariant bullet**

In `CLAUDE.md`, under "Architecture invariants", change:

```md
- **Every state-changing mutation writes an audit row** via `logAudit` with an `AUDIT_EVENTS` key (`lib/audit.ts`). Adding a new auditable operation means adding its event key; result-affecting changes additionally log a `band.shift` diff.
```

to:

```md
- **Every state-changing mutation writes an audit row** via `logAudit` with an `AUDIT_EVENTS` key (`lib/audit.ts`). Adding a new auditable operation means adding its event key; result-affecting changes additionally log a `band.shift` diff. Scope: this governs user-initiated changes to auditable domain state. Append-only telemetry logs (e.g. AI usage events in `ai/usage.ts`) are outside it: they are not user-initiated domain changes and the event table is itself the record.
```

- [ ] **Step 2: Verify nothing else references the old wording**

Run: `grep -rn "Every state-changing mutation writes an audit row" CLAUDE.md`
Expected: one match, the amended line.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: scope the audit invariant to exclude append-only telemetry"
```

> **Note:** if the founder considers this an architecture change rather than a scope clarification, author a short Swedish ADR (`docs/adr/0007-*.md`, matching the existing ADR language) instead of, or in addition to, this CLAUDE.md edit. Confirm with the founder.

---

## Final verification

- [ ] **Run the full gate across all packages**

Run: `bunx turbo run typecheck test --force`
Expected: PASS. Every package's typecheck and tests are green, including the new `pricing.test.ts` and `usage.test.ts` and the amended `suggest.test.ts`. i18n parity is unaffected (no message keys added).

- [ ] **Confirm branch containment before any merge**

Run: `git diff feat/ai-usage-tracking main --stat`
Expected: shows exactly the files in the table above. Merge to `main` as one squash commit and delete the branch only after the user approves a push (per project rules).

---

## Self-review notes (author)

- **Spec coverage:** events table (Task 2), monthly rollup (Task 2/3), derive-from-suggestion + best-effort recording (Task 3/6), nano-USD snapshot cost (Task 1/3), actor via `requestedBy` (Task 2/5), internal read queries + future-quota shape (Task 4), success-only + isolated writes (Task 6), audit carve-out (Task 7). All present.
- **No client surface:** every new Convex function is `internal*`; no public query/mutation added, so no new auth or i18n surface.
- **Type consistency:** field names `estimatedCostNanos` (event) and `costNanos` (rollup), `byKind`, `requestedBy`/`actorId`, and `monthKey`/`estimateCostNanos`/`recordAiUsage`/`getOrgUsage`/`getTopOrgsByCost` are used identically across all tasks and tests.
- **Failure path:** failed generations record no usage (the `generateText` error path exposes none); this is intentional and documented in the spec's Out of scope.
