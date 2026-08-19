import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// Six library keys, two per dimension (competence/effort/responsibility),
// deliberately chosen so activating all six trips NEITHER an overlap-pair
// warning (no two share a LIBRARY_OVERLAP_PAIRS entry) NOR the 40 %
// dimension-weight-balance warning (each dimension lands at 6/18 = 33 %,
// under the threshold): every criterion enters at the neutral weight 3, so
// six criteria balance the 18-point budget automatically with no rebalance.
// This is the simplest possible all-green-without-warnings fixture.
const HEALTHY_KEYS = [
  "knowledge-breadth",
  "formal-qualifications",
  "communication-effort",
  "operational-intensity",
  "autonomy-mandate",
  "business-customer",
] as const

async function seedHealthyCriteria(t: ReturnType<typeof initConvexTest>) {
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
  for (const libraryKey of HEALTHY_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  await asAdmin.mutation(
    api.evaluationModel.approval.setWorkingConditionsDecision,
    {
      orgId,
      status: "testedNotMaterial",
      motivation: "Testat men inte materiellt relevant i denna verksamhet.",
    }
  )
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("seed")
  return { orgId, userId, asAdmin, model }
}

// Documents and approves every criterion via the real interactive mutations
// (evaluationModel/method.ts), so the fixture exercises the same invariants
// production data does rather than poking approved rows in directly.
async function documentAndApproveAllCriteria(
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  orgId: string,
  model: { criteria: { criterionId: Id<"criteria"> }[] }
) {
  for (const criterion of model.criteria) {
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId: criterion.criterionId,
      purpose: "Motiverar varför kriteriet ingår i modellen.",
      whyRelevant: "Relevant för samtliga roller i denna dimension.",
      overlapNotes: "",
      biasRisk: "low",
      biasComment: "Bedömd könsneutral: mäter kravet, inte innehavaren.",
      biasAction: "",
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId: criterion.criterionId,
      approved: true,
    })
  }
}

async function seedApprovableModel(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId, asAdmin, model } = await seedHealthyCriteria(t)
  await documentAndApproveAllCriteria(asAdmin, orgId, model)
  return { orgId, userId, asAdmin, model }
}

describe("approveModel", () => {
  it("approves an all-green model and audits model.approved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval?.approvedBy).toBeDefined()
      expect(model?.approval?.approvedAt).toBeGreaterThan(0)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approved")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        criteriaCount: number
        checksPassed: number
        competenceShare: number
        effortShare: number
        responsibilityShare: number
        workingConditionsShare: number
      }
      expect(payload.criteriaCount).toBe(6)
      expect(payload.checksPassed).toBe(12)
      // HEALTHY_KEYS: 2 criteria per dimension (competence/effort/
      // responsibility) at the neutral weight 3 each, 0 workingConditions;
      // 6/18 = 33.33% rounds to 33 for each of the three, 0 for the fourth.
      expect(payload.competenceShare).toBe(33)
      expect(payload.effortShare).toBe(33)
      expect(payload.responsibilityShare).toBe(33)
      expect(payload.workingConditionsShare).toBe(0)
    })
  })

  it("refuses with methodBlocked while a blocker check fails", async () => {
    const t = initConvexTest()
    // Criteria activated but never documented/approved: documentationComplete
    // (a blocker) fails.
    const { orgId, asAdmin } = await seedHealthyCriteria(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    ).rejects.toThrow(/errors\.methodBlocked/)
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approved")
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it("refuses to re-approve an already-approved model with invalidTransition", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    ).rejects.toThrow(/errors\.invalidTransition/)
  })

  it("re-approves cleanly after a method change reopened it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    // A method-affecting change (rebalance, still balanced) reopens approval.
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: model.criteria.map((c) => ({
        criterionId: c.criterionId,
        weightPoints: c.weightPoints,
      })),
    })
    // A genuine no-op rebalance does not reopen (nothing changed); flip one
    // pair instead so the change is real.
    const first = model.criteria[0]
    const second = model.criteria[1]
    if (first === undefined || second === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: model.criteria.map((c) => ({
        criterionId: c.criterionId,
        weightPoints:
          c.criterionId === first.criterionId
            ? 4
            : c.criterionId === second.criterionId
              ? 2
              : c.weightPoints,
      })),
    })
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(modelDoc?.approval).toBeUndefined()
    })
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(modelDoc?.approval).toBeDefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approved")
        )
        .collect()
      // Once from the original approval, once from the re-approval.
      expect(rows).toHaveLength(2)
    })
  })

  it("rejects same-org editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId } = await seedApprovableModel(t)
    const { userId: editorId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@other.se", name: "Editor Person", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: editorId,
      role: "editor",
    })
    await expect(
      t
        .withIdentity({ subject: editorId })
        .mutation(api.evaluationModel.approval.approveModel, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})

