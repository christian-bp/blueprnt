import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// Directly seed a run + snapshot rows (freeze logic is covered by
// runs.test.ts; the grouping logic by gap.test.ts). This gives exact control
// over gender/level/seniority/pay per row so a group's flag (critical/ok) is
// deterministic.
const OPERATOR = "HR Person"

interface SeedRow {
  gender: "Man" | "Kvinna"
  roleTitle: string
  seniority: string
  level: number | null
  basicMonthly: number | null
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
        roleTitle: r.roleTitle,
        trackKey: "engineering",
        seniority: r.seniority,
        level: r.level,
        score: r.level === null ? null : 50,
        basicMonthly: r.basicMonthly,
        components: [],
        ...(r.basicMonthly !== null ? { currency: "SEK" } : {}),
      })
    }
    return id
  })
  return { orgId, runId, asHr }
}

// An equal-work group with a 20% gap (women 80k vs men 100k): magnitude > 10
// => "critical" => the ADR-0012 gate requires documentation.
const CRITICAL_GROUP_KEY = "SWE|3"
const criticalRows: SeedRow[] = [
  {
    gender: "Kvinna",
    roleTitle: "SWE",
    seniority: "Senior",
    level: 3,
    basicMonthly: 80000,
  },
  {
    gender: "Man",
    roleTitle: "SWE",
    seniority: "Senior",
    level: 3,
    basicMonthly: 100000,
  },
]

// An equal-work group with a small women-behind gap (2%, "ok" flag): it
// passes the ADR-0015 entry conditions (shown), but the gate does not
// require documentation (fri bock). A gapless group would instead be routed
// out of the flow entirely and stop being a valid documentation target.
const OK_GROUP_KEY = "PM|2"
const okRows: SeedRow[] = [
  {
    gender: "Kvinna",
    roleTitle: "PM",
    seniority: "Mid",
    level: 2,
    basicMonthly: 98000,
  },
  {
    gender: "Man",
    roleTitle: "PM",
    seniority: "Mid",
    level: 2,
    basicMonthly: 100000,
  },
]

// A women-dominated (100% women) equal-work group (Nurse) plus a comparator
// group (Tech) that out-earns it, mirroring gap.test.ts's "returns the
// women-dominated cross-level comparison" seed. The women-dominated groups
// share the equal-work group's key format
// (`${roleTitle}|${level}|${seniority}`).
const WOMEN_DOMINATED_GROUP_KEY = "Nurse|3"
const womenDominatedRows: SeedRow[] = [
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
]

