/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "./_generated/api"
import { initConvexTest } from "./testing.helpers"

// The seedDevUser action is "use node" (hashPassword requires node:crypto) and
// therefore cannot run inside the edge-runtime convex-test harness. Tests for
// idempotency and output shape are exercised directly against the component
// mutation. The guard test uses vi.stubEnv to verify the throw path; the action
// throws before any Node-only call, so edge-runtime handles it fine.

describe("betterAuth/seed.insertCredentialUser", () => {
  it("creates user + account and returns created: true on first call", async () => {
    const t = initConvexTest()

    const result = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    expect(result.created).toBe(true)
    expect(typeof result.userId).toBe("string")
    expect(result.userId.length).toBeGreaterThan(0)
  })

  it("is idempotent: second call returns same userId and created: false", async () => {
    const t = initConvexTest()

    const first = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )
    const second = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    expect(second.created).toBe(false)
    expect(second.userId).toBe(first.userId)
  })
})

describe("betterAuth/seed.insertOrganization", () => {
  async function seedUser(t: ReturnType<typeof initConvexTest>) {
    return await t.mutation(components.betterAuth.seed.insertCredentialUser, {
      email: "hej@blueprnt.se",
      name: "Hej",
      passwordHash: "fakesalt:fakehash",
    })
  }

  it("creates org + admin member and is idempotent by slug", async () => {
    const t = initConvexTest()
    const { userId } = await seedUser(t)

    const first = await t.mutation(
      components.betterAuth.seed.insertOrganization,
      {
        name: "blueprnt dev",
        slug: "blueprnt-dev",
        email: "hej@blueprnt.se",
        role: "admin",
      }
    )
    expect(first.createdOrg).toBe(true)
    expect(first.createdMember).toBe(true)
    expect(first.userId).toBe(userId)

    const second = await t.mutation(
      components.betterAuth.seed.insertOrganization,
      {
        name: "blueprnt dev",
        slug: "blueprnt-dev",
        email: "hej@blueprnt.se",
        role: "admin",
      }
    )
    expect(second.createdOrg).toBe(false)
    expect(second.createdMember).toBe(false)
    expect(second.orgId).toBe(first.orgId)

    const membership = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: first.orgId, userId }
    )
    expect(membership).toEqual({
      organizationId: first.orgId,
      userId,
      role: "admin",
    })
  })

  it("rejects when the user does not exist yet", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(components.betterAuth.seed.insertOrganization, {
        name: "x",
        slug: "x",
        email: "nobody@blueprnt.se",
        role: "admin",
      })
    ).rejects.toThrow(/run seed:seedDevUser first/)
  })
})

describe("accounts/mirrors.mirrorSeededOrganization", () => {
  it("seeds the profile and audits org plus member exactly once", async () => {
    const t = initConvexTest()

    await t.mutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId: "ba_org_seed",
      memberUserId: "ba_user_seed",
      role: "admin",
      auditMember: true,
    })
    // Re-run as the idempotent path: no second profile, no second audit.
    await t.mutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId: "ba_org_seed",
      memberUserId: "ba_user_seed",
      role: "admin",
      auditMember: false,
    })

    await t.run(async (ctx) => {
      const profiles = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", "ba_org_seed"))
        .collect()
      expect(profiles).toHaveLength(1)

      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_seed").eq("type", "organization.created")
        )
        .collect()
      expect(created).toHaveLength(1)

      const added = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_seed").eq("type", "member.added")
        )
        .collect()
      expect(added).toHaveLength(1)
      expect(added[0].payload).toMatchObject({
        memberUserId: "ba_user_seed",
        role: "admin",
      })
    })
  })
})

