import { describe, expect, it } from "vitest"
import { DEMO_SELECTED_KEYS } from "../assessment/devCompany"
import { api, components } from "../_generated/api"
import type { Doc } from "../_generated/dataModel"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

async function seedEmptyModel(t: ReturnType<typeof initConvexTest>) {
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  return { orgId, asAdmin }
}

describe("activateCriterion", () => {
  it("activates at the neutral 3 weight points and increments order", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
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
      expect(a?.libraryKey).toBe("complexity-ambiguity")
      expect(b?.libraryKey).toBe("scope-impact")
    })
  })

  it("pre-fills purpose/whyRelevant from the library's own texts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(criterionId)) as Doc<"criteria"> | null
      expect(row?.purpose?.length).toBeGreaterThan(0)
      expect(row?.whyRelevant?.length).toBeGreaterThan(0)
      expect(row?.approved).toBeUndefined()
    })
  })

  it("rejects re-selecting an already-active library key", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "complexity-ambiguity",
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "complexity-ambiguity",
      })
    ).rejects.toThrow(/errors.criterionAlreadySelected/)
  })

  it("rejects a third selection within a 2-cap dimension (competence)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "knowledge-depth",
    })
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "knowledge-breadth",
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "formal-qualifications",
      })
    ).rejects.toThrow(/errors.dimensionCapExceeded/)
  })

  it("rejects a 9th selection over the model-wide 8 cap", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    // 2 competence + 2 effort + 3 responsibility + 1 workingConditions = 8,
    // each dimension at (or under) its own cap.
    const keys = [
      "knowledge-depth",
      "knowledge-breadth",
      "complexity-ambiguity",
      "communication-effort",
      "scope-impact",
      "autonomy-mandate",
      "risk-consequence",
      "safety-exposure",
    ] as const
    for (const libraryKey of keys) {
      await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey,
      })
    }
    // 9th would-be selection: on-call is also workingConditions (already at
    // its 1-cap), so this trips dimensionCapExceeded before the model-wide
    // cap even applies; assert the model-wide cap directly instead by
    // checking the stored count stayed at MODEL_MAX_CRITERIA.
    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(8)
    })
    // business-customer is responsibility (already at its 3-cap): still a
    // dimension-cap rejection, so assert tooManyCriteria against a model
    // that is at the 8 cap via a dimension NOT yet capped is impossible
    // here (every dimension is simultaneously at 8/8 total and at its own
    // cap). This test therefore documents the invariant: the two limits
    // coincide exactly at MODEL_MAX_CRITERIA when every dimension is filled
    // to its own cap.
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "on-call",
      })
    ).rejects.toThrow(/errors\.(dimensionCapExceeded|tooManyCriteria)/)
  })

  it("clears an existing approval and audits model.approvalReopened", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("seed")
      await ctx.db.patch(model._id, {
        approval: { approvedBy: "someone", approvedAt: Date.now() },
      })
    })
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "complexity-ambiguity",
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as { causeEvent: string }
      expect(payload.causeEvent).toBe("criterion.activated")
    })
  })

  it("audits criterion.activated with libraryKey + dimensionKey + weightPoints", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "criterion.activated")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        criterionId: string
        libraryKey: string
        dimensionKey: string
        weightPoints: number
      }
      expect(payload.criterionId).toBe(criterionId)
      expect(payload.libraryKey).toBe("complexity-ambiguity")
      expect(payload.dimensionKey).toBe("effort")
      expect(payload.weightPoints).toBe(3)
    })
  })

  // Selecting a criterion is member-level work: admin covers org
  // administration and the audit log, not the model.
  it("accepts a same-org editor's selection", async () => {
    const t = initConvexTest()
    const { orgId } = await seedEmptyModel(t)
    const { userId: editorId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@other.se", name: "Editor Person", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: editorId,
      role: "editor",
    })
    const criterionId = await t
      .withIdentity({ subject: editorId })
      .mutation(api.evaluationModel.criteria.activateCriterion, {
        orgId,
        libraryKey: "complexity-ambiguity",
      })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(criterionId)).not.toBeNull()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "criterion.activated")
        )
        .collect()
      // The audit writer rides orgMutation too, so the row is there and it
      // names the editor who made the change.
      expect(rows).toHaveLength(1)
      expect(rows[0]?.actorId).toBe(editorId)
    })
  })
})

