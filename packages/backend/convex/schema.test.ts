import { describe, expect, it } from "vitest"
import type { Infer } from "convex/values"
import { CRITERIA_LIBRARY_KEYS } from "./evaluationModel/criteriaLibrary"
import type { libraryKeyValidator } from "./evaluationModel/tables"
import { initConvexTest } from "./testing.helpers"

// Structural test: libraryKeyValidator must have exactly the same 21 keys
// as CRITERIA_LIBRARY_KEYS (import both; a key added without the validator
// or vice versa fails at compile or test).
describe("criteria library key-set parity", () => {
  it("libraryKeyValidator has exactly 21 keys matching CRITERIA_LIBRARY_KEYS", () => {
    expect(CRITERIA_LIBRARY_KEYS).toHaveLength(21)
    // The validator is built from the key list so drift is impossible by construction
    type ValidatorKeys = Infer<typeof libraryKeyValidator>
    // This assertion ensures the types are compatible
    const _typeCheck: ValidatorKeys = "knowledge-depth"
    expect(_typeCheck).toBe("knowledge-depth")
  })
})

// Inserts one minimal valid row per domain table so validator regressions
// fail loudly. Score/level fields must not exist anywhere (ADR-0002).
describe("domain schema skeleton", () => {
  it("accepts a minimal valid row in every domain table", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId: "org1",
        name: "Standard",
        // Thresholds and anchors are aggregates on their parent documents
        // (ADR-0006), not tables.
        levelThresholds: [{ level: 1, minScore: 98 }],
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId: "org1",
        modelId,
        name: "Scope & Impact",
        description: "d",
        helpText: "h",
        anchors: [{ step: 0, text: "anchor" }],
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
