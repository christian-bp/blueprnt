import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import { Fragment, type ReactNode } from "react"
import { ChangeArrow } from "@/components/change-arrow"

// Stringifies any audit-payload value for display. Scalars pass through (via
// String); null/undefined collapse to "". Objects/arrays are compact-JSON
// stringified so a complex before/after never leaks as "[object Object]". Any
// throw (e.g. a circular structure) falls back to "" rather than crashing the
// row.
export function formatAuditValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return ""
    }
  }
  try {
    return String(value)
  } catch {
    return ""
  }
}

// The domains of coded/enum VALUES a pay-mapping audit payload can carry
// (never free text, an id, or a boolean, which are handled elsewhere): a
// scope, a praxis review verdict, a praxis review area key, and the
// ", "-joined pay-gap reason codes (payMapping/analyses.ts's auditView joins
// the reasons array into one display string, never an array, so `reasons` is
// resolved token-by-token in resolveCodedValue below). Each Record is typed
// against the domain's own literal union (PayGapReason/PraxisAreaKey from
// @workspace/constants; the scope/finding unions mirror
// payMapping/analyses.ts's scopeValidator and payMapping/tables.ts's
// payMappingFindingValidator, kept in sync by hand since those two are not
// exported as shared types), so a value added to any domain without also
// giving it an i18n key here is a compile error, never a silently-unmapped
// raw code. Every key is relative to the `dashboard` message namespace and
// REUSES existing dashboard.payMapping.* domain copy (the audit log is not
// the place to invent new wording for a scope/verdict/area/reason that
// already has a real label elsewhere): the caller resolves it with a
// `dashboard`-scoped translator, not the `dashboard.auditLog`-scoped one used
// for field labels.
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

export const PRAXIS_AREA_VALUE_KEYS: Record<PraxisAreaKey, string> = {
  payPolicy: "payMapping.review.praxis.payPolicy.title",
  collectiveAgreements: "payMapping.review.praxis.collectiveAgreements.title",
  benefits: "payMapping.review.praxis.benefits.title",
  payPractices: "payMapping.review.praxis.payPractices.title",
  previousActions: "payMapping.review.praxis.previousActions.title",
}

export const PAY_GAP_REASON_VALUE_KEYS: Record<PayGapReason, string> = {
  alternativeLabourMarket: "payMapping.reasons.alternativeLabourMarket",
  recruitmentPayLevel: "payMapping.reasons.recruitmentPayLevel",
  experience: "payMapping.reasons.experience",
  historicalPay: "payMapping.reasons.historicalPay",
  competence: "payMapping.reasons.competence",
  performance: "payMapping.reasons.performance",
  responsibility: "payMapping.reasons.responsibility",
}

// Resolves one payMapping.groupAnalysisUpdated payload field's raw coded
// VALUE to its localized label, via the caller's `translate` (typically a
// t.has-guarded lookup against a `dashboard`-scoped translator). Returns
// undefined when the field carries no coded domain (free text, ids,
// booleans), the value is not a known member of its domain (e.g. `groupLabel`
// for an equalWork/equivalentWork row, which is already a "roleTitle · level"
// display string, not a praxis area key), or the translator has no string for
// the resolved key: in any of those cases the caller falls back to the raw
// value rather than throwing or rendering nothing.
export function resolveCodedValue(
  field: string,
  value: string,
  translate: (key: string) => string | undefined
): string | undefined {
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
  const key =
    field === "scope"
      ? (SCOPE_VALUE_KEYS as Record<string, string>)[value]
      : field === "finding"
        ? (FINDING_VALUE_KEYS as Record<string, string>)[value]
        : field === "groupLabel"
          ? (PRAXIS_AREA_VALUE_KEYS as Record<string, string>)[value]
          : undefined
  return key ? translate(key) : undefined
}

