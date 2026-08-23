"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is and its one explainer
// on the left, and the journey instrument CENTRED ON THE PAGE at the same
// level.
//
// The instrument sits RIGHT-ALIGNED on the row, opposite the title, at every
// width the two fit on one line. This is the arrangement the row had before
// the instrument ever floated, and it is the one that never has to be
// defended: title and instrument each own an end, so no locale's title length
// and no sidebar width can put one on top of the other.
//
// Below md the row wraps and the instrument takes its own line, right-aligned
// there too, because at 496px of row (768px viewport less the 240px sidebar
// and the page padding) a 448px instrument leaves the title nothing.
//
// Shared rather than hand-rolled per section so the two title rows cannot
// drift into different type, spacing, help placement or instrument position.
export function SectionTitleRow({
  eyebrow,
  heading,
  headingRef,
  help,
  instrument,
}: {
  // The section's stage label, leading the title on the same line rather than
  // stacked above it: this row's height is the thing every chapter's content
  // begins under, and a second line would move all four of them.
  eyebrow?: ReactNode
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        {eyebrow}
        <h3
          className="font-semibold text-base outline-none"
          ref={headingRef}
          tabIndex={headingRef === undefined ? undefined : -1}
        >
          {heading}
        </h3>
        {help}
      </div>
      {instrument !== undefined && (
        <div className="flex w-full justify-end md:ms-auto md:w-auto">
          {instrument}
        </div>
      )}
    </div>
  )
}
