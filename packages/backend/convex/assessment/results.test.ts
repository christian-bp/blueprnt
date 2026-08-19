import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// A spread of 8 library keys across every dimension at (or under) its own
// DIMENSION_MAX_ACTIVE cap (competence 2, effort 2, responsibility 3,
// workingConditions 1), so activating all of them never trips a cap.
const EIGHT_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of EIGHT_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  // setRating's FIRST gate (ADR-0023) requires an approved model; this file
  // tests result derivation, not the approval checklist, so grant it directly.
  await grantModelApproval(t, orgId)
  return { orgId, asAdmin, model }
}

interface SeededModel {
  criteria: { criterionId: string }[]
}

async function createRatedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: SeededModel
  title: string
  value: number
  rateCount?: number
}) {
  const { roleId } = await args.asAdmin.mutation(
    api.assessment.roles.createRole,
    {
      orgId: args.orgId,
      title: args.title,
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "p",
      responsibilities: "r",
    }
  )
  const count = args.rateCount ?? args.model.criteria.length
  // 1, 4, and 5 require a motivation; a uniform value applies to every
  // criterion in the slice, so it either needs one everywhere or nowhere.
  const requiresMotivation =
    args.value === 1 || args.value === 4 || args.value === 5
  for (const criterion of args.model.criteria.slice(0, count)) {
    await args.asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId: args.orgId,
      roleId,
      criterionId: criterion.criterionId as never,
      value: args.value,
      ...(requiresMotivation ? { motivation: "Test motivation." } : {}),
    })
  }
  return roleId
}

// Locks a role's assessment via the real mutation: the reveal (spec 2.4/6).
// Every result/zone/profile assertion below only holds once a role is
// locked, so callers must lock a fully and validly rated role before reading
// its score/level/zone from the wire.
async function lockRole(
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  roleId: string
) {
  await asAdmin.mutation(api.assessment.locking.lockAssessment, {
    orgId,
    roleId: roleId as never,
  })
}

describe("getResults", () => {
  it("derives the standardmall anchors live and sorts level-first", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await lockRole(asAdmin, orgId, topId)
    // 1 is the floor for non-workingConditions criteria (7 of these 8), so
    // it is the lowest uniform rating achievable here, not 0.
    const lowId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Low",
      value: 1,
    })
    await lockRole(asAdmin, orgId, lowId)
    const partialId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Partial",
      value: 3,
      rateCount: 4,
    })

    const results = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(results.levels.map((level) => level.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    expect(results.rows.map((row) => row.roleId)).toEqual([
      topId,
      lowId,
      partialId,
    ])
    expect(results.rows[0]).toMatchObject({
      title: "Top",
      complete: true,
      locked: true,
      readyToLock: false,
      score: 100,
      level: 1,
    })
    // raw = 8 * 1 * 3 = 24; totalPoints 24; score = floor(20*24/24) = 20.
    expect(results.rows[1]).toMatchObject({ score: 20, level: 12 })
    expect(results.rows[2]).toMatchObject({
      complete: false,
      locked: false,
      readyToLock: false,
      score: null,
      level: null,
      ratedCount: 4,
      totalCriteria: 8,
      zone: null,
      profileLimited: null,
      profileFailures: null,
    })
  })

  it("derives a zone for a complete, locked role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await lockRole(asAdmin, orgId, topId)

    const results = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const top = results.rows.find((row) => row.roleId === topId)
    // Every seeded criterion enters at the neutral weight 3 (ADR-0004), so
    // none clears the weight-4 profile floor: the placement is exactly the
    // score-implied top zone, uncapped.
    expect(top).toMatchObject({
      locked: true,
      calibrated: false,
      methodDrift: false,
      score: 100,
      level: 1,
      zone: "A",
      profileLimited: false,
      profileFailures: [],
    })
  })

  it("hides score/level/zone/profile until locked, and flags readyToLock once complete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Not Yet Locked",
      value: 5,
    })

    const before = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const beforeRow = before.rows.find((row) => row.roleId === roleId)
    expect(beforeRow).toMatchObject({
      complete: true,
      ratedCount: 8,
      totalCriteria: 8,
      locked: false,
      calibrated: false,
      readyToLock: true,
      methodDrift: false,
      score: null,
      level: null,
      zone: null,
      profileLimited: null,
      profileFailures: null,
    })

    await lockRole(asAdmin, orgId, roleId)

    const after = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const afterRow = after.rows.find((row) => row.roleId === roleId)
    expect(afterRow).toMatchObject({
      locked: true,
      readyToLock: false,
      score: 100,
      level: 1,
      zone: "A",
    })
  })

  it("includes anchor info per row, and excludes non-anchor and replaced anchors", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    // Fully rated => complete => level 1 (value 5 on every criterion).
    // An anchor role must itself be a locked reference (lock-as-reveal), and
    // the WIRE assertions below (top?.level) also need the role locked to
    // read non-null, so one lockRole call below covers both.
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await lockRole(asAdmin, orgId, topId)
    await createRatedRole({ orgId, asAdmin, model, title: "Plain", value: 1 })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId: topId,
      expectedLevel: 2,
      motivation: "reference point",
    })

    const active = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const top = active.rows.find((row) => row.roleId === topId)
    // The computed level (1) and the agreed level (2) diverge by design.
    expect(top?.level).toBe(1)
    expect(top?.anchor).toEqual({ expectedLevel: 2, status: "active" })
    expect(active.rows.find((row) => row.title === "Plain")?.anchor).toBeNull()

    // underReview passes through; replaced reads as null (calibration history).
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId: topId,
      status: "underReview",
    })
    const review = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(review.rows.find((row) => row.roleId === topId)?.anchor).toEqual({
      expectedLevel: 2,
      status: "underReview",
    })

    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId: topId,
      status: "replaced",
    })
    const replaced = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    expect(replaced.rows.find((row) => row.roleId === topId)?.anchor).toBeNull()
  })
})

