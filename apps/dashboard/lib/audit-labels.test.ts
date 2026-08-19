import {
  ACTION_AUDIT_FIELDS,
  ACTION_UPDATE_AUDIT_FIELDS,
  ANCHOR_AUDIT_FIELDS,
  ASSIGNMENT_AUDIT_FIELDS,
  AUDIT_CATEGORIES,
  AUDIT_EVENTS,
  ERASED_FIELD_VALUE,
  GROUP_ANALYSIS_AUDIT_FIELDS,
  NOTE_AUDIT_FIELDS,
  PERSON_IDENTITY_AUDIT_FIELDS,
  MODEL_AUDIT_FIELDS,
  PAY_AUDIT_FIELDS,
  PERSON_AUDIT_FIELDS,
  PLATFORM_AUDIT_CATEGORIES,
  PLATFORM_AUDIT_EVENTS,
  ROLE_CREATE_FIELDS,
  SETTINGS_AUDIT_FIELDS,
} from "@workspace/backend/convex/lib/audit"
import { COMPLIANCE_AUDIT_FIELDS } from "@workspace/backend/convex/evaluationModel/method"
import { ACTION_TARGET_KINDS } from "@workspace/backend/convex/payMapping/tables"
import {
  COUNTRY_KEYS,
  EMPLOYMENT_TYPES,
  INDUSTRY_KEYS,
  PAY_GAP_REASONS,
  PRAXIS_AREA_KEYS,
  SUGGESTION_KINDS,
  TRACK_SENIORITIES,
} from "@workspace/constants"
import en from "@workspace/i18n/messages/en.json"
import { routing } from "@workspace/i18n/routing"
import { describe, expect, it } from "vitest"
import {
  ACTION_PRIORITY_VALUE_KEYS,
  AI_KIND_VALUE_KEYS,
  AUDIT_FILTER_CATEGORIES,
  BIAS_RISK_VALUE_KEYS,
  CAUSE_EVENT_VALUE_KEYS,
  COUNTRY_VALUE_KEYS,
  EMPLOYMENT_TYPE_VALUE_KEYS,
  ERASED_AUDIT_VALUE,
  ERASED_AUDIT_VALUE_FIELDS,
  FINDING_VALUE_KEYS,
  GENDER_VALUE_KEYS,
  INDUSTRY_VALUE_KEYS,
  MEMBER_ROLE_VALUE_KEYS,
  NOTE_TYPE_VALUE_KEYS,
  PAY_GAP_REASON_VALUE_KEYS,
  PLATFORM_AUDIT_FILTER_CATEGORIES,
  PRAXIS_AREA_VALUE_KEYS,
  SALARY_SOURCE_VALUE_KEYS,
  SCOPE_VALUE_KEYS,
  SENIORITY_SOURCE_VALUE_KEYS,
  STATUS_VALUE_KEYS,
  TARGET_KIND_VALUE_KEYS,
  TRACK_VALUE_KEYS,
} from "./audit-constants"
import { LANGUAGE_LABEL_KEYS } from "./locales"

// The audit log renders an event's readable label from i18n and falls back to
// the raw event type when none exists. These tests guard that EVERY audit event
// has a label, so adding an AUDIT_EVENTS value without its i18n string fails CI
// instead of silently showing a raw key like "organization.logoUpdated". The
// key derivation mirrors org-audit-log-section.tsx (camelCase across dots) and
// the admin audit-log section (strip the "platform." prefix). Checking en is
// enough: the i18n parity test guarantees the other locales mirror en's keys.

const orgEventKey = (type: string) =>
  type
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("")

