import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds an org with an admin, then adds an editor to the SAME org (the
// seedMembership helper would otherwise mint a fresh org each call). Returns
// both subjects plus the shared orgId.
async function setup(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId: adminId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "admin@acme.se", name: "Admin Person", role: "admin" }
  )
  const { userId: editorId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "editor@other.se", name: "Editor Person", role: "editor" }
  )
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId: editorId,
    role: "editor",
  })
  return { orgId, adminId, editorId }
}

describe("accounts.audit.listAuditLog", () => {
  it("returns the org's own rows newest-first for an admin", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        orgId,
        type: "organization.created",
        actorId: adminId,
        actorName: "Admin Person",
        payload: {},
      })
      await ctx.db.insert("auditLog", {
        orgId,
        type: "role.created",
        actorId: adminId,
        actorName: "Admin Person",
        payload: { roleId: "r1" },
      })
    })
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, { orgId })
    expect(rows).toHaveLength(2)
    // Newest first: the role.created row was inserted after organization.created.
    expect(rows[0]?.type).toBe("role.created")
    expect(rows[1]?.type).toBe("organization.created")
    expect(rows[0]?.actorName).toBe("Admin Person")
    expect(rows[0]?.at).toBeGreaterThanOrEqual(rows[1]?.at ?? 0)
  })

  it("only returns rows for the caller's org (tenant isolation)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        orgId,
        type: "role.created",
        actorId: adminId,
        actorName: "Admin Person",
        payload: {},
      })
      // A row belonging to a DIFFERENT org must never surface.
      await ctx.db.insert("auditLog", {
        orgId: "other-org",
        type: "role.created",
        actorId: "someone",
        actorName: "Someone Else",
        payload: {},
      })
    })
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, { orgId })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorName).toBe("Admin Person")
  })

  it("rejects an editor with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, editorId } = await setup(t)
    await expect(
      t
        .withIdentity({ subject: editorId })
        .query(api.accounts.audit.listAuditLog, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects an unauthenticated caller with errors.notAuthenticated", async () => {
    const t = initConvexTest()
    const { orgId } = await setup(t)
    await expect(
      t.query(api.accounts.audit.listAuditLog, { orgId })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })
})
