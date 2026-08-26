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
