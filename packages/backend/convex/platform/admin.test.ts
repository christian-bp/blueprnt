import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedMirroredUser(
  t: ReturnType<typeof initConvexTest>,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Operator", role: "admin" }
  )
  await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
    authId: userId,
    email,
    name: "Operator",
  })
  return userId
}

describe("isPlatformAdmin", () => {
  it("returns false for a signed-out caller", async () => {
    const t = initConvexTest()
    expect(await t.query(api.platform.admin.isPlatformAdmin, {})).toBe(false)
  })

  it("returns false for a normal user, true after granting", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "ops@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      false
    )
    const granted = await t.mutation(
      internal.platform.bootstrap.grantPlatformAdminByEmail,
      { email: "ops@blueprnt.se" }
    )
    expect(granted).toBe(true)
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      true
    )
  })

  it("revoke flips it back to false", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "ops@blueprnt.se")
    await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    await t.mutation(internal.platform.bootstrap.revokePlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    const asUser = t.withIdentity({ subject: userId })
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      false
    )
  })

  it("audits a successful grant and revoke, not a no-match email", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "ops@blueprnt.se")
    // No-match email: returns false and writes nothing.
    const missed = await t.mutation(
      internal.platform.bootstrap.grantPlatformAdminByEmail,
      { email: "nobody@blueprnt.se" }
    )
    expect(missed).toBe(false)
    let plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    expect(plat).toHaveLength(0)

    // Successful grant: one platform.adminGranted row, attributed out-of-band.
    await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const granted = plat.find((r) => r.type === "platform.adminGranted")
    expect(granted?.actorId).toBe("system:cli")
    expect(granted?.targetUserId).toBe(userId)
    expect(granted?.payload).toEqual({})

    // Successful revoke: one platform.adminRevoked row.
    await t.mutation(internal.platform.bootstrap.revokePlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const revoked = plat.find((r) => r.type === "platform.adminRevoked")
    expect(revoked?.actorId).toBe("system:cli")
    expect(revoked?.targetUserId).toBe(userId)
    expect(revoked?.payload).toEqual({})
  })
})

async function seedPlatformAdmin(t: ReturnType<typeof initConvexTest>) {
  const userId = await seedMirroredUser(t, "operator@blueprnt.se")
  await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
    email: "operator@blueprnt.se",
  })
  return userId
}

describe("createUser / createOrganization", () => {
  it("rejects a non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.mutation(api.platform.admin.createUser, {
        name: "X",
        email: "x@y.se",
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })

  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.platform.admin.createOrganization, {
        name: "Acme",
        slug: "acme",
      })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("creates a user and writes a platform audit row", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId, created } = await asAdmin.mutation(
      api.platform.admin.createUser,
      { name: "New Hire", email: "hire@acme.se" }
    )
    expect(created).toBe(true)
    expect(typeof authId).toBe("string")
    // The platform audit row exists, carries the operator, and no PII payload.
    const rows = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const created_row = rows.find((r) => r.type === "platform.userCreated")
    expect(created_row?.actorId).toBe(adminId)
    expect(created_row?.targetUserId).toBe(authId)
    expect(created_row?.payload).toEqual({})
  })

  it("createUser is idempotent by email", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const first = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
    })
    const second = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
    })
    expect(second.created).toBe(false)
    expect(second.authId).toBe(first.authId)
    // The idempotent second call created nothing, so it must NOT write a
    // second platform.userCreated row: exactly one creation was audited.
    const rows = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    expect(rows.filter((r) => r.type === "platform.userCreated")).toHaveLength(
      1
    )
  })

  it("creates an org: admin log records the operator, org log stays system", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-1" }
    )
    // Admin log: operator-attributed.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const created = plat.find((r) => r.type === "platform.orgCreated")
    expect(created?.actorId).toBe(adminId)
    expect(created?.targetOrgId).toBe(orgId)
    // Org log: the org's own birth event, NEVER operator-attributed (proves
    // the admin and org logs stay separate).
    const orgAudit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    expect(orgAudit.every((r) => r.actorId !== adminId)).toBe(true)
  })

  it("rejects createOrganization with an invalid slug", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.mutation(api.platform.admin.createOrganization, {
        name: "Acme",
        slug: "Acme AB",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("normalizes createUser email to lowercase (idempotent across case)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const first = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Mixed",
      email: "Mixed.Case@Acme.SE",
    })
    expect(first.created).toBe(true)
    // A different-case variant resolves to the SAME user (no duplicate).
    const second = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Mixed",
      email: "mixed.case@acme.se",
    })
    expect(second.created).toBe(false)
    expect(second.authId).toBe(first.authId)
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    expect(users.some((u) => u.email === "mixed.case@acme.se")).toBe(true)
    expect(users.some((u) => u.email === "Mixed.Case@Acme.SE")).toBe(false)
  })
})

