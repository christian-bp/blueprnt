import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"

export const AUDIT_EVENTS = {
  organizationCreated: "organization.created",
  organizationSettingsUpdated: "organization.settingsUpdated",
  onboardingCompleted: "organization.onboardingCompleted",
  memberAdded: "member.added",
  memberRoleChanged: "member.roleChanged",
  memberRemoved: "member.removed",
  invitationCreated: "invitation.created",
  invitationAccepted: "invitation.accepted",
  invitationRevoked: "invitation.revoked",
  modelCreated: "model.created",
  modelUpdated: "model.updated",
  modelDiscarded: "model.discarded",
  aiSuggestionConfirmed: "ai.suggestionConfirmed",
  aiSuggestionRejected: "ai.suggestionRejected",
  roleCreated: "role.created",
  roleUpdated: "role.updated",
  roleArchived: "role.archived",
  roleStatusChanged: "role.statusChange",
  ratingChanged: "rating.change",
  bandShift: "band.shift",
  roleFamilyCreated: "roleFamily.created",
  roleFamilyRenamed: "roleFamily.renamed",
  roleFamilyRemoved: "roleFamily.removed",
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
  let actorName = "unknown"
  try {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", entry.actorId))
      .first()
    if (actor !== null) actorName = actor.name
  } catch (error) {
    console.error("audit actor lookup failed", {
      actorId: entry.actorId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  await ctx.db.insert("auditLog", {
    orgId: entry.orgId,
    type: entry.type,
    actorId: entry.actorId,
    actorName,
    payload: entry.payload,
  })
}
