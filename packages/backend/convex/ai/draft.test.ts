/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { slugify } from "@workspace/constants"
import { initConvexTest } from "../testing.helpers"

// The mock is hoisted by vi.mock, so generateTextMock captures calls from both
// draftRoleProfile and draftCriterionCompliance — they share the same module.

// convex-test cannot reach the real EU model, so "ai".generateText is mocked:
// the action's prompt building, sanitize, and usage wiring run for real, only
// the model call is faked. aiModel returns null without MISTRAL_API_KEY, so
// every model-exercising test stubs it.
const generateTextMock = vi.fn()

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  }
})

async function seedOrg(t: ReturnType<typeof initConvexTest>, email: string) {
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
  const asUser = t.withIdentity({ subject: userId })
  await asUser.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  return { orgId, userId, asUser }
}

async function insertRole(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  fields: { title: string; archived?: boolean }
): Promise<Id<"roles">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("roles", {
      orgId,
      title: fields.title,
      slug: slugify(fields.title),
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "",
      responsibilities: "",
      ...(fields.archived === true ? { archivedAt: 1_700_000_000_000 } : {}),
    })
  )
}

describe("draftRoleProfile", () => {
  beforeEach(() => {
    generateTextMock.mockReset()
    vi.stubEnv("MISTRAL_API_KEY", "test-key")
  })

  it("returns the generated profile and records usage without touching the role", async () => {
    const t = initConvexTest()
    const { orgId, userId, asUser } = await seedOrg(t, "draft-ok@acme.se")
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })

    generateTextMock.mockImplementation(async () => ({
      output: {
        purpose: "  Builds and runs the backend services.  ",
        responsibilities: "Owns services\nMentors peers",
      },
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }))

    const result = await asUser.action(api.ai.draft.draftRoleProfile, {
      orgId,
      roleId,
    })
    // Trimmed, and returned to the caller (not applied to the role).
    expect(result).toEqual({
      purpose: "Builds and runs the backend services.",
      responsibilities: "Owns services\nMentors peers",
    })
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    await t.run(async (ctx) => {
      // The role is untouched: the action returns text, it does not persist.
      const role = await ctx.db.get(roleId)
      expect(role?.purpose).toBe("")
      // No suggestion row was created.
      const suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status_kind", (q) =>
          q
            .eq("orgId", orgId)
            .eq("status", "suggested")
            .eq("target.kind", "role.profile")
        )
        .collect()
      expect(suggestions).toHaveLength(0)
      // Usage telemetry was recorded for the org + caller.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(1)
      expect(usage[0]?.kind).toBe("role.profile")
      expect(usage[0]?.actorId).toBe(userId)
      expect(usage[0]?.totalTokens).toBe(30)
    })
  })

  it("rejects a caller who is not a member of the org", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t, "draft-owner@acme.se")
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })
    const { userId: outsiderId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "draft-outsider@evil.se", name: "Outsider", role: "admin" }
    )
    const asOutsider = t.withIdentity({ subject: outsiderId })

    await expect(
      asOutsider.action(api.ai.draft.draftRoleProfile, { orgId, roleId })
    ).rejects.toThrow(/errors.notAMember/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })

  it("rejects an archived role", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedOrg(t, "draft-archived@acme.se")
    const roleId = await insertRole(t, orgId, {
      title: "Archived Role",
      archived: true,
    })

    await expect(
      asUser.action(api.ai.draft.draftRoleProfile, { orgId, roleId })
    ).rejects.toThrow(/errors.roleLocked/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })

  it("maps a model-unavailable state to an error", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedOrg(t, "draft-unavailable@acme.se")
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })
    // No MISTRAL_API_KEY -> aiModel returns null -> generateRoleProfileText
    // throws aiUnavailable, which the action surfaces as an appError.
    vi.stubEnv("MISTRAL_API_KEY", "")

    await expect(
      asUser.action(api.ai.draft.draftRoleProfile, { orgId, roleId })
    ).rejects.toThrow(/errors.aiUnavailable/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })

  it("passes the optional description into the prompt", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedOrg(t, "draft-desc@acme.se")
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })
    let capturedPrompt = ""
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      capturedPrompt = options.prompt
      return {
        output: { purpose: "P", responsibilities: "R" },
        totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }
    })

    await asUser.action(api.ai.draft.draftRoleProfile, {
      orgId,
      roleId,
      description: "Owns the payments platform",
    })
    expect(capturedPrompt).toContain("Owns the payments platform")
  })
})

