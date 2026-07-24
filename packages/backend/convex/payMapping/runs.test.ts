import { BASE_PRAXIS_AREA_KEYS, TRACK_LEVELS } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
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
// band/score), and two classified active people (confirmed open assignment
// to that role) one of whom has a pay record and one who does not. Satisfies
// the preconditions gate outright, so startPayMappingRun succeeds. Returns
// the caller's org id and an HR (admin) identity wrapper for the freeze
// mutation.
async function seedForFreeze(t: ReturnType<typeof initConvexTest>) {
  const email = "hr@acme.se"
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

  // Two classified people (open assignment to the evaluated role). The paid
  // person also carries birthDate/ftePercent so getPayMappingRunBySlug's
  // round-trip of those optional snapshot fields (needed by the scatter) is
  // exercised end to end.
  const { personId: withPay } = await asHr.mutation(
    api.people.people.createPerson,
    {
      orgId,
      displayName: "Anna Svensson",
      gender: "Kvinna",
      birthDate: "1990-01-01",
      ftePercent: 100,
    }
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

  return { orgId, asHr }
}

describe("startPayMappingRun", () => {
  it("freezes one row per classified active person", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.populationCount).toBe(2)
    expect(run?.withPayCount).toBe(1)

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

describe("startPayMappingRun preconditions gate", () => {
  it("throws payMappingPreconditionsUnmet when a person has no confirmed assignment", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    // An active person with no assignment at all: unclassified.
    await asHr.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Dana Berg",
      gender: "Man",
    })

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "Test",
      })
    ).rejects.toThrow(/errors.payMappingPreconditionsUnmet/)
  })

  it("throws payMappingPreconditionsUnmet when a staffed role is not fully evaluated", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const model = await asHr.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    if (model === null) throw new Error("seed: model")
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed: track")
    const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
    if (level === undefined) throw new Error("seed: level")

    // A second role with a confirmed assignment but no ratings: staffed,
    // incomplete, resolves no band.
    const { roleId: unevaluatedRoleId } = await asHr.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Designer",
        function: "Design",
        team: "Product",
        trackKey: track.key,
      }
    )
    const { personId } = await asHr.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Dana Berg",
      gender: "Man",
    })
    await asHr.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: unevaluatedRoleId,
      level,
      levelSource: "confirmed",
    })

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "Test",
      })
    ).rejects.toThrow(/errors.payMappingPreconditionsUnmet/)
  })

  it("throws payMappingPreconditionsUnmet when a confirmed assignment points to an archived role (C1)", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const model = await asHr.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    if (model === null) throw new Error("seed: model")
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed: track")
    const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
    if (level === undefined) throw new Error("seed: level")

    const { roleId: retiredRoleId } = await asHr.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Retired Role",
        function: "Ops",
        team: "Ops",
        trackKey: track.key,
      }
    )
    const { personId } = await asHr.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Dana Berg",
      gender: "Man",
    })
    await asHr.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId: retiredRoleId,
      level,
      levelSource: "confirmed",
    })
    // Simulate a PRE-EXISTING stale row: archive the role directly (bypassing
    // archiveRole, which now ends its own open assignments) so the person's
    // confirmed assignment stays open, pointing at an archived role -- the
    // exact shape the C1 review finding described (this used to pass the
    // gate and freeze a band-less row).
    await t.run(async (ctx) => {
      await ctx.db.patch(retiredRoleId, { archivedAt: Date.now() })
    })

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "Test",
      })
    ).rejects.toThrow(/errors.payMappingPreconditionsUnmet/)
  })

  it("does not block on an unstaffed role with no evaluation", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const model = await asHr.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    if (model === null) throw new Error("seed: model")
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed: track")

    // A role with no ratings AND no assignments: unstaffed, so it never
    // blocks, by construction.
    await asHr.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Designer",
      function: "Design",
      team: "Product",
      trackKey: track.key,
    })

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )
    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.populationCount).toBe(2)
  })
})

