import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions"
import { v } from "convex/values"
import { components } from "../_generated/api"
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "../_generated/server"
import { appError, ERROR_CODES } from "./errors"

export type WorkspaceRole = "admin" | "editor"

interface OrgContext {
  orgId: string
  role: WorkspaceRole
  authUserId: string
}

// Resolves identity from the JWT (subject = Better Auth user id) and checks
// membership against the auth component's member table. Deliberately avoids
// authComponent.getAuthUser(): the adapter path does not run under
// convex-test (get-convex/better-auth#235) and the JWT is already validated
// by Convex.
async function resolveOrgContext(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<OrgContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  let membership: { role: string } | null
  try {
    membership = await ctx.runQuery(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId: identity.subject }
    )
  } catch {
    // Fail closed: duplicate membership rows (or any lookup failure) deny
    // access with a machine-readable code, never raw error text.
    throw appError(ERROR_CODES.membershipConflict)
  }
  if (membership === null) throw appError(ERROR_CODES.notAMember)
  return {
    orgId,
    role: membership.role as WorkspaceRole,
    authUserId: identity.subject,
  }
}

const orgArgs = { orgId: v.string() }

// Org-scoped read: injects ctx.orgId / ctx.role / ctx.authUserId.
export const orgQuery = customQuery(query, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    return { ctx: org, args: {} }
  },
})

// Org-scoped write (any member role).
export const orgMutation = customMutation(mutation, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    return { ctx: org, args: {} }
  },
})

// Admin-only write (model configuration, member management).
export const adminMutation = customMutation(mutation, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    if (org.role !== "admin") throw appError(ERROR_CODES.adminRequired)
    return { ctx: org, args: {} }
  },
})
