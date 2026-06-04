import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"

type Ctx = GenericMutationCtx<DataModel>

interface AuthUserDoc {
  _id: string
  email: string
  name: string
}

interface AuthOrgDoc {
  _id: string
}

interface AuthMemberDoc {
  _id: string
  organizationId: string
  userId: string
  role: string
  createdAt: number
}

// invitation fields: organizationId/email/inviterId/status are required strings
// per generatedSchema.ts; role is optional(union(null, string)).
interface AuthInvitationDoc {
  _id: string
  organizationId: string
  email: string
  role?: string | null
  status: string
  expiresAt: number
  createdAt: number
  inviterId: string
}

// All handlers are idempotent: a Better Auth endpoint can perform several
// writes and only the triggering operation rolls back on error.

export async function onUserCreate(ctx: Ctx, doc: AuthUserDoc) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("users", {
    authId: doc._id,
    name: doc.name,
    email: doc.email,
  })
}

export async function onUserUpdate(
  ctx: Ctx,
  newDoc: AuthUserDoc,
  _oldDoc: AuthUserDoc
) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", newDoc._id))
    .unique()
  if (row === null) {
    await onUserCreate(ctx, newDoc)
    return
  }
  await ctx.db.patch(row._id, { name: newDoc.name, email: newDoc.email })
}

export async function onUserDelete(ctx: Ctx, doc: AuthUserDoc) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (row !== null) await ctx.db.delete(row._id)
}

export async function onOrganizationCreate(ctx: Ctx, doc: AuthOrgDoc) {
  const existing = await ctx.db
    .query("workspaceProfiles")
    .withIndex("by_org", (q) => q.eq("orgId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("workspaceProfiles", { orgId: doc._id })
  // Audit only on first creation so the row is not duplicated on re-fire.
  await logAudit(ctx, {
    orgId: doc._id,
    type: AUDIT_EVENTS.workspaceCreated,
    actorId: "system",
    payload: {},
  })
}

export async function onMemberCreate(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberAdded,
    actorId: doc.userId,
    payload: { memberUserId: doc.userId, role: doc.role },
  })
}

export async function onMemberUpdate(
  ctx: Ctx,
  newDoc: AuthMemberDoc,
  oldDoc: AuthMemberDoc
) {
  if (newDoc.role === oldDoc.role) return
  await logAudit(ctx, {
    orgId: newDoc.organizationId,
    type: AUDIT_EVENTS.memberRoleChanged,
    actorId: newDoc.userId,
    payload: {
      memberUserId: newDoc.userId,
      from: oldDoc.role,
      to: newDoc.role,
    },
  })
}

export async function onMemberDelete(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberRemoved,
    actorId: doc.userId,
    payload: { memberUserId: doc.userId },
  })
}

export async function onInvitationCreate(ctx: Ctx, doc: AuthInvitationDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.invitationCreated,
    actorId: doc.inviterId,
    payload: { email: doc.email },
  })
}

export async function onInvitationUpdate(
  ctx: Ctx,
  newDoc: AuthInvitationDoc,
  oldDoc: AuthInvitationDoc
) {
  if (newDoc.status === oldDoc.status) return
  const type =
    newDoc.status === "accepted"
      ? AUDIT_EVENTS.invitationAccepted
      : AUDIT_EVENTS.invitationRevoked
  await logAudit(ctx, {
    orgId: newDoc.organizationId,
    type,
    actorId: newDoc.inviterId,
    payload: { email: newDoc.email, status: newDoc.status },
  })
}