describe("membership management", () => {
  it("connects a user to an org, sets role, removes (full cycle)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Member",
      email: "member@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-2" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.setMembershipRole, {
      authId,
      orgId,
      role: "admin",
    })
    await asAdmin.mutation(api.platform.admin.removeMembership, {
      authId,
      orgId,
    })
    // Every action is recorded in the ADMIN log, attributed to the operator.
    const events = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const types = events.map((e) => e.type)
    expect(types).toContain("platform.membershipGranted")
    expect(types).toContain("platform.membershipRoleChanged")
    expect(types).toContain("platform.membershipRevoked")
    // Every admin-page action is operator-attributed. The seeded grant in
    // setup is the only out-of-band row (actorId "system:cli").
    for (const e of events) {
      if (e.type === "platform.adminGranted") {
        expect(e.actorId).toBe("system:cli")
      } else {
        expect(e.actorId).toBe(adminId)
      }
    }
    // The org's own auditLog received NO operator-attributed rows (the two
    // logs stay separate).
    const orgEvents = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    expect(orgEvents.every((e) => e.actorId !== adminId)).toBe(true)
  })

  it("rejects addMembership for an unknown org", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "M",
      email: "m@acme.se",
    })
    await expect(
      asAdmin.mutation(api.platform.admin.addMembership, {
        authId,
        orgId: "nonexistent",
        role: "editor",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "x@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.mutation(api.platform.admin.removeMembership, {
        authId: "a",
        orgId: "b",
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("platform queries + updateOrganization", () => {
  it("lists users and orgs and marks the platform admin", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Plain",
      email: "plain@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Acme",
      slug: "acme-3",
    })
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    const operator = users.find((u) => u.email === "operator@blueprnt.se")
    const plain = users.find((u) => u.email === "plain@acme.se")
    expect(operator?.isPlatformAdmin).toBe(true)
    expect(plain?.isPlatformAdmin).toBe(false)
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    expect(orgs.some((o) => o.slug === "acme-3")).toBe(true)
  })

  it("listUsers rejects a non-admin", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "x2@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.listUsers, {})
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })

  it("updates org settings and audits the change", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-4" }
    )
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
      currency: "SEK",
    })
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    const row = orgs.find((o) => o.orgId === orgId)
    expect(row?.country).toBe("se")
    expect(row?.currency).toBe("SEK")
    // Only the provided fields land in the audit payload, nothing more.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const updated = plat.find((r) => r.type === "platform.orgUpdated")
    expect(updated?.payload).toEqual({ changed: ["country", "currency"] })

    // Re-submitting the SAME values is a no-op: no second orgUpdated row.
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
      currency: "SEK",
    })
    const platAfter = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    expect(
      platAfter.filter((r) => r.type === "platform.orgUpdated")
    ).toHaveLength(1)
  })

  it("audits only the settings that actually change", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-partial" }
    )
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
      currency: "SEK",
    })
    // country unchanged, currency changed: only currency is audited.
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
      currency: "NOK",
    })
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const updates = plat.filter((r) => r.type === "platform.orgUpdated")
    expect(updates).toHaveLength(2)
    expect(updates[1]?.payload).toEqual({ changed: ["currency"] })
  })

  it("skips the audit on an all-empty no-op update", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-noop" }
    )
    // The frontend sends all four settings from controlled inputs, often "".
    // An all-empty call writes nothing and must not log a platform.orgUpdated
    // row.
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "",
      currency: "",
      language: "",
      industry: "",
    })
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    expect(plat.filter((r) => r.type === "platform.orgUpdated")).toHaveLength(0)
    // And nothing was persisted to the org mirror.
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    const row = orgs.find((o) => o.orgId === orgId)
    expect(row?.country).toBeNull()
    expect(row?.currency).toBeNull()
    expect(row?.language).toBeNull()
    expect(row?.industry).toBeNull()
  })

  it("rejects updateOrganization with an invalid slug", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-slug-1" }
    )
    await expect(
      asAdmin.mutation(api.platform.admin.updateOrganization, {
        orgId,
        slug: "Not A Slug",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects updateOrganization when the slug is taken by another org", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "First",
      slug: "taken-slug",
    })
    const { orgId: secondId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Second", slug: "free-slug" }
    )
    // Renaming the second org onto the first's slug aliases two orgs: reject.
    await expect(
      asAdmin.mutation(api.platform.admin.updateOrganization, {
        orgId: secondId,
        slug: "taken-slug",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    // Re-applying its OWN slug is fine (same org, no alias).
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId: secondId,
      slug: "free-slug",
    })
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    expect(orgs.find((o) => o.orgId === secondId)?.slug).toBe("free-slug")
  })
})

