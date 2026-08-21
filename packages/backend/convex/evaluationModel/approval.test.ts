import { METHOD_CHECK_KEYS } from "@workspace/core"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { grantModelApproval, initConvexTest } from "../testing.helpers"
import { COMPARED_CRITERION_FIELDS } from "./evidence"

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

// Attaches a second, EDITOR-role member to an existing org: a second
// seedMembership mints a real user (its own throwaway org is never used), then
// seedDuplicateMember adds that user to the FIRST org. Mirrors addEditor in
// assessment/roles.test.ts.
async function addEditor(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Editor Person", role: "editor" }
  )
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId,
    role: "editor",
  })
  return t.withIdentity({ subject: userId })
}

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

  // The model section's LAYOUT reads this on all four chapters to draw the
  // spine, so an admin gate here throws in render and takes the section down
  // for an editor. Read access, and read access only.
  it("answers an editor member of the org", async () => {
    const t = initConvexTest()
    const { orgId } = await seedApprovableModel(t)
    const asEditor = await addEditor(t, orgId, "editor@acme.se")
    const result = await asEditor.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(result?.checks).toHaveLength(METHOD_CHECK_KEYS.length)
    expect(result?.workingConditions?.status).toBe("testedNotMaterial")
  })

  // Org scoping is untouched by the relax: a signed-in user who is not a
  // member of THIS org still gets nothing.
  it("refuses a signed-in non-member with notAMember", async () => {
    const t = initConvexTest()
    const { orgId } = await seedApprovableModel(t)
    const { userId: outsiderId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "outsider@other.se", name: "Outsider", role: "admin" }
    )
    const asOutsider = t.withIdentity({ subject: outsiderId })
    await expect(
      asOutsider.query(api.evaluationModel.approval.getMethodChecks, { orgId })
    ).rejects.toThrow(/errors\.notAMember/)
  })

  it("refuses an unauthenticated caller", async () => {
    const t = initConvexTest()
    const { orgId } = await seedApprovableModel(t)
    await expect(
      t.query(api.evaluationModel.approval.getMethodChecks, { orgId })
    ).rejects.toThrow(/errors\.notAuthenticated/)
  })
})

// The relax is a READ relax. Every write in this file stays admin-gated, and
// an editor who can now SEE the checklist must still not be able to act on it.
describe("the model writes stay admin-only", () => {
  it("refuses an editor's approveModel, working-conditions decision and rules edits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    const asEditor = await addEditor(t, orgId, "editor2@acme.se")

    await expect(
      asEditor.mutation(api.evaluationModel.approval.approveModel, { orgId })
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(
        api.evaluationModel.approval.setWorkingConditionsDecision,
        { orgId, status: "testedNotMaterial", motivation: "Nope." }
      )
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(api.evaluationModel.approval.updateLevelRules, {
        orgId,
        levelRules: [{ level: 1, minScore: 90 }],
      })
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(api.evaluationModel.approval.updateZoneProfileRules, {
        orgId,
        zoneProfileRules: [{ zone: "A", minStep: 4 }],
      })
    ).rejects.toThrow(/errors\.adminRequired/)

    // The criteria writes the chapters offer are gated by the same wrapper.
    await expect(
      asEditor.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "risk-consequence",
      })
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(api.evaluationModel.criteria.deactivateCriterion, {
        orgId,
        criterionId: model.criteria[0]?.criterionId as Id<"criteria">,
      })
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: model.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          weightPoints: 3,
        })),
      })
    ).rejects.toThrow(/errors\.adminRequired/)

    // The admin path is unaffected: the gate is the role, not the mutation.
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
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