// Renders a structured before->after `changes` object as a one-line node. Each
// entry is "<fieldLabel>: <from> [→] <to>" (the arrow is a ChangeArrow icon, not
// a glyph), or just "<fieldLabel>: <to>" when `from` is empty (null/undefined/
// blank), which reads as a first-time set rather than a change. Entries are
// joined with "; ". Complex (object/array) values are not dumped inline; the
// entry shows the field label plus a `complexValue` placeholder so the dense
// table cell stays readable (the detail sheet renders the full JSON instead).
export function formatChanges(
  changes: Record<string, { from: unknown; to: unknown }>,
  fieldLabel: (field: string) => string,
  complexPlaceholder = "…",
  // Localizes a boolean field value to "Yes"/"No" (else it stringifies as
  // "true"/"false"). Optional so callers without i18n keep the raw behavior.
  boolLabel?: (value: boolean) => string,
  // Localizes a coded string field value (a scope, a finding, a praxis area
  // key, a reason code) via resolveCodedValue. Optional so callers without
  // i18n keep the raw behavior; returns undefined (not the raw value) when
  // the field/value is not a known coded pair, so the raw string is the
  // explicit fallback here, not something valueLabel itself decided.
  valueLabel?: (field: string, value: string) => string | undefined
): ReactNode {
  const valueText = (field: string, value: unknown) => {
    if (typeof value === "boolean" && boolLabel) return boolLabel(value)
    if (typeof value === "string" && valueLabel) {
      const label = valueLabel(field, value)
      if (label !== undefined) return label
    }
    return formatAuditValue(value)
  }
  return Object.entries(changes).map(([field, { from, to }], index) => {
    const label = fieldLabel(field)
    const isComplex =
      (typeof from === "object" && from !== null) ||
      (typeof to === "object" && to !== null)
    // The separator leads every entry after the first, so the fragments read as
    // one "a; b; c" line.
    const sep = index > 0 ? "; " : ""
    if (isComplex) {
      return (
        <Fragment key={field}>
          {sep}
          {label}: {complexPlaceholder}
        </Fragment>
      )
    }
    const fromText = valueText(field, from)
    const toText = valueText(field, to)
    if (fromText.trim() === "") {
      return (
        <Fragment key={field}>
          {sep}
          {label}: {toText}
        </Fragment>
      )
    }
    return (
      <Fragment key={field}>
        {sep}
        {label}: {fromText}
        <ChangeArrow />
        {toText}
      </Fragment>
    )
  })
}

// Narrows an unknown payload field to a non-empty `changes` map.
function asChanges(
  value: unknown
): Record<string, { from: unknown; to: unknown }> | null {
  if (value === null || typeof value !== "object") return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return null
  return value as Record<string, { from: unknown; to: unknown }>
}

// Reads the structured `changes` map off an audit payload, or null when the
// payload carries no field-level changes. Public wrapper over `asChanges` for
// the detail sheet, which renders changes per field rather than as one string.
export function payloadChanges(
  payload: unknown
): Record<string, { from: unknown; to: unknown }> | null {
  const p = (payload ?? {}) as Record<string, unknown>
  return asChanges(p.changes)
}

// The id fields a bulk/dropped item may carry, in resolution order. Exactly one
// is expected per item; the first present is used as the React key.
const ITEM_ID_FIELDS = [
  "criterionId",
  "roleId",
  "familyId",
  "memberUserId",
  "suggestionId",
] as const

function firstItemId(item: Record<string, unknown>, index: number): string {
  for (const field of ITEM_ID_FIELDS) {
    const value = item[field]
    if (typeof value === "string" && value.length > 0) return value
  }
  return `item-${index}`
}

