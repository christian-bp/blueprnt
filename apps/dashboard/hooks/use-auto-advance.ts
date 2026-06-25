"use client"

import { useEffect, useRef, useState } from "react"

// A beat of rest after the fade-out completes, so the user sees their choice
// standing alone before the next screen appears. Without it the hand-off
// feels rushed.
// The choice-screen rhythm lives in ONE place: the picked card fades for
// OPTION_FADE_MS (the card imports it from here), then the screen holds for
// ADVANCE_PAUSE_MS before advancing.
export const OPTION_FADE_MS = 300
const ADVANCE_PAUSE_MS = 450

// The full auto-advance wait: the fade of the non-chosen options plus the rest
// beat. Internal to the choice-screen rhythm (used by useAutoAdvance below).
function advanceDelay(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, OPTION_FADE_MS + ADVANCE_PAUSE_MS)
  )
}

// Choice screens have no Next button: picking an option persists it, fades
// the other options away, and advances automatically once BOTH the save and
// the fade-plus-pause have finished. On failure the cards fade back in and
// the screen shows its error alert instead of advancing.
//
// `chosen` is the in-flight pick (null when idle); screens fade the other
// cards while it is set. `picked` is the last pick and survives a failed
// save, so screens keep the user's choice marked next to the error alert.
// Re-entrant calls while a pick is in flight are ignored.
export function useAutoAdvance({
  persist,
  onAdvance,
}: {
  persist: (code: string) => Promise<unknown>
  onAdvance: () => void
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // If the screen unmounts during the wait (the user navigated away via the
  // dots mid-pause), the pending advance must die with it: the save still
  // completes, but firing onAdvance() against the wizard's NEW position would
  // walk the user one step forward from wherever they just navigated to.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function choose(code: string) {
    if (chosen !== null) return
    setChosen(code)
    setPicked(code)
    setFailed(false)
    try {
      await Promise.all([persist(code), advanceDelay()])
      if (!mountedRef.current) return
      onAdvance()
    } catch {
      if (!mountedRef.current) return
      setChosen(null)
      setFailed(true)
    }
  }

  return { chosen, picked, failed, choose }
}
