import { afterEach, describe, expect, it, vi } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

afterEach(() => {
  vi.unstubAllEnvs()
})

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

  it("reports confirmed for an email in TWO_FACTOR_EXEMPT_EMAILS (test affordance)", async () => {
    vi.stubEnv("TWO_FACTOR_EXEMPT_EMAILS", "test@blueprnt.se")
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-x",
        name: "Test",
        email: "test@blueprnt.se",
      })
    })
    const status = await t
      .withIdentity({ subject: "user-x" })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: true, method: null })
  })

  it("throws when unauthenticated", async () => {
    const t = initConvexTest()
    await expect(
      t.query(api.accounts.twoFactor.getMyMfaStatus, {})
    ).rejects.toThrow()
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
    ).rejects.toThrow()
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
    expect(status.confirmed).toBe(true)
    expect(status.method).toBe("totp")
  })
})