// Narrows an audit payload's bulk `items` array (the single canonical bulk
// shape: `{ count, items: [{ <oneId>, label?, changes }] }`) into a render-ready
// group, or null when there is no items array. Ids inside items are NOT resolved
// at read time; the title comes from the captured `label`. `count` prefers the
// explicit `payload.count`, else the item count.
export function payloadItems(
  payload: unknown,
  fieldLabel: (field: string) => string,
  boolLabel?: (value: boolean) => string
): {
  count: number
  items: Array<{
    key: string
    title: string
    entries: ReturnType<typeof changeEntries>
  }>
} | null {
  const p = (payload ?? {}) as Record<string, unknown>
  const raw = p.items
  if (!Array.isArray(raw)) return null
  const items = raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const changes = asChanges(item.changes)
    return {
      key: firstItemId(item, index),
      title: typeof item.label === "string" ? item.label : "",
      entries: changes
        ? changeEntries(changes, fieldLabel, undefined, boolLabel)
        : [],
    }
  })
  const count = typeof p.count === "number" ? p.count : items.length
  return { count, items }
}

// Narrows an audit payload's AI `moves` array (weightReview): each move records
// a per-criterion weight shift `fromLabel -> toLabel`, the resulting points, an
// `applied` flag (false when a guard skipped it), and the AI motivation.
export function payloadMoves(payload: unknown): {
  count: number
  moves: Array<{
    key: string
    fromLabel: string
    toLabel: string
    points: string
    applied: boolean
    motivation: string
  }>
} | null {
  const p = (payload ?? {}) as Record<string, unknown>
  const raw = p.moves
  if (!Array.isArray(raw)) return null
  const moves = raw.map((entry, index) => {
    const move = (entry ?? {}) as Record<string, unknown>
    return {
      key: firstItemId(move, index),
      fromLabel: typeof move.fromLabel === "string" ? move.fromLabel : "",
      toLabel: typeof move.toLabel === "string" ? move.toLabel : "",
      points: formatAuditValue(move.points),
      // Default to applied; only an explicit false marks a skipped move.
      applied: move.applied !== false,
      motivation: typeof move.motivation === "string" ? move.motivation : "",
    }
  })
  return { count: moves.length, moves }
}

// Narrows an audit payload's dropped `suggestions` array (model.discarded):
// each entry is an id + kind + status of a suggestion that went away with the
// discarded draft.
export function payloadSuggestions(payload: unknown): {
  count: number
  items: Array<{ key: string; kind: string; status: string }>
} | null {
  const p = (payload ?? {}) as Record<string, unknown>
  const raw = p.suggestions
  if (!Array.isArray(raw)) return null
  const items = raw.map((entry, index) => {
    const suggestion = (entry ?? {}) as Record<string, unknown>
    return {
      key: firstItemId(suggestion, index),
      kind: typeof suggestion.kind === "string" ? suggestion.kind : "",
      status: typeof suggestion.status === "string" ? suggestion.status : "",
    }
  })
  return { count: items.length, items }
}

// The provenance meta keys, in display order. `cause` resolves to its nested
// `event` so the footer reads the triggering event, not "[object Object]".
const PROVENANCE_KEYS = [
  "source",
  "via",
  "viaArchive",
  "viaReconcile",
  "seeded",
  "batchId",
  "cause",
] as const

// Reads the present provenance meta scalars off a payload into an ordered
// key/value list for the sheet's muted footer. `cause` is unwrapped to its
// `event`. Returns an empty array when none are present.
export function payloadProvenance(
  payload: unknown
): Array<{ key: string; value: string }> {
  const p = (payload ?? {}) as Record<string, unknown>
  const out: Array<{ key: string; value: string }> = []
  for (const key of PROVENANCE_KEYS) {
    if (!(key in p)) continue
    const raw = p[key]
    if (raw == null) continue
    if (key === "cause") {
      const cause = raw as Record<string, unknown>
      const event = cause?.event
      if (typeof event === "string" && event.length > 0) {
        out.push({ key, value: event })
      }
      continue
    }
    out.push({ key, value: formatAuditValue(raw) })
  }
  return out
}

