import type { GenericMutationCtx } from "convex/server"
import type { DataModel, Doc } from "../_generated/dataModel"
import type { AuditPayloads, PlatformAuditPayloads } from "./auditPayloads"

// Every value here needs BOTH a payload entry in AuditPayloads
// (lib/auditPayloads.ts, compile-time-guarded) AND a readable label under
// dashboard.auditLog.events in every locale, or the audit log shows the raw
// event key. The audit-label coverage test (apps/dashboard) guards the labels.
// PLATFORM_AUDIT_EVENTS labels live under dashboard.admin.auditLog.events.
export const AUDIT_EVENTS = {
  organizationCreated: "organization.created",
  organizationSettingsUpdated: "organization.settingsUpdated",
  onboardingCompleted: "organization.onboardingCompleted",
  organizationLogoUpdated: "organization.logoUpdated",
  organizationLogoRemoved: "organization.logoRemoved",
  organizationNameUpdated: "organization.nameUpdated",
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
  criterionApproved: "criterion.approved",
  criterionReopened: "criterion.reopened",
  personCreated: "person.created",
  personUpdated: "person.updated",
  personArchived: "person.archived",
  personErased: "person.erased",
  assignmentSet: "assignment.set",
  classificationSuggested: "classification.suggested",
  salarySet: "pay.salarySet",
  mappingProfileSaved: "pay.mappingSaved",
  importCompleted: "people.imported",
} as const

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

// Audit categories: the part of the app an action touches, for filtering the log.
export const AUDIT_CATEGORIES = [
  "model",
  "role",
  "organization",
  "member",
  "ai",
  "people",
  "pay",
] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

// Maps an event type to its category by prefix. Unknown types fall back to "role"
// only if role-ish; otherwise return undefined so they are simply uncategorized.
export function categoryForEvent(type: string): AuditCategory | undefined {
  if (type.startsWith("criterion.")) return "model"
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
  if (
    type.startsWith("person.") ||
    type.startsWith("people.") ||
    type.startsWith("assignment.") ||
    type.startsWith("classification.")
  )
    return "people"
  if (type.startsWith("pay.")) return "pay"
  return undefined
}

