/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { components, internal } from "./_generated/api"
import { initConvexTest } from "./testing.helpers"

// The seedDevUser action is "use node" (hashPassword requires node:crypto) and
// therefore cannot run inside the edge-runtime convex-test harness. Tests for
// idempotency and output shape are exercised directly against the component
// mutation. The guard test uses vi.stubEnv to verify the throw path; the action
// throws before any Node-only call, so edge-runtime handles it fine.

describe("betterAuth/seed.insertCredentialUser", () => {
  it("creates user + account and returns created: true on first call", async () => {
    const t = initConvexTest()

    const result = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@bluprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    expect(result.created).toBe(true)
    expect(typeof result.userId).toBe("string")
    expect(result.userId.length).toBeGreaterThan(0)
  })

  it("is idempotent: second call returns same userId and created: false", async () => {
    const t = initConvexTest()

    const first = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@bluprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )
    const second = await t.mutation(
      components.betterAuth.seed.insertCredentialUser,
      {
        email: "hej@bluprnt.se",
        name: "Hej",
        passwordHash: "fakesalt:fakehash",
      }
    )

    expect(second.created).toBe(false)
    expect(second.userId).toBe(first.userId)
  })
})

describe("seed.seedDevUser guard", () => {
  beforeEach(() => {
    // The vitest config already sets CONVEX_TEST=true; stub SITE_URL per test.
    vi.stubEnv("SITE_URL", "http://localhost:3001")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects when SITE_URL points to a production domain", async () => {
    vi.stubEnv("SITE_URL", "https://app.blueprnt.se")

    const t = initConvexTest()

    await expect(t.action(internal.seed.seedDevUser, {})).rejects.toThrow(
      "seedDevUser only runs on dev deployments"
    )
  })
})