// The last-approved buffer and the restore that reads it (ADR-0023 decision
// 11). The buffer is written by the SHARED evidence builder a pay-mapping run
// freezes with, and the restore's confirm preview and its audit diff come from
// the SHARED diff builder, so both pairs are asserted here as one contract.
describe("restoreApprovedModel", () => {
  // Approves, then makes a spread of method-affecting edits so the restore has
  // something of every kind to undo: a criterion added, one removed, weights
  // moved, and the materiality decision changed.
  async function approveThenEdit(t: ReturnType<typeof initConvexTest>) {
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    // Add a criterion that was not in the approved model.
    const addedId = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "risk-consequence" }
    )
    // Remove one that was.
    const removed = model.criteria[0]?.criterionId as Id<"criteria">
    await asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
      orgId,
      criterionId: removed,
    })
    // Change the materiality decision's motivation.
    await asAdmin.mutation(
      api.evaluationModel.approval.setWorkingConditionsDecision,
      {
        orgId,
        status: "testedNotMaterial",
        motivation: "Omprovad efter godkannandet.",
      }
    )
    return { orgId, asAdmin, model, addedId }
  }

  // The Godkännande chapter offers its restore control on this flag, so it has
  // to be exactly as strict as the restore itself: false where restoring would
  // write nothing, true for every class of divergence the restore undoes.
  describe("restoreWouldChange", () => {
    const flagOf = async (
      asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
      orgId: string
    ) => {
      const checks = await asAdmin.query(
        api.evaluationModel.approval.getMethodChecks,
        { orgId }
      )
      return checks?.restoreWouldChange
    }

    it("is false while the model has never been approved", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin } = await seedApprovableModel(t)
      expect(await flagOf(asAdmin, orgId)).toBe(false)
    })

    // Right after an approval the live state IS the buffer, so there is
    // nothing to go back to even though the buffer exists.
    it("is false on a freshly approved model", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin } = await seedApprovableModel(t)
      await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
        orgId,
      })
      expect(await flagOf(asAdmin, orgId)).toBe(false)
    })

    // The case that prompted the flag: an edit made and manually reverted.
    // Approval is reopened and the buffer is there, but restoring it would
    // write nothing, so the control must not offer itself.
    it("is false once an edit is reverted back to the approved state", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, model } = await seedApprovableModel(t)
      await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
        orgId,
      })
      const first = model.criteria[0]?.criterionId as Id<"criteria">
      const second = model.criteria[1]?.criterionId as Id<"criteria">
      const before = await t.run(async (ctx) => ({
        first: (await ctx.db.get(first))?.weightPoints,
        second: (await ctx.db.get(second))?.weightPoints,
      }))
      const allocations = model.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        weightPoints:
          criterion.criterionId === first
            ? (before.first ?? 3) + 1
            : criterion.criterionId === second
              ? (before.second ?? 3) - 1
              : criterion.weightPoints,
      }))
      await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations,
      })
      expect(await flagOf(asAdmin, orgId)).toBe(true)

      // Put it back by hand: same field, same values, no restore involved.
      await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: model.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          weightPoints: criterion.weightPoints,
        })),
      })
      expect(await flagOf(asAdmin, orgId)).toBe(false)
    })

    it("is true when the selection itself moved", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin } = await seedApprovableModel(t)
      await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
        orgId,
      })
      await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "risk-consequence",
      })
      expect(await flagOf(asAdmin, orgId)).toBe(true)
    })

    it("is true when the materiality decision moved", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin } = await seedApprovableModel(t)
      await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
        orgId,
      })
      await asAdmin.mutation(
        api.evaluationModel.approval.setWorkingConditionsDecision,
        {
          orgId,
          status: "testedNotMaterial",
          motivation: "Omprovad efter godkannandet.",
        }
      )
      expect(await flagOf(asAdmin, orgId)).toBe(true)
    })

    it("is true when a level rule moved", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, model } = await seedApprovableModel(t)
      await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
        orgId,
      })
      // Level 1's minScore must stay strictly above level 2's (92, the
      // default): 99 keeps the rules valid while still being a real edit, the
      // same edit updateLevelRules' own test makes.
      await asAdmin.mutation(api.evaluationModel.approval.updateLevelRules, {
        orgId,
        levelRules: model.levelRules.map((rule) =>
          rule.level === 1 ? { ...rule, minScore: 99 } : rule
        ),
      })
      expect(await flagOf(asAdmin, orgId)).toBe(true)
    })

    // Every per-criterion field the restore writes, driven off the exported
    // list itself: a field added to COMPARED_CRITERION_FIELDS without a value
    // here fails the coverage assertion below, and one the comparison ignores
    // fails its own case. The comparison and the restore cannot disagree about
    // WHICH fields matter, because they run the same function over this list.
    const DIVERGENCE: Record<
      (typeof COMPARED_CRITERION_FIELDS)[number],
      Record<string, unknown>
    > = {
      weightPoints: { weightPoints: 5 },
      weightMotivation: { weightMotivation: "Tillagd efter godkannandet." },
      purpose: { purpose: "Omskrivet syfte." },
      whyRelevant: { whyRelevant: "Omskriven relevans." },
      overlapNotes: { overlapNotes: "Noterad overlappning." },
      biasRisk: { biasRisk: "high" },
      biasComment: { biasComment: "Omskriven biaskommentar." },
      biasAction: { biasAction: "Atgard tillagd." },
      approved: {
        approved: undefined,
        decidedBy: undefined,
        decidedAt: undefined,
      },
    }

    it("covers every compared criterion field", () => {
      expect(Object.keys(DIVERGENCE).sort()).toEqual(
        [...COMPARED_CRITERION_FIELDS].sort()
      )
    })

    for (const field of COMPARED_CRITERION_FIELDS) {
      it(`is true when a criterion's ${field} moved`, async () => {
        const t = initConvexTest()
        const { orgId, asAdmin, model } = await seedApprovableModel(t)
        await asAdmin.mutation(api.evaluationModel.approval.approveModel, {
          orgId,
        })
        expect(await flagOf(asAdmin, orgId)).toBe(false)
        // Patched directly: the point is the COMPARISON, and going through
        // each field's own mutation would test the mutations instead (several
        // of them refuse an approved criterion by design).
        const criterionId = model.criteria[0]?.criterionId as Id<"criteria">
        await t.run(async (ctx) => {
          await ctx.db.patch(criterionId, DIVERGENCE[field])
        })
        expect(await flagOf(asAdmin, orgId)).toBe(true)
      })
    }
  })

  it("stores the full approved evidence as the buffer on approve", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      const buffer = model?.lastApprovedModel
      if (buffer === undefined) throw new Error("no buffer")
      expect(buffer.criteria).toHaveLength(6)
      expect(buffer.approval?.approvedAt).toBe(model?.approval?.approvedAt)
      // The restore half of the evidence, not only the weights: every
      // criterion's protokoll, bias review and per-criterion approval.
      const first = buffer.criteria[0]
      expect(first?.libraryKey).toBeDefined()
      expect(first?.dimensionKey).toBeDefined()
      expect(first?.weightPoints).toBe(3)
      expect(first?.purpose).toBe(
        "Motiverar varför kriteriet ingår i modellen."
      )
      expect(first?.biasRisk).toBe("low")
      expect(first?.approved).toBe(true)
      expect(first?.decidedBy).toBeDefined()
      // The model's own rules and materiality decision ride along.
      expect(buffer.levelRules).toHaveLength(12)
      expect(buffer.workingConditions?.status).toBe("testedNotMaterial")
    })
  })

  it("round-trips the model back to the approved state", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await approveThenEdit(t)
    await asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model == null) throw new Error("no model")
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      // The approved six are back, the criterion added afterwards is gone.
      expect(rows).toHaveLength(6)
      expect([...rows.map((row) => row.libraryKey)].sort()).toEqual(
        [...HEALTHY_KEYS].sort()
      )
      // Every restored row carries its documentation and its own approval.
      for (const row of rows) {
        expect(row.weightPoints).toBe(3)
        expect(row.approved).toBe(true)
        expect(row.purpose).toBe("Motiverar varför kriteriet ingår i modellen.")
        expect(row.biasRisk).toBe("low")
      }
      // The model-level decision is back too.
      expect(model.workingConditions?.motivation).toBe(
        "Testat men inte materiellt relevant i denna verksamhet."
      )
      // Approval stays REOPENED: the ordinary one-click approve closes the
      // loop, so there is exactly one approval path.
      expect(model.approval).toBeUndefined()
    })
    // ... and that one click now works, with a green checklist.
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
  })

  it("deletes the ratings of every criterion it removes", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, addedId } = await approveThenEdit(t)
    // A role rated on the criterion added after the approval.
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Utvecklare",
      function: "Teknik",
      team: "Kärna",
      trackKey: "IC",
      // setRating requires a complete job profile before rating starts.
      purpose: "Bygger produkten.",
      responsibilities: "Utvecklar och underhåller tjänsten.",
    })
    await grantModelApproval(t, orgId)
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: addedId,
      value: 3,
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      // grantModelApproval stamped an approval directly; clear it so the
      // restore's reopened-approval precondition holds.
      if (model != null) await ctx.db.patch(model._id, { approval: undefined })
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_criterion", (q) => q.eq("criterionId", addedId))
        .collect()
      expect(ratings).toHaveLength(1)
    })
    await asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_criterion", (q) => q.eq("criterionId", addedId))
        .collect()
      expect(ratings).toHaveLength(0)
      expect(await ctx.db.get(addedId)).toBeNull()
    })
  })

  it("audits model.restored with the diff the preview showed", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await approveThenEdit(t)
    const preview = await asAdmin.query(
      api.evaluationModel.approval.getModelRestorePreview,
      { orgId, locale: "en" }
    )
    if (preview === null) throw new Error("no preview")
    expect(preview.approvedAt).toBeGreaterThan(0)
    const kinds = new Map(
      preview.diff.criteria.map((criterion) => [
        criterion.libraryKey,
        criterion.kind,
      ])
    )
    // The criterion added after the approval is removed by the restore, the
    // one deactivated comes back, and the survivors whose weights the
    // deactivation redistributed read as changed.
    expect(kinds.get("risk-consequence")).toBe("removed")
    expect(kinds.get(HEALTHY_KEYS[0])).toBe("restored")
    // The materiality motivation is a model-level before/after row.
    expect(preview.diff.changes.motivation?.to).toBe(
      "Testat men inte materiellt relevant i denna verksamhet."
    )

    await asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.restored")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        modelId: string
        count: number
        changes: Record<string, { from: unknown; to: unknown }>
        items: {
          libraryKey: string
          label: string
          changes: Record<string, { from: unknown; to: unknown }>
        }[]
      }
      // ONE diff builder: the audited item set is exactly the previewed one.
      expect(payload.count).toBe(preview.diff.criteria.length)
      expect([...payload.items.map((item) => item.libraryKey)].sort()).toEqual(
        [...preview.diff.criteria.map((c) => c.libraryKey)].sort()
      )
      expect(payload.changes.motivation?.to).toBe(
        preview.diff.changes.motivation?.to
      )
      // Criteria are named, not keyed, in the trail.
      const removedItem = payload.items.find(
        (item) => item.libraryKey === "risk-consequence"
      )
      expect(removedItem?.label.length).toBeGreaterThan(0)
      expect(removedItem?.changes.selected).toEqual({ from: true, to: false })
      const returning = payload.items.find(
        (item) => item.libraryKey === HEALTHY_KEYS[0]
      )
      expect(returning?.changes.selected).toEqual({ from: false, to: true })
      expect(rows[0]?.category).toBe("model")
    })
  })

  it("refuses while the model is still approved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
        orgId,
      })
    ).rejects.toThrow(/errors\.invalidTransition/)
  })

  it("refuses when the model has never been approved (no buffer)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
        orgId,
      })
    ).rejects.toThrow(/errors\.notFound/)
  })

  it("refuses an editor, and offers them the preview read", async () => {
    const t = initConvexTest()
    const { orgId } = await approveThenEdit(t)
    const asEditor = await addEditor(t, orgId, "editor3@acme.se")
    await expect(
      asEditor.mutation(api.evaluationModel.approval.restoreApprovedModel, {
        orgId,
      })
    ).rejects.toThrow(/errors\.adminRequired/)
    // The read stays org-scoped, like getMethodChecks: an editor sees where
    // the model stands and is offered none of the writes.
    const preview = await asEditor.query(
      api.evaluationModel.approval.getModelRestorePreview,
      { orgId, locale: "en" }
    )
    expect(preview).not.toBeNull()
  })

  it("offers no preview while the approval still stands, or with no buffer", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    // No buffer yet.
    expect(
      await asAdmin.query(api.evaluationModel.approval.getModelRestorePreview, {
        orgId,
        locale: "en",
      })
    ).toBeNull()
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    // Buffer written, but the approval stands.
    expect(
      await asAdmin.query(api.evaluationModel.approval.getModelRestorePreview, {
        orgId,
        locale: "en",
      })
    ).toBeNull()
    const checks = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    // The chapter still learns a buffer exists, so the control can appear the
    // moment an edit reopens approval.
    expect(checks?.lastApprovedAt).toBeGreaterThan(0)
  })

  it("writes nothing when the live model already matches the buffer", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    // Reopen approval with an edit that changes nothing the buffer records:
    // a rebalance back to the same allocation is a no-op, so unapprove one
    // criterion and re-approve it instead.
    const criterionId = model.criteria[0]?.criterionId as Id<"criteria">
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: false,
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: true,
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      // A per-criterion reopen does not reopen the MODEL's approval (spec
      // 2.3), so clear it by hand to reach the restore's precondition.
      if (row != null) await ctx.db.patch(row._id, { approval: undefined })
    })
    await asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
      orgId,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.restored")
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })
})

