// Renders a structured before->after `changes` object as plain text. Each entry
// is "<fieldLabel>: <from> -> <to>" (a real right-arrow glyph), or just
// "<fieldLabel>: <to>" when `from` is empty (null/undefined/blank), which reads
// as a first-time set rather than a change. Entries are joined with "; ".
export function formatChanges(
  changes: Record<string, { from: unknown; to: unknown }>,
  fieldLabel: (field: string) => string
): string {
  return Object.entries(changes)
    .map(([field, { from, to }]) => {
      const label = fieldLabel(field)
      const fromText = from == null ? "" : String(from)
      const toText = to == null ? "" : String(to)
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

// Pure, testable: turns an audit event + its (id-resolved) names into a
// human-readable detail string. Drops raw Convex ids and internal "source".
export function formatAuditDetail(
  type: string,
  payload: unknown,
  names: Record<string, string>,
  labels: { deletedRole: string; deletedFamily: string; deletedUser: string },
  fieldLabel: (field: string) => string = (f) => f
): string {
  const p = (payload ?? {}) as Record<string, unknown>
  const roleName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedRole) : ""
  const memberName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedUser) : ""
  const changes = asChanges(p.changes)
  switch (type) {
    case "role.created":
    case "role.archived":
    case "role.statusChange":
    case "rating.change":
    case "anchorRole.designated":
    case "anchorRole.updated":
      return roleName(p.roleId)
    case "role.updated": {
      const base = roleName(p.roleId)
      return changes !== null
        ? `${base}: ${formatChanges(changes, fieldLabel)}`
        : base
    }
    case "band.shift": {
      const base = roleName(p.roleId)
      return p.expectedBand != null && p.computedBand != null
        ? `${base} (${p.expectedBand} → ${p.computedBand})`
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
    case "organization.onboardingCompleted":
    case "model.created":
    case "model.updated":
    case "model.discarded":
    case "ai.suggestionConfirmed":
    case "ai.suggestionRejected":
    case "invitation.created":
    case "invitation.accepted":
    case "invitation.revoked":
      return ""
    default:
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
