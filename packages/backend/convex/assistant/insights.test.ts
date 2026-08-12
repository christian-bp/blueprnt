import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// A fixed "now" for every payStats call, safely after every seeded
// effectiveAt below, so the current-pay selection rule (payRecordAt) always
// resolves the intended record without any test racing the real clock.
const NOW = 1_750_000_000_000
const BASE_EFFECTIVE_AT = 1_700_000_000_000

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

// Seeds a person with an arbitrary number of pay records (each its own
// effectiveAt), so tests can exercise the current-pay selection rule
// (payRecordAt: greatest effectiveAt <= asOf) directly through payStats.
async function seedPersonWithPayRecords(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  args: {
    publicId: string
    displayName: string
    gender: "Man" | "Kvinna"
    archivedAt?: number
    records: { basicMonthly: number; effectiveAt: number }[]
  }
): Promise<Id<"people">> {
  return t.run(async (ctx) => {
    const personId = await ctx.db.insert("people", {
      orgId,
      publicId: args.publicId,
      displayName: args.displayName,
      gender: args.gender,
      ...(args.archivedAt !== undefined ? { archivedAt: args.archivedAt } : {}),
    })
    for (const record of args.records) {
      await ctx.db.insert("payRecords", {
        orgId,
        personId,
        payYear: 2026,
        source: "manual",
        basicMonthly: record.basicMonthly,
        currency: "SEK",
        components: [],
        effectiveAt: record.effectiveAt,
        createdAt: record.effectiveAt,
      })
    }
    return personId
  })
}

async function seedPersonWithPay(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  args: {
    publicId: string
    displayName: string
    gender: "Man" | "Kvinna"
    basicMonthly: number
    archivedAt?: number
    currency?: string
  }
): Promise<Id<"people">> {
  if (args.currency === undefined) {
    return seedPersonWithPayRecords(t, orgId, {
      publicId: args.publicId,
      displayName: args.displayName,
      gender: args.gender,
      archivedAt: args.archivedAt,
      records: [
        { basicMonthly: args.basicMonthly, effectiveAt: BASE_EFFECTIVE_AT },
      ],
    })
  }
  return t.run(async (ctx) => {
    const personId = await ctx.db.insert("people", {
      orgId,
      publicId: args.publicId,
      displayName: args.displayName,
      gender: args.gender,
      ...(args.archivedAt !== undefined ? { archivedAt: args.archivedAt } : {}),
    })
    await ctx.db.insert("payRecords", {
      orgId,
      personId,
      payYear: 2026,
      source: "manual",
      basicMonthly: args.basicMonthly,
      currency: args.currency as string,
      components: [],
      effectiveAt: BASE_EFFECTIVE_AT,
      createdAt: BASE_EFFECTIVE_AT,
    })
    return personId
  })
}

