import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { insertStarterSet } from "./starters"
import { initConvexTest } from "../testing.helpers"

// A from/to change entry as stored in audit payloads.
type Change = { from: unknown; to: unknown }
type Changes = Record<string, Change>

async function seedTemplateOrganization(
  t: ReturnType<typeof initConvexTest>,
  industry = "itTelecom",
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
      industry,
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  return { orgId, asAdmin, userId }
}

describe("getIndustryStarter", () => {
  it("returns the org industry's starter in the requested locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "sv" }
    )
    expect(starter.families.length).toBeGreaterThan(0)
    expect(starter.families[0]?.name).toBe("Engineering")
    // One role per JOB (ADR-0005): no junior/senior variants, no level.
    // The predefined profile (purpose + responsibilities) rides along, so a
    // template create makes the role arrive profileComplete.
    const role = starter.families[0]?.roles[0]
    expect(role?.title).toBe("Systemutvecklare")
    expect(role?.trackKey).toBe("IC")
    expect(role?.purpose.length ?? 0).toBeGreaterThan(0)
    expect(role?.responsibilities.length ?? 0).toBeGreaterThan(0)
  })

  it("returns non-empty predefined profiles for a known industry/locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t, "itTelecom")
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "en" }
    )
    // Every role in every family carries a non-empty purpose + responsibilities.
    const roles = starter.families.flatMap((family) => family.roles)
    expect(roles.length).toBeGreaterThan(0)
    for (const role of roles) {
      expect(role.purpose.trim().length).toBeGreaterThan(0)
      expect(role.responsibilities.trim().length).toBeGreaterThan(0)
    }
  })

  it("falls back to the generic set for an unknown industry", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(
      t,
      "somethingElse"
    )
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "en" }
    )
    expect(starter.families[0]?.name).toBe("Operations")
  })
})

