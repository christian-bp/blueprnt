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
        fullTimeHoursDefault: 165,
        populationCount: 0,
        womenCount: 0,
        menCount: 0,
        orgGapPct: null,
        orgGapFlag: "insufficient",
        withPayCount: 0,
        frozenModel: { criteria: [], levelThresholds: [] },
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
        fullTimeHoursDefault: 165,
        populationCount: 0,
        womenCount: 0,
        menCount: 0,
        orgGapPct: null,
        orgGapFlag: "insufficient",
        withPayCount: 0,
        frozenModel: { criteria: [], levelThresholds: [] },
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

  it("round-trips a snapshot row's frozen basis, raw amount, and hours", async () => {
    const t = initConvexTest()
    const rowId = await t.run(async (ctx) => {
      const runId = await ctx.db.insert("payMappingRuns", {
        orgId: "org1",
        slug: "lonekartlaggning-2027",
        label: "Lönekartläggning 2027",
        status: "active",
        referenceDate: 1,
        fullTimeHoursDefault: 165,
        initiatedBy: "u1",
        initiatedAt: 1,
        systemVersion: "test",
        populationCount: 1,
        womenCount: 1,
        menCount: 0,
        orgGapPct: null,
        orgGapFlag: "insufficient",
        withPayCount: 1,
        frozenModel: { criteria: [], levelThresholds: [] },
      })
      return ctx.db.insert("payMappingSnapshotRows", {
        orgId: "org1",
        runId,
        personPublicId: "p1",
        displayName: "Person 1",
        erased: false,
        gender: "Kvinna",
        roleTitle: "Cashier",
        trackKey: "operations",
        seniority: "IC1",
        level: 3,
        score: 50,
        basicMonthly: 32175,
        basis: "hourly",
        basicAmount: 195,
        hoursPerMonth: 165,
        components: [],
        currency: "SEK",
      })
    })
    const row = await t.run(async (ctx) => ctx.db.get(rowId))
    expect(row?.basis).toBe("hourly")
    expect(row?.basicAmount).toBe(195)
    expect(row?.hoursPerMonth).toBe(165)
    expect(row?.basicMonthly).toBe(32175)
  })
})
