import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { STANDARD_TEMPLATE_KEY } from "./standardTemplate"

async function seedReadyOrganization(t: ReturnType<typeof initConvexTest>) {
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
  return { orgId, asAdmin: t.withIdentity({ subject: userId }) }
}

describe("createModelFromTemplate", () => {
  it("seeds the full standard template in one transaction and audits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)

    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createModelFromTemplate,
      { orgId }
    )
    expect(modelId).toBeDefined()

    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(9)
      expect(criteria.every((c) => c.isCustom === false)).toBe(true)

      // Anchors live on the criterion document (ADR-0006): exactly 6 per
      // criterion, ordered by level.
      let anchorCount = 0
      for (const criterion of criteria) {
        expect(criterion.anchors.map((a) => a.level)).toEqual([
          0, 1, 2, 3, 4, 5,
        ])
        anchorCount += criterion.anchors.length
      }
      expect(anchorCount).toBe(54)

      // Thresholds live on the model document (ADR-0006).
      const model = await ctx.db.get(modelId)
      expect(model?.bandThresholds).toHaveLength(7)
      expect(
        model?.bandThresholds.find((threshold) => threshold.band === 1)
          ?.minScore
      ).toBe(98)

      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("rejects a second model with errors.modelExists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
        orgId,
      })
    ).rejects.toThrow(/errors.modelExists/)
  })

  it("rejects editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@acme.se", name: "Editor Person", role: "editor" }
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.evaluationModel.model.createModelFromTemplate, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("uses English content when organization language is en", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@en-acme.se", name: "HR Person EN", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "en",
        employeeCount: 25,
        industry: "itTelecom",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result?.name).toBe("Standard model")
  })
})

describe("createEmptyModel", () => {
  it("rejects blank names and trims the stored name", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
        orgId,
        name: "   ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createEmptyModel,
      { orgId, name: "  Vår modell  " }
    )
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?._id).toEqual(modelId)
      expect(model?.name).toBe("Vår modell")
    })
  })

  it("creates a model with default thresholds but no criteria", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createEmptyModel,
      { orgId, name: "Vår modell" }
    )
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(model?.templateKey).toBeUndefined()
      expect(model?.bandThresholds).toHaveLength(7)
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(criteria).toHaveLength(0)
    })
  })
})

describe("discardModel", () => {
  it("deletes every model-scoped row and the model.* suggestions and audits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createModelFromTemplate,
      { orgId }
    )

    // Seed one model.draft and one model.weightReview suggestion that must
    // be deleted, plus an unrelated suggestion kind that must survive.
    await t.run(async (ctx) => {
      await ctx.db.insert("suggestions", {
        orgId,
        target: { kind: "model.draft", modelId },
        suggestedValue: {},
        source: "ai",
        status: "suggested",
      })
      await ctx.db.insert("suggestions", {
        orgId,
        target: { kind: "model.weightReview", modelId },
        suggestedValue: {},
        source: "ai",
        status: "suggested",
      })
      await ctx.db.insert("suggestions", {
        orgId,
        target: { kind: "criterion.anchor" },
        suggestedValue: {},
        source: "ai",
        status: "suggested",
      })
    })

    await asAdmin.mutation(api.evaluationModel.model.discardModel, { orgId })

    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("models")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query("criteria")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
      // Anchors and thresholds ride along on their deleted parent documents;
      // tracks are constants (ADR-0006): nothing else to scan.

      // Only the model.* suggestions are gone; the unrelated one survives.
      const suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]?.target.kind).toBe("criterion.anchor")

      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.discarded")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload.templateKey).toBe(STANDARD_TEMPLATE_KEY)
    })
  })

  it("is idempotent on an org with no model", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.model.discardModel, { orgId })
    ).resolves.toBeNull()
  })

  it("rejects with errors.invalidInput after onboarding has completed", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    await asAdmin.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.model.discardModel, { orgId })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects with errors.invalidInput when a role exists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    // Insert a minimal role so the role guard trips.
    await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId,
        title: "Junior Developer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
        purpose: "",
        responsibilities: "",
      })
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.model.discardModel, { orgId })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@discard.se", name: "Editor Person", role: "editor" }
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.evaluationModel.model.discardModel, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})

