import { describe, expect, it, vi } from "vitest"
import { internal } from "../_generated/api"
import { ERASE_BATCH, RETENTION_DAYS } from "./erase"
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

describe("archived-thread retention (ADR-0018)", () => {
  const DAY = 24 * 60 * 60 * 1000

  it("prunes archived threads past the retention window, keeps recent and active ones", async () => {
    const t = initConvexTest()
    const now = Date.now()
    const seedThread = (
      status: "active" | "archived",
      lastMessageAt: number
    ) => ({
      orgId: "org1",
      userId: "user-1",
      status,
      lastMessageAt,
    })
    const { oldArchived } = await t.run(async (ctx) => {
      const oldArchived = await ctx.db.insert(
        "assistantThreads",
        seedThread("archived", now - (RETENTION_DAYS + 1) * DAY)
      )
      await ctx.db.insert("assistantMessages", {
        orgId: "org1",
        userId: "user-1",
        threadId: oldArchived,
        role: "user",
        status: "complete",
        parts: [{ type: "text", text: "old" }],
      })
      // Archived but inside the window: stays.
      await ctx.db.insert(
        "assistantThreads",
        seedThread("archived", now - (RETENTION_DAYS - 1) * DAY)
      )
      // Older than the window but still ACTIVE: retention never touches the
      // open conversation.
      await ctx.db.insert(
        "assistantThreads",
        seedThread("active", now - (RETENTION_DAYS + 30) * DAY)
      )
      return { oldArchived }
    })

    vi.useFakeTimers()
    try {
      await t.mutation(internal.assistant.erase.pruneArchivedThreads, {})
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    await t.run(async (ctx) => {
      expect(await ctx.db.get(oldArchived)).toBeNull()
      const threads = await ctx.db.query("assistantThreads").collect()
      expect(threads).toHaveLength(2)
      expect(threads.map((thread) => thread.status).sort()).toEqual([
        "active",
        "archived",
      ])
      // The pruned thread's messages went with it (child-first).
      const messages = await ctx.db.query("assistantMessages").collect()
      expect(messages).toHaveLength(0)
    })
  })

  it("drains a message load past ERASE_BATCH across self-rescheduled passes", async () => {
    const t = initConvexTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      const threadId = await ctx.db.insert("assistantThreads", {
        orgId: "org1",
        userId: "user-1",
        status: "archived",
        lastMessageAt: now - (RETENTION_DAYS + 5) * DAY,
      })
      for (let i = 0; i < ERASE_BATCH + 5; i += 1) {
        await ctx.db.insert("assistantMessages", {
          orgId: "org1",
          userId: "user-1",
          threadId,
          role: "user",
          status: "complete",
          parts: [{ type: "text", text: `m${i}` }],
        })
      }
    })

    vi.useFakeTimers()
    try {
      await t.mutation(internal.assistant.erase.pruneArchivedThreads, {})
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    await t.run(async (ctx) => {
      expect(await ctx.db.query("assistantThreads").collect()).toHaveLength(0)
      expect(await ctx.db.query("assistantMessages").collect()).toHaveLength(0)
    })
  })
})
