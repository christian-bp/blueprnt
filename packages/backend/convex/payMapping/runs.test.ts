import { BASE_PRAXIS_AREA_KEYS, TRACK_SENIORITIES } from "@workspace/constants"
import {
  DEFAULT_LEVEL_RULES,
  DEFAULT_ZONE_PROFILE_RULES,
  NEUTRAL_WEIGHT_POINTS,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { onUserCreate } from "../accounts/mirrors"
import {
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
} from "../evaluationModel/criteriaLibrary"
import { initConvexTest } from "../testing.helpers"

// The seeded operator's display name, mirrored into the users table (see
// seedForFreeze) so resolveActorName can find it: listPayMappingRuns and
// getPayMappingRunBySlug resolve initiatedBy to this name at read time.
const OPERATOR_NAME = "HR Person"

// A fixed past timestamp for the seeded pay record, so its effectiveAt is
// always <= the freeze reference date (Date.now() inside the mutation).
const PAST = 1_700_000_000_000

// The library keys seedForFreeze activates: 2 competence, 2 effort
// (complexity-ambiguity a section-13.5 five-anchor entry), 3 responsibility
// (scope-impact and risk-consequence also section-13.5), 1 workingConditions
// -- within every DIMENSION_MAX_ACTIVE cap (@workspace/core). Named so the
// activation loop and the frozen-evidence assertions read the same list.
const SEEDED_LIBRARY_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

// The working-conditions motivation seedForFreeze decides with, asserted
// verbatim by the frozen-evidence test below.
const WORKING_CONDITIONS_MOTIVATION =
  "Rollen är regelbundet exponerad för säkerhetsrisker i det dagliga arbetet."

// Seeds an org with: a default model (criteria + level rules), one fully
// evaluated AND LOCKED role (every criterion rated so the engine returns a
// non-null level/score, then the assessment is locked so the preconditions
// gate's "evaluated AND locked" requirement, spec 2.4/6, is actually met),
// and two classified active people (confirmed open assignment to that role)
// one of whom has a pay record and one who does not. Satisfies the
// preconditions gate outright, so startPayMappingRun succeeds. Returns the
// caller's org id and an HR (admin) identity wrapper for the freeze
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

  // Model with criteria + level rules.
  await asHr.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of SEEDED_LIBRARY_KEYS) {
    await asHr.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asHr.query(api.evaluationModel.model.getModel, { orgId })
  if (model === null) throw new Error("seed: model")

  // Decide working conditions and approve the model directly (bypassing
  // setWorkingConditionsDecision/approveModel's checklist re-validation),
  // mirroring how locking is bypassed below: this fixture is about freeze
  // mechanics, not the approval lifecycle, which has its own dedicated suite
  // (evaluationModel/approval.test).
  await t.run(async (ctx) => {
    const modelDocId = ctx.db.normalizeId("models", model.modelId)
    if (modelDocId === null) throw new Error("seed: model id")
    await ctx.db.patch(modelDocId, {
      workingConditions: {
        status: "active",
        motivation: WORKING_CONDITIONS_MOTIVATION,
        decidedBy: userId,
        decidedAt: Date.now(),
      },
      approval: { approvedBy: userId, approvedAt: Date.now() },
    })
  })

  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed: track")
  const seniority =
    TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
  if (seniority === undefined) throw new Error("seed: seniority")

  // One role, fully evaluated (all criteria rated => complete => level/score).
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
    // Lock directly (bypassing lockAssessment's per-mutation re-validation
    // and motivation-required law, like the ratings above bypass setRating):
    // this fixture is about freeze/pay-mapping mechanics, not the locking
    // lifecycle, which has its own dedicated suite (assessment/locking.test).
    await ctx.db.patch(roleDocId, {
      assessment: { lockedBy: userId, lockedAt: Date.now() },
    })
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
    seniority,
    senioritySource: "confirmed",
  })
  await asHr.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId: withoutPay,
    roleId,
    seniority,
    senioritySource: "confirmed",
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

  return { orgId, asHr, userId }
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
    // Both classified rows carry the evaluated role and a non-null level/score.
    for (const row of rows) {
      expect(row.roleTitle).toBe("Software Engineer")
      expect(typeof row.level).toBe("number")
      expect(typeof row.score).toBe("number")
    }
    // Exactly one row carries the frozen pay (basicMonthly), the other null.
    const paid = rows.filter((r) => r.basicMonthly !== null)
    expect(paid).toHaveLength(1)
    expect(paid[0]?.basicMonthly).toBe(50000)
  })

  // The ADR-0023/spec-2.6 freeze: frozenModel is the product's only method
  // versioning, so it must be complete evidence, not a partial snapshot.
  it("freezes the full method evidence: criteria, level/zone rules, working conditions, and approval", async () => {
    const t = initConvexTest()
    const { orgId, asHr, userId } = await seedForFreeze(t)

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )
    const run = await t.run((ctx) => ctx.db.get(runId))
    const frozen = run?.frozenModel
    if (frozen === undefined) throw new Error("run: frozenModel")

    // Criteria: name localized in the org's own content locale (sv, per
    // seedForFreeze's organizations row) at freeze time, dimension derived
    // from the library, weight at the activation default, and the anchor
    // count read off the same library content the freeze itself reads.
    const svContent = criteriaLibraryContent("sv")
    expect(frozen.criteria).toHaveLength(SEEDED_LIBRARY_KEYS.length)
    const byKey = new Map(frozen.criteria.map((c) => [c.libraryKey, c]))
    for (const libraryKey of SEEDED_LIBRARY_KEYS) {
      const criterion = byKey.get(libraryKey)
      if (criterion === undefined) {
        throw new Error(`run: missing frozen criterion ${libraryKey}`)
      }
      const entry = svContent.criteria[libraryKey]
      const expectedAnchorCount =
        3 +
        (entry.anchor2 !== undefined ? 1 : 0) +
        (entry.anchor4 !== undefined ? 1 : 0)
      expect(criterion.name).toBe(entry.name)
      expect(criterion.dimensionKey).toBe(LIBRARY_DIMENSION[libraryKey])
      expect(criterion.weightPoints).toBe(NEUTRAL_WEIGHT_POINTS)
      expect(criterion.anchorCount).toBe(expectedAnchorCount)
    }
    // Explicit examples for the two anchor shapes the library carries: a
    // section-13.5 entry (5: steps 1-5) and an ordinary entry (3: steps 1/3/5).
    expect(byKey.get("complexity-ambiguity")?.anchorCount).toBe(5)
    expect(byKey.get("knowledge-depth")?.anchorCount).toBe(3)

    // levelRules/zoneProfileRules: copied verbatim off the model, which
    // never left the calibrate-before-launch defaults in this fixture.
    expect(frozen.levelRules).toHaveLength(12)
    expect(frozen.levelRules).toEqual(
      DEFAULT_LEVEL_RULES.map((r) => ({ level: r.level, minScore: r.minScore }))
    )
    expect(frozen.zoneProfileRules).toEqual(
      DEFAULT_ZONE_PROFILE_RULES.map((r) => ({
        zone: r.zone,
        minStep: r.minStep,
      }))
    )

    // workingConditions/approval: copied verbatim off the model
    // seedForFreeze decided and approved directly.
    expect(frozen.workingConditions).toEqual({
      status: "active",
      motivation: WORKING_CONDITIONS_MOTIVATION,
      decidedBy: userId,
      decidedAt: expect.any(Number),
    })
    expect(frozen.approval).toEqual({
      approvedBy: userId,
      approvedAt: expect.any(Number),
    })

    // The legacy field name is no longer populated going forward.
    expect(frozen).not.toHaveProperty("levelThresholds")
  })

  // The figure the front page's trend plots. Stored at freeze rather than
  // recomputed per visit: the trend draws one point per run, and reading it
  // from the snapshot rows would scan every row of every run on each
  // dashboard load (the same reason womenCount/menCount are denormalized).
  it("stores the org-level gap on the run, matching what the run's own Overview computes", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const { runId } = await asHr.mutation(
      api.payMapping.runs.startPayMappingRun,
      { orgId, label: "Test" }
    )

    const run = await t.run((ctx) => ctx.db.get(runId))
    // This fixture prices exactly one person, so one gender has no priced
    // row and the gap is not measurable: the stored figure says so rather
    // than reading as zero.
    expect(run?.orgGapPct).toBeNull()
    expect(run?.orgGapFlag).toBe("insufficient")

    // The stored figure and the one the run page derives from the same frozen
    // rows come from one helper, so they cannot disagree.
    const aggregate = await asHr.query(api.payMapping.gap.getPayMappingGap, {
      orgId,
      runId,
    })
    expect(run?.orgGapPct).toBe(aggregate?.org.gapPct ?? null)
    expect(run?.orgGapFlag).toBe(aggregate?.org.flag)
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
    const seniority =
      TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
    if (seniority === undefined) throw new Error("seed: seniority")

    // A second role with a confirmed assignment but no ratings: staffed,
    // incomplete, resolves no level.
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
      seniority,
      senioritySource: "confirmed",
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
    const seniority =
      TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
    if (seniority === undefined) throw new Error("seed: seniority")

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
      seniority,
      senioritySource: "confirmed",
    })
    // Simulate a PRE-EXISTING stale row: archive the role directly (bypassing
    // archiveRole, which now ends its own open assignments) so the person's
    // confirmed assignment stays open, pointing at an archived role -- the
    // exact shape the C1 review finding described (this used to pass the
    // gate and freeze a level-less row).
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
    const seniority =
      TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
    if (seniority === undefined) throw new Error("seed: seniority")

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
      seniority,
      senioritySource: "confirmed",
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

  it("blocks on a staffed role that is fully rated but not yet locked (evaluated AND locked)", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)

    const model = await asHr.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    if (model === null) throw new Error("seed: model")
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed: track")
    const seniority =
      TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
    if (seniority === undefined) throw new Error("seed: seniority")

    // A second role, staffed and FULLY RATED, but never locked: complete
    // draft results are not a revealed evaluation, so this must block the
    // gate exactly like an unrated role does (spec 2.4/6).
    const { roleId: draftRoleId, slug: draftRoleSlug } = await asHr.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Draft Evaluated Designer",
        function: "Design",
        team: "Product",
        trackKey: track.key,
      }
    )
    await t.run(async (ctx) => {
      const roleDocId = ctx.db.normalizeId("roles", draftRoleId as string)
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
    const { personId: draftPersonId } = await asHr.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Erik Falk", gender: "Man" }
    )
    await asHr.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: draftPersonId,
      roleId: draftRoleId,
      seniority,
      senioritySource: "confirmed",
    })

    const result = await asHr.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(result.unevaluatedRoles).toEqual([
      {
        roleId: draftRoleId,
        title: "Draft Evaluated Designer",
        slug: draftRoleSlug,
      },
    ])
    expect(result.ready).toBe(false)

    await expect(
      asHr.mutation(api.payMapping.runs.startPayMappingRun, {
        orgId,
        label: "Test",
      })
    ).rejects.toThrow(/errors.payMappingPreconditionsUnmet/)

    // Locking the draft role clears the block. Patched directly (like the
    // ratings above): this test is about the PRECONDITIONS predicate, not
    // the locking mutation's own gates (model approval, motivation-required
    // law), which have their own dedicated suite (assessment/locking.test).
    await t.run(async (ctx) => {
      const roleDocId = ctx.db.normalizeId("roles", draftRoleId as string)
      if (roleDocId === null) throw new Error("seed: role id")
      await ctx.db.patch(roleDocId, {
        assessment: { lockedBy: "test-locker", lockedAt: Date.now() },
      })
    })
    const afterLock = await asHr.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(afterLock.unevaluatedRoles).toEqual([])
    expect(afterLock.ready).toBe(true)
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
// seedRun): exact control over gender/level/seniority/pay per row, so a group's
// flag (critical/ok/insufficient) and the ADR-0012 documentation requirement
// it drives are deterministic, without going through the full freeze flow.
interface SeedRow {
  gender: "Man" | "Kvinna"
  roleTitle: string
  seniority: string
  level: number | null
  basicMonthly: number | null
}

