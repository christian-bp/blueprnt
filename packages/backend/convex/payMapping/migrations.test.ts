import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

const PAST = 1_700_000_000_000

describe("backfillActionCostUnit", () => {
  it("stamps oneOff on unit-less costs, leaves united and cost-less rows alone", async () => {
    const t = initConvexTest()
    const { legacyId, unitedId, freeId } = await t.run(async (ctx) => {
      const runId = await ctx.db.insert("payMappingRuns", {
        orgId: "org-1",
        slug: "m",
        label: "M",
        status: "active",
        referenceDate: PAST,
        initiatedBy: "u1",
        initiatedAt: PAST,
        systemVersion: "test",
        populationCount: 0,
        withPayCount: 0,
        womenCount: 0,
        menCount: 0,
        orgGapPct: null,
        orgGapFlag: "ok",
        frozenModel: { criteria: [] },
      })
      const row = (
        overrides: Partial<{
          estimatedCost: number
          estimatedCostUnit: "oneOff"
        }>
      ) => ({
        orgId: "org-1",
        runId: runId as Id<"payMappingRuns">,
        target: {
          kind: "group" as const,
          scope: "equalWork" as const,
          groupKey: "SWE|3",
        },
        problem: "P",
        plannedAction: "A",
        ownerUserId: "u1",
        plannedDate: PAST,
        priority: "low" as const,
        status: "notStarted" as const,
        createdBy: "u1",
        createdAt: PAST,
        ...overrides,
      })
      const legacyId = await ctx.db.insert(
        "payMappingActions",
        row({ estimatedCost: 1000 })
      )
      const unitedId = await ctx.db.insert(
        "payMappingActions",
        row({ estimatedCost: 2000, estimatedCostUnit: "oneOff" })
      )
      const freeId = await ctx.db.insert("payMappingActions", row({}))
      return { legacyId, unitedId, freeId }
    })

    let cursor: string | undefined
    let patched = 0
    for (;;) {
      const page = await t.mutation(
        internal.payMapping.migrations.backfillActionCostUnit,
        { cursor }
      )
      patched += page.patched
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(patched).toBe(1)

    const legacy = await t.run((ctx) => ctx.db.get(legacyId))
    expect(legacy?.estimatedCostUnit).toBe("oneOff")
    const united = await t.run((ctx) => ctx.db.get(unitedId))
    expect(united?.estimatedCostUnit).toBe("oneOff")
    const free = await t.run((ctx) => ctx.db.get(freeId))
    expect(free?.estimatedCost).toBeUndefined()
    expect(free?.estimatedCostUnit).toBeUndefined()

    // A second full pass finds nothing left to patch.
    const again = await t.mutation(
      internal.payMapping.migrations.backfillActionCostUnit,
      {}
    )
    expect(again.patched).toBe(0)
  })
})
