import { isValidLevelForTrack, TRACK_LEVELS } from "@workspace/constants"
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
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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

  it("accepts empty function and team (optional context)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Unmapped Specialist",
      function: "  ",
      team: "",
      trackKey: track.key,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.function).toBe("")
      expect(role?.team).toBe("")
    })
  })
})

describe("listRoles and getRole", () => {
  it("lists non-archived roles with progress and resolves a role with its ratings", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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

  it("edits the role: a track swap re-suggests the level and flags it unconfirmed", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    const otherTrack = model.tracks.find((tr) => tr.key !== track.key)
    if (otherTrack === undefined) throw new Error("seed")
    // Assign a person at a level valid for the CURRENT track.
    const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
    if (level === undefined) throw new Error("seed")
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level,
      levelSource: "confirmed",
    })

    // The track change is NOT blocked: it re-suggests the level for the new
    // track and flags it unconfirmed, rather than orphaning it.
    const result = await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    expect(result.levelsReset).toBe(1)

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)

      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const open = assignments.find((a) => a.endedAt === undefined)
      expect(open).toBeDefined()
      // Re-suggested, unconfirmed, and valid for the NEW track.
      expect(open?.levelSource).toBe("suggested")
      expect(isValidLevelForTrack(otherTrack.key, open?.level ?? "")).toBe(true)
    })
  })

  it("track swap with no active assignments returns levelsReset 0", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    const otherTrack = model.tracks.find((tr) => tr.key !== track.key)
    if (otherTrack === undefined) throw new Error("seed")
    const result = await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    expect(result.levelsReset).toBe(0)
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)
    })
  })

  it("track swap leaves a closed (historical) assignment untouched", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    const { roleId: otherRoleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Other Role",
        function: "Engineering",
        team: "Core",
        trackKey: track.key,
      }
    )
    const otherTrack = model.tracks.find((tr) => tr.key !== track.key)
    if (otherTrack === undefined) throw new Error("seed")
    const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
    if (level === undefined) throw new Error("seed")

    // Person A is assigned to roleId, then reassigned elsewhere so the
    // roleId row becomes CLOSED (endedAt set) history, not the active
    // assignment.
    const { personId: closedPersonId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Alva Historik", gender: "Kvinna" }
    )
    const ts1 = 1_700_000_000_000
    const ts2 = 1_700_000_100_000
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: closedPersonId,
      roleId,
      level,
      levelSource: "confirmed",
      effectiveAt: ts1,
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: closedPersonId,
      roleId: otherRoleId,
      level,
      levelSource: "confirmed",
      effectiveAt: ts2,
    })

    // Person B is assigned to roleId and left open: the only active
    // assignment on this role when the track changes.
    const { personId: openPersonId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: openPersonId,
      roleId,
      level,
      levelSource: "confirmed",
    })

    const closedBefore = await t.run(async (ctx) => {
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", closedPersonId)
        )
        .collect()
      const closed = assignments.find((a) => a.endedAt !== undefined)
      if (closed === undefined) {
        throw new Error("expected a closed assignment")
      }
      return closed
    })
    expect(closedBefore.roleId).toBe(roleId)

    const result = await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    // Only the ACTIVE orphaned assignment (person B) is reset; the closed
    // history row (person A) is left alone and does not count.
    expect(result.levelsReset).toBe(1)

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)

      // The closed row's level and levelSource are UNCHANGED: closed history
      // is never reset, only the currently active assignment.
      const closedAfter = await ctx.db.get(closedBefore._id)
      expect(closedAfter?.level).toBe(closedBefore.level)
      expect(closedAfter?.levelSource).toBe(closedBefore.levelSource)
      expect(closedAfter?.endedAt).toBe(closedBefore.endedAt)

      const openAssignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", openPersonId)
        )
        .collect()
      const open = openAssignments.find((a) => a.endedAt === undefined)
      expect(open).toBeDefined()
      // Re-suggested, unconfirmed, and valid for the NEW track.
      expect(open?.levelSource).toBe("suggested")
      expect(isValidLevelForTrack(otherTrack.key, open?.level ?? "")).toBe(true)
    })
  })

  it("clears function and team with an empty string (optional context)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
    })
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      function: "",
      team: "  ",
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.function).toBe("")
      expect(role?.team).toBe("")
    })
  })
})

