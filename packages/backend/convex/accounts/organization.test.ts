import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { onUserCreate } from "./mirrors"

describe("organization settings", () => {
  async function setup(role: string) {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role }
    )
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: userId,
        email: "hr@acme.se",
        name: "HR Person",
      })
      await ctx.db.insert("organizations", { orgId })
    })
    return { t, orgId, userId }
  }

  it("getOrganizationSettings returns the settings for members", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asMember = t.withIdentity({ subject: userId })
    const profile = await asMember.query(
      api.accounts.organization.getOrganizationSettings,
      { orgId }
    )
    expect(profile).toMatchObject({ orgId, country: null })
  })

  it("updateOrganizationSettings inserts a row when none exists (upsert path)", async () => {
    // Set up a membership without pre-seeding an organizations row so we
    // can verify the upsert inserts instead of throwing notFound.
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "admin2@acme.se", name: "Admin Two", role: "admin" }
    )
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: userId,
        email: "admin2@acme.se",
        name: "Admin Two",
      })
      // Intentionally do NOT insert an organizations row.
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(
      api.accounts.organization.updateOrganizationSettings,
      {
        orgId,
        language: "sv",
      }
    )
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(profile).toMatchObject({ orgId, language: "sv" })
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("updateOrganizationSettings is admin-only and audited", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(
      api.accounts.organization.updateOrganizationSettings,
      {
        orgId,
        country: "SE",
        currency: "SEK",
        language: "sv",
        employeeCount: 42,
      }
    )
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(profile).toMatchObject({ country: "SE", currency: "SEK" })
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("HR Person")
      // logAudit derives the category from the event prefix and a lowercased
      // searchText from the actor, type, and the changed payload values.
      expect(audit[0].category).toBe("organization")
      expect(audit[0].searchText).toContain("hr person")
      expect(audit[0].searchText).toContain("organization.settingsupdated")
      // A changed value (the country code) is searchable.
      expect(audit[0].searchText).toContain("se")
      // The row was pre-seeded (setup inserts an empty organizations row), so
      // this is an update, not an upsert-insert.
      const payload = audit[0].payload as {
        created: boolean
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.created).toBe(false)
      // employeeCount is captured in the diff (regression for the prior
      // omission of employeeCount from the buildChanges field list).
      expect(payload.changes).toMatchObject({
        country: { from: null, to: "SE" },
        currency: { from: null, to: "SEK" },
        language: { from: null, to: "sv" },
        employeeCount: { from: null, to: 42 },
      })
    })
  })

  it("updateOrganizationSettings marks created on the upsert-insert path", async () => {
    // No pre-seeded organizations row: the upsert inserts, so created is true.
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "admin3@acme.se", name: "Admin Three", role: "admin" }
    )
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: userId,
        email: "admin3@acme.se",
        name: "Admin Three",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(
      api.accounts.organization.updateOrganizationSettings,
      { orgId, country: "NO", employeeCount: 7 }
    )
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      const payload = audit[0].payload as {
        created: boolean
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.created).toBe(true)
      expect(payload.changes).toMatchObject({
        country: { from: null, to: "NO" },
        employeeCount: { from: null, to: 7 },
      })
    })
  })

  it("updateOrganizationSettings rejects editors", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        country: "SE",
      })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("completeOnboarding stamps the timestamp and writes one audit row", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(typeof profile?.onboardingCompletedAt).toBe("number")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.onboardingCompleted")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("HR Person")
      const payload = audit[0].payload as {
        created: boolean
        criteriaCount: number | null
        hadModel: boolean
        changes: { onboardingCompletedAt: { from: unknown; to: unknown } }
      }
      // Timestamp hoist regression: the stamped value and the audited `to` are
      // the same number (not two separate Date.now() calls).
      expect(payload.changes.onboardingCompletedAt.to).toBe(
        profile?.onboardingCompletedAt
      )
      expect(payload.changes.onboardingCompletedAt.from).toBe(null)
      // No model in this setup: hadModel false, criteriaCount null.
      expect(payload.hadModel).toBe(false)
      expect(payload.criteriaCount).toBe(null)
      expect(payload.created).toBe(false)
    })
  })

  it("completeOnboarding records criteriaCount and hadModel when a model exists", async () => {
    const { t, orgId, userId } = await setup("admin")
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Standard",
        bandThresholds: [],
      })
      for (let index = 0; index < 5; index++) {
        await ctx.db.insert("criteria", {
          orgId,
          modelId,
          name: `Criterion ${index + 1}`,
          description: "",
          helpText: "",
          anchors: [],
          weightPoints: 3,
          order: index + 1,
          isCustom: true,
        })
      }
    })
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.onboardingCompleted")
        )
        .collect()
      const payload = audit[0].payload as {
        criteriaCount: number | null
        hadModel: boolean
      }
      expect(payload.hadModel).toBe(true)
      expect(payload.criteriaCount).toBe(5)
    })
  })

  it("completeOnboarding rejects a model below the composition floor", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    // Three criteria is below MIN_CRITERIA (5): the wizard's Next gates
    // prevent this in the UI; the server backstop must hold regardless.
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Scratch",
        bandThresholds: [],
      })
      for (let index = 0; index < 3; index++) {
        await ctx.db.insert("criteria", {
          orgId,
          modelId,
          name: `Criterion ${index + 1}`,
          description: "",
          helpText: "",
          anchors: [],
          weightPoints: 3,
          order: index + 1,
          isCustom: true,
        })
      }
    })
    await expect(
      asAdmin.mutation(api.accounts.organization.completeOnboarding, { orgId })
    ).rejects.toThrow(/errors.tooFewCriteria/)
  })

  it("completeOnboarding is idempotent: keeps the first timestamp, no second audit row", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    const firstAt = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return profile?.onboardingCompletedAt
    })
    await asAdmin.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      // The first timestamp is preserved across the second call.
      expect(profile?.onboardingCompletedAt).toBe(firstAt)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.onboardingCompleted")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("stamps onboardingCompletedAt once and is idempotent across exit paths", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asUser = t.withIdentity({ subject: userId })

    // A model with MIN_CRITERIA criteria so the composition floor passes.
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Standard",
        bandThresholds: [],
      })
      for (let index = 0; index < 5; index++) {
        await ctx.db.insert("criteria", {
          orgId,
          modelId,
          name: `Criterion ${index + 1}`,
          description: "",
          helpText: "",
          anchors: [],
          weightPoints: 3,
          order: index + 1,
          isCustom: true,
        })
      }
    })

    // First exit (e.g. "I'll do this later"): the timestamp is stamped.
    await asUser.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    const firstStamp = await t.run(async (ctx) => {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return settings?.onboardingCompletedAt ?? null
    })
    expect(typeof firstStamp).toBe("number")

    // A later exit (e.g. "Save and exit" after re-entry) is idempotent: the
    // original timestamp is kept.
    await asUser.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    const secondStamp = await t.run(async (ctx) => {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return settings?.onboardingCompletedAt ?? null
    })
    expect(secondStamp).toBe(firstStamp)
  })

  it("completeOnboarding rejects same-org editors with errors.adminRequired", async () => {
    const { t, orgId } = await setup("admin")
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
        .mutation(api.accounts.organization.completeOnboarding, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})
