import { afterEach, describe, expect, it, vi } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubFetch(impl: () => Promise<Response>) {
  const spy = vi.fn(impl)
  vi.stubGlobal("fetch", spy)
  return spy
}

const enqueueArgs = {
  to: "invitee@example.com",
  templateKey: "invitation" as const,
  props: {
    inviterName: "Anna",
    organizationName: "Acme",
    acceptUrl: "https://x.example/accept-invitation/inv_1",
  },
  locale: "en",
}

describe("email outbox", () => {
  it("enqueue creates a queued row and delivery marks it sent", async () => {
    const t = initConvexTest()
    const fetchSpy = stubFetch(async () =>
      Response.json({ emails: [{ id: "scw-123" }] })
    )
    vi.useFakeTimers()
    await t.mutation(internal.email.outbox.enqueueEmail, enqueueArgs)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchSpy).toHaveBeenCalledOnce()
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("emails").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ status: "sent", attempts: 1 })
      expect(rows[0].providerMessageId).toBe("scw-123")
    })
  })

  it("retries with backoff and marks failed after 3 attempts", async () => {
    const t = initConvexTest()
    const fetchSpy = stubFetch(async () => {
      throw new Error("scaleway down")
    })
    vi.useFakeTimers()
    await t.mutation(internal.email.outbox.enqueueEmail, enqueueArgs)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("emails").collect())[0]
      expect(row.status).toBe("failed")
      expect(row.attempts).toBe(3)
      expect(row.lastError).toContain("scaleway down")
    })
  })

  it("sweep requeues stale sending/queued rows and fails exhausted ones", async () => {
    const t = initConvexTest()
    const fetchSpy = stubFetch(async () =>
      Response.json({ emails: [{ id: "scw-recovered" }] })
    )
    vi.useFakeTimers()
    await t.run(async (ctx) => {
      await ctx.db.insert("emails", {
        to: "stuck@x.se",
        templateKey: "verifyEmail",
        props: { url: "https://x.example/verify" },
        locale: "en",
        status: "sending",
        attempts: 1,
      })
      await ctx.db.insert("emails", {
        to: "exhausted@x.se",
        templateKey: "verifyEmail",
        props: { url: "https://x.example/verify" },
        locale: "en",
        status: "sending",
        attempts: 3,
      })
    })
    await t.mutation(internal.email.outbox.sweepStaleEmails, {
      olderThanMs: -1,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchSpy).toHaveBeenCalledOnce()
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("emails").collect()
      const recovered = rows.find((r) => r.to === "stuck@x.se")
      const exhausted = rows.find((r) => r.to === "exhausted@x.se")
      expect(recovered?.status).toBe("sent")
      expect(exhausted?.status).toBe("failed")
    })
  })

  it("cleanup deletes old sent rows but keeps queued ones", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("emails", {
        to: "a@x.se",
        templateKey: "invitation",
        props: {},
        locale: "en",
        status: "sent",
        attempts: 1,
      })
      await ctx.db.insert("emails", {
        to: "b@x.se",
        templateKey: "invitation",
        props: {},
        locale: "en",
        status: "queued",
        attempts: 0,
      })
    })
    await t.mutation(internal.email.outbox.cleanupOldEmails, {
      olderThanMs: -1,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("emails").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe("queued")
    })
  })
})
