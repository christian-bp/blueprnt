import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Doc } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

const VALID_ANCHORS = ["a0", "a1", "a2", "a3", "a4", "a5"]

async function seedScratchModel(t: ReturnType<typeof initConvexTest>) {
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
      employeeCount: 25,
      industry: "itTelecom",
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
    orgId,
    name: "Scratch",
  })
  return { orgId, asAdmin }
}

function addArgs(orgId: string, name: string) {
  return {
    orgId,
    name,
    description: "d",
    helpText: "h",
    anchors: VALID_ANCHORS,
  }
}

describe("criterion editor", () => {
  it("adds a criterion at the neutral 3 weight points and increments order", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Komplexitet",
        description: "Hur svåra problem rollen hanterar.",
        helpText: "Bedöm mot ankartexterna.",
        anchors: VALID_ANCHORS,
      }
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Scope")
    )
    await t.run(async (ctx) => {
      const a = (await ctx.db.get(first)) as Doc<"criteria"> | null
      const b = (await ctx.db.get(second)) as Doc<"criteria"> | null
      // Always 3: the budget grows by 3 at the same time, so the persisted
      // allocation stays exactly balanced (ADR-0004).
      expect(a?.weightPoints).toBe(3)
      expect(b?.weightPoints).toBe(3)
      expect(a?.order).toBe(1)
      expect(b?.order).toBe(2)
      expect(a?.isCustom).toBe(true)
      // Anchors live on the criterion document (ADR-0006), level-ordered.
      expect(a?.anchors).toHaveLength(6)
      expect(a?.anchors.map((anchor) => anchor.level)).toEqual([
        0, 1, 2, 3, 4, 5,
      ])
    })
  })

  it("rejects wrong anchor counts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
        orgId,
        name: "X",
        description: "d",
        helpText: "h",
        anchors: ["only", "five", "anchor", "texts", "here"],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("removes a neutral criterion (anchors ride along on the document)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Tillfällig")
    )
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(criterionId)).toBeNull()
    })
  })

  it("order stays unique after add/remove/add (no collision)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "First")
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Second")
    )
    // Remove the first criterion; survivor has order 2.
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: first,
    })
    // Add a third; must get order 3, not 2 (which length-based logic would return).
    const third = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Third")
    )
    await t.run(async (ctx) => {
      const b = (await ctx.db.get(second)) as Doc<"criteria"> | null
      const c = (await ctx.db.get(third)) as Doc<"criteria"> | null
      expect(b?.order).toBe(2)
      expect(c?.order).toBe(3)
      // The two surviving orders are distinct.
      expect(b?.order).not.toBe(c?.order)
    })
  })
})

