"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is and its one explainer
// on the left, and the journey instrument CENTRED ON THE PAGE at the same
// level.
//
// The instrument's position is a three-rung ladder, because one arrangement
// cannot serve every width once the sidebar has taken 240px off the row.
//
// WIDE (2xl and up): centred on the page's own axis. The instrument is the
// section's whole state, so it belongs on the reader's centre line rather than
// wherever a title of that length happens to leave room, and a locale whose
// title is four characters longer must not move it. 2xl is where that
// provably clears: the row is 1152px there, so half of it minus half a 448px
// instrument leaves 352px beside a title that needs about 273.
//
// MID (md to 2xl): right-aligned, the arrangement this row had before the
// instrument ever floated. Centring cannot survive here. At xl the row is
// 992px and leaves 272px against that same 273px title, and at lg only 144px,
// so the centred rung would put the instrument on top of the words.
//
// NARROW (below md): its own full-width line under the title, centred there.
// At 496px of row there is no arrangement that fits both on one line.
//
// The centring is a three-column grid (1fr auto 1fr) rather than absolute
// positioning: it centres exactly while the title fits its own column, and
// slides the instrument right rather than under the title if a future title
// ever outgrows it. Off-centre is a compromise; text over text is a defect.
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
  // The journey instrument, placed by the ladder above.
  instrument?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 2xl:grid 2xl:grid-cols-[1fr_auto_1fr]">
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
        <div className="flex w-full justify-center md:ms-auto md:w-auto 2xl:ms-0">
          {instrument}
        </div>
      )}
    </div>
  )
}