describe("audit log event labels", () => {
  it("every org audit event has a readable label in dashboard.auditLog.events", () => {
    const labels = en.dashboard.auditLog.events as Record<string, string>
    const missing = Object.values(AUDIT_EVENTS).filter(
      (type) => !(orgEventKey(type) in labels)
    )
    expect(missing).toEqual([])
  })

  it("every platform audit event has a label in dashboard.admin.auditLog.events", () => {
    const labels = en.dashboard.admin.auditLog.events as Record<string, string>
    const missing = Object.values(PLATFORM_AUDIT_EVENTS).filter(
      (type) => !(type.replace("platform.", "") in labels)
    )
    expect(missing).toEqual([])
  })
})

// The audit-log toolbars keep their filterable-category lists as local
// literals (bundle-hygiene; see AUDIT_FILTER_CATEGORIES in audit-constants.ts),
// so nothing at compile time ties them to the backend's category vocabulary.
// These tests are that tie: a category added to AUDIT_CATEGORIES /
// PLATFORM_AUDIT_CATEGORIES without its filter option or its
// categories.* label fails here instead of shipping a log that silently
// cannot filter the new area (how the people/pay options were once missed).
describe("audit log category filters", () => {
  it("the org filter list matches the backend AUDIT_CATEGORIES", () => {
    expect([...AUDIT_FILTER_CATEGORIES].sort()).toEqual(
      [...AUDIT_CATEGORIES].sort()
    )
  })

  it("the platform filter list matches the backend PLATFORM_AUDIT_CATEGORIES", () => {
    expect([...PLATFORM_AUDIT_FILTER_CATEGORIES].sort()).toEqual(
      [...PLATFORM_AUDIT_CATEGORIES].sort()
    )
  })

  it("every org category (plus all) has a label in dashboard.auditLog.categories", () => {
    const labels = en.dashboard.auditLog.categories as Record<string, string>
    const missing = ["all", ...AUDIT_CATEGORIES].filter(
      (category) => !(category in labels)
    )
    expect(missing).toEqual([])
  })

  it("every platform category (plus all) has a label in dashboard.admin.auditLog.categories", () => {
    const labels = en.dashboard.admin.auditLog.categories as Record<
      string,
      string
    >
    const missing = ["all", ...PLATFORM_AUDIT_CATEGORIES].filter(
      (category) => !(category in labels)
    )
    expect(missing).toEqual([])
  })
})

// Every field an audit payload can carry (in a `changes` diff or as a flat
// stat) MUST have a dashboard.auditLog.fields.* label, or the table cell and
// detail sheet fall back to the raw payload key (the very dump this rendering
// exists to prevent). The backend field-set constants are the source of truth
// for the diff fields; importing them means adding a field to any set without
// its label fails this test instead of shipping a raw key.
//
// The rest are fields not covered by an imported constant: the compliance /
// level-shift / rating diff fields, and the flat-stats event fields
// (people.imported, classification.suggested, platform.*). Kept in sync by hand
// with the writers (evaluationModel/method.ts, engine level.shift, ratings, and
// the flat-stats event payloads in auditPayloads.ts).
const OTHER_AUDIT_FIELDS = [
  // criterion.activated/criterion.deactivated flat-stat fields (criteria.ts).
  // libraryKey/dimensionKey are coded values (resolved via
  // criteriaLibraryContent, not a dashboard.auditLog.values.* Record), but
  // they still need a FIELD label like every other payload key.
  "libraryKey",
  "dimensionKey",
  "deletedRatingCount",
  "budget",
  // model.created create-changes (MODEL_AUDIT_FIELDS also has "name", already
  // covered by the person/role "name" field above).
  "levelRules",
  // model.zoneProfileRulesUpdated diff field (evaluationModel/approval.ts).
  "zoneProfileRules",
  // model.approved flat-stat fields (evaluationModel/approval.ts).
  "criteriaCount",
  "checksPassed",
  // model.approvalReopened flat-stat field (evaluationModel/approval.ts):
  // a coded AuditEvent value (resolved via resolveCodedValue's
  // CAUSE_EVENT_VALUE_KEYS domain, not a dashboard.auditLog.values.* Record),
  // but it still needs a FIELD label like every other payload key.
  "causeEvent",
  // level.shift diffs (assessment/compute.ts FIELDS) + rating.change
  "level",
  "score",
  "complete",
  "ratedCount",
  "value",
  "motivation",
  // ai.suggestionConfirmed model.weightReview flat-stat fields
  // (auditPayloads.ts AiConfirmedPayload). These render through
  // payloadStats/StatList, so an unlabelled one prints its raw payload key.
  "appliedCount",
  "totalMoves",
  // member.* / invitation.* / platform.membership* / organization.created scalars
  "role",
  "status",
  "expiresAt",
  "onboardingCompletedAt",
  "orgId",
  // flat-stats event fields
  "peopleCreated",
  "peopleUpdated",
  "peopleUnchanged",
  "salariesImported",
  "skippedRows",
  "suggested",
  "skipped",
  "unmatchedTitles",
  "orgCount",
  // payMapping.runStarted flat-stat fields (label also covers runDeleted)
  "populationCount",
  "withPayCount",
  "label",
  // payMapping.groupAnalysisUpdated flat (non-diffed) payload fields
  "groupLabel",
  "scope",
  // payMapping.runCompleted flat-stat fields
  "equalWorkDone",
  "equivalentWorkDone",
  // payMapping.action*/note* flat (non-diffed) payload fields
  "targetKind",
  "targetLabel",
  // ai.suggestionConfirmed flat-stat fields (the import kinds). These render
  // through payloadStats/StatList, not a `changes` diff, so without a label
  // the sheet printed the raw payload keys.
  "kind",
  "familyCount",
  "roleCount",
  "skippedCount",
] as const

