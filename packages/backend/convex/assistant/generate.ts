import { v } from "convex/values"
import { internalAction } from "../_generated/server"

// Stub: Task 7 fills in the actual generation (model call, tool loop, and
// the updateParts/finalizeReply writes). Deliberately no "use node" and no AI
// SDK import here: this file stays on the default V8 runtime for now, and
// Task 7 replaces the whole handler rather than growing it in place.
export const generateAssistantReply = internalAction({
  args: {
    assistantMessageId: v.id("assistantMessages"),
    threadId: v.id("assistantThreads"),
    orgId: v.string(),
    userId: v.string(),
    locale: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async () => {
    return null
  },
})
