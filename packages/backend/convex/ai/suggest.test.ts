import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedRoleOrganization(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr-role@acme.se", name: "HR Person", role: "admin" }
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
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Junior Software Developer",
    function: "Engineering",
    team: "Core",
    trackKey: track.key,
  })
  return { orgId, asAdmin, roleId }
}

// A single criterion at the neutral 3 is balanced on its own (budget 3), so
// it passes saveDraft's balance gate.
const VALID_DRAFT_CRITERION = {
  name: "Komplexitet",
  description: "Hur svåra problem rollen hanterar.",
  helpText: "Bedöm mot ankartexterna.",
  weightPoints: 3,
  anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
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

  it("requestModelDraft stamps requestedBy with the caller", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "requester@acme.se", name: "Requester", role: "admin" }
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
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.requestedBy).toBe(userId)
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

  it("confirmModelDraft inserts only valid accepted criteria, repairs the subset, and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    // Injected directly past saveDraft's balance gate: confirm must hold the
    // trust boundary on its own (defense in depth).
    await t.run(async (ctx) => {
      await ctx.db.patch(suggestionId, {
        status: "suggested",
        suggestedValue: {
          criteria: [
            { ...VALID_DRAFT_CRITERION, weightPoints: 5 },
            {
              name: "Ogiltig",
              description: "d",
              helpText: "h",
              weightPoints: 9,
              anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
            },
          ],
        },
      })
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
      // index 1 has weightPoints 9 (off scale) and is skipped; index 7 is out of range.
      expect(criteria).toHaveLength(1)
      expect(criteria[0]?.name).toBe("Komplexitet")
      expect(criteria[0]?.isCustom).toBe(true)
      // The accepted subset is repaired to ITS budget (1 criterion -> 3), so
      // a partial accept of a balanced draft never unbalances the model.
      expect(criteria[0]?.weightPoints).toBe(3)
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

  it("saveDraft rejects an unbalanced allocation with errors.weightsUnbalanced", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await expect(
      t.mutation(internal.ai.persist.saveDraft, {
        suggestionId,
        criteria: [{ ...VALID_DRAFT_CRITERION, weightPoints: 5 }],
      })
    ).rejects.toThrow(/errors.weightsUnbalanced/)
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
        anchors,
      }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "Second",
      description: "d",
      helpText: "h",
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
      criteria: [VALID_DRAFT_CRITERION],
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

  it("confirmWeightReview applies only same-org, in-bounds moves", async () => {
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
        anchors,
      }
    )

    // Same-org organization: two criteria at the neutral 3 each.
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownA = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      { orgId, name: "Own A", description: "d", helpText: "h", anchors }
    )
    const ownB = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      { orgId, name: "Own B", description: "d", helpText: "h", anchors }
    )

    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    // saveWeightReview types the ids as v.string(): foreign ids, malformed
    // ids, and bound-breaching moves all pass persist and must be neutralized
    // at confirm.
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: ownA,
          toCriterionId: ownB,
          points: 1,
          motivation: "Fits the company profile.",
        },
        {
          fromCriterionId: foreignCriterionId,
          toCriterionId: ownB,
          points: 1,
          motivation: "Cross-org injection attempt.",
        },
        {
          fromCriterionId: "not-an-id",
          toCriterionId: ownB,
          points: 1,
          motivation: "Malformed id.",
        },
        {
          // ownA stands at 2 after the first move: a second 2-point take
          // would land at 0, so the cumulative bound check must skip it.
          fromCriterionId: ownA,
          toCriterionId: ownB,
          points: 2,
          motivation: "Jointly breaches the floor.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0, 1, 2, 3],
    })

    await t.run(async (ctx) => {
      const a = await ctx.db.get(ownA)
      const b = await ctx.db.get(ownB)
      // Only the first move applied: 3-1=2 and 3+1=4. Each move is zero-sum,
      // so the allocation stays exactly on budget.
      expect(a?.weightPoints).toBe(2)
      expect(b?.weightPoints).toBe(4)
      const foreignCriterion = await ctx.db.get(foreignCriterionId)
      expect(foreignCriterion?.weightPoints).toBe(3)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect((audit[0]?.payload as Record<string, unknown>).appliedCount).toBe(
        1
      )
    })
  })

  it("getWeightReviewLock holds after a confirmed review and releases on a model change", async () => {
    const t = initConvexTest()
    const anchors = ["a0", "a1", "a2", "a3", "a4", "a5"]
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      { orgId, name: "A", description: "d", helpText: "h", anchors }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      { orgId, name: "B", description: "d", helpText: "h", anchors }
    )

    // No review yet: unlocked.
    expect(
      await asAdmin.query(api.ai.suggest.getWeightReviewLock, { orgId })
    ).toBe(false)

    // A DISMISSED review never locks.
    const dismissedId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId: dismissedId,
      moves: [],
    })
    await asAdmin.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId: dismissedId,
    })
    expect(
      await asAdmin.query(api.ai.suggest.getWeightReviewLock, { orgId })
    ).toBe(false)

    // A CONFIRMED review locks until the weighting changes again.
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: a,
          toCriterionId: b,
          points: 1,
          motivation: "Fits the profile.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0],
    })
    expect(
      await asAdmin.query(api.ai.suggest.getWeightReviewLock, { orgId })
    ).toBe(true)

    // A manual rebalance is a model change: the lock releases.
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 3 },
        { criterionId: b, weightPoints: 3 },
      ],
    })
    expect(
      await asAdmin.query(api.ai.suggest.getWeightReviewLock, { orgId })
    ).toBe(false)
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
      criteria: [VALID_DRAFT_CRITERION],
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

  it("rejectSuggestion records rejectedBy and an audit row without touching confirmedBy", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    // saveDraft moves the row to "suggested"; dismissing it must not run the
    // confirm path's confirmedBy attribution.
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: [VALID_DRAFT_CRITERION],
    })
    await asAdmin.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("rejected")
      expect(typeof suggestion?.rejectedBy).toBe("string")
      // confirmedBy stays empty: a dismissal is not a confirmation.
      expect(suggestion?.confirmedBy).toBeUndefined()
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionRejected")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect((audit[0]?.payload as Record<string, unknown>).kind).toBe(
        "model.draft"
      )
    })
  })

  it("rejectSuggestion refuses to overwrite a confirmed suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: [VALID_DRAFT_CRITERION],
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0],
    })
    // The confirmed row is terminal: its provenance cannot be flipped to
    // rejected after the fact.
    await expect(
      asAdmin.mutation(api.ai.suggest.rejectSuggestion, {
        orgId,
        suggestionId,
      })
    ).rejects.toThrow(/errors.invalidTransition/)
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      expect(suggestion?.confirmedBy).toBeTruthy()
      expect(suggestion?.rejectedBy).toBeUndefined()
    })
  })

  it("editors cannot dismiss model-configuration suggestions but can dismiss role-profile drafts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    // Give the org an editor alongside the seeded admin. seedDuplicateMember
    // just inserts a member row for an existing org; reused here to add a
    // distinct editor member (the editor's own seeded org is irrelevant).
    const { userId: editorId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor-role@acme.se", name: "Editor Person", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: editorId,
      role: "editor",
    })
    const asEditor = t.withIdentity({ subject: editorId })

    // model.weightReview is admin-configuration: an editor must not dismiss it.
    const modelSuggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId: modelSuggestionId,
      moves: [],
    })
    await expect(
      asEditor.mutation(api.ai.suggest.rejectSuggestion, {
        orgId,
        suggestionId: modelSuggestionId,
      })
    ).rejects.toThrow(/errors.adminRequired/)
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(modelSuggestionId)
      expect(suggestion?.status).toBe("suggested")
    })

    // role.profile is member scope: the editor CAN dismiss it.
    const roleSuggestionId = await asEditor.mutation(
      api.ai.suggest.requestRoleProfileDraft,
      { orgId, roleId }
    )
    await t.mutation(internal.ai.persist.saveRoleProfileDraft, {
      suggestionId: roleSuggestionId,
      profile: {
        purpose: "Bygger kärnprodukten.",
        responsibilities: "Implementerar features",
      },
    })
    await asEditor.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId: roleSuggestionId,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(roleSuggestionId)
      expect(suggestion?.status).toBe("rejected")
      expect(suggestion?.rejectedBy).toBe(editorId)
    })
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
          weightPoints: 3,
          anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
        },
        {
          // Empty anchor text must be skipped.
          name: "HasEmptyAnchor",
          description: "d",
          helpText: "h",
          weightPoints: 3,
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

describe("role profile drafts", () => {
  it("requestRoleProfileDraft inserts a generating row targeting the role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleProfileDraft,
      { orgId, roleId, description: "Bygger kärnprodukten." }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.target.kind).toBe("role.profile")
      expect(suggestion?.target.roleId).toBe(roleId)
    })
    // getOpenSuggestions must expose roleId so the role page can filter.
    const open = await asAdmin.query(api.ai.suggest.getOpenSuggestions, {
      orgId,
    })
    const row = open.find((item) => item.kind === "role.profile")
    expect(row?.roleId).toBe(roleId)
  })

  it("confirmRoleProfileDraft applies only accepted, whitelisted, bounded fields", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleProfileDraft,
      { orgId, roleId }
    )
    await t.mutation(internal.ai.persist.saveRoleProfileDraft, {
      suggestionId,
      profile: {
        purpose: "Bygger och underhåller kärnprodukten.",
        responsibilities: "Implementerar features\nGranskar kod",
        knowledge: "  Grundläggande systemdesign  ",
        financial: "x".repeat(1001),
      },
    })
    await asAdmin.mutation(api.ai.suggest.confirmRoleProfileDraft, {
      orgId,
      suggestionId,
      acceptedFields: [
        "purpose",
        "knowledge",
        "financial",
        "title",
        "nonsense",
      ],
    })
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      const role = await ctx.db.get(docId)
      // Accepted and valid: purpose, knowledge (trimmed).
      expect(role?.purpose).toBe("Bygger och underhåller kärnprodukten.")
      expect(role?.knowledge).toBe("Grundläggande systemdesign")
      // Not accepted: responsibilities stays empty.
      expect(role?.responsibilities).toBe("")
      // Over the length bound: financial is skipped.
      expect(role?.financial).toBeUndefined()
      // Whitelist: title is never AI-writable.
      expect(role?.title).toBe("Junior Software Developer")
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated.map((row) => row.payload)).toContainEqual({
        roleId: docId,
        fields: ["purpose", "knowledge"],
      })
    })
  })

  it("locks drafts for approved roles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { status: "approved" })
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.requestRoleProfileDraft, {
        orgId,
        roleId,
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })
})

