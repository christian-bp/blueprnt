// The role palette: which hue a job gets when a chart encodes WHICH JOB a
// point belongs to (today the equivalent-work scatter's role mode).
//
// Hue alone, and every point stays a circle. Shape was tried here and taken
// out: at mark size a shape difference is a few pixels of silhouette, it
// cannot carry six categories, and the two channels together made a plot of
// individuals read as a plot of symbols. What keeps identity off colour alone
// is not a second channel on the mark but the surface around it: the legend
// names every hue, the hover names the point's own job, and clicking a key
// puts every other job away, so a reader who cannot separate two of these
// hues can still isolate either one. The hues are Okabe-Ito, the
// colour-universal-design set the sciences standardised on, so they are as
// far apart as six hues get; across ALL pairs they still land in the method's
// floor band rather than over its target, and the surface above is what
// carries that (globals.css records the numbers and why the relief holds).
//
// Shape still carries GENDER on the same plot's other mode. That encoding has
// two categories, not six, and it has to survive greyscale and print, which
// is the case a hue cannot answer at all.
//
// Six slots, assigned in a FIXED ORDER and never cycled. A seventh job folds
// into the neutral rather than repeating a hue, because a repeated hue says
// "the same job" and would be a lie. The steps live in globals.css, where the
// comment records the validation they passed; changing one means re-running
// it.
export const ROLE_COLOR_SLOTS = 6

// The key every job past the last slot shares, in a legend and in a hidden
// set alike. Not a job title, so it can never collide with one.
export const OTHER_ROLE_ID = "__other__"

// The neutral every job past the sixth shares.
export const ROLE_OTHER_COLOR = "var(--role-other)"

// The hue for the job at `index` in the chart's own fixed role order, or the
// neutral once the slots run out. Index is the job's position in that order,
// never its rank by any measure the reader can change: a filter that drops a
// job must not repaint the ones that remain.
export function roleColorAt(index: number): string {
  if (index < 0 || index >= ROLE_COLOR_SLOTS) return ROLE_OTHER_COLOR
  return `var(--role-${index + 1})`
}

// The chart's fixed role order, as a lookup from a job's label to its hue.
// Built once from the order the surface already shows (the comparator table's
// own order), so the plot and the table agree about which job is which.
export function roleColorsFor(
  orderedLabels: readonly string[]
): Map<string, string> {
  return new Map(
    orderedLabels.map((label, index) => [label, roleColorAt(index)])
  )
}
