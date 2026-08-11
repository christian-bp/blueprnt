// Shared selection math for table surfaces with row checkboxes (the classify
// title table, the people register). Pure, so the rules are unit-tested
// without a DOM.

// The effective selection given what is currently selectable: stale keys drop
// out (a row filtered away, a group confirmed meanwhile, a person erased), and
// a header checkbox derives its checked/indeterminate state from the result.
// A surface calls this once per question it asks: the people register runs it
// against the current page's ids for its header checkbox, and against the
// whole filtered set for the count its bulk action will act on. `effective`
// follows the order of `selectable`, so the ids a bulk action receives are
// deterministic rather than insertion-ordered.
export function selectionState(
  selected: ReadonlySet<string>,
  selectable: readonly string[]
): { effective: Set<string>; all: boolean; some: boolean } {
  const effective = new Set(selectable.filter((key) => selected.has(key)))
  const all = selectable.length > 0 && effective.size === selectable.length
  return { effective, all, some: effective.size > 0 && !all }
}
