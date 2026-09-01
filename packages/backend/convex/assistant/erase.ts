import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { internalMutation } from "../_generated/server"

// Erasure batch: bounded writes per transaction (org-scale conventions); the
// mutations reschedule themselves until nothing remains. Hard delete, never a
// flag: chat content is user-typed and may incidentally contain personal
// data (ADR-0018), so every user-erasure path schedules this. Exported so the
// batch-boundary test can size its fixture off the real constant instead of a
// hardcoded duplicate.
export const ERASE_BATCH = 200

// Archived-thread retention (ADR-0018, owner decision 2026-09-01): an
// archived conversation is deleted 90 days after its last activity
// (lastMessageAt; archiving itself never bumps it, and switching back into a
// thread reactivates it, so only genuinely dormant archived threads age out).
export const RETENTION_DAYS = 90

// The shared child-first drain: deletes each thread's messages before the
// thread row, within one transaction's ERASE_BATCH write budget. Returns
// true when the budget ran out mid-page (the caller must reschedule itself
// and try again); threads whose messages were only partially drained keep
// their row until a later pass finishes them.
async function deleteThreadsChildFirst(
  ctx: MutationCtx,
  threads: Doc<"assistantThreads">[]
): Promise<boolean> {
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
    if (deleted >= ERASE_BATCH) return true
    await ctx.db.delete(thread._id)
  }
  return false
}

export const eraseAssistantDataForUser = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Threads are bounded the same way messages are: an org-scale user can
    // hold more threads than fit one transaction, and erasure is the one
    // path that must never fail at org scale.
    const threads = await ctx.db
      .query("assistantThreads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(ERASE_BATCH)
    const budgetHit = await deleteThreadsChildFirst(ctx, threads)
    // Reschedule when the message budget cut a thread short, or when the
    // thread page itself was full (more pages may remain even though every
    // thread fetched this run finished within budget).
    if (budgetHit || threads.length >= ERASE_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.assistant.erase.eraseAssistantDataForUser,
        { userId: args.userId }
      )
    }
    return null
  },
})

// The daily retention sweep (crons.ts): hard-deletes archived threads whose
// last activity is older than RETENTION_DAYS, across all orgs via the
// status-scoped index, in the same bounded, self-rescheduling shape as the
// user-erasure walk above.
export const pruneArchivedThreads = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    const threads = await ctx.db
      .query("assistantThreads")
      .withIndex("by_status_lastMessageAt", (q) =>
        q.eq("status", "archived").lt("lastMessageAt", cutoff)
      )
      .take(ERASE_BATCH)
    const budgetHit = await deleteThreadsChildFirst(ctx, threads)
    if (budgetHit || threads.length >= ERASE_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.assistant.erase.pruneArchivedThreads,
        {}
      )
    }
    return null
  },
})