describe("betterAuth/seed.removeOrganizationsForUserEmail + accounts/mirrors.removeSeededOrganization", () => {
  async function seedAll(t: ReturnType<typeof initConvexTest>) {
    // Seed a user.
    const { userId } = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    // Seed an organization (org + member).
    const { orgId } = await t.mutation(
      components.betterAuth.seed.insertOrganization,
      {
        name: "blueprnt dev",
        slug: "blueprnt-dev",
        email: "hej@blueprnt.se",
        role: "admin",
      }
    )

    // Seed the app-side profile and audit rows.
    await t.mutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId,
      memberUserId: userId,
      role: "admin",
      auditMember: true,
    })

    return { orgId, userId }
  }

  it("removes all auth-side and app-side rows and leaves organization: null in onboarding status", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAll(t)

    // Seed a model, a criterion with an anchor, a suggestion, and fill the profile.
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Standard",
        bandThresholds: [{ band: 1, minScore: 98 }],
      })
      await ctx.db.insert("criteria", {
        orgId,
        modelId,
        name: "Scope",
        description: "desc",
        helpText: "help",
        anchors: [{ level: 3, text: "anchor text" }],
        weightPoints: 4,
        order: 1,
        isCustom: false,
      })
      await ctx.db.insert("suggestions", {
        orgId,
        target: { kind: "model.draft" },
        suggestedValue: {},
        source: "ai",
        status: "suggested",
      })
      // Complete the profile so the test exercises the patch path.
      const profile = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (profile !== null) {
        await ctx.db.patch(profile._id, {
          country: "se",
          currency: "SEK",
          language: "sv",
          employeeCount: 10,
          industry: "itTelecom",
        })
      }
    })

    // Run the component mutation to remove the auth-side org.
    const removedOrgIds = await t.mutation(
      components.betterAuth.seed.removeOrganizationsForUserEmail,
      { email: "hej@blueprnt.se" }
    )
    expect(removedOrgIds).toContain(orgId)

    // Run the app-side cleanup for each returned orgId.
    for (const id of removedOrgIds) {
      await t.mutation(internal.accounts.mirrors.removeSeededOrganization, {
        orgId: id,
      })
    }

    // Assert all app-side rows are gone.
    await t.run(async (ctx) => {
      const profiles = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(profiles).toHaveLength(0)

      const models = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(models).toHaveLength(0)

      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(0)

      const suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(suggestions).toHaveLength(0)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(auditRows).toHaveLength(0)
    })

    // Onboarding status now reports organization: null because the member row is gone.
    const status = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.organization).toBeNull()
  })

  it("is a no-op for an unknown email", async () => {
    const t = initConvexTest()
    const removed = await t.mutation(
      components.betterAuth.seed.removeOrganizationsForUserEmail,
      { email: "nobody@blueprnt.se" }
    )
    expect(removed).toEqual([])
  })
})

describe("devReset.wipeAppTables", () => {
  it("deletes rows from every app table and reports done", async () => {
    const t = initConvexTest()

    // Seed rows across several app tables.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "ba_user_seed",
        email: "hej@blueprnt.se",
        name: "Hej",
      })
      await ctx.db.insert("organizations", { orgId: "ba_org_seed" })
      await ctx.db.insert("auditLog", {
        orgId: "ba_org_seed",
        type: "organization.created",
        actorId: "ba_user_seed",
        actorName: "Hej",
        payload: {},
      })

      await ctx.db.insert("models", {
        orgId: "ba_org_seed",
        name: "Standard",
        bandThresholds: [],
      })
      await ctx.db.insert("roles", {
        orgId: "ba_org_seed",
        title: "Junior Developer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
        purpose: "Build things",
        responsibilities: "Ship code",
        status: "draft",
      })
    })

    const result = await t.mutation(internal.devReset.wipeAppTables, {})
    expect(result).toEqual({ done: true })

    await t.run(async (ctx) => {
      for (const table of [
        "users",
        "organizations",
        "auditLog",
        "models",
        "roles",
      ] as const) {
        const rows = await ctx.db.query(table).take(1)
        expect(rows).toEqual([])
      }
    })
  })
})

describe("betterAuth/seed.wipeAuthData", () => {
  it("clears auth tables (keeping no membership) and reports done", async () => {
    const t = initConvexTest()

    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )

    const result = await t.mutation(components.betterAuth.seed.wipeAuthData, {})
    expect(result).toEqual({ done: true })

    const membership = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId }
    )
    expect(membership).toBeNull()

    const memberships = await t.query(
      components.betterAuth.membership.listMembershipsForUser,
      { userId }
    )
    expect(memberships).toEqual([])
  })
})

