import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"
import {
  onInvitationCreate,
  onInvitationUpdate,
  onMemberCreate,
  onMemberDelete,
  onMemberUpdate,
  onOrganizationCreate,
  onUserCreate,
  onUserDelete,
  onUserUpdate,
} from "./mirrors"

const authUser = {
  _id: "ba_user_1",
  _creationTime: 0,
  email: "hr@acme.se",
  name: "HR Person",
}

describe("user mirror triggers", () => {
  it("onUserCreate inserts a mirror row, idempotently", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserCreate(ctx, authUser) // second run must not duplicate
      const rows = await ctx.db.query("users").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        authId: "ba_user_1",
        email: "hr@acme.se",
        name: "HR Person",
      })
      expect(rows[0].name).toBe("HR Person")
    })
  })

  it("onUserUpdate creates the mirror row when missing (self-heal)", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserUpdate(ctx, { ...authUser, name: "Healed" }, authUser)
      const row = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
      expect(row).toMatchObject({ authId: "ba_user_1", name: "Healed" })
    })
  })

  it("onUserUpdate patches name and email", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserUpdate(ctx, { ...authUser, name: "Renamed" }, authUser)
      const row = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
      expect(row?.name).toBe("Renamed")
    })
  })

  it("onUserDelete removes the mirror row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserDelete(ctx, authUser)
      expect(await ctx.db.query("users").collect()).toHaveLength(0)
    })
  })

  it("onOrganizationCreate seeds an empty profile, idempotently", async () => {
    const t = initConvexTest()
    const org = { _id: "ba_org_1", _creationTime: 0, name: "Acme" }
    await t.run(async (ctx) => {
      await onOrganizationCreate(ctx, org)
      await onOrganizationCreate(ctx, org)
      const rows = await ctx.db.query("organizations").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].orgId).toBe("ba_org_1")
      // Also asserts exactly one organization.created audit row (not duplicated).
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "organization.created")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].actorId).toBe("system")
    })
  })
})

describe("lifecycle audit triggers", () => {
  const member = {
    _id: "ba_member_1",
    _creationTime: 0,
    organizationId: "ba_org_1",
    userId: "ba_user_1",
    role: "editor",
    createdAt: 0,
  }

  const invitation = {
    _id: "ba_inv_1",
    _creationTime: 0,
    organizationId: "ba_org_1",
    email: "new@acme.se",
    role: null,
    status: "pending",
    expiresAt: 9999999999999,
    createdAt: 0,
    inviterId: "ba_user_1",
  }

  it("onMemberCreate logs member.added with role and actorId system", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberCreate(ctx, member)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.added")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].actorId).toBe("system")
      expect(rows[0].payload).toMatchObject({
        memberUserId: "ba_user_1",
        role: "editor",
      })
    })
  })

  it("snapshots actorName as unknown when no mirror row exists", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberCreate(ctx, member)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.added")
        )
        .collect()
      expect(audit[0].actorName).toBe("unknown")
    })
  })

  it("onMemberUpdate logs member.roleChanged only when role changed", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      // Same role: no audit row
      await onMemberUpdate(ctx, member, member)
      const unchanged = await ctx.db.query("auditLog").collect()
      expect(unchanged).toHaveLength(0)

      // Role changed: one audit row
      await onMemberUpdate(ctx, { ...member, role: "admin" }, member)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.roleChanged")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].actorId).toBe("system")
      expect(rows[0].payload).toMatchObject({
        memberUserId: "ba_user_1",
        from: "editor",
        to: "admin",
      })
    })
  })

  it("onMemberDelete logs member.removed with actorId system", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberDelete(ctx, member)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.removed")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].actorId).toBe("system")
      expect(rows[0].payload).toMatchObject({ memberUserId: "ba_user_1" })
    })
  })

  it("onInvitationCreate logs invitation.created", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onInvitationCreate(ctx, invitation)
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.created")
        )
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].payload).toMatchObject({ email: "new@acme.se" })
    })
  })

  it("onInvitationUpdate logs invitation.accepted when status changes to accepted", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onInvitationUpdate(
        ctx,
        { ...invitation, status: "accepted" },
        invitation
      )
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.accepted")
        )
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  it("onInvitationUpdate logs invitation.revoked for other status changes", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onInvitationUpdate(
        ctx,
        { ...invitation, status: "revoked" },
        invitation
      )
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.revoked")
        )
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  it("onInvitationUpdate emits nothing when status unchanged", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onInvitationUpdate(ctx, invitation, invitation)
      expect(await ctx.db.query("auditLog").collect()).toHaveLength(0)
    })
  })
})
