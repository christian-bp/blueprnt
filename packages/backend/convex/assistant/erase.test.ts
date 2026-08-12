import { describe, expect, it, vi } from "vitest"
import { internal } from "../_generated/api"
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
})
