import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { categoryForPlatformEvent } from "../lib/audit"
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

// Convenience: create an org via the admin mutation and return its orgId.
// Uses the given admin identity so the audit row is correctly attributed.
async function seedOrg(
  t: ReturnType<typeof initConvexTest>,
  adminId: string,
  slug: string
) {
  const { orgId } = await t
    .withIdentity({ subject: adminId })
    .mutation(api.platform.admin.createOrganization, { name: slug, slug })
  return orgId
}

describe("createUser / createOrganization", () => {
  it("rejects a non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody@blueprnt.se")
    const adminId = await seedPlatformAdmin(t)
    const orgId = await seedOrg(t, adminId, "test-org-reject")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.mutation(api.platform.admin.createUser, {
        name: "X",
        email: "x@y.se",
        orgId,
        role: "editor",
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
    const orgId = await seedOrg(t, adminId, "acme-cu")
    const { authId, created } = await asAdmin.mutation(
      api.platform.admin.createUser,
      { name: "New Hire", email: "hire@acme.se", orgId, role: "editor" }
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
    const orgId = await seedOrg(t, adminId, "acme-idem")
    const first = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
      orgId,
      role: "editor",
    })
    const second = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
      orgId,
      role: "editor",
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
    const orgId = await seedOrg(t, adminId, "acme-case")
    const first = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Mixed",
      email: "Mixed.Case@Acme.SE",
      orgId,
      role: "editor",
    })
    expect(first.created).toBe(true)
    // A different-case variant resolves to the SAME user (no duplicate).
    const second = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Mixed",
      email: "mixed.case@acme.se",
      orgId,
      role: "editor",
    })
    expect(second.created).toBe(false)
    expect(second.authId).toBe(first.authId)
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    expect(users.some((u) => u.email === "mixed.case@acme.se")).toBe(true)
    expect(users.some((u) => u.email === "Mixed.Case@Acme.SE")).toBe(false)
  })

  it("createUser requires the org to exist, throws notFound otherwise", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.mutation(api.platform.admin.createUser, {
        name: "Nobody",
        email: "nobody@acme.se",
        orgId: "nonexistent-org-id",
        role: "editor",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("createUser attaches the user to the org atomically", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-atomic")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Member",
      email: "member@acme-atomic.se",
      orgId,
      role: "editor",
    })
    // The user should immediately be a member of the org.
    const members = await asAdmin.query(
      api.platform.admin.listOrganizationMembers,
      { orgId }
    )
    expect(
      members.some((m) => m.authId === authId && m.role === "editor")
    ).toBe(true)
    // Both the userCreated and membershipGranted rows are present.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const types = plat.map((r) => r.type)
    expect(types).toContain("platform.userCreated")
    expect(types).toContain("platform.membershipGranted")
  })
})

