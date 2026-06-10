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
