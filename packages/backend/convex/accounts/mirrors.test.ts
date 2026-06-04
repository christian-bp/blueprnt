import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"
import {
  onOrganizationCreate,
  onUserCreate,
  onUserDelete,
  onUserUpdate,
} from "./mirrors"

const authUser = {
  _id: "ba_user_1",
  _creationTime: 0,
  email: "hr@acme.se",
  name: "HR Person",
}

describe("user mirror triggers", () => {
  it("onUserCreate inserts a mirror row, idempotently", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserCreate(ctx, authUser) // second run must not duplicate
      const rows = await ctx.db.query("users").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        authId: "ba_user_1",
        email: "hr@acme.se",
        name: "HR Person",
      })
      expect(rows[0].name).toBe("HR Person")
    })
  })

  it("onUserUpdate creates the mirror row when missing (self-heal)", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserUpdate(ctx, { ...authUser, name: "Healed" }, authUser)
      const row = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
      expect(row).toMatchObject({ authId: "ba_user_1", name: "Healed" })
    })
  })

  it("onUserUpdate patches name and email", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserUpdate(ctx, { ...authUser, name: "Renamed" }, authUser)
      const row = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
      expect(row?.name).toBe("Renamed")
    })
  })

  it("onUserDelete removes the mirror row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserDelete(ctx, authUser)
      expect(await ctx.db.query("users").collect()).toHaveLength(0)
    })
  })

  it("onOrganizationCreate seeds an empty profile, idempotently", async () => {
    const t = initConvexTest()
    const org = { _id: "ba_org_1", _creationTime: 0, name: "Acme" }
    await t.run(async (ctx) => {
      await onOrganizationCreate(ctx, org)
      await onOrganizationCreate(ctx, org)
      const rows = await ctx.db.query("workspaceProfiles").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].orgId).toBe("ba_org_1")
    })
  })
})
