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
      // Bulk items: one per moved criterion, with label + weightPoints from/to.
      expect(payload.budget).toBe(6)
      expect(payload.count).toBe(2)
      expect(payload.items).toContainEqual({
        criterionId: a,
        label: "A",
        changes: { weightPoints: { from: 3, to: 4 } },
      })
      expect(payload.items).toContainEqual({
        criterionId: b,
        label: "B",
        changes: { weightPoints: { from: 3, to: 2 } },
      })
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
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
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
      expect(shifts.map((row) => row.payload)).toContainEqual(
        expect.objectContaining({
          roleId,
          changes: expect.objectContaining({ band: { from: 4, to: 5 } }),
        })
      )
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
      expect(shifts.map((row) => row.payload)).toContainEqual(
        expect.objectContaining({
          roleId,
          changes: expect.objectContaining({ band: { from: 5, to: 4 } }),
        })
      )
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
      const removalPayload = removal?.payload as {
        count: number
        items: Array<{
          criterionId: string
          label: string
          changes: { weightPoints: { from: number; to: number } }
        }>
      }
      // Survivor bulk items: repaired weightPoints from/to, in repair order.
      expect(removalPayload.count).toBe(2)
      expect(
        removalPayload.items.map((item) => ({
          criterionId: item.criterionId,
          weightPoints: item.changes.weightPoints,
        }))
      ).toEqual([
        {
          criterionId: financial.criterionId,
          weightPoints: { from: 2, to: 3 },
        },
        { criterionId: formal.criterionId, weightPoints: { from: 1, to: 2 } },
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
      expect(shifts.map((row) => row.payload)).toContainEqual(
        expect.objectContaining({
          roleId,
          changes: expect.objectContaining({ band: { from: 1, to: null } }),
        })
      )
    })
  })
})

