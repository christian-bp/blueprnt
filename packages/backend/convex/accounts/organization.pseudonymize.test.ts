import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { onUserCreate } from "./mirrors"

// Seeds a minimal org with one admin member (mirrored into users so logAudit
// can resolve the actor name), plus the trigger-seeded organizations row.
async function setup(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId: adminId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "admin@acme.se", name: "Admin Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await onUserCreate(ctx, {
      _id: adminId,
      email: "admin@acme.se",
      name: "Admin Person",
    })
    await ctx.db.insert("organizations", { orgId })
  })
  return { orgId, adminId }
}

describe("pseudonymizeNames org setting", () => {
  it("getOrganizationSettings returns pseudonymizeNames: false for a fresh org (field absent)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const settings = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.getOrganizationSettings, { orgId })
    expect(settings.pseudonymizeNames).toBe(false)
  })

  it("updateOrganizationSettings({ pseudonymizeNames: true }) persists and is readable", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        pseudonymizeNames: true,
      })
    const settings = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.getOrganizationSettings, { orgId })
    expect(settings.pseudonymizeNames).toBe(true)
  })

  it("toggling pseudonymizeNames writes an organization.settingsUpdated audit row with the change in its diff", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        pseudonymizeNames: true,
      })
    // Read the audit log and find the settingsUpdated row.
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        category: "organization",
        paginationOpts: { numItems: 50, cursor: null },
      })
    const settingsRow = result.page.find(
      (r) => r.type === "organization.settingsUpdated"
    )
    expect(settingsRow).toBeDefined()
    // The payload's changes map must include pseudonymizeNames: { from: null, to: true }.
    const changes = (settingsRow?.payload as Record<string, unknown>)
      ?.changes as Record<string, { from: unknown; to: unknown }> | undefined
    expect(changes?.pseudonymizeNames).toEqual({ from: null, to: true })
  })
})
