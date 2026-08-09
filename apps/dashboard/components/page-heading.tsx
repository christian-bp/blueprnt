import type { ReactNode } from "react"

// The top title for dashboard pages, matching CardTitle's treatment so page
// titles and card/section titles share one identity. A single control point:
// change the style here and every page title follows. Kept as an h2 to match
// the existing page-heading hierarchy (the header bar carries the section
// identity above it). Titles stay in the regular ink: the brand rose is also a
// data-viz colour, and a rose heading over a chart encoded in two other hues
// puts three accents on one card.
export function PageHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-medium text-lg">{children}</h2>
}