describe("updateCriterion", () => {
  async function seedTemplateModel(t: ReturnType<typeof initConvexTest>) {
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr-edit@acme.se", name: "HR Person", role: "admin" }
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
      locale: "sv",
    })
    if (model === null) throw new Error("model not seeded")
    return { orgId, asAdmin, model }
  }

  it("edits the texts, materializes the template row, and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateModel(t)
    const target = model.criteria[0]
    if (target === undefined) throw new Error("no criteria")

    await asAdmin.mutation(api.evaluationModel.criteria.updateCriterion, {
      orgId,
      criterionId: target.criterionId,
      name: "  Anpassad komplexitet  ",
      description: "Vår egen beskrivning.",
      helpText: "Vår egen hjälptext.",
      anchors: VALID_ANCHORS,
    })

    await t.run(async (ctx) => {
      const row = (await ctx.db.get(
        target.criterionId
      )) as Doc<"criteria"> | null
      // Stored trimmed, anchors rebuilt positionally, template link cleared.
      expect(row?.name).toBe("Anpassad komplexitet")
      expect(row?.templateKey).toBeUndefined()
      expect(row?.anchors.map((anchor) => anchor.text)).toEqual(VALID_ANCHORS)
      const audits = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      expect(
        audits.filter(
          (row) =>
            (row.payload as { change?: string }).change === "criterion.updated"
        )
      ).toHaveLength(1)
    })

    // The edited row now renders as stored in EVERY locale, while untouched
    // template rows keep localizing (read-time localization, localize.ts).
    const finnish = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "fi",
    })
    const editedRow = finnish?.criteria.find(
      (criterion) => criterion.criterionId === target.criterionId
    )
    expect(editedRow?.name).toBe("Anpassad komplexitet")
    // An untouched template row still localizes: its Finnish name differs
    // from the Swedish one the model was seeded with.
    const untouchedSv = model.criteria.find(
      (criterion) => criterion.criterionId !== target.criterionId
    )
    const untouchedFi = finnish?.criteria.find(
      (criterion) => criterion.criterionId === untouchedSv?.criterionId
    )
    expect(untouchedFi?.name).toBeDefined()
    expect(untouchedFi?.name).not.toBe(untouchedSv?.name)
  })

  it("rejects a blank name and a wrong anchor count", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateModel(t)
    const target = model.criteria[0]
    if (target === undefined) throw new Error("no criteria")
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.updateCriterion, {
        orgId,
        criterionId: target.criterionId,
        name: "   ",
        description: "d",
        helpText: "h",
        anchors: VALID_ANCHORS,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.updateCriterion, {
        orgId,
        criterionId: target.criterionId,
        name: "Ok",
        description: "d",
        helpText: "h",
        anchors: VALID_ANCHORS.slice(0, 5),
      })
    ).rejects.toThrow(/errors.invalidInput/)
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
  async function latestModelUpdated(
    t: ReturnType<typeof initConvexTest>,
    orgId: string,
    change: string
  ) {
    return await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.updated")
        )
        .collect()
      const matching = rows.filter(
        (row) => (row.payload as Record<string, unknown>).change === change
      )
      return matching[matching.length - 1]?.payload as
        | Record<string, unknown>
        | undefined
    })
  }

  it("criterion.added records full create-changes incl. anchors and weightPoints", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "  Komplexitet  ",
        description: "Hur svåra problem rollen hanterar.",
        helpText: "Bedöm mot ankartexterna.",
        anchors: VALID_ANCHORS,
      }
    )
    const payload = await latestModelUpdated(t, orgId, "criterion.added")
    expect(payload?.criterionId).toBe(criterionId)
    expect(payload?.modelId).toBeDefined()
    const changes = payload?.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    expect(changes.name).toEqual({ from: null, to: "Komplexitet" })
    expect(changes.description).toEqual({
      from: null,
      to: "Hur svåra problem rollen hanterar.",
    })
    expect(changes.helpText).toEqual({
      from: null,
      to: "Bedöm mot ankartexterna.",
    })
    expect(changes.weightPoints).toEqual({ from: null, to: 3 })
    expect(changes.order).toEqual({ from: null, to: 1 })
    expect(changes.isCustom).toEqual({ from: null, to: true })
    // The anchors array is captured level-ordered with from:null.
    expect(changes.anchors).toEqual({
      from: null,
      to: VALID_ANCHORS.map((text, level) => ({ level, text })),
    })
  })

  it("criterion.updated records only changed text fields and clears templateKey", async () => {
    const t = initConvexTest()
    // A template-seeded criterion: editing one text field detaches the key.
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr-upd@acme.se", name: "HR", role: "admin" }
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
      locale: "sv",
    })
    const target = model?.criteria[0]
    if (target === undefined) throw new Error("seed")
    // Read the stored anchors so we can edit the name only, keeping anchors
    // unchanged (anchorDiff should NOT emit an entry then).
    const storedAnchors = await t.run(async (ctx) => {
      const row = (await ctx.db.get(target.criterionId)) as Doc<"criteria">
      return [...row.anchors]
        .sort((a, b) => a.level - b.level)
        .map((anchor) => anchor.text)
    })

    await asAdmin.mutation(api.evaluationModel.criteria.updateCriterion, {
      orgId,
      criterionId: target.criterionId,
      name: "Anpassad",
      description: target.description,
      helpText: target.helpText,
      anchors: storedAnchors,
    })
    const payload = await latestModelUpdated(t, orgId, "criterion.updated")
    const changes = payload?.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    // Only the name moved; description/helpText unchanged -> omitted.
    expect(changes.name).toEqual({ from: target.name, to: "Anpassad" })
    expect(changes.description).toBeUndefined()
    expect(changes.helpText).toBeUndefined()
    // templateKey was set on the template row and is cleared -> key -> null.
    expect(changes.templateKey).toEqual({
      from: "scope",
      to: null,
    })
    // Anchors did not change -> no anchors entry.
    expect(changes.anchors).toBeUndefined()
  })

  it("criterion.updated records an anchors entry only when the texts differ", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Custom")
    )
    const changedAnchors = ["b0", "b1", "b2", "b3", "b4", "b5"]
    await asAdmin.mutation(api.evaluationModel.criteria.updateCriterion, {
      orgId,
      criterionId,
      name: "Custom",
      description: "d",
      helpText: "h",
      anchors: changedAnchors,
    })
    const payload = await latestModelUpdated(t, orgId, "criterion.updated")
    const changes = payload?.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    // Name/description/helpText unchanged -> omitted; only anchors moved.
    expect(changes.name).toBeUndefined()
    expect(changes.anchors).toEqual({
      from: VALID_ANCHORS.map((text, level) => ({ level, text })),
      to: changedAnchors.map((text, level) => ({ level, text })),
    })
  })

  it("weights.rebalanced records bulk items, budget, and count", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const a = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Alpha")
    )
    const b = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      addArgs(orgId, "Beta")
    )
    await asAdmin.mutation(api.evaluationModel.criteria.rebalanceWeights, {
      orgId,
      allocations: [
        { criterionId: a, weightPoints: 5 },
        { criterionId: b, weightPoints: 1 },
      ],
    })
    const payload = await latestModelUpdated(t, orgId, "weights.rebalanced")
    expect(payload?.budget).toBe(6)
    expect(payload?.count).toBe(2)
    const items = payload?.items as Array<{
      criterionId: string
      label: string
      changes: { weightPoints: { from: number; to: number } }
    }>
    expect(items).toContainEqual({
      criterionId: a,
      label: "Alpha",
      changes: { weightPoints: { from: 3, to: 5 } },
    })
    expect(items).toContainEqual({
      criterionId: b,
      label: "Beta",
      changes: { weightPoints: { from: 3, to: 1 } },
    })
  })

  it("criterion.removed records delete-changes, budget, survivors, and counts ratings only", async () => {
    const t = initConvexTest()
    // A rated template org so the removed criterion has ratings; assert the
    // count is captured but no rating value leaks.
    const { orgId, asAdmin, model } = await seedRatedTemplateOrganization(
      t,
      (index) => (index === 0 ? 4 : 3)
    )
    const scope = model.criteria[0]
    if (scope === undefined) throw new Error("seed")
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: scope.criterionId,
    })
    const payload = await latestModelUpdated(t, orgId, "criterion.removed")
    expect(payload?.modelId).toBeDefined()
    // One role was rated on the removed criterion: count present, value absent.
    expect(payload?.deletedRatingCount).toBe(1)
    // Budget shrinks from 9*3 to 8*3.
    expect(payload?.budget).toEqual({ from: 27, to: 24 })
    // Delete-snapshot: every field collapses to:null.
    const changes = payload?.changes as Record<
      string,
      { from: unknown; to: unknown }
    >
    for (const field of [
      "name",
      "description",
      "helpText",
      "anchors",
      "weightPoints",
      "order",
      "isCustom",
      "templateKey",
    ]) {
      expect(changes[field]).toBeDefined()
      expect(changes[field]?.to).toBeNull()
    }
    // Survivor bulk items repaired onto the shrunken budget.
    const items = payload?.items as Array<{
      criterionId: string
      label: string
      changes: { weightPoints: { from: number; to: number } }
    }>
    expect(payload?.count).toBe(items.length)
    for (const item of items) {
      expect(item.label).toBeDefined()
      expect(item.changes.weightPoints.from).toBeTypeOf("number")
      expect(item.changes.weightPoints.to).toBeTypeOf("number")
    }
    // Ratings are count-only: no rating value/notes keys anywhere in the
    // payload. A bare number cannot be distinguished from a weight/order, so
    // assert structurally that no rating-shaped keys leaked.
    expect(allKeys(payload)).not.toContain("value")
    expect(allKeys(payload)).not.toContain("motivation")
    expect(allKeys(payload)).not.toContain("notes")
  })

  it("threads cause.event = model.updated + criterionId onto add/remove band shifts", async () => {
    const t = initConvexTest()
    // Seeding the ratings produces rating.change-caused band shifts; the
    // criterion mutations below add model.updated-caused ones. We only assert
    // about the model.updated shifts.
    const { orgId, asAdmin, roleId } = await seedRatedTemplateOrganization(
      t,
      (index) => (index === 0 ? 5 : 3)
    )
    // addCriterion flips the role to incomplete -> band.shift with cause.
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "Collaboration",
      description: "d",
      helpText: "h",
      anchors: VALID_ANCHORS,
    })
    await t.run(async (ctx) => {
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      const modelShifts = shifts.filter(
        (shift) =>
          (shift.payload as { cause?: { event?: string } }).cause?.event ===
          "model.updated"
      )
      expect(modelShifts.length).toBeGreaterThan(0)
      // The add path threads the new criterionId on the cause.
      expect(
        modelShifts.some(
          (shift) =>
            (shift.payload as { cause?: { criterionId?: string } }).cause
              ?.criterionId !== undefined &&
            (shift.payload as { roleId?: string }).roleId === roleId
        )
      ).toBe(true)
    })
  })

  it("threads cause.entityId = modelId for weights.rebalanced band shifts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedRatedTemplateOrganization(
      t,
      (index) => (index === 0 ? 5 : 3)
    )
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
