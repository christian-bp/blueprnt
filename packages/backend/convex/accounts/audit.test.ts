import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { buildSearchText, categoryForEvent } from "../lib/audit"
import { initConvexTest } from "../testing.helpers"
import { onUserCreate } from "./mirrors"

// Seeds an org with an admin (mirrored into the users table so logAudit can
// resolve the actor name), then adds a same-org editor. Returns both subjects
// plus the shared orgId.
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
  await t.run(async (ctx) => {
    await onUserCreate(ctx, {
      _id: adminId,
      email: "admin@acme.se",
      name: "Admin Person",
    })
    await ctx.db.insert("organizations", { orgId })
  })
  return { orgId, adminId, editorId }
}

// Drives a real createRole mutation so the audit row is written by logAudit
// with category + searchText set (exactly like production), returning the role
// id so tests can assert the per-row names map resolves it.
async function createRole(
  t: ReturnType<typeof initConvexTest>,
  subject: string,
  orgId: string,
  title: string
) {
  return await t
    .withIdentity({ subject })
    .mutation(api.assessment.roles.createRole, {
      orgId,
      title,
      function: "engineering",
      team: "Platform",
      trackKey: "IC",
    })
}

describe("accounts.audit.listAuditLog (browse)", () => {
  it("paginates newest-first across two pages", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // Five audited role creations => five role.created rows.
    const titles = ["Role A", "Role B", "Role C", "Role D", "Role E"]
    for (const title of titles) await createRole(t, adminId, orgId, title)

    const asAdmin = t.withIdentity({ subject: adminId })
    const page1 = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      paginationOpts: { numItems: 3, cursor: null },
    })
    expect(page1.page).toHaveLength(3)
    expect(page1.isDone).toBe(false)
    expect(typeof page1.continueCursor).toBe("string")
    // Newest-first: timestamps are non-increasing down the page.
    expect(page1.page[0]?.at).toBeGreaterThanOrEqual(page1.page[1]?.at ?? 0)
    expect(page1.page[1]?.at).toBeGreaterThanOrEqual(page1.page[2]?.at ?? 0)

    const page2 = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      paginationOpts: { numItems: 3, cursor: page1.continueCursor },
    })
    expect(page2.page).toHaveLength(2)
    expect(page2.isDone).toBe(true)
    // The oldest row on page 1 is newer than the newest row on page 2.
    const lastOfPage1 = page1.page[page1.page.length - 1]?.at ?? 0
    expect(lastOfPage1).toBeGreaterThanOrEqual(page2.page[0]?.at ?? 0)
  })

  it("filters by category: role vs organization", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    await createRole(t, adminId, orgId, "Product Manager")
    // An organization-world audited mutation (settings update).
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        country: "SE",
        currency: "SEK",
      })

    const asAdmin = t.withIdentity({ subject: adminId })
    const roleOnly = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      category: "role",
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(roleOnly.page).toHaveLength(2)
    expect(roleOnly.page.every((r) => r.category === "role")).toBe(true)

    const orgOnly = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      category: "organization",
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(orgOnly.page).toHaveLength(1)
    expect(orgOnly.page[0]?.type).toBe("organization.settingsUpdated")
    expect(orgOnly.page[0]?.category).toBe("organization")
  })

  it("an invalid category falls back to the full by_org trail", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        country: "SE",
      })
    const all = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        category: "not-a-real-category",
        paginationOpts: { numItems: 50, cursor: null },
      })
    // Both the role row and the settings row come back (no filter applied).
    expect(all.page.length).toBeGreaterThanOrEqual(2)
  })

  it("enriches a role row's names with its roleId -> title", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const roleId = await createRole(t, adminId, orgId, "System Developer")
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        category: "role",
        paginationOpts: { numItems: 50, cursor: null },
      })
    const created = result.page.find((r) => r.type === "role.created")
    expect(created?.names[roleId.toString()]).toBe("System Developer")
    // The map is minimal: it carries only the ids this row references.
    expect(Object.keys(created?.names ?? {})).toEqual([roleId.toString()])
  })

  it("enriches a member row's names with its memberUserId -> name", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // A target member, mirrored so the users lookup resolves a display name.
    const memberAuthId = "auth|member-1"
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: memberAuthId,
        email: "member@acme.se",
        name: "Mary Member",
      })
      await ctx.db.insert("auditLog", {
        orgId,
        type: "member.roleChanged",
        actorId: adminId,
        actorName: "Admin Person",
        payload: { memberUserId: memberAuthId, role: "editor" },
        category: categoryForEvent("member.roleChanged"),
        searchText: buildSearchText("Admin Person", "member.roleChanged", {
          memberUserId: memberAuthId,
          role: "editor",
        }),
      })
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        category: "member",
        paginationOpts: { numItems: 50, cursor: null },
      })
    const row = result.page.find((r) => r.type === "member.roleChanged")
    expect(row?.names[memberAuthId]).toBe("Mary Member")
  })

  it("enriches a model row's names with criterionId and modelId", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // A model + criterion in this org, plus an audit row that references both
    // by their top-level payload ids (as the model-editing mutations write).
    const { modelId, criterionId } = await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Standard model",
        bandThresholds: [],
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId,
        modelId,
        name: "Scope of responsibility",
        description: "",
        helpText: "",
        anchors: [],
        weightPoints: 3,
        order: 0,
        isCustom: false,
      })
      await ctx.db.insert("auditLog", {
        orgId,
        type: "model.updated",
        actorId: adminId,
        actorName: "Admin Person",
        payload: { modelId, criterionId, change: "criterion.updated" },
        category: categoryForEvent("model.updated"),
        searchText: buildSearchText("Admin Person", "model.updated", {
          modelId,
          criterionId,
        }),
      })
      return { modelId, criterionId }
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        category: "model",
        paginationOpts: { numItems: 50, cursor: null },
      })
    const row = result.page.find((r) => r.type === "model.updated")
    expect(row?.names[modelId.toString()]).toBe("Standard model")
    expect(row?.names[criterionId.toString()]).toBe("Scope of responsibility")
  })

  it("only returns rows for the caller's org (tenant isolation)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        orgId: "other-org",
        type: "role.created",
        actorId: "someone",
        actorName: "Someone Else",
        payload: {},
        category: "role",
      })
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.listAuditLog, {
        orgId,
        paginationOpts: { numItems: 50, cursor: null },
      })
    expect(result.page).toHaveLength(1)
    expect(result.page.every((r) => r.actorName !== "Someone Else")).toBe(true)
  })

  it("rejects an editor with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, editorId } = await setup(t)
    await expect(
      t
        .withIdentity({ subject: editorId })
        .query(api.accounts.audit.listAuditLog, {
          orgId,
          paginationOpts: { numItems: 10, cursor: null },
        })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects an unauthenticated caller with errors.notAuthenticated", async () => {
    const t = initConvexTest()
    const { orgId } = await setup(t)
    await expect(
      t.query(api.accounts.audit.listAuditLog, {
        orgId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })
})

// Inserts `count` role.created rows for `orgId` directly (each insert gets a
// strictly increasing _creationTime under convex-test), returning their
// observed creation times in insertion order (oldest first). Bounds in the
// range tests are derived from these real times, never from Date.now(), so the
// partitions are deterministic.
async function seedAuditRows(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  adminId: string,
  count: number,
  category = "role",
  type = "role.created"
): Promise<number[]> {
  return await t.run(async (ctx) => {
    const times: number[] = []
    for (let i = 0; i < count; i++) {
      const id = await ctx.db.insert("auditLog", {
        orgId,
        type,
        actorId: adminId,
        actorName: "Admin Person",
        payload: {},
        category,
        searchText: buildSearchText("Admin Person", type, {}),
      })
      const row = await ctx.db.get(id)
      times.push(row?._creationTime ?? 0)
    }
    return times
  })
}

describe("accounts.audit.listAuditLog (date range)", () => {
  it("no range returns all rows; a range before all rows returns none", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })

    const all = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(all.page).toHaveLength(4)

    // A window strictly before the oldest row excludes everything.
    const before = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      start: times[0] - 1000,
      end: times[0] - 1,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(before.page).toHaveLength(0)
  })

  it("start-only keeps rows at or after the bound, newest-first", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })
    // start = the third row's time: rows 3 and 4 remain (inclusive lower bound).
    const fromThird = times[2] as number
    const result = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      start: fromThird,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(2)
    expect(result.page.every((r) => r.at >= fromThird)).toBe(true)
    // Newest-first ordering is preserved under the range.
    expect(result.page[0]?.at).toBeGreaterThanOrEqual(result.page[1]?.at ?? 0)
  })

  it("end-only keeps rows at or before the bound (inclusive)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })
    // end = the second row's time: rows 1 and 2 remain, the newer two drop.
    const untilSecond = times[1] as number
    const result = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      end: untilSecond,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(2)
    expect(result.page.every((r) => r.at <= untilSecond)).toBe(true)
  })

  it("start+end keeps only the inclusive window", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 5)
    const asAdmin = t.withIdentity({ subject: adminId })
    // [row2, row4] inclusive: exactly rows 2, 3, 4 (drops the oldest and newest).
    const lo = times[1] as number
    const hi = times[3] as number
    const result = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      start: lo,
      end: hi,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(3)
    expect(result.page.every((r) => r.at >= lo && r.at <= hi)).toBe(true)
  })

  it("paginates within a range (newest-first across two pages)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 5)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Window covering the newest four rows (rows 2..5).
    const lo = times[1] as number
    const page1 = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      start: lo,
      paginationOpts: { numItems: 2, cursor: null },
    })
    expect(page1.page).toHaveLength(2)
    expect(page1.isDone).toBe(false)
    const page2 = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      start: lo,
      paginationOpts: { numItems: 2, cursor: page1.continueCursor },
    })
    expect(page2.page).toHaveLength(2)
    expect(page2.isDone).toBe(true)
    // All four are in range and globally newest-first across the two pages.
    const ats = [...page1.page, ...page2.page].map((r) => r.at)
    expect(ats.every((at) => at >= lo)).toBe(true)
    for (let i = 1; i < ats.length; i++) {
      expect(ats[i - 1]).toBeGreaterThanOrEqual(ats[i] as number)
    }
  })

  it("category and date range compose", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // Three role rows, then two member rows (all newer than the role rows).
    const roleTimes = await seedAuditRows(t, orgId, adminId, 3, "role")
    await seedAuditRows(t, orgId, adminId, 2, "member", "member.roleChanged")
    const asAdmin = t.withIdentity({ subject: adminId })
    // Range covering only the two newest role rows; category pins to role, so
    // the (newer, in-range) member rows are excluded by the category filter and
    // the oldest role row is excluded by the lower bound.
    const lo = roleTimes[1] as number
    const result = await asAdmin.query(api.accounts.audit.listAuditLog, {
      orgId,
      category: "role",
      start: lo,
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(result.page).toHaveLength(2)
    expect(result.page.every((r) => r.category === "role")).toBe(true)
    expect(result.page.every((r) => r.at >= lo)).toBe(true)
  })
})

