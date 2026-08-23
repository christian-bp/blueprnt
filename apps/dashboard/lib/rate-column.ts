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
