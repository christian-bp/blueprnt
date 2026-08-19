import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// A spread of 8 library keys across every dimension at (or under) its own
// DIMENSION_MAX_ACTIVE cap (competence 2, effort 2, responsibility 3,
// workingConditions 1), so activating all of them never trips a cap. Every
// one enters at the neutral 3 weight points (budget 24). Mirrors the fixture
// shared by ratings.test.ts and results.test.ts.
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
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: track.key,
    purpose: "p",
    responsibilities: "r",
  })
  return { orgId, userId, asAdmin, model, roleId }
}

// Rates every criterion at a uniform value (2 or 3 need no motivation; 1/4/5
// always get one so callers can freely choose any value).
async function rateAll(args: {
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  orgId: string
  roleId: string
  model: { criteria: { criterionId: string }[] }
  value: number
}) {
  const requiresMotivation =
    args.value === 1 || args.value === 4 || args.value === 5
  for (const criterion of args.model.criteria) {
    await args.asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId: args.orgId,
      roleId: args.roleId as never,
      criterionId: criterion.criterionId as never,
      value: args.value,
      ...(requiresMotivation ? { motivation: "Because." } : {}),
    })
  }
}

describe("lockAssessment", () => {
  it("locks a fully and validly rated role, auditing ratedCount", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId, userId } =
      await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })

    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment?.lockedBy).toBe(userId)
      expect(role?.assessment?.lockedAt).toBeGreaterThan(0)
      expect(role?.assessment?.calibratedAt).toBeUndefined()

      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.assessmentLocked")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.payload).toEqual({ roleId, ratedCount: 8 })
      expect(rows[0]?.subject).toEqual({ kind: "role", id: roleId })
      expect(rows[0]?.category).toBe("role")
    })
  })

  it("locks a mixed vector: the working-conditions criterion at 0 (omfattas inte) alongside siblings spread across 1-5", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    const wc = model.criteria.find(
      (c) => c.dimensionKey === "workingConditions"
    )
    const others = model.criteria.filter(
      (c) => c.dimensionKey !== "workingConditions"
    )
    if (wc === undefined || others.length !== 7) throw new Error("seed")

    // 0 needs no motivation on the working-conditions criterion (the only
    // criterion 0 is ever legal on).
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: wc.criterionId as never,
      value: 0,
    })
    // The seven siblings spread across the whole 1-5 scale, motivation given
    // at 1/4/5 (required) and omitted at 2/3 (not required).
    const values = [1, 2, 3, 4, 5, 2, 4]
    for (const [index, criterion] of others.entries()) {
      const value = values[index]
      if (value === undefined) throw new Error("seed")
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId as never,
        value,
        ...(value === 1 || value === 4 || value === 5
          ? { motivation: "Because." }
          : {}),
      })
    }

    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment?.lockedAt).toBeGreaterThan(0)
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", wc.criterionId as never)
        )
        .unique()
      expect(rating?.value).toBe(0)
      expect(rating?.motivation).toBeUndefined()
    })
  })

  it("refuses a coverage gap (a criterion with no rating) with ratingsIncomplete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    // Rate only 7 of 8.
    for (const criterion of model.criteria.slice(0, 7)) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId as never,
        value: 3,
      })
    }
    await expect(
      asAdmin.mutation(api.assessment.locking.lockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)
  })

  it("refuses a motivation gap (a stored 1/4/5 rating whose motivation was cleared) with motivationRequired", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    const first = model.criteria[0]
    if (first === undefined) throw new Error("seed")
    // Move one criterion to 4 with a motivation, matching the write-time
    // law...
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: first.criterionId as never,
      value: 4,
      motivation: "Broad reach.",
    })
    // ...then directly corrupt the stored row to simulate a rating that no
    // longer carries its required motivation (setRating itself can never
    // produce this state; lockAssessment's re-validation is the backstop for
    // exactly this kind of stale/corrupted row).
    await t.run(async (ctx) => {
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", first.criterionId as never)
        )
        .unique()
      if (rating === null) throw new Error("seed")
      await ctx.db.patch(rating._id, { motivation: undefined })
    })

    await expect(
      asAdmin.mutation(api.assessment.locking.lockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.motivationRequired/)
  })

  it("refuses to lock against an unapproved model with modelNotApproved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    // Reopen approval (direct write, mirroring how other suites force
    // approval state) so the model reads unapproved again.
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (modelDoc === null) throw new Error("seed")
      await ctx.db.patch(modelDoc._id, { approval: undefined })
    })

    await expect(
      asAdmin.mutation(api.assessment.locking.lockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.modelNotApproved/)
  })

  it("refuses to lock an already-locked assessment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    await expect(
      asAdmin.mutation(api.assessment.locking.lockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.assessmentLocked/)
  })

  it("refuses to lock an archived role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await t.run(async (ctx) => {
      await ctx.db.patch(roleId, { archivedAt: Date.now() })
    })
    await expect(
      asAdmin.mutation(api.assessment.locking.lockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("blocks setRating on a locked role with assessmentLocked", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    const first = model.criteria[0]
    if (first === undefined) throw new Error("seed")
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: first.criterionId as never,
        value: 2,
      })
    ).rejects.toThrow(/errors.assessmentLocked/)
  })
})