describe("starter import", () => {
  const SUGGESTED_FAMILIES = [
    {
      name: "Engineering",
      roles: [
        { title: "Software Developer", trackKey: "IC" },
        { title: "Engineering Manager", trackKey: "M" },
      ],
    },
    {
      name: "Sales",
      roles: [{ title: "Account Executive", trackKey: "IC" }],
    },
  ]

  it("requestStarterImport inserts a generating row with provenance", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer\nTech Lead\nAccountant" }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.source).toBe("ai")
      expect(suggestion?.target.kind).toBe("starter.import")
      expect(suggestion?.model?.provider).toBe("mistral")
      expect(suggestion?.requestedBy).toBeTruthy()
    })
  })

  it("requestStarterImport rejects blank and oversized text", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestStarterImport, {
        orgId,
        rawText: "   \n  ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestStarterImport, {
        orgId,
        rawText: "x".repeat(20_001),
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("saveStarterImport rejects an unknown track key and an empty list", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Developer" }
    )
    await expect(
      t.mutation(internal.ai.persist.saveStarterImport, {
        suggestionId,
        families: [
          { name: "Engineering", roles: [{ title: "Dev", trackKey: "Boss" }] },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      t.mutation(internal.ai.persist.saveStarterImport, {
        suggestionId,
        families: [],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("confirmStarterImport creates the edited set, marks confirmed, and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer\nAccount Executive" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
    })
    // The user edited the proposal before confirming: one role removed.
    await asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
      orgId,
      suggestionId,
      families: [SUGGESTED_FAMILIES[0] as (typeof SUGGESTED_FAMILIES)[number]],
    })
    await t.run(async (ctx) => {
      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families.map((family) => family.name)).toEqual(["Engineering"])
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles.map((role) => role.title).sort()).toEqual([
        "Engineering Manager",
        "Software Developer",
      ])
      expect(roles.every((role) => role.familyId === families[0]?._id)).toBe(
        true
      )
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      expect(suggestion?.confirmedBy).toBeTruthy()
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toMatchObject({
        kind: "starter.import",
        familyCount: 1,
        roleCount: 2,
      })
      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(created).toHaveLength(2)
      expect(created[0]?.payload).toMatchObject({ source: "aiImport" })
    })
  })

  it("confirmStarterImport with an emptied list creates nothing and closes as rejected", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
    })
    await asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
      orgId,
      suggestionId,
      families: [],
    })
    await t.run(async (ctx) => {
      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families).toHaveLength(0)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("rejected")
    })
  })

  it("confirmStarterImport surfaces a duplicate family and leaves the suggestion open", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [{ name: "engineering", roles: [] }],
    })
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
        orgId,
        suggestionId,
        families: SUGGESTED_FAMILIES,
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("suggested")
    })
  })

  it("confirmStarterImport refuses a second confirm on the same suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
    })
    await asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
      orgId,
      suggestionId,
      families: [SUGGESTED_FAMILIES[1] as (typeof SUGGESTED_FAMILIES)[number]],
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
        orgId,
        suggestionId,
        families: SUGGESTED_FAMILIES,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
