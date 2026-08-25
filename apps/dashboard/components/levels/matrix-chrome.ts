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
// 11px, which is what makes the clear space 22px on each side: a cell insets
// its content by 9px, the table's border-spacing adds 8px on each side of the
// gap column, and a 1px rule 5px into it leaves 9 + 8 + 5 = 22 on both. An
// ODD width, deliberately: a 1px rule cannot sit centred in an even column,
// and at 12px the boundary measured 22 left against 23 right. Against
// the 8px standard gutter that reads as a group break rather than a wider
// line. Nothing else in the grid moves: every column keeps its own 9px inset,
// because the air is between the columns rather than inside any of them.
export const MATRIX_ZONE_GAP_CLASS = "w-[11px] p-0"

// THE RULE ITSELF: one full-height dashed line per boundary column.
//
// DASHED, in the app's reference-line rhythm. This app already has two dashed
// languages and they mean different things: a dashed BORDER (the dimension
// frames, the dropzone, the pending-roles panel) says "this container takes
// something", and a dashed reference LINE (the pay-mapping mean marker) says
// "this is a quiet mark to read against". A zone boundary is the second, so
// it borrows that one's mechanism and rhythm rather than inventing a third.
// A repeating gradient, not border-dashed, for the reason recorded there: CSS
// gives no control over a border's dash rhythm and the browser default is a
// coarse pattern that reads as a divider instead of a quiet line.
//
// ONE ELEMENT, not a segment per row. A gradient restarts its phase in every
// box it paints, and the rows here are 24, 28 and 100-odd pixels tall, none of
// them a multiple of the 7px period, so per-row segments would break the
// pattern at every joint. A single line has one phase by construction, which
// the dedicated boundary column now makes possible.
//
// It is placed by its STATIC POSITION: left and right stay auto, so the line
// lands exactly where it would have sat in flow inside its gap cell, while
// top-0/bottom-0 resolve against the positioned wrapper around the table and
// give it the table's full height. No measurement, no overlay chasing a
// spring, and nothing to re-align when the family filter reflows the grid.
export const MATRIX_ZONE_RULE_CLASS =
  "pointer-events-none absolute top-0 bottom-0 ml-[5px] w-px text-border"

// 3px on, 4px off: the rhythm the mean marker uses, so the app has one dashed
// reference line rather than two that nearly match.
export const MATRIX_ZONE_RULE_DASH =
  "repeating-linear-gradient(to bottom, currentColor 0 3px, transparent 3px 7px)"
