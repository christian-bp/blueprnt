import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

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

describe("createDefaultModel", () => {
  it("creates an empty model with default level/zone rules and audits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)

    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createDefaultModel,
      { orgId }
    )
    expect(modelId).toBeDefined()

    await t.run(async (ctx) => {
      const model = await ctx.db.get(modelId)
      expect(model?.name).toBe("Rollvärderingsmodell") // sv library content
      expect(model?.levelRules).toHaveLength(12)
      expect(model?.levelRules.find((r) => r.level === 1)?.minScore).toBe(97)
      expect(model?.levelRules.find((r) => r.level === 12)?.minScore).toBe(0)
      expect(model?.zoneProfileRules).toEqual([
        { zone: "A", minStep: 4 },
        { zone: "B", minStep: 3 },
      ])
      expect(model?.approval).toBeUndefined()
      expect(model?.workingConditions).toBeUndefined()

      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(criteria).toHaveLength(0)

      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const payload = audit[0]?.payload as {
        source: string
        name: string
        count: number
        items: unknown[]
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.source).toBe("default")
      expect(payload.count).toBe(0)
      expect(payload.items).toEqual([])
      expect(payload.changes.name).toEqual({
        from: null,
        to: "Rollvärderingsmodell",
      })
      expect(payload.changes.levelRules.from).toBeNull()
    })
  })

  it("rejects a second model with errors.modelExists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
      orgId,
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
        orgId,
      })
    ).rejects.toThrow(/errors.modelExists/)
  })

  // Creating the org's model is member-level work: admin covers org
  // administration and the audit log, not the model.
  it("accepts an editor", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@acme.se", name: "Editor Person", role: "editor" }
    )
    const modelId = await t
      .withIdentity({ subject: userId })
      .mutation(api.evaluationModel.model.createDefaultModel, { orgId })
    expect(modelId).toBeDefined()
  })

  it("uses English library content when organization language is en", async () => {
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
    await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result?.name).toBe("Role evaluation model")
  })
})

describe("evaluationModel/model.seedDefaultModel", () => {
  const SEED_ACTOR_ID = "ba_user_founder"

  it("creates one model with zero criteria and is idempotent", async () => {
    const t = initConvexTest()
    const orgId = "org_seed_model"

    const modelId = await t.mutation(
      internal.evaluationModel.model.seedDefaultModel,
      { orgId, locale: "sv", actorId: SEED_ACTOR_ID }
    )
    expect(modelId).not.toBeNull()

    await t.run(async (ctx) => {
      const models = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(models).toHaveLength(1)
      expect(models[0]?.name).toBe("Rollvärderingsmodell")
      expect(models[0]?.levelRules).toHaveLength(12)

      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(0)
    })

    // Re-run is a no-op: returns null and does not duplicate the model.
    const second = await t.mutation(
      internal.evaluationModel.model.seedDefaultModel,
      { orgId, locale: "sv", actorId: SEED_ACTOR_ID }
    )
    expect(second).toBeNull()
    await t.run(async (ctx) => {
      const models = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(models).toHaveLength(1)
    })
  })

  it("falls back to English content for an unsupported locale", async () => {
    const t = initConvexTest()
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId: "org_seed_xx",
      locale: "xx",
      actorId: SEED_ACTOR_ID,
    })
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", "org_seed_xx"))
        .unique()
      // clampLocale("xx") resolves to "en".
      expect(model?.name).toBe("Role evaluation model")
    })
  })

  it("audits model.created with seeded:true and the clamped locale", async () => {
    const t = initConvexTest()
    await t.mutation(internal.evaluationModel.model.seedDefaultModel, {
      orgId: "org_seed_payload",
      locale: "xx",
      actorId: SEED_ACTOR_ID,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "org_seed_payload").eq("type", "model.created")
        )
        .collect()
      const payload = rows[0]?.payload as {
        source: string
        seeded?: boolean
        locale?: string
        count: number
        items: unknown[]
      }
      expect(payload.source).toBe("default")
      expect(payload.seeded).toBe(true)
      expect(payload.locale).toBe("en")
      expect(payload.count).toBe(0)
      expect(payload.items).toEqual([])
    })
  })
})