// Reads an event's "flat stats": the scalar payload fields that are neither a
// structured `changes` map, an internal id, nor the `source` marker, as an
// ordered {field,value} list. This is the shape of events whose payload is a
// bag of counts or codes rather than a before->after diff (people.imported,
// classification.suggested, platform.userDeleted, platform.membershipGranted).
// Ordered via FIELD_DISPLAY_ORDER so the read is stable regardless of stored key
// order (Convex does not guarantee object key order on read of a v.any() payload).
// Booleans are excluded: a provenance flag is not a stat.
export function payloadStats(
  payload: unknown
): Array<{ field: string; value: string }> {
  const p = (payload ?? {}) as Record<string, unknown>
  const stats = Object.entries(p)
    .filter(
      ([key, value]) =>
        key !== "changes" &&
        !key.endsWith("Id") &&
        key !== "source" &&
        (typeof value === "string" || typeof value === "number")
    )
    .map(([field, value]) => ({ field, value: formatAuditValue(value) }))
  return orderEntries(stats)
}

// One-line labeled summary of an event's flat stats, e.g.
// "New employees: 118 · Salaries imported: 118 · Skipped rows: 0". Empty string
// when the payload carries no stats, so a payload-less event renders nothing.
export function formatStats(
  payload: unknown,
  fieldLabel: (field: string) => string
): string {
  return payloadStats(payload)
    .map(({ field, value }) => `${fieldLabel(field)}: ${value}`)
    .join(" · ")
}

// One row per changed field, for rendering a structured before/after list.
// `isSet` is true when there was no prior value (first-time set), so the UI can
// show just the new value instead of "<empty> -> value". `isComplex` is true
// when either side is a non-null object/array, so the sheet can render the
// (compact-JSON) value in a scrollable mono block instead of inline.
//
// `resolveName` (optional) turns an id-valued field into a human name: when a
// from/to value is a string that resolves to a name, the name is shown instead
// of the raw id (e.g. a role's `familyId` renders as the family name).
// `valueLabel` (optional) turns a coded field's value (a scope, a finding, a
// praxis area key, a reason code) into its localized label via
// resolveCodedValue, checked before resolveName (the two never overlap: no
// coded field is also an id field) and before the raw fallback.
export function changeEntries(
  changes: Record<string, { from: unknown; to: unknown }>,
  fieldLabel: (field: string) => string,
  resolveName?: (id: string) => string | undefined,
  boolLabel?: (value: boolean) => string,
  valueLabel?: (field: string, value: string) => string | undefined
): Array<{
  field: string
  label: string
  from: string
  to: string
  isSet: boolean
  isComplex: boolean
}> {
  const display = (field: string, value: unknown): string => {
    if (typeof value === "boolean" && boolLabel) return boolLabel(value)
    if (typeof value === "string" && valueLabel) {
      const label = valueLabel(field, value)
      if (label !== undefined) return label
    }
    if (typeof value === "string" && resolveName) {
      const name = resolveName(value)
      if (name) return name
    }
    return formatAuditValue(value)
  }
  return Object.entries(changes).map(([field, { from, to }]) => {
    const fromText = display(field, from)
    const toText = display(field, to)
    return {
      field,
      label: fieldLabel(field),
      from: fromText,
      to: toText,
      isSet: fromText.trim() === "",
      isComplex:
        (typeof from === "object" && from !== null) ||
        (typeof to === "object" && to !== null),
    }
  })
}

