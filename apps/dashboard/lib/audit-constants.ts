import type {
  CountryKey,
  EmploymentType,
  IndustryKey,
  PayGapReason,
  PraxisAreaKey,
  SuggestionKind,
  TRACK_SENIORITIES,
} from "@workspace/constants"
import { LANGUAGE_LABEL_KEYS } from "@/lib/locales"

// The audit log's display vocabulary: the toolbar filter-category lists, the
// coded-value label maps (wire value -> dashboard-relative i18n key), and the
// epoch-ms field set. Pure data, no rendering: the formatters in
// audit-detail.tsx and the two audit-log sections consume it. App-side by
// design (never @workspace/constants): these maps encode presentation
// (dashboard.* i18n key paths), which the shared domain package must not
// know about.

// The filterable categories the two audit-log toolbars offer, mirroring the
// backend's AUDIT_CATEGORIES / PLATFORM_AUDIT_CATEGORIES (lib/audit.ts). Kept
// as local literals rather than importing the backend constants so the client
// bundle stays free of backend internals; the coverage test in
// audit-labels.test.ts imports both sides and fails on any drift, so a
// category added to the backend without its filter option (and its
// dashboard.auditLog.categories.* label) cannot ship silently again (the
// people/pay filter options were once missed exactly this way).
export const AUDIT_FILTER_CATEGORIES = [
  "model",
  "role",
  "organization",
  "member",
  "ai",
  "people",
  "pay",
] as const

export const PLATFORM_AUDIT_FILTER_CATEGORIES = [
  "user",
  "organization",
  "membership",
  "admin",
] as const

// The domains of coded/enum VALUES an audit payload can carry (never free
// text, an id, or a boolean, which are handled elsewhere). Each Record is
// typed against the domain's own literal union (imported from
// @workspace/constants where one is exported; the rest mirror their backend
// validators, kept in sync by hand, with the audit-labels tests as the drift
// guard), so a value added to any domain without also giving it an i18n key
// here is a compile error, never a silently-unmapped raw code. Every key is
// relative to the `dashboard` message namespace and REUSES existing dashboard
// domain copy wherever the concept already has a real label (the audit log is
// not the place to invent new wording); only wording that exists nowhere else
// lives under dashboard.auditLog.values.*. Callers resolve keys with a
// `dashboard`-scoped translator, not the `dashboard.auditLog`-scoped one used
// for field labels.

// payMapping.groupAnalysisUpdated `scope` and `finding` (their unions mirror
// payMapping/analyses.ts's scopeValidator and payMapping/tables.ts's
// payMappingFindingValidator, which are not exported as shared types).
type PayMappingScope = "equalWork" | "equivalentWork" | "praxis"
type PayMappingFinding = "none" | "found"

export const SCOPE_VALUE_KEYS: Record<PayMappingScope, string> = {
  equalWork: "payMapping.review.chapters.equalWork",
  equivalentWork: "payMapping.review.chapters.equivalentWork",
  praxis: "payMapping.review.chapters.praxis",
}

export const FINDING_VALUE_KEYS: Record<PayMappingFinding, string> = {
  none: "payMapping.review.findingNone",
  found: "payMapping.review.findingFound",
}

// payMapping.groupAnalysisUpdated `groupLabel` when the row documents a
// praxis review area (an equalWork/equivalentWork row's groupLabel is already
// a "roleTitle · seniority" display string and resolves to nothing here).
export const PRAXIS_AREA_VALUE_KEYS: Record<PraxisAreaKey, string> = {
  payPolicy: "payMapping.review.praxis.payPolicy.title",
  collectiveAgreements: "payMapping.review.praxis.collectiveAgreements.title",
  benefits: "payMapping.review.praxis.benefits.title",
  payPractices: "payMapping.review.praxis.payPractices.title",
  previousActions: "payMapping.review.praxis.previousActions.title",
}

// payMapping.groupAnalysisUpdated `reasons`: a ", "-joined token list (the
// auditView joins the array into one display string), so resolveCodedValue
// resolves it token by token instead of through CODED_FIELD_DOMAINS.
export const PAY_GAP_REASON_VALUE_KEYS: Record<PayGapReason, string> = {
  alternativeLabourMarket: "payMapping.reasons.alternativeLabourMarket",
  recruitmentPayLevel: "payMapping.reasons.recruitmentPayLevel",
  experience: "payMapping.reasons.experience",
  historicalPay: "payMapping.reasons.historicalPay",
  competence: "payMapping.reasons.competence",
  performance: "payMapping.reasons.performance",
  responsibility: "payMapping.reasons.responsibility",
}

