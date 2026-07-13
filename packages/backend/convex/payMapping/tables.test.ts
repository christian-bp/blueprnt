import { describe, expect, it } from "vitest"
import { uniqueSlug } from "../lib/slug"
import { initConvexTest } from "../testing.helpers"

describe("payMapping schema + slug", () => {
  it("stores and reads a payMappingRuns row", async () => {
    const t = initConvexTest()
    const runId = await t.run(async (ctx) =>
      ctx.db.insert("payMappingRuns", {
        orgId: "org1",
        slug: "lonekartlaggning-2026",
        label: "Lönekartläggning 2026",
        status: "active",
        referenceDate: 1,
        initiatedBy: "u1",
        initiatedAt: 1,
        systemVersion: "test",
        populationCount: 0,
        withPayCount: 0,
        unclassifiedExcludedCount: 0,
        frozenModel: { criteria: [], bandThresholds: [] },
      })
    )
    const row = await t.run(async (ctx) => ctx.db.get(runId))
    expect(row?.slug).toBe("lonekartlaggning-2026")
  })

  it("uniqueSlug avoids a taken payMappingRuns slug", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("payMappingRuns", {
        orgId: "org1",
        slug: "lonekartlaggning-2026",
        label: "x",
        status: "active",
        referenceDate: 1,
        initiatedBy: "u1",
        initiatedAt: 1,
        systemVersion: "test",
        populationCount: 0,
        withPayCount: 0,
        unclassifiedExcludedCount: 0,
        frozenModel: { criteria: [], bandThresholds: [] },
      })
      const slug = await uniqueSlug(
        ctx,
        "payMappingRuns",
        "org1",
        "Lönekartläggning 2026"
      )
      expect(slug).not.toBe("lonekartlaggning-2026")
      expect(slug.startsWith("lonekartlaggning-2026")).toBe(true)
    })
  })
})