describe("rebalanceWeights", () => {
  async function seedTwoCriteria(t: ReturnType<typeof initConvexTest>) {
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
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
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const rebalanceRow = auditRows.find(
        (row) =>
          (row.payload as Record<string, unknown>).change ===
          "weights.rebalanced"
      )
      expect(rebalanceRow).toBeDefined()
      const payload = rebalanceRow?.payload as {
        budget: number
        count: number
        items: Array<{
          criterionId: string
          label: string
          changes: { weightPoints: { from: number; to: number } }
        }>
      }
      expect(payload.budget).toBe(6)
      expect(payload.count).toBe(2)
      expect(payload.items).toContainEqual({
        criterionId: a,
        label: expect.any(String),
        changes: { weightPoints: { from: 3, to: 4 } },
      })
      expect(payload.items).toContainEqual({
        criterionId: b,
        label: expect.any(String),
        changes: { weightPoints: { from: 3, to: 2 } },
      })
    })
  })

  it("reopens an existing approval and audits model.approvalReopened", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, a, b } = await seedTwoCriteria(t)
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("seed")
      await ctx.db.patch(model._id, {
        approval: { approvedBy: "someone", approvedAt: Date.now() },
      })
    })
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 4 },
        { criterionId: b, weightPoints: 2 },
      ],
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as { causeEvent: string } | undefined
      expect(payload?.causeEvent).toBe("model.updated")
    })
  })

  // An unchanged allocation is a no-op only once the act is ON RECORD. Before
  // that it is the confirm that records it, which is what lets a model
  // weighted before weightsSavedAt existed ever count its own weighting; both
  // halves are pinned by the marker tests below.

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
    const { b } = await seedTwoCriteria(t)
    const { orgId: orgB, asAdmin: asAdminB } = await seedEmptyModel(t)
    await asAdminB.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId: orgB,
      libraryKey: "complexity-ambiguity",
    })
    // Org B's admin tries to rebalance using org A's criterion id: it is not
    // part of org B's model, so the bijection check rejects it.
    await expect(
      asAdminB.mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId: orgB,
        allocations: [{ criterionId: b, weightPoints: 3 }],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("accepts a same-org editor's allocation", async () => {
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
    await t
      .withIdentity({ subject: editorId })
      .mutation(api.evaluationModel.criteria.rebalanceWeights, {
        orgId,
        allocations: [
          { criterionId: a, weightPoints: 4 },
          { criterionId: b, weightPoints: 2 },
        ],
      })
    await t.run(async (ctx) => {
      expect((await ctx.db.get(a))?.weightPoints).toBe(4)
      expect((await ctx.db.get(b))?.weightPoints).toBe(2)
    })
  })
})

// The real demo selection (2 competence + 2 effort + 3 responsibility + 1
// workingConditions = 8, each at or under its own DIMENSION_MAX_ACTIVE cap):
// derived, not a near-copy, so this fixture can never silently drift out of
// sync with the selection devCompany.test.ts guards against exceeding those
// same caps.
const EIGHT_KEYS = DEMO_SELECTED_KEYS

async function seedRatedOrganization(
  t: ReturnType<typeof initConvexTest>,
  // Rating per criterion INDEX in `keys` order; defaults to 5.
  ratingAt: (index: number) => number = () => 5,
  keys: readonly (typeof EIGHT_KEYS)[number][] = EIGHT_KEYS
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of keys) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Anchor",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    purpose: "p",
    responsibilities: "r",
  })
  // setRating's FIRST gate (ADR-0023) requires an approved model; this helper
  // tests level shifts from model edits, not the approval checklist itself,
  // so grant it directly before the rating loop below.
  await grantModelApproval(t, orgId)
  for (const [index, criterion] of model.criteria.entries()) {
    const value = ratingAt(index)
    // 1, 4, and 5 require a motivation.
    await asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId,
      roleId,
      criterionId: criterion.criterionId,
      value,
      ...(value === 1 || value === 4 || value === 5
        ? { motivation: "Test motivation." }
        : {}),
    })
  }
  return { orgId, asAdmin, model, roleId }
}

