import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { onUserCreate } from "./mirrors"

describe("workspace profile", () => {
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
      await ctx.db.insert("workspaceProfiles", { orgId })
    })
    return { t, orgId, userId }
  }

  it("getWorkspaceProfile returns the profile for members", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asMember = t.withIdentity({ subject: userId })
    const profile = await asMember.query(
      api.accounts.workspace.getWorkspaceProfile,
      { orgId }
    )
    expect(profile).toMatchObject({ orgId, country: null })
  })

  it("updateWorkspaceProfile is admin-only and audited", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.accounts.workspace.updateWorkspaceProfile, {
      orgId,
      country: "SE",
      currency: "SEK",
      language: "sv",
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("workspaceProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(profile).toMatchObject({ country: "SE", currency: "SEK" })
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "workspace.profileUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("HR Person")
    })
  })

  it("updateWorkspaceProfile rejects editors", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.workspace.updateWorkspaceProfile, {
        orgId,
        country: "SE",
      })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})