// Collects scalar string/number leaves from an audit payload for the search text.
// Stays shallow so the result is bounded, but recurses one level into the nested
// shapes that carry the actual changed values: the top-level `changes` map's
// { from, to } values (e.g. country codes); each `items[]` entry's `label` plus
// its own `changes.*.{from,to}` (bulk children like created/removed criteria);
// each `suggestions[]` element's scalar values (dropped AI suggestions); and each
// `moves[]` element's `fromLabel`, `toLabel`, and `motivation` (AI weight-move
// rationales). Booleans, nulls, object-valued from/to (anchors, bandThresholds),
// and any deeper nesting are ignored on purpose; pushScalar drops non-scalars.
function collectPayloadLeaves(payload: Record<string, unknown>): string[] {
  const leaves: string[] = []
  const pushScalar = (value: unknown) => {
    if (typeof value === "string") leaves.push(value)
    else if (typeof value === "number") leaves.push(String(value))
  }
  const pushChanges = (changes: unknown) => {
    if (
      changes === null ||
      typeof changes !== "object" ||
      Array.isArray(changes)
    )
      return
    for (const change of Object.values(changes as Record<string, unknown>)) {
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
  }
  const pushScalarsOf = (entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      return
    for (const value of Object.values(entry as Record<string, unknown>))
      pushScalar(value)
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key === "changes") {
      pushChanges(value)
      continue
    }
    if (key === "items" && Array.isArray(value)) {
      for (const item of value) {
        if (item === null || typeof item !== "object" || Array.isArray(item))
          continue
        const { label, changes } = item as {
          label?: unknown
          changes?: unknown
        }
        pushScalar(label)
        pushChanges(changes)
      }
      continue
    }
    if (key === "suggestions" && Array.isArray(value)) {
      for (const suggestion of value) pushScalarsOf(suggestion)
      continue
    }
    if (key === "moves" && Array.isArray(value)) {
      for (const move of value) {
        if (move === null || typeof move !== "object" || Array.isArray(move))
          continue
        const { fromLabel, toLabel, motivation } = move as {
          fromLabel?: unknown
          toLabel?: unknown
          motivation?: unknown
        }
        pushScalar(fromLabel)
        pushScalar(toLabel)
        pushScalar(motivation)
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

// Tombstone that replaces a deleted person's snapshotted name in append-only
// logs (GDPR erasure). Shared by both erasure paths (platform/admin.ts
// deleteUser and accounts/account.ts eraseSelf) so the value cannot drift: the
// admin and self-service erasures must leave an identical trail.
export const ERASED_ACTOR_NAME = "deleted user"

// Platform audit categories: the area an admin action touches, for filtering the
// admin log. Mirrors AUDIT_CATEGORIES for the per-org log.
export const PLATFORM_AUDIT_CATEGORIES = [
  "user",
  "organization",
  "membership",
  "admin",
] as const
export type PlatformAuditCategory = (typeof PLATFORM_AUDIT_CATEGORIES)[number]

// Maps a platform.* event type to its category. Unknown types return undefined
// so they stay uncategorized rather than misfiled.
export function categoryForPlatformEvent(
  type: string
): PlatformAuditCategory | undefined {
  switch (type) {
    case PLATFORM_AUDIT_EVENTS.userCreated:
    case PLATFORM_AUDIT_EVENTS.userDeleted:
      return "user"
    case PLATFORM_AUDIT_EVENTS.orgCreated:
    case PLATFORM_AUDIT_EVENTS.orgUpdated:
      return "organization"
    case PLATFORM_AUDIT_EVENTS.membershipGranted:
    case PLATFORM_AUDIT_EVENTS.membershipRoleChanged:
    case PLATFORM_AUDIT_EVENTS.membershipRevoked:
      return "membership"
    case PLATFORM_AUDIT_EVENTS.adminGranted:
    case PLATFORM_AUDIT_EVENTS.adminRevoked:
      return "admin"
    default:
      return undefined
  }
}

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

// Create-time changes: every listed field present on `after` becomes
// { from: null, to: value }. Unlike buildChanges this is unconditional (the
// created value is the change), so it KEEPS fields whose value is an empty
// string (a legitimate created value). Fields absent from `after` are skipped;
// undefined/null values collapse to to: null.
export function buildCreateChanges(
  after: Record<string, unknown>,
  fields: readonly string[]
): Record<string, { from: null; to: unknown }> {
  const changes: Record<string, { from: null; to: unknown }> = {}
  for (const field of fields) {
    if (!(field in after)) continue
    changes[field] = { from: null, to: after[field] ?? null }
  }
  return changes
}

// Delete-time changes: mirror of buildCreateChanges. Every listed field present
// on the removed entity becomes { from: value, to: null }. Fields absent from
// `before` are skipped; undefined/null values collapse to from: null.
export function buildDeleteChanges(
  before: Record<string, unknown>,
  fields: readonly string[]
): Record<string, { from: unknown; to: null }> {
  const changes: Record<string, { from: unknown; to: null }> = {}
  for (const field of fields) {
    if (!(field in before)) continue
    changes[field] = { from: before[field] ?? null, to: null }
  }
  return changes
}

// Returns { anchors: { from, to } } only when any level-ordered anchor text
// differs between before and after, else {}. Needed because buildChanges
// compares arrays by reference and would always flag anchors as changed. The
// arrays are compared positionally (already stored ordered by level): a length
// change or any differing level/text at a position counts as a difference.
export function anchorDiff(
  before: Array<{ level: number; text: string }>,
  after: Array<{ level: number; text: string }>
): Record<"anchors", { from: unknown; to: unknown }> | Record<string, never> {
  let differs = before.length !== after.length
  if (!differs) {
    for (let i = 0; i < before.length; i++) {
      const a = before[i]
      const b = after[i]
      if (a === undefined || b === undefined) {
        differs = true
        break
      }
      if (a.level !== b.level || a.text !== b.text) {
        differs = true
        break
      }
    }
  }
  return differs ? { anchors: { from: before, to: after } } : {}
}

// The audit field set captured for a criterion, identical for create and delete
// so criterion.added and criterion.removed (and model.discarded) stay symmetric.
// INCLUDES templateKey on purpose (a pristine template criterion records which
// template row it came from).
export const CRITERION_AUDIT_FIELDS = [
  "name",
  "description",
  "helpText",
  "anchors",
  "weightPoints",
  "order",
  "isCustom",
  "templateKey",
] as const

// The anchor-role designation fields diffed by anchorRoles.ts (designate/update).
// roles.ts and starters.ts archive paths diff only the status/reviewedAt subset.
export const ANCHOR_AUDIT_FIELDS = [
  "expectedBand",
  "motivation",
  "status",
  "reviewedAt",
] as const

// The model document fields diffed on create/discard (anchors and band
// thresholds ride on the model row, ADR-0006).
export const MODEL_AUDIT_FIELDS = [
  "name",
  "templateKey",
  "bandThresholds",
] as const

// The organization settings fields diffed on settingsUpdated.
export const SETTINGS_AUDIT_FIELDS = [
  "country",
  "currency",
  "language",
  "employeeCount",
  "industry",
] as const

// The job profile fields captured when a role is created (createRole and the
// starter/import/reconcile create paths share this list).
export const ROLE_CREATE_FIELDS = [
  "title",
  "function",
  "team",
  "trackKey",
  "familyId",
  "purpose",
  "responsibilities",
] as const

// The person fields captured for create/update/archive diffs. EXCLUDES
// displayName, gender, and birthDate (PII; GDPR / Role != Person) so audit
// changes diffs never carry personal data. Only structural and
// HR-operational fields are recorded.
export const PERSON_AUDIT_FIELDS = [
  "externalRef",
  "employmentStartDate",
  "ftePercent",
  "country",
  "isManager",
  "statisticalCode",
  "department",
  "archivedAt",
] as const

// One bulk `items` entry for a freshly created criterion (template/scratch/AI).
// Wraps buildCreateChanges over CRITERION_AUDIT_FIELDS; the human label is the
// criterion name (ids in items are NOT resolved at read time). The optional
// fields default to the schema's stored shape so the captured snapshot is
// complete even when a caller omits them.
export function criterionCreateItem(args: {
  criterionId?: string
  templateKey?: string | null
  name: string
  order: number
  description?: string
  helpText?: string
  weightPoints: number
  isCustom: boolean
  anchors?: Array<{ level: number; text: string }>
}): {
  criterionId?: string
  label: string
  changes: Record<string, { from: null; to: unknown }>
} {
  const after: Record<string, unknown> = {
    name: args.name,
    description: args.description ?? "",
    helpText: args.helpText ?? "",
    anchors: args.anchors ?? [],
    weightPoints: args.weightPoints,
    order: args.order,
    isCustom: args.isCustom,
    templateKey: args.templateKey ?? null,
  }
  return {
    ...(args.criterionId !== undefined
      ? { criterionId: args.criterionId }
      : {}),
    label: args.name,
    changes: buildCreateChanges(after, CRITERION_AUDIT_FIELDS),
  }
}

// One bulk `items` entry for a criterion being hard-deleted. Wraps
// buildDeleteChanges over the same CRITERION_AUDIT_FIELDS; the human label is
// the criterion name.
export function criterionDeleteItem(criterion: Doc<"criteria">): {
  criterionId: string
  label: string
  changes: Record<string, { from: unknown; to: null }>
} {
  return {
    criterionId: criterion._id,
    label: criterion.name,
    changes: buildDeleteChanges(criterion, CRITERION_AUDIT_FIELDS),
  }
}

// Snapshots the actor's display name at write time by looking up the users
// mirror by auth id. Returns "unknown" when no mirror row matches (sentinel
// actors like "system"/"seeded"/"system:cli") or when the lookup throws.
// Shared by both audit writers so the snapshot rule cannot drift between them.
async function resolveActorName(
  ctx: GenericMutationCtx<DataModel>,
  actorId: string
): Promise<string> {
  try {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", actorId))
      .first()
    if (actor !== null) return actor.name
  } catch (error) {
    console.error("audit actor lookup failed", {
      actorId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return "unknown"
}

// Called inside the same mutation transaction as the change it records.
// Uses GenericMutationCtx<DataModel> so both MutationCtx (from _generated/server)
// and trigger handler contexts (GenericMutationCtx<DataModel>) are assignable.
// Generic over the event type so the payload is type-checked against
// AuditPayloads[E] (the per-event envelope contract).
export async function logAudit<E extends keyof AuditPayloads>(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    orgId: string
    type: E
    actorId: string
    payload: AuditPayloads[E]
  }
) {
  const actorName = await resolveActorName(ctx, entry.actorId)
  await ctx.db.insert("auditLog", {
    orgId: entry.orgId,
    type: entry.type,
    actorId: entry.actorId,
    actorName,
    payload: entry.payload as Record<string, unknown>,
    category: categoryForEvent(entry.type),
    searchText: buildSearchText(
      actorName,
      entry.type,
      entry.payload as Record<string, unknown>
    ),
  })
}

// The admin audit log writer. Org-free operator trail, SEPARATE from logAudit
// (the per-org log). Mirrors logAudit's actorName snapshotting, but the entry
// carries IDs only (targetUserId/targetOrgId) and a payload that must never
// include the affected person's name or email, so erasure leaves no PII. The
// type is constrained to PlatformAuditEvent so org event keys cannot leak in.
export async function logPlatformAudit<E extends keyof PlatformAuditPayloads>(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    actorId: string
    type: E
    targetUserId?: string
    targetOrgId?: string
    payload: PlatformAuditPayloads[E]
  }
) {
  const actorName = await resolveActorName(ctx, entry.actorId)
  const payload = entry.payload as Record<string, unknown>
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
    payload,
    category: categoryForPlatformEvent(entry.type),
    // Built ONLY from actorName + type + id-only payload scalars. The target
    // email/name are deliberately NOT included (they are resolved at read time
    // for display): keeping searchText PII-free is what lets erasure stay clean.
    searchText: buildSearchText(actorName, entry.type, payload),
  })
}