// A differencing example: women n=2 avg 41000, men n=5 avg 46000. Before the
// fix, "all" (n=7) reported avg 44571.43, from which the withheld women's
// average is recoverable by subtraction:
// (7 * 44571.43 - 5 * 46000) / 2 = 41000 exactly.
async function seedDifferencingScenario(
  t: ReturnType<typeof initConvexTest>,
  orgId: string
) {
  await seedPersonWithPay(t, orgId, {
    publicId: "w1",
    displayName: "Woman One",
    gender: "Kvinna",
    basicMonthly: 40000,
  })
  await seedPersonWithPay(t, orgId, {
    publicId: "w2",
    displayName: "Woman Two",
    gender: "Kvinna",
    basicMonthly: 42000,
  })
  for (const [publicId, basicMonthly] of [
    ["m1", 44000],
    ["m2", 45000],
    ["m3", 46000],
    ["m4", 47000],
    ["m5", 48000],
  ] as const) {
    await seedPersonWithPay(t, orgId, {
      publicId,
      displayName: `Man ${publicId}`,
      gender: "Man",
      basicMonthly,
    })
  }
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
    expect(trend.runCount).toBe(2)
    expect(trend.points.every((p) => typeof p.value === "number")).toBe(true)
    expect(trend.points[0]?.value).toBeCloseTo(6.1)
    expect(trend.points[1]?.value).toBeCloseTo(4.2)
    // C2: period is composed in code from the numeric referenceDate, never
    // the run's user-typed label.
    expect(trend.points[0]?.period).toMatch(/^\d{4}-\d{2}$/)
    expect(trend.points[0]?.period).not.toBe("Mapping 1")
    expect(trend.summary.length).toBeGreaterThan(0)
  })

  it("payMappingTrend reports empty state without inventing numbers", async () => {
    const t = initConvexTest()
    const trend = await t.query(internal.assistant.insights.payMappingTrend, {
      orgId: "empty-org",
      metric: "headcount",
    })
    expect(trend.points).toHaveLength(0)
    expect(trend.runCount).toBe(0)
    expect(trend.summary).toContain("No")
  })

  it("payMappingTrend distinguishes 'no runs' from 'runs with no measurable reading'", async () => {
    const t = initConvexTest()
    await seedRun(t, "org1", {
      label: "Mapping 1",
      referenceDate: 1_700_000_000_000,
      populationCount: 10,
      womenCount: 10,
      menCount: 0,
      orgGapPct: null,
    })
    await seedRun(t, "org1", {
      label: "Mapping 2",
      referenceDate: 1_710_000_000_000,
      populationCount: 12,
      womenCount: 12,
      menCount: 0,
      orgGapPct: null,
    })

    const trend = await t.query(internal.assistant.insights.payMappingTrend, {
      orgId: "org1",
      metric: "gap",
    })
    expect(trend.points).toHaveLength(0)
    expect(trend.runCount).toBe(2)
    expect(trend.summary).toContain("No measurable readings")
    expect(trend.summary).toContain("2")
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
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.suppressed).toBe(false)
    expect(women?.count).toBe(3)
    expect(women?.averagePay).toBeCloseTo(expectedWomenAverage)
    expect(stats.summary).not.toContain("undefined")
    expect(stats.summary).toContain("in the current register")
  })

  it("payStats reports a distinct median when the distribution is skewed", async () => {
    const t = initConvexTest()
    // Mean (40000) and median (20000) deliberately differ: a mean/median
    // field swap in the implementation would pass every other test here but
    // fail this one.
    for (const [publicId, basicMonthly] of [
      ["w1", 10000],
      ["w2", 20000],
      ["w3", 90000],
    ] as const) {
      await seedPersonWithPay(t, "org1", {
        publicId,
        displayName: `Woman ${publicId}`,
        gender: "Kvinna",
        basicMonthly,
      })
    }
    for (const [publicId, basicMonthly] of [
      ["m1", 50000],
      ["m2", 60000],
      ["m3", 70000],
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
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.averagePay).toBeCloseTo(40000)
    expect(women?.medianPay).toBeCloseTo(20000)
    expect(women?.averagePay).not.toBeCloseTo(women?.medianPay as number)
  })

  it("payStats suppresses groups below the floor instead of exposing them", async () => {
    const t = initConvexTest()
    await seedDifferencingScenario(t, "org1")

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
      asOf: NOW,
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

    // C1: the "all" bucket is suppressed too, whenever any gender bucket is,
    // so the disclosed men average plus the disclosed all average could
    // never be used to back out the suppressed women average.
    const all = stats.groups.find((g) => g.key === "all")
    expect(all?.suppressed).toBe(true)
    expect(all?.averagePay).toBeNull()
    expect(all?.medianPay).toBeNull()
    expect(all?.count).toBe(7)
  })

  it("suppresses the all bucket when a gender bucket is floored (n=1)", async () => {
    const t = initConvexTest()
    await seedPersonWithPay(t, "org1", {
      publicId: "w1",
      displayName: "Woman One",
      gender: "Kvinna",
      basicMonthly: 41000,
    })
    for (const [publicId, basicMonthly] of [
      ["m1", 44000],
      ["m2", 45000],
      ["m3", 46000],
      ["m4", 47000],
      ["m5", 48000],
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
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    const men = stats.groups.find((g) => g.key === "men")
    const all = stats.groups.find((g) => g.key === "all")

    expect(women?.suppressed).toBe(true)
    expect(women?.averagePay).toBeNull()
    expect(men?.suppressed).toBe(false)
    // The disclosed men figure alone cannot reconstruct the withheld women
    // figure because the only other bucket ("all") is null too: there is no
    // second disclosed number to difference against.
    expect(all?.suppressed).toBe(true)
    expect(all?.averagePay).toBeNull()
    expect(all?.medianPay).toBeNull()
    expect(all?.count).toBe(6)
  })

  it("suppresses the all bucket when a gender bucket is floored (n=2)", async () => {
    const t = initConvexTest()
    await seedDifferencingScenario(t, "org1")

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
      asOf: NOW,
    })
    const men = stats.groups.find((g) => g.key === "men")
    const all = stats.groups.find((g) => g.key === "all")
    expect(men?.averagePay).toBeCloseTo(46000)
    // Previously "all" reported 44571.43 here, from which
    // (7 * 44571.43 - 5 * 46000) / 2 = 41000 recovers the withheld women
    // average exactly. With the fix, "all" carries no average at all.
    expect(all?.suppressed).toBe(true)
    expect(all?.averagePay).toBeNull()
    expect(all?.medianPay).toBeNull()
  })

  it("payStats on an empty org returns suppressed, non-crashing groups", async () => {
    const t = initConvexTest()
    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "empty-org",
      groupBy: "gender",
      asOf: NOW,
    })
    expect(stats.currency).toBeNull()
    for (const key of ["all", "women", "men"] as const) {
      const group = stats.groups.find((g) => g.key === key)
      expect(group?.count).toBe(0)
      expect(group?.suppressed).toBe(true)
      expect(group?.averagePay).toBeNull()
    }
    expect(stats.summary).not.toContain("undefined")
    expect(stats.summary).toContain("no women in the register")
    expect(stats.summary).toContain("no men in the register")
  })

  it("payStats reads an absent gender as 'no women/men in the register', not 'too small'", async () => {
    const t = initConvexTest()
    for (const [publicId, basicMonthly] of [
      ["m1", 44000],
      ["m2", 45000],
      ["m3", 46000],
      ["m4", 47000],
      ["m5", 48000],
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
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    const men = stats.groups.find((g) => g.key === "men")
    expect(women?.count).toBe(0)
    expect(women?.suppressed).toBe(true)
    expect(men?.suppressed).toBe(false)
    expect(men?.count).toBe(5)
    expect(stats.summary).toContain("no women in the register")
    expect(stats.summary).not.toContain("too small to report (0 people)")
  })

  it("payStats is org-scoped: another org's people never enter the count", async () => {
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
    await seedPersonWithPay(t, "org2", {
      publicId: "op1",
      displayName: "Other Org Person",
      gender: "Kvinna",
      basicMonthly: 999999,
    })

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    const all = stats.groups.find((g) => g.key === "all")
    expect(women?.count).toBe(3)
    expect(all?.count).toBe(3)
  })

  it("payStats excludes archived people from the count", async () => {
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
      publicId: "p4-archived",
      displayName: "Woman Archived",
      gender: "Kvinna",
      basicMonthly: 999999,
      archivedAt: BASE_EFFECTIVE_AT + 1,
    })

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      groupBy: "gender",
      asOf: NOW,
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.count).toBe(3)
    expect(women?.averagePay).toBeCloseTo((40000 + 42000 + 44000) / 3)
  })

  it("payStats with groupBy omitted returns only the all bucket", async () => {
    const t = initConvexTest()
    await seedPersonWithPay(t, "org1", {
      publicId: "p1",
      displayName: "Woman One",
      gender: "Kvinna",
      basicMonthly: 40000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p2",
      displayName: "Man One",
      gender: "Man",
      basicMonthly: 42000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "p3",
      displayName: "Man Two",
      gender: "Man",
      basicMonthly: 44000,
    })

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      asOf: NOW,
    })
    expect(stats.groups).toHaveLength(1)
    expect(stats.groups[0]?.key).toBe("all")
    expect(stats.groups[0]?.count).toBe(3)
  })

  it("payStats withholds a malformed currency code instead of interpolating it", async () => {
    const t = initConvexTest()
    for (const [publicId, basicMonthly] of [
      ["p1", 40000],
      ["p2", 42000],
      ["p3", 44000],
    ] as const) {
      await seedPersonWithPay(t, "org1", {
        publicId,
        displayName: `Person ${publicId}`,
        gender: "Kvinna",
        basicMonthly,
        currency: "sek; DROP",
      })
    }

    const stats = await t.query(internal.assistant.insights.payStats, {
      orgId: "org1",
      asOf: NOW,
    })
    expect(stats.currency).toBeNull()
    expect(stats.summary).not.toContain("sek; DROP")
  })

  it("payStats resolves current pay via the shared payRecordAt selection rule", async () => {
    const t = initConvexTest()
    // Older, newer, and future records for the same person: only the newer
    // one (effectiveAt <= NOW, greatest such effectiveAt) must be used.
    await seedPersonWithPayRecords(t, "org1", {
      publicId: "w1",
      displayName: "Woman One",
      gender: "Kvinna",
      records: [
        { basicMonthly: 30000, effectiveAt: 1_600_000_000_000 },
        { basicMonthly: 40000, effectiveAt: BASE_EFFECTIVE_AT },
        { basicMonthly: 99000, effectiveAt: 1_900_000_000_000 },
      ],
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "w2",
      displayName: "Woman Two",
      gender: "Kvinna",
      basicMonthly: 42000,
    })
    await seedPersonWithPay(t, "org1", {
      publicId: "w3",
      displayName: "Woman Three",
      gender: "Kvinna",
      basicMonthly: 44000,
    })
    for (const [publicId, basicMonthly] of [
      ["m1", 50000],
      ["m2", 60000],
      ["m3", 70000],
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
      asOf: NOW, // between the "newer" and "future" records
    })
    const women = stats.groups.find((g) => g.key === "women")
    expect(women?.suppressed).toBe(false)
    expect(women?.count).toBe(3)
    // (40000 + 42000 + 44000) / 3, not the older (30000) or future (99000)
    // record.
    expect(women?.averagePay).toBeCloseTo((40000 + 42000 + 44000) / 3)
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
