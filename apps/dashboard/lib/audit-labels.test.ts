import {
  ANCHOR_AUDIT_FIELDS,
  ASSIGNMENT_AUDIT_FIELDS,
  AUDIT_EVENTS,
  CRITERION_AUDIT_FIELDS,
  GROUP_ANALYSIS_AUDIT_FIELDS,
  MODEL_AUDIT_FIELDS,
  PAY_AUDIT_FIELDS,
  PERSON_AUDIT_FIELDS,
  PLATFORM_AUDIT_EVENTS,
  ROLE_CREATE_FIELDS,
  SETTINGS_AUDIT_FIELDS,
} from "@workspace/backend/convex/lib/audit"
import { PAY_GAP_REASONS, PRAXIS_AREA_KEYS } from "@workspace/constants"
import en from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"
import {
  FINDING_VALUE_KEYS,
  PAY_GAP_REASON_VALUE_KEYS,
  PRAXIS_AREA_VALUE_KEYS,
  SCOPE_VALUE_KEYS,
} from "./audit-detail"

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

// Every field an audit payload can carry (in a `changes` diff or as a flat
// stat) MUST have a dashboard.auditLog.fields.* label, or the table cell and
// detail sheet fall back to the raw payload key (the very dump this rendering
// exists to prevent). The backend field-set constants are the source of truth
// for the diff fields; importing them means adding a field to any set without
// its label fails this test instead of shipping a raw key.
//
// The rest are fields not covered by an imported constant: the compliance /
// band-shift / rating diff fields, and the flat-stats event fields
// (people.imported, classification.suggested, platform.*). Kept in sync by hand
// with the writers (evaluationModel/method.ts, engine band.shift, ratings, and
// the flat-stats event payloads in auditPayloads.ts).
const OTHER_AUDIT_FIELDS = [
  // criterion.complianceUpdated (COMPLIANCE_AUDIT_FIELDS in method.ts)
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  // band.shift diffs (assessment/compute.ts FIELDS) + rating.change
  "band",
  "score",
  "complete",
  "ratedCount",
  "value",
  "motivation",
  // ai.suggestionConfirmed model.draft bulk item diffs (ai/suggest.ts)
  "originalWeightPoints",
  "anchorCount",
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
] as const

const ALL_AUDIT_FIELDS = [
  ...new Set<string>([
    ...CRITERION_AUDIT_FIELDS,
    ...ANCHOR_AUDIT_FIELDS,
    ...MODEL_AUDIT_FIELDS,
    ...SETTINGS_AUDIT_FIELDS,
    ...ROLE_CREATE_FIELDS,
    ...PERSON_AUDIT_FIELDS,
    ...PAY_AUDIT_FIELDS,
    ...ASSIGNMENT_AUDIT_FIELDS,
    ...GROUP_ANALYSIS_AUDIT_FIELDS,
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
// audit-detail.tsx's resolveCodedValue is typed (a Record per domain) so an
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
  })

  it("every coded value's i18n key resolves to a real string in en", () => {
    const allKeys = [
      ...Object.values(SCOPE_VALUE_KEYS),
      ...Object.values(FINDING_VALUE_KEYS),
      ...Object.values(PRAXIS_AREA_VALUE_KEYS),
      ...Object.values(PAY_GAP_REASON_VALUE_KEYS),
    ]
    const missing = allKeys.filter(
      (key) => typeof resolveDashboardKey(key) !== "string"
    )
    expect(missing).toEqual([])
  })
})
