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
