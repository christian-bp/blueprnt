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
      fullTimeHoursDefault: 165,
      populationCount: 0,
      withPayCount: 0,
      actionCounter: 0,
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

  it("writes ONE archive-export audit row for the whole package", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(api.payMapping.report.logPayMappingArchiveExport, {
      orgId,
      runId,
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.archiveExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("rejects an archive export for a run id from another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr3@other.se", name: "Other HR", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.report.logPayMappingArchiveExport, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("writes the signing report's export-boundary audit row, subject-keyed to the run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(
      api.payMapping.report.logPayMappingSigningReportExport,
      { orgId, runId }
    )

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.signingReportExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    // Marker payload only: the run id, nothing else (no document content).
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("writes the detail appendix's own audit row at the same boundary", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(
      api.payMapping.report.logPayMappingDetailAppendixExport,
      { orgId, runId }
    )

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.detailAppendixExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("rejects a detail appendix export for a run id from another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr2@other.se", name: "Other HR", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(
        api.payMapping.report.logPayMappingDetailAppendixExport,
        { orgId: otherOrg, runId }
      )
    ).rejects.toThrow(/errors.notFound/)
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
      asOther.mutation(api.payMapping.report.logPayMappingSigningReportExport, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
