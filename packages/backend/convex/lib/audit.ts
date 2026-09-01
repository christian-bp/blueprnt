import type { GenericMutationCtx, GenericQueryCtx } from "convex/server"
import type { DataModel, Doc } from "../_generated/dataModel"
import { insertAuditAggregates } from "./auditAggregates"
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
  aiSuggestionConfirmed: "ai.suggestionConfirmed",
  aiSuggestionRejected: "ai.suggestionRejected",
  roleCreated: "role.created",
  roleUpdated: "role.updated",
  roleArchived: "role.archived",
  ratingChanged: "rating.change",
  levelShift: "level.shift",
  anchorRoleDesignated: "anchorRole.designated",
  anchorRoleUpdated: "anchorRole.updated",
  roleFamilyCreated: "roleFamily.created",
  roleFamilyRenamed: "roleFamily.renamed",
  roleFamilyRemoved: "roleFamily.removed",
  criterionApproved: "criterion.approved",
  criterionReopened: "criterion.reopened",
  criterionActivated: "criterion.activated",
  criterionDeactivated: "criterion.deactivated",
  modelApproved: "model.approved",
  modelWorkingConditionsDecided: "model.workingConditionsDecided",
  modelApprovalReopened: "model.approvalReopened",
  modelRestored: "model.restored",
  assessmentCompleted: "role.assessmentCompleted",
  assessmentReopened: "role.assessmentReopened",
  assessmentCalibrated: "role.assessmentCalibrated",
  personCreated: "person.created",
  personUpdated: "person.updated",
  personArchived: "person.archived",
  personErased: "person.erased",
  assignmentSet: "assignment.set",
  classificationSuggested: "classification.suggested",
  salarySet: "pay.salarySet",
  salaryDeleted: "pay.salaryDeleted",
  mappingProfileSaved: "pay.mappingSaved",
  importCompleted: "people.imported",
  payMappingRunStarted: "payMapping.runStarted",
  payMappingGroupAnalysisUpdated: "payMapping.groupAnalysisUpdated",
  payMappingRunCompleted: "payMapping.runCompleted",
  payMappingRunReopened: "payMapping.runReopened",
  payMappingCollaborationUpdated: "payMapping.collaborationUpdated",
  payMappingRunRenamed: "payMapping.runRenamed",
  payMappingRunDeleted: "payMapping.runDeleted",
  payMappingActionCreated: "payMapping.actionCreated",
  payMappingActionUpdated: "payMapping.actionUpdated",
  payMappingActionStatusChanged: "payMapping.actionStatusChanged",
  payMappingActionDeleted: "payMapping.actionDeleted",
  payMappingNoteCreated: "payMapping.noteCreated",
  payMappingNoteUpdated: "payMapping.noteUpdated",
  payMappingNoteDeleted: "payMapping.noteDeleted",
  payMappingReportExported: "payMapping.reportExported",
  payMappingMetricsExported: "payMapping.metricsExported",
  payMappingUnionReportExported: "payMapping.unionReportExported",
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
    type.startsWith("level.") ||
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
  if (type.startsWith("pay.") || type.startsWith("payMapping.")) return "pay"
  return undefined
}

// Audit subject: the specific entity INSTANCE an event is about, the second
// classification axis next to category (which is the app AREA). Stored
// denormalized and indexed on the row (by_org_subject) so one entity's whole
// trail (canonically a pay-mapping run) is retrievable without scanning
// payloads. Kinds are added only when a retrieval question exists for them;
// events whose entity kind is not scoped yet stay null in AUDIT_SUBJECTS.
//
// The `person` kind exists for ERASURE, not for browsing: person.* diffs record
// the employee's own identity values (name, gender, employee number, birth
// date, job title), so a hard delete must be able to find every row that
// mentions the person and tombstone those values. Without an indexed subject
// that retrieval would mean scanning the org's whole trail, which is the one
// thing a per-person erasure path cannot afford. anonymizePersonAuditRows is
// its only consumer today.
export const AUDIT_SUBJECT_KINDS = ["payMappingRun", "role", "person"] as const
export type AuditSubjectKind = (typeof AUDIT_SUBJECT_KINDS)[number]
export type AuditSubject = { kind: AuditSubjectKind; id: string }

