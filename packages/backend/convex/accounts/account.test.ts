import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
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

// The internal erasure mutation is tested directly (the cascade + last-admin
// guard). The live password check in deleteMyAccount goes through Better Auth's
// /verify-password endpoint, which needs a real session token + the credential
// adapter path; that path does not run under convex-test (same limitation noted
// in lib/functions.ts for getAuthUser, get-convex/better-auth#235), so the
// end-to-end "valid password -> erased" round trip is e2e scope (Playwright).
// Here we test the erasure cascade via eraseSelf and the gate's fail-closed
// behavior via deleteMyAccount (no valid credential -> rejects, erases nothing).
describe("accounts.account.eraseSelf", () => {
  it("erases the caller: identity, mirror, membership, audit tombstone, email purge", async () => {
    const t = initConvexTest()
    // Seed a user with a sole-admin membership in one org, plus a SECOND admin
    // so the last-admin guard does not block this erasure.
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "erase@acme.se", name: "Erase Me", role: "admin" }
    )
    const { userId: otherId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "keep@acme.se", name: "Keep", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: otherId,
      role: "admin",
    })
    // Mirror the caller and write an audit row authored by them so the
    // tombstone can be asserted.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Erase Me",
        email: "erase@acme.se",
      })
      await ctx.db.insert("auditLog", {
        orgId,
        type: "role.created",
        actorId: userId,
        actorName: "Erase Me",
        payload: {},
        category: "role",
        searchText: "erase me role.created",
      })
    })

    await t.mutation(internal.accounts.account.eraseSelf, {
      authUserId: userId,
    })

    // App mirror gone.
    const mirror = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", userId))
        .unique()
    )
    expect(mirror).toBeNull()
    // BA identity + membership gone.
    const baUsers = await t.run(async (ctx) =>
      ctx.runQuery(components.betterAuth.provisioning.listAllUsers, {})
    )
    expect(baUsers.some((u) => u.userId === userId)).toBe(false)
    const members = await t.run(async (ctx) =>
      ctx.runQuery(components.betterAuth.provisioning.listMembers, {
        organizationId: orgId,
      })
    )
    expect(members.some((m) => m.userId === userId)).toBe(false)
    // Audit actorName anonymized (row kept for the trail).
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_actor", (q) => q.eq("actorId", userId))
        .collect()
    )
    expect(audit).toHaveLength(1)
    expect(audit[0]?.actorName).toBe("deleted user")
    // Email purge scheduled with the erased address.
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const purge = scheduled.find((s) => s.name.includes("purgeRecipientEmails"))
    expect(purge).toBeDefined()
    expect(purge?.args).toEqual([{ email: "erase@acme.se" }])
    // platform.userDeleted recorded, self-attributed, id-only payload (no PII).
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const del = plat.find((r) => r.type === "platform.userDeleted")
    expect(del?.actorId).toBe(userId)
    expect(del?.targetUserId).toBe(userId)
    expect(del?.payload).toEqual({ orgCount: 1 })
  })

  it("deletes the caller's stored avatar file as part of erasure", async () => {
    const t = initConvexTest()
    // Seed the caller with a SECOND admin so the last-admin guard does not block.
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "erase-avatar@acme.se", name: "Erase Avatar", role: "admin" }
    )
    const { userId: otherId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "keep2@acme.se", name: "Keep", role: "editor" }
    )
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId: otherId,
      role: "admin",
    })
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar-bytes"]))
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Erase Avatar",
        email: "erase-avatar@acme.se",
        imageId: storageId,
      })
    })

    await t.mutation(internal.accounts.account.eraseSelf, {
      authUserId: userId,
    })

    // The avatar file is gone from storage, alongside the mirror row.
    const url = await t.run((ctx) => ctx.storage.getUrl(storageId))
    expect(url).toBeNull()
    const mirror = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", userId))
        .unique()
    )
    expect(mirror).toBeNull()
  })

  it("throws lastAdmin and erases nothing when the caller is the sole admin of an org", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "sole@acme.se", name: "Sole Admin", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Sole Admin",
        email: "sole@acme.se",
      })
    })

    await expect(
      t.mutation(internal.accounts.account.eraseSelf, { authUserId: userId })
    ).rejects.toThrow(/errors\.lastAdmin/)

    // Nothing erased: mirror + BA identity both survive.
    const mirror = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", userId))
        .unique()
    )
    expect(mirror).not.toBeNull()
    const baUsers = await t.run(async (ctx) =>
      ctx.runQuery(components.betterAuth.provisioning.listAllUsers, {})
    )
    expect(baUsers.some((u) => u.userId === userId)).toBe(true)
    // No userDeleted audit row written.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    expect(plat.some((r) => r.type === "platform.userDeleted")).toBe(false)
  })
})

