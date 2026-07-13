import { TRACK_LEVELS } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { onUserCreate } from "../accounts/mirrors"
import { initConvexTest } from "../testing.helpers"

// The seeded operator's display name, mirrored into the users table (see
// seedForFreeze) so resolveActorName can find it: listPayMappingRuns and
// getPayMappingRunBySlug resolve initiatedBy to this name at read time.
const OPERATOR_NAME = "HR Person"

// A fixed past timestamp for the seeded pay record, so its effectiveAt is
// always <= the freeze reference date (Date.now() inside the mutation).
const PAST = 1_700_000_000_000

// Seeds an org with: a template model (criteria + bandThresholds), one fully
// evaluated role (every criterion rated so the engine returns a non-null
// band/score), two classified active people (open assignment to that role) one
// of whom has a pay record and one who does not, and one active unclassified
// person (no assignment). Returns the caller's org id and an HR (admin)
// identity wrapper for the freeze mutation.
async function seedForFreeze(
  t: ReturnType<typeof initConvexTest>,
  email = "hr@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: OPERATOR_NAME, role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
    })
    // Mirror the operator into the users table so resolveActorName (used at
    // read time by listPayMappingRuns/getPayMappingRunBySlug) can resolve
    // initiatedBy to a display name.
    await onUserCreate(ctx, { _id: userId, email, name: OPERATOR_NAME })
  })
  const asHr = t.withIdentity({ subject: userId })

  // Model with criteria + band thresholds.
  await asHr.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asHr.query(api.evaluationModel.model.getModel, { orgId })
  if (model === null) throw new Error("seed: model")
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed: track")
  const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
  if (level === undefined) throw new Error("seed: level")

  // One role, fully evaluated (all criteria rated => complete => band/score).
  const { roleId } = await asHr.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: track.key,
  })
  await t.run(async (ctx) => {
    const roleDocId = ctx.db.normalizeId("roles", roleId as string)
    if (roleDocId === null) throw new Error("seed: role id")
    for (const criterion of model.criteria) {
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        criterion.criterionId
      )
      if (criterionDocId === null) throw new Error("seed: criterion id")
      await ctx.db.insert("ratings", {
        orgId,
        roleId: roleDocId,
        criterionId: criterionDocId,
        value: 5,
      })
    }
  })

  // Two classified people (open assignment to the evaluated role).
  const { personId: withPay } = await asHr.mutation(
    api.people.people.createPerson,
    { orgId, displayName: "Anna Svensson", gender: "Kvinna" }
  )
  const { personId: withoutPay } = await asHr.mutation(
    api.people.people.createPerson,
    { orgId, displayName: "Bo Karlsson", gender: "Man" }
  )
  await asHr.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId: withPay,
    roleId,
    level,
    levelSource: "confirmed",
  })
  await asHr.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId: withoutPay,
    roleId,
    level,
    levelSource: "confirmed",
  })

  // Only the first classified person has a pay record.
  await t.run(async (ctx) => {
    await ctx.db.insert("payRecords", {
      orgId,
      personId: withPay,
      payYear: 2026,
      source: "manual",
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: PAST,
      createdAt: PAST,
    })
  })

  // One active unclassified person (no assignment) => excluded from the run.
  await asHr.mutation(api.people.people.createPerson, {
    orgId,
    displayName: "Cecilia Nord",
    gender: "Kvinna",
  })

  return { orgId, asHr }
}

describe("startPayMappingRun", () => {
  it("freezes one row per classified active person and skips unclassified", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.populationCount).toBe(2)
    expect(run?.withPayCount).toBe(1)
    expect(run?.unclassifiedExcludedCount).toBe(1)

    const rows = await t.run((ctx) =>
      ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
        .collect()
    )
    expect(rows).toHaveLength(2)
    // Both classified rows carry the evaluated role and a non-null band/score.
    for (const row of rows) {
      expect(row.roleTitle).toBe("Software Engineer")
      expect(typeof row.band).toBe("number")
      expect(typeof row.score).toBe("number")
    }
    // Exactly one row carries the frozen pay (basicMonthly), the other null.
    const paid = rows.filter((r) => r.basicMonthly !== null)
    expect(paid).toHaveLength(1)
    expect(paid[0]?.basicMonthly).toBe(50000)
  })

  it("writes exactly one payMapping.runStarted audit row with no person data", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    await asHr.mutation(api.payMapping.runs.startPayMappingRun, {
      orgId,
      label: "Test",
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runStarted")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    // Flat stat counts only, never person identity.
    expect(payload.populationCount).toBe(2)
    expect(payload.withPayCount).toBe(1)
    expect(payload.unclassifiedExcludedCount).toBe(1)
    expect(payload).not.toHaveProperty("displayName")
    expect(JSON.stringify(payload)).not.toContain("Anna")
    expect(JSON.stringify(payload)).not.toContain("Kvinna")
  })

  it("rejects an empty label", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects a whitespace-only label", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "   ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })
})

