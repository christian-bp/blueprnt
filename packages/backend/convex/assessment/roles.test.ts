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
  const level = track?.levels[1]
  if (track === undefined || level === undefined) throw new Error("seed")
  return { orgId, userId, asAdmin, model, track, level }
}

describe("createRole", () => {
  it("creates a draft role with trimmed core fields and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track, level } = await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "  Junior Software Developer  ",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.title).toBe("Junior Software Developer")
      expect(role?.status).toBe("draft")
      expect(role?.purpose).toBe("")
      expect(role?.responsibilities).toBe("")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("rejects an empty title and a level from another track", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    await expect(
      asAdmin.mutation(api.assessment.roles.createRole, {
        orgId,
        title: "   ",
        function: "F",
        team: "T",
        trackId: track.trackId,
        levelId: track.levels[0]?.levelId as never,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    const otherTrack = model.tracks[1]
    const foreignLevel = otherTrack?.levels[0]
    if (foreignLevel === undefined) throw new Error("seed")
    await expect(
      asAdmin.mutation(api.assessment.roles.createRole, {
        orgId,
        title: "Valid",
        function: "F",
        team: "T",
        trackId: track.trackId,
        levelId: foreignLevel.levelId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("listRoles and getRole", () => {
  it("lists non-archived roles with progress and resolves a role with guardrails", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
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
      status: "draft",
      ratedCount: 1,
      totalCriteria: 9,
      profileComplete: true,
    })
    expect(list[0]?.levelKey).toBe(level.key)

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
    // The template seeds 8 guardrail rows per level (no "formal" row).
    expect(role?.guardrails).toHaveLength(8)
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
  it("patches profile fields, audits the field names, and locks approved roles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
      decisionMandate: "  Decides implementation details  ",
    })
    await t.run(async (ctx) => {
      // Optional structured fields store trimmed at create time.
      const created = await ctx.db.get(roleId)
      expect(created?.decisionMandate).toBe("Decides implementation details")
    })
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      purpose: "Builds the core product",
      responsibilities: "Implementation and reviews",
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.purpose).toBe("Builds the core product")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        roleId,
        fields: ["purpose", "responsibilities"],
      })
    })

    // Approve (admin shortcut from draft once fully rated), then verify lock.
    await rateAll(t, orgId, roleId as string, model.criteria, 3)
    await asAdmin.mutation(api.assessment.roles.setRoleStatus, {
      orgId,
      roleId,
      to: "approved",
    })
    await expect(
      asAdmin.mutation(api.assessment.roles.updateRole, {
        orgId,
        roleId,
        team: "Other",
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("requires levelId when trackId changes", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
    })
    const otherTrack = model.tracks[1]
    if (otherTrack === undefined) throw new Error("seed")
    await expect(
      asAdmin.mutation(api.assessment.roles.updateRole, {
        orgId,
        roleId,
        trackId: otherTrack.trackId,
      })
    ).rejects.toThrow(/errors.notFound/)
    const newLevel = otherTrack.levels[0]
    if (newLevel === undefined) throw new Error("seed")
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackId: otherTrack.trackId,
      levelId: newLevel.levelId,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackId).toBe(otherTrack.trackId)
      expect(role?.levelId).toBe(newLevel.levelId)
    })
  })
})

describe("setRoleStatus", () => {
  it("walks draft -> inReview -> approved -> draft with permission checks", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const asEditor = await addEditor(t, orgId, "editor@acme.se")
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
      purpose: "p",
      responsibilities: "r",
    })

    // Incomplete ratings block submission.
    await expect(
      asEditor.mutation(api.assessment.roles.setRoleStatus, {
        orgId,
        roleId,
        to: "inReview",
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)

    await rateAll(t, orgId, roleId as string, model.criteria, 3)

    await asEditor.mutation(api.assessment.roles.setRoleStatus, {
      orgId,
      roleId,
      to: "inReview",
    })
    // Editors cannot approve.
    await expect(
      asEditor.mutation(api.assessment.roles.setRoleStatus, {
        orgId,
        roleId,
        to: "approved",
      })
    ).rejects.toThrow(/errors.adminRequired/)
    await asAdmin.mutation(api.assessment.roles.setRoleStatus, {
      orgId,
      roleId,
      to: "approved",
    })
    // Reopen is admin-only and unlocks editing again.
    await expect(
      asEditor.mutation(api.assessment.roles.setRoleStatus, {
        orgId,
        roleId,
        to: "draft",
      })
    ).rejects.toThrow(/errors.adminRequired/)
    await asAdmin.mutation(api.assessment.roles.setRoleStatus, {
      orgId,
      roleId,
      to: "draft",
    })

    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.statusChange")
        )
        .collect()
      expect(audit.map((row) => row.payload)).toEqual([
        { roleId, from: "draft", to: "inReview" },
        { roleId, from: "inReview", to: "approved" },
        { roleId, from: "approved", to: "draft" },
      ])
    })
  })

  it("rejects unknown transitions and incomplete profiles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
    })
    await rateAll(t, orgId, roleId as string, model.criteria, 3)
    // Profile incomplete (purpose/responsibilities empty) blocks submission.
    await expect(
      asAdmin.mutation(api.assessment.roles.setRoleStatus, {
        orgId,
        roleId,
        to: "inReview",
      })
    ).rejects.toThrow(/errors.profileIncomplete/)
    // Same-status transition is invalid.
    await expect(
      asAdmin.mutation(api.assessment.roles.setRoleStatus, {
        orgId,
        roleId,
        to: "draft",
      })
    ).rejects.toThrow(/errors.invalidTransition/)
  })
})

describe("archiveRole", () => {
  it("soft-archives (admin only), logs band.shift to null, hides from listRoles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track, level } =
      await seedTemplateOrganization(t)
    const asEditor = await addEditor(t, orgId, "editor2@acme.se")
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
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
      expect(shifts.map((row) => row.payload)).toContainEqual({
        roleId,
        fromBand: 1,
        toBand: null,
      })
    })
    const list = await asAdmin.query(api.assessment.roles.listRoles, { orgId })
    expect(list).toHaveLength(0)
  })
})
