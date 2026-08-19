import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// 7 of the 8 usual demo keys, deliberately leaving the workingConditions
// dimension's one slot open (safety-exposure unactivated) so a test can
// activate an additional criterion without tripping the model-wide 8 cap.
const SEVEN_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
] as const

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@anchor.se", name: "HR Person", role: "admin" }
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of SEVEN_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  // setRating's FIRST gate (ADR-0023) requires an approved model; this file
  // tests anchor-role behavior, not the approval checklist, so grant it
  // directly. The one test that activates an 8th criterion afterward
  // (reopening approval) never rates again, so a single grant here suffices.
  await grantModelApproval(t, orgId)
  return { orgId, asAdmin, model }
}

async function createRatedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: { criteria: { criterionId: string }[] }
  title: string
  value: number
  rateCount?: number
}) {
  const { roleId } = await args.asAdmin.mutation(
    api.assessment.roles.createRole,
    {
      orgId: args.orgId,
      title: args.title,
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "p",
      responsibilities: "r",
    }
  )
  const count = args.rateCount ?? args.model.criteria.length
  // 1, 4, and 5 require a motivation; a uniform value applies to every
  // criterion in the slice, so it either needs one everywhere or nowhere.
  const requiresMotivation =
    args.value === 1 || args.value === 4 || args.value === 5
  for (const criterion of args.model.criteria.slice(0, count)) {
    await args.asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId: args.orgId,
      roleId,
      criterionId: criterion.criterionId as never,
      value: args.value,
      ...(requiresMotivation ? { motivation: "Test motivation." } : {}),
    })
  }
  return roleId
}

describe("designateAnchorRole", () => {
  it("designates a fully rated role, audits, and lists it with the computed level", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Software Developer",
      value: 5,
    })

    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 1,
      motivation: "  Stable, well-understood reference for engineering.  ",
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.anchorRole?.status).toBe("active")
      expect(role?.anchorRole?.expectedLevel).toBe(1)
      // The motivation is stored trimmed.
      expect(role?.anchorRole?.motivation).toBe(
        "Stable, well-understood reference for engineering."
      )
      expect(role?.anchorRole?.reviewedAt).toBeGreaterThan(0)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.designated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      // Create-snapshot of all 4 anchor fields, every entry from null, plus
      // the live computed level the designation is calibrated against. The
      // reviewedAt captured in the payload equals what was stored (hoist).
      expect(audit[0]?.payload).toEqual({
        roleId,
        computedLevel: 1,
        changes: {
          expectedLevel: { from: null, to: 1 },
          motivation: {
            from: null,
            to: "Stable, well-understood reference for engineering.",
          },
          status: { from: null, to: "active" },
          reviewedAt: { from: null, to: role?.anchorRole?.reviewedAt },
        },
      })
    })

    const anchors = await asAdmin.query(
      api.assessment.anchorRoles.listAnchorRoles,
      { orgId }
    )
    expect(anchors).toHaveLength(1)
    expect(anchors[0]?.title).toBe("Software Developer")
    expect(anchors[0]?.expectedLevel).toBe(1)
    // All ratings are 5, so the computed level is the top level.
    expect(anchors[0]?.computedLevel).toBe(1)

    // getRole carries the designation for the role page.
    const role = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId,
    })
    expect(role?.anchorRole?.status).toBe("active")
  })

  it("requires a complete assessment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Half Rated",
      value: 3,
      rateCount: 4,
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedLevel: 3,
        motivation: "m",
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)
  })

  it("rejects an out-of-range level and a blank motivation", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    for (const expectedLevel of [0, 13, 2.5]) {
      await expect(
        asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
          orgId,
          roleId,
          expectedLevel,
          motivation: "m",
        })
      ).rejects.toThrow(/errors.invalidInput/)
    }
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedLevel: 3,
        motivation: "   ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("rejects designating a role that is already an anchor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 3,
      motivation: "m",
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
        orgId,
        roleId,
        expectedLevel: 3,
        motivation: "m",
      })
    ).rejects.toThrow(/errors.invalidTransition/)
  })
})