describe("getModel", () => {
  it("returns null before any model exists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).toBeNull()
  })

  it("returns the full model with importance levels and never weights", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).not.toBeNull()
    expect(result?.criteria).toHaveLength(9)
    expect(result?.criteria[0]?.anchors).toHaveLength(6)
    const weightPoints = result?.criteria.map(
      (criterion) => criterion.weightPoints
    )
    expect(weightPoints?.every((points) => points >= 1 && points <= 5)).toBe(
      true
    )
    // The template ships exactly balanced: 9 criteria, point budget 27.
    expect(weightPoints?.reduce((sum, points) => sum + points, 0)).toBe(27)
  })

  it("localizes pristine template content to the requested locale", async () => {
    // The organization is seeded in Swedish, so the stored rows are Swedish.
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })

    const en = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "en",
    })
    expect(en?.name).toBe("Standard model")
    expect(en?.criteria[0]?.name).toBe("Scope & Impact")
    expect(en?.criteria[0]?.anchors[0]?.text).toMatch(/Responsible for own/)
    const enIc = en?.tracks.find((track) => track.key === "IC")
    expect(enIc?.name).toBe("Individual Contributor")

    // The same stored rows render in Swedish under the sv locale.
    const sv = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "sv",
    })
    expect(sv?.name).toBe("Standardmodell")
    expect(sv?.criteria[0]?.name).toBe("Scope & Påverkan")
    expect(sv?.criteria[0]?.anchors[0]?.text).toMatch(/Ansvar för egna/)
  })

  it("localizes a supported template locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "fi",
    })
    expect(result?.name).toBe("Vakiomalli")
    expect(result?.criteria[0]?.name).toBe("Laajuus ja vaikutus")
  })

  it("falls back to English for an unsupported locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "de",
    })
    expect(result?.name).toBe("Standard model")
    expect(result?.criteria[0]?.name).toBe("Scope & Impact")
  })

  it("keeps a custom criterion's stored name under any locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    await asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
      orgId,
      name: "Custom criterion",
      description: "Stored description",
      helpText: "Stored help",
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    })
    const en = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "en",
    })
    const custom = en?.criteria.find((c) => c.isCustom)
    expect(custom?.name).toBe("Custom criterion")
    expect(custom?.description).toBe("Stored description")
    expect(custom?.anchors[0]?.text).toBe("a0")
    const sv = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "sv",
    })
    expect(sv?.criteria.find((c) => c.isCustom)?.name).toBe("Custom criterion")
  })

  it("localizes track names for a scratch model too", async () => {
    // A scratch model keeps its user-chosen name but the fixed tracks
    // localize by their stable keys.
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
      orgId,
      name: "Vår modell",
    })
    const en = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "en",
    })
    // The user-chosen name is not localized.
    expect(en?.name).toBe("Vår modell")
    expect(en?.tracks.find((track) => track.key === "M")?.name).toBe("Manager")
  })
})

describe("evaluationModel/model.seedStandardModel", () => {
  it("creates one standard model with nine criteria and is idempotent", async () => {
    const t = initConvexTest()
    const orgId = "org_seed_model"

    const modelId = await t.mutation(
      internal.evaluationModel.model.seedStandardModel,
      { orgId, locale: "sv" }
    )
    expect(modelId).not.toBeNull()

    await t.run(async (ctx) => {
      const models = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(models).toHaveLength(1)
      expect(models[0]?.templateKey).toBe(STANDARD_TEMPLATE_KEY)
      expect(models[0]?.bandThresholds).toHaveLength(7)

      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(9)
      // Point budget is exactly criteria count x 3 (ADR-0004).
      expect(criteria.reduce((sum, c) => sum + c.weightPoints, 0)).toBe(27)
      // Anchors are mapped to { level, text } objects, not raw strings.
      for (const criterion of criteria) {
        expect(criterion.anchors.length).toBeGreaterThan(0)
        expect(criterion.anchors[0]).toHaveProperty("level")
        expect(criterion.anchors[0]).toHaveProperty("text")
        expect(criterion.isCustom).toBe(false)
      }
    })

    // Re-run is a no-op: returns null and does not duplicate the model/criteria.
    const second = await t.mutation(
      internal.evaluationModel.model.seedStandardModel,
      { orgId, locale: "sv" }
    )
    expect(second).toBeNull()
    await t.run(async (ctx) => {
      const models = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(models).toHaveLength(1)
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(9)
    })
  })

  it("falls back to English content for an unsupported locale", async () => {
    const t = initConvexTest()
    await t.mutation(internal.evaluationModel.model.seedStandardModel, {
      orgId: "org_seed_xx",
      locale: "xx",
    })
    await t.mutation(internal.evaluationModel.model.seedStandardModel, {
      orgId: "org_seed_en",
      locale: "en",
    })
    await t.run(async (ctx) => {
      const criterionNames = async (orgId: string) =>
        (
          await ctx.db
            .query("criteria")
            .withIndex("by_org", (q) => q.eq("orgId", orgId))
            .collect()
        )
          .sort((a, b) => a.order - b.order)
          .map((criterion) => criterion.name)
      const unsupported = await criterionNames("org_seed_xx")
      const english = await criterionNames("org_seed_en")
      expect(unsupported).toHaveLength(9)
      // clampLocale("xx") resolves to "en", so the content matches the en seed.
      expect(unsupported).toEqual(english)
    })
  })
})
