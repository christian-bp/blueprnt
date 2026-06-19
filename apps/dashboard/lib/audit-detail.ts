// Pure, testable: turns an audit event + its (id-resolved) names into a
// human-readable detail string. Drops raw Convex ids and internal "source".
export function formatAuditDetail(
  type: string,
  payload: unknown,
  names: Record<string, string>,
  labels: { deletedRole: string; deletedFamily: string; deletedUser: string }
): string {
  const p = (payload ?? {}) as Record<string, unknown>
  const roleName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedRole) : ""
  const memberName = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? labels.deletedUser) : ""
  switch (type) {
    case "role.created":
    case "role.updated":
    case "role.archived":
    case "role.statusChange":
    case "rating.change":
    case "anchorRole.designated":
    case "anchorRole.updated":
      return roleName(p.roleId)
    case "band.shift": {
      const base = roleName(p.roleId)
      return p.expectedBand != null && p.computedBand != null
        ? `${base} (${p.expectedBand} → ${p.computedBand})`
        : base
    }
    case "roleFamily.created":
    case "roleFamily.renamed":
    case "roleFamily.removed":
      return typeof p.name === "string"
        ? p.name
        : typeof p.familyId === "string"
          ? (names[p.familyId] ?? labels.deletedFamily)
          : ""
    case "member.added":
      return p.role
        ? `${memberName(p.memberUserId)} (${String(p.role)})`
        : memberName(p.memberUserId)
    case "member.roleChanged":
      return `${memberName(p.memberUserId)}: ${String(p.from)} → ${String(p.to)}`
    case "member.removed":
      return memberName(p.memberUserId)
    case "organization.settingsUpdated":
      return Array.isArray(p.changed) ? p.changed.join(", ") : ""
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