// The dominance warning's ONLY write path. Before this existed, the
// Godkännande checklist could say "no dimension dominates the weighting
// unexplained" was failing and there was no surface anywhere in the app that
// could answer it: weightMotivation was in the schema and read by the engine,
// and nothing wrote it.
describe("setCriterionWeightMotivation", () => {
  // Responsibility carries 7 of 9 points (78%), well past the engine's 40%
  // warning share, so dimensionWeightBalance fires on it.
  async function seedDominantResponsibility(
    t: ReturnType<typeof initConvexTest>
  ) {
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const scope = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const risk = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "risk-consequence" }
    )
    const complexity = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: scope, weightPoints: 4 },
        { criterionId: risk, weightPoints: 3 },
        { criterionId: complexity, weightPoints: 2 },
      ],
    })
    return { orgId, asAdmin, scope, risk, complexity }
  }

  const balanceCheck = (checks: { key: string; ok: boolean }[]) =>
    checks.find((check) => check.key === "dimensionWeightBalance")

  it("clears the engine's dominance warning end to end", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)

    const before = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(balanceCheck(before?.checks ?? [])).toMatchObject({
      ok: false,
      dimensions: ["responsibility"],
    })

    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      {
        orgId,
        criterionId: scope,
        motivation: "Accountability is what this organization pays for.",
      }
    )

    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(balanceCheck(after?.checks ?? [])?.ok).toBe(true)
    // The dimension is still dominant; what changed is that the reason is on
    // the record. The share the checklist quotes therefore does not move.
    const responsibility = after?.dimensionShares.find(
      (entry) => entry.key === "responsibility"
    )
    expect(responsibility?.share).toBeCloseTo(7 / 9)
  })

  // Any criterion in the dimension clears it, which is the engine's rule
  // (packages/core method-checks.ts), not the surface's convention.
  it("clears the warning from any criterion in the dominant dimension", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, risk } = await seedDominantResponsibility(t)
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: risk, motivation: "Consequence scale is wide." }
    )
    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(balanceCheck(after?.checks ?? [])?.ok).toBe(true)
  })

  // A motivation on a DIFFERENT dimension answers nothing.
  it("leaves the warning standing when another dimension is motivated", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, complexity } = await seedDominantResponsibility(t)
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: complexity, motivation: "Ambiguity is constant." }
    )
    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(balanceCheck(after?.checks ?? [])).toMatchObject({
      ok: false,
      dimensions: ["responsibility"],
    })
  })

  it("audits the change as a before/after diff", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: scope, motivation: "Accountability drives pay." }
    )
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const row = rows.find(
        (entry) =>
          (entry.payload as Record<string, unknown>).change ===
          "criterion.weightMotivationUpdated"
      )
      expect(row).toBeDefined()
      expect(row?.payload).toMatchObject({
        criterionId: scope,
        changes: {
          weightMotivation: { from: null, to: "Accountability drives pay." },
        },
      })
      // The category the log filters on comes from the event prefix, not the
      // variant.
      expect(row?.category).toBe("model")
    })
  })

  it("no-ops (no audit row) when the motivation is unchanged", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)
    const args = { orgId, criterionId: scope, motivation: "Same text." }
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      args
    )
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      args
    )
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const written = rows.filter(
        (entry) =>
          (entry.payload as Record<string, unknown>).change ===
          "criterion.weightMotivationUpdated"
      )
      expect(written).toHaveLength(1)
    })
  })

  // Documentation, not a method change: it moves no weight point, so it must
  // not un-approve a model for writing down why it was approved (ADR-0023, the
  // same rule the compliance texts follow).
  it("does not reopen an existing approval", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)
    await grantModelApproval(t, orgId)
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: scope, motivation: "Recorded after approval." }
    )
    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(after?.approval).not.toBeNull()
    await t.run(async (ctx) => {
      const reopened = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(reopened).toHaveLength(0)
    })
  })

  // Not gated on the criterion's own protokoll sign-off: that flag approves the
  // kriterieurvalsprotokoll, and locking the weight motivation behind it would
  // mean reopening a criterion to answer a warning about the weighting.
  it("stays writable on an approved criterion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(scope, {
        purpose: "p",
        whyRelevant: "w",
        biasRisk: "low",
        biasComment: "b",
        approved: true,
      })
    })
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: scope, motivation: "Still writable." }
    )
    await t.run(async (ctx) => {
      const doc = (await ctx.db.get(scope)) as Doc<"criteria"> | null
      expect(doc?.weightMotivation).toBe("Still writable.")
    })
  })

  it("clears the field on an empty motivation, which re-raises the warning", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, scope } = await seedDominantResponsibility(t)
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: scope, motivation: "Recorded." }
    )
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      { orgId, criterionId: scope, motivation: "   " }
    )
    await t.run(async (ctx) => {
      const doc = (await ctx.db.get(scope)) as Doc<"criteria"> | null
      expect(doc?.weightMotivation).toBeUndefined()
    })
    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(balanceCheck(after?.checks ?? [])?.ok).toBe(false)
  })

  it("rejects another org's criterion with errors.notFound", async () => {
    const t = initConvexTest()
    const { asAdmin } = await seedDominantResponsibility(t)
    const other = await seedDominantResponsibility(t)
    await expect(
      asAdmin.mutation(
        api.evaluationModel.criteria.setCriterionWeightMotivation,
        {
          orgId: other.orgId,
          criterionId: other.scope,
          motivation: "Elsewhere.",
        }
      )
    ).rejects.toThrow()
  })

  it("accepts a same-org editor's motivation", async () => {
    const t = initConvexTest()
    const { orgId, scope } = await seedDominantResponsibility(t)
    const { userId: editorId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor-wm@other.se", name: "Editor WM", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: editorId,
      role: "editor",
    })
    await t
      .withIdentity({ subject: editorId })
      .mutation(api.evaluationModel.criteria.setCriterionWeightMotivation, {
        orgId,
        criterionId: scope,
        motivation: "Ansvar ar den tyngsta dimensionen har.",
      })
    await t.run(async (ctx) => {
      expect((await ctx.db.get(scope))?.weightMotivation).toBe(
        "Ansvar ar den tyngsta dimensionen har."
      )
    })
  })
})

