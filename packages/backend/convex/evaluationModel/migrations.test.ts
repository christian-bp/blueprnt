import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// A model document as a pre-ADR-0024 deployment holds it: the retired ladder
// and zone gates on the document itself AND inside the restore buffer. Written
// through ctx.db.insert directly, because no mutation writes this shape any
// more; the transitional validator is the only reason it can be stored at all.
const RETIRED_RULES = [
  { level: 1, minScore: 97 },
  { level: 12, minScore: 0 },
]
const RETIRED_ZONES = [
  { zone: "A" as const, minStep: 4 },
  { zone: "B" as const, minStep: 3 },
]

describe("dropRetiredLevelRules", () => {
  it("clears the retired fields from the document and its restore buffer", async () => {
    const t = initConvexTest()
    const modelId = await t.run(async (ctx) =>
      ctx.db.insert("models", {
        orgId: "org1",
        name: "Standard",
        levelRules: RETIRED_RULES,
        zoneProfileRules: RETIRED_ZONES,
        lastApprovedModel: {
          criteria: [
            {
              libraryKey: "scope-impact",
              name: "Scope",
              weightPoints: 3,
              anchorCount: 3,
            },
          ],
          levelRules: RETIRED_RULES,
          zoneProfileRules: RETIRED_ZONES,
        },
      })
    )

    const result = await t.mutation(
      internal.evaluationModel.migrations.dropRetiredLevelRules,
      {}
    )
    expect(result).toEqual({ scanned: 1, cleared: 1, buffersCleared: 1 })

    await t.run(async (ctx) => {
      const model = await ctx.db.get(modelId)
      expect(model).not.toBeNull()
      expect(model).not.toHaveProperty("levelRules")
      expect(model).not.toHaveProperty("zoneProfileRules")
      // The buffer survives with everything else intact: the migration must
      // remove two fields, not the restore point.
      expect(model?.lastApprovedModel).not.toHaveProperty("levelRules")
      expect(model?.lastApprovedModel).not.toHaveProperty("zoneProfileRules")
      expect(model?.lastApprovedModel?.criteria).toHaveLength(1)
      expect(model?.lastApprovedModel?.criteria[0]?.name).toBe("Scope")
    })
  })

  it("is idempotent and leaves an already-clean deployment untouched", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("models", { orgId: "org1", name: "Clean" })
    })
    const first = await t.mutation(
      internal.evaluationModel.migrations.dropRetiredLevelRules,
      {}
    )
    expect(first).toEqual({ scanned: 1, cleared: 0, buffersCleared: 0 })
    // Re-running after a real clear must also be a no-op, which is what makes
    // a partial failure safe to resume.
    const second = await t.mutation(
      internal.evaluationModel.migrations.dropRetiredLevelRules,
      {}
    )
    expect(second).toEqual({ scanned: 1, cleared: 0, buffersCleared: 0 })
  })

  it("clears a document carrying the fields in only one of the two places", async () => {
    const t = initConvexTest()
    const bufferOnly = await t.run(async (ctx) =>
      ctx.db.insert("models", {
        orgId: "org2",
        name: "Buffer only",
        lastApprovedModel: {
          criteria: [],
          zoneProfileRules: RETIRED_ZONES,
        },
      })
    )
    const result = await t.mutation(
      internal.evaluationModel.migrations.dropRetiredLevelRules,
      {}
    )
    expect(result).toEqual({ scanned: 1, cleared: 0, buffersCleared: 1 })
    await t.run(async (ctx) => {
      const model = await ctx.db.get(bufferOnly)
      expect(model?.lastApprovedModel).not.toHaveProperty("zoneProfileRules")
      expect(model?.lastApprovedModel?.criteria).toEqual([])
    })
  })

  // The guard that makes the narrowing safe to ship: after the migration the
  // documents must satisfy the schema WITHOUT the transitional fields, which
  // is exactly what convex deploy checks at push time.
  it("leaves every model document valid against the narrowed shape", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("models", {
        orgId: "org1",
        name: "Standard",
        levelRules: RETIRED_RULES,
        zoneProfileRules: RETIRED_ZONES,
        lastApprovedModel: { criteria: [], levelRules: RETIRED_RULES },
      })
    })
    await t.mutation(
      internal.evaluationModel.migrations.dropRetiredLevelRules,
      {}
    )
    const offenders = await t.run(async (ctx) => {
      const models = await ctx.db.query("models").collect()
      return models.filter(
        (m) =>
          "levelRules" in m ||
          "zoneProfileRules" in m ||
          (m.lastApprovedModel !== undefined &&
            ("levelRules" in m.lastApprovedModel ||
              "zoneProfileRules" in m.lastApprovedModel))
      )
    })
    expect(offenders).toEqual([])
  })
})
