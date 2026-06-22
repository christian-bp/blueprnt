import { components } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import { v } from "convex/values"

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Prune the Sweego component's message / delivery / event history on a schedule
// (called by crons). Sweego owns the email records now, so retention lives here.
export const run = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.sweego.lib.cleanupOldMessages, {
      olderThan: ONE_WEEK_MS,
    })
    await ctx.scheduler.runAfter(
      0,
      components.sweego.lib.cleanupAbandonedMessages,
      { olderThan: 4 * ONE_WEEK_MS }
    )
    await ctx.scheduler.runAfter(0, components.sweego.lib.cleanupOldEvents, {
      olderThan: ONE_WEEK_MS,
    })
    return null
  },
})
