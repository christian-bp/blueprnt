/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { slugify } from "@workspace/constants"
import { initConvexTest } from "../testing.helpers"
import { AI_PROFILE_MODEL_ID } from "./config"

// convex-test cannot reach the real EU model, so the "ai" module's
// generateText is mocked: the action's prompt building and the surrounding
// usage/apply wiring run for real, only the model call is faked. Each test
// sets generateTextMock's behavior. The action runs against the mocked model
// only when MISTRAL_API_KEY is set (aiModel returns null otherwise), so every
// test stubs it.
const generateTextMock = vi.fn()

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  }
})

// The batched call now enumerates the input roles in the prompt as
// <role index="N">title</role>; this parses them back out so a mock can
// echo each role's index (and, for the reorder test, shuffle them).
function parsePromptRoles(prompt: string): { index: number; title: string }[] {
  const matches = [
    ...prompt.matchAll(/<role index="(\d+)">([\s\S]*?)<\/role>/g),
  ]
  return matches.map((m) => ({
    index: Number(m[1]),
    title: (m[2] ?? "").trim(),
  }))
}

// A successful batched generation: one entry per input role, each echoing its
// index, plus a token-usage total so the per-call usage logging has something
// to record (provenance). `order` controls how the entries are arranged so a
// test can prove index-keyed (not position-keyed) mapping.
function okBatch(
  prompt: string,
  body: (title: string) => { purpose: string; responsibilities: string },
  order: "asc" | "shuffled" = "asc"
) {
  const roles = parsePromptRoles(prompt)
  const entries = roles.map((r) => ({ index: r.index, ...body(r.title) }))
  if (order === "shuffled") entries.reverse()
  return {
    output: { roles: entries },
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
// familyId is optional so a test can seed a familied role alongside an
// unfamilied one and assert the prompt differs only by the family clause.
async function insertRole(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  fields: {
    title: string
    purpose?: string
    responsibilities?: string
    familyId?: Id<"roleFamilies">
  }
): Promise<Id<"roles">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("roles", {
      orgId,
      title: fields.title,
      slug: slugify(fields.title),
      function: "Engineering",
      team: "Core",
      trackKey: "IC",
      purpose: fields.purpose ?? "",
      responsibilities: fields.responsibilities ?? "",
      ...(fields.familyId !== undefined ? { familyId: fields.familyId } : {}),
    })
  )
}

