"use client"

import { AnimatePresence, motion } from "motion/react"
import type { ReactNode, RefObject } from "react"
import { SPRING } from "@/lib/motion"

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

// The figures beside the instrument, and what replaces them once there is
// nothing left to count.
//
// "17 of 17" is a sum that has stopped being a reading: it asks the reader to
// compare two numbers to learn a fact the section could simply state. A
// finished journey says the word instead, in the success ink the Metod cards'
// statuses already use for a signed-off state. The word alone, no mark beside
// it: at this size an icon reads as decoration, which is the same reason those
// cards carry none.
//
// Shared rather than written twice, so the two guided sections can never
// disagree about when a journey is finished or how it says so. What stays with
// the caller is the WORDS, both the counter's message and the finished one,
// because a message key belongs to the surface that owns the concept.
export function SpineCounter({
  done,
  total,
  doneLabel,
  renderCount,
}: {
  done: number
  total: number
  // The finished word, already localized.
  doneLabel: string
  // The unfinished figures, as the caller's own tag-based message: both
  // numbers move while the reader works, so each carries NumberFlow rather
  // than being interpolated into a sentence.
  renderCount: () => ReactNode
}) {
  // A journey with no work in it is not a finished journey, it is an empty
  // one: a section whose data has not arrived yet reads 0 of 0, and
  // congratulating that would be the first thing it ever said.
  const finished = total > 0 && done >= total
  return (
    // One at a time (mode="wait"), so the figures leave before the word
    // arrives. The two are different widths and the slot sits at the end of a
    // right-aligned row, so the instrument beside it does move when they swap;
    // waiting means it moves while the slot is empty, which is the one moment
    // there is nothing on screen to be seen jumping. Overlapping them instead
    // would resize the slot mid-crossfade, under both states at once.
    //
    // initial={false}: landing on a finished section states the fact, it does
    // not perform it. Only a crossing while the reader is watching animates.
    <span className="flex justify-end">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={finished ? "done" : "count"}
          animate={{ opacity: 1, y: 0 }}
          className={`whitespace-nowrap text-sm ${
            finished
              ? "font-medium text-success"
              : "text-muted-foreground tabular-nums"
          }`}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          transition={SPRING}
        >
          {finished ? doneLabel : renderCount()}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
