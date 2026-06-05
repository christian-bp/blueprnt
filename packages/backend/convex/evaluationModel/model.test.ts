import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
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

      let anchorCount = 0
      for (const criterion of criteria) {
        const anchors = await ctx.db
          .query("criterionAnchors")
          .withIndex("by_criterion", (q) => q.eq("criterionId", criterion._id))
          .collect()
        expect(anchors.map((a) => a.level).sort()).toEqual([0, 1, 2, 3, 4, 5])
        anchorCount += anchors.length
      }
      expect(anchorCount).toBe(54)

      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(tracks.map((track) => track.key).sort()).toEqual([
        "IC",
        "Lead",
        "M",
      ])

      let levelCount = 0
      for (const track of tracks) {
        levelCount += (
          await ctx.db
            .query("levels")
            .withIndex("by_track", (q) => q.eq("trackId", track._id))
            .collect()
        ).length
      }
      expect(levelCount).toBe(11)

      const thresholds = await ctx.db
        .query("bandThresholds")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(thresholds).toHaveLength(7)
      expect(
        thresholds.find((threshold) => threshold.band === 1)?.minScore
      ).toBe(530)

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

  it("creates a model with fixed tracks and thresholds but no criteria", async () => {
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
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(criteria).toHaveLength(0)
      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(tracks).toHaveLength(3)
      const thresholds = await ctx.db
        .query("bandThresholds")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(thresholds).toHaveLength(7)
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

    // Seed one model.draft and one model.importanceReview suggestion that must
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
        target: { kind: "model.importanceReview", modelId },
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
      // tracks, bandThresholds, levels, anchors, and guardrails are only
      // indexed by_model/by_track/by_criterion/by_level; the org is otherwise
      // fresh, so a full scan confirms none survive.
      expect(await ctx.db.query("tracks").collect()).toHaveLength(0)
      expect(await ctx.db.query("bandThresholds").collect()).toHaveLength(0)
      expect(await ctx.db.query("levels").collect()).toHaveLength(0)
      expect(await ctx.db.query("criterionAnchors").collect()).toHaveLength(0)
      expect(await ctx.db.query("trackGuardrails").collect()).toHaveLength(0)

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
    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createModelFromTemplate,
      { orgId }
    )
    // Insert a minimal role wired to the seeded model's first track/level so
    // the referential-integrity guard trips.
    await t.run(async (ctx) => {
      const track = await ctx.db
        .query("tracks")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .first()
      if (track === null) throw new Error("no track seeded")
      const level = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", track._id))
        .first()
      if (level === null) throw new Error("no level seeded")
      await ctx.db.insert("roles", {
        orgId,
        title: "Junior Developer",
        function: "Engineering",
        team: "Platform",
        trackId: track._id,
        levelId: level._id,
        purpose: "",
        responsibilities: "",
        status: "draft",
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
    expect(JSON.stringify(result)).not.toMatch(/"weight"/)
    const importanceLevels = result?.criteria.map(
      (criterion) => criterion.importanceLevel
    )
    expect(importanceLevels?.every((level) => level >= 1 && level <= 7)).toBe(
      true
    )
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
    expect(enIc?.levels[0]?.name).toBe("IC1")

    // The same stored rows render in Swedish under the sv locale.
    const sv = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "sv",
    })
    expect(sv?.name).toBe("Standardmodell")
    expect(sv?.criteria[0]?.name).toBe("Scope & Påverkan")
    expect(sv?.criteria[0]?.anchors[0]?.text).toMatch(/Ansvar för egna/)
  })

  it("falls back to English for an unsupported locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "fi",
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
      importanceLevel: 4,
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

  it("localizes track and level names for a scratch model too", async () => {
    // A scratch model keeps its user-chosen name but its fixed tracks/levels
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