describe("upsertGroupAnalysis", () => {
  it("inserts a new analysis row, listed back with note undefined -> null", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience"],
      note: undefined,
      done: false,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })

    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      // Equal work compares within one group, so its rows never carry a
      // comparator key.
      comparisonKey: null,
      reasons: ["experience"],
      note: null,
      done: false,
      // finding is praxis-only; an equalWork row always reads back null.
      finding: null,
    })
  })

  it("updates the same (scope, groupKey) row instead of inserting a second", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience"],
      note: undefined,
      done: false,
    })
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["competence"],
      note: "Updated analysis",
      done: true,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })

    expect(list).toHaveLength(1)
    expect(list[0]?.reasons).toEqual(["competence"])
    expect(list[0]?.note).toBe("Updated analysis")
    expect(list[0]?.done).toBe(true)
  })

  it("rejects done:true without reasons or note on a group that requires documentation", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, criticalRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: CRITICAL_GROUP_KEY,
        reasons: [],
        note: undefined,
        done: true,
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)
  })

  it("accepts done:true with only a note, but rejects a whitespace-only note", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, criticalRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: CRITICAL_GROUP_KEY,
      reasons: [],
      note: "A deepened analysis explaining the gap.",
      done: true,
    })
    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list[0]?.done).toBe(true)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: CRITICAL_GROUP_KEY,
        reasons: [],
        note: "   ",
        done: true,
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)
  })

  it("accepts done:true on an ok-flag group with no documentation (fri bock)", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: [],
      note: undefined,
      done: true,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list[0]?.done).toBe(true)
  })

  it("rejects an unknown groupKey for the scope with notFound", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: "DoesNotExist|1",
        reasons: [],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects upserting on a completed run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)
    await t.run(async (ctx) => {
      await ctx.db.patch(runId, { status: "completed" })
    })

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: OK_GROUP_KEY,
        reasons: [],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
  })

  it("writes exactly one payMapping.groupAnalysisUpdated audit row", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience", "competence"],
      note: undefined,
      done: true,
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.groupAnalysisUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.scope).toBe("equalWork")
    expect(payload.groupLabel).toBe("PM")
    const changes = payload.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    expect(changes.done).toEqual({ from: null, to: true })
    expect(changes.reasons).toEqual({
      from: null,
      to: "experience, competence",
    })
  })

  it("canonicalizes reasons order so resubmitting the same set reversed writes no diff", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience", "competence"],
      note: undefined,
      done: false,
    })
    // Same set, submitted in the opposite order.
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["competence", "experience"],
      note: undefined,
      done: false,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    // The stored row's reasons are in canonical (taxonomy) order, not either
    // submission's order.
    expect(list[0]?.reasons).toEqual(["experience", "competence"])

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.groupAnalysisUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(2)
    const secondPayload = audits[1]?.payload as Record<string, unknown>
    expect(secondPayload.changes).toEqual({})
  })

  it("scope equivalentWork: accepts a valid women-dominated group key and rejects an unknown one", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, womenDominatedRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      reasons: ["experience"],
      note: undefined,
      done: false,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      // The group's OWN row: no comparator key, so it is the row carrying the
      // klarmarkering and the summary note rather than one comparison's
      // explanation.
      comparisonKey: null,
      reasons: ["experience"],
      note: null,
      done: false,
      // finding is praxis-only; an equivalentWork row always reads back null.
      finding: null,
    })

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equivalentWork",
        groupKey: "DoesNotExist|1",
        reasons: [],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects equalWork documentation on a group the entry conditions excluded", async () => {
    const t = initConvexTest()
    // The all-women Nurse group is gender-pure: it leaves the primary lika
    // arbete flow (ADR-0015), so it is no longer a valid equalWork
    // documentation target; its documentation duty lives only under the
    // women-dominated (equivalentWork) scope.
    const { orgId, runId, asHr } = await seedRun(t, womenDominatedRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: WOMEN_DOMINATED_GROUP_KEY,
        reasons: [],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("isolates cross-org access: another org's member gets [] from list and notFound from upsert", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, okRows)

    // A member of a different org cannot read or write org A's run.
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    const list = await asOther.query(
      api.payMapping.analyses.listGroupAnalyses,
      {
        orgId: otherOrg,
        runId,
      }
    )
    expect(list).toEqual([])

    await expect(
      asOther.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId: otherOrg,
        runId,
        scope: "equalWork",
        groupKey: OK_GROUP_KEY,
        reasons: [],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("an update that only changes done produces an audit diff containing only the done field", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience"],
      note: "Some analysis",
      done: false,
    })
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equalWork",
      groupKey: OK_GROUP_KEY,
      reasons: ["experience"],
      note: "Some analysis",
      done: true,
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.groupAnalysisUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(2)
    const secondPayload = audits[1]?.payload as Record<string, unknown>
    const changes = secondPayload.changes as Record<string, unknown>
    expect(Object.keys(changes)).toEqual(["done"])
    expect(changes.done).toEqual({ from: false, to: true })
  })
})