describe("seed.seedProduction validation", () => {
  // The happy path needs hashPassword (node:crypto) and cannot run in the
  // edge-runtime harness; the wipe loop and insertCredentialUser are covered
  // by their own tests. Every validation throw happens BEFORE the wipe and
  // before any Node-only call, so a typo can never destroy data.
  it("rejects without the confirm sentinel and leaves data intact", async () => {
    const t = initConvexTest()
    const existing = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    await expect(
      t.action(internal.seed.seedProduction, {
        email: "demo@blueprnt.se",
        password: "longenough1",
        name: "Demo",
        confirm: "yes",
      })
    ).rejects.toThrow('pass confirm: "wipe-and-seed"')

    // The pre-existing user survived: nothing was wiped.
    const again = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@blueprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )
    expect(again.created).toBe(false)
    expect(again.userId).toBe(existing.userId)
  })

  it("rejects an invalid email", async () => {
    const t = initConvexTest()
    await expect(
      t.action(internal.seed.seedProduction, {
        email: "not-an-email",
        password: "longenough1",
        name: "Demo",
        confirm: "wipe-and-seed",
      })
    ).rejects.toThrow("email must be a valid address")
  })

  it("rejects a too-short password", async () => {
    const t = initConvexTest()
    await expect(
      t.action(internal.seed.seedProduction, {
        email: "demo@blueprnt.se",
        password: "short",
        name: "Demo",
        confirm: "wipe-and-seed",
      })
    ).rejects.toThrow("password must be at least 8 characters")
  })

  it("rejects an empty name", async () => {
    const t = initConvexTest()
    await expect(
      t.action(internal.seed.seedProduction, {
        email: "demo@blueprnt.se",
        password: "longenough1",
        name: "   ",
        confirm: "wipe-and-seed",
      })
    ).rejects.toThrow("name must not be empty")
  })
})

describe("seed.seedDevUser guard", () => {
  beforeEach(() => {
    // The vitest config already sets CONVEX_TEST=true; stub SITE_URL per test.
    vi.stubEnv("SITE_URL", "http://localhost:3001")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects when SITE_URL points to a production domain", async () => {
    vi.stubEnv("SITE_URL", "https://app.blueprnt.se")

    const t = initConvexTest()

    await expect(t.action(internal.seed.seedDevUser, {})).rejects.toThrow(
      "seedDevUser only runs on dev deployments"
    )
    await expect(
      t.action(internal.seed.seedDevOrganization, {})
    ).rejects.toThrow("seedDevOrganization only runs on dev deployments")
    await expect(
      t.action(internal.seed.removeDevOrganizations, {})
    ).rejects.toThrow("removeDevOrganizations only runs on dev deployments")
    await expect(t.action(internal.seed.resetDatabase, {})).rejects.toThrow(
      "resetDatabase only runs on dev deployments"
    )
    await expect(
      t.action(internal.seed.resetDatabaseForOnboarding, {})
    ).rejects.toThrow("resetDatabaseForOnboarding only runs on dev deployments")
  })
})

describe("accounts/mirrors.seedOrganizationSettings", () => {
  it("fills settings + stamps completion, preserving the first timestamp", async () => {
    const t = initConvexTest()
    const orgId = "ba_org_settings_seed"
    // The bare row the seed creates first via mirrorSeededOrganization.
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", { orgId })
    })

    await t.mutation(internal.accounts.mirrors.seedOrganizationSettings, {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
      completeOnboarding: true,
    })

    let stampedAt: number | undefined
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(row?.country).toBe("se")
      expect(row?.currency).toBe("SEK")
      expect(row?.language).toBe("sv")
      expect(row?.industry).toBe("itTelecom")
      expect(typeof row?.onboardingCompletedAt).toBe("number")
      stampedAt = row?.onboardingCompletedAt
    })

    // Re-run keeps the first completion timestamp and updates settings; audit
    // rows are written only on the first seed.
    await t.mutation(internal.accounts.mirrors.seedOrganizationSettings, {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "manufacturing",
      completeOnboarding: true,
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(row?.onboardingCompletedAt).toBe(stampedAt)
      expect(row?.industry).toBe("manufacturing")

      const settingsAudit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      expect(settingsAudit).toHaveLength(1)
      const completedAudit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.onboardingCompleted")
        )
        .collect()
      expect(completedAudit).toHaveLength(1)
    })
  })

  it("makes getOnboardingStatus report the org as fully complete", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "dev@blueprnt.se", name: "Dev", role: "admin" }
    )
    // The dev seed sequence: bare org row, then settings + completion, then model.
    await t.mutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId,
      memberUserId: userId,
      role: "admin",
      auditMember: true,
    })
    await t.mutation(internal.accounts.mirrors.seedOrganizationSettings, {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
      completeOnboarding: true,
    })
    await t.mutation(internal.evaluationModel.model.seedStandardModel, {
      orgId,
      locale: "sv",
    })

    const status = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.onboarding.getOnboardingStatus, { orgId })
    expect(status?.settingsComplete).toBe(true)
    expect(status?.hasModel).toBe(true)
    expect(status?.completed).toBe(true)
  })
})
