import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
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
  const { roleId } = await t
    .withIdentity({ subject })
    .mutation(api.assessment.roles.createRole, {
      orgId,
      title,
      function: "engineering",
      team: "Platform",
      trackKey: "IC",
    })
  return roleId
}

// Seeds `count` audit rows through the REAL logAudit (so category, subject,
// searchText, and the pager's count/offset aggregates all derive exactly as
// in production; each insert gets a strictly increasing _creationTime under
// convex-test), returning the observed creation times in insertion order
// (oldest first). Bounds in the range tests are derived from these real
// times, never from Date.now(), so the partitions are deterministic.
async function seedAuditRows(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  adminId: string,
  count: number,
  type: "role.created" | "member.roleChanged" = "role.created"
): Promise<number[]> {
  return await t.run(async (ctx) => {
    const times: number[] = []
    for (let i = 0; i < count; i++) {
      if (type === "role.created") {
        await logAudit(ctx, {
          orgId,
          type,
          actorId: adminId,
          payload: { roleId: `role-${i}`, changes: {} },
        })
      } else {
        await logAudit(ctx, {
          orgId,
          type,
          actorId: adminId,
          payload: { memberUserId: `user-${i}`, changes: {} },
        })
      }
      const newest = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .first()
      times.push(newest?._creationTime ?? 0)
    }
    return times
  })
}