describe("listAuditLog", () => {
  it("returns the admin trail newest-first after admin actions", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Logged",
      email: "logged@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Logged Org",
      slug: "logged-org",
    })
    const rows = await asAdmin.query(api.platform.admin.listAuditLog, {})
    const types = rows.map((r) => r.type)
    expect(types).toContain("platform.userCreated")
    expect(types).toContain("platform.orgCreated")
    // Newest first: the org creation came after the user creation.
    const userAt = rows.find((r) => r.type === "platform.userCreated")?.at ?? 0
    const orgAt = rows.find((r) => r.type === "platform.orgCreated")?.at ?? 0
    expect(orgAt).toBeGreaterThanOrEqual(userAt)
    expect(rows[0]?.at).toBeGreaterThanOrEqual(rows[rows.length - 1]?.at ?? 0)
    // Targets resolve to human labels: org name for the org-created row.
    const orgRow = rows.find((r) => r.type === "platform.orgCreated")
    expect(orgRow?.targetOrg).toBe("Logged Org")
    expect(orgRow?.targetUser).toBeNull()
    // The user-created row carries the email label and no org.
    const userRow = rows.find((r) => r.type === "platform.userCreated")
    expect(userRow?.targetUser).toBe("logged@acme.se")
    expect(userRow?.targetOrg).toBeNull()
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody-log@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.listAuditLog, {})
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("deleteUser (erasure)", () => {
  it("removes identity, mirror, memberships and anonymizes audit", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-5" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    // App mirror gone.
    const mirror = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .unique()
    )
    expect(mirror).toBeNull()
    // BA user gone (not in listUsers anymore).
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    expect(users.some((u) => u.authId === authId)).toBe(false)
    // Membership gone.
    const members = await asAdmin.query(
      api.platform.admin.listOrganizationMembers,
      { orgId }
    )
    expect(members.some((m) => m.authId === authId)).toBe(false)
    // platform.userDeleted recorded, no PII payload.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const del = plat.find((r) => r.type === "platform.userDeleted")
    expect(del?.targetUserId).toBe(authId)
    expect(del?.payload).toEqual({ orgCount: 1 })
  })

  it("blocks self-deletion", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.mutation(api.platform.admin.deleteUser, { authId: adminId })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("purges invitations the user received and sent, leaving others", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-inv" }
    )
    // Invitation addressed TO the erased user (invitee email).
    await t.mutation(components.betterAuth.testing.seedInvitation, {
      organizationId: orgId,
      email: "erase@acme.se",
      inviterId: adminId,
    })
    // Invitation SENT BY the erased user (inviterId).
    await t.mutation(components.betterAuth.testing.seedInvitation, {
      organizationId: orgId,
      email: "someone-else@acme.se",
      inviterId: authId,
    })
    // Unrelated invitation that must survive.
    await t.mutation(components.betterAuth.testing.seedInvitation, {
      organizationId: orgId,
      email: "keep@acme.se",
      inviterId: adminId,
    })

    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    const remaining = await t.query(
      components.betterAuth.testing.listInvitations,
      {}
    )
    // Only the unrelated invitation is left.
    expect(remaining).toEqual([{ email: "keep@acme.se", inviterId: adminId }])
  })
})

describe("admin audit log coverage (every action is logged, separately)", () => {
  it("each admin mutation writes a platform.* row and nothing org-attributed", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })

    // Exercise the full set of admin mutations once.
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Audited",
      email: "audited@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-audit" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.setMembershipRole, {
      authId,
      orgId,
      role: "admin",
    })
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
    })
    await asAdmin.mutation(api.platform.admin.removeMembership, {
      authId,
      orgId,
    })
    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    // The seeded grant in setup is out-of-band (actorId "system:cli"); it is a
    // real platform.adminGranted row but not an admin-page action, so it is
    // excluded from the operator-attributed coverage assertions below.
    const operatorRows = plat.filter((r) => r.actorId === adminId)
    const types = operatorRows.map((r) => r.type).sort()
    expect(types).toEqual(
      [
        "platform.membershipGranted",
        "platform.membershipRevoked",
        "platform.membershipRoleChanged",
        "platform.orgCreated",
        "platform.orgUpdated",
        "platform.userCreated",
        "platform.userDeleted",
      ].sort()
    )
    for (const r of plat) {
      expect(r.type.startsWith("platform.")).toBe(true)
    }
    for (const r of operatorRows) {
      expect(r.actorId).toBe(adminId)
    }
    // The out-of-band seeded grant is recorded, attributed to the CLI sentinel.
    expect(
      plat.some(
        (r) => r.type === "platform.adminGranted" && r.actorId === "system:cli"
      )
    ).toBe(true)
    // No operator-attributed rows leaked into ANY org's audit log.
    const orgRows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_actor", (q) => q.eq("actorId", adminId))
        .collect()
    )
    expect(orgRows).toHaveLength(0)
  })
})
