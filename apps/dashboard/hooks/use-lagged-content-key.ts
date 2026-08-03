"use client"

import { useCallback, useRef, useState } from "react"

// Pairs WizardShell's contentKey with an AnimatePresence mode="wait" step
// transition. WizardShell resets its scroll position the instant contentKey
// changes; handing it the LIVE step key fires that reset while the outgoing
// screen is still fading out, so a long scrolled step visibly jumps to the
// top on its way out. This hook lags the key by one step: it only advances
// once AnimatePresence's onExitComplete fires, which is the blank moment
// between screens (the outgoing one has fully exited, the incoming one has
// not yet mounted), so the scroll reset lands where it is invisible.
//
// Pass the current key in; wire the returned onExitComplete to
// AnimatePresence and the returned displayedKey to WizardShell's contentKey.
// The AnimatePresence child's own `key` stays the live key, unrelated to this
// hook, so the crossfade still triggers immediately on every change.
export function useLaggedContentKey<T>(key: T) {
  const [displayedKey, setDisplayedKey] = useState(key)
  // Latest key across renders: onExitComplete is a stable callback, so it
  // needs a ref (not a closure over `key`) to read whatever was live at the
  // moment the outgoing screen actually finished exiting.
  const keyRef = useRef(key)
  keyRef.current = key

  const onExitComplete = useCallback(() => {
    setDisplayedKey(keyRef.current)
  }, [])

  return { displayedKey, onExitComplete }
}