// payMapping.action* `priority` (mirrors payMapping/tables.ts's
// payMappingActionPriorityValidator), labeled where the action surfaces
// label it.
type ActionPriority = "high" | "medium" | "low"
export const ACTION_PRIORITY_VALUE_KEYS: Record<ActionPriority, string> = {
  high: "payMapping.actions.priority.high",
  medium: "payMapping.actions.priority.medium",
  low: "payMapping.actions.priority.low",
}

// payMapping.note* `noteType` (mirrors payMappingNoteTypeValidator).
type NoteType = "objectiveReason" | "discussionNeeded" | "noActionNeeded"
export const NOTE_TYPE_VALUE_KEYS: Record<NoteType, string> = {
  objectiveReason: "payMapping.actions.noteType.objectiveReason",
  discussionNeeded: "payMapping.actions.noteType.discussionNeeded",
  noActionNeeded: "payMapping.actions.noteType.noActionNeeded",
}

// payMapping.action*/note* `targetKind` (mirrors actionTargetValidator's
// kind literals): what the record is anchored to.
type ActionTargetKind = "group" | "person" | "pair"
export const TARGET_KIND_VALUE_KEYS: Record<ActionTargetKind, string> = {
  group: "payMapping.actions.targetKind.group",
  person: "payMapping.actions.targetKind.person",
  pair: "payMapping.actions.targetKind.pair",
}

// assignment.set `senioritySource`: the same concept the people register's
// "Suggested" badge and the classify state badge already name.
type SenioritySource = "suggested" | "confirmed"
export const SENIORITY_SOURCE_VALUE_KEYS: Record<SenioritySource, string> = {
  suggested: "people.suggestedBadge",
  confirmed: "classify.state.confirmed",
}

// member.*/invitation.* (and platform.membership*) `role`: the org member
// roles, labeled where the members table already labels them.
type MemberRole = "admin" | "editor"
export const MEMBER_ROLE_VALUE_KEYS: Record<MemberRole, string> = {
  admin: "organization.members.roleAdmin",
  editor: "organization.members.roleEditor",
}

// The `status` field is shared by three writers, so this domain is their
// union: invitation lifecycle (Better Auth: pending/accepted/rejected/
// canceled, accounts/mirrors.ts), suggestion lifecycle (shared/tables.ts:
// generating/suggested/confirmed/rejected/failed; also the dropped-
// suggestions list), anchor designation (assessment/tables.ts:
// active/underReview/replaced), and the action lifecycle
// (payMapping/tables.ts: notStarted/inProgress/done).
type AuditStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "canceled"
  | "generating"
  | "suggested"
  | "confirmed"
  | "failed"
  | "active"
  | "underReview"
  | "replaced"
  | "notStarted"
  | "inProgress"
  | "done"
export const STATUS_VALUE_KEYS: Record<AuditStatus, string> = {
  pending: "organization.members.pending",
  accepted: "auditLog.values.status.accepted",
  rejected: "auditLog.values.status.rejected",
  canceled: "auditLog.values.status.canceled",
  generating: "auditLog.values.status.generating",
  suggested: "people.suggestedBadge",
  confirmed: "classify.state.confirmed",
  failed: "auditLog.values.status.failed",
  active: "roles.anchor.statusActive",
  underReview: "roles.anchor.statusUnderReview",
  replaced: "roles.anchor.statusReplaced",
  notStarted: "payMapping.actions.status.notStarted",
  inProgress: "payMapping.actions.status.inProgress",
  done: "payMapping.actions.status.done",
}

// organization/person `country`: the onboarding country select's labels.
// The org settings store the lowercase CountryKey; a person's country is an
// imported uppercase ISO alpha-2 string, so resolveCodedValue lowercases
// country values before this lookup (an ISO code outside the key set falls
// back to its raw value).
export const COUNTRY_VALUE_KEYS: Record<CountryKey, string> = {
  se: "onboarding.profile.countries.se",
  no: "onboarding.profile.countries.no",
  dk: "onboarding.profile.countries.dk",
  fi: "onboarding.profile.countries.fi",
  other: "onboarding.profile.countries.other",
}

