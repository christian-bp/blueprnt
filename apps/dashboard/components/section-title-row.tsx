"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is and its one
// explainer on the left, where the whole journey stands on the right. The
// instrument rides THIS row rather than the journey row below it, because a
// section's overall state belongs with the section's name; down among the
// tabs it read as one more thing in the switcher.
//
// Shared rather than hand-rolled per section so the two title rows cannot
// drift into different type, spacing, help placement or instrument position.
//
// The instrument does not set this row's height. It is a two-pixel strip with
// nothing to hover, so it centres on the title's own line box and the row
// measures exactly what the heading measures.
export function SectionTitleRow({
  heading,
  headingRef,
  help,
  instrument,
}: {
  heading: ReactNode
  // An optional programmatic focus target. Never reachable by Tab, so the
  // heading carries outline-none: the browser's default ring would draw
  // around a title nobody clicked.
  headingRef?: RefObject<HTMLHeadingElement | null>
  // The section's own concept help, beside the title it explains.
  help?: ReactNode
  // The journey instrument, right-aligned opposite the title.
  instrument?: ReactNode
}) {
  return (
    // It WRAPS rather than shrinks: the instrument holds a fixed width, so on
    // a narrow viewport it comes down under the title whole instead of
    // squeezing its segments into slivers, and justify-between keeps it
    // against the right edge on whichever line it lands on.
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
      {instrument}
    </div>
  )
}