// Activates a representative set of 8 criteria spanning every dimension,
// each at (or under) its DIMENSION_MAX_ACTIVE cap, so getModel-style tests
// exercise a realistic, fully-loaded model without tripping
// dimensionCapExceeded/tooManyCriteria (competence 2, effort 2,
// responsibility 3, workingConditions 1 = 8 = MODEL_MAX_CRITERIA).
const SPREAD_LIBRARY_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

async function seedModelWithCriteria(
  t: ReturnType<typeof initConvexTest>,
  keys: readonly string[] = SPREAD_LIBRARY_KEYS
) {
  const { orgId, asAdmin } = await seedReadyOrganization(t)
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of keys) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: libraryKey as never,
    })
  }
  return { orgId, asAdmin }
}

describe("getModel", () => {
  it("returns null before any model exists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).toBeNull()
  })

  it("returns the full wire shape with balanced weight points", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t)
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).not.toBeNull()
    expect(result?.criteria).toHaveLength(8)
    const weightPoints = result?.criteria.map((c) => c.weightPoints) ?? []
    expect(weightPoints.every((p) => p === 3)).toBe(true)
    expect(weightPoints.reduce((sum, p) => sum + p, 0)).toBe(24)
    expect(result?.approval).toBeNull()
    expect(result?.workingConditions).toBeNull()
    expect(result?.levelRules).toHaveLength(12)
    expect(result?.zoneProfileRules).toHaveLength(2)
    expect(result?.tracks).toHaveLength(3)
    expect(result?.dimensions).toHaveLength(4)
    expect(result?.midpoints.step2.length).toBeGreaterThan(0)

    const first = result?.criteria[0]
    expect(first?.dimensionKey).toBe("competence")
    expect(first?.weightMotivation).toBeNull()
    // 1/3/5 always present; the library's 2/4 midpoints appear only for the
    // criteria that define them (not asserted here beyond >= 3).
    expect(first?.anchors.length).toBeGreaterThanOrEqual(3)
    expect(first?.anchors.map((a) => a.step)).toContain(1)
    expect(first?.anchors.map((a) => a.step)).toContain(5)
  })

  it("localizes library content to the requested locale", async () => {
    // The organization is seeded in Swedish, so the default read is Swedish.
    // model.name is the stored display name (set once at creation from the
    // org's own content locale) and is NOT re-localized by the locale param;
    // only the library-derived criteria/dimensions/tracks are.
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
    ])
    const sv = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "sv",
    })
    const en = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "en",
    })
    expect(sv?.name).toBe("Rollvärderingsmodell")
    expect(en?.name).toBe("Rollvärderingsmodell")
    expect(sv?.criteria[0]?.name).not.toBe(en?.criteria[0]?.name)
    expect(sv?.criteria[0]?.libraryKey).toBe("knowledge-depth")
    const enIc = en?.tracks.find((track) => track.key === "IC")
    expect(enIc?.name).toBe("Individual Contributor")
  })

  // The wire carries what a surface renders and nothing else. Four fields were
  // resolved from library content and shipped to every model-section client
  // without a reader: the dimension `question`/`why` (the columns' help is the
  // app's own authored copy), the criterion `fullDefinition` (the picker
  // resolves definitions from the library itself), and `sharedScale` (never
  // displayed; the shared-scale surface will get its own read when it is
  // built). Asserted on the KEY SETS, so re-adding one fails here rather than
  // riding along unnoticed.
  it("carries neither the retired criterion nor dimension fields", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
    ])
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).not.toBeNull()
    expect(Object.keys(result ?? {})).not.toContain("sharedScale")
    const criterion = result?.criteria[0]
    expect(criterion).toBeDefined()
    expect(Object.keys(criterion ?? {})).not.toContain("fullDefinition")
    // What the surfaces DO read stays, so the pin cannot pass by the payload
    // having quietly emptied.
    expect(Object.keys(criterion ?? {})).toEqual(
      expect.arrayContaining([
        "criterionId",
        "libraryKey",
        "dimensionKey",
        "name",
        "shortUiText",
        "measures",
        "notMeasures",
        "assessmentQuestion",
        "anchors",
        "weightPoints",
        "order",
        "weightMotivation",
      ])
    )
    const dimension = result?.dimensions[0]
    expect(Object.keys(dimension ?? {}).sort()).toEqual(["key", "name"])
  })

  it("falls back to English criteria content for an unsupported locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
    ])
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "de",
    })
    const en = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
      locale: "en",
    })
    expect(result?.criteria[0]?.name).toBe(en?.criteria[0]?.name)
    expect(result?.dimensions[0]?.name).toBe(en?.dimensions[0]?.name)
  })
})

