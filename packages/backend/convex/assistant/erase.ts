import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"

// Erasure batch: bounded writes per transaction (org-scale conventions); the
// mutation reschedules itself until nothing remains. Hard delete, never a
// flag: chat content is user-typed and may incidentally contain personal
// data (ADR-0018), so every user-erasure path schedules this. Exported so the
// batch-boundary test can size its fixture off the real constant instead of a
// hardcoded duplicate.
export const ERASE_BATCH = 200

export const eraseAssistantDataForUser = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("assistantThreads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    let deleted = 0
    for (const thread of threads) {
      const messages = await ctx.db
        .query("assistantMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .take(ERASE_BATCH - deleted)
      for (const message of messages) {
        await ctx.db.delete(message._id)
        deleted += 1
      }
      if (deleted >= ERASE_BATCH) {
        // More may remain: finish in a follow-up transaction. Threads are
        // deleted only after their messages are gone (child-first).
        await ctx.scheduler.runAfter(
          0,
          internal.assistant.erase.eraseAssistantDataForUser,
          { userId: args.userId }
        )
        return null
      }
      await ctx.db.delete(thread._id)
    }
    return null
  },
})
