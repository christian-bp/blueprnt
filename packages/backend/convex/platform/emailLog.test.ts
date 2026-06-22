import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const PAGE = { numItems: 10, cursor: null }

async function seedMirroredUser(
  t: ReturnType<typeof initConvexTest>,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Operator", role: "admin" }
  )
  await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
    authId: userId,
    email,
    name: "Operator",
  })
  return userId
}

// The email log surfaces recipient addresses + rendered bodies, so the
// platformQuery -> requirePlatformAdmin gate is the security boundary that keeps
// it operator-only. The DTO reshaping is exercised by typecheck against the
// component's typed return; driving real component data would require
// registering Sweego's nested send workpool, which the component's own suite
// also avoids. Here we lock the access gate on every read wrapper.
describe("platform email log (access control)", () => {
  it("rejects an unauthenticated caller on every query", async () => {
    const t = initConvexTest()
    await expect(
      t.query(api.platform.emailLog.list, { paginationOpts: PAGE })
    ).rejects.toThrow(/errors.notAuthenticated/)
    await expect(
      t.query(api.platform.emailLog.search, { search: "x" })
    ).rejects.toThrow(/errors.notAuthenticated/)
    await expect(
      t.query(api.platform.emailLog.get, { messageId: "m" })
    ).rejects.toThrow(/errors.notAuthenticated/)
    await expect(t.query(api.platform.emailLog.bounds, {})).rejects.toThrow(
      /errors.notAuthenticated/
    )
  })

  it("rejects a signed-in non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.emailLog.list, { paginationOpts: PAGE })
    ).rejects.toThrow(/errors.platformAdminRequired/)
    await expect(
      asUser.query(api.platform.emailLog.bounds, {})
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})