describe("createStarterSet", () => {
  it("creates families and draft roles in one call, audited as starter", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Software Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families.map((family) => family.name)).toEqual([
      "Design",
      "Engineering",
    ])
    const roles = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
    })
    expect(roles).toHaveLength(2)
    expect(roles[0]).toMatchObject({
      title: "Software Developer",
      familyName: "Engineering",
      trackKey: "IC",
      profileComplete: false,
    })
    await t.run(async (ctx) => {
      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(created).toHaveLength(2)
      expect(created[0]?.payload).toMatchObject({ source: "starter" })
      const roleRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(roleRows).toHaveLength(2)
      expect(roleRows[0]?.payload).toMatchObject({ source: "starter" })
      // Starter roles are honest drafts: no invented profile data.
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(role?.function).toBe("")
      expect(role?.team).toBe("")
      expect(role?.purpose).toBe("")
    })
  })

  it("carries predefined profiles through to the created roles (template path)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            {
              title: "Software Developer",
              trackKey: "IC",
              purpose: "Builds and maintains software.",
              responsibilities: "Design features\nWrite code",
            },
          ],
        },
      ],
    })
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(roles).toHaveLength(1)
    // The predefined profile reaches the row, so the role arrives complete and
    // the onboarding prefill will skip it (zero AI calls for template names).
    expect(roles[0]).toMatchObject({
      title: "Software Developer",
      profileComplete: true,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(role?.purpose).toBe("Builds and maintains software.")
      expect(role?.responsibilities).toBe("Design features\nWrite code")
    })
  })

  it("creates empty-profile roles when none are sent (AI-import back-compat)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    // The AI-import / reconcile path sends no purpose/responsibilities; the
    // role must start empty so the prefill regenerates it.
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [{ title: "Tech Lead", trackKey: "Lead" }],
        },
      ],
    })
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(roles[0]).toMatchObject({
      title: "Tech Lead",
      profileComplete: false,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(role?.purpose).toBe("")
      expect(role?.responsibilities).toBe("")
    })
  })

  it("rejects duplicates against existing families and unknown track keys", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [{ name: "engineering", roles: [] }],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [
          {
            name: "Quality",
            roles: [{ title: "QA", trackKey: "Ghost" }],
          },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("is a no-op for an empty list", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toEqual([])
  })

  it("threads one batchId across every emitted row and carries full role create-changes", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Software Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    // Only the rows this import wrote (families + roles); the template-model
    // seed wrote earlier rows with no batchId.
    const importRows = rows.filter(
      (row) => (row.payload as { batchId?: string }).batchId !== undefined
    )
    // 2 families + 2 roles = 4 rows, all sharing ONE batchId.
    expect(importRows).toHaveLength(4)
    const batchIds = new Set(
      importRows.map((row) => (row.payload as { batchId: string }).batchId)
    )
    expect(batchIds.size).toBe(1)

    // roleFamily.created rows carry name from null.
    const familyRows = importRows.filter(
      (row) => row.type === "roleFamily.created"
    )
    expect(familyRows).toHaveLength(2)
    for (const row of familyRows) {
      const { changes } = row.payload as { changes: Changes }
      expect(changes.name?.from).toBeNull()
      expect(typeof changes.name?.to).toBe("string")
    }

    // role.created rows carry the full create-changes incl. title/trackKey/familyId.
    const roleRows = importRows.filter((row) => row.type === "role.created")
    expect(roleRows).toHaveLength(2)
    const devRow = roleRows.find(
      (row) =>
        ((row.payload as { changes: Changes }).changes.title?.to as string) ===
        "Software Developer"
    )
    const devPayload = devRow?.payload as {
      roleId: string
      familyId: string
      source: string
      changes: Changes
    }
    expect(devPayload.source).toBe("starter")
    expect(typeof devPayload.familyId).toBe("string")
    expect(devPayload.changes.title).toEqual({
      from: null,
      to: "Software Developer",
    })
    expect(devPayload.changes.trackKey).toEqual({ from: null, to: "IC" })
    expect(devPayload.changes.familyId).toEqual({
      from: null,
      to: devPayload.familyId,
    })
    expect(devPayload.changes.function).toEqual({ from: null, to: "" })
    expect(devPayload.changes.purpose).toEqual({ from: null, to: "" })
  })

  it("returns the created families tree (ids/names + role ids/titles/tracks)", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedTemplateOrganization(t)
    const result = await t.run(async (ctx) =>
      insertStarterSet(ctx, {
        orgId,
        actorId: userId,
        source: "aiImport",
        families: [
          {
            name: "Engineering",
            roles: [
              { title: "Software Developer", trackKey: "IC" },
              { title: "Tech Lead", trackKey: "Lead" },
            ],
          },
          { name: "Design", roles: [] },
        ],
      })
    )
    expect(result.familyCount).toBe(2)
    expect(result.roleCount).toBe(2)
    expect(result.families).toHaveLength(2)
    const engineering = result.families.find((f) => f.name === "Engineering")
    expect(engineering).toBeDefined()
    expect(typeof engineering?.familyId).toBe("string")
    expect(engineering?.roles).toHaveLength(2)
    expect(engineering?.roles[0]).toMatchObject({
      title: "Software Developer",
      trackKey: "IC",
    })
    expect(typeof engineering?.roles[0]?.roleId).toBe("string")
    expect(engineering?.roles[1]).toMatchObject({
      title: "Tech Lead",
      trackKey: "Lead",
    })
    const design = result.families.find((f) => f.name === "Design")
    expect(design?.roles).toEqual([])
    // The returned ids resolve to real role docs.
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId(
        "roles",
        engineering?.roles[0]?.roleId ?? ""
      )
      if (docId === null) throw new Error("bad id")
      const doc = await ctx.db.get(docId)
      expect(doc?.title).toBe("Software Developer")
    })
  })
})

// Counts every audit row in the org (any type). Used to assert that an
// idempotent reconcile writes nothing.
async function auditCount(
  t: ReturnType<typeof initConvexTest>,
  orgId: string
): Promise<number> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    return rows.length
  })
}

async function auditOfType(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  type: string
) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_org_type", (q) => q.eq("orgId", orgId).eq("type", type))
      .collect()
  )
}

