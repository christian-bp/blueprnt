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

// Audit categories: the part of the app an action touches, for filtering the log.
export const AUDIT_CATEGORIES = [
  "model",
  "role",
  "organization",
  "member",
  "ai",
] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

// Maps an event type to its category by prefix. Unknown types fall back to "role"
// only if role-ish; otherwise return undefined so they are simply uncategorized.
export function categoryForEvent(type: string): AuditCategory | undefined {
  if (type.startsWith("model.")) return "model"
  if (
    type.startsWith("role.") ||
    type.startsWith("roleFamily.") ||
    type.startsWith("rating.") ||
    type.startsWith("band.") ||
    type.startsWith("anchorRole.")
  )
    return "role"
  if (type.startsWith("organization.")) return "organization"
  if (type.startsWith("member.") || type.startsWith("invitation."))
    return "member"
  if (type.startsWith("ai.")) return "ai"
  return undefined
}

// Collects scalar string/number leaves from an audit payload for the search text.
// Recurses one level into the `changes` object's { from, to } values (those carry
// the actual changed values, e.g. country codes), but otherwise stays shallow so
// the result is bounded. Booleans, nulls, ids-as-objects, and deeper nesting are
// ignored on purpose.
function collectPayloadLeaves(payload: Record<string, unknown>): string[] {
  const leaves: string[] = []
  const pushScalar = (value: unknown) => {
    if (typeof value === "string") leaves.push(value)
    else if (typeof value === "number") leaves.push(String(value))
  }
  for (const [key, value] of Object.entries(payload)) {
    if (
      key === "changes" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      for (const change of Object.values(value as Record<string, unknown>)) {
        if (
          change !== null &&
          typeof change === "object" &&
          !Array.isArray(change)
        ) {
          const { from, to } = change as { from?: unknown; to?: unknown }
          pushScalar(from)
          pushScalar(to)
        }
      }
      continue
    }
    pushScalar(value)
  }
  return leaves
}

// Builds the denormalized, lowercased search text for an audit row from the bits
// available at write time: the resolved actorName, the event type, and the
// scalar leaves of the payload (including nested changes from/to values). Role
// titles and other names are NOT available here, only ids; that is an accepted
// limitation. Pure and bounded so it is directly unit-testable.
export function buildSearchText(
  actorName: string,
  type: string,
  payload: Record<string, unknown>
): string {
  return [actorName, type, ...collectPayloadLeaves(payload)]
    .join(" ")
    .toLowerCase()
}

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
  adminGranted: "platform.adminGranted",
  adminRevoked: "platform.adminRevoked",
} as const

export type PlatformAuditEvent =
  (typeof PLATFORM_AUDIT_EVENTS)[keyof typeof PLATFORM_AUDIT_EVENTS]

// Builds a structured before->after diff for audit payloads. Only includes
// fields whose value actually changed; undefined collapses to null so the
// shape stays JSON-clean.
export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const field of fields) {
    if (!(field in after)) continue
    const from = before[field] ?? null
    const to = after[field] ?? null
    if (from !== to) changes[field] = { from, to }
  }
  return changes
}

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
    category: categoryForEvent(entry.type),
    searchText: buildSearchText(actorName, entry.type, entry.payload),
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
