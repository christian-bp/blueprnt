import { v } from "convex/values"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"

// Who am I in this organization? Used by the dashboard shell.
export const getOrganizationContext = orgQuery({
  args: {},
  returns: v.object({ orgId: v.string(), role: v.string() }),
  handler: async (ctx) => {
    return { orgId: ctx.orgId, role: ctx.role }
  },
})

// Admin-gate probe; exercised by tests until real admin endpoints exist.
export const touchOrganization = adminMutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})

// Member-write probe; exercised by tests until real member endpoints exist.
export const touchOrganizationAsMember = orgMutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})