// Inserts one payMappingRuns row + its snapshot rows directly (bypassing
// startPayMappingRun): exact control over gender/level/seniority/pay per row and
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
        personPublicId: `${slug}-p${i}`,
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

// Marks the requiredGroupRows seed's two required documentation rows done
// (the shown, flagged Analyst group under equalWork and the women-dominated
// Nurse group under equivalentWork): the other half of a run seeded with
// requiredGroupRows that the gate needs satisfied before the praxis +
// collaboration extension can be exercised alone.
async function markRequiredGroupsDone(
  asHr: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  runId: Id<"payMappingRuns">
) {
  await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
    orgId,
    runId,
    scope: "equalWork",
    groupKey: REQUIRED_EQUAL_WORK_KEY,
    reasons: ["experience"],
    note: undefined,
    done: true,
  })
  // Equivalent work is documented per COMPARISON (DL 3 kap. 9 § asks about
  // each difference), so the group cannot be closed until every comparator
  // that out-earns it carries a reason. Read the comparators from the gap
  // itself rather than hardcoding them: the seed's comparator set is the
  // engine's business, not this helper's.
  const gap = await asHr.query(api.payMapping.gap.getPayMappingGap, {
    orgId,
    runId,
  })
  const comparisons =
    gap?.womenDominated.find(
      (group) => group.key === REQUIRED_WOMEN_DOMINATED_KEY
    )?.comparisons ?? []
  for (const comparison of comparisons) {
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "equivalentWork",
      groupKey: REQUIRED_WOMEN_DOMINATED_KEY,
      comparisonKey: comparison.key,
      reasons: ["experience"],
      note: undefined,
      done: false,
    })
  }
  await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
    orgId,
    runId,
    scope: "equivalentWork",
    groupKey: REQUIRED_WOMEN_DOMINATED_KEY,
    reasons: ["experience"],
    note: undefined,
    done: true,
  })
}

