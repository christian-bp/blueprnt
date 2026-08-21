import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seed(t: ReturnType<typeof initConvexTest>, role: string) {
  return await t.mutation(components.betterAuth.testing.seedMembership, {
    email: "hr@acme.se",
    name: "HR Person",
    role,
  })
}

describe("org-scoping wrappers", () => {
  it("rejects unauthenticated callers", async () => {
    const t = initConvexTest()
    const { orgId } = await seed(t, "editor")
    await expect(
      t.query(api.accounts.context.getOrganizationContext, { orgId })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("rejects authenticated non-members", async () => {
    const t = initConvexTest()
    const { orgId } = await seed(t, "editor")
    const asOutsider = t.withIdentity({ subject: "not-a-member" })
    await expect(
      asOutsider.query(api.accounts.context.getOrganizationContext, { orgId })
    ).rejects.toThrow(/errors.notAMember/)
  })

  it("rejects members of a DIFFERENT org (cross-tenant)", async () => {
    const t = initConvexTest()
    const a = await seed(t, "editor")
    const b = await seed(t, "editor")
    const asMemberOfB = t.withIdentity({ subject: b.userId })
    await expect(
      asMemberOfB.query(api.accounts.context.getOrganizationContext, {
        orgId: a.orgId,
      })
    ).rejects.toThrow(/errors.notAMember/)
  })

  it("returns org context for a member", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asMember = t.withIdentity({ subject: userId })
    const ctx = await asMember.query(
      api.accounts.context.getOrganizationContext,
      {
        orgId,
      }
    )
    expect(ctx).toEqual({ orgId, role: "editor" })
  })

  it("orgMutation allows editors (any member role)", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.context.touchOrganizationAsMember, {
        orgId,
      })
    ).resolves.toBeNull()
  })

  it("adminMutation rejects editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.context.touchOrganization, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("adminMutation allows admins", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await expect(
      asAdmin.mutation(api.accounts.context.touchOrganization, { orgId })
    ).resolves.toBeNull()
  })

  // Defense in depth: the write paths pin a membership's role to the two
  // literals, so an unknown one means the data is wrong. Both gates must DENY
  // it rather than launder it into member access, and they must answer the
  // same way: the action gate accepted any non-null membership row once, while
  // the wrapper beside it refused the very same row.
  it("denies an unknown membership role on both the wrapper and the action gate", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "viewer")
    const asUnknownRole = t.withIdentity({ subject: userId })
    await expect(
      asUnknownRole.mutation(api.accounts.context.touchOrganizationAsMember, {
        orgId,
      })
    ).rejects.toThrow(/errors.membershipConflict/)
    await expect(
      asUnknownRole.action(
        api.accounts.context.touchOrganizationAsMemberAction,
        { orgId }
      )
    ).rejects.toThrow(/errors.membershipConflict/)
  })

  // And the same two gates accept a real role, so the denial above is the
  // role check answering rather than the probes being broken.
  it("accepts a known role on both the wrapper and the action gate", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.context.touchOrganizationAsMember, {
        orgId,
      })
    ).resolves.toBeNull()
    await expect(
      asEditor.action(api.accounts.context.touchOrganizationAsMemberAction, {
        orgId,
      })
    ).resolves.toBeNull()
  })

  it("rejects with errors.membershipConflict on duplicate membership rows", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    // Seed a SECOND member row for the same (org, user). The component query
    // uses .unique() on the organizationId_userId index, so it throws; the
    // wrapper must catch that and fail closed with the conflict code.
    await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
      orgId,
      userId,
      role: "editor",
    })
    const asMember = t.withIdentity({ subject: userId })
    await expect(
      asMember.query(api.accounts.context.getOrganizationContext, { orgId })
    ).rejects.toThrow(/errors.membershipConflict/)
  })
})
