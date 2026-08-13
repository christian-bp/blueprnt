"use client"

import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

// A frame the reveal advances by at minimum, so a short reply that arrives
// in a single flush still flows across a few frames instead of popping in
// whole.
const STREAM_REVEAL_FLOOR_CHARS_PER_FRAME = 3
// The backlog (arrived text not yet revealed) is closed within this many
// milliseconds of lag at all times: a large flush accelerates the reveal
// rather than trailing arrival, so it finishes shortly after the stream's
// final flush instead of continuing to animate after the reply is done.
const STREAM_REVEAL_CATCHUP_MS = 400
// Assumed duration of one frame, used only as the fallback for the very
// first tick of a chase (no previous timestamp yet exists to measure a real
// delta from); every later tick measures the actual gap between frames.
const STREAM_REVEAL_FRAME_BUDGET_MS = 1000 / 60

// Paces how much of `text` is revealed for rendering: the revealed prefix
// only ever grows, one requestAnimationFrame at a time, in arrival order,
// instead of jumping straight to whatever a Convex flush just delivered (a
// flush can carry several paragraphs at once, which otherwise all fade in
// together). `text` is the full arrived text so far (a streaming message's
// active text content); `streaming` says whether pacing should run at all.
//
// The chase rate adapts to backlog so the revealed prefix never trails
// arrival by more than STREAM_REVEAL_CATCHUP_MS and always finishes shortly
// after the last flush lands, no matter how much text a single flush
// delivered. `text` must only ever grow while `streaming` is true (the
// caller's snapshot is append-only); this hook does not defend against it
// shrinking.
//
// `streaming` false (the reply finalized, was stopped, or failed) snaps
// straight to the full text: nothing is left to pace. Reduced motion (the
// app's shared MotionConfig signal, read via useReducedMotion) skips pacing
// entirely and always renders the arrived text as-is, matching every other
// reduced-motion passthrough in this app.
export function useStreamReveal(text: string, streaming: boolean): string {
  const reducedMotion = useReducedMotion()
  const paced = streaming && reducedMotion !== true
  const [revealed, setRevealed] = useState(() => (paced ? "" : text))
  // Read inside the frame loop without retriggering the effect on every
  // reveal step: the loop must only restart when the INPUT changes (new
  // text arrived, or pacing turned on/off), never when its own output does.
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  useEffect(() => {
    if (!paced) {
      setRevealed(text)
      return
    }
    if (revealedRef.current.length >= text.length) return

    let frameId: number
    let previous: number | undefined
    // Set on the chase's first tick, to the moment ~STREAM_REVEAL_CATCHUP_MS
    // from now: the rate below is derived from the time actually LEFT until
    // this deadline (shrinking every frame), not from the fixed catch-up
    // window, so the backlog depletes linearly and reaches zero AT the
    // deadline instead of merely shrinking by a fixed fraction forever.
    let deadline: number | undefined
    const tick = (now: number) => {
      const delta =
        previous === undefined ? STREAM_REVEAL_FRAME_BUDGET_MS : now - previous
      previous = now
      const current = revealedRef.current
      const backlog = text.length - current.length
      if (backlog <= 0) return
      deadline ??= now + STREAM_REVEAL_CATCHUP_MS
      const remaining = deadline - now
      const perFrame =
        remaining <= 0
          ? backlog
          : Math.max(
              STREAM_REVEAL_FLOOR_CHARS_PER_FRAME,
              Math.ceil((backlog * delta) / remaining)
            )
      const nextLength = Math.min(text.length, current.length + perFrame)
      setRevealed(text.slice(0, nextLength))
      if (nextLength < text.length) {
        frameId = requestAnimationFrame(tick)
      }
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [text, paced])

  return revealed
}