// Display order for change-entry fields in the detail sheet, so a snapshot reads
// identity-first (title, track, family, ...) then profile/criterion/rating/etc.,
// regardless of how the stored payload's keys come back (Convex does not
// guarantee object key order on read of a v.any() payload). Unknown fields keep
// their original relative order, after the known ones.
export const FIELD_DISPLAY_ORDER = [
  "title",
  "name",
  "trackKey",
  "familyId",
  "function",
  "team",
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  "approved",
  "responsibilities",
  "description",
  "helpText",
  "anchors",
  "weightPoints",
  "order",
  "isCustom",
  "templateKey",
  "value",
  "motivation",
  "expectedBand",
  "status",
  "reviewedAt",
  "band",
  "score",
  "complete",
  "ratedCount",
  "country",
  "currency",
  "language",
  "industry",
  "employeeCount",
  "onboardingCompletedAt",
  "role",
  "expiresAt",
  "archivedAt",
  "orgId",
  "bandThresholds",
  // Person diff fields (person.* events); country/archivedAt are already above.
  "department",
  "employmentType",
  "employmentStartDate",
  "ftePercent",
  "isManager",
  "statisticalCode",
  // Pay diff fields (pay.* events); currency is already above.
  "payYear",
  "source",
  // Assignment diff fields (assignment.set).
  "roleId",
  "level",
  "levelSource",
  // Flat-stats fields: event summaries whose payload is a bag of counts/codes
  // (people.imported, classification.suggested, platform.*), not a diff.
  "peopleCreated",
  "peopleUpdated",
  "peopleUnchanged",
  "salariesImported",
  "skippedRows",
  "suggested",
  "skipped",
  "unmatchedTitles",
  "orgCount",
  // Pay-mapping run flat-stats fields (payMapping.runStarted/runDeleted).
  // label leads: the run's own display name, identity-first like title/name.
  "label",
  "populationCount",
  "withPayCount",
  // Pay-mapping group-analysis context fields (payMapping.groupAnalysisUpdated):
  // not diffed, but ordered so they lead a no-changes stats fallback.
  "groupLabel",
  "scope",
  // Pay-mapping run completion flat-stats fields (payMapping.runCompleted).
  "equalWorkDone",
  "equivalentWorkDone",
] as const

// Sorts change entries into FIELD_DISPLAY_ORDER. Stable: unknown fields keep
// their input order, placed after all known ones.
export function orderEntries<T extends { field: string }>(entries: T[]): T[] {
  const rank = (field: string): number => {
    const index = (FIELD_DISPLAY_ORDER as readonly string[]).indexOf(field)
    return index === -1 ? FIELD_DISPLAY_ORDER.length : index
  }
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) => rank(a.entry.field) - rank(b.entry.field) || a.index - b.index
    )
    .map(({ entry }) => entry)
}

// Classifies a change section for its heading: a "create" snapshot (every field
// set from nothing), a "remove" snapshot (every field cleared to nothing), or an
// "update". Event type takes precedence for the unambiguous create/remove events
// (so e.g. role.archived, whose only change is archivedAt set from null, is not
// mislabeled "created"); otherwise the shape of the entries decides.
export function sectionKind(
  type: string,
  entries: Array<{ isSet: boolean; to: string }>
): "create" | "remove" | "update" {
  if (type.endsWith(".removed") || type.endsWith(".discarded")) return "remove"
  if (type === "role.archived") return "update"
  if (
    type.endsWith(".created") ||
    type === "anchorRole.designated" ||
    type === "member.added"
  ) {
    return "create"
  }
  if (entries.length > 0 && entries.every((entry) => entry.isSet))
    return "create"
  if (
    entries.length > 0 &&
    entries.every((entry) => !entry.isSet && entry.to.trim() === "")
  ) {
    return "remove"
  }
  return "update"
}

// Maps "model.draft" -> "modelDraft", etc., for i18n keys (ai.kind.<key>).
export const AI_KIND_KEY: Record<string, string> = {
  "model.draft": "modelDraft",
  "model.weightReview": "weightReview",
  "starter.import": "starterImport",
}

