import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { grantModelApproval, initConvexTest } from "../testing.helpers"

// A spread of 8 library keys across every dimension at (or under) its own
// DIMENSION_MAX_ACTIVE cap (competence 2, effort 2, responsibility 3,
// workingConditions 1), so activating all of them via activateCriterion
// never trips a cap.
const EIGHT_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

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
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of EIGHT_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  return { orgId, asAdmin }
}

describe("criterion compliance write path", () => {
  it("saves rationale + bias fields and audits with no level-shift", async () => {
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
    const levelShifts = rows.filter((r) => r.type === "level.shift")
    expect(levelShifts).toHaveLength(0)
  })

  it("blocks approval until documented, then locks on approval and requires explicit reopen to edit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    const criterionId = model?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("no criterion")

    // A seeded standard-model criterion starts documented; clear it to a
    // not-documented state to exercise the approval guard.
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "",
      whyRelevant: "",
      overlapNotes: "",
      biasRisk: undefined,
      biasComment: "",
      biasAction: "",
    })

    // Cannot approve until documented.
    await expect(
      asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
        orgId,
        criterionId,
        approved: true,
      })
    ).rejects.toThrow(/invalidInput/)

    // Document the criterion.
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

    // Approve it.
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: true,
    })
    const docAfterApproval = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(docAfterApproval?.approved).toBe(true)
    expect(typeof docAfterApproval?.decidedBy).toBe("string")
    expect(typeof docAfterApproval?.decidedAt).toBe("number")

    // The approve action must emit a dedicated criterion.approved audit row.
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    const approvalRow = rows.find((r) => r.type === "criterion.approved")
    expect(approvalRow).toBeDefined()
    const approvalPayload = approvalRow?.payload as {
      criterionId?: string
      modelId?: string
    }
    expect(approvalPayload.criterionId).toBe(criterionId)
    expect(typeof approvalPayload.modelId).toBe("string")

    // Editing content while approved must be rejected (criterionLocked).
    await expect(
      asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
        orgId,
        criterionId,
        purpose: "p2",
        whyRelevant: "w",
        overlapNotes: "",
        biasRisk: "medium",
        biasComment: "b",
        biasAction: "",
      })
    ).rejects.toThrow(/criterionLocked/)

    // Criterion remains approved (no implicit reopen).
    const docStillApproved = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(docStillApproved?.approved).toBe(true)

    // Explicit reopen via setCriterionApproval(false) clears the approval.
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId,
      criterionId,
      approved: false,
    })
    const docReopened = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(docReopened?.approved).toBeUndefined()
    expect(docReopened?.decidedBy).toBeUndefined()

    // The reopen action must emit a dedicated criterion.reopened audit row.
    const rowsAfterReopen = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    const reopenRow = rowsAfterReopen.find(
      (r) => r.type === "criterion.reopened"
    )
    expect(reopenRow).toBeDefined()
    const reopenPayload = reopenRow?.payload as {
      criterionId?: string
      modelId?: string
    }
    expect(reopenPayload.criterionId).toBe(criterionId)
    expect(typeof reopenPayload.modelId).toBe("string")

    // Now saveCriterionCompliance succeeds again.
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
    const docEdited = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(docEdited?.purpose).toBe("p2")
    expect(docEdited?.approved).toBeUndefined()
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