// organization `industry`: the onboarding industry select's labels.
export const INDUSTRY_VALUE_KEYS: Record<IndustryKey, string> = {
  publicSector: "onboarding.profile.industries.publicSector",
  manufacturing: "onboarding.profile.industries.manufacturing",
  consulting: "onboarding.profile.industries.consulting",
  retail: "onboarding.profile.industries.retail",
  itTelecom: "onboarding.profile.industries.itTelecom",
  healthcare: "onboarding.profile.industries.healthcare",
  finance: "onboarding.profile.industries.finance",
  realEstateConstruction:
    "onboarding.profile.industries.realEstateConstruction",
  other: "onboarding.profile.industries.other",
}

// criterion.complianceUpdated `biasRisk` (evaluationModel/method.ts's
// biasRiskValidator): the method surface's own option labels.
type BiasRisk = "low" | "medium" | "high"
export const BIAS_RISK_VALUE_KEYS: Record<BiasRisk, string> = {
  low: "model.method.biasRiskOption.low",
  medium: "model.method.biasRiskOption.medium",
  high: "model.method.biasRiskOption.high",
}

// person.* `employmentType` (people/tables.ts, mirroring EMPLOYMENT_TYPES):
// no other surface labels these values yet, so the wording lives under
// auditLog.values (machine-drafted for nb/da/fi, flagged for native review).
export const EMPLOYMENT_TYPE_VALUE_KEYS: Record<EmploymentType, string> = {
  permanent: "auditLog.values.employmentType.permanent",
  fixedTerm: "auditLog.values.employmentType.fixedTerm",
  substitute: "auditLog.values.employmentType.substitute",
  hourly: "auditLog.values.employmentType.hourly",
}

// person.* `gender` (people/tables.ts: the Swedish wire codes Man|Kvinna),
// labeled where the people register already labels them, so the audit diff
// reads "Gender: Man -> Woman" and never the raw "Kvinna".
type PersonGender = "Man" | "Kvinna"
export const GENDER_VALUE_KEYS: Record<PersonGender, string> = {
  Man: "people.gender.Man",
  Kvinna: "people.gender.Kvinna",
}

// pay.salarySet/salaryDeleted `source` (people/pay.ts: import|manual). Only
// the pay diffs carry `source` INSIDE changes; the top-level provenance
// `source` renders through detail.provenance.sourceValues instead.
type SalarySource = "import" | "manual"
export const SALARY_SOURCE_VALUE_KEYS: Record<SalarySource, string> = {
  import: "auditLog.values.source.import",
  manual: "auditLog.values.source.manual",
}

// role `trackKey`: the fixed V1 tracks (ADR-0006). The labels are the same
// in every locale by design (the Nordic convention keeps these English), but
// they still live in i18n like every other displayed string.
export const TRACK_VALUE_KEYS: Record<keyof typeof TRACK_SENIORITIES, string> =
  {
    IC: "auditLog.values.tracks.IC",
    Lead: "auditLog.values.tracks.Lead",
    M: "auditLog.values.tracks.M",
  }

// Maps "model.draft" -> "modelDraft", etc., for i18n keys
// (auditLog.ai.kind.<key>). Typed by SuggestionKind and total, so a kind added
// to SUGGESTION_KINDS without a label here is a compile error rather than a
// blank audit detail.
export const AI_KIND_KEY: Record<SuggestionKind, string> = {
  "model.draft": "modelDraft",
  "model.weightReview": "weightReview",
  "role.profile": "roleProfile",
  "starter.import": "starterImport",
  "criterion.compliance": "criterionCompliance",
  "role.import": "roleImport",
}

// ai.suggestionConfirmed / ai.suggestionRejected `kind`: the payload field
// carries a raw wire code ("role.import"), which the flat-stats renderer would
// otherwise print verbatim. Derived from AI_KIND_KEY so the coded-value path
// and the AI panels' own labels can never drift, and reusing the existing
// auditLog.ai.kind.* wording rather than a parallel auditLog.values.* set.
export const AI_KIND_VALUE_KEYS: Record<SuggestionKind, string> =
  Object.fromEntries(
    Object.entries(AI_KIND_KEY).map(([kind, key]) => [
      kind,
      `auditLog.ai.kind.${key}`,
    ])
  ) as Record<SuggestionKind, string>