describe("getPayMappingPreconditions", () => {
  it("reports ready with no blockers when everyone is classified and every staffed role is evaluated", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(result).toEqual({
      peopleCount: expect.any(Number),
      unclassifiedCount: 0,
      unevaluatedRoles: [],
      ready: true,
    })
    expect(result.peopleCount).toBeGreaterThan(0)
  })

  it("reports the unclassified count and the unevaluated staffed roles, excluding unstaffed ones", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const model = await asHr.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    if (model === null) throw new Error("seed: model")
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed: track")
    const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
    if (level === undefined) throw new Error("seed: level")

    // An unclassified person (no assignment at all).
    await asHr.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Dana Berg",
      gender: "Man",
    })

    // A staffed, unevaluated role.
    const { roleId: unevaluatedRoleId, slug: unevaluatedRoleSlug } =
      await asHr.mutation(api.assessment.roles.createRole, {
        orgId,
        title: "Designer",
        function: "Design",
        team: "Product",
        trackKey: track.key,
      })
    const { personId: staffedPersonId } = await asHr.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Erik Falk", gender: "Man" }
    )
    await asHr.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: staffedPersonId,
      roleId: unevaluatedRoleId,
      level,
      levelSource: "confirmed",
    })

    // An unstaffed, unevaluated role: must not appear.
    await asHr.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Analyst",
      function: "Ops",
      team: "Ops",
      trackKey: track.key,
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(result.unclassifiedCount).toBe(1)
    expect(result.unevaluatedRoles).toEqual([
      {
        roleId: unevaluatedRoleId,
        title: "Designer",
        slug: unevaluatedRoleSlug,
      },
    ])
    expect(result.ready).toBe(false)
  })

  it("never reports ready for an org with no people, so the empty org must import first", async () => {
    const t = initConvexTest()
    const email = "hr@empty.se"
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email, name: OPERATOR_NAME, role: "admin" }
    )
    const asHr = t.withIdentity({ subject: userId })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(result).toEqual({
      peopleCount: 0,
      unclassifiedCount: 0,
      unevaluatedRoles: [],
      ready: false,
    })

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "Empty org run",
      })
    ).rejects.toThrow("errors.payMappingPreconditionsUnmet")
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
    // The freeze counts and the initiator name are asserted on the stored
    // run and the list query; the lean detail carries identity + rows only.
    expect(typeof result?.referenceDate).toBe("number")
    expect(result?.rows).toHaveLength(2)
    for (const row of result?.rows ?? []) {
      expect(row.roleTitle).toBe("Software Engineer")
    }
    const paid = (result?.rows ?? []).filter((r) => r.basicMonthly !== null)
    expect(paid).toHaveLength(1)
    expect(paid[0]?.basicMonthly).toBe(50000)
    // The scatter needs age/tenure/FTE at the frozen date, and the pay
    // breakdown: all round-trip from payMappingSnapshotRows.
    expect(paid[0]?.components).toEqual([])
    expect(paid[0]?.birthDate).toBe("1990-01-01")
    expect(paid[0]?.ftePercent).toBe(100)
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

// Directly seed a run + snapshot rows (mirrors gap.test.ts/analyses.test.ts's
// seedRun): exact control over gender/band/level/pay per row, so a group's
// flag (critical/ok/insufficient) and the ADR-0012 documentation requirement
// it drives are deterministic, without going through the full freeze flow.
interface SeedRow {
  gender: "Man" | "Kvinna"
  roleTitle: string
  level: string
  band: number | null
  basicMonthly: number | null
}

// Inserts one payMappingRuns row + its snapshot rows directly (bypassing
// startPayMappingRun): exact control over gender/band/level/pay per row and
// referenceDate. Shared by seedRun (single-run scenarios) and multi-run
// scenarios (the previousActions praxis-area applicability rule, which keys
// on an earlier COMPLETED run in the SAME org).
async function insertRun(
  t: ReturnType<typeof initConvexTest>,
  params: {
    orgId: string
    userId: string
    slug: string
    referenceDate: number
    rows: SeedRow[]
  }
): Promise<Id<"payMappingRuns">> {
  const { orgId, userId, slug, referenceDate, rows } = params
  return t.run(async (ctx) => {
    const id = await ctx.db.insert("payMappingRuns", {
      orgId,
      slug,
      label: slug,
      status: "active",
      referenceDate,
      initiatedBy: userId,
      initiatedAt: referenceDate,
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
        personPublicId: `${slug}-p${i}`,
        displayName: `Person ${i}`,
        erased: false,
        gender: r.gender,
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
    { email: "hr@acme.se", name: OPERATOR_NAME, role: "admin" }
  )
  const asHr = t.withIdentity({ subject: userId })
  const runId = await insertRun(t, {
    orgId,
    userId,
    slug: "test-run",
    referenceDate: 1_700_000_000_000,
    rows,
  })
  return { orgId, runId, asHr }
}

// Sets a valid samverkansredogörelse on the run: one half of the ADR-0012
// gate's extension. A fixed, arbitrary-but-valid value; tests that care
// about the exact stored text write it inline instead.
async function setCollaboration(
  asHr: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  runId: Id<"payMappingRuns">
) {
  await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
    orgId,
    runId,
    participants: "Fackligt ombud",
    description: "Beskrivning",
  })
}

// Marks the given praxis review areas (PRAXIS_AREA_KEYS slugs) done with a
// clean "none" finding: the minimum documentation the gate's extension
// requires beyond the equalWork/equivalentWork groups. "none" needs no note;
// "found" would additionally require one (see analyses.ts's
// upsertGroupAnalysis).
async function markPraxisAreasDone(
  asHr: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  runId: Id<"payMappingRuns">,
  keys: readonly string[]
) {
  for (const groupKey of keys) {
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey,
      reasons: [],
      note: undefined,
      done: true,
      finding: "none",
    })
  }
}