describe("rebalanceWeights", () => {
  async function seedTwoCriteria(t: ReturnType<typeof initConvexTest>) {
    const { orgId, asAdmin } = await seedScratchModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "A")
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "B")
    )
    return { orgId, asAdmin, a, b }
  }

  it("applies a balanced allocation and audits from/to per change", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a, b } = await seedTwoCriteria(t)
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 4 },
        { criterionId: b, weightPoints: 2 },
      ],
    })
    await t.run(async (ctx) => {
      const docA = (await ctx.db.get(a)) as Doc<"criteria"> | null
      const docB = (await ctx.db.get(b)) as Doc<"criteria"> | null
      expect(docA?.weightPoints).toBe(4)
      expect(docB?.weightPoints).toBe(2)
      const auditRows = await ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("type"), "model.updated"))
        .collect()
      const rebalanceRow = auditRows.find(
        (row) =>
          (row.payload as Record<string, unknown>).change ===
          "weights.rebalanced"
      )
      expect(rebalanceRow).toBeDefined()
      const changes = (rebalanceRow?.payload as { changes: unknown[] }).changes
      expect(changes).toContainEqual({ criterionId: a, from: 3, to: 4 })
      expect(changes).toContainEqual({ criterionId: b, from: 3, to: 2 })
    })
  })

  it("no-ops (no audit row) when the allocation is unchanged", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a, b } = await seedTwoCriteria(t)
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 3 },
        { criterionId: b, weightPoints: 3 },
      ],
    })
    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("type"), "model.updated"))
        .collect()
      const rebalanceRows = auditRows.filter(
        (row) =>
          (row.payload as Record<string, unknown>).change ===
          "weights.rebalanced"
      )
      expect(rebalanceRows).toHaveLength(0)
    })
  })

  it("rejects a sum off the point budget with errors.weightsUnbalanced", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a, b } = await seedTwoCriteria(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: [
          { criterionId: a, weightPoints: 4 },
          { criterionId: b, weightPoints: 3 },
        ],
      })
    ).rejects.toThrow(/errors.weightsUnbalanced/)
  })

  it("rejects values outside the 1-5 scale with errors.invalidInput", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a, b } = await seedTwoCriteria(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: [
          { criterionId: a, weightPoints: 6 },
          { criterionId: b, weightPoints: 0 },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects an allocation that does not cover every criterion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a } = await seedTwoCriteria(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: [{ criterionId: a, weightPoints: 3 }],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects another org's criterion ids (coverage mismatch)", async () => {
    const t = initConvexTest()
    const { asAdmin: asAdminA, a, b } = await seedTwoCriteria(t)
    void asAdminA
    void a
    const { orgId: orgB, asAdmin: asAdminB } = await seedScratchModel(t)
    const foreign = await asAdminB.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgB, "Own")
    )
    void foreign
    // Org B's admin tries to rebalance using org A's criterion id: it is not
    // part of org B's model, so the bijection check rejects it.
    await expect(
      asAdminB.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId: orgB,
        allocations: [{ criterionId: b, weightPoints: 3 }],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects same-org editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, a, b } = await seedTwoCriteria(t)
    const { userId: editorId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor2@other.se", name: "Editor 2", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: editorId,
      role: "editor",
    })
    await expect(
      t
        .withIdentity({ subject: editorId })
        .mutation(api.evaluationModel.criteria.rebalanceWeights, {
          orgId,
          allocations: [
            { criterionId: a, weightPoints: 4 },
            { criterionId: b, weightPoints: 2 },
          ],
        })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects same-org editors with errors.adminRequired for addCriterion", async () => {
    const t = initConvexTest()
    const { orgId } = await seedScratchModel(t)
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
        .mutation(
          api.evaluationModel.criteria.addCriterion,
          addArgs(orgId, "X")
        )
    ).rejects.toThrow(/errors.adminRequired/)
  })
})

async function seedRatedTemplateOrganization(
  t: ReturnType<typeof initConvexTest>,
  // Rating per criterion INDEX in display order (scope, complexity, autonomy,
  // risk, knowledge, stakeholders, financial, people, formal); defaults to 5.
  ratingAt: (index: number) => number = () => 5
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr-loop@acme.se", name: "HR Person", role: "admin" }
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
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Anchor",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    purpose: "p",
    responsibilities: "r",
  })
  for (const [index, criterion] of model.criteria.entries()) {
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value: ratingAt(index),
    })
  }
  return { orgId, asAdmin, model, roleId }
}

