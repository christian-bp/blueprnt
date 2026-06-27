import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { ERROR_CODES } from "../lib/errors"
import { initConvexTest } from "../testing.helpers"

describe("accounts.twoFactor.getMyMfaStatus", () => {
  it("reports unconfirmed for a user with no mirror row", async () => {
    const t = initConvexTest()
    const status = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: false, method: null })
  })

  it("reports confirmed and the method once mfaConfirmedAt is set", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "HR Person",
        email: "hr@acme.se",
        mfaMethod: "totp",
        mfaConfirmedAt: 1_700_000_000_000,
      })
    })
    const status = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: true, method: "totp" })
  })

  it("returns null when unauthenticated (transient token blip, not a throw)", async () => {
    // The gate polls this through the auth-token refresh that enable() triggers;
    // it must return null rather than throw, or useQuery re-throws and unmounts
    // the setup wizard. See the comment on getMyMfaStatus.
    const t = initConvexTest()
    const status = await t.query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toBeNull()
  })
})

describe("accounts.twoFactor.confirmMfaSetup", () => {
  it("rejects when Better Auth has not enabled 2FA for the user", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "HR Person",
        email: "hr@acme.se",
      })
    })
    await expect(
      t
        .withIdentity({ subject: "user-1" })
        .mutation(api.accounts.twoFactor.confirmMfaSetup, { method: "email" })
    ).rejects.toMatchObject({ data: { code: ERROR_CODES.invalidInput } })
  })

  it("rejects with notFound when Better Auth has 2FA but there is no mirror row", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedUserWithTwoFactor,
      { email: "hr@acme.se", name: "HR Person" }
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.accounts.twoFactor.confirmMfaSetup, { method: "totp" })
    ).rejects.toMatchObject({ data: { code: ERROR_CODES.notFound } })
  })

  it("stamps the mirror once 2FA is genuinely enabled", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedUserWithTwoFactor,
      { email: "hr@acme.se", name: "HR Person" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "HR Person",
        email: "hr@acme.se",
      })
    })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.accounts.twoFactor.confirmMfaSetup, { method: "totp" })

    const status = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: true, method: "totp" })
  })
})