describe("getMethodChecks", () => {
  it("returns the twelve checks, approval, and working-conditions state", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    const before = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(before?.checks).toHaveLength(12)
    expect(before?.checks.every((c) => c.ok)).toBe(true)
    expect(before?.approval).toBeNull()
    expect(before?.workingConditions?.status).toBe("testedNotMaterial")

    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(after?.approval?.approvedBy).toBeDefined()
  })

  it("returns null when the org has no model yet", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr2@acme.se", name: "HR Person", role: "admin" }
    )
    const asAdmin = t.withIdentity({ subject: userId })
    const result = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(result).toBeNull()
  })
})

describe("setWorkingConditionsDecision", () => {
  it("sets active, reopens an existing approval, and audits the coded status + a changes diff", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await asAdmin.mutation(
      api.evaluationModel.approval.setWorkingConditionsDecision,
      {
        orgId,
        status: "active",
        motivation: "Jour är ett återkommande krav i drifttjänsten.",
      }
    )
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval).toBeUndefined()
      expect(model?.workingConditions?.status).toBe("active")
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.workingConditionsDecided")
        )
        .collect()
      // One row from seedHealthyCriteria's initial testedNotMaterial
      // decision, one from this test's switch to active.
      expect(rows).toHaveLength(2)
      const payload = rows[1]?.payload as {
        status: string
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.status).toBe("active")
      expect(payload.changes.status).toEqual({
        from: "testedNotMaterial",
        to: "active",
      })
      expect(payload.changes.motivation?.to).toBe(
        "Jour är ett återkommande krav i drifttjänsten."
      )
      const reopenRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(reopenRows).toHaveLength(1)
      const reopenPayload = reopenRows[0]?.payload as
        | { causeEvent: string }
        | undefined
      expect(reopenPayload?.causeEvent).toBe("model.workingConditionsDecided")
    })
  })

  it("refuses testedNotMaterial while a workingConditions criterion is selected", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedHealthyCriteria(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "on-call",
    })
    await expect(
      asAdmin.mutation(
        api.evaluationModel.approval.setWorkingConditionsDecision,
        { orgId, status: "testedNotMaterial", motivation: "Motivering." }
      )
    ).rejects.toThrow(/errors\.invalidTransition/)
  })

  it("refuses an empty motivation with motivationRequired", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedHealthyCriteria(t)
    await expect(
      asAdmin.mutation(
        api.evaluationModel.approval.setWorkingConditionsDecision,
        { orgId, status: "active", motivation: "   " }
      )
    ).rejects.toThrow(/errors\.motivationRequired/)
  })

  it("no-ops (no audit row, no reopen) when status and motivation are unchanged", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    // seedHealthyCriteria already set this exact status/motivation.
    await asAdmin.mutation(
      api.evaluationModel.approval.setWorkingConditionsDecision,
      {
        orgId,
        status: "testedNotMaterial",
        motivation: "Testat men inte materiellt relevant i denna verksamhet.",
      }
    )
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      // Still approved: an identical resubmission is a true no-op.
      expect(model?.approval).toBeDefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.workingConditionsDecided")
        )
        .collect()
      // Only the one row from seedHealthyCriteria's initial decision: the
      // identical resubmission wrote nothing new.
      expect(rows).toHaveLength(1)
    })
  })
})