const ALL_AUDIT_FIELDS = [
  ...new Set<string>([
    ...COMPLIANCE_AUDIT_FIELDS,
    ...ANCHOR_AUDIT_FIELDS,
    ...MODEL_AUDIT_FIELDS,
    ...SETTINGS_AUDIT_FIELDS,
    ...ROLE_CREATE_FIELDS,
    ...PERSON_AUDIT_FIELDS,
    ...PAY_AUDIT_FIELDS,
    ...ASSIGNMENT_AUDIT_FIELDS,
    ...GROUP_ANALYSIS_AUDIT_FIELDS,
    ...ACTION_AUDIT_FIELDS,
    ...ACTION_UPDATE_AUDIT_FIELDS,
    ...NOTE_AUDIT_FIELDS,
    ...OTHER_AUDIT_FIELDS,
  ]),
]

describe("audit log field labels", () => {
  it("every audit diff and stat field has a label in dashboard.auditLog.fields", () => {
    const fields = en.dashboard.auditLog.fields as Record<string, string>
    const missing = ALL_AUDIT_FIELDS.filter((field) => !(field in fields))
    expect(missing).toEqual([])
  })
})

// A payload field whose VALUE is a coded/enum string (a scope, a praxis
// finding, a praxis area key, a pay-gap reason) must resolve to a localized
// label too, never render the raw wire code (e.g. "payPolicy (Vy: praxis)"
// or "Bedömning: none -> found" in the live log).
// audit-constants.ts's resolveCodedValue is typed (a Record per domain) so an
// unmapped VALUE is a compile error; this test is the "test failure" half of
// that guard, mirroring the field-label coverage above: it walks each
// *_VALUE_KEYS Record's i18n key (relative to `dashboard`) and fails if the
// key has no string in en (the other locales are covered by the i18n parity
// test). The scope/finding wire unions are not exported as shared types
// (they are inline validators in payMapping/analyses.ts's scopeValidator and
// payMapping/tables.ts's payMappingFindingValidator), so PAY_MAPPING_SCOPES/
// PAY_MAPPING_FINDINGS below are kept in sync by hand with those two, the
// same convention OTHER_AUDIT_FIELDS above already uses.
const PAY_MAPPING_SCOPES = ["equalWork", "equivalentWork", "praxis"] as const
const PAY_MAPPING_FINDINGS = ["none", "found"] as const
// The non-pay-mapping coded domains, mirrored from their backend validators
// by the same hand-synced convention: assignment senioritySource
// (people/tables.ts), org member roles (lib/functions.ts scopes), the shared
// `status` union (Better Auth invitations + suggestions + anchor
// designations), salary source (people/pay.ts), and the fixed V1 tracks.
const SENIORITY_SOURCES = ["suggested", "confirmed"] as const
const MEMBER_ROLES = ["admin", "editor"] as const
const AUDIT_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "generating",
  "suggested",
  "confirmed",
  "failed",
  "active",
  "underReview",
  "replaced",
  "notStarted",
  "inProgress",
  "done",
  "testedNotMaterial",
] as const
// model.approvalReopened `causeEvent` (evaluationModel/approval.ts's
// reopenApprovalIfSet), mirrored by hand from its six wiring call sites.
const APPROVAL_REOPEN_CAUSES = [
  "criterion.activated",
  "criterion.deactivated",
  "model.updated",
  "model.workingConditionsDecided",
  "model.levelRulesUpdated",
  "model.zoneProfileRulesUpdated",
] as const
// payMapping.action*/note* domains (payMapping/tables.ts validators).
// ACTION_TARGET_KINDS is imported from there rather than restated: a local
// copy went stale through the pair-to-comparison rename and the guard below
// compared two equally-stale lists, so it passed while the audit log showed
// the raw code.
const ACTION_PRIORITIES = ["high", "medium", "low"] as const
const NOTE_TYPES = [
  "objectiveReason",
  "discussionNeeded",
  "noActionNeeded",
] as const
const SALARY_SOURCES = ["import", "manual"] as const
const BIAS_RISKS = ["low", "medium", "high"] as const
// person.* `gender` (the Swedish wire codes on the people table).
const PERSON_GENDERS = ["Man", "Kvinna"] as const