describe("listPayMappingRuns", () => {
  it("returns runs newest first", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { runId: firstRunId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "First" }
    )
    // Force the second run's referenceDate strictly after the first so
    // sort order is unambiguous even if the mutations complete within the
    // same millisecond.
    await t.run(async (ctx) => {
      const run = await ctx.db.get(firstRunId)
      if (run === null) throw new Error("seed: first run")
      await ctx.db.patch(firstRunId, {
        referenceDate: run.referenceDate - 1000,
      })
    })
    const { runId: secondRunId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Second" }
    )

    const runs = await asHr.query(api.payMapping.runs.listPayMappingRuns, {
      orgId,
    })

    expect(runs).toHaveLength(2)
    expect(runs[0]?.runId).toBe(secondRunId)
    expect(runs[1]?.runId).toBe(firstRunId)
    expect(runs[0]?.label).toBe("Second")
    expect(runs[0]?.populationCount).toBe(2)
    expect(runs[0]?.withPayCount).toBe(1)
    // initiatedBy is resolved to the seeded operator's display name at read
    // time, never the raw Better Auth subject id.
    expect(runs[0]?.initiatedByName).toBe(OPERATOR_NAME)
    expect(runs[1]?.initiatedByName).toBe(OPERATOR_NAME)
  })
})

describe("getPayMappingRunBySlug", () => {
  it("resolves a run and its rows by slug", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { slug } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      {
        orgId,
        slug,
      }
    )

    expect(result).not.toBeNull()
    expect(result?.label).toBe("Test")
    expect(result?.populationCount).toBe(2)
    expect(result?.withPayCount).toBe(1)
    expect(result?.unclassifiedExcludedCount).toBe(1)
    expect(result?.initiatedByName).toBe(OPERATOR_NAME)
    expect(result?.rows).toHaveLength(2)
    for (const row of result?.rows ?? []) {
      expect(row.roleTitle).toBe("Software Engineer")
    }
    const paid = (result?.rows ?? []).filter((r) => r.basicMonthly !== null)
    expect(paid).toHaveLength(1)
    expect(paid[0]?.basicMonthly).toBe(50000)
  })

  it("returns null for an unknown slug", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      {
        orgId,
        slug: "does-not-exist",
      }
    )

    expect(result).toBeNull()
  })
})

describe("logPayMappingView", () => {
  it("appends one view row to payMappingAccessLog without writing to the audit trail", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )

    const auditsBefore = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )

    await asHr.mutation(api.payMapping.runs.logPayMappingView, {
      orgId,
      runId,
    })

    const logs = await t.run((ctx) =>
      ctx.db
        .query("payMappingAccessLog")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
        .collect()
    )
    expect(logs).toHaveLength(1)
    expect(logs[0]?.kind).toBe("view")
    expect(logs[0]?.runId).toBe(runId)

    // ADR-0011 §3: view-logging stays out of the domain audit trail, so the
    // auditLog row count for this org must be unchanged by the call above.
    const auditsAfter = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    expect(auditsAfter).toHaveLength(auditsBefore.length)
  })

  it("throws when the runId belongs to another org", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asHr: asHrA } = await seedForFreeze(t, "hr-a@acme.se")
    const { orgId: orgB, asHr: asHrB } = await seedForFreeze(t, "hr-b@beta.se")

    const { runId: runIdB } = await asHrB.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId: orgB, label: "Other org run" }
    )

    await expect(
      asHrA.mutation(api.payMapping.runs.logPayMappingView, {
        orgId: orgA,
        runId: runIdB,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
