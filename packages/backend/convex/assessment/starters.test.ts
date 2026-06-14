import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

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
  return { orgId, asAdmin }
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
    expect(starter.families[0]?.roles[0]).toEqual({
      title: "Systemutvecklare",
      trackKey: "IC",
    })
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
      status: "draft",
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
      status: "draft",
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
    // role.updated audit rows carry the changed field names.
    const updated = await auditOfType(t, orgId, "role.updated")
    expect(updated).toHaveLength(2)
    const devUpdate = updated.find(
      (row) => (row.payload as { roleId: string }).roleId === developer.roleId
    )
    expect((devUpdate?.payload as { fields: string[] }).fields.sort()).toEqual([
      "title",
      "trackKey",
    ])
    const leadUpdate = updated.find(
      (row) => (row.payload as { roleId: string }).roleId === lead.roleId
    )
    expect((leadUpdate?.payload as { fields: string[] }).fields).toEqual([
      "familyId",
    ])
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
    // Give the soon-archived role a rating; it must survive the archive.
    await t.run(async (ctx) => {
      const model = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (model === null) throw new Error("model")
      const criterion = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .first()
      if (criterion === null) throw new Error("criterion")
      const roleDocId = ctx.db.normalizeId("roles", goner.roleId)
      if (roleDocId === null) throw new Error("bad id")
      await ctx.db.insert("ratings", {
        orgId,
        roleId: roleDocId,
        criterionId: criterion._id,
        value: 3,
      })
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
      expect(ratings).toHaveLength(1)
    })
    const archived = await auditOfType(t, orgId, "role.archived")
    expect(archived).toHaveLength(1)
    expect((archived[0]?.payload as { roleId: string }).roleId).toBe(
      goner.roleId
    )
    // No band.shift logging from reconcile.
    const shifts = await auditOfType(t, orgId, "band.shift")
    expect(shifts).toHaveLength(0)
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

  it("rejects modifying an approved role", async () => {
    const t = initConvexTest()
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
    const developer = (
      await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    ).find((r) => r.title === "Developer")
    if (family === undefined || developer === undefined) throw new Error("seed")

    // Lock the role by approving it directly (the status machine's gates are
    // out of scope here; we only need a role in the approved state).
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", developer.roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { status: "approved" })
    })

    // A payload that renames/retracks the approved role must be rejected.
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            familyId: family.familyId,
            name: "Engineering",
            roles: [
              {
                roleId: developer.roleId,
                title: "Senior Developer",
                trackKey: "M",
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/errors.roleLocked/)
    // The approved role is untouched.
    const after = (
      await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    ).find((r) => r.roleId === developer.roleId)
    expect(after).toMatchObject({
      title: "Developer",
      trackKey: "IC",
      status: "approved",
    })
  })

  it("rejects archiving an approved role by omission", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Keeper", trackKey: "IC" },
            { title: "Approved", trackKey: "IC" },
          ],
        },
      ],
    })
    const family = (
      await asAdmin.query(api.assessment.families.listRoleFamilies, { orgId })
    )[0]
    const roles = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    const keeper = roles.find((r) => r.title === "Keeper")
    const approved = roles.find((r) => r.title === "Approved")
    if (
      family === undefined ||
      keeper === undefined ||
      approved === undefined
    ) {
      throw new Error("seed")
    }
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roles", approved.roleId)
      if (docId === null) throw new Error("bad id")
      await ctx.db.patch(docId, { status: "approved" })
    })

    // Omitting the approved role would archive it: that must be rejected.
    await expect(
      asAdmin.mutation(api.assessment.starters.reconcileStarterSet, {
        orgId,
        families: [
          {
            familyId: family.familyId,
            name: "Engineering",
            roles: [{ roleId: keeper.roleId, title: "Keeper", trackKey: "IC" }],
          },
        ],
      })
    ).rejects.toThrow(/errors.roleLocked/)
    // Nothing was archived.
    const after = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(after.map((r) => r.title).sort()).toEqual(["Approved", "Keeper"])
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
    expect((archived[0]?.payload as { roleId: string }).roleId).toBe(
      goner.roleId
    )
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
      // The cleared fields ride along on the same role.updated audit row.
      const updated = await auditOfType(t, orgId, "role.updated")
      expect(updated).toHaveLength(1)
      expect(
        (updated[0]?.payload as { fields: string[] }).fields.sort()
      ).toEqual(["purpose", "responsibilities", "title"])
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
      expect((updated[0]?.payload as { fields: string[] }).fields).toEqual([
        "trackKey",
      ])
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
      expect((updated[0]?.payload as { fields: string[] }).fields).toEqual([
        "familyId",
      ])
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
