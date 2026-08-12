import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// Minimal role row: only the fields orgStats/deriveResults touch matter for
// these tests (no model/criteria seeded, so ratedCount/totalCriteria are
// always 0; rolesEvaluated stays 0 by construction, which is fine since none
// of these tests assert on it).
async function seedRole(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  title: string
): Promise<Id<"roles">> {
  return t.run((ctx) =>
    ctx.db.insert("roles", {
      orgId,
      title,
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
      purpose: "",
      responsibilities: "",
    })
  )
}

async function seedRun(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  args: {
    label: string
    referenceDate: number
    populationCount: number
    womenCount: number
    menCount: number
    orgGapPct: number | null
  }
): Promise<Id<"payMappingRuns">> {
  return t.run((ctx) =>
    ctx.db.insert("payMappingRuns", {
      orgId,
      slug: args.label.toLowerCase().replace(/\s+/g, "-"),
      label: args.label,
      status: "completed",
      referenceDate: args.referenceDate,
      initiatedBy: "hr-user",
      initiatedAt: args.referenceDate,
      systemVersion: "test",
      populationCount: args.populationCount,
      withPayCount: args.populationCount,
      womenCount: args.womenCount,
      menCount: args.menCount,
      orgGapPct: args.orgGapPct,
      orgGapFlag: args.orgGapPct === null ? "insufficient" : "ok",
      frozenModel: { criteria: [], levelThresholds: [] },
    })
  )
}

async function seedPersonWithPay(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  args: {
    publicId: string
    displayName: string
    gender: "Man" | "Kvinna"
    basicMonthly: number
  }
): Promise<Id<"people">> {
  return t.run(async (ctx) => {
    const personId = await ctx.db.insert("people", {
      orgId,
      publicId: args.publicId,
      displayName: args.displayName,
      gender: args.gender,
    })
    await ctx.db.insert("payRecords", {
      orgId,
      personId,
      payYear: 2026,
      source: "manual",
      basicMonthly: args.basicMonthly,
      currency: "SEK",
      components: [],
      effectiveAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
    })
    return personId
  })
}

describe("assistant insights", () => {
  it("orgStats counts only the requested org", async () => {
    const t = initConvexTest()
    await seedRole(t, "org1", "System Developer")
    await seedRole(t, "org1", "Product Manager")
    await seedRole(t, "org2", "Designer")

    const stats = await t.query(internal.assistant.insights.orgStats, {
      orgId: "org1",
    })
    expect(stats.rolesTotal).toBe(2)
    expect(stats.summary).toContain("2")

    const other = await t.query(internal.assistant.insights.orgStats, {
      orgId: "org2",
    })
    expect(other.rolesTotal).toBe(1)
  })

  it("payMappingTrend returns per-run points and a direction summary", async () => {
    const t = initConvexTest()
    await seedRun(t, "org1", {
      label: "Mapping 1",
      referenceDate: 1_700_000_000_000,
      populationCount: 10,
      womenCount: 5,
      menCount: 5,
      orgGapPct: 6.1,
    })
    await seedRun(t, "org1", {
      label: "Mapping 2",
      referenceDate: 1_710_000_000_000,
      populationCount: 12,
      womenCount: 6,
      menCount: 6,
      orgGapPct: 4.2,
    })

    const trend = await t.query(internal.assistant.insights.payMappingTrend, {
      orgId: "org1",
      metric: "gap",
    })
    expect(trend.points).toHaveLength(2)
    expect(trend.points.every((p) => typeof p.value === "number")).toBe(true)
    expect(trend.points[0]?.value).toBeCloseTo(6.1)
    expect(trend.points[1]?.value).toBeCloseTo(4.2)
    expect(trend.summary.length).toBeGreaterThan(0)
  })

  it("payMappingTrend reports empty state without inventing numbers", async () => {
    const t = initConvexTest()
    const trend = await t.query(internal.assistant.insights.payMappingTrend, {
      orgId: "empty-org",
      metric: "headcount",
    })
    expect(trend.points).toHaveLength(0)
    expect(trend.summary).toContain("No")
  })

  it("payStats returns gender averages from the register", async () => {
    const t = initConvexTest()
    await seedPersonWithPay(t, "org1", {
      publicId: "p1",
      displayName: "Woman One",
      gender: "Kvinna",
      basicMonthly: 40000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p2",
      displayName: "Woman Two",
      gender: "Kvinna",
      basicMonthly: 42000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p3",
      displayName: "Woman Three",
      gender: "Kvinna",
      basicMonthly: 44000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p4",
      displayName: "Man One",
      gender: "Man",
      basicMonthly: 44000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p5",
      displayName: "Man Two",
      gender: "Man",
      basicMonthly: 46000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p6",
      displayName: "Man Three",
      gender: "Man",
      basicMonthly: 48000,
    })

    const expectedWomenAverage = (40000 + 42000 + 44000) / 3

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.suppressed).toBe(false)
    expect(women?.count).toBe(3)
    expect(women?.averagePay).toBeCloseTo(expectedWomenAverage)
    expect(stats.summary).not.toContain("undefined")
  })

  it("payStats suppresses groups below the floor instead of exposing them", async () => {
    const t = initConvexTest()
    await seedPersonWithPay(t, "org1", {
      publicId: "p1",
      displayName: "Woman One",
      gender: "Kvinna",
      basicMonthly: 40000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p2",
      displayName: "Woman Two",
      gender: "Kvinna",
      basicMonthly: 42000,
    })
    for (const [publicId, basicMonthly] of [
      ["p3", 44000],
      ["p4", 45000],
      ["p5", 46000],
      ["p6", 47000],
      ["p7", 48000],
    ] as const) {
      await seedPersonWithPay(t, "org1", {
        publicId,
        displayName: `Man ${publicId}`,
        gender: "Man",
        basicMonthly,
      })
    }

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.suppressed).toBe(true)
    expect(women?.averagePay).toBeNull()
    expect(women?.medianPay).toBeNull()
    // The count itself is safe to report; the pay values are not.
    expect(women?.count).toBe(2)
    expect(stats.summary).toContain("too small")

    const men = stats.groups.find((g) => g.key === "men")
    expect(men?.suppressed).toBe(false)
    expect(men?.count).toBe(5)
  })

  it("containsEmployeeName flags a full employee name, case-insensitive", async () => {
    const t = initConvexTest()
    await t.run((ctx) =>
      ctx.db.insert("people", {
        orgId: "org1",
        publicId: "p1",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      })
    )

    expect(
      await t.query(internal.assistant.insights.containsEmployeeName, {
        orgId: "org1",
        text: "why is anna svensson paid less than her team?",
      })
    ).toBe(true)
  })

  it("containsEmployeeName ignores single tokens and other orgs", async () => {
    const t = initConvexTest()
    await t.run((ctx) =>
      ctx.db.insert("people", {
        orgId: "org1",
        publicId: "p1",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      })
    )

    expect(
      await t.query(internal.assistant.insights.containsEmployeeName, {
        orgId: "org1",
        text: "how many people named Anna work here?",
      })
    ).toBe(false)
    expect(
      await t.query(internal.assistant.insights.containsEmployeeName, {
        orgId: "org2",
        text: "tell me about Anna Svensson",
      })
    ).toBe(false)
  })
})
