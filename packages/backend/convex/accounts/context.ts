import { v } from "convex/values"
import { adminMutation, orgQuery } from "../lib/functions"

// Who am I in this workspace? Used by the dashboard shell.
export const getWorkspaceContext = orgQuery({
  args: {},
  returns: v.object({ orgId: v.string(), role: v.string() }),
  handler: async (ctx) => {
    return { orgId: ctx.orgId, role: ctx.role }
  },
})

// Admin-gate probe; exercised by tests until real admin endpoints exist.
export const touchWorkspace = adminMutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})
