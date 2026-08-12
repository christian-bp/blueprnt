import { describe, expect, it, vi } from "vitest"
import { internal } from "../_generated/api"
import { ERASE_BATCH } from "./erase"
import { initConvexTest } from "../testing.helpers"

describe("assistant erasure", () => {
  it("hard-deletes every thread and message for the user, across orgs", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      for (const orgId of ["org1", "org2"]) {
        const threadId = await ctx.db.insert("assistantThreads", {
          orgId,
          userId: "user-1",
          status: "active",
          lastMessageAt: Date.now(),
        })
        for (let i = 0; i < 3; i += 1) {
          await ctx.db.insert("assistantMessages", {
            orgId,
            userId: "user-1",
            threadId,
            role: "user",
            status: "complete",
            parts: [{ type: "text", text: `m${i}` }],
          })
        }
      }
      const otherThread = await ctx.db.insert("assistantThreads", {
        orgId: "org1",
        userId: "user-2",
        status: "active",
        lastMessageAt: Date.now(),
      })
      await ctx.db.insert("assistantMessages", {
        orgId: "org1",
        userId: "user-2",
        threadId: otherThread,
        role: "user",
        status: "complete",
        parts: [{ type: "text", text: "keep me" }],
      })
    })
    vi.useFakeTimers()
    try {
      await t.mutation(internal.assistant.erase.eraseAssistantDataForUser, {
        userId: "user-1",
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }
    await t.run(async (ctx) => {
      const threads = await ctx.db.query("assistantThreads").collect()
      const messages = await ctx.db.query("assistantMessages").collect()
      expect(threads).toHaveLength(1)
      expect(threads[0].userId).toBe("user-2")
      expect(messages).toHaveLength(1)
    })
  })

  it("self-reschedules across the ERASE_BATCH boundary and still finishes empty", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      // Two threads for the erased user, each carrying EXACTLY ERASE_BATCH
      // messages. Thread a's full take exactly exhausts the first run's
      // budget, so the mutation reschedules BEFORE deleting thread a's
      // now-empty row (the conservative-defer edge: a full take can still
      // land exactly on the cap). Thread b repeats the same edge in the
      // follow-up run, so the mutation reschedules itself more than once
      // before a final run finishes with nothing left to delete.
      for (const label of ["a", "b"]) {
        const threadId = await ctx.db.insert("assistantThreads", {
          orgId: "org1",
          userId: "user-1",
          status: "active",
          lastMessageAt: Date.now(),
        })
        for (let i = 0; i < ERASE_BATCH; i += 1) {
          await ctx.db.insert("assistantMessages", {
            orgId: "org1",
            userId: "user-1",
            threadId,
            role: "user",
            status: "complete",
            parts: [{ type: "text", text: `${label}-${i}` }],
          })
        }
      }
      // Another user's thread, which must survive every run untouched.
      const otherThread = await ctx.db.insert("assistantThreads", {
        orgId: "org1",
        userId: "user-2",
        status: "active",
        lastMessageAt: Date.now(),
      })
      await ctx.db.insert("assistantMessages", {
        orgId: "org1",
        userId: "user-2",
        threadId: otherThread,
        role: "user",
        status: "complete",
        parts: [{ type: "text", text: "keep me" }],
      })
    })

    vi.useFakeTimers()
    try {
      await t.mutation(internal.assistant.erase.eraseAssistantDataForUser, {
        userId: "user-1",
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    // (a) The self-rescheduling branch actually fired more than once: each
    // ERASE_BATCH-sized thread hits the cap in its own transaction, so the
    // mutation schedules a follow-up run twice before a third run finds
    // nothing left and stops.
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const reschedules = scheduled.filter((s) =>
      s.name.includes("eraseAssistantDataForUser")
    )
    expect(reschedules.length).toBeGreaterThan(1)

    // (b) Terminal state: the erased user has nothing left anywhere; the
    // other user's thread and message survive untouched.
    await t.run(async (ctx) => {
      const threads = await ctx.db.query("assistantThreads").collect()
      const messages = await ctx.db.query("assistantMessages").collect()
      expect(threads).toHaveLength(1)
      expect(threads[0].userId).toBe("user-2")
      expect(messages).toHaveLength(1)
      expect(messages[0].userId).toBe("user-2")
    })
  })

  it("bounds thread collection itself, self-rescheduling past a full ERASE_BATCH page of threads", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      // ERASE_BATCH + 1 threads for the erased user, each with no messages,
      // so message batching never fires and only the thread-count boundary
      // is exercised: the first run's take(ERASE_BATCH) fetches exactly a
      // full page, deletes every one of them (nothing left to bound their
      // own message loop), and must still reschedule because a further
      // thread may remain beyond that page.
      for (let i = 0; i < ERASE_BATCH + 1; i += 1) {
        await ctx.db.insert("assistantThreads", {
          orgId: "org1",
          userId: "user-1",
          status: "active",
          lastMessageAt: i,
        })
      }
      // Another user's thread, which must survive every run untouched.
      const otherThread = await ctx.db.insert("assistantThreads", {
        orgId: "org1",
        userId: "user-2",
        status: "active",
        lastMessageAt: 0,
      })
      await ctx.db.insert("assistantMessages", {
        orgId: "org1",
        userId: "user-2",
        threadId: otherThread,
        role: "user",
        status: "complete",
        parts: [{ type: "text", text: "keep me" }],
      })
    })

    vi.useFakeTimers()
    try {
      await t.mutation(internal.assistant.erase.eraseAssistantDataForUser, {
        userId: "user-1",
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const reschedules = scheduled.filter((s) =>
      s.name.includes("eraseAssistantDataForUser")
    )
    expect(reschedules.length).toBeGreaterThan(0)

    await t.run(async (ctx) => {
      const threads = await ctx.db.query("assistantThreads").collect()
      expect(threads).toHaveLength(1)
      expect(threads[0].userId).toBe("user-2")
    })
  })
})