// One entry per AUDIT_EVENTS value, so every event DECLARES which entity
// instance it is about: a deriver reads the id from the event's typed payload
// (compile-checked against AuditPayloads[E], so a wrong field is a type
// error), and `null` records the reviewed decision that the event has no
// single-entity subject (org-wide, bulk, or a kind not scoped yet). The
// Record over AuditEvent makes a new event without a subject decision a
// compile error, mirroring the AuditPayloads coverage guard. Multi-entity
// events carry ONE canonical subject: the entity whose own page a user would
// open to ask "what happened here" (rating.change and assignment.set index
// the role; their criterion ids stay payload-only until that kind gets a
// consumer). Subjects are internal ids only, never PII, and dangle
// harmlessly once their entity is hard-deleted (same status as payload ids).
// The person.* events index the person because erasure has to find their rows
// (see AUDIT_SUBJECT_KINDS); pay.* and assignment.set keep their existing
// subject because their diffs carry no identity values to scrub.
const AUDIT_SUBJECTS: {
  [E in AuditEvent]:
    | ((payload: AuditPayloads[E]) => AuditSubject | undefined)
    | null
} = {
  "organization.created": null,
  "organization.settingsUpdated": null,
  "organization.onboardingCompleted": null,
  "organization.logoUpdated": null,
  "organization.logoRemoved": null,
  "organization.nameUpdated": null,
  "member.added": null,
  "member.roleChanged": null,
  "member.removed": null,
  "invitation.created": null,
  "invitation.accepted": null,
  "invitation.revoked": null,
  "model.created": null,
  "model.updated": null,
  // Every confirmable suggestion kind targets the model or the starter set,
  // neither a subject kind yet (role-profile AI applies log role.updated,
  // which carries the role subject).
  "ai.suggestionConfirmed": null,
  "ai.suggestionRejected": (payload) =>
    payload.roleId !== undefined
      ? { kind: "role", id: payload.roleId }
      : undefined,
  "role.created": (payload) => ({ kind: "role", id: payload.roleId }),
  "role.updated": (payload) => ({ kind: "role", id: payload.roleId }),
  "role.archived": (payload) => ({ kind: "role", id: payload.roleId }),
  "rating.change": (payload) => ({ kind: "role", id: payload.roleId }),
  "level.shift": (payload) => ({ kind: "role", id: payload.roleId }),
  "anchorRole.designated": (payload) => ({ kind: "role", id: payload.roleId }),
  "anchorRole.updated": (payload) => ({ kind: "role", id: payload.roleId }),
  "roleFamily.created": null,
  "roleFamily.renamed": null,
  "roleFamily.removed": null,
  "criterion.approved": null,
  "criterion.reopened": null,
  // Reviewed null: a criterion's whole trail is reached through the model it
  // belongs to (one model per org), not through a per-criterion index; no
  // retrieval question exists yet for "this criterion's own history" the way
  // one exists for a pay-mapping run or a role.
  "criterion.activated": null,
  "criterion.deactivated": null,
  // Reviewed null: model-level events. There is no model subject kind (the
  // org has exactly one model), so a model's whole trail is reached by
  // filtering the org's log to the "model" category, not by a subject index.
  "model.approved": null,
  "model.workingConditionsDecided": null,
  "model.approvalReopened": null,
  "model.restored": null,
  "role.assessmentCompleted": (payload) => ({
    kind: "role",
    id: payload.roleId,
  }),
  "role.assessmentReopened": (payload) => ({
    kind: "role",
    id: payload.roleId,
  }),
  "role.assessmentCalibrated": (payload) => ({
    kind: "role",
    id: payload.roleId,
  }),
  "person.created": (payload) => ({ kind: "person", id: payload.personId }),
  "person.updated": (payload) => ({ kind: "person", id: payload.personId }),
  "person.archived": (payload) => ({ kind: "person", id: payload.personId }),
  "person.erased": (payload) => ({ kind: "person", id: payload.personId }),
  "assignment.set": (payload) => ({ kind: "role", id: payload.roleId }),
  "classification.suggested": null,
  "pay.salarySet": null,
  "pay.salaryDeleted": null,
  "pay.mappingSaved": null,
  "people.imported": null,
  "payMapping.runStarted": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.groupAnalysisUpdated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.runCompleted": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.runReopened": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.collaborationUpdated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.runRenamed": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.runDeleted": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.actionCreated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.actionUpdated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.actionStatusChanged": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.actionDeleted": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.noteCreated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.noteUpdated": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.noteDeleted": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.reportExported": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.metricsExported": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
  "payMapping.unionReportExported": (payload) => ({
    kind: "payMappingRun",
    id: payload.runId,
  }),
}

