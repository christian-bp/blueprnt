// The label above a value: "Purpose", "Responsibilities", "Role family",
// "Contribution".
//
// One constant because four of them sit within one screen of each other in the
// role sheet and had drifted into two species: three at text-xs and the
// contribution's at text-sm, which read as a heading of a different rank
// rather than as the fourth member of a set.
//
// text-xs is correct and not a floor violation. The reading floor governs text
// a user reads as SENTENCES; a field label above a larger value is one of the
// slots it explicitly reserves for the scanned scale. The VALUE under the
// label is what floors at text-sm.
export const FIELD_LABEL_CLASS = "text-muted-foreground text-xs"