describe("unlockAssessment", () => {
  it("clears the whole assessment aggregate and audits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
      note: "Looks right.",
    })

    await asAdmin.mutation(api.assessment.locking.unlockAssessment, {
      orgId,
      roleId,
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.assessmentUnlocked")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.payload).toEqual({ roleId })
    })

    // Ratings become editable again.
    const first = model.criteria[0]
    if (first === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: first.criterionId as never,
      value: 2,
    })
  })

  it("refuses to unlock a role that is not locked", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedTemplateOrganization(t)
    await expect(
      asAdmin.mutation(api.assessment.locking.unlockAssessment, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.assessmentNotLocked/)
  })
})

describe("calibrateAssessment", () => {
  it("stamps calibratedBy/calibratedAt and the note, auditing noteProvided true", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId, userId } =
      await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
      note: "Matches the anchor roles.",
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment?.calibratedBy).toBe(userId)
      expect(role?.assessment?.calibratedAt).toBeGreaterThan(0)
      expect(role?.assessment?.calibrationNote).toBe(
        "Matches the anchor roles."
      )
      // Locking survives calibration untouched.
      expect(role?.assessment?.lockedBy).toBe(userId)

      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.assessmentCalibrated")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.payload).toEqual({ roleId, noteProvided: true })
      // The note text itself never enters the trail.
      expect(JSON.stringify(rows[0]?.payload)).not.toContain("anchor roles")
    })
  })

  it("calibrates without a note, auditing noteProvided false, and leaves a prior note untouched on a blank re-calibration", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment?.calibrationNote).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.assessmentCalibrated")
        )
        .collect()
      expect(rows[0]?.payload).toEqual({ roleId, noteProvided: false })
    })

    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
      note: "First note.",
    })
    // A later blank re-calibration (whitespace only) leaves the note as-is.
    await asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
      orgId,
      roleId,
      note: "   ",
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.assessment?.calibrationNote).toBe("First note.")
    })
  })

  it("refuses to calibrate a role that is not locked", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedTemplateOrganization(t)
    await expect(
      asAdmin.mutation(api.assessment.locking.calibrateAssessment, {
        orgId,
        roleId,
        note: "x",
      })
    ).rejects.toThrow(/errors.assessmentNotLocked/)
  })
})

describe("method drift derivation", () => {
  it("is false immediately after locking, true after a later re-approval, and clears again on re-lock", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId, "first-approver")
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    let result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.locked).toBe(true)
    expect(result?.methodDrift).toBe(false)

    // Simulate a later re-approval (a real method change would flip approval
    // back to draft and require re-confirming; the drift derivation only
    // cares about the approvedAt boundary, so bumping it directly keeps this
    // a focused unit test of the comparison itself, deterministic instead of
    // racing the system clock).
    const lockedAt = await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      return role?.assessment?.lockedAt ?? 0
    })
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (modelDoc === null) throw new Error("seed")
      await ctx.db.patch(modelDoc._id, {
        approval: {
          approvedBy: "second-approver",
          approvedAt: lockedAt + 1000,
        },
      })
    })

    result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.locked).toBe(true)
    expect(result?.methodDrift).toBe(true)

    // Re-locking under the current method clears the drift. A real re-lock
    // a moment later in wall-clock time is not reliably past the artificial
    // `lockedAt + 1000` used above (this test runs in well under a second),
    // so approvedAt is moved back to just-before "now" first: deterministic
    // and still exercises the real mutation's fresh Date.now() lockedAt
    // landing after it, exactly the re-approve-then-re-lock scenario this
    // case documents.
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (modelDoc === null) throw new Error("seed")
      await ctx.db.patch(modelDoc._id, {
        approval: { approvedBy: "second-approver", approvedAt: Date.now() - 1 },
      })
    })
    await asAdmin.mutation(api.assessment.locking.unlockAssessment, {
      orgId,
      roleId,
    })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.methodDrift).toBe(false)
  })

  it("is true once a real method edit reopens approval after locking (the edit never touches the already-locked role), and clears on re-approve + re-lock", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedTemplateOrganization(t)
    await grantModelApproval(t, orgId)
    await rateAll({ asAdmin, orgId, roleId, model, value: 3 })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })

    let result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.locked).toBe(true)
    expect(result?.methodDrift).toBe(false)

    // A real method-affecting mutation (not a direct db patch): reopens
    // approval via reopenApprovalIfSet, same as any of
    // activateCriterion/deactivateCriterion/rebalanceWeights/
    // updateLevelRules/updateZoneProfileRules would. It never unlocks or
    // otherwise touches the role, which is exactly the gap the drift
    // marking exists to surface: the role stays locked, but the model it
    // was locked under no longer has a current approval.
    await asAdmin.mutation(
      api.evaluationModel.approval.setWorkingConditionsDecision,
      { orgId, status: "active", motivation: "Ny motivering efter omprövning." }
    )
    result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.locked).toBe(true)
    expect(result?.methodDrift).toBe(true)

    // Re-approving and re-locking clears the drift again.
    await grantModelApproval(t, orgId, "second-approver")
    await asAdmin.mutation(api.assessment.locking.unlockAssessment, {
      orgId,
      roleId,
    })
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    result = await asAdmin.query(api.assessment.results.getRoleResult, {
      orgId,
      roleId: roleId as string,
    })
    expect(result?.methodDrift).toBe(false)
  })
})