// Marks the REQUIRED_GROUP_KEY equalWork + equivalentWork documentation rows
// done (the requiredGroupRows seed's single required group under both
// scopes): the other half of a run seeded with requiredGroupRows that the
// gate needs satisfied before the praxis + collaboration extension can be
// exercised alone.
async function markRequiredGroupsDone(
  asHr: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  runId: Id<"payMappingRuns">
) {
  await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
    orgId,
    runId,
    scope: "equalWork",
    groupKey: REQUIRED_GROUP_KEY,
    reasons: ["experience"],
    note: undefined,
    done: true,
  })
  await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
    orgId,
    runId,
    scope: "equivalentWork",
    groupKey: REQUIRED_GROUP_KEY,
    reasons: ["experience"],
    note: undefined,
    done: true,
  })
}

// A women-dominated (100% women) equal-work group (Nurse) plus a comparator
// group (Tech) that out-earns it: mirrors analyses.test.ts's
// womenDominatedRows. This single seed produces a REQUIRED group under both
// scopes on the same key ("Nurse|3|Mid"): the equal-work bucket is
// single-gender (insufficient flag, which equalWorkGroupRequiresDocumentation
// treats as requiring doc), and the women-dominated cross-level comparison
// finds Tech out-earning it.
const REQUIRED_GROUP_KEY = "Nurse|3|Mid"
const requiredGroupRows: SeedRow[] = [
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
]

// An equal-work group with no gap ("ok" flag) and no women-dominance:
// neither scope requires documentation, so the run completes with no
// analyses at all.
const noRequiredGroupRows: SeedRow[] = [
  {
    gender: "Kvinna",
    roleTitle: "PM",
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
]

describe("completePayMappingRun", () => {
  it("rejects with payMappingGateUnmet when a required group is undocumented", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)

    await expect(
      asHr.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.payMappingGateUnmet/)
  })

  it("completes once every required equal-work + women-dominated group is marked done, and logs the done counts", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)

    await markRequiredGroupsDone(asHr, orgId, runId)
    // The gate's extension: collaboration + every base praxis area, also
    // required to complete, but neither appears in the audit counts
    // asserted below (audit payload stays group-count-only).
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.status).toBe("completed")

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runCompleted")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.runId).toBe(runId)
    expect(payload.equalWorkDone).toBe(1)
    expect(payload.equivalentWorkDone).toBe(1)
  })

  it("completes immediately when no group requires documentation", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.status).toBe("completed")
  })

  it("rejects with payMappingGateUnmet when praxis areas are documented but collaboration is missing", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)
    // collaboration intentionally left unset.

    await expect(
      asHr.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.payMappingGateUnmet/)
  })

  it("rejects with payMappingGateUnmet when collaboration is set but a base praxis area is missing", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await setCollaboration(asHr, orgId, runId)
    // Leave out one base area (payPolicy) to exercise the per-area check.
    const partial = BASE_PRAXIS_AREA_KEYS.filter((key) => key !== "payPolicy")
    await markPraxisAreasDone(asHr, orgId, runId, partial)

    await expect(
      asHr.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.payMappingGateUnmet/)
  })

  it("requires previousActions only once the org has an earlier completed run with an earlier reference date", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: OPERATOR_NAME, role: "admin" }
    )
    const asHr = t.withIdentity({ subject: userId })

    const firstReferenceDate = 1_700_000_000_000
    const firstRunId = await insertRun(t, {
      orgId,
      userId,
      slug: "first-run",
      referenceDate: firstReferenceDate,
      rows: noRequiredGroupRows,
    })
    await setCollaboration(asHr, orgId, firstRunId)
    await markPraxisAreasDone(asHr, orgId, firstRunId, BASE_PRAXIS_AREA_KEYS)
    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId: firstRunId,
    })

    const secondRunId = await insertRun(t, {
      orgId,
      userId,
      slug: "second-run",
      referenceDate: firstReferenceDate + 1000,
      rows: noRequiredGroupRows,
    })
    await setCollaboration(asHr, orgId, secondRunId)
    await markPraxisAreasDone(asHr, orgId, secondRunId, BASE_PRAXIS_AREA_KEYS)

    // The first run is already completed with an earlier reference date, so
    // the second run must also document previousActions before it can
    // complete: the base areas alone are no longer enough.
    await expect(
      asHr.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId,
        runId: secondRunId,
      })
    ).rejects.toThrow(/errors.payMappingGateUnmet/)

    await markPraxisAreasDone(asHr, orgId, secondRunId, ["previousActions"])
    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId: secondRunId,
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "second-run" }
    )
    expect(result?.status).toBe("completed")
  })

  it("rejects completing an already-completed run with invalidTransition", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    await expect(
      asHr.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.invalidTransition/)
  })

  it("isolates cross-org access: another org's member gets notFound from complete", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, noRequiredGroupRows)

    // A member of a different org cannot complete org A's run.
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.runs.completePayMappingRun, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("reopenPayMappingRun", () => {
  it("flips a completed run back to active and logs payMapping.runReopened", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })
    await asHr.mutation(api.payMapping.runs.reopenPayMappingRun, {
      orgId,
      runId,
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.status).toBe("active")

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runReopened")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.runId).toBe(runId)
  })

  it("rejects reopening an active run with invalidTransition", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await expect(
      asHr.mutation(api.payMapping.runs.reopenPayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.invalidTransition/)
  })

  it("isolates cross-org access: another org's member gets notFound from reopen", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    // A member of a different org cannot reopen org A's run.
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.runs.reopenPayMappingRun, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("setPayMappingCollaboration", () => {
  it("sets collaboration and reads it back trimmed via the slug query", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "  Fackligt ombud Anna Persson  ",
      description: "  Kvartalsvisa moten med de fackliga representanterna.  ",
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.collaboration).toEqual({
      participants: "Fackligt ombud Anna Persson",
      description: "Kvartalsvisa moten med de fackliga representanterna.",
    })
  })

  it("clears collaboration to null when both fields are whitespace-only after trim", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "Fackligt ombud",
      description: "Beskrivning",
    })
    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "   ",
      description: "\n\t",
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingRunBySlug,
      { orgId, slug: "test-run" }
    )
    expect(result?.collaboration).toBeNull()
  })

  it("rejects editing collaboration on a completed run with payMappingRunCompleted", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)

    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    await expect(
      asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
        orgId,
        runId,
        participants: "Fackligt ombud",
        description: "Beskrivning",
      })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
  })

  it("isolates cross-org access: another org's member gets notFound", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, noRequiredGroupRows)

    // A member of a different org cannot edit org A's run.
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.runs.setPayMappingCollaboration, {
        orgId: otherOrg,
        runId,
        participants: "Fackligt ombud",
        description: "Beskrivning",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("writes exactly one payMapping.collaborationUpdated audit row carrying only runId, never the participant name", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "Fackligt ombud Anna Persson",
      description: "Kvartalsvisa moten med de fackliga representanterna.",
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.collaborationUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(["runId"])
    expect(payload.runId).toBe(runId)
    expect(JSON.stringify(payload)).not.toContain("Anna Persson")
  })
})