describe("membership management", () => {
  it("connects a user to an org, sets role, removes (full cycle)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-2")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Member",
      email: "member@acme.se",
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
    const orgId = await seedOrg(t, adminId, "acme-addm")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "M",
      email: "m@acme.se",
      orgId,
      role: "editor",
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
    const orgId = await seedOrg(t, adminId, "acme-3")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Plain",
      email: "plain@acme.se",
      orgId,
      role: "editor",
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
    expect(updated?.payload).toEqual({
      changes: {
        country: { from: null, to: "se" },
        currency: { from: null, to: "SEK" },
      },
    })

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
    expect(updates[1]?.payload).toEqual({
      changes: { currency: { from: "SEK", to: "NOK" } },
    })
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

describe("listOrganizationsForUser", () => {
  it("returns the membership's orgId, name, and role for a user in one org", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "org-for-user")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Member",
      email: "member@org-for-user.se",
      orgId,
      role: "editor",
    })
    const result = await asAdmin.query(
      api.platform.admin.listOrganizationsForUser,
      { authId }
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.orgId).toBe(orgId)
    expect(typeof result[0]?.name).toBe("string")
    expect(result[0]?.name.length).toBeGreaterThan(0)
    expect(result[0]?.role).toBe("editor")
  })

  it("returns [] for a user with no memberships", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Provision a user without attaching to any org (direct BA provision, no
    // createUser which always grants membership). We use seedMirroredUser for
    // the BA user row but that also grants a membership via seedMembership, so
    // instead provision via betterAuth directly and check with a known authId.
    // The simplest approach: use an authId that has never been given a membership.
    const result = await asAdmin.query(
      api.platform.admin.listOrganizationsForUser,
      { authId: "user-with-no-memberships" }
    )
    expect(result).toEqual([])
  })

  it("rejects a non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "non-admin@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.listOrganizationsForUser, {
        authId: userId,
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("categoryForPlatformEvent", () => {
  it("maps each platform.* event to its category, unknowns to undefined", () => {
    expect(categoryForPlatformEvent("platform.userCreated")).toBe("user")
    expect(categoryForPlatformEvent("platform.userDeleted")).toBe("user")
    expect(categoryForPlatformEvent("platform.orgCreated")).toBe("organization")
    expect(categoryForPlatformEvent("platform.orgUpdated")).toBe("organization")
    expect(categoryForPlatformEvent("platform.membershipGranted")).toBe(
      "membership"
    )
    expect(categoryForPlatformEvent("platform.membershipRoleChanged")).toBe(
      "membership"
    )
    expect(categoryForPlatformEvent("platform.membershipRevoked")).toBe(
      "membership"
    )
    expect(categoryForPlatformEvent("platform.adminGranted")).toBe("admin")
    expect(categoryForPlatformEvent("platform.adminRevoked")).toBe("admin")
    // Unknown / org-log event types are uncategorized, never misfiled.
    expect(categoryForPlatformEvent("platform.unknown")).toBeUndefined()
    expect(categoryForPlatformEvent("role.created")).toBeUndefined()
    expect(categoryForPlatformEvent("")).toBeUndefined()
  })
})

describe("listAuditLog (paginated browse)", () => {
  it("paginates the admin trail newest-first across two pages", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Five audited admin actions across categories. Each createUser needs an
    // org; share one org for U1/U2/U3 since the test focuses on pagination
    // ordering, not membership isolation.
    const orgId = await seedOrg(t, adminId, "org-paginate")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U1",
      email: "u1@acme.se",
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U2",
      email: "u2@acme.se",
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Org One",
      slug: "org-one",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Org Two",
      slug: "org-two",
    })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U3",
      email: "u3@acme.se",
      orgId,
      role: "editor",
    })
    // The seeded grant plus orgCreated for "org-paginate" plus the five above =
    // 8 rows total; we just need more than 3 for the two-page test.
    const page1 = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 3, cursor: null },
    })
    expect(page1.page).toHaveLength(3)
    expect(page1.isDone).toBe(false)
    expect(typeof page1.continueCursor).toBe("string")
    // Newest-first: timestamps are non-increasing down the page.
    expect(page1.page[0]?.at).toBeGreaterThanOrEqual(page1.page[1]?.at ?? 0)
    expect(page1.page[1]?.at).toBeGreaterThanOrEqual(page1.page[2]?.at ?? 0)
    // The newest row resolves its target to the user's NAME (falling back to
    // email), and is not flagged as a deleted target.
    const newest = page1.page[0]
    expect(newest?.type).toBe("platform.membershipGranted")

    const page2 = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 3, cursor: page1.continueCursor },
    })
    expect(page2.page).toHaveLength(3)
    // The oldest row on page 1 is newer than the newest row on page 2.
    const lastOfPage1 = page1.page[page1.page.length - 1]?.at ?? 0
    expect(lastOfPage1).toBeGreaterThanOrEqual(page2.page[0]?.at ?? 0)
  })

  it("flags a deleted target instead of returning its raw id", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // A row whose target user no longer exists (e.g. erased): the resolver must
    // return a null label + a missing flag, never the raw id.
    await t.run(async (ctx) => {
      await ctx.db.insert("platformAuditLog", {
        actorId: "system:cli",
        actorName: "system",
        type: "platform.userCreated",
        targetUserId: "deleted-user-id",
        category: "user",
        searchText: "system platform.usercreated",
        payload: {},
      })
    })
    const result = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 50, cursor: null },
    })
    const ghost = result.page.find(
      (r) => r.actorId === "system:cli" && r.type === "platform.userCreated"
    )
    expect(ghost?.targetUser).toBeNull()
    expect(ghost?.targetUserMissing).toBe(true)
  })

  it("filters by category: organization narrows to org rows", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "filter-org")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Plain",
      email: "plain@acme.se",
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Filtered Org",
      slug: "filtered-org",
    })

    const orgOnly = await asAdmin.query(api.platform.admin.listAuditLog, {
      category: "organization",
      paginationOpts: { numItems: 50, cursor: null },
    })
    // "filter-org" + "filtered-org" = 2 orgCreated rows.
    expect(orgOnly.page.length).toBeGreaterThanOrEqual(1)
    expect(orgOnly.page.every((r) => r.category === "organization")).toBe(true)

    // An invalid category falls back to the full trail.
    const all = await asAdmin.query(api.platform.admin.listAuditLog, {
      category: "not-a-real-category",
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(all.page.length).toBeGreaterThanOrEqual(2)
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody-log@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.listAuditLog, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

// Inserts `count` platform audit rows directly (each insert gets a strictly
// increasing _creationTime under convex-test), returning their observed creation
// times in insertion order (oldest first). Range-test bounds are derived from
// these real times, never from Date.now(), so the partitions are deterministic.
// searchText carries the actor name so the search range test can match a term.
async function seedPlatformRows(
  t: ReturnType<typeof initConvexTest>,
  count: number,
  category = "user",
  type = "platform.userCreated"
): Promise<number[]> {
  return await t.run(async (ctx) => {
    const times: number[] = []
    for (let i = 0; i < count; i++) {
      const id = await ctx.db.insert("platformAuditLog", {
        actorId: "operator-id",
        actorName: "operator",
        type,
        category,
        searchText: `operator ${type.toLowerCase()}`,
        payload: {},
      })
      const row = await ctx.db.get(id)
      times.push(row?._creationTime ?? 0)
    }
    return times
  })
}

describe("listAuditLog (date range)", () => {
  it("no range returns all rows; a range before all rows returns none", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // The seeded grant adds one baseline row; add four more of our own.
    const times = await seedPlatformRows(t, 4)

    const all = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 50, cursor: null },
    })
    // Four seeded plus the one out-of-band grant row.
    expect(all.page.length).toBe(5)

    // A window that ends well before the oldest row returns nothing. The grant
    // row precedes times[0] by only milliseconds, so the window must sit clearly
    // before times[0] (both bounds a large offset earlier), not merely below it
    // with an end of times[0] - 1: otherwise the grant row lands inside the
    // range whenever it is created 1+ ms before times[0], a timing flake.
    const before = await asAdmin.query(api.platform.admin.listAuditLog, {
      start: times[0] - 2_000_000,
      end: times[0] - 1_000_000,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(before.page).toHaveLength(0)
  })

  it("start-only keeps rows at or after the bound, newest-first (by_creation_time)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const times = await seedPlatformRows(t, 4)
    const fromThird = times[2] as number
    const result = await asAdmin.query(api.platform.admin.listAuditLog, {
      start: fromThird,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(2)
    expect(result.page.every((r) => r.at >= fromThird)).toBe(true)
    expect(result.page[0]?.at).toBeGreaterThanOrEqual(result.page[1]?.at ?? 0)
  })

  it("start+end keeps only the inclusive window (no category)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const times = await seedPlatformRows(t, 5)
    const lo = times[1] as number
    const hi = times[3] as number
    const result = await asAdmin.query(api.platform.admin.listAuditLog, {
      start: lo,
      end: hi,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(3)
    expect(result.page.every((r) => r.at >= lo && r.at <= hi)).toBe(true)
  })

  it("category and date range compose (by_category)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Three user rows, then two organization rows (newer).
    const userTimes = await seedPlatformRows(
      t,
      3,
      "user",
      "platform.userCreated"
    )
    await seedPlatformRows(t, 2, "organization", "platform.orgCreated")
    // Range covering only the two newest user rows; category pins to user, so
    // the newer organization rows are excluded by the category filter and the
    // oldest user row is excluded by the lower bound.
    const lo = userTimes[1] as number
    const result = await asAdmin.query(api.platform.admin.listAuditLog, {
      category: "user",
      start: lo,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(2)
    expect(result.page.every((r) => r.category === "user")).toBe(true)
    expect(result.page.every((r) => r.at >= lo)).toBe(true)
  })
})

describe("platform.admin.auditLogBounds", () => {
  it("returns earliest === null for an empty log", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    // seedPlatformAdmin writes a baseline grant row; clear the log so it is
    // genuinely empty for this assertion.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("platformAuditLog").collect()) {
        await ctx.db.delete(row._id)
      }
    })
    const bounds = await t
      .withIdentity({ subject: adminId })
      .query(api.platform.admin.auditLogBounds, {})
    expect(bounds.earliest).toBeNull()
  })

  it("returns the oldest row's creation time after inserting rows", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    // Clear the baseline grant row so the oldest row is deterministically the
    // first one we insert.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("platformAuditLog").collect()) {
        await ctx.db.delete(row._id)
      }
    })
    const times = await seedPlatformRows(t, 3)
    const bounds = await t
      .withIdentity({ subject: adminId })
      .query(api.platform.admin.auditLogBounds, {})
    expect(bounds.earliest).toBe(times[0])
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody-bounds@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.auditLogBounds, {})
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("searchAuditLog (date range)", () => {
  it("applies a date range in memory over the matched rows", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Four rows all matching "operator" via searchText, strictly increasing.
    const times = await seedPlatformRows(t, 4)

    const all = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "operator",
    })
    // Four seeded plus the seeded-grant row (its searchText also has "operator").
    expect(all.rows.length).toBeGreaterThanOrEqual(4)

    // end = the second seeded row's time: the two newer seeded rows are excluded
    // by the in-memory filter even though they match the term.
    const untilSecond = times[1] as number
    const ranged = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "operator",
      end: untilSecond,
    })
    expect(ranged.rows.every((r) => r.at <= untilSecond)).toBe(true)
    // The two newest seeded rows (times[2], times[3]) must not appear.
    expect(ranged.rows.some((r) => r.at === times[2])).toBe(false)
    expect(ranged.rows.some((r) => r.at === times[3])).toBe(false)
  })
})

