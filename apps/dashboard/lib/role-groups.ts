// Groups listRoles rows under their families: families sorted by name,
// rows keep their incoming order (the backend sorts by title), and the
// family-less group renders last. Pure so it stays unit-testable.
export interface FamilyGroup<Row> {
  familyId: string | null
  familyName: string | null
  rows: Row[]
}

export function groupByFamily<
  Row extends { familyId: string | null; familyName: string | null },
>(rows: Row[]): FamilyGroup<Row>[] {
  const byFamily = new Map<string | null, FamilyGroup<Row>>()
  for (const row of rows) {
    const key = row.familyId
    const group = byFamily.get(key) ?? {
      familyId: row.familyId,
      familyName: row.familyName,
      rows: [],
    }
    group.rows.push(row)
    byFamily.set(key, group)
  }
  const groups = [...byFamily.values()]
  groups.sort((a, b) => {
    if (a.familyId === null) return 1
    if (b.familyId === null) return -1
    return (a.familyName ?? "").localeCompare(b.familyName ?? "")
  })
  return groups
}