describe("accounts.audit.searchAuditLog", () => {
  it("returns rows matching a term present in searchText", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    // searchText includes the actor name ("admin person").
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.searchAuditLog, { orgId, search: "admin" })
    expect(result.rows.length).toBeGreaterThanOrEqual(1)
    expect(result.rows.some((r) => r.type === "role.created")).toBe(true)
  })

  it("matches a changed value (country code) in searchText", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        country: "SE",
      })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.searchAuditLog, { orgId, search: "SE" })
    expect(
      result.rows.some((r) => r.type === "organization.settingsUpdated")
    ).toBe(true)
  })

  it("returns no rows for an unrelated term", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.searchAuditLog, {
        orgId,
        search: "zzzznomatch",
      })
    expect(result.rows).toHaveLength(0)
  })

  it("returns no rows for an empty / whitespace search", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    const asAdmin = t.withIdentity({ subject: adminId })
    expect(
      (
        await asAdmin.query(api.accounts.audit.searchAuditLog, {
          orgId,
          search: "",
        })
      ).rows
    ).toHaveLength(0)
    expect(
      (
        await asAdmin.query(api.accounts.audit.searchAuditLog, {
          orgId,
          search: "   ",
        })
      ).rows
    ).toHaveLength(0)
  })

  it("narrows search results by category", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // Both rows share the term "admin" via the actor name, but live in
    // different categories.
    await createRole(t, adminId, orgId, "System Developer")
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.accounts.organization.updateOrganizationSettings, {
        orgId,
        country: "SE",
      })
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgOnly = await asAdmin.query(api.accounts.audit.searchAuditLog, {
      orgId,
      search: "admin",
      category: "organization",
    })
    expect(orgOnly.rows.length).toBeGreaterThanOrEqual(1)
    expect(orgOnly.rows.every((r) => r.category === "organization")).toBe(true)
    expect(orgOnly.rows.some((r) => r.type === "role.created")).toBe(false)
  })

  it("enriches search rows' names per row", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const roleId = await createRole(t, adminId, orgId, "System Developer")
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.searchAuditLog, { orgId, search: "admin" })
    const created = result.rows.find((r) => r.type === "role.created")
    expect(created?.names[roleId.toString()]).toBe("System Developer")
  })

  it("applies a date range in memory over the matched rows", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // Four rows all matching "admin" (the actor name is in searchText), with
    // strictly increasing creation times.
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })

    // No range: all four match.
    const all = await asAdmin.query(api.accounts.audit.searchAuditLog, {
      orgId,
      search: "admin",
    })
    expect(all.rows).toHaveLength(4)

    // end = the second row's time: a matching term outside the range (the two
    // newer rows) is excluded by the in-memory filter.
    const untilSecond = times[1] as number
    const ranged = await asAdmin.query(api.accounts.audit.searchAuditLog, {
      orgId,
      search: "admin",
      end: untilSecond,
    })
    expect(ranged.rows).toHaveLength(2)
    expect(ranged.rows.every((r) => r.at <= untilSecond)).toBe(true)
  })

  it("rejects an editor with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, editorId } = await setup(t)
    await expect(
      t
        .withIdentity({ subject: editorId })
        .query(api.accounts.audit.searchAuditLog, { orgId, search: "x" })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects an unauthenticated caller with errors.notAuthenticated", async () => {
    const t = initConvexTest()
    const { orgId } = await setup(t)
    await expect(
      t.query(api.accounts.audit.searchAuditLog, { orgId, search: "x" })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })
})
