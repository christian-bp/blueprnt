import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { classifyOrg } from "./classification"

// Internal wrapper so the "use node" import action can run classification after
// upserting people. The action holds the resolved actorId (Better Auth id) and
// its own clock, both passed through. Not exposed to clients.
export const internalRunClassificationSuggestions = internalMutation({
  args: { orgId: v.string(), actorId: v.string() },
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx, { orgId, actorId }) =>
    classifyOrg(ctx, orgId, actorId, Date.now()),
})
