// The step's own number, which is also the key that picks it AND the option's
// selection mark: it stands where the radio dot stood, because a dot beside a
// number is two marks for one answer and the number is the one that says which
// step this is. Pale brand while the step is unchosen, solid once it is, so
// the mark reads the same way the radio's own filled state did.
export const RATE_STEP_MARK_CLASS = [
  // Where the radio dot sat: the row's top-left, nudged the same half step
  // the vendor's own indicator takes when the option carries a description,
  // so the mark rides the first line rather than the option's middle.
  "flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-md",
  "bg-brand/10 font-mono text-brand text-xs tabular-nums",
  "group-data-checked/questionnaire-choice:bg-brand",
  "group-data-checked/questionnaire-choice:text-primary-foreground",
].join(" ")

// The vendored choice draws its own radio indicator as a fixed child. The
// number replaces it, so the indicator is hidden at the call site rather than
// forked in the vendor file; it is aria-hidden either way, and the choice's
// real input is untouched.
export const RATE_CHOICE_CLASS =
  "[&>[data-slot=questionnaire-choice-indicator]]:hidden"

// The Enter keycap inside the rate flow's filled Next button, shared by the
// live stepper and the loading state's stand-in so the two can never drift in
// size or ink. Two deliberate steps off the vendored Kbd, both because the
// keycap sits INSIDE a filled primary button: sized down (the shared 20px
// block reads as a second label beside a 36px button's own), and tinted with
// the button's own foreground instead of the opaque muted chip, which is
// exactly how upstream's Kbd already adapts to its one filled surface (the
// tooltip: bg-background/20 in that surface's ink).
export const RATE_NEXT_KBD_CLASS =
  "h-4 min-w-4 translate-x-0.5 bg-primary-foreground/20 px-1 text-primary-foreground"

// Where the two controls sit in the questionnaire's action row, shared so the
// live step and the loading state's stand-in cannot drift.
//
// The row is the design system's own QuestionnaireActions grid, but its
// Previous button shows itself only for a multi-item form, which this flow is
// not (it owns one item at a time and its own step index). The back control is
// therefore an ordinary Button wearing Previous's own slot; the primary
// control is the questionnaire's Submit, which already carries the second of
// these, so only the loading state's stand-in has to name it.
export const RATE_PREVIOUS_SLOT =
  "col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0"
export const RATE_PRIMARY_SLOT =
  "col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0"

// The rating route's reading column.
//
// ONE container for the whole route, breadcrumb row included, because the two
// used to be siblings with independent widths: the page's outer wrapper spanned
// the content region while the card inside it carried `max-w-2xl` with no
// `mx-auto`. The header therefore ran the full region and the card sat pinned
// to the region's left edge, which reads as a card centred on some other axis
// with a dead margin beside it. Whatever the content region is at the moment
// (the inner sidebar expands, collapses, and slides over), a single container
// cannot disagree with itself about where its centre is.
//
// Narrow on purpose: rating is one criterion at a time, read as sentences and
// answered, so it is a reading column and not a data surface. Every state of
// the route uses it, so nothing shifts as the route moves between loading, a
// precondition message, the stepper, and the reveal.
export const RATE_COLUMN = "mx-auto w-full max-w-2xl space-y-4"
