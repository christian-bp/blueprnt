import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("accounts.account.getMyAccount", () => {
  it("returns null when unauthenticated", async () => {
    const t = initConvexTest()
    const result = await t.query(api.accounts.account.getMyAccount, {})
    expect(result).toBeNull()
  })

  it("returns the mirror row fields for an authed user with no memberships", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice Johansson",
        email: "alice@acme.se",
        locale: "sv",
        mfaMethod: "email",
        mfaConfirmedAt: 1_700_000_000_000,
      })
    })
    const result = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).toEqual({
      name: "Alice Johansson",
      email: "alice@acme.se",
      locale: "sv",
      mfaMethod: "email",
      lastAdminOrgs: [],
    })
  })

  it("returns null mfaMethod and locale when not set", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Bob",
        email: "bob@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).toEqual({
      name: "Bob",
      email: "bob@acme.se",
      locale: null,
      mfaMethod: null,
      lastAdminOrgs: [],
    })
  })

  it("returns null when the user has no mirror row", async () => {
    // No mirror row seeded; getMyAccount returns null for a missing row (graceful).
    const t = initConvexTest()
    const result = await t
      .withIdentity({ subject: "user-nobody" })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).toBeNull()
  })

  it("includes an org where the user is the sole admin in lastAdminOrgs", async () => {
    const t = initConvexTest()
    // Seed a user + org + sole admin membership via the betterAuth testing helper.
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "alice@acme.se", name: "Alice", role: "admin" }
    )
    // Mirror the user into the app users table using their Better Auth userId.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).not.toBeNull()
    expect(result?.lastAdminOrgs).toHaveLength(1)
    expect(result?.lastAdminOrgs[0]).toEqual({ orgId, name: "Acme" })
  })

  it("excludes an org where there is a second admin", async () => {
    const t = initConvexTest()
    // Seed user-A as admin.
    const { orgId, userId: userAId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "alice@acme.se", name: "Alice", role: "admin" }
    )
    // Seed user-B as a second admin in the same org.
    const { userId: userBId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "bob@other.se", name: "Bob", role: "editor" }
    )
    // Promote user-B to admin of Alice's org via the component test helper.
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: userBId,
      role: "admin",
    })
    // Mirror Alice.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userAId,
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: userAId })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).not.toBeNull()
    // Alice is not the sole admin; the org must not be in lastAdminOrgs.
    expect(result?.lastAdminOrgs).toHaveLength(0)
  })

  it("includes only the sole-admin org when the user is admin in one and not in another", async () => {
    const t = initConvexTest()
    // Seed org-A where Alice is the sole admin.
    const { orgId: orgAId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "alice@acme.se", name: "Alice", role: "admin" }
    )
    // Seed org-B where Alice is admin alongside another admin.
    const orgBId = (
      await t.mutation(components.betterAuth.testing.seedOrgForUser, {
        userId,
        orgName: "Beta",
        role: "admin",
      })
    ).orgId
    // Add a second admin to org-B.
    const { userId: otherUserId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "carol@beta.se", name: "Carol", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId: orgBId,
      userId: otherUserId,
      role: "admin",
    })
    // Mirror Alice.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.account.getMyAccount, {})
    expect(result).not.toBeNull()
    // Only org-A (sole admin) must appear.
    expect(result?.lastAdminOrgs).toHaveLength(1)
    expect(result?.lastAdminOrgs[0]?.orgId).toBe(orgAId)
  })

  it("includes org where user is editor role (non-admin) in lastAdminOrgs: empty", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "alice@acme.se", name: "Alice", role: "editor" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.account.getMyAccount, {})
    expect(result?.lastAdminOrgs).toHaveLength(0)
  })
})

describe("accounts.account.clearMfaConfirmed", () => {
  it("sets mfaConfirmedAt to undefined on the mirror row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
        mfaMethod: "totp",
        mfaConfirmedAt: 1_700_000_000_000,
      })
    })
    await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.clearMfaConfirmed, {})

    // Check the row directly.
    const row = await t.run(async (ctx) => {
      return ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "user-1"))
        .unique()
    })
    expect(row?.mfaConfirmedAt).toBeUndefined()
  })

  it("returns null", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
        mfaConfirmedAt: 1_700_000_000_000,
      })
    })
    const result = await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.clearMfaConfirmed, {})
    expect(result).toBeNull()
  })

  it("rejects when unauthenticated", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.accounts.account.clearMfaConfirmed, {})
    ).rejects.toBeDefined()
  })

  it("is a no-op when mfaConfirmedAt was not set", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    // Should not throw; patching undefined onto an already-absent field is safe.
    const result = await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.clearMfaConfirmed, {})
    expect(result).toBeNull()
  })
})
