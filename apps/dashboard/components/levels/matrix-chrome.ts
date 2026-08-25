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

// THE LEVEL RULE, drawn in the GUTTER rather than on a cell edge.
//
// A border draws at the cell's own left edge, which is not between two
// columns: measured, this rule sat 16px from the label on its left and 8px
// from the label on its right, hugging one column instead of dividing two. A
// pseudo-element can sit in the 8px border-spacing gutter, where a divider
// belongs, and it adds no box, so no column's label shifts.
//
// -left-1 IS THE MIDPOINT, not a nudge. Every cell insets its content by 9px
// on both sides (1px border + p-2 in the body; the transparent border plus
// px-2 in the header, which is what MATRIX_HEAD_INSET_CLASS exists for), so
// the clear space between two columns is 9 + 8 + 9 = 26px. A 1px rule cannot
// halve an even gap, so it lands 13/12, which is as close as odd sits in even.
export const MATRIX_COL_RULE_CLASS =
  "after:absolute after:top-0 after:bottom-0 after:-left-1 after:w-px after:bg-border/60 after:content-['']"

// Every column header's inset. The transparent borders are not decoration:
// the left one puts the label on the same 9px inset as the chips in the cell
// below it, and the right one makes the gutter symmetric around the rule that
// runs through it (without it the header's clear space is 25px against the
// body's 26px, and one rule cannot be centred in both).
export const MATRIX_HEAD_INSET_CLASS = "border-x border-transparent"

// THE ZONE BOUNDARY: A COLUMN OF ITS OWN. FAMILIES MATRIX ONLY.
//
// Zones have to read as separated GROUPS, which means real air at the
// boundary, and air is the one thing padding cannot buy here. A body cell IS
// its visible box, so padding added to it widens the box and pushes the chips
// off-centre inside it rather than moving the boxes apart; the space has to
// live outside the boxes. border-spacing is one value for the whole table and
// cannot widen at three columns only.
//
// So the boundary becomes a narrow empty column, and the rule is drawn down
// the middle of it. Every row type emits it from the same column list, which
// is what keeps the line continuous and every cell above and below it aligned
// by construction rather than by three separate index calculations agreeing.
//
// 12px, which is what makes the clear space 22px on each side: a cell insets
// its content by 9px, the table's border-spacing adds 8px on each side of the
// gap column, and a 2px rule down its centre leaves 9 + 8 + 5 = 22. Against
// the 8px standard gutter that reads as a group break rather than a wider
// line. Nothing else in the grid moves: every column keeps its own 9px inset,
// because the air is between the columns rather than inside any of them.
export const MATRIX_ZONE_GAP_CLASS = "relative w-3 p-0"

// The rule itself, down the middle of that column. -bottom-2 is the
// border-spacing, not a nudge: each segment reaches through the gutter to
// meet the next row's, so the rule closes into one unbroken line instead of
// reading as a column of ticks. Every row type carries it, the family label
// rows included, or the line breaks at every family.
//
// Not in the LEVELS x TRACKS matrix, and not by omission. Zones are the
// vertical axis there, already drawn as row bands, so a vertical rule would
// divide the tracks, which zones have nothing to do with. This rule means
// something only where levels run horizontally.
export const MATRIX_ZONE_RULE_CLASS =
  "after:absolute after:top-0 after:-bottom-2 after:left-[5px] after:w-0.5 after:bg-border after:content-['']"