describe("accounts.audit.getAuditLogPage (browse)", () => {
  it("pages newest-first with an exact total, 25 rows per page", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await seedAuditRows(t, orgId, adminId, 30)

    const asAdmin = t.withIdentity({ subject: adminId })
    const page0 = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      page: 0,
    })
    expect(page0.total).toBe(30)
    expect(page0.rows).toHaveLength(25)
    for (let i = 1; i < page0.rows.length; i++) {
      expect(page0.rows[i - 1]?.at).toBeGreaterThanOrEqual(
        page0.rows[i]?.at ?? 0
      )
    }

    const page1 = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      page: 1,
    })
    expect(page1.total).toBe(30)
    expect(page1.rows).toHaveLength(5)
    // The oldest row of page 0 is newer than the newest row of page 1.
    const lastOfPage0 = page0.rows[page0.rows.length - 1]?.at ?? 0
    expect(lastOfPage0).toBeGreaterThanOrEqual(page1.rows[0]?.at ?? 0)
  })

  it("jumps straight to the last page without visiting the pages before it", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 60)

    // First query is page 2 directly (rows 51..60, the ten OLDEST rows).
    const last = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, { orgId, page: 2 })
    expect(last.total).toBe(60)
    expect(last.rows).toHaveLength(10)
    expect(last.rows.map((r) => r.at)).toEqual(times.slice(0, 10).reverse())
  })

  it("clamps NaN, Infinity, and negative pages to the first page", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await seedAuditRows(t, orgId, adminId, 3)
    const asAdmin = t.withIdentity({ subject: adminId })
    // v.number() admits every IEEE-754 double; an unclamped NaN would reach
    // the aggregate as a non-integer offset and throw instead of paging.
    for (const page of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      const result = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
        orgId,
        page,
      })
      expect(result.total).toBe(3)
      expect(result.rows).toHaveLength(3)
    }
  })

  it("returns an empty page (with the total) past the end", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await seedAuditRows(t, orgId, adminId, 3)
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, { orgId, page: 5 })
    expect(result.rows).toHaveLength(0)
    expect(result.total).toBe(3)
  })

  it("filters by category: role vs organization, with per-category totals", async () => {
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
    const roleOnly = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      category: "role",
      page: 0,
    })
    expect(roleOnly.total).toBe(2)
    expect(roleOnly.rows).toHaveLength(2)
    expect(roleOnly.rows.every((r) => r.category === "role")).toBe(true)

    const orgOnly = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      category: "organization",
      page: 0,
    })
    expect(orgOnly.total).toBe(1)
    expect(orgOnly.rows[0]?.type).toBe("organization.settingsUpdated")
    expect(orgOnly.rows[0]?.category).toBe("organization")
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
      .query(api.accounts.audit.getAuditLogPage, {
        orgId,
        category: "not-a-real-category",
        page: 0,
      })
    // Both the role row and the settings row come back (no filter applied).
    expect(all.rows.length).toBeGreaterThanOrEqual(2)
    expect(all.total).toBe(all.rows.length)
  })

  it("enriches a role row's names with its roleId -> title", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const roleId = await createRole(t, adminId, orgId, "System Developer")
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, {
        orgId,
        category: "role",
        page: 0,
      })
    const created = result.rows.find((r) => r.type === "role.created")
    expect(created?.names[roleId.toString()]).toBe("System Developer")
    // The map is minimal: it carries only the ids this row references.
    expect(Object.keys(created?.names ?? {})).toEqual([roleId.toString()])
  })

  it("enriches assignment.set names with BOTH the old and new roleId on a re-assignment", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const roleA = await createRole(t, adminId, orgId, "Analyst")
    const roleB = await createRole(t, adminId, orgId, "Lead Analyst")
    // A re-assignment diffs the role: changes.roleId = { from: A, to: B }. Both
    // sides must resolve to titles so the detail sheet never shows a raw id.
    await t.run(async (ctx) => {
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.assignmentSet,
        actorId: adminId,
        payload: {
          personId: "person-placeholder",
          roleId: roleB,
          changes: {
            roleId: { from: roleA, to: roleB },
            seniority: { from: "IC3", to: "Lead-1" },
            senioritySource: { from: "confirmed", to: "suggested" },
          },
        },
      })
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, { orgId, page: 0 })
    const row = result.rows.find((r) => r.type === "assignment.set")
    expect(row?.names[roleA.toString()]).toBe("Analyst")
    expect(row?.names[roleB.toString()]).toBe("Lead Analyst")
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
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.memberRoleChanged,
        actorId: adminId,
        payload: {
          memberUserId: memberAuthId,
          changes: { role: { from: null, to: "editor" } },
        },
      })
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, {
        orgId,
        category: "member",
        page: 0,
      })
    const row = result.rows.find((r) => r.type === "member.roleChanged")
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
        levelRules: [],
        zoneProfileRules: [],
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId,
        modelId,
        libraryKey: "scope-impact",
        weightPoints: 3,
        order: 0,
      })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.modelUpdated,
        actorId: adminId,
        payload: {
          change: "criterion.complianceUpdated",
          modelId,
          criterionId,
          changes: {},
        },
      })
      return { modelId, criterionId }
    })
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, {
        orgId,
        category: "model",
        page: 0,
      })
    const row = result.rows.find((r) => r.type === "model.updated")
    expect(row?.names[modelId.toString()]).toBe("Standard model")
    // The criterion carries no stored name (decision 8): it resolves from the
    // criteria library by libraryKey, in the org's own content locale (no
    // language set here, so it clamps to en).
    expect(row?.names[criterionId.toString()]).toBe("Scope and impact")
  })

  it("derives a role subject on role.created and scopes by_org_subject to one role", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const roleA = await createRole(t, adminId, orgId, "Analyst")
    await createRole(t, adminId, orgId, "Lead Analyst")
    // The subject is derived by logAudit (never passed by the mutation) and
    // indexed, so one role's whole trail is an index read, not a payload scan.
    const trail = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_subject", (q) =>
          q
            .eq("orgId", orgId)
            .eq("subject.kind", "role")
            .eq("subject.id", roleA)
        )
        .collect()
    )
    expect(trail).toHaveLength(1)
    expect(trail[0]?.type).toBe("role.created")
    expect(trail[0]?.subject).toEqual({ kind: "role", id: roleA })
  })

  it("enriches payMapping rows with runId -> label and scopes their trail by subject", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // A run plus two of its lifecycle rows, written through the real logAudit
    // (so subject/category/searchText derive exactly as in production).
    const runId = await t.run(async (ctx) => {
      const runId = await ctx.db.insert("payMappingRuns", {
        orgId,
        slug: "lonekartlaggning-2026",
        label: "Lönekartläggning 2026",
        status: "active",
        referenceDate: 0,
        initiatedBy: adminId,
        initiatedAt: 0,
        systemVersion: "test",
        populationCount: 2,
        withPayCount: 2,
        womenCount: 1,
        menCount: 1,
        orgGapPct: null,
        orgGapFlag: "insufficient",
        frozenModel: { criteria: [], levelThresholds: [] },
      })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.payMappingRunStarted,
        actorId: adminId,
        payload: { runId, populationCount: 2, withPayCount: 2 },
      })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.payMappingRunCompleted,
        actorId: adminId,
        payload: { runId, equalWorkDone: 1, equivalentWorkDone: 1 },
      })
      return runId
    })
    // The names map resolves payload.runId, so the log can attribute every
    // payMapping row to its kartläggning (two runs in flight are otherwise
    // indistinguishable).
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, {
        orgId,
        category: "pay",
        page: 0,
      })
    const started = result.rows.find((r) => r.type === "payMapping.runStarted")
    expect(started?.names[runId.toString()]).toBe("Lönekartläggning 2026")
    // And the run's whole trail is retrievable by subject.
    const trail = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_subject", (q) =>
          q
            .eq("orgId", orgId)
            .eq("subject.kind", "payMappingRun")
            .eq("subject.id", runId)
        )
        .collect()
    )
    expect(trail.map((row) => row.type).sort()).toEqual([
      "payMapping.runCompleted",
      "payMapping.runStarted",
    ])
  })

  it("only returns rows for the caller's org (tenant isolation)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    await createRole(t, adminId, orgId, "System Developer")
    await seedAuditRows(t, "other-org", "someone", 1)
    const result = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.audit.getAuditLogPage, { orgId, page: 0 })
    expect(result.total).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.type).toBe("role.created")
  })

  it("rejects an editor with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, editorId } = await setup(t)
    await expect(
      t
        .withIdentity({ subject: editorId })
        .query(api.accounts.audit.getAuditLogPage, { orgId, page: 0 })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("rejects an unauthenticated caller with errors.notAuthenticated", async () => {
    const t = initConvexTest()
    const { orgId } = await setup(t)
    await expect(
      t.query(api.accounts.audit.getAuditLogPage, { orgId, page: 0 })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })
})

describe("accounts.audit.getAuditLogPage (date range)", () => {
  it("no range returns all rows; a range before all rows returns none", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })

    const all = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      page: 0,
    })
    expect(all.total).toBe(4)
    expect(all.rows).toHaveLength(4)

    // A window strictly before the oldest row excludes everything.
    const before = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      start: (times[0] as number) - 1000,
      end: (times[0] as number) - 1,
      page: 0,
    })
    expect(before.total).toBe(0)
    expect(before.rows).toHaveLength(0)
  })

  it("start-only keeps rows at or after the bound, newest-first", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })
    // start = the third row's time: rows 3 and 4 remain (inclusive lower bound).
    const fromThird = times[2] as number
    const result = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      start: fromThird,
      page: 0,
    })
    expect(result.total).toBe(2)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.at >= fromThird)).toBe(true)
    // Newest-first ordering is preserved under the range.
    expect(result.rows[0]?.at).toBeGreaterThanOrEqual(result.rows[1]?.at ?? 0)
  })

  it("end-only keeps rows at or before the bound (inclusive)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 4)
    const asAdmin = t.withIdentity({ subject: adminId })
    // end = the second row's time: rows 1 and 2 remain, the newer two drop.
    const untilSecond = times[1] as number
    const result = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      end: untilSecond,
      page: 0,
    })
    expect(result.total).toBe(2)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.at <= untilSecond)).toBe(true)
  })

  it("start+end keeps only the inclusive window", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 5)
    const asAdmin = t.withIdentity({ subject: adminId })
    // [row2, row4] inclusive: exactly rows 2, 3, 4 (drops the oldest and newest).
    const lo = times[1] as number
    const hi = times[3] as number
    const result = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      start: lo,
      end: hi,
      page: 0,
    })
    expect(result.total).toBe(3)
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every((r) => r.at >= lo && r.at <= hi)).toBe(true)
  })

  it("pages within a range (newest-first, exact in-range total)", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    const times = await seedAuditRows(t, orgId, adminId, 30)
    const asAdmin = t.withIdentity({ subject: adminId })
    // Window covering the newest 29 rows (drops the oldest).
    const lo = times[1] as number
    const page0 = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      start: lo,
      page: 0,
    })
    expect(page0.total).toBe(29)
    expect(page0.rows).toHaveLength(25)
    const page1 = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      start: lo,
      page: 1,
    })
    expect(page1.total).toBe(29)
    expect(page1.rows).toHaveLength(4)
    // All 29 are in range and globally newest-first across the two pages.
    const ats = [...page0.rows, ...page1.rows].map((r) => r.at)
    expect(ats.every((at) => at >= lo)).toBe(true)
    for (let i = 1; i < ats.length; i++) {
      expect(ats[i - 1]).toBeGreaterThanOrEqual(ats[i] as number)
    }
  })

  it("category and date range compose", async () => {
    const t = initConvexTest()
    const { orgId, adminId } = await setup(t)
    // Three role rows, then two member rows (all newer than the role rows).
    const roleTimes = await seedAuditRows(t, orgId, adminId, 3)
    await seedAuditRows(t, orgId, adminId, 2, "member.roleChanged")
    const asAdmin = t.withIdentity({ subject: adminId })
    // Range covering only the two newest role rows; category pins to role, so
    // the (newer, in-range) member rows are excluded by the category filter and
    // the oldest role row is excluded by the lower bound.
    const lo = roleTimes[1] as number
    const result = await asAdmin.query(api.accounts.audit.getAuditLogPage, {
      orgId,
      category: "role",
      start: lo,
      page: 0,
    })
    expect(result.total).toBe(2)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.category === "role")).toBe(true)
    expect(result.rows.every((r) => r.at >= lo)).toBe(true)
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