// Inserts a role family (user-entered name) for the org and returns its id.
async function insertFamily(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  name: string
): Promise<Id<"roleFamilies">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("roleFamilies", { orgId, name, slug: slugify(name) })
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

  it("prefills every empty role in ONE batched call, applied by echoed index", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t, "prefill-apply@acme.se")
    const empty1 = await insertRole(t, orgId, { title: "Software Developer" })
    const empty2 = await insertRole(t, orgId, { title: "Product Manager" })
    // Already complete: must be excluded from the batch, no model entry.
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

    // Per-title body so we can assert each role got ITS OWN profile, not a
    // shared blob: the purpose echoes the title back.
    generateTextMock.mockImplementation(async (options: { prompt: string }) =>
      okBatch(options.prompt, (title) => ({
        purpose: `Drives the ${title}.`,
        responsibilities: `Owns ${title} delivery\nMentors peers`,
      }))
    )

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 3, failed: 0 })

    // Three empty roles -> exactly ONE model call (the whole set in one
    // structured-object request). The filled role was excluded.
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    // Each empty role got its own title-specific profile.
    const dev = await readRole(t, empty1)
    expect(dev?.purpose).toBe("Drives the Software Developer.")
    const pm = await readRole(t, empty2)
    expect(pm?.purpose).toBe("Drives the Product Manager.")
    const qa = await readRole(t, blank)
    expect(qa?.purpose).toBe("Drives the QA Engineer.")
    // The already-filled role is untouched.
    const untouched = await readRole(t, filled)
    expect(untouched?.purpose).toBe("Existing purpose.")
    expect(untouched?.responsibilities).toBe("Existing responsibilities")

    await t.run(async (ctx) => {
      // ONE usage event for the whole call, attributed to the org + caller.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(1)
      expect(usage[0]?.kind).toBe("role.profile")
      expect(usage[0]?.actorId).toBe(userId)
      expect(usage[0]?.totalTokens).toBe(30)
      // Prefill runs on the fast profile model: the recorded provenance must
      // match the model actually used for the batch.
      expect(usage[0]?.model).toBe(AI_PROFILE_MODEL_ID)
      // The monthly rollup folded the single call in.
      const monthly = await ctx.db
        .query("aiUsageMonthly")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId))
        .collect()
      expect(monthly).toHaveLength(1)
      expect(monthly[0]?.callCount).toBe(1)
      // Provenance is the per-role role.updated audit row (one per applied
      // role), NOT a per-role suggestion row.
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(3)
      // Each prefill role.updated row carries the onboarding-prefill provenance
      // and a structured before->after over the applied profile fields. The old
      // bare `fields` array is gone.
      const devRow = updated.find(
        (row) => (row.payload as Record<string, unknown>).roleId === empty1
      )
      const devPayload = devRow?.payload as {
        roleId: string
        source: string
        via: string
        fields?: unknown
        changes: Record<string, { from: unknown; to: unknown }>
      }
      expect(devPayload.source).toBe("ai")
      expect(devPayload.via).toBe("onboardingPrefill")
      // The seeded profile was empty; the AI filled both fields.
      expect(devPayload.changes.purpose).toEqual({
        from: "",
        to: "Drives the Software Developer.",
      })
      expect(devPayload.changes.responsibilities).toEqual({
        from: "",
        to: "Owns Software Developer delivery\nMentors peers",
      })
      // The retired `fields` array must not survive on any prefill row.
      for (const row of updated) {
        expect("fields" in (row.payload as Record<string, unknown>)).toBe(false)
      }
      // The per-role role.profile suggestion rows are gone.
      const suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status_kind", (q) =>
          q
            .eq("orgId", orgId)
            .eq("status", "confirmed")
            .eq("target.kind", "role.profile")
        )
        .collect()
      expect(suggestions).toHaveLength(0)
    })
  })

  it("maps each profile by its ECHOED index even when the model reorders them", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-reorder@acme.se")
    const first = await insertRole(t, orgId, { title: "Alpha" })
    const second = await insertRole(t, orgId, { title: "Beta" })
    const third = await insertRole(t, orgId, { title: "Gamma" })

    // The mock returns the entries in SHUFFLED (reversed) order: index 2
    // first, then 1, then 0. If apply mapped by array POSITION, Alpha would
    // get Gamma's text. Index-keyed mapping must still give each its own.
    generateTextMock.mockImplementation(async (options: { prompt: string }) =>
      okBatch(
        options.prompt,
        (title) => ({
          purpose: `Purpose of ${title}.`,
          responsibilities: `Responsibilities of ${title}`,
        }),
        "shuffled"
      )
    )

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 3, failed: 0 })
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    // Each role keeps ITS OWN content despite the reordering.
    expect((await readRole(t, first))?.purpose).toBe("Purpose of Alpha.")
    expect((await readRole(t, second))?.purpose).toBe("Purpose of Beta.")
    expect((await readRole(t, third))?.purpose).toBe("Purpose of Gamma.")
  })

  it("rejects a batch whose returned index set does not match the inputs (nothing mis-applied)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-mismatch@acme.se")
    const a = await insertRole(t, orgId, { title: "Alpha" })
    const b = await insertRole(t, orgId, { title: "Beta" })
    const c = await insertRole(t, orgId, { title: "Gamma" })

    // The model drops index 2 entirely (returns only 0 and 1) -> the returned
    // index set != the input set, so the whole call is rejected and NOTHING is
    // applied (no profile may be assigned to the wrong role).
    generateTextMock.mockImplementation(async () => ({
      output: {
        roles: [
          { index: 0, purpose: "P0", responsibilities: "R0" },
          { index: 1, purpose: "P1", responsibilities: "R1" },
        ],
      },
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }))

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    // The single call failed; all three roles are counted failed, none applied.
    expect(result).toEqual({ generated: 0, failed: 3 })
    expect((await readRole(t, a))?.purpose).toBe("")
    expect((await readRole(t, b))?.purpose).toBe("")
    expect((await readRole(t, c))?.purpose).toBe("")
    await t.run(async (ctx) => {
      // No partial write: no usage event, no audit row.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(0)
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(0)
    })
  })

  it("rejects a batch that echoes a DUPLICATE index (nothing mis-applied)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-duplicate@acme.se")
    const a = await insertRole(t, orgId, { title: "Alpha" })
    const b = await insertRole(t, orgId, { title: "Beta" })
    const c = await insertRole(t, orgId, { title: "Gamma" })

    // The model echoes index 0 TWICE on top of a full {0,1,2} set: four entries
    // whose index MULTISET is {0,0,1,2}. This isolates the byIndex.has(entry.index)
    // duplicate guard: the throw fires on the second index-0 entry while folding,
    // BEFORE the size check. With the guard gone, the duplicate would silently
    // overwrite and the deduplicated map would still cover {0,1,2} (size 3),
    // sailing past every later check and mis-applying one entry. So this case is
    // distinct from the short-response size guard (which only catches a map whose
    // size already differs). A duplicated index makes the mapping ambiguous, so
    // the whole call is rejected and NOTHING is applied.
    generateTextMock.mockImplementation(async () => ({
      output: {
        roles: [
          { index: 0, purpose: "P0", responsibilities: "R0" },
          { index: 0, purpose: "P0b", responsibilities: "R0b" },
          { index: 1, purpose: "P1", responsibilities: "R1" },
          { index: 2, purpose: "P2", responsibilities: "R2" },
        ],
      },
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }))

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    // The single call failed; all three roles are counted failed, none applied.
    expect(result).toEqual({ generated: 0, failed: 3 })
    expect((await readRole(t, a))?.purpose).toBe("")
    expect((await readRole(t, b))?.purpose).toBe("")
    expect((await readRole(t, c))?.purpose).toBe("")
    await t.run(async (ctx) => {
      // No partial write: no usage event, no audit row.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(0)
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(0)
    })
  })

  it("rejects a batch with the right COUNT but a GAP in the index set (nothing mis-applied)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-gap@acme.se")
    const a = await insertRole(t, orgId, { title: "Alpha" })
    const b = await insertRole(t, orgId, { title: "Beta" })
    const c = await insertRole(t, orgId, { title: "Gamma" })

    // The model returns the right COUNT (3 entries) but indices {0, 1, 3}: the
    // size check passes (byIndex.size === roles.length), yet index 2 is missing.
    // This trips the byIndex.get(i) === undefined loop (a distinct branch from
    // both the short-response size check and the duplicate guard). Out-of-range
    // index 3 has no input role, so the whole call is rejected and NOTHING is
    // applied.
    generateTextMock.mockImplementation(async () => ({
      output: {
        roles: [
          { index: 0, purpose: "P0", responsibilities: "R0" },
          { index: 1, purpose: "P1", responsibilities: "R1" },
          { index: 3, purpose: "P3", responsibilities: "R3" },
        ],
      },
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }))

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    // The single call failed; all three roles are counted failed, none applied.
    expect(result).toEqual({ generated: 0, failed: 3 })
    expect((await readRole(t, a))?.purpose).toBe("")
    expect((await readRole(t, b))?.purpose).toBe("")
    expect((await readRole(t, c))?.purpose).toBe("")
    await t.run(async (ctx) => {
      // No partial write: no usage event, no audit row.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(0)
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(0)
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

  it("splits a large set into ceil(n / cap) small calls run in bounded-concurrency waves, all applied", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-large@acme.se")
    // PREFILL_MAX_PER_CALL is 5 and PREFILL_CONCURRENCY is 4; 23 empty roles ->
    // ceil(23/5) = 5 chunks, run as 2 waves (4 chunks, then 1). The wave
    // structure is internal, but the call count proves the chunking.
    const ids: Id<"roles">[] = []
    for (let i = 0; i < 23; i++) {
      ids.push(await insertRole(t, orgId, { title: `Role ${i}` }))
    }

    generateTextMock.mockImplementation(async (options: { prompt: string }) =>
      okBatch(options.prompt, (title) => ({
        purpose: `Purpose of ${title}.`,
        responsibilities: `Responsibilities of ${title}`,
      }))
    )

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 23, failed: 0 })
    expect(generateTextMock).toHaveBeenCalledTimes(5)
    // Every role got its own title-specific profile across the chunks/waves.
    for (let i = 0; i < 23; i++) {
      const role = await readRole(t, ids[i] as Id<"roles">)
      expect(role?.purpose).toBe(`Purpose of Role ${i}.`)
    }
    await t.run(async (ctx) => {
      // One usage event per call (5), not per role.
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(5)
      const monthly = await ctx.db
        .query("aiUsageMonthly")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId))
        .collect()
      expect(monthly[0]?.callCount).toBe(5)
    })
  })

  it("isolates a failed chunk: its roles stay empty + counted, the other chunks (same wave and later wave) still apply", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-fail@acme.se")
    // PREFILL_MAX_PER_CALL is 5; 23 empty roles -> 5 chunks
    // ([0-4],[5-9],[10-14],[15-19],[20-22]). With PREFILL_CONCURRENCY 4 the
    // first wave runs chunks 0-3 (roles 0-19) concurrently and the second wave
    // runs chunk 4 (roles 20-22). The chunk containing "Role 0" (chunk 0)
    // throws; its three wave-mates AND the later wave still apply in full, so
    // one bad chunk never fails its wave or a later wave.
    const ids: Id<"roles">[] = []
    for (let i = 0; i < 23; i++) {
      ids.push(await insertRole(t, orgId, { title: `Role ${i}` }))
    }

    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      // "Role 0</role>" matches only the exact title "Role 0" (the closing tag
      // follows immediately), never "Role 10" or "Role 20".
      if (options.prompt.includes("Role 0</role>")) {
        throw new Error("model exploded")
      }
      return okBatch(options.prompt, (title) => ({
        purpose: `Purpose of ${title}.`,
        responsibilities: `Responsibilities of ${title}`,
      }))
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    // Chunk 0 (roles 0-4) failed; the other four chunks (18 roles) applied.
    expect(result).toEqual({ generated: 18, failed: 5 })
    // A role in the failed chunk keeps its empty profile (manual fallback).
    expect((await readRole(t, ids[0] as Id<"roles">))?.purpose).toBe("")
    // A role in a succeeding chunk that SHARED the failed chunk's wave is filled.
    expect((await readRole(t, ids[19] as Id<"roles">))?.purpose).toBe(
      "Purpose of Role 19."
    )
    // A role in a succeeding chunk from a LATER wave is filled too.
    expect((await readRole(t, ids[22] as Id<"roles">))?.purpose).toBe(
      "Purpose of Role 22."
    )

    await t.run(async (ctx) => {
      // No partial write within the failed chunk: only the four good chunks
      // logged usage (one event each) and wrote audit rows (one per role).
      const usage = await ctx.db
        .query("aiUsageEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(usage).toHaveLength(4)
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated).toHaveLength(18)
    })
  })

  it("includes the family clause for a familied role and omits it for an unfamilied one", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-family@acme.se")
    const familyId = await insertFamily(t, orgId, "Engineering")
    // One role in a family, one in none. Both are empty, so both reach the
    // single batched call; the family clause must distinguish exactly one.
    await insertRole(t, orgId, { title: "Backend Developer", familyId })
    await insertRole(t, orgId, { title: "Office Manager" })

    let capturedPrompt = ""
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      capturedPrompt = options.prompt
      return okBatch(options.prompt, (title) => ({
        purpose: `Drives the ${title}.`,
        responsibilities: `Owns ${title} delivery`,
      }))
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 2, failed: 0 })
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    // The familied role's identity line carries the family name verbatim.
    expect(capturedPrompt).toContain('role family "Engineering"')
    // The familied role's full identity clause appears intact.
    expect(capturedPrompt).toContain('team "Core", role family "Engineering"')
    // Exactly ONE family clause: the unfamilied role contributes none. Two
    // roles, one family => one occurrence of the clause prefix.
    expect(capturedPrompt.match(/role family "/g)).toHaveLength(1)
    // No empty family clause is ever emitted for the unfamilied role.
    expect(capturedPrompt).not.toContain('role family ""')
  })

  it("emits NO family clause when no role has a family (byte-identical prompt)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-nofamily@acme.se")
    await insertRole(t, orgId, { title: "Backend Developer" })
    await insertRole(t, orgId, { title: "Office Manager" })

    let capturedPrompt = ""
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      capturedPrompt = options.prompt
      return okBatch(options.prompt, (title) => ({
        purpose: `Drives the ${title}.`,
        responsibilities: `Owns ${title} delivery`,
      }))
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 2, failed: 0 })
    // The family clause prefix never appears when no role has a family, so the
    // unfamilied prompt is byte-identical to the pre-family behavior.
    expect(capturedPrompt).not.toContain("role family")
  })

  it("omits the family clause when a role's family id no longer resolves", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "prefill-dangling@acme.se")
    const familyId = await insertFamily(t, orgId, "Engineering")
    const roleId = await insertRole(t, orgId, {
      title: "Backend Developer",
      familyId,
    })
    // Delete the family after the role points at it: the lookup misses, so the
    // role contributes no family clause (no crash, no empty clause).
    await t.run(async (ctx) => {
      await ctx.db.delete(familyId)
    })

    let capturedPrompt = ""
    generateTextMock.mockImplementation(async (options: { prompt: string }) => {
      capturedPrompt = options.prompt
      return okBatch(options.prompt, (title) => ({
        purpose: `Drives the ${title}.`,
        responsibilities: `Owns ${title} delivery`,
      }))
    })

    const result = await asAdmin.action(api.ai.prefill.prefillRoleProfiles, {
      orgId,
    })
    expect(result).toEqual({ generated: 1, failed: 0 })
    expect(capturedPrompt).not.toContain("role family")
    // The role itself still appears in the prompt; only its family is gone.
    expect(capturedPrompt).toContain("Backend Developer")
    void roleId
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

