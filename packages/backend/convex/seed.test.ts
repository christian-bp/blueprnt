/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { components, internal } from "./_generated/api"
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

describe("betterAuth/seed.insertWorkspace", () => {
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

    const first = await t.mutation(components.betterAuth.seed.insertWorkspace, {
      name: "blueprnt dev",
      slug: "blueprnt-dev",
      email: "hej@blueprnt.se",
      role: "admin",
    })
    expect(first.createdOrg).toBe(true)
    expect(first.createdMember).toBe(true)
    expect(first.userId).toBe(userId)

    const second = await t.mutation(
      components.betterAuth.seed.insertWorkspace,
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
      t.mutation(components.betterAuth.seed.insertWorkspace, {
        name: "x",
        slug: "x",
        email: "nobody@blueprnt.se",
        role: "admin",
      })
    ).rejects.toThrow(/run seed:seedDevUser first/)
  })
})

describe("accounts/mirrors.mirrorSeededWorkspace", () => {
  it("seeds the profile and audits org plus member exactly once", async () => {
    const t = initConvexTest()

    await t.mutation(internal.accounts.mirrors.mirrorSeededWorkspace, {
      orgId: "ba_org_seed",
      memberUserId: "ba_user_seed",
      role: "admin",
      auditMember: true,
    })
    // Re-run as the idempotent path: no second profile, no second audit.
    await t.mutation(internal.accounts.mirrors.mirrorSeededWorkspace, {
      orgId: "ba_org_seed",
      memberUserId: "ba_user_seed",
      role: "admin",
      auditMember: false,
    })

    await t.run(async (ctx) => {
      const profiles = await ctx.db
        .query("workspaceProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", "ba_org_seed"))
        .collect()
      expect(profiles).toHaveLength(1)

      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_seed").eq("type", "workspace.created")
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
    await expect(t.action(internal.seed.seedDevWorkspace, {})).rejects.toThrow(
      "seedDevWorkspace only runs on dev deployments"
    )
  })
})
