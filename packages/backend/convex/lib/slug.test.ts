import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"
import { uniqueSlug } from "./slug"

const roleFields = {
  function: "",
  team: "",
  trackKey: "IC" as const,
  purpose: "",
  responsibilities: "",
}

describe("uniqueSlug", () => {
  it("slugifies the source for a free name", async () => {
    const t = initConvexTest()
    const slug = await t.run((ctx) =>
      uniqueSlug(ctx, "roles", "org1", "System Developer")
    )
    expect(slug).toBe("system-developer")
  })

  it("appends a suffix when the base slug is already taken", async () => {
    const t = initConvexTest()
    const slug = await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId: "org1",
        title: "System Developer",
        slug: "system-developer",
        ...roleFields,
      })
      return uniqueSlug(ctx, "roles", "org1", "System Developer")
    })
    expect(slug).not.toBe("system-developer")
    expect(slug.startsWith("system-developer-")).toBe(true)
  })

  it("scopes uniqueness to the org (another org may reuse the slug)", async () => {
    const t = initConvexTest()
    const slug = await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId: "org1",
        title: "System Developer",
        slug: "system-developer",
        ...roleFields,
      })
      return uniqueSlug(ctx, "roles", "org2", "System Developer")
    })
    expect(slug).toBe("system-developer")
  })

  it("falls back to a generated id when the source has no slug characters", async () => {
    const t = initConvexTest()
    const slug = await t.run((ctx) =>
      uniqueSlug(ctx, "roleFamilies", "org1", "日本語")
    )
    expect(slug).toMatch(/^[a-z0-9]+$/)
  })

  it("excludes the renamed row itself from the collision check", async () => {
    const t = initConvexTest()
    const slug = await t.run(async (ctx) => {
      const id = await ctx.db.insert("roleFamilies", {
        orgId: "org1",
        name: "Engineering",
        slug: "engineering",
      })
      // Re-deriving the same name for the same row must keep its slug.
      return uniqueSlug(ctx, "roleFamilies", "org1", "Engineering", {
        excludeId: id,
      })
    })
    expect(slug).toBe("engineering")
  })

  it("prefixes the slug on collision when a prefix is given", async () => {
    const t = initConvexTest()
    const slug = await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId: "org1",
        title: "Manager",
        slug: "manager",
        ...roleFields,
      })
      // The base collides, so the readable family prefix is used instead of a
      // short-id suffix.
      return uniqueSlug(ctx, "roles", "org1", "Manager", { prefix: "sales" })
    })
    expect(slug).toBe("sales-manager")
  })
})
