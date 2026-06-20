import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { AI_MODEL_ID, AI_PROFILE_MODEL_ID } from "./config"

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
      // The model draft stays on the quality-defining default model.
      expect(suggestion?.model?.model).toBe(AI_MODEL_ID)
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
      const payload = audit[0]?.payload as {
        kind: string
        acceptedCount: number
        totalProposed: number
        count: number
        items: Array<{
          criterionId: string
          label: string
          changes: Record<string, { from: null; to: unknown }>
        }>
      }
      // One valid criterion landed out of two proposed.
      expect(payload.kind).toBe("model.draft")
      expect(payload.acceptedCount).toBe(1)
      expect(payload.totalProposed).toBe(2)
      expect(payload.count).toBe(1)
      expect(payload.items).toHaveLength(1)
      const item = payload.items[0]
      if (item === undefined) throw new Error("missing item")
      // The retained insert id matches the criterion that actually landed.
      expect(item.criterionId).toBe(criteria[0]?._id)
      expect(item.label).toBe("Komplexitet")
      // originalWeightPoints is the AI's proposed value (5); weightPoints is the
      // repaired/applied value (a single-criterion subset repairs to 3).
      expect(item.changes.originalWeightPoints).toEqual({ from: null, to: 5 })
      expect(item.changes.weightPoints).toEqual({ from: null, to: 3 })
      expect(item.changes.isCustom).toEqual({ from: null, to: true })
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
    // Weight review stays on the quality-defining default model, not the
    // faster role-profile model (provenance regression guard for the split).
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.model?.model).toBe(AI_MODEL_ID)
    })
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
      const payload = audit[0]?.payload as {
        appliedCount: number
        totalMoves: number
        skippedCount: number
        appliedMoveIndexes: number[]
        count: number
        items: Array<{
          criterionId: string
          label?: string
          changes: { weightPoints: { from: number; to: number } }
        }>
        moves: Array<{
          fromCriterionId: string
          fromLabel?: string
          toCriterionId: string
          toLabel?: string
          points: number
          applied: boolean
          motivation: string
        }>
      }
      expect(payload.appliedCount).toBe(1)
      // Four accepted indexes were sent; only the first applied.
      expect(payload.totalMoves).toBe(4)
      expect(payload.skippedCount).toBe(3)
      expect(payload.appliedMoveIndexes).toEqual([0])

      // CRITICAL (binding correction #4): ownA is touched by move 0 (3->2) AND
      // move 3 (which is SKIPPED by the 1-5 floor: 2-2=0). The recorded `to`
      // must be the ACTUAL stored value (2), never an accumulated 3-1-2=0, and
      // the `from` must be the true pre-any-patch value (3).
      const aItem = payload.items.find((i) => i.criterionId === ownA)
      const bItem = payload.items.find((i) => i.criterionId === ownB)
      expect(aItem?.changes.weightPoints).toEqual({ from: 3, to: 2 })
      expect(bItem?.changes.weightPoints).toEqual({ from: 3, to: 4 })
      expect(aItem?.label).toBe("Own A")
      expect(bItem?.label).toBe("Own B")
      // Only the two genuinely-changed criteria appear (no zero-delta entries).
      expect(payload.items).toHaveLength(2)
      expect(payload.count).toBe(2)

      // moves[] preserves every accepted move with its applied flag + motivation.
      expect(payload.moves).toHaveLength(4)
      expect(payload.moves[0]).toMatchObject({
        fromCriterionId: ownA,
        toCriterionId: ownB,
        points: 1,
        applied: true,
        motivation: "Fits the company profile.",
      })
      // The skipped duplicate-touch move keeps applied: false (struck in the UI).
      expect(payload.moves[3]).toMatchObject({
        fromCriterionId: ownA,
        toCriterionId: ownB,
        points: 2,
        applied: false,
        motivation: "Jointly breaches the floor.",
      })
      // The foreign and malformed moves are also recorded as not applied.
      expect(payload.moves[1]?.applied).toBe(false)
      expect(payload.moves[2]?.applied).toBe(false)
    })
  })

  it("confirmWeightReview records net per-criterion items across a normal multi-move chain", async () => {
    const t = initConvexTest()
    const anchors = ["a0", "a1", "a2", "a3", "a4", "a5"]
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    // Three criteria at the neutral 3 each (budget 9).
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Alpha",
        description: "d",
        helpText: "h",
        anchors,
      }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Beta",
        description: "d",
        helpText: "h",
        anchors,
      }
    )
    const c = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Gamma",
        description: "d",
        helpText: "h",
        anchors,
      }
    )

    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    // Two moves both touch Beta: A->B (+1) then B->C (-1). Beta nets to 3 again,
    // so it must NOT appear in items (zero net change is filtered out). Alpha
    // ends at 2, Gamma at 4.
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: a,
          toCriterionId: b,
          points: 1,
          motivation: "Shift toward Beta.",
        },
        {
          fromCriterionId: b,
          toCriterionId: c,
          points: 1,
          motivation: "Then on to Gamma.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0, 1],
    })

    await t.run(async (ctx) => {
      expect((await ctx.db.get(a))?.weightPoints).toBe(2)
      expect((await ctx.db.get(b))?.weightPoints).toBe(3)
      expect((await ctx.db.get(c))?.weightPoints).toBe(4)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      const payload = audit[0]?.payload as {
        appliedCount: number
        appliedMoveIndexes: number[]
        items: Array<{
          criterionId: string
          changes: { weightPoints: { from: number; to: number } }
        }>
        moves: Array<{ applied: boolean }>
      }
      expect(payload.appliedCount).toBe(2)
      expect(payload.appliedMoveIndexes).toEqual([0, 1])
      // Beta nets to its original 3 -> filtered out. Only Alpha and Gamma move.
      expect(payload.items).toHaveLength(2)
      const alpha = payload.items.find((i) => i.criterionId === a)
      const gamma = payload.items.find((i) => i.criterionId === c)
      const beta = payload.items.find((i) => i.criterionId === b)
      expect(alpha?.changes.weightPoints).toEqual({ from: 3, to: 2 })
      expect(gamma?.changes.weightPoints).toEqual({ from: 3, to: 4 })
      expect(beta).toBeUndefined()
      expect(payload.moves.every((m) => m.applied)).toBe(true)
    })
  })

  it("confirmModelDraft band.shift rows carry the AI-confirm cause", async () => {
    const t = initConvexTest()
    const anchors = ["a0", "a1", "a2", "a3", "a4", "a5"]
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    // setRating requires a complete profile; the seeded role has none, so give
    // it one before rating.
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, {
        purpose: "Builds the core product.",
        responsibilities: "Ships features",
      })
    })
    // Fully rate the role against the seeded template so it has a complete band.
    const criteria = await t.run(async (ctx) =>
      ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    for (const criterion of criteria) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion._id,
        value: 5,
      })
    }
    // A confirmed model draft adds a new criterion, which flips the fully-rated
    // role to incomplete (band -> null): a deterministic band.shift. The shift
    // rows must be traceable back to the suggestion that caused them.
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.run(async (ctx) => {
      await ctx.db.patch(suggestionId, {
        status: "suggested",
        suggestedValue: {
          criteria: [
            {
              name: "Ny aspekt",
              description: "d",
              helpText: "h",
              weightPoints: 3,
              anchors,
            },
          ],
        },
      })
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0],
    })

    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      // The earlier setRating calls also emit band.shift rows (cause:
      // rating.change). Isolate the rows the confirm produced via their cause:
      // they must point back to THIS suggestion with the AI-confirm event.
      const fromConfirm = shifts.filter((shift) => {
        const cause = (shift.payload as { cause?: Record<string, unknown> })
          .cause
        return (
          cause?.event === "ai.suggestionConfirmed" &&
          cause?.entityId === suggestionId
        )
      })
      expect(fromConfirm.length).toBeGreaterThan(0)
      // No confirm-time band.shift may be missing the cause (the threading is
      // applied at the logBandShifts call, so every row from this confirm has
      // it). The rating-change rows are the only OTHER cause present.
      const causeEvents = new Set(
        shifts.map(
          (shift) =>
            (shift.payload as { cause?: { event?: string } }).cause?.event
        )
      )
      expect(causeEvents).toEqual(
        new Set(["rating.change", "ai.suggestionConfirmed"])
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
      const payload = audit[0]?.payload as {
        kind: string
        changes: { status: { from: string; to: string } }
        modelId?: string
        roleId?: string
      }
      expect(payload.kind).toBe("model.draft")
      // status before->after: saveDraft moved the row to "suggested", the
      // dismissal flips it to "rejected".
      expect(payload.changes.status).toEqual({
        from: "suggested",
        to: "rejected",
      })
      // model.draft targets a model: the id-only target carries modelId, never
      // a null roleId/criterionId key.
      expect(payload.modelId).toBeTruthy()
      expect("roleId" in payload).toBe(false)
      expect("criterionId" in payload).toBe(false)
      // A dismissed suggestion was never applied: the suggestedValue must NOT
      // appear anywhere in the payload (recursive scan for the key).
      const hasSuggestedValue = (value: unknown): boolean => {
        if (value === null || typeof value !== "object") return false
        if (Array.isArray(value))
          return value.some((entry) => hasSuggestedValue(entry))
        const record = value as Record<string, unknown>
        if ("suggestedValue" in record) return true
        return Object.values(record).some((entry) => hasSuggestedValue(entry))
      }
      expect(hasSuggestedValue(payload)).toBe(false)
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
      // Role-profile drafting runs on the faster profile model.
      expect(suggestion?.model?.provider).toBe("mistral")
      expect(suggestion?.model?.model).toBe(AI_PROFILE_MODEL_ID)
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
        purpose: "  Bygger och underhåller kärnprodukten.  ",
        responsibilities: "x".repeat(2001),
      },
    })
    await asAdmin.mutation(api.ai.suggest.confirmRoleProfileDraft, {
      orgId,
      suggestionId,
      acceptedFields: ["purpose", "responsibilities", "title", "nonsense"],
    })
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      const role = await ctx.db.get(docId)
      // Accepted and valid: purpose (trimmed).
      expect(role?.purpose).toBe("Bygger och underhåller kärnprodukten.")
      // Over the length bound (responsibilities cap is 2000): skipped.
      expect(role?.responsibilities).toBe("")
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
      // The companion role.updated row carries the VALUES plus provenance:
      // source "aiSuggestion" + the suggestionId it came from. Structured diff
      // like a manual edit: the seeded purpose was "" and the accepted draft is
      // the trimmed value.
      const updatedRow = updated.find(
        (row) =>
          (row.payload as Record<string, unknown>).roleId === docId &&
          (row.payload as { changes?: { purpose?: unknown } }).changes
            ?.purpose !== undefined
      )
      expect(updatedRow?.payload).toMatchObject({
        roleId: docId,
        source: "aiSuggestion",
        suggestionId,
        changes: {
          purpose: {
            from: "",
            to: "Bygger och underhåller kärnprodukten.",
          },
        },
      })

      // The AI confirm row is NAMES-only: it lists which fields were applied,
      // but never embeds the purpose/responsibilities TEXT (the values live on
      // the companion role.updated row above). Recursively assert no value text.
      const aiConfirm = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(aiConfirm).toHaveLength(1)
      const aiPayload = aiConfirm[0]?.payload as Record<string, unknown>
      expect(aiPayload).toMatchObject({
        kind: "role.profile",
        roleId: docId,
        appliedCount: 1,
        appliedFields: ["purpose"],
        confirmed: true,
      })
      // requestedFields is the human's accepted set; offeredFields the AI's keys.
      expect(aiPayload.requestedFields).toEqual([
        "purpose",
        "responsibilities",
        "title",
        "nonsense",
      ])
      expect(aiPayload.offeredFields).toEqual(
        expect.arrayContaining(["purpose", "responsibilities"])
      )
      // The applied purpose value must NOT appear anywhere on the AI row.
      const serialized = JSON.stringify(aiPayload)
      expect(serialized).not.toContain("Bygger och underhåller kärnprodukten.")
    })
  })

  it("schedules generateRoleProfileDraft with the role's family name when it has one", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    // Attach the seeded role to a family (user-entered grouping name).
    const familyId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("roleFamilies", {
        orgId,
        name: "Engineering",
      })
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { familyId: id })
      return id
    })

    await asAdmin.mutation(api.ai.suggest.requestRoleProfileDraft, {
      orgId,
      roleId,
    })

    // The draft generation runs in a scheduled action; assert the family NAME
    // (not the id) was threaded into its args. convex-test records pending
    // scheduled calls in the _scheduled_functions system table.
    await t.run(async (ctx) => {
      const scheduled = await ctx.db.system
        .query("_scheduled_functions")
        .collect()
      const draftCall = scheduled.find((row) =>
        row.name.endsWith("generateRoleProfileDraft")
      )
      expect(draftCall).toBeTruthy()
      const args = draftCall?.args[0] as { family?: string }
      expect(args.family).toBe("Engineering")
    })
    void familyId
  })

  it("schedules generateRoleProfileDraft with NO family arg for an unfamilied role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    // The seeded role has no familyId, so the scheduled args must omit the key
    // entirely (not pass family: undefined) to stay byte-identical to before.
    await asAdmin.mutation(api.ai.suggest.requestRoleProfileDraft, {
      orgId,
      roleId,
    })
    await t.run(async (ctx) => {
      const scheduled = await ctx.db.system
        .query("_scheduled_functions")
        .collect()
      const draftCall = scheduled.find((row) =>
        row.name.endsWith("generateRoleProfileDraft")
      )
      expect(draftCall).toBeTruthy()
      const args = draftCall?.args[0] as Record<string, unknown>
      expect("family" in args).toBe(false)
    })
  })

  it("locks drafts for archived roles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { archivedAt: Date.now() })
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
      // The starter import stays on the quality-defining default model.
      expect(suggestion?.model?.model).toBe(AI_MODEL_ID)
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
      // The confirm row carries the created tree (families -> roles) so the
      // import reconstructs without a follow-up query.
      const importPayload = audit[0]?.payload as {
        families: Array<{
          familyId: string
          name: string
          roles: Array<{ roleId: string; title: string; trackKey: string }>
        }>
      }
      expect(importPayload.families).toHaveLength(1)
      const family = importPayload.families[0]
      if (family === undefined) throw new Error("missing family")
      expect(family.name).toBe("Engineering")
      // The captured familyId matches the actually-created family doc.
      expect(family.familyId).toBe(families[0]?._id)
      expect(family.roles).toHaveLength(2)
      expect(family.roles.map((r) => r.title).sort()).toEqual([
        "Engineering Manager",
        "Software Developer",
      ])
      // Each captured roleId resolves to a real created role in the family.
      const roleIds = new Set(roles.map((r) => r._id))
      for (const role of family.roles) {
        expect(roleIds.has(role.roleId as (typeof roles)[number]["_id"])).toBe(
          true
        )
        expect(typeof role.trackKey).toBe("string")
      }
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

describe("getOpenSuggestions kind filter", () => {
  it("returns only the requested kind via the kind-scoped index", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    // One open import row plus several open drafts that would otherwise
    // compete for the same per-status cap.
    const importId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Developer" }
    )
    for (let i = 0; i < 3; i++) {
      await asAdmin.mutation(api.ai.suggest.requestModelDraft, { orgId })
    }
    const filtered = await asAdmin.query(api.ai.suggest.getOpenSuggestions, {
      orgId,
      kind: "starter.import",
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.suggestionId).toBe(importId)
    const all = await asAdmin.query(api.ai.suggest.getOpenSuggestions, {
      orgId,
    })
    expect(all.length).toBeGreaterThan(1)
  })
})
