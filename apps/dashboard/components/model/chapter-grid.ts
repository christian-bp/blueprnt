// The one grid the model section's chapters lay their dimension columns out
// on. Every chapter that draws columns uses it in BOTH its states, and the
// drift pins in each chapter's own tests bind its skeleton to it, so no two
// of them can drift into different grids however many chapters adopt it.
// They must keep the same grid: a criterion has to stay where the reader last
// saw it as the reader moves from choosing it, to weighting it, to
// documenting it.
//
// Four across begins at 2xl, not xl: at a 1440-class laptop width the four
// columns compress to about 272px each and the criterion titles wrap hard,
// while the 2x2 arrangement at those widths reads comfortably. From 1536 up
// there is room for four, and the section runs the full viewport width to
// give it to them.
export const CHAPTER_GRID_CLASS =
  "grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4"