// Derives the subject for one event from its typed payload, or undefined for
// an event with no single-entity subject (or a deriver that finds no id, e.g.
// an ai.suggestionRejected without a roleId).
export function subjectForEvent<E extends AuditEvent>(
  type: E,
  payload: AuditPayloads[E]
): AuditSubject | undefined {
  const derive = AUDIT_SUBJECTS[type]
  return derive === null ? undefined : derive(payload)
}

// Collects scalar string/number leaves from an audit payload for the search text.
// Stays shallow so the result is bounded, but recurses one level into the nested
// shapes that carry the actual changed values: the top-level `changes` map's
// { from, to } values (e.g. country codes); each `items[]` entry's `label` plus
// its own `changes.*.{from,to}` (bulk children like created/removed criteria);
// each `suggestions[]` element's scalar values (dropped AI suggestions); and each
// `moves[]` element's `fromLabel`, `toLabel`, and `motivation` (AI weight-move
// rationales). Booleans, nulls, object-valued from/to (anchors, levelRules),
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

// Returns { anchors: { from, to } } only when any step-ordered anchor text
// differs between before and after, else {}. Needed because buildChanges
// compares arrays by reference and would always flag anchors as changed. The
// arrays are compared positionally (already stored ordered by step): a length
// change or any differing step/text at a position counts as a difference.
export function anchorDiff(
  before: Array<{ step: number; text: string }>,
  after: Array<{ step: number; text: string }>
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
      if (a.step !== b.step || a.text !== b.text) {
        differs = true
        break
      }
    }
  }
  return differs ? { anchors: { from: before, to: after } } : {}
}

// The anchor-role designation fields diffed by anchorRoles.ts (designate/update).
// roles.ts and starters.ts archive paths diff only the status/reviewedAt subset.
export const ANCHOR_AUDIT_FIELDS = [
  "expectedLevel",
  "motivation",
  "status",
  "reviewedAt",
] as const

// The model document fields diffed on create (level rules ride on the model
// row, ADR-0006).
export const MODEL_AUDIT_FIELDS = ["name"] as const

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

// The person fields captured for create/update/archive diffs: EVERY stored
// person field, identity included (ADR-0013). A pay-mapping audit has to answer
// "who changed this employee's record, when, and to what", and a trail that
// silently drops the identity fields answered nothing at all for the most
// common edit there is: correcting a name wrote a row whose diff was `{}`.
//
// The identity values are personal data, so recording them is only lawful
// together with the erasure path that removes them again:
// anonymizePersonAuditRows tombstones every PERSON_IDENTITY_AUDIT_FIELDS value
// (and rebuilds the derived searchText) across the person's whole trail when
// the person is hard-deleted. The row itself is kept on the trail's
// legitimate-interest basis, pseudonymized rather than deleted, the same
// anonymize-not-retain pattern as the actorName tombstone and the frozen
// pay-mapping snapshot (ADR-0011). Identity ordering is identity-first so the
// diff reads like the person form.
export const PERSON_AUDIT_FIELDS = [
  "displayName",
  "gender",
  "externalRef",
  "birthDate",
  "title",
  "employmentStartDate",
  "ftePercent",
  "country",
  "isManager",
  "statisticalCode",
  "department",
  "employmentType",
  "archivedAt",
] as const

export type PersonAuditField = (typeof PERSON_AUDIT_FIELDS)[number]

// Every audited person field DECLARES whether it identifies the individual.
// "identity" values are what erasure tombstones (a name, a gender, the employee
// number (a personal identifier under GDPR Art. 4(1), trivially mapped back
// through payroll), a birth date, and the imported job title, which is free text
// a payroll export can carry a name in); "structural" values are HR-operational
// and survive a hard delete unchanged.
//
// A total Record over PersonAuditField, not two hand-listed arrays, because the
// dangerous default is silence: an unclassified field would be treated as
// structural, so a future `personalNumber` or `email` added to
// PERSON_AUDIT_FIELDS would be diffed, never scrubbed, and retained forever with
// nothing failing. Now it does not compile until someone decides. Same guard
// idiom as AUDIT_SUBJECTS above.
const PERSON_AUDIT_FIELD_KIND: Record<
  PersonAuditField,
  "identity" | "structural"
