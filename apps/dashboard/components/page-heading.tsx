import type { ReactNode } from "react"

// The brand-colored top title for dashboard pages, mirroring CardTitle's brand
// treatment so page titles and card/section titles share one identity. A single
// control point: change the style here and every page title follows. Kept as an
// h2 to match the existing page-heading hierarchy (the header bar carries the
// section identity above it).
export function PageHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-medium text-brand text-lg">{children}</h2>
}
