"use client"

import { useEffect, useState } from "react"

// A frame that came back within this had time to spare: a 60Hz frame is
// 16.7ms, so the allowance is one frame plus a margin. Anything longer means
// something was still working while the browser wanted to paint.
const QUIET_FRAME_MS = 24
// Two in a row, so a single cheap frame in the middle of a long render (React
// yielding between two commits) does not read as calm.
const QUIET_FRAMES = 2
// The ceiling. A page that never goes quiet (a chart animating on a timer, a
// slow machine) still gets its moment rather than losing it entirely.
const CEILING_MS = 1200

// True once `loaded` holds AND the browser has caught up: the point where an
// arrival animation can be started and actually be SEEN.
//
// `loaded` alone is not that point. Motion drives x/y/rotate on the main
// thread, so an animation started in the same beat as a heavy render (the
// overview's charts mounting the moment their queries land) spends its
// lifetime inside a blocked frame: the elapsed time is charged against it,
// nothing paints, and what reaches the screen is the tail of a burst that
// already finished. An effect that silently does not run, which is exactly how
// it reads.
//
// So this waits for frames that came back on time, measured rather than
// guessed at with a fixed delay: the wait is as long as the work actually
// takes on that machine, and no longer. Frames are also the right clock for
// something nobody can see, because a background tab produces none: the
// animation waits for the reader instead of playing to an empty screen, which
// a timer would not do.
//
// Returns to false when `loaded` does (switching company reloads every query),
// so the next arrival is measured on its own.
export function usePageSettled(loaded: boolean): boolean {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!loaded) {
      setSettled(false)
      return
    }
    let frame = 0
    let quiet = 0
    let previous: number | undefined
    let start: number | undefined
    const tick = (now: number) => {
      start ??= now
      quiet =
        previous !== undefined && now - previous <= QUIET_FRAME_MS
          ? quiet + 1
          : 0
      previous = now
      if (quiet >= QUIET_FRAMES || now - start >= CEILING_MS) {
        setSettled(true)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [loaded])

  return settled
}
