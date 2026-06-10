"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

const TYPE_MS = 35
const ERASE_MS = 18
const HOLD_MS = 2200
const GAP_MS = 600

interface TypewriterState {
  phrase: number
  length: number
  mode: "typing" | "erasing"
}

// An animated placeholder for an empty textarea: example phrases type in
// character by character, hold, erase, and cycle (the polyform onboarding
// pattern, JS-driven so the phrases stay i18n strings). Decorative only:
// aria-hidden, pointer events off, and the host hides it as soon as the
// field has content. Under reduced motion the first phrase shows statically.
//
// The overlay mirrors the Textarea component's padding and typography
// (px-2.5 py-2 text-base md:text-sm) so the text sits exactly where typed
// input will appear.
export function TypewriterPlaceholder({
  phrases,
  className,
}: {
  phrases: string[]
  className?: string
}) {
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<TypewriterState>({
    phrase: 0,
    length: 0,
    mode: "typing",
  })

  useEffect(() => {
    if (reducedMotion === true || phrases.length === 0) return
    const phrase = phrases[state.phrase % phrases.length] ?? ""
    let delay: number
    let next: TypewriterState
    if (state.mode === "typing") {
      if (state.length < phrase.length) {
        delay = TYPE_MS
        next = { ...state, length: state.length + 1 }
      } else {
        delay = HOLD_MS
        next = { ...state, mode: "erasing" }
      }
    } else if (state.length > 0) {
      delay = ERASE_MS
      next = { ...state, length: state.length - 1 }
    } else {
      delay = GAP_MS
      next = {
        phrase: (state.phrase + 1) % phrases.length,
        length: 0,
        mode: "typing",
      }
    }
    const id = setTimeout(() => setState(next), delay)
    return () => clearTimeout(id)
  }, [state, reducedMotion, phrases])

  const phrase = phrases[state.phrase % phrases.length] ?? ""
  const text =
    reducedMotion === true ? (phrases[0] ?? "") : phrase.slice(0, state.length)

  return (
    <span
      aria-hidden="true"
      data-testid="typewriter-placeholder"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 overflow-hidden whitespace-nowrap px-2.5 py-2 text-base text-muted-foreground md:text-sm",
        className
      )}
    >
      {text}
    </span>
  )
}