describe("updateAnchorRole", () => {
  it("updates level, motivation, and status, bumps reviewedAt, and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 3,
      motivation: "first",
    })
    // Pin the stored reviewedAt to a known past value so the update's bump is
    // deterministically observable (designate and update can otherwise land in
    // the same millisecond, making buildChanges omit the unchanged timestamp).
    const before = 1_000
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      if (role?.anchorRole === undefined) throw new Error("seed")
      await ctx.db.patch(roleId, {
        anchorRole: { ...role.anchorRole, reviewedAt: before },
      })
    })

    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 4,
      motivation: "second",
      status: "underReview",
    })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.anchorRole).toMatchObject({
        expectedLevel: 4,
        motivation: "second",
        status: "underReview",
      })
      expect(role?.anchorRole?.reviewedAt).toBeGreaterThanOrEqual(before)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const payload = audit[0]?.payload as {
        roleId?: string
        computedLevel?: number | null
        motivationChanged?: unknown
        changes?: Record<string, { from: unknown; to: unknown }>
      }
      // The lossy boolean is gone; the actual before/after is captured.
      expect(payload.motivationChanged).toBeUndefined()
      // computedLevel is always captured (the live derived level).
      expect(typeof payload.computedLevel).toBe("number")
      expect(payload.changes).toEqual({
        expectedLevel: { from: 3, to: 4 },
        motivation: { from: "first", to: "second" },
        status: { from: "active", to: "underReview" },
        reviewedAt: { from: before, to: role?.anchorRole?.reviewedAt },
      })
    })
  })

  it("captures only changed fields and always the computed level on a plain edit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 3,
      motivation: "first",
    })

    // Pin reviewedAt to the past so the update's bump is deterministic (see the
    // sibling test): every update is a review, so reviewedAt always changes.
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      if (role?.anchorRole === undefined) throw new Error("seed")
      await ctx.db.patch(roleId, {
        anchorRole: { ...role.anchorRole, reviewedAt: 1_000 },
      })
    })

    // A plain motivation-only edit (no reactivation): the always-capture fix
    // means computedLevel is still present, and only motivation + reviewedAt
    // appear in changes (no expectedLevel/status, no motivationChanged key).
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      motivation: "reworded",
    })

    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const payload = audit[0]?.payload as {
        computedLevel?: number | null
        motivationChanged?: unknown
        changes?: Record<string, { from: unknown; to: unknown }>
      }
      expect(payload.motivationChanged).toBeUndefined()
      // computedLevel captured on a non-reactivation path too.
      expect(typeof payload.computedLevel).toBe("number")
      const changeKeys = Object.keys(payload.changes ?? {}).sort()
      expect(changeKeys).toEqual(["motivation", "reviewedAt"])
      expect(payload.changes?.motivation).toEqual({
        from: "first",
        to: "reworded",
      })
    })
  })

  it("reactivates a replaced anchor only while the assessment is complete", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 3,
      motivation: "m",
    })
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "replaced",
    })

    // Still fully rated: reactivation passes.
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "active",
    })
    // The reactivation row also captures the live computed level (the path that
    // already derives results), confirming always-capture there too.
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      const reactivation = audit.find((row) => {
        const c = (row.payload as { changes?: Record<string, unknown> }).changes
        const status = (c?.status ?? undefined) as
          | { from: unknown; to: unknown }
          | undefined
        return status?.from === "replaced" && status?.to === "active"
      })
      expect(
        typeof (
          reactivation?.payload as { computedLevel?: number | null } | undefined
        )?.computedLevel
      ).toBe("number")
    })
    await asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
      orgId,
      roleId,
      status: "replaced",
    })

    // A new criterion makes every role's assessment incomplete, so the
    // replaced anchor can no longer re-enter the calibration set.
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey: "safety-exposure",
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "active",
      })
    ).rejects.toThrow(/errors.ratingsIncomplete/)
  })

  it("retires the designation when the role is archived and blocks reactivation", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId,
      expectedLevel: 3,
      motivation: "m",
    })

    await asAdmin.mutation(api.assessment.roles.archiveRole, { orgId, roleId })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      // Archiving retires the anchor with its own audit row, so the role
      // page and the calibration surfaces agree.
      expect(role?.anchorRole?.status).toBe("replaced")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "anchorRole.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      // Via archive: the status transition to "replaced" is now captured as a
      // before/after change, with the pre-patch expectedLevel as a scalar.
      expect(audit[0]?.payload).toMatchObject({
        roleId,
        viaArchive: true,
        expectedLevel: 3,
        changes: {
          status: { from: "active", to: "replaced" },
        },
      })
      const payload = audit[0]?.payload as {
        changes?: { reviewedAt?: { from: unknown; to: unknown } }
      }
      // When reviewedAt was bumped (designation and archive landed in
      // different ticks), the captured `to` equals the role's stored value;
      // buildChanges legitimately omits it when the timestamps coincide.
      if (payload.changes?.reviewedAt !== undefined) {
        expect(payload.changes.reviewedAt.to).toBe(role?.anchorRole?.reviewedAt)
      }
    })

    const anchors = await asAdmin.query(
      api.assessment.anchorRoles.listAnchorRoles,
      { orgId }
    )
    expect(anchors).toHaveLength(0)

    // The archived role's anchor cannot come back to life.
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "active",
      })
    ).rejects.toThrow(/errors.roleLocked/)
  })

  it("rejects updating a role that is not an anchor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    const roleId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Ref",
      value: 3,
    })
    await expect(
      asAdmin.mutation(api.assessment.anchorRoles.updateAnchorRole, {
        orgId,
        roleId,
        status: "replaced",
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})
