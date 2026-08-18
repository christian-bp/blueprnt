import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"
import { comparisonDocumentationKey } from "./gap"

// Directly seed a run + snapshot rows (freeze logic is covered by runs.test.ts);
// this gives exact control over gender/level/seniority/pay per row.
const OPERATOR = "HR Person"

interface SeedRow {
  gender: "Man" | "Kvinna"
  roleTitle: string
  seniority: string
  level: number | null
  basicMonthly: number | null
  components?: { kind: string; monthlyAmount: number }[]
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
      womenCount: rows.filter((r) => r.gender === "Kvinna").length,
      menCount: rows.filter((r) => r.gender === "Man").length,
      orgGapPct: null,
      orgGapFlag: "insufficient",
      frozenModel: { criteria: [], levelThresholds: [] },
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
        seniority: r.seniority,
        level: r.level,
        score: r.level === null ? null : 50,
        basicMonthly: r.basicMonthly,
        components: r.components ?? [],
        ...(r.basicMonthly !== null ? { currency: "SEK" } : {}),
      })
    }
    return id
  })
  return { orgId, runId, asHr }
}

describe("getPayMappingGap", () => {
  it("groups equal-work by (roleTitle, level) and computes both metrics", async () => {
    const t = initConvexTest()
    // One equal-work group: SWE, level 3, Senior, 2 women @ 90k, 2 men @ 100k.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Senior",
        level: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Senior",
        level: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Senior",
        level: 3,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Senior",
        level: 3,
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
    // A group spans every seniority step in the title at this level
    // (ADR-0017), so it carries none of its own.
    expect(group?.seniority).toBeNull()
    expect(group?.level).toBe(3)
    expect(group?.womenCount).toBe(2)
    expect(group?.menCount).toBe(2)
    expect(group?.base.gapPct).toBeCloseTo(10, 5)
    expect(group?.base.gapKr).toBeCloseTo(10000, 5)
    // No components seeded, so total comp mirrors base salary.
    expect(group?.tcc.gapPct).toBeCloseTo(10, 5)
    expect(group?.flag).toBe("elevated")
    expect(group?.tccDriven).toBe(false)
  })

  it("groups equivalent-work by level across different roles", async () => {
    const t = initConvexTest()
    // Level 2 spans two roles; 2 women @ 80k + 2 men @ 100k => 20% gap.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 80000,
      },
      {
        gender: "Kvinna",
        roleTitle: "PM",
        seniority: "Mid",
        level: 2,
        basicMonthly: 80000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equivalentWork).toHaveLength(1)
    const level2 = result?.equivalentWork[0]
    expect(level2?.level).toBe(2)
    expect(level2?.roleTitle).toBeNull()
    expect(level2?.womenCount).toBe(2)
    expect(level2?.base.gapPct).toBeCloseTo(20, 5)
    expect(level2?.flag).toBe("critical")
  })

  it("FTE-adjusts a part-timer and routes the gapless group to reverse", async () => {
    const t = initConvexTest()
    // A 50% woman at 50k grosses to 100k, matching the men => no gap, so the
    // group fails the entry condition (women's mean is not below men's) and
    // lands in the info-view bucket instead of the primary flow.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 50000,
        ftePercent: 50,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork).toHaveLength(0)
    expect(result?.excluded.reverse).toHaveLength(1)
    const group = result?.excluded.reverse[0]
    expect(group?.base.womenMean).toBeCloseTo(100000, 0)
    expect(group?.base.gapPct).toBeCloseTo(0, 5)
    expect(group?.flag).toBe("ok")
  })

  it("routes a women-ahead group to the reverse info-view bucket", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 110000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 110000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork).toHaveLength(0)
    const group = result?.excluded.reverse[0]
    expect(group?.base.gapPct).toBeCloseTo(-10, 5)
    // The direction rule: women ahead is not a finding.
    expect(group?.flag).toBe("ok")
  })

  it("routes a 2+ single-gender group to the deep-dive bucket, keeps a mixed pair computable", async () => {
    const t = initConvexTest()
    // Only men in the Lead group => no woman-man comparison => out of the
    // primary flow, listed for the opt-in deep-dive. The 1-woman + 1-man
    // Analyst group stays computable (ADR-0012 amendment: in-app there is no
    // group-size minimum; the small-cell minimums apply at export).
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Man",
        roleTitle: "Lead",
        seniority: "Staff",
        level: 1,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "Lead",
        seniority: "Staff",
        level: 1,
        basicMonthly: 100000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Analyst",
        seniority: "Mid",
        level: 2,
        basicMonthly: 45000,
      },
      {
        gender: "Man",
        roleTitle: "Analyst",
        seniority: "Mid",
        level: 2,
        basicMonthly: 50000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.excluded.genderPure).toEqual([
      {
        // roleTitle|level (ADR-0017), and no seniority of its own.
        key: "Lead|1",
        roleTitle: "Lead",
        seniority: null,
        level: 1,
        gender: "Man",
        count: 2,
      },
    ])
    // The 1-woman + 1-man group computes a real gap in the primary flow.
    expect(result?.equalWork).toHaveLength(1)
    const mixed = result?.equalWork[0]
    expect(mixed?.roleTitle).toBe("Analyst")
    expect(mixed?.flag).toBe("elevated")
    expect(mixed?.base.gapPct).toBeCloseTo(10, 5)
    expect(mixed?.base.womenMean).toBe(45000)
  })

  it("silently drops a 1-person group, keeping only a count", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "CFO",
        seniority: "Exec",
        level: 1,
        basicMonthly: 150000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Analyst",
        seniority: "Mid",
        level: 2,
        basicMonthly: 45000,
      },
      {
        gender: "Man",
        roleTitle: "Analyst",
        seniority: "Mid",
        level: 2,
        basicMonthly: 50000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    // The CFO singleton appears nowhere: not in the flow, not in the
    // deep-dive or info buckets. Only the count survives (the report's
    // methodology note).
    expect(result?.equalWork.map((g) => g.roleTitle)).toEqual(["Analyst"])
    expect(result?.excluded.genderPure).toHaveLength(0)
    expect(result?.excluded.reverse).toHaveLength(0)
    expect(result?.excluded.singletonCount).toBe(1)
  })

  it("admits a bonus-driven gap as tccDriven", async () => {
    const t = initConvexTest()
    // Equal base salary; the men carry a 10k monthly bonus => base gap 0,
    // tcc gap 16.7% => shown, tccDriven, flagged from the tcc metric.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "Sales",
        seniority: "Mid",
        level: 2,
        basicMonthly: 50000,
      },
      {
        gender: "Man",
        roleTitle: "Sales",
        seniority: "Mid",
        level: 2,
        basicMonthly: 50000,
        components: [{ kind: "bonus", monthlyAmount: 10000 }],
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork).toHaveLength(1)
    const group = result?.equalWork[0]
    expect(group?.tccDriven).toBe(true)
    expect(group?.base.gapPct).toBeCloseTo(0, 5)
    expect(group?.tcc.gapPct).toBeCloseTo(16.666, 2)
    expect(group?.flag).toBe("critical")
  })

  it("excludes null-level priced rows from equivalentWork but classifies them for equal work", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "New",
        seniority: "Mid",
        level: null,
        basicMonthly: 60000,
      },
      {
        gender: "Man",
        roleTitle: "New",
        seniority: "Mid",
        level: null,
        basicMonthly: 70000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equivalentWork).toHaveLength(0)
    // The rows still form a shown equal-work group (title, none, seniority).
    expect(result?.equalWork).toHaveLength(1)
    expect(result?.equalWork[0]?.level).toBeNull()
    expect(result?.equalWork[0]?.base.gapPct).toBeCloseTo(14.2857, 3)
  })

  it("masks a single-gender level in the equivalent-work list", async () => {
    const t = initConvexTest()
    // Level 1 holds only men: the per-level list keeps the level (the
    // women-dominated chapter's level context reads it) but masks its means.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Man",
        roleTitle: "Lead",
        seniority: "Staff",
        level: 1,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "Lead",
        seniority: "Staff",
        level: 1,
        basicMonthly: 90000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    const level1 = result?.equivalentWork[0]
    expect(level1?.flag).toBe("insufficient")
    expect(level1?.base.womenMean).toBeNull()
    expect(level1?.base.menMean).toBeNull()
    expect(level1?.base.gapPct).toBeNull()
    expect(level1?.tcc.gapPct).toBeNull()
  })

  it("ignores rows with no pay", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: null,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: null,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    expect(result?.equalWork).toHaveLength(0)
    expect(result?.equivalentWork).toHaveLength(0)
    expect(result?.excluded.singletonCount).toBe(0)
    expect(result?.currency).toBeNull()
  })

  it("returns null for a run in another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
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
        seniority: "Mid",
        level: 2,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 90000,
      },
      {
        gender: "Kvinna",
        roleTitle: "PM",
        seniority: "Mid",
        level: 3,
        basicMonthly: 90000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        seniority: "Mid",
        level: 3,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "PM",
        seniority: "Mid",
        level: 3,
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
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
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
        seniority: "Mid",
        level: 2,
        basicMonthly: 30000,
      },
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 35000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 40000,
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 45000,
      },
      // Unpriced rows never enter the quartile ranking.
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
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

  it("counts the whole frozen population, priced or not", async () => {
    const t = initConvexTest()
    // referenceDate 1_700_000_000_000 = 2023-11-14: 1990-01-01 is 33 (30-39,
    // index 2); an unpriced row still counts (demographics view); a missing
    // birth date lands in unknown.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 90000,
        birthDate: "1990-01-01",
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: null,
        birthDate: "1985-06-15",
      },
      {
        gender: "Man",
        roleTitle: "SWE",
        seniority: "Mid",
        level: 2,
        basicMonthly: 100000,
      },
    ])

    const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    // The population split covers every frozen row, including the unpriced
    // one the gap statistics themselves leave out.
    expect(result?.population).toEqual({ women: 1, men: 2 })
  })

  it("keeps gender-pure and singleton groups in the women-dominated comparison", async () => {
    const t = initConvexTest()
    // Nurse (level 3, Mid): 3 women @ 38000 => 100% women, women-dominated,
    // AND gender-pure, so it leaves the lika arbete flow but must stay in
    // DL 3:9's cross-comparison (an all-women group is the very case that
    // comparison exists for). Tech (level 3, Mid): 1 woman + 2 men @ 42000,
    // no internal gap => reverse for lika arbete, but still the comparator
    // that out-earns Nurse by 4000. Assistant (level 2, one woman @ 30000):
    // a SINGLETON, silently dropped from lika arbete, yet 100% women and
    // therefore still a women-dominated group in DL 3:9's cross-comparison
    // (the entry conditions govern only the WITHIN-group comparison, ADR-0015
    // §2; a lone female assistant out-earned by a lower-valued group is the
    // comparison's textbook case). An unleveled priced person cannot be
    // placed and is skipped entirely from the comparison.
    const { orgId, runId, asHr } = await seedRun(t, [
      {
        gender: "Kvinna",
        roleTitle: "Assistant",
        seniority: "Mid",
        level: 2,
        basicMonthly: 30000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        seniority: "Mid",
        level: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        seniority: "Mid",
        level: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Nurse",
        seniority: "Mid",
        level: 3,
        basicMonthly: 38000,
      },
      {
        gender: "Kvinna",
        roleTitle: "Tech",
        seniority: "Mid",
        level: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Tech",
        seniority: "Mid",
        level: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Tech",
        seniority: "Mid",
        level: 3,
        basicMonthly: 42000,
      },
      {
        gender: "Man",
        roleTitle: "Support",
        seniority: "Junior",
        level: null,
        basicMonthly: 50000,
      },
    ])

    const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })

    // The entry conditions routed all three groups out of the primary flow
    // (the Assistant and Support singletons silently, Nurse to the
    // deep-dive)...
    expect(gap?.equalWork).toHaveLength(0)
    expect(gap?.excluded.genderPure.map((g) => g.roleTitle)).toEqual(["Nurse"])
    expect(gap?.excluded.singletonCount).toBe(2)
    // ...but the statutory cross-comparison still sees them.
    expect(gap?.womenDominated).toHaveLength(2)
    const nurse = gap?.womenDominated.find((g) => g.roleTitle === "Nurse")
    expect(nurse?.womenSharePct).toBe(100)
    expect(nurse?.comparisons).toHaveLength(1)
    expect(nurse?.comparisons[0]?.roleTitle).toBe("Tech")
    expect(nurse?.comparisons[0]?.diffSek).toBe(4000)
    // The leveled singleton woman IS a women-dominated group of her own,
    // compared against the lower-valued Tech group that out-earns her.
    const assistant = gap?.womenDominated.find(
      (g) => g.roleTitle === "Assistant"
    )
    expect(assistant?.womenSharePct).toBe(100)
    expect(assistant?.comparisons[0]?.roleTitle).toBe("Tech")
    expect(assistant?.comparisons[0]?.diffSek).toBe(12000)
  })
})

// The composite identifying ONE documented comparison. Both halves are group
// keys in the "roleTitle|level" format, so both can contain the separator
// that format already uses: a plain join would let two different pairs
// produce the same string, and the gate would then treat one comparison as
// documenting another.
describe("comparisonDocumentationKey", () => {
  it("cannot collide with the separator inside a group key", () => {
    expect(comparisonDocumentationKey("Nurse|3", "Controller|6")).not.toBe(
      comparisonDocumentationKey("Nurse|3|Controller", "6")
    )
  })

  it("round-trips both halves", () => {
    const key = comparisonDocumentationKey("Nurse|3", "Controller|6")
    expect(JSON.parse(key)).toEqual(["Nurse|3", "Controller|6"])
  })
})
