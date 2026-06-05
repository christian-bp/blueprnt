// Shared selection over the rows from api.ai.suggest.getOpenSuggestions. The
// helper is generic so the branded suggestionId (Id<"suggestions">) flows from
// the query result straight into the mutations, with no widening to string.
interface OpenRow {
  kind: string
  createdAt: number
}

// Returns the most recently created open suggestion of the given kind, or
// undefined when the query is still loading or has no matching row. Rows are
// capped at 20 per status by the backend, so a linear scan is fine.
export function newestByKind<T extends OpenRow>(
  suggestions: readonly T[] | undefined,
  kind: string
): T | undefined {
  let newest: T | undefined
  for (const row of suggestions ?? []) {
    if (row.kind !== kind) continue
    if (newest === undefined || row.createdAt > newest.createdAt) newest = row
  }
  return newest
}
