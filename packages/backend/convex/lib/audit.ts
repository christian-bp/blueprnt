import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"

export const AUDIT_EVENTS = {
  workspaceCreated: "workspace.created",
  workspaceProfileUpdated: "workspace.profileUpdated",
  memberAdded: "member.added",
  memberRoleChanged: "member.roleChanged",
  memberRemoved: "member.removed",
  invitationCreated: "invitation.created",
  invitationAccepted: "invitation.accepted",
  invitationRevoked: "invitation.revoked",
} as const

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

// Called inside the same mutation transaction as the change it records.
// Uses GenericMutationCtx<DataModel> so both MutationCtx (from _generated/server)
// and trigger handler contexts (GenericMutationCtx<DataModel>) are assignable.
export async function logAudit(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    orgId: string
    type: AuditEvent
    actorId: string
    payload: Record<string, unknown>
  }
) {
  const actor = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", entry.actorId))
    .unique()
  await ctx.db.insert("auditLog", {
    orgId: entry.orgId,
    type: entry.type,
    actorId: entry.actorId,
    actorName: actor?.name ?? "unknown",
    payload: entry.payload,
  })
}
