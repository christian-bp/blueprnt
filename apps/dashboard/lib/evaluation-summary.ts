// Live count of roles still waiting for a completed evaluation. "Evaluated"
// means the results query carries a level for the role (only fully rated roles
// under a complete model have one), the same merge rule as the role register
// and the family pages. Derived at render, never stored (ADR-0002).
export function countUnevaluated(
  roles: { roleId: string }[],
  resultRows: { roleId: string; level?: number | null }[]
): number {
  const evaluated = new Set(
    resultRows.filter((row) => row.level != null).map((row) => row.roleId)
  )
  return roles.filter((role) => !evaluated.has(role.roleId)).length
}