describe("searchAuditLog", () => {
  it("hits a term in searchText (actor name) and misses an unrelated term", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Searchable Org",
      slug: "searchable-org",
    })
    // searchText includes the actor name ("operator", from seedPlatformAdmin).
    const hit = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "operator",
    })
    expect(hit.rows.length).toBeGreaterThanOrEqual(1)
    expect(hit.rows.some((r) => r.type === "platform.orgCreated")).toBe(true)

    const miss = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "zzzznomatch",
    })
    expect(miss.rows).toHaveLength(0)
  })

  it("hits a payload code in searchText (a membership role)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "coded-org")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Coded",
      email: "coded@acme.se",
      orgId,
      role: "editor",
    })
    // createUser grants the membership and logs membershipGranted, whose
    // { role: "editor" } payload puts the role code into searchText.
    const result = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "editor",
    })
    expect(
      result.rows.some((r) => r.type === "platform.membershipGranted")
    ).toBe(true)
  })

  it("narrows search results by category", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Both rows share the actor name "operator" but live in different
    // categories.
    const orgId = await seedOrg(t, adminId, "o-org")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U",
      email: "u@acme.se",
      orgId,
      role: "editor",
    })
    const orgOnly = await asAdmin.query(api.platform.admin.searchAuditLog, {
      search: "operator",
      category: "organization",
    })
    expect(orgOnly.rows.length).toBeGreaterThanOrEqual(1)
    expect(orgOnly.rows.every((r) => r.category === "organization")).toBe(true)
    expect(orgOnly.rows.some((r) => r.type === "platform.userCreated")).toBe(
      false
    )
  })

  it("returns no rows for an empty / whitespace search", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "org-empty-search")
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U",
      email: "u@acme.se",
      orgId,
      role: "editor",
    })
    expect(
      (await asAdmin.query(api.platform.admin.searchAuditLog, { search: "" }))
        .rows
    ).toHaveLength(0)
    expect(
      (
        await asAdmin.query(api.platform.admin.searchAuditLog, {
          search: "   ",
        })
      ).rows
    ).toHaveLength(0)
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody-search@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.searchAuditLog, { search: "x" })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("platform audit row: stored category + PII-free searchText", () => {
  it("stores the production category and a PII-free searchText", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "org-pii-check")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Target Person",
      email: "target.person@acme.se",
      orgId,
      role: "editor",
    })
    const stored = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const row = stored.find((r) => r.type === "platform.userCreated")
    // Category is derived on insert.
    expect(row?.category).toBe("user")
    // searchText carries the actor name and the event type.
    expect(row?.searchText).toContain("operator")
    expect(row?.searchText).toContain("platform.usercreated")
    // PII regression guard: the target's email/name is NOT in searchText (it is
    // resolved at READ time for display only). The id-only payload here is {},
    // so the target identity never reaches the stored search text.
    expect(row?.searchText).not.toContain("target.person@acme.se")
    expect(row?.searchText).not.toContain("target person")
    // And the target id stays on the row only as an id.
    expect(row?.targetUserId).toBe(authId)
  })
})

