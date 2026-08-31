import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// A minimal frozen run: the export log needs only the run row itself (the
// mutation validates existence + org, then writes the trail marker).
async function seedRun(t: ReturnType<typeof initConvexTest>): Promise<{
  orgId: string
  runId: Id<"payMappingRuns">
  asHr: ReturnType<typeof t.withIdentity>
}> {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  const asHr = t.withIdentity({ subject: userId })
  const runId = await t.run(async (ctx) =>
    ctx.db.insert("payMappingRuns", {
      orgId,
      slug: "test-run",
      label: "Test run",
      status: "active",
      referenceDate: 1_700_000_000_000,
      initiatedBy: userId,
      initiatedAt: 1_700_000_000_000,
      systemVersion: "test",
      populationCount: 0,
      withPayCount: 0,
      womenCount: 0,
      menCount: 0,
      orgGapPct: null,
      orgGapFlag: "insufficient",
      frozenModel: { criteria: [], levelThresholds: [] },
    })
  )
  return { orgId, runId, asHr }
}

describe("payMapping report export log", () => {
  it("writes the export-boundary audit row, subject-keyed to the run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(api.payMapping.report.logPayMappingReportExport, {
      orgId,
      runId,
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.reportExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    // Marker payload only: the run id, nothing else (no document content).
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("writes the metrics export's own audit row at the same boundary", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(api.payMapping.report.logPayMappingMetricsExport, {
      orgId,
      runId,
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.metricsExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("rejects a run id from another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@other.se", name: "Other HR", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.report.logPayMappingReportExport, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