describe("reconcileStarterSet", () => {
  it("creates new families and roles when no ids are present", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Software Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families.map((family) => family.name)).toEqual([
      "Design",
      "Engineering",
    ])
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(roles).toHaveLength(2)
    expect(roles[0]).toMatchObject({
      title: "Software Developer",
      familyName: "Engineering",
      trackKey: "IC",
      profileComplete: false,
    })
    const familyCreated = await auditOfType(t, orgId, "roleFamily.created")
    expect(familyCreated).toHaveLength(2)
    const roleCreated = await auditOfType(t, orgId, "role.created")
    expect(roleCreated).toHaveLength(2)
  })

  it("renames a family, renames/retracks/moves roles via ids without archiving", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    // Seed an existing starter set via reconcile (all-new path).
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Lead", trackKey: "Lead" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const before = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      {
        orgId,
      }
    )
    const engineering = before.find((f) => f.name === "Engineering")
    const design = before.find((f) => f.name === "Design")
    if (engineering === undefined || design === undefined)
      throw new Error("seed")
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const developer = roles.find((r) => r.title === "Developer")
    const lead = roles.find((r) => r.title === "Lead")
    if (developer === undefined || lead === undefined) throw new Error("seed")

    const baseline = await auditCount(t, orgId)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: engineering.familyId,
          name: "Platform", // rename family
          roles: [
            // rename title + retrack
            {
              roleId: developer.roleId,
              title: "Senior Developer",
              trackKey: "M",
            },
          ],
        },
        {
          familyId: design.familyId,
          name: "Design",
          // move Lead from Engineering to Design (same id, new family)
          roles: [{ roleId: lead.roleId, title: "Lead", trackKey: "Lead" }],
        },
      ],
    })

    const familiesAfter = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(familiesAfter.map((f) => f.name).sort()).toEqual([
      "Design",
      "Platform",
    ])
    const rolesAfter = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
    })
    expect(rolesAfter).toHaveLength(2)
    const dev = rolesAfter.find((r) => r.roleId === developer.roleId)
    const movedLead = rolesAfter.find((r) => r.roleId === lead.roleId)
    expect(dev).toMatchObject({
      title: "Senior Developer",
      trackKey: "M",
      familyName: "Platform",
    })
    expect(movedLead).toMatchObject({ title: "Lead", familyName: "Design" })

    // No role was archived.
    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(0)
    // role.updated audit rows carry the before/after of the changed fields.
    const updated = await auditOfType(t, orgId, "role.updated")
    expect(updated).toHaveLength(2)
    const devUpdate = updated.find(
      (row) => (row.payload as { roleId: string }).roleId === developer.roleId
    )
    const devChanges =
      (devUpdate?.payload as { changes: Changes } | undefined)?.changes ?? {}
    expect(Object.keys(devChanges).sort()).toEqual(["title", "trackKey"])
    expect(devChanges.title).toEqual({
      from: "Developer",
      to: "Senior Developer",
    })
    expect(devChanges.trackKey).toEqual({ from: "IC", to: "M" })
    const leadUpdate = updated.find(
      (row) => (row.payload as { roleId: string }).roleId === lead.roleId
    )
    const leadChanges =
      (leadUpdate?.payload as { changes: Changes } | undefined)?.changes ?? {}
    expect(Object.keys(leadChanges)).toEqual(["familyId"])
    // The family was renamed (not removed/created anew).
    const renamed = await auditOfType(t, orgId, "roleFamily.renamed")
    expect(renamed).toHaveLength(1)
    // Three writes-with-audit happened, so the count strictly increased.
    expect(await auditCount(t, orgId)).toBeGreaterThan(baseline)
  })

  it("archives a role removed from the payload and preserves its ratings", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Keeper", trackKey: "IC" },
            { title: "Goner", trackKey: "IC" },
          ],
        },
      ],
    })
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const keeper = roles.find((r) => r.title === "Keeper")
    const goner = roles.find((r) => r.title === "Goner")
    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    if (keeper === undefined || goner === undefined || family === undefined) {
      throw new Error("seed")
    }
    // Fully rate the soon-archived role (one rating per criterion) so it has a
    // computed band: its ratings must survive the archive, and archiving it must
    // log the band.shift as the band drops out of the results set.
    const criteriaCount = await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("model")
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      const roleDocId = ctx.db.normalizeId("roles", goner.roleId)
      if (roleDocId === null) throw new Error("bad id")
      for (const criterion of criteria) {
        await ctx.db.insert("ratings", {
          orgId,
          roleId: roleDocId,
          criterionId: criterion._id,
          value: 3,
        })
      }
      return criteria.length
    })

    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: family.familyId,
          name: "Engineering",
          roles: [{ roleId: keeper.roleId, title: "Keeper", trackKey: "IC" }],
        },
      ],
    })

    const after = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(after.map((r) => r.title)).toEqual(["Keeper"])
    await t.run(async (ctx) => {
      const goneDocId = ctx.db.normalizeId("roles", goner.roleId)
      if (goneDocId === null) throw new Error("bad id")
      const role = await ctx.db.get(goneDocId)
      expect(typeof role?.archivedAt).toBe("number")
      // Ratings on the archived role survive (role id permanence).
      const ratings = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) => q.eq("roleId", goneDocId))
        .collect()
      expect(ratings).toHaveLength(criteriaCount)
    })
    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(1)
    expect(
      (archived[0]?.payload as { roleId: string } | undefined)?.roleId
    ).toBe(goner.roleId)
    // A fully-rated role leaving the results set logs exactly one band.shift
    // (band -> null), mirroring archiveRole, so the reconcile band history is
    // complete. The un-rated Keeper stays band null throughout and shifts none.
    const shifts = await auditOfType(t, orgId, "band.shift")
    expect(shifts).toHaveLength(1)
    const shiftPayload = shifts[0]?.payload as {
      roleId: string
      changes: { band: { from: unknown; to: unknown } }
    }
    expect(shiftPayload.roleId).toBe(goner.roleId)
    expect(typeof shiftPayload.changes.band.from).toBe("number")
    expect(shiftPayload.changes.band.to).toBeNull()
  })

  it("removes a family that becomes empty when its roles are dropped", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" }],
        },
        { name: "Doomed", roles: [{ title: "Temp", trackKey: "IC" }] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    const engineering = families.find((f) => f.name === "Engineering")
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const developer = roles.find((r) => r.title === "Developer")
    if (engineering === undefined || developer === undefined)
      throw new Error("seed")

    // Drop the Doomed family entirely (id absent) and its role (id absent).
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: engineering.familyId,
          name: "Engineering",
          roles: [
            { roleId: developer.roleId, title: "Developer", trackKey: "IC" },
          ],
        },
      ],
    })

    const familiesAfter = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(familiesAfter.map((f) => f.name)).toEqual(["Engineering"])
    const removed = await auditOfType(t, orgId, "roleFamily.removed")
    expect(removed).toHaveLength(1)
    // The dropped role was archived, not hard-deleted.
    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(1)
  })

  it("is idempotent: an unchanged payload writes nothing", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Lead", trackKey: "Lead" },
          ],
        },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    const engineering = families[0]
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const developer = roles.find((r) => r.title === "Developer")
    const lead = roles.find((r) => r.title === "Lead")
    if (
      engineering === undefined ||
      developer === undefined ||
      lead === undefined
    ) {
      throw new Error("seed")
    }

    const baseline = await auditCount(t, orgId)
    const sameNamePayload = {
      orgId,
      families: [
        {
          familyId: engineering.familyId,
          name: "Engineering",
          roles: [
            {
              roleId: developer.roleId,
              title: "Developer",
              trackKey: "IC" as const,
            },
            { roleId: lead.roleId, title: "Lead", trackKey: "Lead" as const },
          ],
        },
      ],
    }
    await asAdmin.mutation(
      api.assessment.starters.reconcileStarterSet,
      sameNamePayload
    )
    // Second run: still nothing.
    await asAdmin.mutation(
      api.assessment.starters.reconcileStarterSet,
      sameNamePayload
    )
    expect(await auditCount(t, orgId)).toBe(baseline)
  })

  it("rejects ids that belong to another organization", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const foreign = await seedTemplateOrganization(
      t,
      "itTelecom",
      "hr2@acme.se"
    )
    await foreign.asAdmin.mutation(
      api.assessment.starters.reconcileStarterSet,
      {
        orgId: foreign.orgId,
        families: [
          { name: "Foreign", roles: [{ title: "Outsider", trackKey: "IC" }] },
        ],
      }
    )
    const foreignFamily = (
      await foreign.asAdmin.query(api.assessment.families.listRoleFamilies, {
        orgId: foreign.orgId,
      })
    )[0]
    const foreignRole = (
      await foreign.asAdmin.query(api.assessment.roles.listRoles, {
        orgId: foreign.orgId,
      })
    )[0]
    if (foreignFamily === undefined || foreignRole === undefined) {
      throw new Error("seed")
    }

    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          { familyId: foreignFamily.familyId, name: "Mine", roles: [] },
        ],
      })
    ).rejects.toThrow(/errors.notFound/)
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            name: "Mine",
            roles: [
              { roleId: foreignRole.roleId, title: "Steal", trackKey: "IC" },
            ],
          },
        ],
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects over-limit payloads", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const tooManyFamilies = Array.from({ length: 21 }, (_, i) => ({
      name: `Family ${i}`,
      roles: [],
    }))
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: tooManyFamilies,
      })
    ).rejects.toThrow(/errors.invalidInput/)

    const tooManyRoles = [
      {
        name: "Engineering",
        roles: Array.from({ length: 101 }, (_, i) => ({
          title: `Role ${i}`,
          trackKey: "IC" as const,
        })),
      },
    ]
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: tooManyRoles,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects two payload families with case-insensitively equal names", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          { name: "Engineering", roles: [] },
          { name: "engineering", roles: [] },
        ],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    // Nothing was written before the rejection.
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toHaveLength(0)
  })

  it("rejects keeping an existing family by id while adding a new family with the same name", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [{ name: "Engineering", roles: [] }],
    })
    const engineering = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    ).find((f) => f.name === "Engineering")
    if (engineering === undefined) throw new Error("seed")

    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          { familyId: engineering.familyId, name: "Engineering", roles: [] },
          { name: "ENGINEERING", roles: [] },
        ],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    // The duplicate was never created.
    const after = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(after).toHaveLength(1)
  })

  it("rejects renaming a family onto another existing family's name", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        { name: "Engineering", roles: [] },
        { name: "Design", roles: [] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    const engineering = families.find((f) => f.name === "Engineering")
    const design = families.find((f) => f.name === "Design")
    if (engineering === undefined || design === undefined) {
      throw new Error("seed")
    }

    // Rename Design onto Engineering's name (case-insensitively).
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          { familyId: engineering.familyId, name: "Engineering", roles: [] },
          { familyId: design.familyId, name: "engineering", roles: [] },
        ],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    // Design kept its name; nothing was renamed.
    const after = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(after.map((f) => f.name).sort()).toEqual(["Design", "Engineering"])
  })

  it("still archives a draft role by omission", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Keeper", trackKey: "IC" },
            { title: "DraftGoner", trackKey: "IC" },
          ],
        },
      ],
    })
    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const keeper = roles.find((r) => r.title === "Keeper")
    const goner = roles.find((r) => r.title === "DraftGoner")
    if (family === undefined || keeper === undefined || goner === undefined) {
      throw new Error("seed")
    }

    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: family.familyId,
          name: "Engineering",
          roles: [{ roleId: keeper.roleId, title: "Keeper", trackKey: "IC" }],
        },
      ],
    })

    const after = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(after.map((r) => r.title)).toEqual(["Keeper"])
    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(1)
    expect(
      (archived[0]?.payload as { roleId: string } | undefined)?.roleId
    ).toBe(goner.roleId)
  })

  // The job profile is name-derived (AI prefill drafts purpose/responsibilities
  // from the title), so a renamed role's profile must be cleared to regenerate;
  // a track-only or family-only edit keeps it (the name did not change).
  describe("clears the name-derived profile on a title change", () => {
    // Seeds one role inside one family and gives it a non-empty profile, then
    // returns the ids the reconcile payload needs.
    async function seedRoleWithProfile(t: ReturnType<typeof initConvexTest>) {
      const { orgId, asAdmin } = await seedTemplateOrganization(t)
      await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            name: "Engineering",
            roles: [{ title: "Developer", trackKey: "IC" }],
          },
        ],
      })
      const family = (
        await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
      )[0]
      const role = (
        await asAdmin.query(api.assessment.roles.listRoles, { orgId })
      )[0]
      if (family === undefined || role === undefined) throw new Error("seed")
      await t.run(async (ctx) => {
        const docId = ctx.db.normalizeId("roles", role.roleId)
        if (docId === null) throw new Error("bad id")
        await ctx.db.patch(docId, {
          purpose: "Builds the core product.",
          responsibilities: "Implements features",
        })
      })
      return { orgId, asAdmin, family, role }
    }

    async function readProfile(
      t: ReturnType<typeof initConvexTest>,
      roleId: string
    ) {
      return await t.run(async (ctx) => {
        const docId = ctx.db.normalizeId("roles", roleId)
        if (docId === null) throw new Error("bad id")
        const doc = await ctx.db.get(docId)
        return {
          purpose: doc?.purpose,
          responsibilities: doc?.responsibilities,
        }
      })
    }

    it("renaming a role clears its purpose and responsibilities", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, family, role } = await seedRoleWithProfile(t)
      await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            familyId: family.familyId,
            name: "Engineering",
            roles: [
              {
                roleId: role.roleId,
                title: "Senior Developer",
                trackKey: "IC",
              },
            ],
          },
        ],
      })
      const profile = await readProfile(t, role.roleId)
      expect(profile.purpose).toBe("")
      expect(profile.responsibilities).toBe("")
      // The cleared fields ride along on the same role.updated audit row, and
      // the row is flagged as a rename-driven clear so the Sheet annotates the
      // emptied profile entries as cleared-on-rename, not a manual deletion.
      const updated = await auditOfType(t, orgId, "role.updated")
      expect(updated).toHaveLength(1)
      const payload = updated[0]?.payload as {
        profileClearedByRename?: boolean
        changes: Changes
      }
      expect(payload.profileClearedByRename).toBe(true)
      expect(Object.keys(payload.changes).sort()).toEqual([
        "purpose",
        "responsibilities",
        "title",
      ])
      expect(payload.changes.title).toEqual({
        from: "Developer",
        to: "Senior Developer",
      })
      expect(payload.changes.purpose).toEqual({
        from: "Builds the core product.",
        to: "",
      })
      expect(payload.changes.responsibilities).toEqual({
        from: "Implements features",
        to: "",
      })
    })

    it("a track-only change keeps the profile", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, family, role } = await seedRoleWithProfile(t)
      await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            familyId: family.familyId,
            name: "Engineering",
            roles: [
              // Same title, new track: the name did not change.
              { roleId: role.roleId, title: "Developer", trackKey: "M" },
            ],
          },
        ],
      })
      const profile = await readProfile(t, role.roleId)
      expect(profile.purpose).toBe("Builds the core product.")
      expect(profile.responsibilities).toBe("Implements features")
      const updated = await auditOfType(t, orgId, "role.updated")
      const payload = updated[0]?.payload as {
        profileClearedByRename?: boolean
        changes: Changes
      }
      expect(Object.keys(payload.changes)).toEqual(["trackKey"])
      // A track-only edit did not rename the role, so no clear flag.
      expect(payload.profileClearedByRename).toBeUndefined()
    })

    it("a family-only change keeps the profile", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, family, role } = await seedRoleWithProfile(t)
      // Add a second family to move the role into; the title is unchanged.
      await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          { familyId: family.familyId, name: "Engineering", roles: [] },
          {
            name: "Platform",
            roles: [
              { roleId: role.roleId, title: "Developer", trackKey: "IC" },
            ],
          },
        ],
      })
      const profile = await readProfile(t, role.roleId)
      expect(profile.purpose).toBe("Builds the core product.")
      expect(profile.responsibilities).toBe("Implements features")
      const updated = await auditOfType(t, orgId, "role.updated")
      const payload = updated[0]?.payload as {
        profileClearedByRename?: boolean
        changes: Changes
      }
      expect(Object.keys(payload.changes)).toEqual(["familyId"])
      expect(payload.profileClearedByRename).toBeUndefined()
    })

    it("an unchanged role keeps its profile and writes nothing", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, family, role } = await seedRoleWithProfile(t)
      await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            familyId: family.familyId,
            name: "Engineering",
            roles: [
              { roleId: role.roleId, title: "Developer", trackKey: "IC" },
            ],
          },
        ],
      })
      const profile = await readProfile(t, role.roleId)
      expect(profile.purpose).toBe("Builds the core product.")
      expect(profile.responsibilities).toBe("Implements features")
      // No field changed: no role.updated audit row at all.
      const updated = await auditOfType(t, orgId, "role.updated")
      expect(updated).toHaveLength(0)
    })
  })
})