describe("collectPrefillTargets family resolution", () => {
  beforeEach(() => {
    // This block calls the query directly (no model call), but seedOrg still
    // builds the model and roles, so keep the env stub for parity with the rest
    // of the suite. No generateText is invoked here.
    vi.stubEnv("MISTRAL_API_KEY", "test-key")
  })

  it("carries family for a familied role and omits the key for an unfamilied one", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t, "collect-family@acme.se")
    const familyId = await insertFamily(t, orgId, "Engineering")
    const familiedId = await insertRole(t, orgId, {
      title: "Backend Developer",
      familyId,
    })
    const plainId = await insertRole(t, orgId, { title: "Office Manager" })

    const { targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId }
    )

    const familied = targets.find((target) => target.roleId === familiedId)
    const plain = targets.find((target) => target.roleId === plainId)
    // The familied role resolves its family NAME (not the id).
    expect(familied?.family).toBe("Engineering")
    // The unfamilied role omits the key entirely (v.optional -> undefined, not
    // an empty string), so its target is byte-identical to the pre-family shape.
    expect(plain?.family).toBeUndefined()
    expect(plain && "family" in plain).toBe(false)
  })
})

describe("collectPrefillTargets generation locale", () => {
  beforeEach(() => {
    vi.stubEnv("MISTRAL_API_KEY", "test-key")
  })

  it("generates in the PASSED display locale, not the org default (regression)", async () => {
    const t = initConvexTest()
    // seedOrg saves the org language as "sv". The caller is viewing the app in
    // English, so the prefill must generate English profiles, NOT Swedish ones.
    // This is the bug fix: before threading the display locale,
    // collectPrefillTargets hardcoded the org's saved language as BOTH the
    // output-language instruction and the track-names lookup locale.
    const { orgId, userId } = await seedOrg(t, "collect-locale-en@acme.se")
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })

    const { context, targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId, locale: "en" }
    )

    // context.locale is the load-bearing proof: collectPrefillTargets resolves
    // ONE generationLocale = promptLocale(locale, settings.language) and uses it
    // for BOTH the prompt's output-language instruction (context.locale) AND the
    // track-names lookup. Before the fix this was the org's "sv". We do NOT
    // assert trackName by value: the standard template's track names are
    // byte-identical across all five locales today, so the lookup locale is not
    // observable from the result; the lookup shares generationLocale with
    // context.locale, so it follows the display locale by construction.
    expect(context.locale).toBe("en")
    expect(targets.some((entry) => entry.roleId === roleId)).toBe(true)
  })

  it("falls back to the org language when no locale is passed", async () => {
    const t = initConvexTest()
    // seedOrg saves the org language as "sv" and passes no locale: promptLocale
    // falls back to settings.language, so the generation locale is "sv".
    const { orgId, userId } = await seedOrg(
      t,
      "collect-locale-fallback@acme.se"
    )
    const roleId = await insertRole(t, orgId, { title: "Backend Developer" })

    const { context, targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId }
    )

    expect(context.locale).toBe("sv")
    expect(targets.some((entry) => entry.roleId === roleId)).toBe(true)
  })

  it("falls back to the org language when an unsupported locale is passed", async () => {
    const t = initConvexTest()
    // An out-of-range locale ("de", not one of the supported five) is rejected
    // by promptLocale, so the org's saved language ("sv") is used instead.
    const { orgId, userId } = await seedOrg(t, "collect-locale-bad@acme.se")
    await insertRole(t, orgId, { title: "Backend Developer" })

    const { context } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId, locale: "de" }
    )

    expect(context.locale).toBe("sv")
  })
})