describe("getRatingModel", () => {
  it("returns null before any model exists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    expect(
      await asAdmin.query(api.evaluationModel.model.getRatingModel, { orgId })
    ).toBeNull()
  })

  // The firewall this query exists for: an assessor rates against the anchors
  // and must not know how much each criterion counts. Serving the rating page
  // from the full model wire put the weighting in that client, one devtools
  // panel away, however carefully the page rendered it.
  it("carries no weight of any kind", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
      "scope-impact",
    ])
    const result = await asAdmin.query(
      api.evaluationModel.model.getRatingModel,
      { orgId }
    )
    expect(result?.criteria).toHaveLength(2)
    const criterion = result?.criteria[0]
    expect(Object.keys(criterion ?? {}).sort()).toEqual([
      "anchors",
      "assessmentQuestion",
      "criterionId",
      "dimensionKey",
      "measures",
      "name",
      "notMeasures",
    ])
    // Named as well as counted: a key set assertion alone would pass a rename.
    for (const key of ["weightPoints", "weightMotivation", "order"]) {
      expect(Object.keys(criterion ?? {})).not.toContain(key)
    }
    // Nor at the top level: approval is a bare boolean, never the approver.
    expect(Object.keys(result ?? {}).sort()).toEqual([
      "approved",
      "criteria",
      "midpoints",
    ])
  })

  it("reports the approval as a boolean the page can gate on", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t)
    expect(
      (await asAdmin.query(api.evaluationModel.model.getRatingModel, { orgId }))
        ?.approved
    ).toBe(false)
    await grantModelApproval(t, orgId)
    expect(
      (await asAdmin.query(api.evaluationModel.model.getRatingModel, { orgId }))
        ?.approved
    ).toBe(true)
  })

  // The array IS the order, which is why no `order` field ships: the page
  // steps through the criteria as given.
  it("returns the criteria in the model's own order, with their anchors", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
      "scope-impact",
      "on-call",
    ])
    const result = await asAdmin.query(
      api.evaluationModel.model.getRatingModel,
      { orgId }
    )
    const first = result?.criteria[0]
    expect(first?.dimensionKey).toBe("competence")
    expect(first?.name.length).toBeGreaterThan(0)
    expect(first?.assessmentQuestion.length).toBeGreaterThan(0)
    // 1/3/5 always; 2/4 only where the library defines them, and the page
    // fills the rest from midpoints.
    expect(first?.anchors.map((a) => a.step)).toContain(1)
    expect(first?.anchors.map((a) => a.step)).toContain(5)
    expect(result?.midpoints.step2.length).toBeGreaterThan(0)
  })

  it("localizes the criteria to the requested locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedModelWithCriteria(t, [
      "knowledge-depth",
    ])
    const sv = await asAdmin.query(api.evaluationModel.model.getRatingModel, {
      orgId,
      locale: "sv",
    })
    const en = await asAdmin.query(api.evaluationModel.model.getRatingModel, {
      orgId,
      locale: "en",
    })
    expect(sv?.criteria[0]?.name).not.toBe(en?.criteria[0]?.name)
  })

  // Org scoping, like every neighbour: another org's admin reads their own
  // model, never this one's.
  it("serves each organization only its own model", async () => {
    const t = initConvexTest()
    const { orgId } = await seedModelWithCriteria(t, ["knowledge-depth"])
    const other = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@other.se", name: "Other HR", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: other.userId })
    await expect(
      asOther.query(api.evaluationModel.model.getRatingModel, { orgId })
    ).rejects.toThrow()
  })
})