describe("deleteUser (erasure)", () => {
  it("removes identity, mirror, memberships and anonymizes audit", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-5")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase@acme.se",
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

  it("hard-deletes the twoFactor credential row and tombstones searchText", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-2fa")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase-2fa@acme.se",
      orgId,
      role: "editor",
    })
    // Every user completes mandatory 2FA, so a twoFactor row exists.
    await t.mutation(components.betterAuth.testing.seedTwoFactorRow, {
      userId: authId,
    })
    // An org audit row authored by the user carries their name in searchText.
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        orgId,
        type: "role.created",
        actorId: authId,
        actorName: "Erase Me",
        payload: {},
        category: "role",
        searchText: "erase me role.created",
      })
    })

    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    // The credential row is gone (GDPR: no residual TOTP secret/backup codes).
    const twoFactorCount = await t.query(
      components.betterAuth.testing.countTwoFactorForUser,
      { userId: authId }
    )
    expect(twoFactorCount).toBe(0)
    // The authored audit row keeps its trail, but the name is tombstoned in BOTH
    // actorName and the denormalized searchText.
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_actor", (q) => q.eq("actorId", authId))
        .collect()
    )
    expect(audit).toHaveLength(1)
    expect(audit[0]?.actorName).toBe("deleted user")
    expect(audit[0]?.searchText).toBe("deleted user role.created")
    expect(audit[0]?.searchText ?? "").not.toContain("erase me")
  })

  it("deletes the erased person's stored avatar file", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-avatar")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Avatar Person",
      email: "avatar@acme.se",
      orgId,
      role: "editor",
    })
    // Attach an avatar to the user's mirror by seeding a stored file and
    // patching imageId directly (the avatar is personal data on the mirror).
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["avatar-bytes"]))
    )
    await t.run(async (ctx) => {
      const mirror = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .unique()
      if (mirror === null) throw new Error("mirror not found")
      await ctx.db.patch(mirror._id, { imageId: storageId })
    })

    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    // The avatar file is gone from storage as part of the erasure.
    const url = await t.run((ctx) => ctx.storage.getUrl(storageId))
    expect(url).toBeNull()
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
    const orgId = await seedOrg(t, adminId, "acme-inv")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase@acme.se",
      orgId,
      role: "editor",
    })
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

  it("schedules a Sweego purge of the erased person's email history", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "acme-purge")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Purge Me",
      email: "purge@acme.se",
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })
    // deleteUser schedules components.sweego.lib.purgeRecipient with the erased
    // person's address so their sent-email history (recipient + body) is removed
    // point-in-time, not just by retention. The purge behavior itself is tested
    // in the Sweego component.
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const purge = scheduled.find((s) => s.name.includes("purgeRecipientEmails"))
    expect(purge).toBeDefined()
    expect(purge?.args).toEqual([{ email: "purge@acme.se" }])
  })
})

describe("admin audit log coverage (every action is logged, separately)", () => {
  it("each admin mutation writes a platform.* row and nothing org-attributed", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })

    // Exercise the full set of admin mutations once. createUser now includes
    // the membership grant, so addMembership is exercised via a second add.
    const orgId = await seedOrg(t, adminId, "acme-audit")
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Audited",
      email: "audited@acme.se",
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
