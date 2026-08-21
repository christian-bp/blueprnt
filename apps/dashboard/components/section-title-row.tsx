"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is and its one explainer
// on the left, and the journey instrument CENTRED ON THE PAGE at the same
// level.
//
// Centred on the page's own axis, not laid out against the title: the
// instrument is the section's whole state, so it belongs on the reader's
// centre line rather than wherever a title of that length happens to leave
// room. That means absolute positioning against this row, so a long title in
// one locale and a short one in another put the instrument in the same place.
//
// Below md the row wraps instead: the instrument takes its own full-width line
// under the title and centres there, because an absolutely centred 384px box
// and a title would overlap on a phone.
//
// The row reserves the instrument's height (its name line, its bar and its
// count line) rather than measuring the title alone, so an absolutely
// positioned instrument has its own room and nothing below the row is
// overlapped.
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
    <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 md:min-h-12">
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
        <div className="flex w-full justify-center md:absolute md:left-1/2 md:w-auto md:-translate-x-1/2">
          {instrument}
        </div>
      )}
    </div>
  )
}
