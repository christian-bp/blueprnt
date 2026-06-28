import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
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

  it("getOrganizationSettings returns imageUrl null when no logo set", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asMember = t.withIdentity({ subject: userId })
    const profile = await asMember.query(
      api.accounts.organization.getOrganizationSettings,
      { orgId }
    )
    expect(profile.imageUrl).toBeNull()
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

describe("userHasPassword", () => {
  it("is false for a provisioned user with no account, true once an account exists", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.provisioning.provisionUser,
      { email: "new@acme.se", name: "New User" }
    )
    expect(
      await t.query(internal.accounts.organization.userHasPassword, { userId })
    ).toBe(false)
    await t.mutation(components.betterAuth.testing.seedAccount, { userId })
    expect(
      await t.query(internal.accounts.organization.userHasPassword, { userId })
    ).toBe(true)
  })
})

describe("getLanguageForUser", () => {
  it("returns the org language for a user with a membership", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", { orgId, language: "sv" })
    })
    const result = await t.query(
      internal.accounts.organization.getLanguageForUser,
      { userId }
    )
    expect(result).toEqual({ language: "sv" })
  })

  it("returns null for a user with no membership", async () => {
    const t = initConvexTest()
    const result = await t.query(
      internal.accounts.organization.getLanguageForUser,
      { userId: "no-such-user" }
    )
    expect(result).toBeNull()
  })
})

describe("organization logo", () => {
  async function setup(role: "admin" | "editor") {
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

  it("removeOrgAvatar clears the logo and audits logoRemoved (admin only)", async () => {
    const { t, orgId, userId } = await setup("admin")
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob(["img"], { type: "image/png" })
      )
      const row = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (row === null) throw new Error("seeded org row missing")
      await ctx.db.patch(row._id, { imageId: id })
      return id
    })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.accounts.organization.removeOrgAvatar, { orgId })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(row?.imageId).toBeUndefined()
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.logoRemoved")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(await ctx.storage.getUrl(storageId)).toBeNull()
    })
  })

  it("removeOrgAvatar is rejected for editors", async () => {
    const { t, orgId, userId } = await setup("editor")
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.accounts.organization.removeOrgAvatar, { orgId })
    ).rejects.toThrow()
  })

  it("applyOrgAvatar swaps the stored file and audits logoUpdated", async () => {
    const { t, orgId, userId } = await setup("admin")
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["img"], { type: "image/png" }))
    )
    await t.mutation(internal.accounts.organization.applyOrgAvatar, {
      orgId,
      storageId,
      actorId: userId,
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(row?.imageId).toBe(storageId)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.logoUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("HR Person")
    })
  })

  it("setOrgAvatar is rejected for editors before any storage write", async () => {
    const { t, orgId, userId } = await setup("editor")
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["img"], { type: "image/png" }))
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.accounts.organization.setOrgAvatar, { orgId, storageId })
    ).rejects.toThrow()
  })
})

describe("organization name", () => {
  async function setup(role: "admin" | "editor") {
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

  it("updateOrganizationName renames the org and audits nameUpdated (admin only)", async () => {
    const { t, orgId, userId } = await setup("admin")
    await t
      .withIdentity({ subject: userId })
      .mutation(api.accounts.organization.updateOrganizationName, {
        orgId,
        name: "Renamed AB",
      })
    const org = await t.query(
      components.betterAuth.provisioning.getOrganization,
      { orgId }
    )
    expect(org?.name).toBe("Renamed AB")
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.nameUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const payload = audit[0].payload as {
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.changes.name.to).toBe("Renamed AB")
    })
  })

  it("updateOrganizationName rejects an empty name", async () => {
    const { t, orgId, userId } = await setup("admin")
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.accounts.organization.updateOrganizationName, {
          orgId,
          name: "   ",
        })
    ).rejects.toThrow()
  })

  it("updateOrganizationName is admin-only", async () => {
    const { t, orgId, userId } = await setup("editor")
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.accounts.organization.updateOrganizationName, {
          orgId,
          name: "Nope AB",
        })
    ).rejects.toThrow()
  })
})

describe("organization members", () => {
  async function setupWithSecond(secondRole: "admin" | "editor") {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "admin@acme.se", name: "Admin One", role: "admin" }
    )
    const second = await t.mutation(
      components.betterAuth.provisioning.provisionUser,
      { email: "two@acme.se", name: "Member Two" }
    )
    await t.mutation(components.betterAuth.provisioning.addMember, {
      organizationId: orgId,
      userId: second.userId,
      role: secondRole,
    })
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: userId,
        email: "admin@acme.se",
        name: "Admin One",
      })
      await onUserCreate(ctx, {
        _id: second.userId,
        email: "two@acme.se",
        name: "Member Two",
      })
      await ctx.db.insert("organizations", { orgId })
    })
    return { t, orgId, adminId: userId, secondId: second.userId }
  }

  it("listOrgMembers returns the roster for an admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.listOrgMembers, { orgId })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.role).sort()).toEqual(["admin", "editor"])
  })

  it("listOrgMembers is admin-only", async () => {
    const { t, orgId, secondId } = await setupWithSecond("editor")
    await expect(
      t
        .withIdentity({ subject: secondId })
        .query(api.accounts.organization.listOrgMembers, { orgId })
    ).rejects.toThrow()
  })

  it("updateMemberRole promotes an editor and audits member.roleChanged", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("editor")
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateMemberRole, {
        orgId,
        userId: secondId,
        role: "admin",
      })
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "member.roleChanged")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("Admin One")
      const p = audit[0].payload as {
        memberUserId: string
        changes: { role: { from: unknown; to: unknown } }
      }
      expect(p.memberUserId).toBe(secondId)
      expect(p.changes.role).toEqual({ from: "editor", to: "admin" })
    })
  })

  it("updateMemberRole refuses to demote the sole admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    await expect(
      t
        .withIdentity({ subject: adminId })
        .mutation(api.accounts.organization.updateMemberRole, {
          orgId,
          userId: adminId,
          role: "editor",
        })
    ).rejects.toThrow()
  })

  it("updateMemberRole allows demoting one admin when two exist", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("admin")
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateMemberRole, {
        orgId,
        userId: secondId,
        role: "editor",
      })
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.listOrgMembers, { orgId })
    expect(rows.find((r) => r.userId === secondId)?.role).toBe("editor")
  })

  it("removeMember removes a non-sole member and audits member.removed", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("editor")
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.removeMember, {
        orgId,
        userId: secondId,
      })
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "member.removed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const p = audit[0].payload as {
        changes: { role: { from: unknown; to: unknown } }
      }
      expect(p.changes.role).toEqual({ from: "editor", to: null })
    })
  })

  it("removeMember refuses to remove the sole admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    await expect(
      t
        .withIdentity({ subject: adminId })
        .mutation(api.accounts.organization.removeMember, {
          orgId,
          userId: adminId,
        })
    ).rejects.toThrow()
  })
})