describe("deletePayMappingRun", () => {
  it("hard-deletes the run and every child row (snapshot rows + group analyses), and logs payMapping.runDeleted", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)
    await markRequiredGroupsDone(asHr, orgId, runId)

    await asHr.mutation(api.payMapping.runs.deletePayMappingRun, {
      orgId,
      runId,
    })

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run).toBeNull()

    const snapshotRows = await t.run((ctx) =>
      ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
        .collect()
    )
    expect(snapshotRows).toHaveLength(0)

    const analysisRows = await t.run((ctx) =>
      ctx.db
        .query("payMappingGroupAnalyses")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
        .collect()
    )
    expect(analysisRows).toHaveLength(0)

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runDeleted")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    // The run's own display name (org content) plus its population count,
    // never a person's name/gender (the snapshot rows carried both).
    expect(payload.runId).toBe(runId)
    expect(payload.label).toBe("test-run")
    expect(payload.populationCount).toBe(requiredGroupRows.length)
    expect(JSON.stringify(payload)).not.toContain("Person 1")
    expect(JSON.stringify(payload)).not.toContain("Kvinna")
  })

  it("deletes a run in any status, pre-launch (a completed run is still deletable)", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await setCollaboration(asHr, orgId, runId)
    await markPraxisAreasDone(asHr, orgId, runId, BASE_PRAXIS_AREA_KEYS)
    await asHr.mutation(api.payMapping.runs.completePayMappingRun, {
      orgId,
      runId,
    })

    await asHr.mutation(api.payMapping.runs.deletePayMappingRun, {
      orgId,
      runId,
    })

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run).toBeNull()
  })

  it("isolates cross-org access: another org's member gets notFound from delete, and the run survives", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t, noRequiredGroupRows)

    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(api.payMapping.runs.deletePayMappingRun, {
        orgId: otherOrg,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run).not.toBeNull()
  })

  it("rejects deleting an unknown (already-deleted) run with notFound", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    // Delete the row directly (bypassing the mutation) to get a syntactically
    // valid but genuinely nonexistent run id.
    await t.run((ctx) => ctx.db.delete(runId))

    await expect(
      asHr.mutation(api.payMapping.runs.deletePayMappingRun, {
        orgId,
        runId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
