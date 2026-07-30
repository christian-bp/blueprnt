// Pure selection and chunk-packing math for the classify surface's bulk
// confirm, extracted so it is unit-testable without the table component.

export type BulkAssignment = {
  personId: string
  roleId: string
  level: string
}

// The effective selection given what is currently actionable: stale keys
// (groups confirmed meanwhile, or whose role pick was cleared) drop out, and
// the header checkbox derives its checked/indeterminate state from the
// result.
export function selectionState(
  selected: ReadonlySet<string>,
  actionable: readonly string[]
): { effective: Set<string>; all: boolean; some: boolean } {
  const effective = new Set(actionable.filter((key) => selected.has(key)))
  const all = actionable.length > 0 && effective.size === actionable.length
  return { effective, all, some: effective.size > 0 && !all }
}

// Packs per-group assignment lists into chunks of at most `limit` people,
// keeping whole groups together when they fit (a partially confirmed group
// is a worse failure state than a partially confirmed selection). A single
// group larger than the limit closes the running chunk and splits into
// limit-sized slices. Empty groups contribute nothing.
export function packAssignmentChunks(
  groups: ReadonlyArray<readonly BulkAssignment[]>,
  limit: number
): BulkAssignment[][] {
  const chunks: BulkAssignment[][] = []
  let current: BulkAssignment[] = []
  for (const group of groups) {
    if (group.length === 0) continue
    if (group.length > limit) {
      if (current.length > 0) {
        chunks.push(current)
        current = []
      }
      for (let i = 0; i < group.length; i += limit) {
        chunks.push(group.slice(i, i + limit))
      }
      continue
    }
    if (current.length + group.length > limit) {
      chunks.push(current)
      current = []
    }
    current.push(...group)
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}