describe("upsertGroupAnalysis: praxis scope", () => {
  it("inserts a praxis finding row, round-tripping via listGroupAnalyses with finding: none", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: undefined,
      done: true,
      finding: "none",
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })

    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      scope: "praxis",
      comparisonKey: null,
      groupKey: "payPolicy",
      reasons: [],
      note: null,
      done: true,
      finding: "none",
    })
  })

  it("rejects an unknown praxis area key with notFound", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "praxis",
        groupKey: "notAnArea",
        reasons: [],
        note: undefined,
        done: false,
        finding: undefined,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects non-empty reasons on a praxis row with invalidInput", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "praxis",
        groupKey: "payPolicy",
        reasons: ["experience"],
        note: undefined,
        done: false,
        finding: "none",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects done:true without a finding verdict", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "praxis",
        groupKey: "payPolicy",
        reasons: [],
        note: undefined,
        done: true,
        finding: undefined,
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)
  })

  it("rejects done:true with finding:found and an empty note, but accepts once a note is given", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "praxis",
        groupKey: "payPolicy",
        reasons: [],
        note: undefined,
        done: true,
        finding: "found",
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)

    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "praxis",
        groupKey: "payPolicy",
        reasons: [],
        note: "   ",
        done: true,
        finding: "found",
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: "Deficiency found in the collective agreement review.",
      done: true,
      finding: "found",
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list[0]?.done).toBe(true)
    expect(list[0]?.finding).toBe("found")
  })

  it("writes an audit row whose changes include a finding entry", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: undefined,
      done: true,
      finding: "none",
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.groupAnalysisUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.scope).toBe("praxis")
    // Pinned per the brief: praxis' groupKey is the raw constant area-key
    // slug, never split on "|" like the equalWork/equivalentWork internal
    // key format.
    expect(payload.groupLabel).toBe("payPolicy")
    const changes = payload.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    expect(changes.finding).toEqual({ from: null, to: "none" })
    expect(changes.done).toEqual({ from: null, to: true })
  })

  it("carries forward a stored finding when a later save omits it, with no false finding entry in the audit diff", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: "Deficiency found in the collective agreement review.",
      done: true,
      finding: "found",
    })

    // A later, in-progress note tweak that omits `finding` entirely (as an
    // autosave of just the note field would): the stored finding must not
    // be erased.
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: "Deficiency found in the collective agreement review, updated.",
      done: false,
      finding: undefined,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(1)
    // The stored row still has the previously saved finding: omitting the
    // arg is a carry-forward, not a clear.
    expect(list[0]?.finding).toBe("found")
    expect(list[0]?.note).toBe(
      "Deficiency found in the collective agreement review, updated."
    )

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.groupAnalysisUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(2)
    const secondPayload = audits[1]?.payload as Record<string, unknown>
    const changes = secondPayload.changes as Record<string, unknown>
    // No finding entry: the effective value ("found") is unchanged, so the
    // diff must not claim it went to null. Only note and done changed.
    expect(changes).not.toHaveProperty("finding")
    expect(Object.keys(changes).sort()).toEqual(["done", "note"])
  })

  it("allows marking done with finding omitted when a verdict was already saved (carry-forward satisfies the gate)", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: undefined,
      done: false,
      finding: "none",
    })

    // done:true with finding omitted must pass: the row already has a
    // stored verdict, so the gate is satisfied by the carried-forward value.
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: undefined,
      done: true,
      finding: undefined,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list[0]?.done).toBe(true)
    expect(list[0]?.finding).toBe("none")
  })
})

// DL 3 kap. 8 § p3 compares a women-dominated group against EACH equally or
// lower valued group that out-earns it, and 3 kap. 9 § asks what explains
// each of those differences. The unit of assessment is therefore the pair,
// not the group: one explanation covering four comparators of different sizes
// cannot be an assessment of any of them.
describe("upsertGroupAnalysis: per-comparison reasons", () => {
  async function seedWithComparator() {
    const t = initConvexTest()
    const seeded = await seedRun(t, womenDominatedRows)
    const gap = await seeded.asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId: seeded.orgId,
      runId: seeded.runId,
    })
    const group = gap?.womenDominated.find(
      (candidate) => candidate.key === WOMEN_DOMINATED_GROUP_KEY
    )
    const comparisonKey = group?.comparisons[0]?.key
    expect(comparisonKey).toBeDefined()
    return { ...seeded, comparisonKey: comparisonKey ?? "" }
  }

  it("keeps a comparison's reasons on their own row, beside the group's", async () => {
    const { orgId, runId, asHr, comparisonKey } = await seedWithComparator()

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      reasons: [],
      note: "Sammanfattning",
      done: false,
    })
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      comparisonKey,
      reasons: ["alternativeLabourMarket"],
      note: undefined,
      done: false,
    })

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(2)
    // Documenting a comparison must never overwrite the group's own row: the
    // klarmarkering and the summary note live there.
    expect(list.find((row) => row.comparisonKey === null)?.note).toBe(
      "Sammanfattning"
    )
    expect(
      list.find((row) => row.comparisonKey === comparisonKey)?.reasons
    ).toEqual(["alternativeLabourMarket"])
  })

  it("rejects a comparison key on an equal-work row", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, okRows)
    // Equal work compares within ONE group, so there is no comparator to key
    // a row against; storing one would create a row nothing ever reads.
    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equalWork",
        groupKey: OK_GROUP_KEY,
        comparisonKey: "Tech|3",
        reasons: ["alternativeLabourMarket"],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects a comparison key that is not a comparator of that group", async () => {
    const { orgId, runId, asHr } = await seedWithComparator()
    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equivalentWork",
        groupKey: WOMEN_DOMINATED_GROUP_KEY,
        comparisonKey: "NotAComparator|9",
        reasons: ["alternativeLabourMarket"],
        note: undefined,
        done: false,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("refuses klarmarkering while a comparison has no explanation", async () => {
    const { orgId, runId, asHr } = await seedWithComparator()
    // Enforced server-side from the frozen snapshot: the client's view of
    // what is documented is never trusted.
    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equivalentWork",
        groupKey: WOMEN_DOMINATED_GROUP_KEY,
        reasons: [],
        note: "Sammanfattning",
        done: true,
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)
  })

  it("allows klarmarkering once every comparison carries a reason", async () => {
    const { orgId, runId, asHr, comparisonKey } = await seedWithComparator()
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      comparisonKey,
      reasons: ["alternativeLabourMarket"],
      note: undefined,
      done: false,
    })
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      reasons: [],
      note: undefined,
      done: true,
    })
    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list.find((row) => row.comparisonKey === null)?.done).toBe(true)
  })

  // The same pair equal work accepts. The law asks for a bedömning of each
  // difference, not for our chip taxonomy, and refusing the written one here
  // left a reader who had written one per row unable to close the group.
  it("accepts a written assessment as a comparison's explanation", async () => {
    const { orgId, runId, asHr, comparisonKey } = await seedWithComparator()
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      comparisonKey,
      reasons: [],
      note: "Marknadsläget för rollen, styrkt med två rekryteringar.",
      done: false,
    })
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      reasons: [],
      note: undefined,
      done: true,
    })
    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    expect(list.find((row) => row.comparisonKey === null)?.done).toBe(true)
  })

  // Whitespace is not an assessment.
  it("does not take a blank note for an explanation", async () => {
    const { orgId, runId, asHr, comparisonKey } = await seedWithComparator()
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      comparisonKey,
      reasons: [],
      note: "   ",
      done: false,
    })
    await expect(
      asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
        orgId,
        runId,
        scope: "equivalentWork",
        groupKey: WOMEN_DOMINATED_GROUP_KEY,
        reasons: [],
        note: undefined,
        done: true,
      })
    ).rejects.toThrow(/errors.payMappingDocumentationRequired/)
  })
})