> = {
  displayName: "identity",
  gender: "identity",
  externalRef: "identity",
  birthDate: "identity",
  title: "identity",
  employmentStartDate: "structural",
  ftePercent: "structural",
  country: "structural",
  isManager: "structural",
  statisticalCode: "structural",
  department: "structural",
  employmentType: "structural",
  archivedAt: "structural",
}

// Both lists are DERIVED from the classification above, never hand-listed, so
// they cannot drift from it or from each other. PERSON_ERASURE_AUDIT_FIELDS is
// what the person.erased row itself may snapshot: erasure must not write the
// identity values into a fresh row at the very moment it is scrubbing them out
// of the older ones.
export const PERSON_IDENTITY_AUDIT_FIELDS: readonly PersonAuditField[] =
  PERSON_AUDIT_FIELDS.filter(
    (field) => PERSON_AUDIT_FIELD_KIND[field] === "identity"
  )

export const PERSON_ERASURE_AUDIT_FIELDS: readonly PersonAuditField[] =
  PERSON_AUDIT_FIELDS.filter(
    (field) => PERSON_AUDIT_FIELD_KIND[field] === "structural"
  )

// Set-backed membership test, so the identity check is one O(1) helper rather
// than the same widening cast repeated at each call site.
const PERSON_IDENTITY_FIELD_SET: ReadonlySet<string> = new Set(
  PERSON_IDENTITY_AUDIT_FIELDS
)

export function isPersonIdentityField(field: string): boolean {
  return PERSON_IDENTITY_FIELD_SET.has(field)
}

// The audit snapshot of a person: every requested field as a plain Record, so
// buildChanges/buildCreateChanges/buildDeleteChanges can walk it without
// touching Convex document internals. Absent values collapse to null, so a
// cleared field diffs to null instead of vanishing from the stored payload
// (undefined is not a Convex value).
//
// Derived from the field list rather than hand-written per call site: the
// writers (create, import upsert, manual update, erase) previously each repeated
// the same object literal, and the erase one had already drifted (it silently
// omitted employmentType, so no erased row ever recorded it). `fields` narrows
// the snapshot for callers that must not capture identity values, which is only
// the erasure path (PERSON_ERASURE_AUDIT_FIELDS). archivePerson is deliberately
// NOT a caller: it diffs the single archivedAt field it touches, not a snapshot.
export function personAuditFields(
  person: Partial<Doc<"people">>,
  fields: readonly PersonAuditField[] = PERSON_AUDIT_FIELDS
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [field, person[field] ?? null])
  )
}

// Replaces an erased person's identity VALUES inside retained audit diffs. The
// field key stays (that this field changed, and when, is the audit evidence);
// only the value goes, so a scrubbed row reads "Name: erased -> erased" and the
// frontend renders it as a localized "(erased)" marker. Deliberately not
// ERASED_ACTOR_NAME: that tombstone names a deleted OPERATOR in actorName,
// while this one stands in for any identity value (a gender, a number, a date),
// and conflating the two would make the log's own vocabulary ambiguous.
export const ERASED_FIELD_VALUE = "erased"

// The pay-record fields diffed on salarySet/salaryDeleted. AMOUNT-FREE by
// design (GDPR): the trail records the year/source/currency of a pay change,
// never the amount (Role != Person; people/pay.ts).
export const PAY_AUDIT_FIELDS = ["payYear", "source", "currency"] as const

// The assignment fields diffed on assignment.set (people/assignments.ts). roleId
// is the internal key; the audit-log query resolves it to the role title for the
// detail sheet, and the frontend labels it "Role".
export const ASSIGNMENT_AUDIT_FIELDS = [
  "roleId",
  "seniority",
  "senioritySource",
] as const

// The pay-gap documentation fields diffed on payMapping.groupAnalysisUpdated
// (payMapping/analyses.ts). reasons are diffed as a ", "-joined display
// string (the taxonomy is a fixed enum, not free text); note is group-level
// (role-level) free text a user writes to justify a gap, never person
// identity (ADR-0012; Role != Person). finding ("none"|"found") is the
// praxis review's per-area verdict (DL 3 kap. 8 § p1); always null for
// equalWork/equivalentWork rows, so it never appears in their diff.
export const GROUP_ANALYSIS_AUDIT_FIELDS = [
  "reasons",
  "note",
  "done",
  "finding",
] as const

