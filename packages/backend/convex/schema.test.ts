import { describe, expect, it } from "vitest"
import { initConvexTest } from "./testing.helpers"

// Inserts one minimal valid row per domain table so validator regressions
// fail loudly. Score/band fields must not exist anywhere (ADR-0002).
describe("domain schema skeleton", () => {
  it("accepts a minimal valid row in every domain table", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId: "org1",
        name: "Standard",
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId: "org1",
        modelId,
        name: "Scope & Impact",
        description: "d",
        helpText: "h",
        importanceLevel: 7,
        order: 1,
        isCustom: false,
      })
      await ctx.db.insert("criterionAnchors", {
        criterionId,
        level: 0,
        text: "anchor",
      })
      const trackId = await ctx.db.insert("tracks", {
        orgId: "org1",
        modelId,
        key: "IC",
        name: "Individual Contributor",
        order: 1,
      })
      const levelId = await ctx.db.insert("levels", {
        trackId,
        key: "IC1",
        name: "IC1",
        order: 1,
      })
      await ctx.db.insert("trackGuardrails", {
        orgId: "org1",
        levelId,
        criterionId,
        min: 0,
        max: 2,
      })
      await ctx.db.insert("bandThresholds", {
        orgId: "org1",
        modelId,
        band: 1,
        minScore: 530,
      })
      const roleId = await ctx.db.insert("roles", {
        orgId: "org1",
        title: "Software Developer",
        function: "Engineering",
        team: "Platform",
        trackId,
        levelId,
        purpose: "p",
        responsibilities: "r",
        status: "draft",
      })
      await ctx.db.insert("ratings", {
        orgId: "org1",
        roleId,
        criterionId,
        value: 3,
      })
      await ctx.db.insert("suggestions", {
        orgId: "org1",
        target: { kind: "role.field", roleId, field: "purpose" },
        suggestedValue: "Suggested purpose",
        source: "ai",
        status: "suggested",
      })
      expect(await ctx.db.query("roles").collect()).toHaveLength(1)
    })
  })
})
