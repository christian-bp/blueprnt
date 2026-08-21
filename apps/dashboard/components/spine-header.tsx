"use client"

import type { ReactNode, RefObject } from "react"

// The title row of a guided section: what the section is, and where it stands,
// on one line. The name and its help sit left, the journey instrument and its
// counter sit right, and the tab row renders directly under it.
//
// Shared rather than hand-rolled per section, because a stable right-hand
// position for the instrument is the whole point of the layout: two sections
// composing their own flex rows would eventually put the same reading at two
// different heights, and a reader moving between them would have to find it
// again each time.
//
// It WRAPS rather than shrinks. The instrument holds a fixed width, so on a
// narrow viewport the right side comes down under the title whole instead of
// squeezing four segments into slivers, and `justify-between` keeps it against
// the right edge on the line it lands on.
export function SpineHeader({
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
  // The journey instrument plus the section's own overall counter.
  instrument: ReactNode
}) {
  return (
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
      <div className="flex items-center gap-2">{instrument}</div>
    </div>
  )
}
