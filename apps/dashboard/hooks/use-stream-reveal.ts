"use client"

import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

// A frame the reveal advances by at minimum, so a short reply that arrives
// in a single flush still flows across a few frames instead of popping in
// whole.
const STREAM_REVEAL_FLOOR_CHARS_PER_FRAME = 3
// A frame the reveal never advances by more than, no matter how large the
// backlog: a fast model's flush is still one large jump in arrived text, and
// without this cap the catch-up rate below would reveal it as whole blocks
// per frame rather than a readable stream (the failure mode a per-block fade
// makes visible: short later blocks finishing before long earlier ones).
// Sized to roughly reading speed and to the server's own word-paced
// streamText transform (ASSISTANT_STREAM_SMOOTHING_MS, packages/backend's
// convex/ai/config.ts): comfortably above that arrival rate so the backlog
// still drains rather than growing without bound, but low enough that no
// single frame ever reveals more than a couple of words.
export const STREAM_REVEAL_CEILING_CHARS_PER_FRAME = 14
// The backlog (arrived text not yet revealed) is closed within this many
// milliseconds of lag while streaming: a large flush accelerates the reveal
// rather than trailing arrival, up to the ceiling above. The ceiling can
// make actual catch-up take longer than this window; it is a target the
// per-frame step chases, never a rate the ceiling is allowed to exceed.
const STREAM_REVEAL_CATCHUP_MS = 400
// Assumed duration of one frame, used only as the fallback for the very
// first tick of a chase (no previous timestamp yet exists to measure a real
// delta from); every later tick measures the actual gap between frames.
const STREAM_REVEAL_FRAME_BUDGET_MS = 1000 / 60

// The states a reply this hook paces can be in. "streaming" paces at the
// adaptive catch-up rate; "complete" (the reply finished normally) keeps
// pacing at the ceiling until the backlog drains, rather than snapping,
// because the source arrives word-paced and short-tailed; "stopped" and
// "failed" have nothing worth pacing and snap straight to the arrived text.
export type StreamRevealPhase = "streaming" | "complete" | "stopped" | "failed"

// Paces how much of `text` is revealed for rendering: the revealed prefix
// only ever grows, one requestAnimationFrame at a time, in arrival order,
// instead of jumping straight to whatever a Convex flush just delivered (a
// flush can carry several paragraphs at once, which otherwise all fade in
// together). `text` is the full arrived text so far (a streaming message's
// active text content); `phase` says whether pacing should run and, once it
// stops, why.
//
// The chase rate adapts to backlog so the revealed prefix never trails
// arrival by more than STREAM_REVEAL_CATCHUP_MS, capped at
// STREAM_REVEAL_CEILING_CHARS_PER_FRAME per frame: order and readability
// beat latency, so a large backlog takes longer to catch up rather than
// popping in. `text` must only ever grow while `phase` is "streaming" or
// "complete" (the caller's snapshot is append-only); this hook does not
// defend against it shrinking.
//
// `phase` "stopped" or "failed" snaps straight to the full text: nothing is
// left to pace. Reduced motion (the app's shared MotionConfig signal, read
// via useReducedMotion) skips pacing entirely and always renders the
// arrived text as-is, matching every other reduced-motion passthrough in
// this app, for every phase including "complete".
export function useStreamReveal(
  text: string,
  phase: StreamRevealPhase
): string {
  const reducedMotion = useReducedMotion()
  const paced = phase === "streaming" && reducedMotion !== true
  const [revealed, setRevealed] = useState(() => (paced ? "" : text))
  // Read inside the frame loop without retriggering the effect on every
  // reveal step: the loop must only restart when the INPUT changes (new
  // text arrived, or pacing turned on/off), never when its own output does.
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  useEffect(() => {
    // A "complete" backlog keeps draining instead of snapping; every other
    // non-paced case (stopped, failed, reduced motion at any phase) snaps.
    const draining = phase === "complete" && reducedMotion !== true
    if (!paced && !draining) {
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
    // Unused while draining a completed reply: nothing more is arriving, so
    // there is no deadline to chase, only the ceiling to drain at.
    let deadline: number | undefined
    const tick = (now: number) => {
      const delta =
        previous === undefined ? STREAM_REVEAL_FRAME_BUDGET_MS : now - previous
      previous = now
      const current = revealedRef.current
      const backlog = text.length - current.length
      if (backlog <= 0) return
      let perFrame: number
      if (paced) {
        deadline ??= now + STREAM_REVEAL_CATCHUP_MS
        const remaining = deadline - now
        const deadlineStep =
          remaining <= 0
            ? backlog
            : Math.max(
                STREAM_REVEAL_FLOOR_CHARS_PER_FRAME,
                Math.ceil((backlog * delta) / remaining)
              )
        perFrame = Math.min(STREAM_REVEAL_CEILING_CHARS_PER_FRAME, deadlineStep)
      } else {
        perFrame = STREAM_REVEAL_CEILING_CHARS_PER_FRAME
      }
      const nextLength = Math.min(text.length, current.length + perFrame)
      setRevealed(text.slice(0, nextLength))
      if (nextLength < text.length) {
        frameId = requestAnimationFrame(tick)
      }
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [text, paced, phase, reducedMotion])

  return revealed
}
