import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const DRAFT = {
  criteria: [
    {
      name: "Komplexitet",
      description: "Hur svåra problem rollen hanterar.",
      helpText: "Bedöm mot ankartexterna.",
      importanceLevel: 5,
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    },
    {
      name: "Ogiltig",
      description: "d",
      helpText: "h",
      importanceLevel: 9,
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    },
  ],
}

async function seedScratchOrganization(t: ReturnType<typeof initConvexTest>) {
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
  await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
    orgId,
    name: "Scratch",
  })
  return { orgId, asAdmin }
}

describe("AI suggestion lifecycle", () => {
  it("requestModelDraft inserts a generating row with provenance", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId, description: "Vi bygger HR-mjukvara." }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.source).toBe("ai")
      expect(suggestion?.target.kind).toBe("model.draft")
      expect(suggestion?.model?.provider).toBe("mistral")
    })
  })

  it("requires a complete profile", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.ai.suggest.requestModelDraft, { orgId })
    ).rejects.toThrow(/errors.profileIncomplete/)
  })

  it("confirmModelDraft inserts only valid accepted criteria and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: DRAFT.criteria,
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0, 1, 7],
    })
    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // index 1 has importanceLevel 9 (off scale) and is skipped; index 7 is out of range.
      expect(criteria).toHaveLength(1)
      expect(criteria[0]?.name).toBe("Komplexitet")
      expect(criteria[0]?.isCustom).toBe(true)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("rejects requestModelDraft when a profile field is an empty string", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr2@acme.se", name: "HR Person 2", role: "admin" }
    )
    // Insert a profile with industry as an empty string: must be rejected
    // by the truthiness guard.
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "sv",
        industry: "",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
      orgId,
      name: "Empty-field organization",
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.requestModelDraft, { orgId })
    ).rejects.toThrow(/errors.profileIncomplete/)
  })

  it("markFailed stores a translatable error code", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.markFailed, {
      suggestionId,
      errorCode: "errors.aiGenerationFailed",
    })
    const open = await asAdmin.query(api.ai.suggest.getOpenSuggestions, {
      orgId,
    })
    expect(open).toHaveLength(1)
    expect(open[0]?.status).toBe("failed")
    expect(open[0]?.errorCode).toBe("errors.aiGenerationFailed")
  })

  it("confirmModelDraft produces unique orders after a criterion is removed", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)

    // Add two criteria via the editor so they get order 1 and 2.
    const anchors = ["a0", "a1", "a2", "a3", "a4", "a5"]
    const firstId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "First",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors,
      }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "Second",
      description: "d",
      helpText: "h",
      importanceLevel: 3,
      anchors,
    })

    // Remove the FIRST criterion, leaving a gap: remaining criterion has order 2.
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: firstId,
    })

    // Simulate a completed AI draft and accept the single valid criterion.
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: [DRAFT.criteria[0]],
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0],
    })

    // All criterion orders must be unique; max-based ordering must not collide
    // with the remaining criterion at order 2.
    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const orders = criteria.map((c) => c.order)
      const uniqueOrders = new Set(orders)
      expect(uniqueOrders.size).toBe(orders.length)
    })
  })

  it("confirmImportanceReview applies only same-org criterion adjustments", async () => {
    const t = initConvexTest()
    const anchors = ["a0", "a1", "a2", "a3", "a4", "a5"]

    // Foreign organization: seed a real criterion id that belongs to ANOTHER org.
    const foreign = await seedScratchOrganization(t)
    const foreignCriterionId = await foreign.asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId: foreign.orgId,
        name: "Foreign",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors,
      }
    )

    // Same-org organization: the criterion we expect to change.
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownCriterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Own",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors,
      }
    )

    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestImportanceReview,
      { orgId }
    )
    // saveImportanceReview types criterionId as v.string(): a foreign id and a
    // malformed id both pass persist and must be neutralized at confirm.
    await t.mutation(internal.ai.persist.saveImportanceReview, {
      suggestionId,
      adjustments: [
        {
          criterionId: ownCriterionId,
          suggestedImportanceLevel: 6,
          motivation: "Fits the company profile.",
        },
        {
          criterionId: foreignCriterionId,
          suggestedImportanceLevel: 7,
          motivation: "Cross-org injection attempt.",
        },
        {
          criterionId: "not-an-id",
          suggestedImportanceLevel: 7,
          motivation: "Malformed id.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmImportanceReview, {
      orgId,
      suggestionId,
      acceptedCriterionIds: [ownCriterionId, foreignCriterionId],
    })

    await t.run(async (ctx) => {
      const own = await ctx.db.get(ownCriterionId)
      expect(own?.importanceLevel).toBe(6)
      const foreignCriterion = await ctx.db.get(foreignCriterionId)
      // The foreign criterion is untouched (still at its seeded level).
      expect(foreignCriterion?.importanceLevel).toBe(3)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("confirmModelDraft rejects a second confirm on the same suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: DRAFT.criteria,
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0],
    })
    // The first confirm moved status off "suggested"; a second confirm must
    // not double-apply.
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
        orgId,
        suggestionId,
        acceptedIndexes: [0],
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("confirmModelDraft skips malformed draft values and rejects the suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: [
        {
          // Whitespace-only name must be skipped.
          name: "  ",
          description: "d",
          helpText: "h",
          importanceLevel: 5,
          anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
        },
        {
          // Empty anchor text must be skipped.
          name: "HasEmptyAnchor",
          description: "d",
          helpText: "h",
          importanceLevel: 5,
          anchors: ["a0", "", "a2", "a3", "a4", "a5"],
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0, 1],
    })
    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(0)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("rejected")
    })
  })
})