describe("model edits shift bands live", () => {
  it("rebalanceWeights logs band.shift when a derived band moves", async () => {
    const t = initConvexTest()
    // scope rated 5, everything else 3. Template allocation (5,4,4,3,3,3,2,2,1):
    // raw 91 -> 20*91/27 = 67 -> Band 4. Swapping scope (5->1) with formal
    // (1->5): raw 83 -> 61 -> Band 5.
    const { orgId, asAdmin, model, roleId } =
      await seedRatedTemplateOrganization(t, (index) => (index === 0 ? 5 : 3))
    const scope = model.criteria[0]
    const formal = model.criteria[8]
    if (scope === undefined || formal === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: model.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        weightPoints:
          criterion.criterionId === scope.criterionId
            ? 1
            : criterion.criterionId === formal.criterionId
              ? 5
              : criterion.weightPoints,
      })),
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts.map((row) => row.payload)).toContainEqual({
        roleId,
        fromBand: 4,
        toBand: 5,
      })
    })
  })

  it("removeCriterion deletes its ratings and can keep a role complete", async () => {
    const t = initConvexTest()
    // scope 5, stakeholders 0, others 3: raw 82 over 27 points -> 60 (Band 5).
    // Removing stakeholders (3 points, allowed) drops nothing from the
    // numerator but shrinks the denominator: 82 over 24 -> 68 (Band 4).
    const { orgId, asAdmin, model, roleId } =
      await seedRatedTemplateOrganization(t, (index) =>
        index === 0 ? 5 : index === 5 ? 0 : 3
      )
    const stakeholders = model.criteria[5]
    if (stakeholders === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: stakeholders.criterionId,
    })
    await t.run(async (ctx) => {
      const orphans = await ctx.db
        .query("ratings")
        .withIndex("by_criterion", (q) =>
          q.eq("criterionId", stakeholders.criterionId)
        )
        .collect()
      expect(orphans).toHaveLength(0)
      // Still complete (8 of 8) with the better band.
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts.map((row) => row.payload)).toContainEqual({
        roleId,
        fromBand: 5,
        toBand: 4,
      })
    })
  })

  it("removing a non-neutral criterion redistributes the difference deterministically", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedTemplateOrganization(t)
    // scope carries 5 weight points: removal shrinks the budget by 3 but the
    // sum by 5, leaving the survivors 2 points under budget. The repair walk
    // lifts the lightest first (formal 1 -> 2), then the first remaining
    // minimum in display order (financial 2 -> 3).
    const scope = model.criteria[0]
    const financial = model.criteria[6]
    const formal = model.criteria[8]
    if (
      scope === undefined ||
      financial === undefined ||
      formal === undefined
    ) {
      throw new Error("seed")
    }
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: scope.criterionId,
    })
    await t.run(async (ctx) => {
      const remaining = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(remaining).toHaveLength(8)
      // Exactly on the shrunken budget (8 criteria x 3).
      const total = remaining.reduce((sum, row) => sum + row.weightPoints, 0)
      expect(total).toBe(24)
      const pointsById = new Map(
        remaining.map((row) => [row._id as string, row.weightPoints])
      )
      expect(pointsById.get(financial.criterionId as string)).toBe(3)
      expect(pointsById.get(formal.criterionId as string)).toBe(2)
      // The removal's audit row records every adjustment.
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const removal = updated.find(
        (row) =>
          (row.payload as Record<string, unknown>).change ===
          "criterion.removed"
      )
      expect(removal).toBeDefined()
      expect(
        (removal?.payload as { rebalanced: unknown[] }).rebalanced
      ).toEqual([
        { criterionId: financial.criterionId, from: 2, to: 3 },
        { criterionId: formal.criterionId, from: 1, to: 2 },
      ])
    })
  })

  it("blocks removal below the composition floor once onboarding is complete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedTemplateOrganization(t)
    // Template has 9 criteria: removal down to the floor is fine, the next
    // one is not. Onboarding must be COMPLETE for the floor to apply (the
    // scratch tests above remove freely at 1-2 criteria while onboarding).
    await t.run(async (ctx) => {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (settings === null) throw new Error("seed")
      await ctx.db.patch(settings._id, { onboardingCompletedAt: Date.now() })
    })
    // Remove four criteria (9 -> 5), all allowed.
    for (const index of [8, 7, 6, 5]) {
      const criterion = model.criteria[index]
      if (criterion === undefined) throw new Error("seed")
      await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
        orgId,
        criterionId: criterion.criterionId,
      })
    }
    // The fifth removal would leave 4 criteria: blocked.
    const next = model.criteria[4]
    if (next === undefined) throw new Error("seed")
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
        orgId,
        criterionId: next.criterionId,
      })
    ).rejects.toThrow(/errors.tooFewCriteria/)
  })

  it("addCriterion makes complete roles incomplete (band.shift to null)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRatedTemplateOrganization(t)
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "Collaboration",
      description: "d",
      helpText: "h",
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      expect(shifts.map((row) => row.payload)).toContainEqual({
        roleId,
        fromBand: 1,
        toBand: null,
      })
    })
  })
})
