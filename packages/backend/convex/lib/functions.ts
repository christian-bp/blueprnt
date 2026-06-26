import type { RoleResult } from "@workspace/core"
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
import { logBandShifts } from "../assessment/compute"
import { logAudit } from "./audit"
import type { AuditPayloads, BandCause } from "./auditPayloads"
import { appError, ERROR_CODES } from "./errors"

export type OrganizationRole = "admin" | "editor"

interface OrgContext {
  orgId: string
  role: OrganizationRole
  authUserId: string
}

// A ctx-bound audit writer pre-bound to the org-scoped ctx's orgId/actorId, so
// org/admin call sites stop repeating `orgId: ctx.orgId, actorId: ctx.authUserId`
// on every audit row. The contents are identical to the free `logAudit`/
// `logBandShifts`; this is sugar over the same writers.
interface AuditWriter {
  log: <E extends keyof AuditPayloads>(entry: {
    type: E
    payload: AuditPayloads[E]
  }) => Promise<void>
  bandShifts: (entry: {
    before: RoleResult[]
    after: RoleResult[]
    cause: BandCause
  }) => Promise<void>
}

// Builds the ctx-bound audit writer for an org-scoped mutation ctx.
function makeAuditWriter(
  ctx: MutationCtx,
  orgId: string,
  authUserId: string
): AuditWriter {
  return {
    log: (entry) => logAudit(ctx, { orgId, actorId: authUserId, ...entry }),
    bandShifts: (entry) =>
      logBandShifts(ctx, { orgId, actorId: authUserId, ...entry }),
  }
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
  } catch (error) {
    // Fail closed: duplicate membership rows (or any lookup failure) deny
    // access with a machine-readable code, never raw error text. The log
    // line is the ops breadcrumb distinguishing data-integrity conflicts
    // from transient component failures.
    console.error("membership lookup failed", {
      orgId,
      subject: identity.subject,
      error: error instanceof Error ? error.message : String(error),
    })
    throw appError(ERROR_CODES.membershipConflict)
  }
  if (membership === null) throw appError(ERROR_CODES.notAMember)
  const { role } = membership
  if (role !== "admin" && role !== "editor") {
    // Unknown role string (defense-in-depth; roles are fixed to admin and
    // editor by the access control config). Deny rather than launder it.
    console.error("unknown organization role", {
      orgId,
      subject: identity.subject,
      role,
    })
    throw appError(ERROR_CODES.membershipConflict)
  }
  return {
    orgId,
    role,
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
    const audit = makeAuditWriter(ctx, org.orgId, org.authUserId)
    return { ctx: { ...org, audit }, args: {} }
  },
})

// Admin-only write (model configuration, member management).
export const adminMutation = customMutation(mutation, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    if (org.role !== "admin") throw appError(ERROR_CODES.adminRequired)
    const audit = makeAuditWriter(ctx, org.orgId, org.authUserId)
    return { ctx: { ...org, audit }, args: {} }
  },
})

// Admin-only read (org admin). Same gate as adminMutation.
export const adminQuery = customQuery(query, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    if (org.role !== "admin") throw appError(ERROR_CODES.adminRequired)
    return { ctx: org, args: {} }
  },
})

// Resolves the caller's Better Auth id from the JWT and asserts they are a
// platform admin (the cross-org operator flag on the app users mirror, set
// out-of-band). Deliberately NOT org-scoped: platform functions act across
// every tenant. Returns the operator's auth id for audit attribution.
async function requirePlatformAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .unique()
  if (user === null || user.isPlatformAdmin !== true) {
    throw appError(ERROR_CODES.platformAdminRequired)
  }
  return identity.subject
}

// Platform-admin read. Injects ctx.authUserId. Takes NO orgId: the absence of
// the org arg is the structural guard that keeps these distinct from the
// org-scoped builders.
export const platformQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requirePlatformAdmin(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})

// Platform-admin write (cross-org). Injects ctx.authUserId. No orgId.
export const platformMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requirePlatformAdmin(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})

// Authenticated but NOT org-scoped: injects ctx.authUserId from the JWT
// subject. For per-user account state (e.g. 2FA) that is independent of any
// organization. Mirrors requirePlatformAdmin minus the platform-admin check.
async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  return identity.subject
}

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requireAuth(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requireAuth(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})