describe("updateLevelRules", () => {
  it("validates, applies, reopens approval, and audits a level-rules diff with a level.shift wrap", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    // Level 1's minScore must stay strictly above level 2's (92, the
    // default): 99 keeps the rules valid while still being a real edit.
    const nextRules = model.levelRules.map((rule) =>
      rule.level === 1 ? { ...rule, minScore: 99 } : rule
    )
    await asAdmin.mutation(api.evaluationModel.approval.updateLevelRules, {
      orgId,
      levelRules: nextRules,
    })
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(modelDoc?.approval).toBeUndefined()
      expect(modelDoc?.levelRules.find((r) => r.level === 1)?.minScore).toBe(99)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.levelRulesUpdated")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        changes: { levelRules: { from: string; to: string } }
      }
      expect(payload.changes.levelRules.from).toMatch(/^12 rules, top/)
      expect(payload.changes.levelRules.to).toBe("12 rules, top 99")
    })
  })

  it("refuses invalid level rules with invalidInput", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    const broken = model.levelRules.slice(0, 11) // only 11 entries, not 12
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.updateLevelRules, {
        orgId,
        levelRules: broken,
      })
    ).rejects.toThrow(/errors\.invalidInput/)
  })
})

describe("updateZoneProfileRules", () => {
  it("validates, applies, reopens approval, and audits a zone-profile diff", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await asAdmin.mutation(
      api.evaluationModel.approval.updateZoneProfileRules,
      {
        orgId,
        zoneProfileRules: [
          { zone: "A", minStep: 5 },
          { zone: "B", minStep: 3 },
        ],
      }
    )
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(modelDoc?.approval).toBeUndefined()
      expect(modelDoc?.zoneProfileRules).toEqual([
        { zone: "A", minStep: 5 },
        { zone: "B", minStep: 3 },
      ])
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.zoneProfileRulesUpdated")
        )
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  it("refuses non-monotonic zone-profile rules with invalidInput", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.updateZoneProfileRules, {
        orgId,
        // B gated MORE leniently required than A is backwards: B's minStep
        // (5) exceeds A's (3), violating the non-increasing walk A -> D.
        zoneProfileRules: [
          { zone: "A", minStep: 3 },
          { zone: "B", minStep: 5 },
        ],
      })
    ).rejects.toThrow(/errors\.invalidInput/)
  })
})

describe("setRating gate (ADR-0023)", () => {
  async function seedRoleForRating(t: ReturnType<typeof initConvexTest>) {
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "p",
      responsibilities: "r",
    })
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    return { orgId, asAdmin, roleId, criterionId: criterion.criterionId }
  }

  it("refuses with modelNotApproved when the model has no approval", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId, criterionId } = await seedRoleForRating(t)
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId,
        value: 3,
      })
    ).rejects.toThrow(/errors\.modelNotApproved/)
  })

  it("allows rating once the model is approved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId, criterionId } = await seedRoleForRating(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId,
      value: 3,
    })
    await t.run(async (ctx) => {
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q.eq("roleId", roleId).eq("criterionId", criterionId)
        )
        .unique()
      expect(rating?.value).toBe(3)
    })
  })

  it("refuses rating again once a method change reopens approval", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId, criterionId } = await seedRoleForRating(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
      orgId,
    })
    // HEALTHY_KEYS already fills competence and effort to their caps
    // (2 each); responsibility has room for a third (autonomy-mandate +
    // business-customer are already selected, cap is 3).
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "risk-consequence",
    })
    await expect(
      asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId,
        value: 2,
      })
    ).rejects.toThrow(/errors\.modelNotApproved/)
  })
})

// Sanity check on the shared test helper itself (testing.helpers.ts), since
// several other test files' fixtures now depend on it to satisfy the
// setRating gate.
describe("grantModelApproval test helper", () => {
  it("grants approval directly, bypassing the checklist", async () => {
    const t = initConvexTest()
    const { orgId } = await seedHealthyCriteria(t) // undocumented, would fail approveModel
    await grantModelApproval(t, orgId)
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval?.approvedBy).toBe("test-approver")
    })
  })
})
