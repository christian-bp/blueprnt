import { describe, expect, it } from "vitest"
import { CRITERIA_LIBRARY_KEYS } from "./evaluationModel/criteriaLibrary"
import { initConvexTest } from "./testing.helpers"

// Sanity check: the criteria library has exactly 21 keys (the controlled set
// from the masterdokument sections 7-10). Compile-time guard in
// evaluationModel/tables.ts asserts the validator stays in sync.
describe("criteria library key-set", () => {
  it("CRITERIA_LIBRARY_KEYS has exactly 21 entries", () => {
    expect(CRITERIA_LIBRARY_KEYS).toHaveLength(21)
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
        // Level rules are an aggregate on the model document (ADR-0006), not
        // a table; criteria carry no stored text at all (decision 8).
        levelRules: [{ level: 1, minScore: 98 }],
        zoneProfileRules: [{ zone: "A", minStep: 4 }],
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId: "org1",
        modelId,
        libraryKey: "scope-impact",
        weightPoints: 5,
        order: 1,
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
