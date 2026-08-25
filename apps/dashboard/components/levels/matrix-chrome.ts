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

// The rule between two level columns, and its invisible twin.
//
// The app's plain border ink at the weight the nav rail uses, so it divides
// without ever competing with the cell borders running alongside it.
//
// It hangs from the HEADER rows. The cells below already carry their own
// rounded borders inside an 8px gutter, so the body's columns are divided
// twice over if the rule continues into them; the header block is where one
// level ran into the next with nothing between them at all.
//
// The spacer is not decoration. A border is 1px of box, so giving eleven of
// twelve columns a left border and not the first pushes every label except
// the first one 1px right, which is a misalignment of exactly the kind this
// change exists to remove. The first column takes the same border in
// transparent, and all twelve labels sit on one inset.
export const MATRIX_COL_RULE_CLASS = "border-border/60 border-l"
export const MATRIX_COL_RULE_SPACER_CLASS = "border-l border-transparent"

// THE ZONE BOUNDARY RULE. FAMILIES MATRIX ONLY.
//
// A different ORDER of division from the level rule beside it, and it says so
// twice over: full border ink rather than the level rule's 60%, and it runs
// the height of the grid instead of hanging from the header. Ink alone would
// not have carried it, because 1px at 100% next to 1px at 60% is a difference
// a reader has to hunt for; extent is what makes the two read as a hierarchy.
//
// Not in the LEVELS x TRACKS matrix, and not by omission. Zones are the
// vertical axis there, already drawn as row bands, so a vertical rule would
// divide the tracks, which zones have nothing to do with. This rule means
// something only where levels run horizontally.
//
// A pseudo-element, not a border, for two reasons. A border-separate table
// puts an 8px gutter between columns, and a border draws at the cell's own
// edge rather than in that gutter, so the rule would sit hard against the
// next cell instead of between the two. And the boundary column keeps the
// transparent spacer, so its label stays on the same 9px inset as every
// other column's: the rule adds no box at all.
//
// -bottom-2 is the border-spacing, not a nudge: each rule reaches down
// through the gutter to meet the next row's, so the segments close into one
// line rather than reading as a column of ticks.
export const MATRIX_ZONE_RULE_CLASS =
  "after:-bottom-2 after:-left-1 after:absolute after:top-0 after:w-px after:bg-border after:content-['']"