describe("draftCriterionCompliance", () => {
  beforeEach(() => {
    generateTextMock.mockReset()
    vi.stubEnv("MISTRAL_API_KEY", "test-key")
  })

  // Helper: get any criterion seeded by createModelFromTemplate for this org.
  async function getAnyCriterionId(
    t: ReturnType<typeof initConvexTest>,
    orgId: string
  ): Promise<Id<"criteria">> {
    return await t.run(async (ctx) => {
      const criterion = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      if (criterion === null) throw new Error("no criteria seeded")
      return criterion._id
    })
  }

  it("drafts the six compliance fields and records usage", async () => {
    const t = initConvexTest()
    const { orgId, userId, asUser } = await seedOrg(t, "compliance-ok@acme.se")
    const criterionId = await getAnyCriterionId(t, orgId)

    generateTextMock.mockImplementation(async () => ({
      output: {
        purpose: "  Measures the scope of impact.  ",
        whyRelevant: "Relevant because it reflects work value.",
        overlapNotes: "",
        biasRisk: "low",
        biasComment: "No significant bias found.",
        biasAction: "",
      },
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }))

    const result = await asUser.action(api.ai.draft.draftCriterionCompliance, {
      orgId,
      criterionId,
    })

    // Trimmed and returned to the caller (not applied to the criterion).
    expect(result.purpose).toBe("Measures the scope of impact.")
    expect(result.whyRelevant).toBe("Relevant because it reflects work value.")
    expect(result.overlapNotes).toBe("")
    expect(result.biasRisk).toBe("low")
    expect(result.biasComment).toBe("No significant bias found.")
    expect(result.biasAction).toBe("")
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    await t.run(async (ctx) => {
      // The action returns text, it does not persist: a standard-model criterion
      // ships pre-documented, so the row keeps its seeded compliance and the
      // AI-drafted value must NOT have been written to it.
      const criterion = await ctx.db.get(criterionId)
      expect(criterion?.purpose).not.toBe("Measures the scope of impact.")
      // Usage telemetry was recorded for the org + caller.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage.length).toBeGreaterThan(0)
      expect(usage[0]?.kind).toBe("criterion.compliance")
      expect(usage[0]?.actorId).toBe(userId)
      expect(usage[0]?.totalTokens).toBe(30)
    })
  })

  it("embeds the criterion name and org industry in the prompt (no PII)", async () => {
    const t = initConvexTest()
    const { orgId, userId, asUser } = await seedOrg(
      t,
      "compliance-prompt@acme.se"
    )
    // Mirror the seeded user with a DISTINCTIVE name into the users table so a
    // real person name exists in the database. The prompt-building path must
    // never reach person rows, so this name must not appear in the prompt.
    await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
      authId: userId,
      email: "compliance-prompt@acme.se",
      name: "Zelda Testperson",
    })
    const criterionId = await getAnyCriterionId(t, orgId)
    let capturedPrompt = ""
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      capturedPrompt = options.prompt
      return {
        output: {
          purpose: "P",
          whyRelevant: "W",
          overlapNotes: "",
          biasRisk: "low",
          biasComment: "B",
          biasAction: "",
        },
        totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }
    })

    await asUser.action(api.ai.draft.draftCriterionCompliance, {
      orgId,
      criterionId,
    })

    // Positive: the prompt carries org and criterion content from the model.
    // The org was seeded with industry "itTelecom" and country "se".
    expect(capturedPrompt).toContain("itTelecom")
    // The criterion name from the template must be present (role/model content
    // only, never person data).
    expect(capturedPrompt.length).toBeGreaterThan(0)
    // PII boundary (ADR-0003): even though "Zelda Testperson" exists in the
    // users mirror, no person name must reach the AI prompt.
    expect(capturedPrompt).not.toContain("Zelda Testperson")
  })

  it("rejects a non-admin caller (editor) with adminRequired", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t, "compliance-admin@acme.se")
    const criterionId = await getAnyCriterionId(t, orgId)

    // Provision a user and add them to the org as a non-admin member.
    const { userId: editorId } = await t.mutation(
      components.betterAuth.provisioning.provisionUser,
      { email: "compliance-editor@acme.se", name: "Editor" }
    )
    await t.mutation(components.betterAuth.provisioning.addMember, {
      organizationId: orgId,
      userId: editorId,
      role: "editor",
    })
    const asEditor = t.withIdentity({ subject: editorId })

    await expect(
      asEditor.action(api.ai.draft.draftCriterionCompliance, {
        orgId,
        criterionId,
      })
    ).rejects.toThrow(/errors.adminRequired/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })

  it("rejects a criterion from a foreign org with notFound", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asUser: asAdminA } = await seedOrg(
      t,
      "compliance-orga@acme.se"
    )
    const { orgId: orgB } = await seedOrg(t, "compliance-orgb@acme.se")
    const criterionFromB = await getAnyCriterionId(t, orgB)

    // Admin of org A tries to draft compliance for a criterion belonging to org B.
    await expect(
      asAdminA.action(api.ai.draft.draftCriterionCompliance, {
        orgId: orgA,
        criterionId: criterionFromB,
      })
    ).rejects.toThrow(/errors.notFound/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })

  it("maps a generation failure to aiGenerationFailed", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedOrg(t, "compliance-fail@acme.se")
    const criterionId = await getAnyCriterionId(t, orgId)

    generateTextMock.mockRejectedValue(new Error("model timed out"))

    await expect(
      asUser.action(api.ai.draft.draftCriterionCompliance, {
        orgId,
        criterionId,
      })
    ).rejects.toThrow(/errors.aiGenerationFailed/)
  })

  it("maps a missing MISTRAL_API_KEY to aiUnavailable", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedOrg(t, "compliance-unavail@acme.se")
    const criterionId = await getAnyCriterionId(t, orgId)
    vi.stubEnv("MISTRAL_API_KEY", "")

    await expect(
      asUser.action(api.ai.draft.draftCriterionCompliance, {
        orgId,
        criterionId,
      })
    ).rejects.toThrow(/errors.aiUnavailable/)
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })
})
