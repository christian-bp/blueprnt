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

// Renders a structured before->after `changes` object as plain text. Each entry
// is "<fieldLabel>: <from> -> <to>" (a real right-arrow glyph), or just
// "<fieldLabel>: <to>" when `from` is empty (null/undefined/blank), which reads
// as a first-time set rather than a change. Entries are joined with "; ".
// Complex (object/array) values are not dumped inline; the entry shows the
// field label plus a `complexValue` placeholder so the dense table cell stays
// readable (the detail sheet renders the full JSON instead).
export function formatChanges(
  changes: Record<string, { from: unknown; to: unknown }>,
  fieldLabel: (field: string) => string,
  complexPlaceholder = "…"
): string {
  return Object.entries(changes)
    .map(([field, { from, to }]) => {
      const label = fieldLabel(field)
      const isComplex =
        (typeof from === "object" && from !== null) ||
        (typeof to === "object" && to !== null)
      if (isComplex) return `${label}: ${complexPlaceholder}`
      const fromText = formatAuditValue(from)
      const toText = formatAuditValue(to)
      return fromText.trim() === ""
        ? `${label}: ${toText}`
        : `${label}: ${fromText} → ${toText}`
    })
    .join("; ")
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
  fieldLabel: (field: string) => string
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
      entries: changes ? changeEntries(changes, fieldLabel) : [],
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

// One row per changed field, for rendering a structured before/after list.
// `isSet` is true when there was no prior value (first-time set), so the UI can
// show just the new value instead of "<empty> -> value". `isComplex` is true
// when either side is a non-null object/array, so the sheet can render the
// (compact-JSON) value in a scrollable mono block instead of inline.
export function changeEntries(
  changes: Record<string, { from: unknown; to: unknown }>,
  fieldLabel: (field: string) => string
): Array<{
  field: string
  label: string
  from: string
  to: string
  isSet: boolean
  isComplex: boolean
}> {
  return Object.entries(changes).map(([field, { from, to }]) => {
    const fromText = formatAuditValue(from)
    const toText = formatAuditValue(to)
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

// Maps "model.draft" -> "modelDraft", etc., for i18n keys (ai.kind.<key>).
export const AI_KIND_KEY: Record<string, string> = {
  "model.draft": "modelDraft",
  "model.weightReview": "weightReview",
  "role.profile": "roleProfile",
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
    case "role.profile":
      return t("ai.roleProfile", { count: num(p.appliedCount) })
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

// Pure, testable: turns an audit event + its (id-resolved) names into a
// human-readable detail string. Drops raw Convex ids and internal "source",
// and never emits "[object Object]" (complex values are summarized as counts).
export function formatAuditDetail(
  type: string,
  payload: unknown,
  names: Record<string, string>,
  labels: AuditDetailLabels,
  fieldLabel: (field: string) => string = (f) => f
): string {
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
      return roleName(p.roleId)
    case "role.updated": {
      const base = roleName(p.roleId)
      if (changes === null) return base
      // When every changed field is a complex object, dumping JSON in the dense
      // cell is unreadable; summarize as a field count instead.
      const entries = changeEntries(changes, fieldLabel)
      const allComplex =
        entries.length > 0 && entries.every((entry) => entry.isComplex)
      return allComplex
        ? `${base}: ${labels.fieldsChanged(entries.length)}`
        : `${base}: ${formatChanges(changes, fieldLabel)}`
    }
    case "band.shift": {
      const base = roleName(p.roleId)
      const band = changes?.band
      return band != null && (band.from != null || band.to != null)
        ? `${base} (${formatAuditValue(band.from)} → ${formatAuditValue(band.to)})`
        : base
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
      return changes !== null
        ? `${base}: ${formatChanges(changes, fieldLabel)}`
        : typeof p.name === "string"
          ? p.name
          : base
    }
    case "member.added":
      return p.role
        ? `${memberName(p.memberUserId)} (${String(p.role)})`
        : memberName(p.memberUserId)
    case "member.roleChanged":
      return changes !== null
        ? `${memberName(p.memberUserId)}: ${formatChanges(changes, fieldLabel)}`
        : memberName(p.memberUserId)
    case "member.removed":
      return memberName(p.memberUserId)
    case "organization.settingsUpdated":
      return changes !== null ? formatChanges(changes, fieldLabel) : ""
    case "organization.created":
      return labels.createdMarker
    case "model.created":
    case "model.discarded":
      // Bulk model events: how many criteria came/went.
      return isBulk ? labels.itemsChanged(bulkCount) : ""
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
    default:
      if (isBulk) return labels.itemsChanged(bulkCount)
      // Clean fallback: scalar fields only, never raw ids or "source".
      return Object.entries(p)
        .filter(
          ([k, v]) =>
            !k.endsWith("Id") &&
            k !== "source" &&
            (typeof v === "string" || typeof v === "number")
        )
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
  }
}
