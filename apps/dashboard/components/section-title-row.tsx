"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is, and its one
// explainer. Nothing else. The journey's own reading floats with the section's
// pill stack now, where it stays in view while the reader works instead of
// sitting at a scroll position they have left behind.
//
// Shared rather than hand-rolled per section so the two title rows cannot
// drift into different type, spacing or help placement.
export function SectionTitleRow({
  heading,
  headingRef,
  help,
}: {
  heading: ReactNode
  // An optional programmatic focus target. Never reachable by Tab, so the
  // heading carries outline-none: the browser's default ring would draw
  // around a title nobody clicked.
  headingRef?: RefObject<HTMLHeadingElement | null>
  // The section's own concept help, beside the title it explains.
  help?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <h3
        className="font-semibold text-base outline-none"
        ref={headingRef}
        tabIndex={headingRef === undefined ? undefined : -1}
      >
        {heading}
      </h3>
      {help}
    </div>
  )
}
