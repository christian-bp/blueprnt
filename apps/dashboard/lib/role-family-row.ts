// The look of a role family's group row, shared by the roles register and the
// import review. The review is showing the same families the register does, one
// screen earlier, so a family has to read identically in both: a name that
// changed weight or size between the two would make the review look like a
// different kind of list than the one it is about to write into.
//
// A neutral band rather than a brand-tinted one. The band repeats down the
// whole register, and the brand rose means "act on this" everywhere else in the
// app (links, the primary button, selection), so spending it on a structural
// divider that is never clicked would dilute it wherever it does mean that.

// The group row itself. The hover repeats the idle fill because the band is a
// heading, not a target: without it the row lights up under a pointer that is
// only on its way to a role below.
export const FAMILY_ROW_CLASS = "bg-muted/50 hover:bg-muted/50"

// The family name. A weight step up from the role titles it heads (semibold
// over normal, at the register's shared text-sm) so the grouping is legible
// while scanning without the band needing colour or size to carry it (the
// reference's segment rows do the same).
export const FAMILY_NAME_CLASS = "font-semibold text-sm"

// The role count beside the name, and the placeholder that stands in for a name
// (an unnamed new family in the review, the family-less group in the register).
export const FAMILY_COUNT_CLASS = "text-muted-foreground text-xs"
