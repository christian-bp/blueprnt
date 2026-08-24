import type { ActionTargetKind } from "../payMapping/tables"
import type { AuditEvent, PlatformAuditEvent } from "./audit"

// Typed payload contracts for the audit-log writers. These constrain the
// ENVELOPE of each event's payload (which keys/shape per event); they never
// reduce what the diff engine (buildChanges/snapshots/logLevelShifts) captures.
// Every field's { from, to }, create/delete snapshots, positional anchors diff,
// bulk items[].changes, moves[], provenance meta, and level.shift cause+changes
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
// beyond the common id/label/changes shape (e.g. removal items carry only
// roleId/changes).
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

// What triggered a level.shift: the domain event plus the role/criterion/entity
// it touched, so a shift can be traced back to what moved it.
export type LevelCause = {
  event: AuditEvent
  roleId?: string
  criterionId?: string
  entityId?: string
}

// model.updated is heterogeneous, keyed on `change` (whole-allocation
// rebalance, compliance edit, weight motivation). Criterion
// activation/deactivation carry their own top-level events
// (criterion.activated/criterion.deactivated) instead of a `change` variant
// here, now that they are library selections rather than text edits.
// Discriminated so per-variant fields (budget/items) stay required on their own
// variant.
export type ModelUpdatedPayload =
  | {
      change: "weights.rebalanced"
      modelId: string
      budget: number
      count: number
      items: AuditItem[]
    }
  | {
      change: "criterion.complianceUpdated"
      criterionId: string
      modelId: string
      changes: Changes
    }
  | {
      change: "criterion.weightMotivationUpdated"
      criterionId: string
      modelId: string
      changes: Changes
    }

