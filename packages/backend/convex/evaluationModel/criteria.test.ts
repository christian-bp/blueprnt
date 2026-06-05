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

describe("criterion editor", () => {
  it("adds a criterion with six anchors and increments order", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Komplexitet",
        description: "Hur svåra problem rollen hanterar.",
        helpText: "Bedöm mot ankartexterna.",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "Rollens omfång.",
        helpText: "Bedöm mot ankartexterna.",
        importanceLevel: 7,
        anchors: VALID_ANCHORS,
      }
    )
    await t.run(async (ctx) => {
      const a = (await ctx.db.get(first)) as Doc<"criteria"> | null
      const b = (await ctx.db.get(second)) as Doc<"criteria"> | null
      expect(a?.order).toBe(1)
      expect(b?.order).toBe(2)
      expect(a?.isCustom).toBe(true)
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", first))
        .collect()
      expect(anchors).toHaveLength(6)
    })
  })

  it("rejects an importance outside the fixed scale and wrong anchor counts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
        orgId,
        name: "X",
        description: "d",
        helpText: "h",
        importanceLevel: 8,
        anchors: VALID_ANCHORS,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
        orgId,
        name: "X",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: ["only", "five", "anchor", "texts", "here"],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("removes a criterion together with its anchors", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Tillfällig",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors: VALID_ANCHORS,
      }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(criterionId)).toBeNull()
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", criterionId))
        .collect()
      expect(anchors).toHaveLength(0)
    })
  })

  it("order stays unique after add/remove/add (no collision)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "First",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors: VALID_ANCHORS,
      }
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Second",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors: VALID_ANCHORS,
      }
    )
    // Remove the first criterion; survivor has order 2.
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId: first,
    })
    // Add a third; must get order 3, not 2 (which length-based logic would return).
    const third = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Third",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors: VALID_ANCHORS,
      }
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

  it("patches importanceLevel and writes an audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    await asAdmin.mutation(
      api.evaluationModel.criteria.updateCriterionImportance,
      {
        orgId,
        criterionId,
        importanceLevel: 7,
      }
    )
    await t.run(async (ctx) => {
      const criterion = await ctx.db.get(criterionId)
      expect(criterion?.importanceLevel).toBe(7)
      const auditRows = await ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("type"), "model.updated"))
        .collect()
      const importanceRow = auditRows.find(
        (r) =>
          (r.payload as Record<string, unknown>).change ===
          "criterion.importanceChanged"
      )
      expect(importanceRow).toBeDefined()
      expect(
        (importanceRow?.payload as Record<string, unknown>).importanceLevel
      ).toBe(7)
    })
  })

  it("no-ops (no audit row) when importanceLevel is already the same value", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    // First audit row comes from addCriterion; clear baseline.
    await asAdmin.mutation(
      api.evaluationModel.criteria.updateCriterionImportance,
      {
        orgId,
        criterionId,
        importanceLevel: 5, // same as the stored value
      }
    )
    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("type"), "model.updated"))
        .collect()
      const importanceRows = auditRows.filter(
        (r) =>
          (r.payload as Record<string, unknown>).change ===
          "criterion.importanceChanged"
      )
      expect(importanceRows).toHaveLength(0)
    })
  })

  it("rejects importanceLevel 8 with errors.invalidInput", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.updateCriterionImportance, {
        orgId,
        criterionId,
        importanceLevel: 8,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects a criterion belonging to another org with errors.notFound", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedScratchModel(t)
    const { orgId: orgB, asAdmin: asAdminB } = await seedScratchModel(t)
    // Add a criterion in org A.
    const criterionId = await asAdminA.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId: orgA,
        name: "Scope",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    // Org B admin tries to update org A's criterion.
    await expect(
      asAdminB.mutation(
        api.evaluationModel.criteria.updateCriterionImportance,
        {
          orgId: orgB,
          criterionId,
          importanceLevel: 3,
        }
      )
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects same-org editors with errors.adminRequired for updateCriterionImportance", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
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
        .mutation(api.evaluationModel.criteria.updateCriterionImportance, {
          orgId,
          criterionId,
          importanceLevel: 3,
        })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects same-org editors with errors.adminRequired", async () => {
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
        .mutation(api.evaluationModel.criteria.addCriterion, {
          orgId,
          name: "X",
          description: "d",
          helpText: "h",
          importanceLevel: 3,
          anchors: VALID_ANCHORS,
        })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})
