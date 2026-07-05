import type { AuditEvent, PlatformAuditEvent } from "./audit"

// Typed payload contracts for the audit-log writers. These constrain the
// ENVELOPE of each event's payload (which keys/shape per event); they never
// reduce what the diff engine (buildChanges/snapshots/logBandShifts) captures.
// Every field's { from, to }, create/delete snapshots, positional anchors diff,
// bulk items[].changes, moves[], provenance meta, and band.shift cause+changes
// are produced by the same code and now additionally type-checked.
//
// The shapes here MUST match what collectPayloadLeaves walks and what each
// call site actually emits. Two events are heterogeneous and modeled as
// discriminated unions (on `change` and `kind`): a flat object would make
// per-variant fields optional and be strictly weaker than today.

// A structured before->after diff. Matches buildChanges' return type.
export type Changes = Record<string, { from: unknown; to: unknown }>

// One bulk `items[]` entry. `label` is optional (weight-review labels resolve
// by id and can be undefined). The index signature carries per-variant extras
// (e.g. model-draft items add originalWeightPoints/anchorCount inside changes,
// and removal items carry only roleId/changes).
export type AuditItem = {
  criterionId?: string
  roleId?: string
  familyId?: string
  memberUserId?: string
  suggestionId?: string
  label?: string
  changes: Changes
  [k: string]: unknown
}

// One AI weight-review move detail. fromLabel/toLabel resolve by id and may be
// undefined; motivation is the AI's rationale.
export type AuditMove = {
  fromCriterionId?: string
  fromLabel?: string
  toCriterionId?: string
  toLabel?: string
  points: number
  applied: boolean
  motivation?: string | null
}

// One dropped-suggestion summary on model.discarded (id + kind + status only,
// never suggestedValue).
export type AuditSuggestionItem = {
  suggestionId: string
  kind: string
  status: string
}

// What triggered a band.shift: the domain event plus the role/criterion/entity
// it touched, so a shift can be traced back to what moved it.
export type BandCause = {
  event: AuditEvent
  roleId?: string
  criterionId?: string
  entityId?: string
}

// model.updated is heterogeneous, keyed on `change` (criterion add/update,
// whole-allocation rebalance, removal). Discriminated so per-variant fields
// (budget/items/deletedRatingCount) stay required on their own variant.
export type ModelUpdatedPayload =
  | {
      change: "criterion.added"
      criterionId: string
      modelId: string
      changes: Changes
    }
  | {
      change: "criterion.updated"
      criterionId: string
      modelId: string
      changes: Changes
    }
  | {
      change: "weights.rebalanced"
      modelId: string
      budget: number
      count: number
      items: AuditItem[]
    }
  | {
      change: "criterion.removed"
      modelId: string
      deletedRatingCount: number
      budget: { from: number; to: number }
      changes: Changes
      count: number
      items: AuditItem[]
    }
  | {
      change: "criterion.complianceUpdated"
      criterionId: string
      modelId: string
      changes: Changes
    }

// ai.suggestionConfirmed is heterogeneous, keyed on `kind` (one of the four
// suggestion kinds). Discriminated so each kind's distinct fields stay required.
export type AiConfirmedPayload =
  | {
      suggestionId: string
      kind: "model.draft"
      acceptedCount: number
      totalProposed: number
      count: number
      items: AuditItem[]
    }
  | {
      suggestionId: string
      kind: "model.weightReview"
      appliedCount: number
      totalMoves: number
      skippedCount: number
      appliedMoveIndexes: number[]
      count: number
      items: AuditItem[]
      moves: AuditMove[]
    }
  | {
      suggestionId: string
      kind: "role.profile"
      roleId: string
      appliedCount: number
      appliedFields: string[]
      requestedFields: string[]
      offeredFields: string[]
      confirmed: boolean
    }
  | {
      suggestionId: string
      kind: "starter.import"
      familyCount: number
      roleCount: number
      families: unknown[]
    }

