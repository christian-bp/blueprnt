import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedReadyOrganization(t: ReturnType<typeof initConvexTest>) {
  const email = `hr-method-${Math.random()}@acme.se`
  const name = "HR Person"
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    {
      email,
      name,
      role: "admin",
    }
  )
  // Seed the users mirror so decidedByName lookups resolve in getMethodModel.
  await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
    authId: userId,
    email,
    name,
  })
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      employeeCount: 25,
      industry: "itTelecom",
    })
  })
  await t
    .withIdentity({ subject: userId })
    .mutation(api.evaluationModel.model.createModelFromTemplate, { orgId })
  return { orgId, asAdmin: t.withIdentity({ subject: userId }) }
}

describe("criterion compliance write path", () => {
  it("saves rationale + bias fields and audits with no band-shift", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    const criterionId = model?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("no criterion")

    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "Measure scope of impact",
      whyRelevant: "Distinguishes seniority objectively",
      overlapNotes: "",
      biasRisk: "low",
      biasComment: "Gender-neutral wording checked",
      biasAction: "",
    })

    const saved = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(saved?.purpose).toBe("Measure scope of impact")
    expect(saved?.overlapNotes).toBeUndefined() // empty string clears
    expect(saved?.biasRisk).toBe("low")

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    const compliance = rows.filter(
      (r) =>
        (r.payload as { change?: string }).change ===
        "criterion.complianceUpdated"
    )
    expect(compliance).toHaveLength(1)
    const bandShifts = rows.filter((r) => r.type === "band.shift")
    expect(bandShifts).toHaveLength(0)
  })

  it("blocks approval until documented, then stamps and reopens on edit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    const criterionId = model?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("no criterion")

    await expect(
      asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
        orgId,
        criterionId,
        approved: true,
      })
    ).rejects.toThrow(/invalidInput/)

    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: "",
      biasRisk: "medium",
      biasComment: "b",
      biasAction: "",
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: true,
    })
    let doc = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(doc?.approved).toBe(true)
    expect(typeof doc?.decidedBy).toBe("string")
    expect(typeof doc?.decidedAt).toBe("number")

    // The approval audit row must NOT contain decidedBy or decidedAt in changes.
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    const approvalRow = rows.find(
      (r) =>
        (r.payload as { change?: string }).change ===
        "criterion.approvalChanged"
    )
    expect(approvalRow).toBeDefined()
    const changes =
      (approvalRow?.payload as { changes?: Record<string, unknown> }).changes ??
      {}
    expect("decidedBy" in changes).toBe(false)
    expect("decidedAt" in changes).toBe(false)

    // Editing content reopens the sign-off.
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "p2",
      whyRelevant: "w",
      overlapNotes: "",
      biasRisk: "medium",
      biasComment: "b",
      biasAction: "",
    })
    doc = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(doc?.approved).toBeUndefined()
    expect(doc?.decidedBy).toBeUndefined()
  })

  it("rejects a criterion from another org", async () => {
    const t = initConvexTest()
    const a = await seedReadyOrganization(t)
    const b = await seedReadyOrganization(t)
    const modelB = await b.asAdmin.query(api.evaluationModel.model.getModel, {
      orgId: b.orgId,
    })
    const foreignCriterion = modelB?.criteria[0]?.criterionId
    if (foreignCriterion === undefined) throw new Error("no criterion")
    await expect(
      a.asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
        orgId: a.orgId,
        criterionId: foreignCriterion,
        purpose: "x",
        whyRelevant: "x",
        overlapNotes: "",
        biasRisk: "low",
        biasComment: "x",
        biasAction: "",
      })
    ).rejects.toThrow(/notFound/)
  })
})

describe("getMethodModel", () => {
  it("returns localized names, shares, status, and aggregate progress", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const base = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      {
        orgId,
        locale: "sv",
      }
    )
    expect(base?.criteria.length).toBeGreaterThanOrEqual(5)
    expect(base?.criteria[0]?.name).toBe("Scope & Påverkan") // localized sv
    const totalShare = (base?.criteria ?? []).reduce((s, c) => s + c.share, 0)
    expect(Math.abs(totalShare - 100)).toBeLessThanOrEqual(
      base?.criteria.length ?? 0
    ) // rounding
    expect(base?.criteria.every((c) => c.status === "notStarted")).toBe(true)
    expect(base?.progress).toEqual({
      documented: 0,
      approved: 0,
      total: 9, // standard template has 9 criteria (CRITERION_KEYS in standardTemplate.ts)
    })

    const criterionId = base?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("no criterion")
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: "",
      biasRisk: "low",
      biasComment: "b",
      biasAction: "",
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: true,
    })
    const after = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      {
        orgId,
        locale: "sv",
      }
    )
    const target = after?.criteria.find((c) => c.criterionId === criterionId)
    expect(target?.status).toBe("approved")
    expect(target?.decidedByName).not.toBeNull()
    expect(after?.progress.documented).toBe(1)
    expect(after?.progress.approved).toBe(1)
  })
})