// The action fields diffed on payMapping.action* events (payMapping/
// actions.ts). Deliberately STRUCTURED fields only (ADR-0015): the free
// texts (problem, planned action), the owner (a user name that erasure
// could not scrub out of a diff), and the estimated cost (salary-adjacent
// for a person-targeted action) never enter the trail; an edit touching
// only those logs an empty diff, which still records that the action
// changed. plannedDate is diffed as an ISO date string, never epoch ms.
export const ACTION_AUDIT_FIELDS = [
  "status",
  "priority",
  "reason",
  "plannedDate",
] as const

// The note field diffed on payMapping.noteUpdated: the classification only;
// the note text itself never enters the trail (same rationale as above).
export const NOTE_AUDIT_FIELDS = ["noteType"] as const

// Extra diff fields on payMapping.actionUpdated/noteUpdated beyond the
// structured content: a re-target renders as an arrow (targetKind +
// targetLabel; the label is group-level display text, never a name), and
// an edit that only touched the untrailed fields (free text, owner, cost,
// note text) sets the `detailsChanged` marker so the row never reads as a
// no-op (ADR-0015: a changed-marker, never the text).
export const ACTION_UPDATE_AUDIT_FIELDS = [
  "targetKind",
  "targetLabel",
  "detailsChanged",
] as const