// Human-readable detail for ai.suggestionConfirmed / ai.suggestionRejected.
// `t` is injected (next-intl) so this stays pure/testable.
export function aiAuditDetail(
  type: string,
  payload: unknown,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const p = (payload ?? {}) as Record<string, unknown>
  const kind = typeof p.kind === "string" ? p.kind : ""
  const kindKey = AI_KIND_KEY[kind]
  if (type === "ai.suggestionRejected") {
    return kindKey ? t(`ai.kind.${kindKey}`) : ""
  }
  const num = (v: unknown) => (typeof v === "number" ? v : 0)
  switch (kind) {
    case "model.draft":
      return t("ai.modelDraft", { count: num(p.acceptedCount) })
    case "model.weightReview":
      return t("ai.weightReview", { count: num(p.appliedCount) })
    case "starter.import":
      return t("ai.starterImport", {
        families: num(p.familyCount),
        roles: num(p.roleCount),
      })
    default:
      return ""
  }
}

// Strings/formatters the (pure, testable) table-cell formatter needs. The
// deleted-* fallbacks name a vanished subject; the count formatters and the
// created marker localize the bulk/marker summaries.
export type AuditDetailLabels = {
  deletedRole: string
  deletedFamily: string
  deletedUser: string
  itemsChanged: (count: number) => string
  fieldsChanged: (count: number) => string
  createdMarker: string
}

