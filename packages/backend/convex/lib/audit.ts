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
  ratingChanged: "rating.change",
  bandShift: "band.shift",
  anchorRoleDesignated: "anchorRole.designated",
  anchorRoleUpdated: "anchorRole.updated",
  roleFamilyCreated: "roleFamily.created",
  roleFamilyRenamed: "roleFamily.renamed",
  roleFamilyRemoved: "roleFamily.removed",
} as const

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

// The ADMIN audit log's event vocabulary. Deliberately separate from
// AUDIT_EVENTS (the per-org log) so the two trails are never conflated. These
// values only ever go to platformAuditLog via logPlatformAudit.
export const PLATFORM_AUDIT_EVENTS = {
  userCreated: "platform.userCreated",
  userDeleted: "platform.userDeleted",
  orgCreated: "platform.orgCreated",
  orgUpdated: "platform.orgUpdated",
  membershipGranted: "platform.membershipGranted",
  membershipRoleChanged: "platform.membershipRoleChanged",
  membershipRevoked: "platform.membershipRevoked",
} as const

export type PlatformAuditEvent =
  (typeof PLATFORM_AUDIT_EVENTS)[keyof typeof PLATFORM_AUDIT_EVENTS]

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

// The admin audit log writer. Org-free operator trail, SEPARATE from logAudit
// (the per-org log). Mirrors logAudit's actorName snapshotting, but the entry
// carries IDs only (targetUserId/targetOrgId) and a payload that must never
// include the affected person's name or email, so erasure leaves no PII. The
// type is constrained to PlatformAuditEvent so org event keys cannot leak in.
export async function logPlatformAudit(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    actorId: string
    type: PlatformAuditEvent
    targetUserId?: string
    targetOrgId?: string
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
    console.error("platform audit actor lookup failed", {
      actorId: entry.actorId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  await ctx.db.insert("platformAuditLog", {
    actorId: entry.actorId,
    actorName,
    type: entry.type,
    ...(entry.targetUserId !== undefined
      ? { targetUserId: entry.targetUserId }
      : {}),
    ...(entry.targetOrgId !== undefined
      ? { targetOrgId: entry.targetOrgId }
      : {}),
    payload: entry.payload,
  })
}
