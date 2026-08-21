import { v } from "convex/values"
import { action } from "../_generated/server"
import {
  adminMutation,
  orgMutation,
  orgQuery,
  requireOrgMemberAction,
} from "../lib/functions"

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

// Action-gate probe. The action gates cannot use the mutation wrappers, so
// they are a second implementation of the same rules, and the tests need a
// call site that carries nothing else: the real ones are the org avatar upload
// and the people import, which would drag a blob and a whole file parse into a
// test about identity.
export const touchOrganizationAsMemberAction = action({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId }) => {
    await requireOrgMemberAction(ctx, orgId)
    return null
  },
})
