import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedAdmin(t: ReturnType<typeof initConvexTest>) {
  return await t.mutation(components.betterAuth.testing.seedMembership, {
    email: "hr@acme.se",
    name: "HR Person",
    role: "admin",
  })
}

describe("getOnboardingStatus", () => {
  it("returns null when unauthenticated", async () => {
    const t = initConvexTest()
    expect(
      await t.query(api.accounts.onboarding.getOnboardingStatus, {})
    ).toBeNull()
  })

  it("reports no organization for a member-less user", async () => {
    const t = initConvexTest()
    const status = await t
      .withIdentity({ subject: "user-without-org" })
      .query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status).toEqual({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      hasRoles: false,
      completed: false,
    })
  })

  it("walks organization -> profile -> model as data is filled in", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })

    // Organization exists, no profile row yet (trigger does not run in tests).
    let status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.organization).toEqual({
      orgId,
      name: "Acme",
      role: "admin",
    })
    expect(status?.settingsComplete).toBe(false)
    expect(status?.hasModel).toBe(false)

    // Incomplete profile row: still not complete.
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", { orgId, country: "se" })
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.settingsComplete).toBe(false)

    // Complete the profile.
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (profile === null) throw new Error("profile row missing")
      await ctx.db.patch(profile._id, {
        currency: "SEK",
        language: "sv",
        industry: "itTelecom",
      })
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.settingsComplete).toBe(true)
    expect(status?.hasModel).toBe(false)

    // Empty strings are not complete (regression: typeof would pass them).
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (profile === null) throw new Error("profile row missing")
      await ctx.db.patch(profile._id, { industry: "" })
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.settingsComplete).toBe(false)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (profile === null) throw new Error("profile row missing")
      await ctx.db.patch(profile._id, { industry: "itTelecom" })
    })

    // Model exists, but the wizard has not been finished yet: hasModel is true
    // while completed stays false. The gate must NOT infer done from hasModel.
    // The model carries MIN_CRITERIA criteria so completeOnboarding's
    // composition floor passes below.
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
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.hasModel).toBe(true)
    expect(status?.completed).toBe(false)

    // Finishing the wizard is the explicit, persisted act that flips completed.
    await asUser.mutation(api.accounts.organization.completeOnboarding, {
      orgId,
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.completed).toBe(true)
  })

  it("returns the member's role verbatim for editors", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "editor@acme.se", name: "Editor Person", role: "editor" }
    )
    const status = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.organization).toEqual({
      orgId,
      name: "Acme",
      role: "editor",
    })
  })

  it("selects the requested company when the caller belongs to several", async () => {
    const t = initConvexTest()
    const { orgId: orgA, userId } = await seedAdmin(t) // org "Acme"
    const { orgId: orgB } = await t.mutation(
      components.betterAuth.testing.seedOrgForUser,
      { userId, orgName: "Beta", role: "editor" }
    )
    const asUser = t.withIdentity({ subject: userId })

    const statusB = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      { orgId: orgB }
    )
    expect(statusB?.organization).toEqual({
      orgId: orgB,
      name: "Beta",
      role: "editor",
    })
    // Beta has no settings/model: it reads as not yet onboarded.
    expect(statusB?.settingsComplete).toBe(false)
    expect(statusB?.hasModel).toBe(false)

    const statusA = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      { orgId: orgA }
    )
    expect(statusA?.organization).toEqual({
      orgId: orgA,
      name: "Acme",
      role: "admin",
    })
  })

  it("falls back to the first membership for a stale or absent orgId", async () => {
    const t = initConvexTest()
    const { orgId: orgA, userId } = await seedAdmin(t)
    await t.mutation(components.betterAuth.testing.seedOrgForUser, {
      userId,
      orgName: "Beta",
      role: "editor",
    })
    const asUser = t.withIdentity({ subject: userId })

    // No arg: first membership (Acme).
    const noArg = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(noArg?.organization?.orgId).toBe(orgA)

    // Unknown orgId (not a membership): same fallback, never a foreign company.
    const stale = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      { orgId: "nonexistent" }
    )
    expect(stale?.organization?.orgId).toBe(orgA)
  })

  it("reports hasRoles once the org has at least one role", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })

    // No roles yet: hasRoles is false.
    let status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.hasRoles).toBe(false)

    // Insert one role: hasRoles flips true.
    await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId,
        title: "Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        purpose: "",
        responsibilities: "",
        status: "draft",
      })
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.hasRoles).toBe(true)
  })
})

describe("getUiLocale", () => {
  it("returns null when unauthenticated", async () => {
    const t = initConvexTest()
    expect(await t.query(api.accounts.onboarding.getUiLocale, {})).toBeNull()
  })

  it("ignores the organization default language (the UI follows the browser)", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", { orgId, language: "sv" })
    })
    const locale = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getUiLocale, {})
    expect(locale).toBeNull()
  })

  it("returns the per-user override when set", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", { orgId, language: "sv" })
      // Mirror row carrying the per-user override (the trigger that normally
      // seeds it does not run in tests).
      await ctx.db.insert("users", {
        authId: userId,
        name: "HR Person",
        email: "hr@acme.se",
        locale: "da",
      })
    })
    const locale = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getUiLocale, {})
    expect(locale).toBe("da")
  })

  it("returns null when no override is set", async () => {
    const t = initConvexTest()
    const { userId } = await seedAdmin(t)
    const locale = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getUiLocale, {})
    expect(locale).toBeNull()
  })
})

describe("setUiLocale", () => {
  it("rejects unauthenticated callers", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.accounts.onboarding.setUiLocale, { locale: "sv" })
    ).rejects.toThrow(/notAuthenticated/)
  })

  it("rejects unsupported locales", async () => {
    const t = initConvexTest()
    const { userId } = await seedAdmin(t)
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.accounts.onboarding.setUiLocale, { locale: "de" })
    ).rejects.toThrow(/invalidInput/)
  })

  it("updates the mirror row and getUiLocale follows", async () => {
    const t = initConvexTest()
    const { userId } = await seedAdmin(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "HR Person",
        email: "hr@acme.se",
      })
    })
    const asUser = t.withIdentity({ subject: userId })
    await asUser.mutation(api.accounts.onboarding.setUiLocale, {
      locale: "fi",
    })
    expect(await asUser.query(api.accounts.onboarding.getUiLocale, {})).toBe(
      "fi"
    )
  })

  it("creates the mirror row when the trigger never ran", async () => {
    const t = initConvexTest()
    const { userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })
    await asUser.mutation(api.accounts.onboarding.setUiLocale, {
      locale: "nb",
    })
    expect(await asUser.query(api.accounts.onboarding.getUiLocale, {})).toBe(
      "nb"
    )
  })
})
