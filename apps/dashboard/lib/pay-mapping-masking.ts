// The export-boundary small-cell minimums (ADR-0012): a
// PER-GENDER group mean/gap leaves the HR context only when the group has at
// least this many people in total AND at least this many per gender. A
// whole-group mean (the women-dominated comparison ranks whole groups, not
// genders) has no per-gender leg; it masks below the total minimum alone,
// because a small group's mean approaches an individual's salary. The rule
// is this product's own conservative disclosure choice: no Swedish statute,
// DO guidance, or social-partner material prescribes a numeric threshold,
// and real employer documents commonly list every group unmasked. Never
// present it as an industry standard.
//
// Who acts on it: the report assembly only FLAGS rows with these predicates
// (ADR-0030: it never nulls a value for size), the signing projection
// (signing-report-data.ts) is the one document projection that masks, and
// the key-figures workbook keeps its own ADR-0012 masking unchanged.
export const EXPORT_MIN_GROUP_SIZE = 4
export const EXPORT_MIN_PER_GENDER = 2

export function exportMasksGenderMeans(group: {
  womenCount: number
  menCount: number
}): boolean {
  return (
    group.womenCount + group.menCount < EXPORT_MIN_GROUP_SIZE ||
    group.womenCount < EXPORT_MIN_PER_GENDER ||
    group.menCount < EXPORT_MIN_PER_GENDER
  )
}

export function exportMasksWholeGroupMean(headcount: number): boolean {
  return headcount < EXPORT_MIN_GROUP_SIZE
}
