/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// convex-test cannot reach the real EU model, so the "ai" module's
// generateText is mocked: the action's prompt building and the surrounding
// suggestion/usage/apply wiring run for real, only the model call is faked.
// Each test sets generateTextMock's behavior. The action runs against the
// mocked model only when MISTRAL_API_KEY is set (aiModel returns null
// otherwise), so every test stubs it.
const generateTextMock = vi.fn()

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  }
})

// A successful generation: returns a profile + a token-usage total so the
// usage-logging path has something to record (provenance).
function okResult(purpose: string, responsibilities: string) {
  return {
    output: { purpose, responsibilities },
    totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  }
}

// Seeds an org with the standard template (so trackNames resolve) and a
// configured admin. Roles are added separately per test.
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
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  return { orgId, userId, asAdmin }
}

// Inserts a role directly (the prefill reads roles by org; createRole would
// also work but a direct insert lets us seed a non-empty profile in one step).
async function insertRole(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  fields: { title: string; purpose?: string; responsibilities?: string }
): Promise<Id<"roles">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("roles", {
      orgId,
      title: fields.title,
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: fields.purpose ?? "",
      responsibilities: fields.responsibilities ?? "",
      status: "draft",
    })
  )
}

async function readRole(
  t: ReturnType<typeof initConvexTest>,
  roleId: Id<"roles">
) {
  return await t.run(async (ctx) => ctx.db.get(roleId))
}

describe("prefillRoleProfiles", () => {
  beforeEach(() => {
    generateTextMock.mockReset()
    vi.stubEnv("MISTRAL_API_KEY", "test-key")
  })

  it("generates and auto-applies profiles only for empty-profile roles", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t, "prefill-apply@acme.se")
    const empty1 = await insertRole(t, orgId, { title: "Software Developer" })
    const empty2 = await insertRole(t, orgId, { title: "Product Manager" })
    // Already complete: must be skipped, no model call.
    const filled = await insertRole(t, orgId, {
      title: "Designer",
      purpose: "Existing purpose.",
      responsibilities: "Existing responsibilities",
    })
    // Whitespace-only counts as empty (isProfileComplete trims).
    const blank = await insertRole(t, orgId, {
      title: "QA Engineer",
      purpose: "   ",
      responsibilities: "",
    })

    generateTextMock.mockImplementation(async () =>
      okResult("Drives the role.", "Owns delivery\nMentors peers")
    )

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 3, failed: 0 })

    // Three empty roles -> exactly three model calls; the filled role was
    // skipped before any generation. This is the "no changes -> no AI" gate.
    expect(generateTextMock).toHaveBeenCalledTimes(3)

    for (const roleId of [empty1, empty2, blank]) {
      const role = await readRole(t, roleId)
      expect(role?.purpose).toBe("Drives the role.")
      expect(role?.responsibilities).toBe("Owns delivery\nMentors peers")
    }
    // The already-filled role is untouched.
    const untouched = await readRole(t, filled)
    expect(untouched?.purpose).toBe("Existing purpose.")
    expect(untouched?.responsibilities).toBe("Existing responsibilities")

    await t.run(async (ctx) => {
      // One usage event per generation, attributed to the org + the caller.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(3)
      expect(usage.every((row) => row.kind === "role.profile")).toBe(true)
      expect(usage.every((row) => row.actorId === userId)).toBe(true)
      expect(usage.every((row) => row.totalTokens === 30)).toBe(true)
      // The monthly rollup folded all three in.
      const monthly = await ctx.db
        .query("aiUsageMonthly")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId))
        .collect()
      expect(monthly).toHaveLength(1)
      expect(monthly[0]?.callCount).toBe(3)
      // Each auto-apply closed its suggestion as confirmed (provenance), and
      // wrote a role.updated audit row.
      const confirmed = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "confirmed")
        )
        .collect()
      expect(confirmed).toHaveLength(3)
      expect(confirmed.every((row) => row.confirmedBy === userId)).toBe(true)
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(3)
    })
  })

  it("makes NO model call when every role already has a profile", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-none@acme.se")
    await insertRole(t, orgId, {
      title: "Software Developer",
      purpose: "Builds things.",
      responsibilities: "Ships features",
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 0, failed: 0 })
    expect(generateTextMock).toHaveBeenCalledTimes(0)
    await t.run(async (ctx) => {
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(0)
    })
  })

  it("isolates a single role's failure: the others still apply", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-fail@acme.se")
    const good = await insertRole(t, orgId, { title: "Software Developer" })
    const bad = await insertRole(t, orgId, { title: "Bad Role" })

    // The "Bad Role" generation throws; every other call succeeds. A single
    // failure must not abort the parallel batch.
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      if (options.prompt.includes("Bad Role")) {
        throw new Error("model exploded")
      }
      return okResult("Drives the role.", "Owns delivery")
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 1, failed: 1 })

    const goodRole = await readRole(t, good)
    expect(goodRole?.purpose).toBe("Drives the role.")
    // The failed role keeps its empty profile (manual fallback on the client).
    const badRole = await readRole(t, bad)
    expect(badRole?.purpose).toBe("")
    expect(badRole?.responsibilities).toBe("")

    await t.run(async (ctx) => {
      // The failed generation's suggestion is marked failed with a code.
      const failed = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "failed")
        )
        .collect()
      expect(failed).toHaveLength(1)
      expect(failed[0]?.errorCode).toBe("errors.aiGenerationFailed")
      // The successful one still confirmed and logged usage.
      const confirmed = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "confirmed")
        )
        .collect()
      expect(confirmed).toHaveLength(1)
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Usage is recorded after a successful generateText, so only the good
      // role logged a usage event.
      expect(usage).toHaveLength(1)
    })
  })

  it("rejects a caller who is not a member of the org (foreign org)", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t, "prefill-owner@acme.se")
    await insertRole(t, orgId, { title: "Software Developer" })
    // A second, unrelated user who belongs to a DIFFERENT org.
    const { userId: outsiderId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "outsider@evil.se", name: "Outsider", role: "admin" }
    )
    const asOutsider = t.withIdentity({ subject: outsiderId })

    await expect(
      asOutsider.action(api.ai.prefill.prefillRoleProfiles, { orgId })
    ).rejects.toThrow(/errors.notAMember/)
    // No generation happened for the foreign org.
    expect(generateTextMock).toHaveBeenCalledTimes(0)
  })
})
