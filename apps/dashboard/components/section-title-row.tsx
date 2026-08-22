"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is and its one explainer
// on the left, and the journey instrument CENTRED ON THE PAGE at the same
// level.
//
// Centred on the page's own axis, not laid out against the title: the
// instrument is the section's whole state, so it belongs on the reader's
// centre line rather than wherever a title of that length happens to leave
// room. A locale whose title is four characters longer must not move it.
//
// A three-column grid (1fr auto 1fr) rather than absolute positioning, which
// is what this row used to do and what could not be made safe. Absolute
// centring overlaps the title whenever half the row minus half the instrument
// is narrower than the title, and with the sidebar taking 240px that is TRUE
// at every width below 2xl: at lg the row is 736px, which leaves 144px beside
// a 448px instrument against a title that needs about 273. The grid centres
// the instrument exactly while the title fits its own column, and slides it
// right rather than under the title when it does not. Off-centre is a
// compromise; overlapping text is a defect.
//
// Below md the row wraps instead: the instrument takes its own full-width line
// under the title and centres there, because at 496px of row there is no
// arrangement that puts both on one line.
//
// Shared rather than hand-rolled per section so the two title rows cannot
// drift into different type, spacing, help placement or instrument position.
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
  // The journey instrument, centred on the page.
  instrument?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:grid md:grid-cols-[1fr_auto_1fr]">
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
      {instrument !== undefined && (
        <div className="flex w-full justify-center md:w-auto">{instrument}</div>
      )}
    </div>
  )
}