// ai.suggestionConfirmed is heterogeneous, keyed on `kind`: the three
// suggestion kinds with a confirm path (role-profile AI applies log
// role.updated instead, so there is no role-kind variant here).
// Discriminated so each kind's distinct fields stay required. The model kind
// carries modelId so the row stays attributable to its entity forever (a row
// written without the id can never be backfilled); rendering drops any "*Id"
// key, so no label is needed.
export type AiConfirmedPayload =
  | {
      suggestionId: string
      kind: "model.weightReview"
      modelId: string
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
      kind: "starter.import"
      familyCount: number
      roleCount: number
      families: unknown[]
    }
  | {
      suggestionId: string
      kind: "role.import"
      familyCount: number
      roleCount: number
      skippedCount: number
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
    // Every model now seeds from the library's default (interactive or dev
    // seed); "default" is the only value produced, kept as a string (not
    // narrowed to a literal) so a future creation path is a type-compatible
    // addition, not a breaking one.
    source: string
    locale?: string
    seeded?: boolean
    name: string
    changes: Changes
    count: number
    items: AuditItem[]
  }
  "model.updated": ModelUpdatedPayload
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
  "level.shift": {
    roleId: string
    cause: LevelCause
    changes: Changes
    totalCriteria?: number
  }
  "anchorRole.designated": {
    roleId: string
    computedLevel: number | null
    changes: Changes
  }
  "anchorRole.updated": {
    roleId: string
    computedLevel?: number | null
    expectedLevel?: number
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
  // libraryKey and dimensionKey are coded values: rendered through
  // resolveCodedValue (apps/dashboard/lib/audit-detail.tsx), never as the raw
  // key. weightPoints is always the neutral entry value (3; ADR-0004).
  "criterion.activated": {
    criterionId: string
    modelId: string
    libraryKey: string
    dimensionKey: string
    weightPoints: number
  }
  "criterion.deactivated": {
    criterionId: string
    modelId: string
    libraryKey: string
    dimensionKey: string
    weightPoints: number
    // Ratings are COUNT-ONLY (never a value or note; Role != Person).
    deletedRatingCount: number
    // The point budget's own before/after (it shrinks by 3). A `changes` map
    // rather than a top-level object: the cell and the sheet render diffs from
    // `changes` and flat stats from top-level SCALARS, so an object at the top
    // level reaches neither.
    changes: Changes
    // Survivors whose weight was repaired onto the shrunken budget.
    count: number
    items: AuditItem[]
  }
  // Flat stats only (ADR-0023): the twelve checks themselves are re-derivable
  // live from current state (validateMethod), so the approval row need not
  // carry a changes diff, only how many criteria and checks it covered, plus
  // a dimension-shares snapshot (each a rounded percentage 0-100, flattened
  // to scalar fields so the flat-stats renderer picks them up).
  "model.approved": {
    modelId: string
    criteriaCount: number
    checksPassed: number
    competenceShare: number
    effortShare: number
    responsibilityShare: number
    workingConditionsShare: number
  }
  // `status` is the coded value context field (resolveCodedValue), alongside
  // the changes diff of status/motivation itself (mirrors
  // payMapping.groupAnalysisUpdated's `scope` context field).
  "model.workingConditionsDecided": {
    modelId: string
    status: "active" | "testedNotMaterial"
    changes: Changes
  }
  // levelRules/zoneProfileRules diff as a compact summary STRING per side
  // (e.g. "12 rules, top 97"), never the raw rule arrays: an array-valued
  // changes entry renders as an opaque complexValue placeholder, which would
  // make every rules edit read identically in the log.
  "model.levelRulesUpdated": { modelId: string; changes: Changes }
  "model.zoneProfileRulesUpdated": { modelId: string; changes: Changes }
  // causeEvent is the coded AuditEvent that triggered the reopen (resolved via
  // resolveCodedValue, reusing the dashboard.auditLog.events.* labels rather
  // than inventing new wording). Deliberately NOT named "cause": that key is
  // reserved by PROVENANCE_KEYS for level.shift's nested { event, ... } shape,
  // and this field is a flat string.
  "model.approvalReopened": { modelId: string; causeEvent: string }
  // The restore to the last-approved state (ADR-0023 decision 11). Both halves
  // of the payload come from the ONE diff builder
  // (evaluationModel/evidence.ts) that also feeds the confirm dialog's change
  // list, so the trail and the preview can never disagree: `changes` is the
  // model-level diff (materiality decision, level/zone-profile rules, the
  // rules as compact summary strings for the same reason
  // model.levelRulesUpdated uses them), and `items[]` is one entry per
  // criterion the restore moved. Each item is keyed by libraryKey, not a
  // criterionId: a removed criterion's row is deleted by this same mutation
  // and a returning one has no row yet, so the id would dangle or not exist.
  // A returning/removed criterion diffs `selected`; a removed one also records
  // its deleted ratings as a COUNT only (never a value or note; Role != Person).
  "model.restored": {
    modelId: string
    changes: Changes
    count: number
    items: AuditItem[]
  }
  // Completion lifecycle (ADR-0023, spec 2.4/6): completing is the reveal, and
  // it never wraps in a level.shift (completing and reopening change what
  // getResults exposes, not the underlying derivation), so these three carry
  // only their own marker/stat shape. ratedCount is a flat stat (how many
  // criteria were covered at completion time); reopening carries no extra
  // field (the role subject is enough); the calibration note itself never
  // enters the trail (free-text audit practice), only whether one was given.
  "role.assessmentCompleted": { roleId: string; ratedCount: number }
  "role.assessmentReopened": { roleId: string }
  "role.assessmentCalibrated": { roleId: string; noteProvided: boolean }
  // These three diff the employee's identity values too (ADR-0013), which
  // erasure tombstones via anonymizePersonAuditRows. Keep the shape flat:
  // the scrub walks only the top-level `changes` map, and a nested `items[]`
  // here fails a compile-time assertion in lib/audit.ts.
  "person.created": { personId: string; changes: Changes }
  "person.updated": { personId: string; changes: Changes }
  "person.archived": { personId: string; changes: Changes }
  // GDPR: the row written AT erasure carries no identity value at all (it is
  // built from PERSON_ERASURE_AUDIT_FIELDS); personId is the internal key only.
  "person.erased": { personId: string; changes: Changes }
  "assignment.set": { personId: string; roleId: string; changes: Changes }
  "classification.suggested": {
    suggested: number
    skipped: number
    unmatchedTitles: number
  }
  "pay.salarySet": { personId: string; changes: Changes }
  "pay.salaryDeleted": { personId: string; changes: Changes }
  "pay.mappingSaved": { orgId: string; changes: Changes }
  "people.imported": {
    peopleCreated: number
    peopleUpdated: number
    peopleUnchanged: number
    salariesImported: number
    skippedRows: number
  }
  "payMapping.runStarted": {
    runId: string
    populationCount: number
    withPayCount: number
  }
  "payMapping.groupAnalysisUpdated": {
    runId: string
    scope: "equalWork" | "equivalentWork" | "praxis"
    // The role title for equalWork/equivalentWork; for praxis, the raw
    // PRAXIS_AREA_KEYS area-key slug (never split, it carries no "|").
    // Role-level content either way, never person identity.
    groupLabel: string
    // Set when the row documents ONE equivalent-work comparison: the
    // comparator's role title, so the trail says which difference was
    // explained rather than only which group. Role-level, never person
    // identity, and absent on the group's own row.
    comparisonLabel?: string
    // Set by the bulk fill only: how many comparisons that one click
    // explained. A row per comparison would bury the trail under an action
    // the user experienced as a single decision.
    filledComparisons?: number
    changes: Changes
  }
  "payMapping.runCompleted": {
    runId: string
    equalWorkDone: number
    equivalentWorkDone: number
  }
  "payMapping.runReopened": { runId: string }
  // A rename diffs the run's own display name, which is org content (the pay
  // mapping's title), never person PII.
  "payMapping.runRenamed": { runId: string; changes: Changes }
  // Pure marker payload (mirrors runReopened): the samverkan (collaboration)
  // participants are people's names by design (statutory documentation
  // content), so the trail records ONLY that the field changed, never the
  // participants/description.
  "payMapping.collaborationUpdated": { runId: string }
  // A hard delete: the run's own display name (org content, never person
  // PII) plus the population count at deletion time, mirroring the
  // runStarted precedent's flat-stat shape. runId is excluded from rendering
  // by payloadStats (any "*Id" key), so it never shows as a raw id.
  "payMapping.runDeleted": {
    runId: string
    label: string
    populationCount: number
  }
  // Action/note events (ADR-0015). targetLabel is always GROUP-level display
  // text (the role title), even for person- and comparison-targeted records:
  // a person's name must never enter these payloads (it could not be scrubbed
  // on erasure), so targetKind carries the anchoring instead.
  // The diffs cover structured fields only (ACTION_AUDIT_FIELDS /
  // NOTE_AUDIT_FIELDS): free text, owner, and cost stay out of the trail.
  "payMapping.actionCreated": {
    runId: string
    actionId: string
    targetKind: ActionTargetKind
    targetLabel: string
    changes: Changes
  }
  "payMapping.actionUpdated": {
    runId: string
    actionId: string
    targetLabel: string
    changes: Changes
  }
  "payMapping.actionStatusChanged": {
    runId: string
    actionId: string
    targetLabel: string
    changes: Changes
  }
  "payMapping.actionDeleted": {
    runId: string
    actionId: string
    targetKind: ActionTargetKind
    targetLabel: string
  }
  "payMapping.noteCreated": {
    runId: string
    noteId: string
    targetKind: ActionTargetKind
    targetLabel: string
    noteType: "objectiveReason" | "discussionNeeded" | "noActionNeeded"
  }
  "payMapping.noteUpdated": {
    runId: string
    noteId: string
    targetLabel: string
    changes: Changes
  }
  "payMapping.noteDeleted": {
    runId: string
    noteId: string
    targetKind: ActionTargetKind
    targetLabel: string
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
  "platform.membershipRoleChanged": { changes: Changes }
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