describe("reconcileStarterSet audit before/after", () => {
  it("threads one batchId across the reconcile and records family rename from/to", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    // Seed an existing family + role (its own batch).
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" }],
        },
      ],
    })
    const seedRows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    const seedBatchIds = new Set(
      seedRows
        .map((row) => (row.payload as { batchId?: string }).batchId)
        .filter((id): id is string => id !== undefined)
    )
    expect(seedBatchIds.size).toBe(1)

    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    const role = (
      await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    )[0]
    if (family === undefined || role === undefined) throw new Error("seed")

    // Second reconcile: rename the family AND retrack the role -> 2 audit rows.
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: family.familyId,
          name: "Platform",
          roles: [{ roleId: role.roleId, title: "Developer", trackKey: "M" }],
        },
      ],
    })

    const renamed = await auditOfType(t, orgId, "roleFamily.renamed")
    expect(renamed).toHaveLength(1)
    const renamePayload = renamed[0]?.payload as {
      batchId: string
      source: string
      changes: Changes
    }
    expect(renamePayload.source).toBe("starter")
    expect(renamePayload.changes.name).toEqual({
      from: "Engineering",
      to: "Platform",
    })

    // The rename + the role.updated share ONE reconcile batchId, distinct from
    // the seed batch.
    const updated = await auditOfType(t, orgId, "role.updated")
    expect(updated).toHaveLength(1)
    const updatePayload = updated[0]?.payload as { batchId: string }
    expect(updatePayload.batchId).toBe(renamePayload.batchId)
    expect(seedBatchIds.has(renamePayload.batchId)).toBe(false)
  })

  it("logs role.archived with archivedAt to === the stored value and identity scalars", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Keeper", trackKey: "IC" },
            { title: "Goner", trackKey: "IC" },
          ],
        },
      ],
    })
    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const keeper = roles.find((r) => r.title === "Keeper")
    const goner = roles.find((r) => r.title === "Goner")
    if (family === undefined || keeper === undefined || goner === undefined) {
      throw new Error("seed")
    }

    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: family.familyId,
          name: "Engineering",
          roles: [{ roleId: keeper.roleId, title: "Keeper", trackKey: "IC" }],
        },
      ],
    })

    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(1)
    const payload = archived[0]?.payload as {
      roleId: string
      title: string
      trackKey: string
      function: string
      team: string
      familyId: string | null
      viaReconcile: boolean
      anchorRetired: boolean
      changes: Changes
    }
    expect(payload.roleId).toBe(goner.roleId)
    // Identity scalars are captured (binding correction #7).
    expect(payload.title).toBe("Goner")
    expect(payload.trackKey).toBe("IC")
    expect(payload.function).toBe("")
    expect(payload.team).toBe("")
    expect(payload.familyId).toBe(family.familyId)
    expect(payload.viaReconcile).toBe(true)
    expect(payload.anchorRetired).toBe(false)
    // The logged archivedAt `to` equals the value actually stored (hoist
    // regression: same Date.now() in the patch and the payload).
    expect(payload.changes.archivedAt?.from).toBeNull()
    const storedArchivedAt = await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", goner.roleId)
      if (docId === null) throw new Error("bad id")
      const doc = await ctx.db.get(docId)
      return doc?.archivedAt
    })
    expect(payload.changes.archivedAt?.to).toBe(storedArchivedAt)
  })

  it("captures computedBand on the via-reconcile anchorRole.updated row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Keeper", trackKey: "IC" },
            { title: "Anchor", trackKey: "IC" },
          ],
        },
      ],
    })
    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const keeper = roles.find((r) => r.title === "Keeper")
    const anchor = roles.find((r) => r.title === "Anchor")
    if (family === undefined || keeper === undefined || anchor === undefined) {
      throw new Error("seed")
    }

    // Fully rate the soon-archived role (all 5 -> top band) so it has a
    // complete assessment and can be designated as a calibration anchor.
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("model")
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      const roleDocId = ctx.db.normalizeId("roles", anchor.roleId)
      if (roleDocId === null) throw new Error("bad id")
      for (const criterion of criteria) {
        await ctx.db.insert("ratings", {
          orgId,
          roleId: roleDocId,
          criterionId: criterion._id,
          value: 5,
        })
      }
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId: anchor.roleId,
      expectedBand: 1,
      motivation: "Reference role for engineering.",
    })

    // Drop the anchored role by omission: reconcile retires its anchor.
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: family.familyId,
          name: "Engineering",
          roles: [{ roleId: keeper.roleId, title: "Keeper", trackKey: "IC" }],
        },
      ],
    })

    const rows = await auditOfType(t, orgId, "anchorRole.updated")
    const viaReconcile = rows.find(
      (row) => (row.payload as { viaReconcile?: boolean }).viaReconcile === true
    )
    expect(viaReconcile).toBeDefined()
    const payload = viaReconcile?.payload as {
      roleId: string
      viaReconcile: boolean
      computedBand: number | null
      changes: Changes
    }
    expect(payload.roleId).toBe(anchor.roleId)
    expect(payload.viaReconcile).toBe(true)
    // The live pre-archive band (top band, all ratings 5), captured before
    // the role leaves the results set, sourced from the single pre-loop derive.
    expect(payload.computedBand).toBe(1)
    // The retire diff is still recorded alongside the new field.
    expect(payload.changes.status).toMatchObject({ to: "replaced" })
  })

  it("records a removed family's cleared roles as items with familyId from/to", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" }],
        },
        { name: "Doomed", roles: [{ title: "Temp", trackKey: "IC" }] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    const engineering = families.find((f) => f.name === "Engineering")
    const doomed = families.find((f) => f.name === "Doomed")
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const developer = roles.find((r) => r.title === "Developer")
    const temp = roles.find((r) => r.title === "Temp")
    if (
      engineering === undefined ||
      doomed === undefined ||
      developer === undefined ||
      temp === undefined
    ) {
      throw new Error("seed")
    }

    // Drop the Doomed family (and its role) by omission.
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          familyId: engineering.familyId,
          name: "Engineering",
          roles: [
            { roleId: developer.roleId, title: "Developer", trackKey: "IC" },
          ],
        },
      ],
    })

    const removed = await auditOfType(t, orgId, "roleFamily.removed")
    expect(removed).toHaveLength(1)
    const payload = removed[0]?.payload as {
      familyId: string
      name: string
      viaReconcile: boolean
      batchId: string
      changes: Changes
      count: number
      items: Array<{ roleId: string; changes: Changes }>
    }
    expect(payload.familyId).toBe(doomed.familyId)
    expect(payload.name).toBe("Doomed")
    expect(payload.viaReconcile).toBe(true)
    expect(typeof payload.batchId).toBe("string")
    // The family's own diff: name removed.
    expect(payload.changes.name).toEqual({ from: "Doomed", to: null })
    // The cleared (archived) role rides along in items with the family-id
    // constant as `from` (binding correction #15), never a post-patch get.
    expect(payload.count).toBe(1)
    expect(payload.items).toHaveLength(1)
    const item = payload.items[0]
    expect(item?.roleId).toBe(temp.roleId)
    expect(item?.changes.familyId).toEqual({
      from: doomed.familyId,
      to: null,
    })
  })
})
