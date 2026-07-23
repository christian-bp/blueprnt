// Shared scaffolding classes for the two band matrices (bands x tracks and
// families x bands), so their scroll/sticky behavior cannot drift.

// The scroll wrapper: horizontal for wide grids (the wide-content rule), and
// vertically filling the height-bounded tab panel on /work (flex-1 inside
// the panel's flex column) so long grids scroll INSIDE it. That inner
// vertical scroll is what makes the sticky header work at all: an
// overflow-x container is a scroll container for both axes, so a sticky
// header inside it can never stick to the window; it can only stick to the
// wrapper's own scrollport.
export const MATRIX_WRAPPER_CLASS = "min-h-0 flex-1 overflow-auto"

// A sticky column-header cell. border-separate's border-spacing leaves
// transparent slits between and around the header cells that scrolled chips
// would show through; the before-pseudo extends each cell's background half
// a gap sideways (meeting its neighbor's in the middle) and a full gap up
// and down (covering the wrapper edge above and the spacing row below),
// forming one solid strip behind the sticky row.
export const MATRIX_COL_HEADER_CLASS =
  "sticky top-0 z-10 bg-background before:absolute before:-inset-x-1 before:-inset-y-2 before:-z-10 before:bg-background before:content-['']"
