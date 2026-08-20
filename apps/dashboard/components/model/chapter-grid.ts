// The grid the Kriterier and Viktning chapters both lay their dimension
// columns out on, declared once and used by all four call sites (each
// chapter's loaded state and its own loading skeleton), so no two of them can
// ever drift into different grids. The two chapters must keep the same grid:
// a criterion has to stay where the reader last saw it when the reader moves
// from choosing it to weighting it.
//
// Four across begins at 2xl, not xl: at a 1440-class laptop width the four
// columns compress to about 272px each and the criterion titles wrap hard,
// while the 2x2 arrangement at those widths reads comfortably. From 1536 up
// there is room for four, and the section runs the full viewport width to
// give it to them.
export const CHAPTER_GRID_CLASS =
  "grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4"