// Resolves an actor id to its display name by looking up the users mirror by
// auth id. Returns "unknown" when no mirror row matches (sentinel actors like
// "system"/"seeded"/"system:cli") or when the lookup throws. Shared by both
// audit writers (as a write-time snapshot) AND by read-time resolvers such as
// payMapping/runs.ts's "started by" column, so the lookup rule cannot drift
// between write-time and read-time use. Typed to accept any read-capable ctx
// (a GenericMutationCtx satisfies this structurally since its db is a
// GenericDatabaseWriter, a superset of GenericDatabaseReader) so both mutation
// and query contexts can call it.
export async function resolveActorName(
  ctx: GenericQueryCtx<DataModel>,
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

// The SHAPE a gesture id must have, not merely a length: a UUID, which is what
// lib/gesture.ts mints. The schema comment beneath this field claims the id
// carries no PII, and a length bound alone would leave that claim as
// documentation while 64 characters of arbitrary caller text landed on every
// row of a transaction, in an append-only table, permanently
// (anonymizePersonAuditRows scrubs the payload and searchText, never this). A
// shape a caller can only satisfy by generating a UUID is what makes the claim
// true in code.
//
// UUID-SHAPED rather than strictly v4: the version and variant nibbles are not
// pinned, and case is accepted. That is deliberate. The check exists to bound
// what can be STORED, and every UUID shape is equally free of meaning; refusing
// an uppercase or v7 id from some future client would be a false refusal that
// silently costs grouping, which is the failure this whole guard is trying to
// make impossible to introduce quietly.
const GESTURE_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A mutation ctx that may carry the caller's gesture id. The org/admin
// mutation wrappers put it there (lib/functions.ts), so every audit row
// written in that transaction inherits it without a single writer threading it
// through its own arguments: a helper that already takes `ctx` (writeAssignment
// is the case that matters, since a bulk confirm's rows are written from one)
// gets it for free. Optional, so a plain MutationCtx stays assignable.
export type AuditMutationCtx = GenericMutationCtx<DataModel> & {
  gestureId?: string
}

// Normalizes what a caller sent into what may be stored: a UUID-shaped id, or
// nothing at all. Dropped rather than thrown on, because a gesture id only ever
// affects how the log GROUPS rows: a client bug in an id must never fail the
// write it decorates, and a row without one simply reads as its own story.
//
// The drop is not silent. A rejected NON-EMPTY id means the client sent
// something it thought was an id, which is a bug that would otherwise degrade
// grouping invisibly and forever; the breadcrumb follows resolveActorName's own
// pattern above. It logs the LENGTH only, never the value, since the value is
// the very thing that just failed validation.
export function normalizeGestureId(gestureId: unknown): string | undefined {
  if (typeof gestureId !== "string") return undefined
  const trimmed = gestureId.trim()
  if (trimmed === "") return undefined
  if (!GESTURE_ID_SHAPE.test(trimmed)) {
    console.warn("audit gestureId rejected", { length: trimmed.length })
    return undefined
  }
  return trimmed
}

// Called inside the same mutation transaction as the change it records.
// Uses GenericMutationCtx<DataModel> so both MutationCtx (from _generated/server)
// and trigger handler contexts (GenericMutationCtx<DataModel>) are assignable.
// Generic over the event type so the payload is type-checked against
// AuditPayloads[E] (the per-event envelope contract).
export async function logAudit<E extends keyof AuditPayloads>(
  ctx: AuditMutationCtx,
  entry: {
    orgId: string
    type: E
    actorId: string
    payload: AuditPayloads[E]
    // Only the ctx-bound writer (makeAuditWriter) passes this, because it is
    // built before the custom ctx it belongs to exists. Every other caller
    // hands over the handler's own ctx, which already carries the id, and
    // passes nothing here.
    gestureId?: string
  }
) {
  const actorName = await resolveActorName(ctx, entry.actorId)
  // Derived like category: never passed by call sites, always computed from
  // the typed payload. Spread conditionally (undefined is not a Convex value).
  const subject = subjectForEvent(entry.type, entry.payload)
  // The gesture id belongs to the whole transaction, not to one row: it comes
  // from the ctx the handler is running under, so no writer has to remember to
  // thread it. The entry override exists only for the ctx-bound writer.
  const gestureId = normalizeGestureId(entry.gestureId ?? ctx.gestureId)
  const rowId = await ctx.db.insert("auditLog", {
    orgId: entry.orgId,
    type: entry.type,
    actorId: entry.actorId,
    actorName,
    payload: entry.payload as Record<string, unknown>,
    category: categoryForEvent(entry.type),
    ...(subject !== undefined ? { subject } : {}),
    ...(gestureId !== undefined ? { gestureId } : {}),
    searchText: buildSearchText(
      actorName,
      entry.type,
      entry.payload as Record<string, unknown>
    ),
  })
  // Same-transaction aggregate maintenance (the pager's exact count and
  // jump-to-page), so the counts can never drift from the table.
  const row = await ctx.db.get(rowId)
  if (row !== null) await insertAuditAggregates(ctx, row)
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

// GDPR erasure: anonymizes every audit row the erased user AUTHORED, across both
// the per-org auditLog and the platformAuditLog. Replaces the snapshotted
// actorName with the tombstone AND rebuilds the derived searchText from it, so
// the erased person's real name is neither stored nor full-text-searchable
// afterwards (actorName alone is not enough: searchText is a denormalized copy
// that was built from the name at write time). The rows themselves are kept for
// the trail's legitimate-interest basis.
//
// This handles the AUTHOR of a row, not its subject. A person.* payload can
// carry the identity of the EMPLOYEE the row is about (ADR-0013), and that
// employee's data is deliberately untouched here: an operator's erasure must not
// scrub a different, still-existing person's record. anonymizePersonAuditRows
// below is the subject-side counterpart, and the two compose in either order
// (each rebuilds searchText from whatever the other already tombstoned). Shared
// by both operator erasure paths (accounts.eraseSelf and platform.deleteUser) so
// the two cannot drift (the same rationale that makes ERASED_ACTOR_NAME shared).
export async function anonymizeAuthoredAuditRows(
  ctx: GenericMutationCtx<DataModel>,
  actorId: string
): Promise<void> {
  const orgAuthored = await ctx.db
    .query("auditLog")
    .withIndex("by_actor", (q) => q.eq("actorId", actorId))
    .collect()
  for (const row of orgAuthored) {
    await ctx.db.patch(row._id, {
      actorName: ERASED_ACTOR_NAME,
      searchText: buildSearchText(
        ERASED_ACTOR_NAME,
        row.type,
        row.payload as Record<string, unknown>
      ),
    })
  }
  const platformAuthored = await ctx.db
    .query("platformAuditLog")
    .withIndex("by_actor", (q) => q.eq("actorId", actorId))
    .collect()
  for (const row of platformAuthored) {
    await ctx.db.patch(row._id, {
      actorName: ERASED_ACTOR_NAME,
      searchText: buildSearchText(
        ERASED_ACTOR_NAME,
        row.type,
        row.payload as Record<string, unknown>
      ),
    })
  }
}

// Replaces every identity value inside one audit payload's `changes` diff with
// the ERASED_FIELD_VALUE tombstone, returning the new payload, or null when the
// payload has nothing to scrub (no diff, or already scrubbed) so the caller can
// skip the write. Pure and idempotent: re-running it changes nothing.
//
// A null side is left alone. `{ from: null, to: "Anna" }` becomes
// `{ from: null, to: "erased" }`, never `{ from: "erased", ... }`: null means
// "there was no value here", and tombstoning it would invent a change that
// never happened. Non-identity fields (department, FTE, country, ...) pass
// through untouched: they are not personal data once the person row is gone.
//
// SCOPE: only the top-level `changes` map is walked, which covers every person
// payload shape that exists (all four are exactly { personId, changes }). The
// assertion below makes that a compile-time fact rather than an assumption: a
// bulk person event carrying `items[]` (the shape buildSearchText already
// indexes, via items[].label and items[].changes) would leak names past this
// function, so adding one must not typecheck until the walk is extended.
export function scrubPersonIdentityChanges(
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const changes = payload.changes
  if (
    changes === null ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    return null
  }
  let scrubbed = false
  const next: Record<string, unknown> = {}
  for (const [field, change] of Object.entries(
    changes as Record<string, unknown>
  )) {
    if (
      !isPersonIdentityField(field) ||
      change === null ||
      typeof change !== "object" ||
      Array.isArray(change)
    ) {
      next[field] = change
      continue
    }
    const { from, to } = change as { from?: unknown; to?: unknown }
    const nextFrom = from == null ? from : ERASED_FIELD_VALUE
    const nextTo = to == null ? to : ERASED_FIELD_VALUE
    if (nextFrom !== from || nextTo !== to) scrubbed = true
    next[field] = { from: nextFrom, to: nextTo }
  }
  return scrubbed ? { ...payload, changes: next } : null
}

// The compile-time half of scrubPersonIdentityChanges' SCOPE note: every person
// event's payload must stay exactly { personId, changes }. Any additional key
// fails this assertion, which is the reminder that the scrub walks only the
// top-level changes map: a nested `items[]` (a bulk person event) or any other
// container would carry identity values straight past it and into searchText,
// which recurses into items[].label and items[].changes.
//
// Checked per event, NOT over their union: `keyof (A | B)` is the INTERSECTION
// of their keys, so a union-based check silently passes when only one payload
// gains the key (verified by adding `items` to one and watching it typecheck).
type FlatPersonPayload<T> =
  Exclude<keyof T, "personId" | "changes"> extends never ? true : never
const _assertPersonPayloadsAreFlat: [
  FlatPersonPayload<AuditPayloads["person.created"]>,
  FlatPersonPayload<AuditPayloads["person.updated"]>,
  FlatPersonPayload<AuditPayloads["person.archived"]>,
  FlatPersonPayload<AuditPayloads["person.erased"]>,
] = [true, true, true, true]
void _assertPersonPayloadsAreFlat

// GDPR erasure, person side: pseudonymizes every audit row ABOUT an erased
// employee (the counterpart to anonymizeAuthoredAuditRows, which handles rows an
// erased operator AUTHORED). person.* diffs record the employee's own identity
// values, so a hard delete has to reach back into the retained trail and
// tombstone them, then rebuild the derived searchText from the scrubbed payload
// (actorName is untouched here: the operator who made the edit is not the person
// being erased, and their name stays for accountability). Without the searchText
// rebuild the name would remain full-text searchable in a denormalized copy,
// which is exactly how the actorName tombstone was once incomplete.
//
// Rows are found through the by_org_subject index (see AUDIT_SUBJECT_KINDS), so
// the work is bounded by one person's own history rather than the org's whole
// trail. Called from erasePersonRecords, before the person.erased row is
// written: that row is built from PERSON_ERASURE_AUDIT_FIELDS and carries no
// identity values, so it needs no scrubbing.
export async function anonymizePersonAuditRows(
  ctx: GenericMutationCtx<DataModel>,
  orgId: string,
  personId: string
): Promise<void> {
  const rows = await ctx.db
    .query("auditLog")
    .withIndex("by_org_subject", (q) =>
      q
        .eq("orgId", orgId)
        .eq("subject.kind", "person")
        .eq("subject.id", personId)
    )
    .collect()
  for (const row of rows) {
    const scrubbed = scrubPersonIdentityChanges(
      row.payload as Record<string, unknown>
    )
    if (scrubbed === null) continue
    await ctx.db.patch(row._id, {
      payload: scrubbed,
      searchText: buildSearchText(row.actorName, row.type, scrubbed),
    })
  }
}
