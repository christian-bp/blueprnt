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
    // Five audited admin actions across categories.
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U1",
      email: "u1@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U2",
      email: "u2@acme.se",
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
    })
    // Six rows total (the seeded grant plus the five above).
    const page1 = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 3, cursor: null },
    })
    expect(page1.page).toHaveLength(3)
    expect(page1.isDone).toBe(false)
    expect(typeof page1.continueCursor).toBe("string")
    // Newest-first: timestamps are non-increasing down the page.
    expect(page1.page[0]?.at).toBeGreaterThanOrEqual(page1.page[1]?.at ?? 0)
    expect(page1.page[1]?.at).toBeGreaterThanOrEqual(page1.page[2]?.at ?? 0)
    // The newest row resolves its target label (the last action created U3).
    const newest = page1.page[0]
    expect(newest?.type).toBe("platform.userCreated")
    expect(newest?.targetUser).toBe("u3@acme.se")
    expect(newest?.category).toBe("user")

    const page2 = await asAdmin.query(api.platform.admin.listAuditLog, {
      paginationOpts: { numItems: 3, cursor: page1.continueCursor },
    })
    expect(page2.page).toHaveLength(3)
    expect(page2.isDone).toBe(true)
    // The oldest row on page 1 is newer than the newest row on page 2.
    const lastOfPage1 = page1.page[page1.page.length - 1]?.at ?? 0
    expect(lastOfPage1).toBeGreaterThanOrEqual(page2.page[0]?.at ?? 0)
  })

  it("filters by category: organization narrows to org rows", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Plain",
      email: "plain@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Filtered Org",
      slug: "filtered-org",
    })

    const orgOnly = await asAdmin.query(api.platform.admin.listAuditLog, {
      category: "organization",
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(orgOnly.page).toHaveLength(1)
    expect(orgOnly.page[0]?.type).toBe("platform.orgCreated")
    expect(orgOnly.page[0]?.category).toBe("organization")
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
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Coded",
      email: "coded@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Coded Org", slug: "coded-org" }
    )
    // membershipGranted carries { role: "editor" } in its id-only payload, so
    // the role code lands in searchText (a non-PII payload scalar).
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
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
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U",
      email: "u@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "O",
      slug: "o-org",
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
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "U",
      email: "u@acme.se",
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
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Target Person",
      email: "target.person@acme.se",
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