// One explanation often covers several comparators, and typing it once per
// row is what made a per-row rule look unworkable. This is that shortcut, and
// it is a mutation rather than a client loop so the whole fill lands as one
// atomic write.
describe("applyReasonsToRemainingComparisons", () => {
  it("fills the unexplained comparisons and leaves an answered one alone", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, womenDominatedRows)
    const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })
    const comparisons =
      gap?.womenDominated.find(
        (group) => group.key === WOMEN_DOMINATED_GROUP_KEY
      )?.comparisons ?? []
    expect(comparisons.length).toBeGreaterThan(0)
    const first = comparisons[0]?.key ?? ""

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: WOMEN_DOMINATED_GROUP_KEY,
      comparisonKey: first,
      reasons: ["experience"],
      note: undefined,
      done: false,
    })
    await asHr.mutation(
      api.payMapping.analyses.applyReasonsToRemainingComparisons,
      {
        orgId,
        runId,
        groupKey: WOMEN_DOMINATED_GROUP_KEY,
        reasons: ["alternativeLabourMarket"],
      }
    )

    const list = await asHr.query(api.payMapping.analyses.listGroupAnalyses, {
      orgId,
      runId,
    })
    // A judgement the user already made is never overwritten by a bulk fill.
    expect(list.find((row) => row.comparisonKey === first)?.reasons).toEqual([
      "experience",
    ])
    for (const comparison of comparisons.slice(1)) {
      expect(
        list.find((row) => row.comparisonKey === comparison.key)?.reasons
      ).toEqual(["alternativeLabourMarket"])
    }
  })

  it("rejects an empty reason set", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, womenDominatedRows)
    await expect(
      asHr.mutation(
        api.payMapping.analyses.applyReasonsToRemainingComparisons,
        { orgId, runId, groupKey: WOMEN_DOMINATED_GROUP_KEY, reasons: [] }
      )
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects a group that is not women-dominated in this run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, womenDominatedRows)
    await expect(
      asHr.mutation(
        api.payMapping.analyses.applyReasonsToRemainingComparisons,
        {
          orgId,
          runId,
          groupKey: "DoesNotExist|1",
          reasons: ["experience"],
        }
      )
    ).rejects.toThrow(/errors.notFound/)
  })
})
