import { MAX_ROLES } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import {
  addEditorMember,
  grantModelApproval,
  initConvexTest,
} from "../testing.helpers"
import { AI_MODEL_ID } from "./config"
import { assertPromptDataSafe } from "./promptGuard"

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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of [
    "knowledge-depth",
    "complexity-ambiguity",
    "scope-impact",
  ] as const) {
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
    title: "Junior Software Developer",
    function: "Engineering",
    team: "Core",
    trackKey: track.key,
  })
  // setRating's FIRST gate (ADR-0023) requires an approved model; this
  // fixture is a role-profile/AI test, not an approval-checklist test.
  await grantModelApproval(t, orgId)
  return { orgId, asAdmin, roleId, model }
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  return { orgId, asAdmin }
}

describe("AI suggestion lifecycle", () => {
  it("markFailed stores a translatable error code", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "complexity-ambiguity",
    })
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
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

  it("confirmWeightReview applies only same-org, in-bounds moves", async () => {
    const t = initConvexTest()

    // Foreign organization: seed a real criterion id that belongs to ANOTHER org.
    const foreign = await seedScratchOrganization(t)
    const foreignCriterionId = await foreign.asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId: foreign.orgId, libraryKey: "complexity-ambiguity" }
    )

    // Same-org organization: two criteria at the neutral 3 each.
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownA = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const ownB = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
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
        modelId: string
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
      // The permanent entity attribution: the trail must always record which
      // model the confirmation touched.
      expect(payload.modelId).toBe(suggestion?.target.modelId)
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
      expect(aItem?.label).toBe("Komplexitet och otydlighet")
      expect(bItem?.label).toBe("Scope och påverkan")
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
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    // Three criteria at the neutral 3 each (budget 9).
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const c = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "autonomy-mandate" }
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

  // The AI path changes the same field its manual twin does, so it owes the
  // model the same consequence. Without this, a model would keep asserting an
  // approval for a weighting nobody approved, and a pay-mapping run would
  // freeze those AI-moved weights as reviewed statutory evidence.
  it("confirmWeightReview reopens the model's approval, like its manual twin", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownA = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const ownB = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    await grantModelApproval(t, orgId)

    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: ownA,
          toCriterionId: ownB,
          points: 1,
          motivation: "Fits the company profile.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0],
    })

    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      // The approval is gone, and the trail says what took it.
      expect(model?.approval).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(
        (rows[0]?.payload as { causeEvent?: string } | undefined)?.causeEvent
      ).toBe("model.updated")
    })

    // And the gate downstream reads it: the run that would have frozen this
    // weighting as evidence is no longer ready to start.
    const preconditions = await asAdmin.query(
      api.payMapping.runs.getPayMappingPreconditions,
      { orgId }
    )
    expect(preconditions.modelApproved).toBe(false)
    expect(preconditions.ready).toBe(false)
  })

  // A confirm that applies nothing is a rejection: it must not disturb a
  // standing approval.
  it("confirmWeightReview leaves approval alone when no move applies", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownA = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    await grantModelApproval(t, orgId)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          // Out of bounds on its own: 3 - 3 lands under the floor.
          fromCriterionId: ownA,
          toCriterionId: ownA,
          points: 3,
          motivation: "Neutralized at confirm.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0],
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.approval).toBeDefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.approvalReopened")
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it("confirmWeightReview level.shift rows carry the AI-confirm cause", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId, model } = await seedRoleOrganization(t)
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
    // Fully rate the role, skewed toward the first criterion, so a rebalance
    // that moves points onto it actually shifts the score/level.
    for (const [index, criterion] of model.criteria.entries()) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: index === 0 ? 5 : 1,
        // 1 and 5 both require a motivation.
        motivation: "Test motivation.",
      })
    }
    // A confirmed weight review that moves points onto the role's strong
    // criterion shifts its score/level: the shift rows must be traceable
    // back to the suggestion that caused them.
    const first = model.criteria[0]
    const rest = model.criteria.slice(1)
    if (first === undefined) throw new Error("seed")
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    const donor = rest[0]
    if (donor === undefined) throw new Error("seed")
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: donor.criterionId as string,
          toCriterionId: first.criterionId as string,
          points: 2,
          motivation: "Weights toward the strongest criterion.",
        },
      ],
    })
    await asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0],
    })

    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      // The earlier setRating calls also emit level.shift rows (cause:
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
      // No confirm-time level.shift may be missing the cause (the threading is
      // applied at the logLevelShifts call, so every row from this confirm has
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
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
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

  it("confirmWeightReview rejects a second confirm on the same suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
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
    // The first confirm moved status off "suggested"; a second confirm must
    // not double-apply.
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmWeightReview, {
        orgId,
        suggestionId,
        acceptedMoveIndexes: [0],
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejectSuggestion records rejectedBy and an audit row without touching confirmedBy", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "complexity-ambiguity",
    })
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    // saveWeightReview moves the row to "suggested"; dismissing it must not
    // run the confirm path's confirmedBy attribution.
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [],
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
      expect(payload.kind).toBe("model.weightReview")
      // status before->after: saveWeightReview moved the row to "suggested",
      // the dismissal flips it to "rejected".
      expect(payload.changes.status).toEqual({
        from: "suggested",
        to: "rejected",
      })
      // model.weightReview targets a model: the id-only target carries
      // modelId, never a null roleId/criterionId key.
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
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
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

  it("editors request and confirm a weight review", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const ownA = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "complexity-ambiguity" }
    )
    const ownB = await asAdmin.mutation(
      api.evaluationModel.criteria.activateCriterion,
      { orgId, libraryKey: "scope-impact" }
    )
    const { editorId, asEditor } = await addEditorMember(
      t,
      orgId,
      "editor-weights@acme.se"
    )

    const suggestionId = await asEditor.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId,
      moves: [
        {
          fromCriterionId: ownA,
          toCriterionId: ownB,
          points: 1,
          motivation: "Fits the company profile.",
        },
      ],
    })
    await asEditor.mutation(api.ai.suggest.confirmWeightReview, {
      orgId,
      suggestionId,
      acceptedMoveIndexes: [0],
    })

    await t.run(async (ctx) => {
      // The move landed, so the confirm did the work rather than merely
      // passing its gate.
      expect((await ctx.db.get(ownA))?.weightPoints).toBe(2)
      expect((await ctx.db.get(ownB))?.weightPoints).toBe(4)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      expect(suggestion?.requestedBy).toBe(editorId)
      expect(suggestion?.confirmedBy).toBe(editorId)
    })
  })

  it("editors dismiss both weight reviews and role-profile drafts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    const { editorId, asEditor } = await addEditorMember(
      t,
      orgId,
      "editor-role@acme.se"
    )

    // The weight review is member-level end to end now: a member who may
    // request and confirm one must be able to end the one they walked away
    // from, or the surface would strand its own suggestion.
    const modelSuggestionId = await asAdmin.mutation(
      api.ai.suggest.requestWeightReview,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveWeightReview, {
      suggestionId: modelSuggestionId,
      moves: [],
    })
    await asEditor.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId: modelSuggestionId,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(modelSuggestionId)
      expect(suggestion?.status).toBe("rejected")
      expect(suggestion?.rejectedBy).toBe(editorId)
    })

    // role.profile, the same way.
    // Insert a role.profile suggestion directly (the request/confirm path was
    // removed in Task 3; the scope behaviour under test is rejectSuggestion,
    // not the now-deleted mutation).
    const roleSuggestionId = await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId)
      if (docId === null) throw new Error("bad id")
      return ctx.db.insert("suggestions", {
        orgId,
        target: { kind: "role.profile", roleId: docId },
        suggestedValue: { profile: { purpose: "Bygger kärnprodukten." } },
        source: "ai",
        status: "suggested",
        model: { provider: "mistral", model: "mistral-small-latest" },
        requestedBy: editorId,
      })
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

  // The abandoned-generation race, and the reason a surface may dismiss a
  // still-generating row at all: the action is already on its way to the model
  // when the user walks away. Patching its outcome in unconditionally flipped
  // the dismissed row back to "suggested", and the proposal reappeared on the
  // next visit as if nothing had been dismissed.
  it("a completing generation does not resurrect a dismissed proposal", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await asAdmin.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId,
    })
    // The generation lands afterwards, exactly as the scheduled action would.
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
      truncated: false,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("rejected")
      // Not even the payload lands: a closed proposal has no review to feed.
      expect(suggestion?.suggestedValue ?? null).toBeNull()
    })
  })

  it("a failing generation does not reopen a confirmed proposal", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families: SUGGESTED_FAMILIES,
      truncated: false,
    })
    await asAdmin.mutation(api.ai.suggest.confirmStarterImport, {
      orgId,
      suggestionId,
      families: SUGGESTED_FAMILIES,
    })
    // A retry's failure path (or a late timeout) reporting in after the fact.
    await t.mutation(internal.ai.persist.markFailed, {
      suggestionId,
      errorCode: "errors.aiGenerationFailed",
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      expect(suggestion?.errorCode).toBeUndefined()
    })
  })

  it("rejectSuggestion closes a still-generating proposal", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Software Developer" }
    )
    await asAdmin.mutation(api.ai.suggest.rejectSuggestion, {
      orgId,
      suggestionId,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("rejected")
      expect(typeof suggestion?.rejectedBy).toBe("string")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionRejected")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const payload = audit[0]?.payload as {
        changes: { status: { from: string; to: string } }
      }
      // The trail records what it was dismissed FROM, so an abandoned
      // generation is distinguishable from a reviewed proposal.
      expect(payload.changes.status).toEqual({
        from: "generating",
        to: "rejected",
      })
    })
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
        truncated: false,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      t.mutation(internal.ai.persist.saveStarterImport, {
        suggestionId,
        families: [],
        truncated: false,
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
      truncated: false,
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
      truncated: false,
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
      truncated: false,
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
      truncated: false,
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

  // Moves a role.import suggestion to "suggested" so confirmRoleImport can run.
  // saveStarterImport is kind-agnostic (it only validates the shape), so it
  // serves both import kinds.
  async function suggestedRoleImport(
    t: ReturnType<typeof initConvexTest>,
    asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
    orgId: string,
    families: typeof SUGGESTED_FAMILIES
  ) {
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families,
      truncated: false,
    })
    return suggestionId
  }

  it("confirmRoleImport adds roles into an existing family without touching it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      {
        name: "Engineering",
        roles: [
          { title: "SRE", trackKey: "IC" },
          // Already present in this family: skipped, not rejected. Sent on a
          // DIFFERENT track than the stored role, so "skipped" is provably
          // distinct from "skipped but silently re-tracked".
          { title: "developer", trackKey: "M" },
        ],
      },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [
            { title: "SRE", trackKey: "IC" as const },
            { title: "developer", trackKey: "M" as const },
          ],
        },
      ],
      skippedInReview: 0,
    })
    expect(result.roleCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.familyCount).toBe(0)
    expect(result.createdRoleIds).toHaveLength(1)
    await t.run(async (ctx) => {
      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families).toHaveLength(1)
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles.map((role) => role.title).sort()).toEqual([
        "Developer",
        "SRE",
      ])
      expect(roles.every((role) => role.archivedAt === undefined)).toBe(true)
      // The skipped card must not have touched the stored role: its track is
      // still the one it was created with, not the payload's "M".
      const stored = roles.find((role) => role.title === "Developer")
      expect(stored?.trackKey).toBe("IC")
    })
  })

  // The audit row is the import's permanent summary. The review strips the
  // already-present titles out of the payload before submitting, so counting
  // only what this write skipped recorded 0 for every import that skipped
  // anything. The reviewed count travels with the payload for exactly that
  // reason, and the row records both halves.
  it("confirmRoleImport audits the reviewed skips together with its own", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [
            { title: "SRE", trackKey: "IC" as const },
            // A race: created in another tab after the review resolved.
            { title: "Developer", trackKey: "IC" as const },
          ],
        },
      ],
      // Two more the review had already filtered out.
      skippedInReview: 2,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      const payload = rows[0]?.payload as { skippedCount: number }
      expect(payload.skippedCount).toBe(3)
    })
  })

  // An over-large count is NOT refused. The seed can legitimately drop more
  // already-present roles than the import's own cap before the review even
  // opens, and the value feeds one audit statistic: throwing there would kill
  // a valid import behind a generic error with nothing on screen to correct.
  it("confirmRoleImport clamps an over-large reviewed skip count", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
      ],
      skippedInReview: MAX_ROLES + 50,
    })
    expect(result.roleCount).toBe(1)
    const rows = await t.run(async (ctx) => ctx.db.query("auditLog").collect())
    const confirmed = rows.find((row) => row.type === "ai.suggestionConfirmed")
    expect(confirmed).toBeDefined()
    const payload = confirmed?.payload as { skippedCount: number } | undefined
    expect(payload?.skippedCount).toBe(MAX_ROLES)
  })

  it("confirmRoleImport rejects a malformed reviewed skip count", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
    ])
    // A negative count is a client bug, not a large import: refused.
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId,
        families: [
          { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
        ],
        skippedInReview: -1,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("confirmRoleImport re-adds a title whose only holder is archived", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "Developer", trackKey: "IC" }] },
    ])
    // An archived role is retired and never blocks a title (the same rule
    // createRole's assert follows), so re-importing the org's list must be
    // able to bring a legitimately retired title back.
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" as const }],
        },
      ],
      skippedInReview: 0,
    })
    expect(result).toMatchObject({ roleCount: 1, skippedCount: 0 })
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(2)
      // The archived original stays archived; the import added a live one.
      expect(
        roles.filter((role) => role.archivedAt === undefined)
      ).toHaveLength(1)
      expect((await ctx.db.get(suggestionId))?.status).toBe("confirmed")
    })
  })

  it("confirmRoleImport creates a genuinely new family", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Legal Counsel", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Legal",
          roles: [{ title: "Legal Counsel", trackKey: "IC" as const }],
        },
      ],
      skippedInReview: 0,
    })
    expect(result).toMatchObject({
      familyCount: 1,
      roleCount: 1,
      skippedCount: 0,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit[0]?.payload).toMatchObject({
        kind: "role.import",
        familyCount: 1,
        roleCount: 1,
        skippedCount: 0,
      })
    })
  })

  it("confirmRoleImport rejects a new family whose name is already taken", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId,
        // No familyId: asks to CREATE "Engineering", which already exists.
        families: [
          {
            name: "Engineering",
            roles: [{ title: "SRE", trackKey: "IC" as const }],
          },
        ],
        skippedInReview: 0,
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(0)
      expect((await ctx.db.get(suggestionId))?.status).toBe("suggested")
    })
  })

  it("confirmRoleImport rejects a familyId from another org", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const other = await seedScratchOrganization(t)
    const foreignFamilyId = await other.asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId: other.orgId, name: "Engineering" }
    )
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId,
        families: [
          {
            familyId: foreignFamilyId,
            name: "Engineering",
            roles: [{ title: "SRE", trackKey: "IC" as const }],
          },
        ],
        skippedInReview: 0,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("confirmRoleImport skips a duplicate inside the payload itself", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Legal Counsel", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Legal",
          roles: [
            { title: "Legal Counsel", trackKey: "IC" as const },
            { title: "  legal counsel  ", trackKey: "Lead" as const },
          ],
        },
      ],
      skippedInReview: 0,
    })
    expect(result).toMatchObject({ roleCount: 1, skippedCount: 1 })
  })

  it("confirmRoleImport does not skip a new family's role against a family-less one", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    // A role in no family at all. Its title key is roleTitleKey(undefined,
    // "SRE"), which a shared taken-titles set would wrongly match against a
    // brand-new family's role of the same title.
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "SRE",
      function: "",
      team: "",
      trackKey: "IC",
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Platform", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Platform",
          roles: [{ title: "SRE", trackKey: "IC" as const }],
        },
      ],
      skippedInReview: 0,
    })
    expect(result).toMatchObject({
      familyCount: 1,
      roleCount: 1,
      skippedCount: 0,
    })
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(2)
      // The pre-existing role keeps its family-less state; the imported one
      // belongs to the newly created family.
      expect(roles.filter((role) => role.familyId === undefined)).toHaveLength(
        1
      )
    })
  })

  it("confirmRoleImport creates no empty family when every role is skipped", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "Developer", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" as const }],
        },
      ],
      skippedInReview: 0,
    })
    expect(result).toMatchObject({ roleCount: 0, skippedCount: 1 })
    await t.run(async (ctx) => {
      // Nothing landed, so the proposal closes as rejected like an emptied list.
      expect((await ctx.db.get(suggestionId))?.status).toBe("rejected")
    })
  })

  it("confirmRoleImport prefixes a colliding role slug with its family", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const engineering = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Manager",
      function: "",
      team: "",
      trackKey: "IC",
      familyId: engineering,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Sales", roles: [{ title: "Manager", trackKey: "M" }] },
    ])
    await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Sales",
          roles: [{ title: "Manager", trackKey: "M" as const }],
        },
      ],
      skippedInReview: 0,
    })
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const slugs = roles.map((role) => role.slug).sort()
      expect(slugs).toEqual(["manager", "sales-manager"])
    })
  })

  it("confirmRoleImport rejects a foreign or wrong-kind suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const starterId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId: starterId,
      families: SUGGESTED_FAMILIES,
      truncated: false,
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId: starterId,
        families: [
          {
            name: "Legal",
            roles: [{ title: "Counsel", trackKey: "IC" as const }],
          },
        ],
        skippedInReview: 0,
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("requestRoleImport inserts a generating row of its own kind", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleImport,
      { orgId, rawText: "Backend Engineer\nSRE" }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.source).toBe("ai")
      expect(suggestion?.target.kind).toBe("role.import")
      expect(suggestion?.model?.model).toBe(AI_MODEL_ID)
      expect(suggestion?.requestedBy).toBeTruthy()
    })
  })

  it("requestRoleImport rejects blank and oversized text", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestRoleImport, {
        orgId,
        rawText: "   \n  ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestRoleImport, {
        orgId,
        rawText: "x".repeat(20_001),
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("requestRoleImport passes the org's existing family names to the generator", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Sales",
    })
    await asAdmin.mutation(api.ai.suggest.requestRoleImport, {
      orgId,
      rawText: "SRE",
    })
    // The scheduled action carries the names, so the prompt can ask the model
    // to reuse them instead of inventing a near-duplicate family.
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const job = scheduled.find((row) =>
      row.name.includes("generateStarterImport")
    )
    const args = job?.args[0] as { existingFamilies?: string[] } | undefined
    expect(args?.existingFamilies?.slice().sort()).toEqual([
      "Engineering",
      "Sales",
    ])
  })

  it("requestStarterImport sends no existingFamilies, so the onboarding prompt is unchanged", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    // Even with a family present, the ONBOARDING import must not carry the
    // merge hint: its prompt has to stay byte-identical to what it was before
    // the in-app import existed. Adding the arg here "for symmetry" would
    // change a shipped prompt, so this asserts the key is absent entirely.
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await asAdmin.mutation(api.ai.suggest.requestStarterImport, {
      orgId,
      rawText: "SRE",
    })
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const job = scheduled.find((row) =>
      row.name.includes("generateStarterImport")
    )
    expect(job).toBeDefined()
    const args = job?.args[0] as Record<string, unknown> | undefined
    expect(args !== undefined && "existingFamilies" in args).toBe(false)
  })
})

