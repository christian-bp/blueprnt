import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
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
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed")
  return { orgId, asAdmin, track }
}

describe("role families", () => {
  it("creates, lists with role counts, and rejects duplicate names", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "  Software Engineering  " }
    )
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roleFamilies", familyId)
      if (docId === null) throw new Error("bad family id")
      await ctx.db.insert("roles", {
        orgId,
        title: "Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
        familyId: docId,
      })
    })
    // Case-insensitive duplicate is rejected.
    await expect(
      asAdmin.mutation(api.assessment.families.createRoleFamily, {
        orgId,
        name: "software engineering",
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)

    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toEqual([
      { familyId, name: "Software Engineering", roleCount: 1 },
    ])
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        familyId,
        changes: { name: { from: null, to: "Software Engineering" } },
      })
    })
  })

  it("renames with validation and a no-op short-circuit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const otherId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Sales" }
    )
    // Renaming to another family's name (case-insensitive) is rejected.
    await expect(
      asAdmin.mutation(api.assessment.families.renameRoleFamily, {
        orgId,
        familyId,
        name: "sales",
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    // Unchanged name is a silent no-op (no audit row).
    await asAdmin.mutation(api.assessment.families.renameRoleFamily, {
      orgId,
      familyId,
      name: "Tech",
    })
    await asAdmin.mutation(api.assessment.families.renameRoleFamily, {
      orgId,
      familyId,
      name: "Teknik",
    })
    await t.run(async (ctx) => {
      const familyDocId = ctx.db.normalizeId("roleFamilies", familyId)
      if (familyDocId === null) throw new Error("bad family id")
      const otherDocId = ctx.db.normalizeId("roleFamilies", otherId)
      if (otherDocId === null) throw new Error("bad other id")
      const family = await ctx.db.get(familyDocId)
      expect(family?.name).toBe("Teknik")
      const other = await ctx.db.get(otherDocId)
      expect(other?.name).toBe("Sales")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.renamed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        familyId,
        changes: { name: { from: "Tech", to: "Teknik" } },
      })
    })
  })

  it("removal clears membership from roles and audits the cleared ids", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const roleId = await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roleFamilies", familyId)
      if (docId === null) throw new Error("bad family id")
      return await ctx.db.insert("roles", {
        orgId,
        title: "Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
        familyId: docId,
      })
    })
    await asAdmin.mutation(api.assessment.families.removeRoleFamily, {
      orgId,
      familyId,
    })
    await t.run(async (ctx) => {
      const familyDocId = ctx.db.normalizeId("roleFamilies", familyId)
      if (familyDocId === null) throw new Error("bad family id")
      expect(await ctx.db.get(familyDocId)).toBeNull()
      const roleDocId = ctx.db.normalizeId("roles", roleId)
      if (roleDocId === null) throw new Error("bad role id")
      const role = await ctx.db.get(roleDocId)
      // The role row survives; only the membership is cleared.
      expect(role).not.toBeNull()
      expect(role?.familyId).toBeUndefined()
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.removed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        familyId,
        name: "Tech",
        changes: { name: { from: "Tech", to: null } },
        count: 1,
        items: [
          {
            roleId,
            changes: { familyId: { from: familyId, to: null } },
          },
        ],
      })
      // Binding correction #15: each item's `from` is the removed family id,
      // captured before the patch, never null/undefined.
      const payload = audit[0]?.payload as {
        items: Array<{ changes: { familyId: { from: string; to: null } } }>
      }
      expect(payload.items[0]?.changes.familyId.from).toBe(familyId)
    })
  })
})
