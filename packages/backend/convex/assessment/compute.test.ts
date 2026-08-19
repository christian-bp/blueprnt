import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { deriveResults, logLevelShifts } from "./compute"

// A spread of 8 library keys across every dimension at (or under) its own
// DIMENSION_MAX_ACTIVE cap (competence 2, effort 2, responsibility 3,
// workingConditions 1), so activating all of them never trips a cap.
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of EIGHT_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  return { orgId, userId, asAdmin, model }
}

describe("deriveResults", () => {
  it("derives the standardmall all-5 anchor live from db state", async () => {
    const t = initConvexTest()
    const { orgId, model } = await seedTemplateOrganization(t)

    await t.run(async (ctx) => {
      const roleId = await ctx.db.insert("roles", {
        orgId,
        title: "Head of Everything",
        slug: "head-of-everything",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
      })
      for (const criterion of model.criteria) {
        await ctx.db.insert("ratings", {
          orgId,
          roleId,
          criterionId: criterion.criterionId,
          value: 5,
        })
      }
      const derived = await deriveResults(ctx, orgId)
      expect(derived.totalCriteria).toBe(8)
      expect(derived.results).toHaveLength(1)
      expect(derived.results[0]).toMatchObject({
        complete: true,
        score: 100,
        level: 1,
      })
    })
  })

  it("excludes archived roles and reports partials as incomplete", async () => {
    const t = initConvexTest()
    const { orgId, model } = await seedTemplateOrganization(t)

    await t.run(async (ctx) => {
      const partialId = await ctx.db.insert("roles", {
        orgId,
        title: "Partial",
        slug: "partial",
        function: "F",
        team: "T",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
      })
      const firstCriterion = model.criteria[0]
      if (firstCriterion === undefined) throw new Error("seed")
      await ctx.db.insert("ratings", {
        orgId,
        roleId: partialId,
        criterionId: firstCriterion.criterionId,
        value: 3,
      })
      await ctx.db.insert("roles", {
        orgId,
        title: "Archived",
        slug: "archived",
        function: "F",
        team: "T",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
        archivedAt: Date.now(),
      })
      const derived = await deriveResults(ctx, orgId)
      expect(derived.results).toHaveLength(1)
      expect(derived.results[0]).toMatchObject({
        roleId: partialId,
        ratedCount: 1,
        complete: false,
        score: null,
        level: null,
      })
    })
  })
})

describe("logLevelShifts", () => {
  it("writes one level.shift row per changed level, treating missing as null", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedTemplateOrganization(t)
    await t.run(async (ctx) => {
      await logLevelShifts(ctx, {
        orgId,
        actorId: userId,
        cause: { event: "model.updated" },
        before: [
          {
            roleId: "a",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 100,
            level: 1,
          },
          {
            roleId: "b",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 55,
            level: 5,
          },
          {
            roleId: "gone",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 0,
            level: 7,
          },
        ],
        after: [
          {
            roleId: "a",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 90,
            level: 2,
          },
          {
            roleId: "b",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 55,
            level: 5,
          },
          {
            roleId: "new",
            ratedCount: 0,
            totalCriteria: 8,
            complete: false,
            score: null,
            level: null,
          },
        ],
      })
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      const payloads = rows.map((row) => row.payload as Record<string, unknown>)
      expect(payloads).toHaveLength(2)

      // Role "a": level 1 -> 2 and score 100 -> 90 changed; complete and
      // ratedCount unchanged so they are absent. The cause is always recorded.
      const a = payloads.find((p) => p.roleId === "a")
      expect(a).toBeDefined()
      expect(a?.cause).toEqual({ event: "model.updated" })
      expect(a?.totalCriteria).toBe(8)
      expect(a?.changes).toEqual({
        level: { from: 1, to: 2 },
        score: { from: 100, to: 90 },
      })

      // Role "gone": present before, absent after. level 7 -> null gates the
      // row; score/complete/ratedCount also flip to their null/zero-ish
      // absent values.
      const gone = payloads.find((p) => p.roleId === "gone")
      expect(gone).toBeDefined()
      expect(gone?.totalCriteria).toBe(8)
      expect(gone?.changes).toMatchObject({
        level: { from: 7, to: null },
        score: { from: 0, to: null },
        complete: { from: true, to: null },
        ratedCount: { from: 9, to: null },
      })
    })
  })

  it("threads the cause into the level.shift payload", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedTemplateOrganization(t)
    await t.run(async (ctx) => {
      await logLevelShifts(ctx, {
        orgId,
        actorId: userId,
        before: [
          {
            roleId: "a",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 100,
            level: 1,
          },
        ],
        after: [
          {
            roleId: "a",
            ratedCount: 9,
            totalCriteria: 8,
            complete: true,
            score: 80,
            level: 3,
          },
        ],
        cause: {
          event: "rating.change",
          roleId: "a",
          criterionId: "crit-1",
        },
      })
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "level.shift")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as Record<string, unknown>
      expect(payload.cause).toEqual({
        event: "rating.change",
        roleId: "a",
        criterionId: "crit-1",
      })
      expect(payload.changes).toMatchObject({ level: { from: 1, to: 3 } })
    })
  })
})
