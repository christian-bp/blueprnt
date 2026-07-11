import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
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

// Recursively checks whether an object/array contains a given key anywhere.
// Used to assert PII (the invitee email) never lands in an audit payload.
function hasKeyDeep(value: unknown, key: string): boolean {
  if (value === null || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some((item) => hasKeyDeep(item, key))
  const record = value as Record<string, unknown>
  if (key in record) return true
  return Object.values(record).some((item) => hasKeyDeep(item, key))
}

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

  it("onUserUpdate purges the OLD email's invitations and schedules its mail purge on an email change", async () => {
    const t = initConvexTest()
    // An invitation addressed to the user's OLD email.
    await t.mutation(components.betterAuth.testing.seedInvitation, {
      organizationId: "org_1",
      email: "old@acme.se",
      inviterId: "someone",
    })
    await t.run(async (ctx) => {
      await onUserCreate(ctx, { ...authUser, email: "old@acme.se" })
    })

    // Email change: old@acme.se -> new@acme.se.
    await t.run(async (ctx) => {
      await onUserUpdate(
        ctx,
        { ...authUser, email: "new@acme.se" },
        { ...authUser, email: "old@acme.se" }
      )
    })

    // The invitation to the old address is purged (not orphaned past erasure).
    const remaining = await t.query(
      components.betterAuth.testing.listInvitations,
      {}
    )
    expect(remaining.some((i) => i.email === "old@acme.se")).toBe(false)
    // A Sweego purge of the old address's mail history is scheduled.
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const purge = scheduled.find((s) => s.name.includes("purgeRecipientEmails"))
    expect(purge?.args).toEqual([{ email: "old@acme.se" }])
    // The mirror now holds the new email.
    const row = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
    )
    expect(row?.email).toBe("new@acme.se")
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
      // Intentional id-only marker: changes.orgId goes from null to the org id.
      expect(auditRows[0].payload).toEqual({
        changes: { orgId: { from: null, to: "ba_org_1" } },
      })
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
      // Id + role only (never name/email); role goes from null to the new role.
      expect(rows[0].payload).toEqual({
        memberUserId: "ba_user_1",
        memberId: "ba_member_1",
        changes: { role: { from: null, to: "editor" } },
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
      expect(rows[0].payload).toEqual({
        memberUserId: "ba_user_1",
        memberId: "ba_member_1",
        changes: { role: { from: "editor", to: "admin" } },
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
      // Id + role only; the removed role goes from its value to null.
      expect(rows[0].payload).toEqual({
        memberUserId: "ba_user_1",
        memberId: "ba_member_1",
        changes: { role: { from: "editor", to: null } },
      })
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
      // IDs only: the invitee email must never land in the per-org log.
      // Carries role/status/expiresAt as a created before/after snapshot.
      expect(rows[0].payload).toEqual({
        invitationId: "ba_inv_1",
        changes: {
          role: { from: null, to: null },
          status: { from: null, to: "pending" },
          expiresAt: { from: null, to: 9999999999999 },
        },
      })
      // PII regression: the invitee email must not appear anywhere in the
      // payload, at any depth.
      expect(hasKeyDeep(rows[0].payload, "email")).toBe(false)
      expect(JSON.stringify(rows[0].payload)).not.toContain("new@acme.se")
    })
  })

  it("onInvitationCreate captures a non-null role in the snapshot", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onInvitationCreate(ctx, { ...invitation, role: "admin" })
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.created")
        )
        .collect()
      expect(rows[0].payload).toMatchObject({
        changes: { role: { from: null, to: "admin" } },
      })
      expect(hasKeyDeep(rows[0].payload, "email")).toBe(false)
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
      // status transition captured as before/after; top-level status kept.
      expect(rows[0].payload).toEqual({
        invitationId: "ba_inv_1",
        status: "accepted",
        changes: { status: { from: "pending", to: "accepted" } },
      })
      expect(hasKeyDeep(rows[0].payload, "email")).toBe(false)
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
      // IDs/codes only: invitationId + top-level status + status from/to,
      // never the invitee email.
      expect(rows[0].payload).toEqual({
        invitationId: "ba_inv_1",
        status: "revoked",
        changes: { status: { from: "pending", to: "revoked" } },
      })
      expect(hasKeyDeep(rows[0].payload, "email")).toBe(false)
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

describe("removeSeededOrganization", () => {
  // Seeds a minimal org with an admin, a person, an assignment, a pay record,
  // and an import mapping profile; then tears it down and verifies every row
  // is gone from all four people/pay tables.
  it("clears payRecords, personAssignments, people, and importMappingProfiles for the org", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "sv",
        industry: "itTelecom",
      })
    })

    const asAdmin = t.withIdentity({ subject: userId })

    // Seed a person.
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        country: "SE",
      }
    )

    // Seed a role (required for the assignment).
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })

    // Seed an assignment.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC2",
      levelSource: "confirmed",
    })

    // Seed a pay record.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    // Seed an import mapping profile.
    await t.run(async (ctx) => {
      await ctx.db.insert("importMappingProfiles", {
        orgId,
        columnMap: { displayName: "Namn" },
        updatedAt: Date.now(),
      })
    })

    // Verify rows exist before teardown.
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("people")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(1)
      expect(
        await ctx.db
          .query("personAssignments")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(1)
      expect(
        await ctx.db
          .query("payRecords")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(1)
      expect(
        await ctx.db
          .query("importMappingProfiles")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(1)
    })

    // Run the teardown.
    await t.mutation(internal.accounts.mirrors.removeSeededOrganization, {
      orgId,
    })

    // Every people/pay row must be gone.
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("people")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query("personAssignments")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query("payRecords")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
      expect(
        await ctx.db
          .query("importMappingProfiles")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).toHaveLength(0)
    })
  })
})
