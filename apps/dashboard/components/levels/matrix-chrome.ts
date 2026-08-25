// Shared scaffolding classes for the two level matrices (levels x tracks and
// families x levels), so their scroll/sticky behavior cannot drift.

// The scroll wrapper: a ScrollArea in BOTH orientations (the wide-content
// rule) that fills the height-bounded tab panel on /work (flex-1 inside the
// panel's flex column), so a grid too wide or too long for the page scrolls
// INSIDE it and the page never scrolls at all. That inner scroll is what
// makes the sticky header work: a sticky header can only stick to its own
// scrollport, never to the window.
//
// A ScrollArea rather than a bare overflow-auto because on the platforms that
// hide overlay scrollbars until something moves, a grid that runs off the
// right edge looks CROPPED rather than scrollable, and the reader has no way
// to learn otherwise except by guessing. The ScrollArea draws its own bar.
export const MATRIX_WRAPPER_CLASS = "min-h-0 flex-1"

// A sticky column-header cell. border-separate's border-spacing leaves
// transparent slits between and around the header cells that scrolled chips
// would show through; the before-pseudo extends each cell's background half
// a gap sideways (meeting its neighbor's in the middle) and a full gap up
// and down (covering the wrapper edge above and the spacing row below),
// forming one solid strip behind the sticky row.
export const MATRIX_COL_HEADER_CLASS =
  "sticky top-0 z-10 bg-background before:absolute before:-inset-x-1 before:-inset-y-2 before:-z-10 before:bg-background before:content-['']"

// The horizontal inset every column header takes, zone band and level alike,
// so the two header rows share one left edge with each other and with the
// chips in the cells below them (a cell's own border plus its p-2).
export const MATRIX_HEAD_PAD_CLASS = "px-2 py-1"

// THE TWO RULES, both drawn in the GUTTER rather than on a cell edge.
//
// A border draws at the cell's own left edge, which is not between two
// columns: measured, the level rule sat 16px from the label on its left and
// 8px from the label on its right, hugging one column instead of dividing
// two. A pseudo-element can sit in the 8px border-spacing gutter, where a
// divider belongs, and it adds no box, so no column's label shifts.
//
// THE OFFSETS ARE THE MIDPOINTS, not nudges. Every cell insets its content by
// 9px on both sides (1px border + p-2 in the body, and the transparent border
// plus px-2 in the header, which is what MATRIX_HEAD_INSET_CLASS exists for),
// so the clear space between two columns' content is 9 + 8 + 9 = 26px. A 1px
// rule cannot halve an even gap, so the level rule lands 13/12; the zone rule
// is 2px, which halves it exactly at 12/12, and that is the width the heavier
// of the two should have carried anyway.
export const MATRIX_COL_RULE_CLASS =
  "after:absolute after:top-0 after:bottom-0 after:-left-1 after:w-px after:bg-border/60 after:content-['']"

// Every column header's inset. The transparent borders are not decoration:
// the left one puts the label on the same 9px inset as the chips in the cell
// below it, and the right one makes the gutter symmetric around the rule that
// runs through it (without it the header's clear space is 25px against the
// body's 26px, and one rule cannot be centred in both).
export const MATRIX_HEAD_INSET_CLASS = "border-x border-transparent"

// THE ZONE BOUNDARY RULE. FAMILIES MATRIX ONLY.
//
// A different ORDER of division from the level rule, and it says so three
// ways: full border ink rather than 60%, 2px rather than 1px, and it runs the
// height of the grid instead of hanging from the header. Ink alone would not
// have carried it, because 1px at 100% next to 1px at 60% is a difference a
// reader has to hunt for.
//
// Not in the LEVELS x TRACKS matrix, and not by omission. Zones are the
// vertical axis there, already drawn as row bands, so a vertical rule would
// divide the tracks, which zones have nothing to do with. This rule means
// something only where levels run horizontally.
//
// -bottom-2 is the border-spacing, not a nudge: each segment reaches down
// through the gutter to meet the next row's, so the rule closes into one line
// instead of reading as a column of ticks. Every row type carries it, the
// family label rows included, or the line breaks at every family.
export const MATRIX_ZONE_RULE_CLASS =
  "after:absolute after:top-0 after:-bottom-2 after:-left-[5px] after:w-0.5 after:bg-border after:content-['']"
