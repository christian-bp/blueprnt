import { describe, expect, it } from "vitest"
import { components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("membership.getMembership", () => {
  it("returns the role for an org member and null for others", async () => {
    const t = initConvexTest()

    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "editor" }
    )

    const member = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId }
    )
    expect(member).toEqual({ role: "editor", userId, organizationId: orgId })

    const outsider = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId: "someone-else" }
    )
    expect(outsider).toBeNull()
  })
})

describe("membership.listMembershipsForUser", () => {
  it("lists the user's memberships with org names and is empty for strangers", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )

    const memberships = await t.query(
      components.betterAuth.membership.listMembershipsForUser,
      { userId }
    )
    expect(memberships).toEqual([
      { organizationId: orgId, organizationName: "Acme", role: "admin" },
    ])

    const none = await t.query(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: "someone-else" }
    )
    expect(none).toEqual([])
  })
})
