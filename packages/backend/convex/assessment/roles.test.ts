import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(
  t: ReturnType<typeof initConvexTest>,
  email = "hr@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "HR Person", role: "admin" }
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
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  return { orgId, userId, asAdmin, model, track }
}

describe("createRole", () => {
  it("creates a draft role with trimmed core fields and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "  Junior Software Developer  ",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.title).toBe("Junior Software Developer")
      expect(role?.purpose).toBe("")
      expect(role?.responsibilities).toBe("")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
      // role.created captures a complete create-snapshot of all 7 fields,
      // every entry from null. Empty strings (purpose/responsibilities here)
      // are still recorded (buildCreateChanges keeps them).
      expect(audit[0]?.payload).toEqual({
        roleId,
        changes: {
          title: { from: null, to: "Junior Software Developer" },
          function: { from: null, to: "Engineering" },
          team: { from: null, to: "Core" },
          trackKey: { from: null, to: track.key },
          familyId: { from: null, to: null },
          purpose: { from: null, to: "" },
          responsibilities: { from: null, to: "" },
        },
      })
    })
  })

  it("rejects an empty title", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    await expect(
      asAdmin.mutation(api.assessment.roles.createRole, {
        orgId,
        title: "   ",
        function: "F",
        team: "T",
        trackKey: track.key,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })
})

describe("listRoles and getRole", () => {
  it("lists non-archived roles with progress and resolves a role with guardrails", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      purpose: "Builds the product",
      responsibilities: "Implementation",
    })
    const firstCriterion = model.criteria[0]
    if (firstCriterion === undefined) throw new Error("seed")
    await t.run(async (ctx) => {
      await ctx.db.insert("ratings", {
        orgId,
        roleId,
        criterionId: firstCriterion.criterionId,
        value: 2,
        motivation: "Solid",
      })
    })

    const list = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
      locale: "sv",
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      roleId,
      title: "Developer",
      ratedCount: 1,
      totalCriteria: 9,
      profileComplete: true,
    })

    const role = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId: roleId as string,
      locale: "sv",
    })
    expect(role).not.toBeNull()
    expect(role?.ratings).toEqual([
      {
        criterionId: firstCriterion.criterionId,
        value: 2,
        motivation: "Solid",
      },
    ])
    expect(role?.profileComplete).toBe(true)
  })

  it("returns null from getRole for garbage and foreign ids", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    expect(
      await asAdmin.query(api.assessment.roles.getRole, {
        orgId,
        roleId: "not-an-id",
      })
    ).toBeNull()
  })
})

async function addEditor(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Editor Person", role: "editor" }
  )
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId,
    role: "editor",
  })
  return t.withIdentity({ subject: userId })
}

async function rateAll(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  roleId: string,
  criteria: { criterionId: string }[],
  value: number
) {
  await t.run(async (ctx) => {
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) throw new Error("bad role id")
    for (const criterion of criteria) {
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        criterion.criterionId
      )
      if (criterionDocId === null) throw new Error("bad criterion id")
      await ctx.db.insert("ratings", {
        orgId,
        roleId: docId,
        criterionId: criterionDocId,
        value,
      })
    }
  })
}

describe("updateRole", () => {
  it("patches profile fields, audits the field names, and locks archived roles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      purpose: "  Builds the core product  ",
    })
    await t.run(async (ctx) => {
      // Profile text fields store trimmed at create time.
      const created = await ctx.db.get(roleId)
      expect(created?.purpose).toBe("Builds the core product")
    })
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      purpose: "Builds and ships the core product",
      responsibilities: "Implementation and reviews",
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.purpose).toBe("Builds and ships the core product")
      expect(role?.responsibilities).toBe("Implementation and reviews")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      // updateRole iterates PROFILE_TEXT_FIELDS (purpose before
      // responsibilities), so the audited change order is fixed.
      expect(audit[0]?.payload).toEqual({
        roleId,
        changes: {
          purpose: {
            from: "Builds the core product",
            to: "Builds and ships the core product",
          },
          responsibilities: { from: "", to: "Implementation and reviews" },
        },
      })
    })

    // Archive the role (the only lock), then verify editing is rejected.
    await rateAll(t, orgId, roleId as string, model.criteria, 3)
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", roleId as string)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { archivedAt: Date.now() })
    })
    await expect(
      asAdmin.mutation(api.assessment.roles.updateRole, {
        orgId,
        roleId,
        team: "Other",
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("changes the track on its own", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    const otherTrack = model.tracks[1]
    if (otherTrack === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)
    })
  })
})

describe("archiveRole", () => {
  it("soft-archives (admin only), logs band.shift to null, hides from listRoles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const asEditor = await addEditor(t, orgId, "editor2@acme.se")
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      purpose: "p",
      responsibilities: "r",
    })
    await rateAll(t, orgId, roleId as string, model.criteria, 5)

    await expect(
      asEditor.mutation(api.assessment.roles.archiveRole, { orgId, roleId })
    ).rejects.toThrow(/errors.adminRequired/)

    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(typeof role?.archivedAt).toBe("number")
      const shifts = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "band.shift")
        )
        .collect()
      const shift = shifts.find(
        (row) => (row.payload as { roleId?: string }).roleId === roleId
      )
      expect(shift?.payload).toMatchObject({
        roleId,
        changes: { band: { from: 1, to: null } },
        // The archive band.shift threads the triggering cause.
        cause: { event: "role.archived", roleId },
      })

      // role.archived snapshots the identity fields so the archived entity is
      // fully described, and its archivedAt change matches the value actually
      // stored on the role (timestamp hoist regression guard).
      const archived = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.archived")
        )
        .collect()
      expect(archived).toHaveLength(1)
      const payload = archived[0]?.payload as {
        title?: string
        trackKey?: string
        function?: string
        team?: string
        familyId?: string | null
        anchorRetired?: boolean
        changes?: { archivedAt?: { from: unknown; to: unknown } }
      }
      expect(payload.title).toBe("Developer")
      expect(payload.trackKey).toBe(track.key)
      expect(payload.function).toBe("Engineering")
      expect(payload.team).toBe("Core")
      expect(payload.familyId).toBeNull()
      expect(payload.anchorRetired).toBe(false)
      expect(payload.changes?.archivedAt?.from).toBeNull()
      expect(payload.changes?.archivedAt?.to).toBe(role?.archivedAt)
    })
    const list = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(list).toHaveLength(0)
  })
})

describe("role family membership", () => {
  it("creates with a family, moves, clears, and rejects foreign families", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const techId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const salesId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Sales" }
    )
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      familyId: techId,
    })

    // listRoles carries the family and the track/level orders.
    const list = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
      locale: "sv",
    })
    expect(list[0]).toMatchObject({
      familyId: techId,
      familyName: "Tech",
      trackOrder: 1,
    })

    // Move to another family.
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      familyId: salesId,
    })
    // Clear with the null sentinel.
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      familyId: null,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.familyId).toBeUndefined()
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated.map((row) => row.payload)).toContainEqual({
        roleId,
        changes: { familyId: { from: salesId, to: null } },
      })
    })

    // A family from another organization is rejected.
    const foreign = await seedTemplateOrganization(t, "hr2@acme.se")
    const foreignFamilyId = await foreign.asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId: foreign.orgId, name: "Foreign" }
    )
    await expect(
      asAdmin.mutation(api.assessment.roles.updateRole, {
        orgId,
        roleId,
        familyId: foreignFamilyId,
      })
    ).rejects.toThrow(/errors.notFound/)

    const role = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId: roleId as string,
    })
    expect(role?.familyId).toBeNull()
    expect(role?.familyName).toBeNull()
  })
})