describe("archiveRole", () => {
  it("soft-archives (admin only), logs band.shift to null, hides from listRoles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const asEditor = await addEditor(t, orgId, "editor2@acme.se")
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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

  it("captures computedBand on the via-archive anchorRole.updated row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Anchor Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      purpose: "p",
      responsibilities: "r",
    })
    // All ratings 5, so the computed band is the top band (1).
    await rateAll(t, orgId, roleId as string, model.criteria, 5)
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedBand: 1,
      motivation: "Reference role for engineering.",
    })

    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      const viaArchive = rows.find(
        (row) => (row.payload as { viaArchive?: boolean }).viaArchive === true
      )
      expect(viaArchive).toBeDefined()
      const payload = viaArchive?.payload as {
        roleId?: string
        viaArchive?: boolean
        computedBand?: number | null
        changes?: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.roleId).toBe(roleId)
      // The live pre-archive band (top band, all ratings 5), captured before
      // the role leaves the results set.
      expect(payload.computedBand).toBe(1)
      // The retire diff is still recorded alongside the new field.
      expect(payload.changes?.status).toMatchObject({ to: "replaced" })
    })
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
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
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

describe("role slugs", () => {
  it("sets a slug from the title and resolves it via getRoleBySlug", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const { roleId, slug } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "System Developer",
        function: "Eng",
        team: "Core",
        trackKey: track.key,
      }
    )
    expect(slug).toBe("system-developer")
    const role = await asAdmin.query(api.assessment.roles.getRoleBySlug, {
      orgId,
      slug: "system-developer",
    })
    expect(role?.roleId).toBe(roleId)
    expect(role?.title).toBe("System Developer")
  })

  it("getRoleBySlug returns null for an unknown slug (the 404 contract)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    expect(
      await asAdmin.query(api.assessment.roles.getRoleBySlug, {
        orgId,
        slug: "does-not-exist",
      })
    ).toBeNull()
  })

  it("getRoleBySlug is org-scoped: another org's slug never resolves", async () => {
    const t = initConvexTest()
    const a = await seedTemplateOrganization(t, "a@x.se")
    const b = await seedTemplateOrganization(t, "b@x.se")
    await a.asAdmin.mutation(api.assessment.roles.createRole, {
      orgId: a.orgId,
      title: "System Developer",
      function: "Eng",
      team: "Core",
      trackKey: a.track.key,
    })
    // Org B has no such role; the slug must not leak across the tenant boundary.
    expect(
      await b.asAdmin.query(api.assessment.roles.getRoleBySlug, {
        orgId: b.orgId,
        slug: "system-developer",
      })
    ).toBeNull()
  })

  it("regenerates the slug on a title change and keeps it otherwise", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "System Developer",
      function: "Eng",
      team: "Core",
      trackKey: track.key,
    })
    // A non-title change leaves the slug untouched (no URL churn).
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      team: "Platform",
    })
    const before = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId,
    })
    expect(before?.slug).toBe("system-developer")
    // A title change regenerates it.
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      title: "Senior Developer",
    })
    const after = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId,
    })
    expect(after?.slug).toBe("senior-developer")
  })

  it("rejects a duplicate title within a family but allows it across families", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const eng = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    const sales = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Sales" }
    )
    const base = { orgId, function: "F", team: "T", trackKey: track.key }
    await asAdmin.mutation(api.assessment.roles.createRole, {
      ...base,
      title: "Manager",
      familyId: eng,
    })
    // Same title in the same family is rejected (case-insensitive).
    await expect(
      asAdmin.mutation(api.assessment.roles.createRole, {
        ...base,
        title: "manager",
        familyId: eng,
      })
    ).rejects.toThrow(/errors.roleExists/)
    // Same title in a different family is allowed; its slug is family-prefixed
    // to stay org-unique for the route.
    const { slug } = await asAdmin.mutation(api.assessment.roles.createRole, {
      ...base,
      title: "Manager",
      familyId: sales,
    })
    expect(slug).toBe("sales-manager")
  })

  it("getRoleBySlug returns the family slug, or null when unfiled", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
    const techId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const filed = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Platform Engineer",
      function: "Eng",
      team: "Core",
      trackKey: track.key,
      familyId: techId,
    })
    const unfiled = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Office Coordinator",
      function: "Ops",
      team: "Ops",
      trackKey: track.key,
    })

    const filedDetail = await asAdmin.query(
      api.assessment.roles.getRoleBySlug,
      { orgId, slug: filed.slug }
    )
    expect(filedDetail?.familyName).toBe("Tech")
    expect(filedDetail?.familySlug).toBe("tech")

    const unfiledDetail = await asAdmin.query(
      api.assessment.roles.getRoleBySlug,
      { orgId, slug: unfiled.slug }
    )
    expect(unfiledDetail?.familyName).toBeNull()
    expect(unfiledDetail?.familySlug).toBeNull()
  })
})
