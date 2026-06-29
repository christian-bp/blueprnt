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
        // Thresholds and anchors are aggregates on their parent documents
        // (ADR-0006), not tables.
        bandThresholds: [{ band: 1, minScore: 98 }],
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId: "org1",
        modelId,
        name: "Scope & Impact",
        description: "d",
        helpText: "h",
        anchors: [{ level: 0, text: "anchor" }],
        weightPoints: 5,
        order: 1,
        isCustom: false,
      })
      const roleId = await ctx.db.insert("roles", {
        orgId: "org1",
        title: "Software Developer",
        slug: "software-developer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
        purpose: "p",
        responsibilities: "r",
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
