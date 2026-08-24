// Live count of roles still waiting for a completed evaluation. "Evaluated"
// means the results query carries a level for the role (only a fully rated AND
// COMPLETED assessment has one; completion is the reveal, so it stays null for
// one that is fully rated and still open, spec 2.4/6), the same merge rule as
// the role register and
// the family pages. Derived at render, never stored (ADR-0002).
export function countUnevaluated(
  roles: { roleId: string }[],
  resultRows: { roleId: string; level?: number | null }[]
): number {
  const evaluated = new Set(
    resultRows.filter((row) => row.level != null).map((row) => row.roleId)
  )
  return roles.filter((role) => !evaluated.has(role.roleId)).length
}