describe("model edits shift levels live", () => {
  it("rebalanceWeights logs level.shift when a derived level moves", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, roleId } = await seedRatedOrganization(
      t,
      (index) => (index === 0 ? 5 : 3)
    )
    const first = model.criteria[0]
    const last = model.criteria[7]
    if (first === undefined || last === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: model.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        weightPoints:
          criterion.criterionId === first.criterionId
            ? 1
            : criterion.criterionId === last.criterionId
              ? 5
              : criterion.weightPoints,
      })),
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      const rebalanceShift = shifts.find(
        (row) =>
          (row.payload as { cause?: { event?: string } }).cause?.event ===
          "model.updated"
      )
      expect(rebalanceShift).toBeDefined()
      expect(
        (rebalanceShift?.payload as { roleId?: string } | undefined)?.roleId
      ).toBe(roleId)
    })
  })

  it("deactivateCriterion deletes its ratings and shifts the level", async () => {
    const t = initConvexTest()
    // first rated 5, last rated 0 (workingConditions dimension), rest 3.
    const { orgId, asAdmin, model, roleId } = await seedRatedOrganization(
      t,
      (index) => (index === 0 ? 5 : index === 7 ? 0 : 3)
    )
    const target = model.criteria[7]
    if (target === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
      orgId,
      criterionId: target.criterionId,
    })
    await t.run(async (ctx) => {
      const orphans = await ctx.db
        .query("ratings")
        .withIndex("by_criterion", (q) =>
          q.eq("criterionId", target.criterionId)
        )
        .collect()
      expect(orphans).toHaveLength(0)
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      const deactivateShift = shifts.find(
        (row) =>
          (row.payload as { cause?: { event?: string } }).cause?.event ===
          "criterion.deactivated"
      )
      expect(deactivateShift).toBeDefined()
      expect(
        (deactivateShift?.payload as { roleId?: string } | undefined)?.roleId
      ).toBe(roleId)
    })
  })

  it("deactivateCriterion reopens an existing approval and audits model.approvalReopened", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedOrganization(t)
    const target = model.criteria[7]
    if (target === undefined) throw new Error("seed")
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (modelDoc === null) throw new Error("seed")
      await ctx.db.patch(modelDoc._id, {
        approval: { approvedBy: "someone", approvedAt: Date.now() },
      })
    })
    await asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
      orgId,
      criterionId: target.criterionId,
    })
    await t.run(async (ctx) => {
      const modelDoc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(modelDoc?.approval).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as { causeEvent: string } | undefined
      expect(payload?.causeEvent).toBe("criterion.deactivated")
    })
  })

  it("deactivating a non-neutral criterion redistributes the difference deterministically", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedOrganization(t)
    // Bump the first criterion to 5 via rebalance first, so its removal
    // leaves the survivors 2 points under the shrunken budget.
    const first = model.criteria[0]
    const rest = model.criteria.slice(1)
    if (first === undefined) throw new Error("seed")
    const bumped = rest[0]
    if (bumped === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: first.criterionId, weightPoints: 5 },
        { criterionId: bumped.criterionId, weightPoints: 1 },
        ...rest.slice(1).map((c) => ({
          criterionId: c.criterionId,
          weightPoints: c.weightPoints,
        })),
      ],
    })
    await asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
      orgId,
      criterionId: first.criterionId,
    })
    await t.run(async (ctx) => {
      const remaining = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(remaining).toHaveLength(7)
      // Exactly on the shrunken budget (7 criteria x 3).
      const total = remaining.reduce((sum, row) => sum + row.weightPoints, 0)
      expect(total).toBe(21)

      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "criterion.deactivated")
        )
        .collect()
      const deactivation = updated[updated.length - 1]
      const payload = deactivation?.payload as {
        count: number
        changes: { budget: { from: number; to: number } }
        items: Array<{
          criterionId: string
          label: string
          changes: { weightPoints: { from: number; to: number } }
        }>
      }
      // In `changes`, so the cell and the sheet render it as an arrow: a
      // top-level object reached neither renderer.
      expect(payload.changes.budget).toEqual({ from: 24, to: 21 })
      // The removed criterion stood at 5: survivors are 2 under budget, so
      // the deterministic repair walk lifts the lightest by 2 total.
      expect(payload.count).toBeGreaterThan(0)
      const repairedTotal = payload.items.reduce(
        (sum, item) =>
          sum + (item.changes.weightPoints.to - item.changes.weightPoints.from),
        0
      )
      expect(repairedTotal).toBe(2)
    })
  })

  it("no floor: a model under construction can deactivate down to zero", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
        orgId,
        criterionId,
      })
    ).resolves.toBeNull()
    await t.run(async (ctx) => {
      const remaining = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(remaining).toHaveLength(0)
    })
  })

  it("activateCriterion makes complete roles incomplete (level.shift to null)", async () => {
    const t = initConvexTest()
    // Seed with 7 of the 8 keys (drop risk-consequence, leaving
    // responsibility at 2/3) so the 8th activation below has room.
    const seven = EIGHT_KEYS.filter((key) => key !== "risk-consequence")
    const { orgId, asAdmin, roleId } = await seedRatedOrganization(
      t,
      () => 5,
      seven
    )
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "risk-consequence",
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      expect(shifts.map((row) => row.payload)).toContainEqual(
        expect.objectContaining({
          roleId,
          changes: expect.objectContaining({ level: { from: 1, to: null } }),
        })
      )
    })
  })
})

