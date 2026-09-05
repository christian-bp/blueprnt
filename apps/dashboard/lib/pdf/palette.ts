// The one ink scale every generated document draws from, taken from the
// cover's own palette so a report reads as one printed object from its first
// page to its last.
//
// It is a WARM neutral scale, not a grey one: the documents used to mix a
// cool grey box fill and a cool grey hairline into a warm sheet, which is the
// kind of mismatch a reader feels without being able to name. Every step here
// sits on the cover's hue at the cover's chroma, and each one was placed at
// the same lightness as the grey it replaced, so the swap cost no contrast
// anywhere: 18.4 / 12.6 / 7.2 / 2.7 against white paper, against the 18.9 /
// 12.6 / 7.5 / 2.9 the greys held.
//
// The brand rose is deliberately absent. It is the app's action colour and a
// printed report has nothing to click; with the gender violet and blue
// already carrying an encoding in these documents, a third hue that encodes
// nothing was one too many.

// Body text and headings.
export const INK = "#141412"
// Supporting text: values under a label, axis ticks, a paragraph that is not
// the page's argument.
export const INK_BODY = "#373329"
// Notes, table meta, page numbers, the cover's subtitle.
export const INK_SECONDARY = "#5c574d"
// Labels above a value, and anything that must recede behind what it names.
export const INK_MUTED = "#a49e91"
// Every hairline in the kit: table rules, the cover's frame, section
// dividers. One weight, one colour.
export const RULE = "#d8d4c9"
// The one tinted surface: a boxed aside on a white page, and the cover's own
// sheet.
export const SURFACE = "#f6f4ef"

// The cover's band and its lower edge. Only the cover draws these.
export const COVER_PAPER = "#faf9f5"
export const COVER_BAND = "#eee9dd"
export const COVER_BAND_LINE = "#e0dbcd"

// The four depths of the analysis-status bar, darkest first, in the order
// ANALYSIS_STATUSES declares. One ordered scale rather than four separate
// colours, because the four statuses are positions in the same work; drawn
// from the scale above rather than from a hue of its own, because a status is
// not a verdict and the documents already spend their two hues on gender.
//
// Steps 0 and 2 ARE the ink scale's secondary and muted; 1 and 3 are the
// lightness steps between and beyond them. Even spacing (dE 13.1 / 15.0 /
// 11.5) is what lets four depths be told apart at bar height, and the
// lightest holds 1.87 against the page, so the last segment survives a
// photocopy. Being a pure lightness ramp, it also survives greyscale and
// every colour-vision deficiency unchanged, which the rose ramp it replaced
// did not.
export const STATUS_RAMP = [
  INK_SECONDARY,
  "#7d776c",
  INK_MUTED,
  "#c3bdb1",
] as const