// One REQUIRED group per scope (ADR-0015). equalWork: the Analyst group (1
// woman 45k + 1 man 50k) passes the entry conditions and carries an
// elevated flag, so the gate demands its documentation. equivalentWork: the
// women-dominated (100% women) Nurse group plus a comparator group (Tech)
// that out-earns it, mirroring analyses.test.ts's womenDominatedRows. The
// all-women Nurse bucket itself is gender-pure and therefore NOT an
// equalWork documentation target anymore; only its cross-level comparison
// keeps a documentation duty.
const REQUIRED_EQUAL_WORK_KEY = "Analyst|2"
const REQUIRED_WOMEN_DOMINATED_KEY = "Nurse|3"
const requiredGroupRows: SeedRow[] = [
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

// An equal-work group with no gap and no women-dominance: the entry
// conditions route it out of the primary flow (reverse), so neither scope
// requires documentation and the run completes with no analyses at all.
const noRequiredGroupRows: SeedRow[] = [
  {
    gender: "Kvinna",
    roleTitle: "PM",
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

describe("renamePayMappingRun", () => {
  it("renames the run, regenerates its slug, and logs the diff", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)
    const before = await t.run((ctx) => ctx.db.get(runId))

    await asHr.mutation(api.payMapping.runs.renamePayMappingRun, {
      orgId,
      runId,
      label: "Lönekartläggning 2027",
    })

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.label).toBe("Lönekartläggning 2027")
    // Route-exposed entity: the slug follows the name so links stay readable.
    expect(run?.slug).not.toBe(before?.slug)
    expect(run?.slug).toContain("2027")

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runRenamed")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.changes).toEqual({
      label: { from: before?.label, to: "Lönekartläggning 2027" },
    })
  })

  it("trims the label", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)
    await asHr.mutation(api.payMapping.runs.renamePayMappingRun, {
      orgId,
      runId,
      label: "  Trimmad  ",
    })
    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.label).toBe("Trimmad")
  })

  it("is a no-op for an unchanged label: no write, no audit row", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)
    const before = await t.run((ctx) => ctx.db.get(runId))

    await asHr.mutation(api.payMapping.runs.renamePayMappingRun, {
      orgId,
      runId,
      label: before?.label ?? "",
    })

    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.slug).toBe(before?.slug)
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.runRenamed")
        )
        .collect()
    )
    expect(audits).toHaveLength(0)
  })

  it("rejects an empty label", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, requiredGroupRows)
    await expect(
      asHr.mutation(api.payMapping.runs.renamePayMappingRun, {
        orgId,
        runId,
        label: "   ",
      })
    ).rejects.toThrow()
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