// Collects every object key anywhere in a value tree. Used to assert that no
// rating-shaped key (value/motivation/notes) ever leaks into a criterion audit
// payload: ratings are count-only on the model trail.
function allKeys(value: unknown, out: string[] = []): string[] {
  if (value === null || typeof value !== "object") return out
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.push(key)
    allKeys(child, out)
  }
  return out
}

describe("criteria audit payloads (before/after)", () => {
  it("criterion.deactivated records delete stats and counts ratings only", async () => {
    const t = initConvexTest()
    // A rated org so the deactivated criterion has ratings; assert the count
    // is captured but no rating value leaks.
    const { orgId, asAdmin, model } = await seedRatedOrganization(t, (index) =>
      index === 0 ? 4 : 3
    )
    const first = model.criteria[0]
    if (first === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.deactivateCriterion, {
      orgId,
      criterionId: first.criterionId,
    })
    const payload = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "criterion.deactivated")
        )
        .collect()
      return rows[rows.length - 1]?.payload as Record<string, unknown>
    })
    expect(payload.modelId).toBeDefined()
    // One role was rated on the deactivated criterion: count present, no value.
    expect(payload.deletedRatingCount).toBe(1)
    // Budget shrinks from 8*3 to 7*3, as a rendered before/after diff.
    expect(payload.changes).toEqual({ budget: { from: 24, to: 21 } })
    // Ratings are count-only: no rating value/notes keys anywhere in the
    // payload. A bare number cannot be distinguished from a weight/order, so
    // assert structurally that no rating-shaped keys leaked.
    expect(allKeys(payload)).not.toContain("value")
    expect(allKeys(payload)).not.toContain("motivation")
    expect(allKeys(payload)).not.toContain("notes")
  })

  // The weighting has no other trace of having been decided: criteria enter
  // at 3 points and the budget is the criteria count times 3, so a fresh
  // selection is already balanced and every check of it passes before anyone
  // has weighed anything. The save writes the act itself.
  it("records the weighting save on the model, and not before", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    // Born balanced, and nobody has saved: the marker is absent.
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.weightsSavedAt).toBeUndefined()
    })

    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 2 },
        { criterionId: b, weightPoints: 4 },
      ],
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.weightsSavedAt).toBeGreaterThan(0)
    })
  })

  // A model weighted before weightsSavedAt existed: balanced, unchanged, and
  // with the act unrecorded. Confirming the allocation it already has IS a
  // state change, and it is the only way such a model can ever record the act.
  it("stamps the marker when an unchanged allocation is confirmed", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const stored = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      return rows.map((row) => ({
        id: row._id,
        weightPoints: row.weightPoints,
        creationTime: row._creationTime,
      }))
    })

    // The stored allocation, posted back unchanged.
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 3 },
        { criterionId: b, weightPoints: 3 },
      ],
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.weightsSavedAt).toBeGreaterThan(0)
      // No criterion row was touched: the weights are the same objects with
      // the same points.
      const rows = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(
        rows.map((row) => ({
          id: row._id,
          weightPoints: row.weightPoints,
          creationTime: row._creationTime,
        }))
      ).toEqual(stored)
      // The act is on the trail, as this mutation's own row.
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const confirms = audit.filter(
        (row) =>
          (row.payload as { change?: string }).change === "weights.rebalanced"
      )
      expect(confirms).toHaveLength(1)
      expect(confirms[0]?.payload).toMatchObject({ count: 0, items: [] })
    })
  })

  // Once the act is on record, an unchanged allocation is a true no-op: no
  // second marker write, and no audit noise.
  it("does nothing at all when an unchanged allocation is confirmed twice", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const allocations = [
      { criterionId: a, weightPoints: 3 },
      { criterionId: b, weightPoints: 3 },
    ]
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations,
    })
    const first = await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return model?.weightsSavedAt
    })

    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations,
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.weightsSavedAt).toBe(first)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      expect(
        audit.filter(
          (row) =>
            (row.payload as { change?: string }).change === "weights.rebalanced"
        )
      ).toHaveLength(1)
    })
  })

  // The query the model section reads its progress from carries the marker as
  // a boolean, so the chapter can count the act without a second query.
  it("reports the save through getMethodChecks", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const before = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(before?.weightsSaved).toBe(false)

    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 2 },
        { criterionId: b, weightPoints: 4 },
      ],
    })

    const after = await asAdmin.query(
      api.evaluationModel.approval.getMethodChecks,
      { orgId }
    )
    expect(after?.weightsSaved).toBe(true)
  })

  it("weights.rebalanced records bulk items, budget, and count", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedEmptyModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 5 },
        { criterionId: b, weightPoints: 1 },
      ],
    })
    const payload = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const matching = rows.filter(
        (row) =>
          (row.payload as Record<string, unknown>).change ===
          "weights.rebalanced"
      )
      return matching[matching.length - 1]?.payload as Record<string, unknown>
    })
    expect(payload.budget).toBe(6)
    expect(payload.count).toBe(2)
    const items = payload.items as Array<{
      criterionId: string
      changes: { weightPoints: { from: number; to: number } }
    }>
    expect(items).toContainEqual({
      criterionId: a,
      label: expect.any(String),
      changes: { weightPoints: { from: 3, to: 5 } },
    })
    expect(items).toContainEqual({
      criterionId: b,
      label: expect.any(String),
      changes: { weightPoints: { from: 3, to: 1 } },
    })
  })

  it("threads cause.entityId = modelId for weights.rebalanced level shifts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedOrganization(t, (index) =>
      index === 0 ? 5 : 3
    )
    const first = model.criteria[0]
    const last = model.criteria[7]
    if (first === undefined || last === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: model.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        weightPoints:
          criterion.criterionId === first.criterionId
            ? 1
            : criterion.criterionId === last.criterionId
              ? 5
              : criterion.weightPoints,
      })),
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      const rebalanceShifts = shifts.filter(
        (shift) =>
          (shift.payload as { cause?: { event?: string } }).cause?.event ===
          "model.updated"
      )
      expect(rebalanceShifts.length).toBeGreaterThan(0)
      for (const shift of rebalanceShifts) {
        const cause = (shift.payload as { cause?: { entityId?: string } }).cause
        // weights.rebalanced threads the model id as entityId, no criterionId.
        expect(cause?.entityId).toBe(model.modelId)
      }
    })
  })
})
