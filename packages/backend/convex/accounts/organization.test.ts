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
    })
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