function resolveDashboardKey(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en.dashboard
    )
}

describe("audit log value labels", () => {
  it("every *_VALUE_KEYS domain covers exactly its backend wire values (no value silently unmapped)", () => {
    expect(Object.keys(SCOPE_VALUE_KEYS).sort()).toEqual(
      [...PAY_MAPPING_SCOPES].sort()
    )
    expect(Object.keys(FINDING_VALUE_KEYS).sort()).toEqual(
      [...PAY_MAPPING_FINDINGS].sort()
    )
    expect(Object.keys(PRAXIS_AREA_VALUE_KEYS).sort()).toEqual(
      [...PRAXIS_AREA_KEYS].sort()
    )
    expect(Object.keys(PAY_GAP_REASON_VALUE_KEYS).sort()).toEqual(
      [...PAY_GAP_REASONS].sort()
    )
    expect(Object.keys(SENIORITY_SOURCE_VALUE_KEYS).sort()).toEqual(
      [...SENIORITY_SOURCES].sort()
    )
    expect(Object.keys(MEMBER_ROLE_VALUE_KEYS).sort()).toEqual(
      [...MEMBER_ROLES].sort()
    )
    expect(Object.keys(STATUS_VALUE_KEYS).sort()).toEqual(
      [...AUDIT_STATUSES].sort()
    )
    expect(Object.keys(ACTION_PRIORITY_VALUE_KEYS).sort()).toEqual(
      [...ACTION_PRIORITIES].sort()
    )
    expect(Object.keys(NOTE_TYPE_VALUE_KEYS).sort()).toEqual(
      [...NOTE_TYPES].sort()
    )
    expect(Object.keys(TARGET_KIND_VALUE_KEYS).sort()).toEqual(
      [...ACTION_TARGET_KINDS].sort()
    )
    expect(Object.keys(COUNTRY_VALUE_KEYS).sort()).toEqual(
      [...COUNTRY_KEYS].sort()
    )
    expect(Object.keys(LANGUAGE_LABEL_KEYS).sort()).toEqual(
      [...routing.locales].sort()
    )
    expect(Object.keys(BIAS_RISK_VALUE_KEYS).sort()).toEqual(
      [...BIAS_RISKS].sort()
    )
    expect(Object.keys(EMPLOYMENT_TYPE_VALUE_KEYS).sort()).toEqual(
      [...EMPLOYMENT_TYPES].sort()
    )
    expect(Object.keys(GENDER_VALUE_KEYS).sort()).toEqual(
      [...PERSON_GENDERS].sort()
    )
    expect(Object.keys(INDUSTRY_VALUE_KEYS).sort()).toEqual(
      [...INDUSTRY_KEYS].sort()
    )
    expect(Object.keys(SALARY_SOURCE_VALUE_KEYS).sort()).toEqual(
      [...SALARY_SOURCES].sort()
    )
    expect(Object.keys(TRACK_VALUE_KEYS).sort()).toEqual(
      Object.keys(TRACK_SENIORITIES).sort()
    )
    expect(Object.keys(AI_KIND_VALUE_KEYS).sort()).toEqual(
      Object.values(SUGGESTION_KINDS).sort()
    )
    expect(Object.keys(CAUSE_EVENT_VALUE_KEYS).sort()).toEqual(
      [...APPROVAL_REOPEN_CAUSES].sort()
    )
  })

  it("every coded value's i18n key resolves to a real string in en", () => {
    const allKeys = [
      ...Object.values(SCOPE_VALUE_KEYS),
      ...Object.values(FINDING_VALUE_KEYS),
      ...Object.values(PRAXIS_AREA_VALUE_KEYS),
      ...Object.values(PAY_GAP_REASON_VALUE_KEYS),
      ...Object.values(SENIORITY_SOURCE_VALUE_KEYS),
      ...Object.values(MEMBER_ROLE_VALUE_KEYS),
      ...Object.values(STATUS_VALUE_KEYS),
      ...Object.values(COUNTRY_VALUE_KEYS),
      ...Object.values(LANGUAGE_LABEL_KEYS),
      ...Object.values(BIAS_RISK_VALUE_KEYS),
      ...Object.values(EMPLOYMENT_TYPE_VALUE_KEYS),
      ...Object.values(GENDER_VALUE_KEYS),
      ...Object.values(INDUSTRY_VALUE_KEYS),
      ...Object.values(SALARY_SOURCE_VALUE_KEYS),
      ...Object.values(TRACK_VALUE_KEYS),
      ...Object.values(AI_KIND_VALUE_KEYS),
      ...Object.values(CAUSE_EVENT_VALUE_KEYS),
    ]
    const missing = allKeys.filter(
      (key) => typeof resolveDashboardKey(key) !== "string"
    )
    expect(missing).toEqual([])
  })
})

// When a person is erased, the backend rewrites their identity values in the
// retained trail to ERASED_FIELD_VALUE (ADR-0013). The frontend mirrors that
// constant to render it as a localized marker instead of the bare word, the same
// mirroring convention (and drift guard) as AUDIT_FILTER_CATEGORIES above.
describe("erased-value marker", () => {
  it("mirrors the backend tombstone", () => {
    expect(ERASED_AUDIT_VALUE).toBe(ERASED_FIELD_VALUE)
  })

  it("mirrors exactly the backend's identity field set", () => {
    // The marker only resolves on these fields, so a field the backend starts
    // tombstoning without adding it here would render the bare word "erased".
    expect([...ERASED_AUDIT_VALUE_FIELDS].sort()).toEqual(
      [...PERSON_IDENTITY_AUDIT_FIELDS].sort()
    )
  })

  it("has a localized label", () => {
    expect(typeof resolveDashboardKey("auditLog.values.erased")).toBe("string")
  })
})