// Per-org audit payloads, keyed 1:1 by every AUDIT_EVENTS value. The two
// multi-shape events are discriminated unions; the rest are flat per-event
// shapes built faithfully from the real call sites.
export interface AuditPayloads {
  "organization.created": { changes: Changes }
  "organization.settingsUpdated": { created?: boolean; changes: Changes }
  "organization.onboardingCompleted": {
    created?: boolean
    criteriaCount?: number | null
    hadModel?: boolean
    changes: Changes
  }
  "organization.logoUpdated": Record<string, never>
  "organization.logoRemoved": Record<string, never>
  "organization.nameUpdated": { changes: Changes }
  "member.added": {
    memberUserId: string
    memberId?: string
    changes: Changes
  }
  "member.roleChanged": {
    memberUserId: string
    memberId?: string
    changes: Changes
  }
  "member.removed": {
    memberUserId: string
    memberId?: string
    changes: Changes
  }
  "invitation.created": { invitationId: string; changes: Changes }
  "invitation.accepted": {
    invitationId: string
    status: string
    changes: Changes
  }
  "invitation.revoked": {
    invitationId: string
    status: string
    changes: Changes
  }
  "model.created": {
    modelId: string
    source: string
    templateKey?: string | null
    locale?: string
    seeded?: boolean
    name: string
    changes: Changes
    count: number
    items: AuditItem[]
  }
  "model.updated": ModelUpdatedPayload
  "model.discarded": {
    modelId: string
    name: string
    changes: Changes
    count: number
    items: AuditItem[]
    suggestionCount: number
    suggestions: AuditSuggestionItem[]
  }
  "ai.suggestionConfirmed": AiConfirmedPayload
  "ai.suggestionRejected": {
    suggestionId: string
    kind: string
    changes: Changes
    roleId?: string
    modelId?: string
    criterionId?: string
  }
  "role.created": {
    roleId: string
    familyId?: string
    source?: string
    batchId?: string
    changes: Changes
  }
  "role.updated": {
    roleId: string
    source?: string
    via?: string
    suggestionId?: string
    batchId?: string
    profileClearedByRename?: boolean
    changes: Changes
  }
  "role.archived": {
    roleId: string
    title: string
    trackKey: string
    function: string
    team: string
    familyId: string | null
    viaReconcile?: boolean
    batchId?: string
    anchorRetired: boolean
    changes: Changes
  }
  "rating.change": {
    roleId: string
    criterionId: string
    created: boolean
    changes: Changes
  }
  "band.shift": {
    roleId: string
    cause: BandCause
    changes: Changes
    totalCriteria?: number
  }
  "anchorRole.designated": {
    roleId: string
    computedBand: number | null
    changes: Changes
  }
  "anchorRole.updated": {
    roleId: string
    computedBand?: number | null
    expectedBand?: number
    viaArchive?: boolean
    viaReconcile?: boolean
    batchId?: string
    changes: Changes
  }
  "roleFamily.created": {
    familyId: string
    source?: string
    batchId?: string
    changes: Changes
  }
  "roleFamily.renamed": {
    familyId: string
    source?: string
    batchId?: string
    changes: Changes
  }
  "roleFamily.removed": {
    familyId: string
    name: string
    viaReconcile?: boolean
    batchId?: string
    changes: Changes
    count: number
    items: AuditItem[]
  }
  "criterion.approved": { criterionId: string; modelId: string }
  "criterion.reopened": { criterionId: string; modelId: string }
  "person.created": { personId: string; changes: Changes }
  "person.updated": { personId: string; changes: Changes }
  "person.archived": { personId: string; changes: Changes }
  // GDPR: no name/email in the erased payload; personId is the internal key only.
  "person.erased": { personId: string; changes: Changes }
  "assignment.set": { personId: string; roleId: string; changes: Changes }
  "classification.suggested": {
    suggested: number
    skipped: number
    unmatchedTitles: number
  }
  "pay.salarySet": { personId: string; changes: Changes }
  "pay.mappingSaved": { orgId: string; changes: Changes }
  "people.imported": {
    peopleCreated: number
    peopleUpdated: number
    salariesImported: number
    skippedRows: number
  }
}

// Admin audit payloads, keyed 1:1 by every PLATFORM_AUDIT_EVENTS value. Also
// heterogeneous per event; IDs/codes only, never PII (so erasure leaves no
// trace beyond the anonymized actorName snapshot).
export interface PlatformAuditPayloads {
  "platform.userCreated": Record<string, never>
  "platform.userDeleted": { orgCount: number }
  "platform.orgCreated": Record<string, never>
  "platform.orgUpdated": { changes: Changes }
  "platform.membershipGranted": { role: string }
  "platform.membershipRoleChanged": { from: string; to: string }
  "platform.membershipRevoked": Record<string, never>
  "platform.adminGranted": Record<string, never>
  "platform.adminRevoked": Record<string, never>
}

// Compile-time guards: every AUDIT_EVENTS / PLATFORM_AUDIT_EVENTS value has a
// payload entry, and no extra keys exist. These fail tsc if the maps drift
// from the event vocabularies.
type _AuditKeysCoverEvents = AuditEvent extends keyof AuditPayloads
  ? true
  : never
type _AuditKeysNoExtra = keyof AuditPayloads extends AuditEvent ? true : never
type _PlatformKeysCoverEvents =
  PlatformAuditEvent extends keyof PlatformAuditPayloads ? true : never
type _PlatformKeysNoExtra =
  keyof PlatformAuditPayloads extends PlatformAuditEvent ? true : never
const _auditCoverage: _AuditKeysCoverEvents = true
const _auditNoExtra: _AuditKeysNoExtra = true
const _platformCoverage: _PlatformKeysCoverEvents = true
const _platformNoExtra: _PlatformKeysNoExtra = true
void _auditCoverage
void _auditNoExtra
void _platformCoverage
void _platformNoExtra