describe("getRoleResult", () => {
  it("returns the per-criterion breakdown when complete, gating score/level/zone on locked", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })

    // Complete but not yet locked: the breakdown's per-criterion rows are
    // still available (rating.ts already wrote them; blindness for the
    // AGGREGATE outcome is what the UI's own lock gate enforces), but the
    // aggregate outcome itself reads null.
    const beforeLock = await asAdmin.query(
      api.assessment.results.getRoleResult,
      { orgId, roleId: roleId as string, locale: "sv" }
    )
    expect(beforeLock).toMatchObject({
      complete: true,
      locked: false,
      readyToLock: true,
      score: null,
      level: null,
      zone: null,
      profileLimited: null,
      profileFailures: null,
    })
    expect(beforeLock?.criteria).toHaveLength(8)

    await lockRole(asAdmin, orgId, roleId)
    const result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
      locale: "sv",
    })
    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      complete: true,
      locked: true,
      readyToLock: false,
      calibrated: false,
      methodDrift: false,
      score: 100,
      level: 1,
      zone: "A",
      profileLimited: false,
      profileFailures: [],
    })
    expect(result?.criteria).toHaveLength(8)
    const firstRow = result?.criteria[0]
    expect(firstRow?.value).toBe(5)
    // The breakdown carries the criterion's weight points (every activated
    // criterion enters at the neutral 3; ADR-0004).
    expect(firstRow?.weightPoints).toBe(3)
    // The breakdown also carries the criterion's dimension, so the client
    // can validate its own rating range (EIGHT_KEYS[0] is knowledge-depth).
    expect(firstRow?.dimensionKey).toBe("competence")
  })

  it("reflects calibration once a locked assessment is calibrated", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await lockRole(asAdmin, orgId, roleId)
    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
      note: "Confirmed against anchors.",
    })
    const result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.locked).toBe(true)
    expect(result?.calibrated).toBe(true)
  })

  it("returns the incomplete shape while ratings are missing", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Partial",
      value: 3,
      rateCount: 2,
    })
    const result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result).toMatchObject({
      complete: false,
      ratedCount: 2,
      totalCriteria: 8,
      locked: false,
      readyToLock: false,
      score: null,
      level: null,
      zone: null,
      profileLimited: null,
      profileFailures: null,
    })
  })

  it("returns null for garbage ids", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    expect(
      await asAdmin.query(api.assessment.results.getRoleResult, {
        orgId,
        roleId: "garbage",
      })
    ).toBeNull()
  })
})