describe("getOpenSuggestions kind filter", () => {
  it("returns only the requested kind via the kind-scoped index", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "complexity-ambiguity",
    })
    // One open import row plus several open weight reviews that would
    // otherwise compete for the same per-status cap.
    const importId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Developer" }
    )
    for (let i = 0; i < 3; i++) {
      await asAdmin.mutation(api.ai.suggest.requestWeightReview, { orgId })
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

// The weight review's enrichment (masterdokument: the reviewer must know the
// organization it advises) and its hard invariant. Structural only: these
// assert the arguments the scheduled action receives and the prompt those
// arguments assemble into. No model is ever called.
describe("requestWeightReview enrichment", () => {
  async function scheduledReviewArgs(t: ReturnType<typeof initConvexTest>) {
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const job = scheduled.find((row) => row.name.includes("reviewWeights"))
    expect(job).toBeDefined()
    return job?.args[0] as Record<string, unknown>
  }

  it("sends the role landscape aggregated per family, with counts and sample titles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRoleOrganization(t)
    const track = model.tracks[0]
    if (track === undefined) throw new Error("seed")
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    for (const title of ["Backend Developer", "Platform Engineer"]) {
      await asAdmin.mutation(api.assessment.roles.createRole, {
        orgId,
        title,
        function: "Engineering",
        team: "Core",
        trackKey: track.key,
        familyId,
      })
    }
    await asAdmin.mutation(api.ai.suggest.requestWeightReview, { orgId })

    const args = await scheduledReviewArgs(t)
    const families = args.families as {
      name: string
      roleCount: number
      sampleTitles: string[]
    }[]
    const engineering = families.find((f) => f.name === "Engineering")
    expect(engineering?.roleCount).toBe(2)
    expect(engineering?.sampleTitles.slice().sort()).toEqual([
      "Backend Developer",
      "Platform Engineer",
    ])
    // The seeded role has no family, so its count is still visible in an
    // unnamed bucket rather than being invented into a family.
    const ungrouped = families.find((f) => f.name === "")
    expect(ungrouped?.roleCount).toBe(1)
  })

  it("leaves an archived role out of the landscape", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })
    await asAdmin.mutation(api.ai.suggest.requestWeightReview, { orgId })
    const args = await scheduledReviewArgs(t)
    const families = args.families as { roleCount: number }[]
    const total = families.reduce((sum, f) => sum + f.roleCount, 0)
    expect(total).toBe(0)
  })

  it("sends the org's own weight motivations and materiality decision", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRoleOrganization(t)
    const criterion = model.criteria[0]
    if (criterion === undefined) throw new Error("seed")
    await asAdmin.mutation(
      api.evaluationModel.criteria.setCriterionWeightMotivation,
      {
        orgId,
        criterionId: criterion.criterionId,
        motivation: "Specialist depth is what this business sells.",
      }
    )
    await asAdmin.mutation(
      api.evaluationModel.approval.setWorkingConditionsDecision,
      {
        orgId,
        status: "testedNotMaterial",
        motivation: "Tested this year; no role carries special conditions.",
      }
    )
    await asAdmin.mutation(api.ai.suggest.requestWeightReview, { orgId })

    const args = await scheduledReviewArgs(t)
    const criteria = args.criteria as { motivation?: string }[]
    expect(
      criteria.some(
        (c) => c.motivation === "Specialist depth is what this business sells."
      )
    ).toBe(true)
    expect(args.workingConditions).toEqual({
      status: "testedNotMaterial",
      motivation: "Tested this year; no role carries special conditions.",
    })
  })

  // THE INVARIANT. The review advises the METHOD; it must never see where a
  // role landed under it. This drives a real assessment first, so the org
  // genuinely HAS outcomes at the moment the prompt is assembled.
  it("sends no outcome of any kind, even when the org has results", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, roleId, model } = await seedRoleOrganization(t)
    // Rating needs the job profile's mandatory core; this test is about the
    // prompt, not about the profile gate.
    await t.run(async (ctx) => {
      await ctx.db.patch(roleId, {
        purpose: "Builds and runs the platform.",
        responsibilities: "Design, build, operate.",
      })
    })
    for (const criterion of model.criteria) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId,
        value: 3,
      })
    }
    await asAdmin.mutation(api.assessment.locking.lockAssessment, {
      orgId,
      roleId,
    })
    // The org now has a real, locked, revealed result.
    const results = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
    })
    expect(results.rows.some((row) => row.level !== null)).toBe(true)

    await asAdmin.mutation(api.ai.suggest.requestWeightReview, { orgId })
    const args = await scheduledReviewArgs(t)
    // Nothing the guard forbids may appear anywhere in the scheduled payload,
    // at any depth. Asserted through the guard itself, so the test and the
    // production check can never disagree about what "an outcome" means.
    expect(() => assertPromptDataSafe(args, "test")).not.toThrow()
    const serialized = JSON.stringify(args)
    for (const key of ["score", "level", "zone", "assessment", "rating"]) {
      expect(serialized).not.toContain(`"${key}":`)
    }
  })
})