describe("accounts.account avatar storage", () => {
  it("setMyAvatar stores the storage id on the mirror and returns a url", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    // Seed a stored blob and grab its storage id (convex-test exposes the
    // action-style StorageActionWriter inside t.run).
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar-bytes"]))
    )

    const url = await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.setMyAvatar, { storageId })
    expect(typeof url).toBe("string")
    expect(url.length).toBeGreaterThan(0)

    const row = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "user-1"))
        .unique()
    )
    expect(row?.imageId).toBe(storageId)
  })

  it("setMyAvatar called again deletes the previous file and stores the new id", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const oldId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["old-avatar"]))
    )
    const newId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["new-avatar"]))
    )

    const asUser = t.withIdentity({ subject: "user-1" })
    await asUser.mutation(api.accounts.account.setMyAvatar, {
      storageId: oldId,
    })
    await asUser.mutation(api.accounts.account.setMyAvatar, {
      storageId: newId,
    })

    // The old file is gone from storage; the new one remains.
    const oldUrl = await t.run((ctx) => ctx.storage.getUrl(oldId))
    const newUrl = await t.run((ctx) => ctx.storage.getUrl(newId))
    expect(oldUrl).toBeNull()
    expect(newUrl).not.toBeNull()
    // The mirror points at the new id.
    const row = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "user-1"))
        .unique()
    )
    expect(row?.imageId).toBe(newId)
  })

  it("removeMyAvatar deletes the stored file and clears imageId", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar"]))
    )
    const asUser = t.withIdentity({ subject: "user-1" })
    await asUser.mutation(api.accounts.account.setMyAvatar, { storageId })

    const result = await asUser.mutation(
      api.accounts.account.removeMyAvatar,
      {}
    )
    expect(result).toBeNull()

    const url = await t.run((ctx) => ctx.storage.getUrl(storageId))
    expect(url).toBeNull()
    const row = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "user-1"))
        .unique()
    )
    expect(row?.imageId).toBeUndefined()
  })

  it("removeMyAvatar is a no-op when there is no avatar", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const result = await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.removeMyAvatar, {})
    expect(result).toBeNull()
  })

  it("generateAvatarUploadUrl returns a string for an authed caller", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "Alice",
        email: "alice@acme.se",
      })
    })
    const url = await t
      .withIdentity({ subject: "user-1" })
      .mutation(api.accounts.account.generateAvatarUploadUrl, {})
    expect(typeof url).toBe("string")
    expect(url.length).toBeGreaterThan(0)
  })

  it("generateAvatarUploadUrl rejects when unauthenticated", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.accounts.account.generateAvatarUploadUrl, {})
    ).rejects.toThrow(/errors\.notAuthenticated/)
  })

  it("setMyAvatar rejects when unauthenticated", async () => {
    const t = initConvexTest()
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar"]))
    )
    await expect(
      t.mutation(api.accounts.account.setMyAvatar, { storageId })
    ).rejects.toThrow(/errors\.notAuthenticated/)
  })
})

describe("accounts.account.deleteMyAccount", () => {
  it("rejects when unauthenticated", async () => {
    const t = initConvexTest()
    await expect(
      t.action(api.accounts.account.deleteMyAccount, { password: "whatever" })
    ).rejects.toThrow(/errors\.notAuthenticated/)
  })

  it("does not erase when the password check fails (fail-closed gate)", async () => {
    // Under convex-test there is no real Better Auth session/credential, so the
    // /verify-password call cannot succeed: the action must reject and leave the
    // account intact. This asserts the gate is fail-closed, which is the
    // security-relevant property of the boundary.
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "gate@acme.se", name: "Gate", role: "editor" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "Gate",
        email: "gate@acme.se",
      })
    })

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.accounts.account.deleteMyAccount, { password: "wrong" })
    ).rejects.toThrow(/errors\.invalidInput/)

    // The account is untouched.
    const mirror = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", userId))
        .unique()
    )
    expect(mirror).not.toBeNull()
    const baUsers = await t.run(async (ctx) =>
      ctx.runQuery(components.betterAuth.provisioning.listAllUsers, {})
    )
    expect(baUsers.some((u) => u.userId === userId)).toBe(true)
  })
})