// The contract the "audits the diff the preview showed" test structurally
// cannot express: that test compares two DESCRIPTIONS of the change (the
// preview's and the trail's), which agree by construction because one builder
// produces both. What it cannot see is whether the WRITES agree with either.
// A silent skip in the restore loop would leave both descriptions right and
// the database wrong, which is exactly the failure the shared predicate exists
// to make impossible.
describe("restoreApprovedModel writes what the diff promised", () => {
  it("leaves the model in the state the diff described, on budget", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "risk-consequence",
    })

    const preview = await asAdmin.query(
      api.evaluationModel.approval.getModelRestorePreview,
      { orgId, locale: "en" }
    )
    if (preview === null) throw new Error("no preview")
    await asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
      orgId,
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model == null) throw new Error("no model")
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      const byKey = new Map(rows.map((row) => [row.libraryKey as string, row]))

      // Every promise in the diff, checked against the rows themselves.
      for (const criterion of preview.diff.criteria) {
        const row = byKey.get(criterion.libraryKey)
        if (criterion.kind === "removed") {
          expect(row, `${criterion.libraryKey} still present`).toBeUndefined()
          continue
        }
        expect(row, `${criterion.libraryKey} missing`).toBeDefined()
        if (row === undefined) continue
        for (const [field, change] of Object.entries(criterion.changes)) {
          if (field === "selected" || field === "deletedRatingCount") continue
          const actual =
            field === "approved"
              ? row.approved === true
              : ((row as unknown as Record<string, unknown>)[field] ?? null)
          expect(actual, `${criterion.libraryKey}.${field}`).toEqual(change.to)
        }
      }

      // Nothing the diff did NOT name moved: the live key set is exactly the
      // buffer's, so a skipped entry (which the diff would also not name)
      // cannot hide here.
      const bufferKeys = (model.lastApprovedModel?.criteria ?? []).map(
        (criterion) => criterion.libraryKey
      )
      expect([...byKey.keys()].sort()).toEqual([...bufferKeys].sort())

      // The ADR-0004 invariant a silent skip would break: the allocation sums
      // to exactly criteria count x 3.
      const total = rows.reduce((sum, row) => sum + row.weightPoints, 0)
      expect(total).toBe(rows.length * 3)
    })
  })

  it("refuses a buffer whose library key no longer exists, changing nothing", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedApprovableModel(t)
    await asAdmin.mutation(api.evaluationModel.approval.approveModel, { orgId })
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "risk-consequence",
    })

    // Retire a key inside the stored buffer. The evidence shape holds
    // libraryKey as a loose optional string (frozen pay-mapping runs need that
    // tolerance), so this validates at the schema level exactly as a genuinely
    // retired key would.
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      const buffer = model?.lastApprovedModel
      if (model == null || buffer === undefined) throw new Error("no buffer")
      await ctx.db.patch(model._id, {
        lastApprovedModel: {
          ...buffer,
          criteria: buffer.criteria.map((criterion, index) =>
            index === 0
              ? { ...criterion, libraryKey: "retired-key" }
              : criterion
          ),
        },
      })
    })

    const before = await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model == null) throw new Error("no model")
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      return [...rows.map((row) => row.libraryKey)].sort()
    })

    // The preview refuses too: a change list promising a restore the mutation
    // would reject is worse than no change list.
    await expect(
      asAdmin.query(api.evaluationModel.approval.getModelRestorePreview, {
        orgId,
        locale: "en",
      })
    ).rejects.toThrow(/errors\.invalidInput/)
    await expect(
      asAdmin.mutation(api.evaluationModel.approval.restoreApprovedModel, {
        orgId,
      })
    ).rejects.toThrow(/errors\.invalidInput/)

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model == null) throw new Error("no model")
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      // Not a single row moved, and no audit row claims otherwise.
      expect([...rows.map((row) => row.libraryKey)].sort()).toEqual(before)
      const audited = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.restored")
        )
        .collect()
      expect(audited).toHaveLength(0)
    })
  })
})
