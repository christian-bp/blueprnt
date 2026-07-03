import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"

// Smoke insert/read for each people-context table to catch validator regressions.
// These tests mirror the pattern in convex/schema.test.ts: one minimal valid row
// per table, inserted and read back via ctx.db inside t.run().
describe("people schema", () => {
  it("inserts and reads back a minimal people row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("people", {
        orgId: "org1",
        displayName: "Anna Andersson",
        gender: "Kvinna",
      })
      const doc = await ctx.db.get(id)
      expect(doc?._id).toBe(id)
      expect(doc?.displayName).toBe("Anna Andersson")
    })
  })

  it("inserts and reads back a minimal personAssignments row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const personId = await ctx.db.insert("people", {
        orgId: "org1",
        displayName: "Erik Eriksson",
        gender: "Man",
      })
      // A role is required; insert a minimal roles row to get a valid Id.
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
      const id = await ctx.db.insert("personAssignments", {
        orgId: "org1",
        personId,
        roleId,
        level: "L3",
        levelSource: "confirmed",
        effectiveAt: 1_700_000_000_000,
      })
      const doc = await ctx.db.get(id)
      expect(doc?._id).toBe(id)
      expect(doc?.level).toBe("L3")
    })
  })

  it("inserts and reads back a minimal payRecords row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const personId = await ctx.db.insert("people", {
        orgId: "org1",
        displayName: "Maria Svensson",
        gender: "Kvinna",
      })
      const id = await ctx.db.insert("payRecords", {
        orgId: "org1",
        personId,
        payYear: 2024,
        source: "import",
        basicMonthly: 45_000,
        currency: "SEK",
        components: [],
        effectiveAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
      })
      const doc = await ctx.db.get(id)
      expect(doc?._id).toBe(id)
      expect(doc?.basicMonthly).toBe(45_000)
    })
  })

  it("inserts and reads back a minimal importMappingProfiles row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("importMappingProfiles", {
        orgId: "org1",
        columnMap: { displayName: "Namn", gender: "Kön" },
        updatedAt: 1_700_000_000_000,
      })
      const doc = await ctx.db.get(id)
      expect(doc?._id).toBe(id)
      expect(doc?.columnMap).toEqual({ displayName: "Namn", gender: "Kön" })
    })
  })
})