// Turns an audit event + its (id-resolved) names into a human-readable one-line
// detail node. Drops raw Convex ids and internal "source", and never emits
// "[object Object]" (complex values are summarized as counts). Mostly plain text;
// the before->after cases render a ChangeArrow icon rather than a "→" glyph.
export function formatAuditDetail(
  type: string,
  payload: unknown,
  names: Record<string, string>,
  labels: AuditDetailLabels,
  fieldLabel: (field: string) => string = (f) => f,
  boolLabel?: (value: boolean) => string,
  valueLabel?: (field: string, value: string) => string | undefined
): ReactNode {
  const p = (payload ?? {}) as Record<string, unknown>
  const roleName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedRole) : ""
  const memberName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedUser) : ""
  const criterionName = (id: unknown) =>
    typeof id === "string" ? names[id] : undefined
  const changes = asChanges(p.changes)
  // A bulk event carries an `items` array and/or a `count`. The summary names
  // how many children changed rather than dumping nested JSON.
  const isBulk = Array.isArray(p.items) || typeof p.count === "number"
  const bulkCount =
    typeof p.count === "number"
      ? p.count
      : Array.isArray(p.items)
        ? p.items.length
        : 0
  switch (type) {
    case "role.created":
    case "role.archived":
    case "rating.change":
    case "anchorRole.designated":
    case "anchorRole.updated":
    // assignment.set carries the assigned roleId (top-level, resolved to the
    // role title by the audit-log query); the level detail lives in the sheet.
    case "assignment.set":
      return roleName(p.roleId)
    case "role.updated": {
      const base = roleName(p.roleId)
      if (changes === null) return base
      // When every changed field is a complex object, dumping JSON in the dense
      // cell is unreadable; summarize as a field count instead.
      const entries = changeEntries(changes, fieldLabel)
      const allComplex =
        entries.length > 0 && entries.every((entry) => entry.isComplex)
      return allComplex ? (
        `${base}: ${labels.fieldsChanged(entries.length)}`
      ) : (
        <>
          {base}:{" "}
          {formatChanges(changes, fieldLabel, undefined, boolLabel, valueLabel)}
        </>
      )
    }
    case "band.shift": {
      const base = roleName(p.roleId)
      const band = changes?.band
      return band != null && (band.from != null || band.to != null) ? (
        <>
          {base} ({formatAuditValue(band.from)}
          <ChangeArrow />
          {formatAuditValue(band.to)})
        </>
      ) : (
        base
      )
    }
    case "roleFamily.created":
    case "roleFamily.removed":
      return typeof p.name === "string"
        ? p.name
        : typeof p.familyId === "string"
          ? (names[p.familyId] ?? labels.deletedFamily)
          : ""
    case "roleFamily.renamed": {
      const base =
        typeof p.familyId === "string"
          ? (names[p.familyId] ?? labels.deletedFamily)
          : ""
      if (changes !== null) {
        return (
          <>
            {base}:{" "}
            {formatChanges(
              changes,
              fieldLabel,
              undefined,
              boolLabel,
              valueLabel
            )}
          </>
        )
      }
      return typeof p.name === "string" ? p.name : base
    }
    case "member.added":
      return p.role
        ? `${memberName(p.memberUserId)} (${String(p.role)})`
        : memberName(p.memberUserId)
    case "member.roleChanged":
      return changes !== null ? (
        <>
          {memberName(p.memberUserId)}:{" "}
          {formatChanges(changes, fieldLabel, undefined, boolLabel, valueLabel)}
        </>
      ) : (
        memberName(p.memberUserId)
      )
    case "member.removed":
      return memberName(p.memberUserId)
    case "organization.settingsUpdated":
      return changes !== null
        ? formatChanges(changes, fieldLabel, undefined, boolLabel, valueLabel)
        : ""
    case "organization.created":
      return labels.createdMarker
    case "model.created":
    case "model.discarded":
      // Bulk model events: how many criteria came/went.
      return isBulk ? labels.itemsChanged(bulkCount) : ""
    case "criterion.approved":
    case "criterion.reopened":
      return criterionName(p.criterionId) ?? ""
    case "model.updated": {
      // Bulk model.updated (weights.rebalanced, criterion.removed): item count.
      if (isBulk) return labels.itemsChanged(bulkCount)
      // Non-bulk model.updated (criterion.added/updated, keyed on
      // `payload.change`): the criterion label + how many fields changed, so
      // the cell is never blank.
      const label =
        criterionName(p.criterionId) ??
        (changes?.name?.to != null ? formatAuditValue(changes.name.to) : "")
      const fieldCount = changes ? Object.keys(changes).length : 0
      const summary = labels.fieldsChanged(fieldCount)
      return label ? `${label}: ${summary}` : summary
    }
    case "organization.onboardingCompleted":
    case "ai.suggestionConfirmed":
    case "ai.suggestionRejected":
    case "invitation.created":
    case "invitation.accepted":
    case "invitation.revoked":
      return ""
    // The group documented (groupLabel) and which comparison it was
    // documented under (scope: equalWork/equivalentWork/praxis) are flat
    // context fields, not part of the diff, so the default case's
    // formatChanges-only rendering would drop them; show both alongside the
    // reasons/note/done/finding changes. Both are coded: scope is always a
    // wire code, and groupLabel is a raw PRAXIS_AREA_KEYS slug for a praxis
    // row (already a real "roleTitle · level" display string otherwise), so
    // both go through valueLabel, falling back to the raw value when unset.
    case "payMapping.groupAnalysisUpdated": {
      const rawGroupLabel = typeof p.groupLabel === "string" ? p.groupLabel : ""
      const rawScope = typeof p.scope === "string" ? p.scope : ""
      const groupLabel =
        valueLabel?.("groupLabel", rawGroupLabel) ?? rawGroupLabel
      const scope = valueLabel?.("scope", rawScope) ?? rawScope
      const base = rawScope
        ? `${groupLabel} (${fieldLabel("scope")}: ${scope})`
        : groupLabel
      if (changes === null) return base
      return (
        <>
          {base}:{" "}
          {formatChanges(changes, fieldLabel, undefined, boolLabel, valueLabel)}
        </>
      )
    }
    default: {
      if (isBulk) return labels.itemsChanged(bulkCount)
      // A changes-bearing event with no explicit case (person.*, pay.*,
      // assignment.set, organization.nameUpdated) reads like settingsUpdated:
      // its field changes inline. A flat-stats event (people.imported,
      // classification.suggested) reads as labeled "Label: value" stats. Neither
      // ever leaks a raw payload key.
      if (changes !== null)
        return formatChanges(
          changes,
          fieldLabel,
          undefined,
          boolLabel,
          valueLabel
        )
      return formatStats(p, fieldLabel)
    }
  }
}
