import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
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
  birthDate?: string
}

async function seedRun(
  t: ReturnType<typeof initConvexTest>,
  rows: SeedRow[]
): Promise<{
  orgId: string
  runId: Id<"payMappingRuns">
  asHr: ReturnType<typeof t.withIdentity>
}> {
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
        ...(r.birthDate !== undefined ? { birthDate: r.birthDate } : {}),
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
  it("groups equal-work by (roleTitle, band, level) and computes the gap", async () => {
    const t = initConvexTest()
    // One equal-work group: SWE, band 3, Senior, 2 women @ 90k, 2 men @ 100k.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Senior",
        band: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Senior",
        band: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Senior",
        band: 3,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Senior",
        band: 3,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result).not.toBeNull()
    expect(result?.currency).toBe("SEK")
    expect(result?.equalWork).toHaveLength(1)
    const group = result?.equalWork[0]
    expect(group?.roleTitle).toBe("SWE")
    expect(group?.level).toBe("Senior")
    expect(group?.band).toBe(3)
    expect(group?.womenCount).toBe(2)
    expect(group?.menCount).toBe(2)
    expect(group?.gapPct).toBeCloseTo(10, 5)
    expect(group?.flag).toBe("elevated")
  })

  it("groups equivalent-work by band across different roles", async () => {
    const t = initConvexTest()
    // Band 2 spans two roles; 2 women @ 80k + 2 men @ 100k => 20% gap.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 80000,
      },
      {
        gender: "Kvinna",
        roleTitle: "PM",
        level: "Mid",
        band: 2,
        basicMonthly: 80000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equivalentWork).toHaveLength(1)
    const band2 = result?.equivalentWork[0]
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
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 50000,
        ftePercent: 50,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork[0]?.womenMeanComp).toBeCloseTo(100000, 0)
    expect(result?.equalWork[0]?.gapPct).toBeCloseTo(0, 5)
    expect(result?.equalWork[0]?.flag).toBe("ok")
  })

  it("masks a single-gender group: counts kept, means and gap nulled", async () => {
    const t = initConvexTest()
    // Only men in the group => no woman-man comparison => insufficient, and
    // the mean is masked (it would only restate individual pay). A small
    // MIXED group stays computable (ADR-0012 amendment: in-app there is no
    // group-size minimum; the small-cell minimums apply at export).
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Man",
        roleTitle: "Lead",
        level: "Staff",
        band: 1,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "Lead",
        level: "Staff",
        band: 1,
        basicMonthly: 100000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Analyst",
        level: "Mid",
        band: 2,
        basicMonthly: 45000,
      },
      {
        gender: "Man",
        roleTitle: "Analyst",
        level: "Mid",
        band: 2,
        basicMonthly: 50000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    const masked = result?.equalWork.find((group) => group.roleTitle === "Lead")
    expect(masked?.flag).toBe("insufficient")
    expect(masked?.womenCount).toBe(0)
    expect(masked?.menCount).toBe(2)
    expect(masked?.womenMeanComp).toBeNull()
    expect(masked?.menMeanComp).toBeNull()
    expect(masked?.gapPct).toBeNull()
    // The 1-woman + 1-man group computes a real gap.
    const mixed = result?.equalWork.find(
      (group) => group.roleTitle === "Analyst"
    )
    expect(mixed?.flag).toBe("elevated")
    expect(mixed?.gapPct).toBeCloseTo(10, 5)
    expect(mixed?.womenMeanComp).toBe(45000)
  })

  it("excludes null-band priced rows from equivalentWork", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "New",
        level: "Mid",
        band: null,
        basicMonthly: 70000,
      },
      {
        gender: "Man",
        roleTitle: "New",
        level: "Mid",
        band: null,
        basicMonthly: 70000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equivalentWork).toHaveLength(0)
    // The rows still form an equal-work group (title, none, level).
    expect(result?.equalWork).toHaveLength(1)
    expect(result?.equalWork[0]?.band).toBeNull()
  })

  it("ignores rows with no pay", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: null,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: null,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork).toHaveLength(0)
    expect(result?.equivalentWork).toHaveLength(0)
    expect(result?.currency).toBeNull()
  })

  it("returns null for a run in another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 90000,
      },
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

  it("returns an org-level aggregate over all priced rows (not masked)", async () => {
    const t = initConvexTest()
    // 3 women @ 90k, 3 men @ 100k across two roles => org gap 10%.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "PM",
        level: "Mid",
        band: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        level: "Mid",
        band: 3,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        level: "Mid",
        band: 3,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.org.womenCount).toBe(3)
    expect(result?.org.menCount).toBe(3)
    // Org means are real population averages, never masked.
    expect(result?.org.womenMeanComp).toBeCloseTo(90000, 0)
    expect(result?.org.menMeanComp).toBeCloseTo(100000, 0)
    expect(result?.org.gapPct).toBeCloseTo(10, 5)
    expect(result?.org.flag).toBe("elevated")
  })

  it("marks the org gap insufficient when a gender is missing", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.org.flag).toBe("insufficient")
    expect(result?.org.gapPct).toBeNull()
  })

  it("returns pay-quartile gender tallies over the priced rows", async () => {
    const t = initConvexTest()
    // 4 people, one per quartile: the two lowest-paid are women.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 30000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 35000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 40000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 45000,
      },
      // Unpriced rows never enter the quartile ranking.
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: null,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.quartiles).toEqual([
      { women: 1, men: 0 },
      { women: 1, men: 0 },
      { women: 0, men: 1 },
      { women: 0, men: 1 },
    ])
  })

  it("returns age bands at the reference date over the whole population", async () => {
    const t = initConvexTest()
    // referenceDate 1_700_000_000_000 = 2023-11-14: 1990-01-01 is 33 (30-39,
    // index 2); an unpriced row still counts (demographics view); a missing
    // birth date lands in unknown.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 90000,
        birthDate: "1990-01-01",
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: null,
        birthDate: "1985-06-15",
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        level: "Mid",
        band: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    // 1990-01-01 -> 33 and 1985-06-15 -> 38: both in the 30-39 band.
    expect(result?.age.buckets[2]).toEqual({ women: 1, men: 1 })
    expect(result?.age.unknown).toBe(1)
    expect(result?.age.buckets).toHaveLength(7)
    // The population split covers the whole frozen population, priced or not.
    expect(result?.population).toEqual({ women: 1, men: 2 })
  })

  it("returns the women-dominated cross-level comparison", async () => {
    const t = initConvexTest()
    // Nurse (band 3, Mid): 3 women @ 38000 => 100% women, women-dominated.
    // Tech (band 3, Mid): 1 woman + 2 men @ 42000 => not dominated, out-earns
    // Nurse by 4000. An unbanded priced person cannot be placed and is
    // skipped entirely from the comparison.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        level: "Mid",
        band: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        level: "Mid",
        band: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        level: "Mid",
        band: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Tech",
        level: "Mid",
        band: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Tech",
        level: "Mid",
        band: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Tech",
        level: "Mid",
        band: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Support",
        level: "Junior",
        band: null,
        basicMonthly: 50000,
      },
    ])

    const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(gap?.womenDominated).toHaveLength(1)
    const group = gap?.womenDominated[0]
    expect(group?.roleTitle).toBe("Nurse")
    expect(group?.womenSharePct).toBe(100)
    expect(group?.comparisons).toHaveLength(1)
    expect(group?.comparisons[0]?.roleTitle).toBe("Tech")
    expect(group?.comparisons[0]?.diffSek).toBe(4000)
  })
})