// Field name -> its coded domain's value-key Record. One lookup table so
// resolveCodedValue stays a two-liner as domains accrue; `reasons` is
// special-cased inside resolveCodedValue (its value is a ", "-joined token
// list, not one code).
const CODED_FIELD_DOMAINS: Record<string, Record<string, string>> = {
  scope: SCOPE_VALUE_KEYS,
  finding: FINDING_VALUE_KEYS,
  groupLabel: PRAXIS_AREA_VALUE_KEYS,
  senioritySource: SENIORITY_SOURCE_VALUE_KEYS,
  role: MEMBER_ROLE_VALUE_KEYS,
  status: STATUS_VALUE_KEYS,
  country: COUNTRY_VALUE_KEYS,
  language: LANGUAGE_LABEL_KEYS,
  industry: INDUSTRY_VALUE_KEYS,
  biasRisk: BIAS_RISK_VALUE_KEYS,
  employmentType: EMPLOYMENT_TYPE_VALUE_KEYS,
  gender: GENDER_VALUE_KEYS,
  source: SALARY_SOURCE_VALUE_KEYS,
  trackKey: TRACK_VALUE_KEYS,
  kind: AI_KIND_VALUE_KEYS,
  priority: ACTION_PRIORITY_VALUE_KEYS,
  noteType: NOTE_TYPE_VALUE_KEYS,
  targetKind: TARGET_KIND_VALUE_KEYS,
  reason: PAY_GAP_REASON_VALUE_KEYS,
}

// The tombstone the backend writes over an erased person's identity values in
// the retained audit trail (ERASED_FIELD_VALUE in lib/audit.ts, ADR-0013), and
// the fields that can carry it (PERSON_IDENTITY_AUDIT_FIELDS). Both mirrored
// here rather than imported, like AUDIT_FILTER_CATEGORIES above, with
// audit-labels.test.ts as the drift guard.
//
// A scrubbed row must read "Name: Erased", never the bare word "erased", which
// would be indistinguishable from a value someone typed. resolveCodedValue
// therefore answers the tombstone before the per-field domains, but only for
// these fields: the marker is a real English word, so resolving it on ANY field
// would relabel a department, role family, or note that a customer legitimately
// named "erased" as scrubbed data. (`title` is shared with a role's title, so
// that one field keeps the false positive; a role named "erased" is not a case
// worth more machinery than this comment.)
export const ERASED_AUDIT_VALUE = "erased"

export const ERASED_AUDIT_VALUE_FIELDS: ReadonlySet<string> = new Set([
  "displayName",
  "gender",
  "externalRef",
  "birthDate",
  "title",
])

// Resolves one payload field's raw coded VALUE to its localized label, via
// the caller's `translate` (typically a t.has-guarded lookup against a
// `dashboard`-scoped translator). Returns undefined when the field carries no
// coded domain (free text, ids, booleans), the value is not a known member of
// its domain (e.g. `groupLabel` for an equalWork/equivalentWork row, which is
// already a "roleTitle · seniority" display string, not a praxis area key), or
// the translator has no string for the resolved key: in any of those cases
// the caller falls back to the raw value rather than throwing or rendering
// nothing.
export function resolveCodedValue(
  field: string,
  value: string,
  translate: (key: string) => string | undefined
): string | undefined {
  if (value === ERASED_AUDIT_VALUE && ERASED_AUDIT_VALUE_FIELDS.has(field)) {
    return translate("auditLog.values.erased")
  }
  if (field === "reasons") {
    if (value.trim() === "") return undefined
    return value
      .split(", ")
      .map((token) => {
        const key = (PAY_GAP_REASON_VALUE_KEYS as Record<string, string>)[token]
        return (key ? translate(key) : undefined) ?? token
      })
      .join(", ")
  }
  // Person rows carry uppercase ISO country codes; the org stores the
  // lowercase CountryKey the domain map is keyed on.
  const lookup = field === "country" ? value.toLowerCase() : value
  const key = (
    CODED_FIELD_DOMAINS[field] as Record<string, string> | undefined
  )?.[lookup]
  return key ? translate(key) : undefined
}

// Epoch-ms payload fields (person archivedAt, anchor reviewedAt, invitation
// expiresAt, onboarding onboardingCompletedAt): a raw millisecond count must
// never render, the same rule as a raw wire code. formatChanges/changeEntries
// format them via the injected dateLabel.
export const AUDIT_DATE_FIELDS: ReadonlySet<string> = new Set([
  "archivedAt",
  "reviewedAt",
  "expiresAt",
  "onboardingCompletedAt",
])

// ISO-date-string payload fields (person employmentStartDate, birthDate,
// action plannedDate): localized through the same dateLabel, so one sheet
// never mixes "2024-01-15" with "Jan 15, 2024".
export const AUDIT_ISO_DATE_FIELDS: ReadonlySet<string> = new Set([
  "employmentStartDate",
  "birthDate",
  "plannedDate",
])