// Attaches a second, EDITOR-role member to an existing org: a second
// seedMembership mints a real user (its own throwaway org is never used), then
// seedDuplicateMember adds that user to the FIRST org. Mirrors addEditor in
// assessment/roles.test.ts and evaluationModel/approval.test.ts.
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
    expect(base?.criteria.length).toBe(8)
    expect(base?.criteria[0]?.name).toBe("Kunskapsdjup och specialistnivå") // localized sv
    const totalShare = (base?.criteria ?? []).reduce((s, c) => s + c.share, 0)
    expect(Math.abs(totalShare - 100)).toBeLessThanOrEqual(
      base?.criteria.length ?? 0
    ) // rounding
    // activateCriterion pre-fills purpose/whyRelevant only, so a freshly
    // activated criterion is "inProgress" (has some fields) never
    // "documented" (needs purpose+whyRelevant+biasRisk+biasComment).
    expect(base?.criteria.every((c) => c.status === "inProgress")).toBe(true)
    expect(base?.progress).toEqual({
      documented: 0,
      approved: 0,
      total: 8,
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
    // The one documented+approved criterion counts toward both; the other 7
    // stay inProgress.
    expect(after?.progress.documented).toBe(1)
    expect(after?.progress.approved).toBe(1)
  })

  it("re-localizes the library name/description/helpText but not stored compliance", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const sv = await asAdmin.query(api.evaluationModel.method.getMethodModel, {
      orgId,
      locale: "sv",
    })
    const en = await asAdmin.query(api.evaluationModel.method.getMethodModel, {
      orgId,
      locale: "en",
    })
    // The library-derived display fields re-localize per request.
    expect(sv?.criteria[0]?.name).toBe("Kunskapsdjup och specialistnivå")
    expect(en?.criteria[0]?.name).toBe("Knowledge depth and specialist level")
    expect(sv?.criteria[0]?.description).not.toBe(en?.criteria[0]?.description)
    // The stored compliance documentation (purpose/whyRelevant), pre-filled
    // once at activation in the org's own content locale, is read verbatim
    // and never re-localized by the request locale.
    expect(sv?.criteria[0]?.purpose).toBe(en?.criteria[0]?.purpose)
    expect(sv?.criteria[0]?.purpose?.length).toBeGreaterThan(0)
  })

  it("keeps HR-authored compliance identical across locales", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const before = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      { orgId, locale: "sv" }
    )
    const criterionId = before?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("no criterion")
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "HR authored purpose",
      whyRelevant: "HR authored why",
      overlapNotes: "",
      biasRisk: "high",
      biasComment: "HR authored bias",
      biasAction: "",
    })
    // Requesting en still shows the stored HR text verbatim.
    const en = await asAdmin.query(api.evaluationModel.method.getMethodModel, {
      orgId,
      locale: "en",
    })
    const edited = en?.criteria.find((c) => c.criterionId === criterionId)
    expect(edited?.purpose).toBe("HR authored purpose")
    expect(edited?.biasRisk).toBe("high")
  })

  it("carries the model's own approval separately from per-criterion progress.approved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const before = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      { orgId, locale: "sv" }
    )
    // Fresh model: no criterion individually approved, and the model itself
    // carries no approval either.
    expect(before?.modelApproved).toBe(false)

    await grantModelApproval(t, orgId)
    const after = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      { orgId, locale: "sv" }
    )
    expect(after?.modelApproved).toBe(true)
    // Approving the model does not retroactively approve any criterion's own
    // compliance write-up: the two are independent completions.
    expect(after?.progress.approved).toBe(0)
  })

  // The Metod chapter is one of the model section's four, so an admin gate on
  // its only read throws in render and leaves an editor a live tab that
  // crashes. Org-level method content, no person data: readable by any member.
  it("answers an editor member of the org", async () => {
    const t = initConvexTest()
    const { orgId } = await seedReadyOrganization(t)
    const asEditor = await addEditor(t, orgId, "method-editor@acme.se")
    const result = await asEditor.query(
      api.evaluationModel.method.getMethodModel,
      { orgId, locale: "sv" }
    )
    expect(result?.criteria.length).toBe(8)
    expect(result?.progress.total).toBe(8)
  })

  // Org scoping is untouched by the relax: a signed-in user who is not a
  // member of THIS org still gets nothing.
  it("refuses a signed-in non-member with notAMember", async () => {
    const t = initConvexTest()
    const { orgId } = await seedReadyOrganization(t)
    const { userId: outsiderId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "method-outsider@other.se", name: "Outsider", role: "admin" }
    )
    const asOutsider = t.withIdentity({ subject: outsiderId })
    await expect(
      asOutsider.query(api.evaluationModel.method.getMethodModel, {
        orgId,
        locale: "sv",
      })
    ).rejects.toThrow(/errors\.notAMember/)
  })

  it("refuses an unauthenticated caller", async () => {
    const t = initConvexTest()
    const { orgId } = await seedReadyOrganization(t)
    await expect(
      t.query(api.evaluationModel.method.getMethodModel, {
        orgId,
        locale: "sv",
      })
    ).rejects.toThrow(/errors\.notAuthenticated/)
  })
})

// The relax is a READ relax. Both writes in this file stay admin-gated, so an
// editor who can now SEE the documentation still cannot write or approve it.
describe("the method writes stay admin-only", () => {
  it("refuses an editor's compliance save and criterion approval", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(
      api.evaluationModel.method.getMethodModel,
      { orgId, locale: "sv" }
    )
    const criterionId = model?.criteria[0]?.criterionId
    if (criterionId === undefined) throw new Error("seed")
    const asEditor = await addEditor(t, orgId, "method-editor2@acme.se")

    await expect(
      asEditor.mutation(api.evaluationModel.method.saveCriterionCompliance, {
        orgId,
        criterionId,
        purpose: "Editor tried.",
        whyRelevant: "Editor tried.",
        overlapNotes: "Editor tried.",
        biasRisk: "low",
        biasComment: "Editor tried.",
        biasAction: "Editor tried.",
      })
    ).rejects.toThrow(/errors\.adminRequired/)
    await expect(
      asEditor.mutation(api.evaluationModel.method.setCriterionApproval, {
        orgId,
        criterionId,
        approved: true,
      })
    ).rejects.toThrow(/errors\.adminRequired/)
  })
})
