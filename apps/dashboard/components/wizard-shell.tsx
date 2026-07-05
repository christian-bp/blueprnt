"use client"

import { cn } from "@workspace/ui/lib/utils"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

// The shared full-screen frame for the step wizards (onboarding, import): a
// plain, chrome-light task layout with a pinned header bar (exit control or
// wordmark left, account controls right), a <main> that scrolls internally
// when a step is taller than the viewport, and a pinned footer for the step
// dots. When the content overflows, a subtle divider appears under the header
// and above the footer as a scroll cue (toggled via border COLOR, transparent
// -> border, so there is no layout shift). The auth surfaces keep the
// split-screen AuthShell; this frame has no card and no aurora so wide,
// data-dense steps get the full viewport.
export function WizardShell({
  children,
  headerLeft,
  headerRight,
  footer,
  contentClassName,
  contentKey,
}: {
  children: ReactNode
  headerLeft?: ReactNode
  headerRight?: ReactNode
  footer?: ReactNode
  contentClassName?: string
  /** Changes when the wizard moves to a new step: resets the scroll to top. */
  contentKey?: string | number
}) {
  const mainRef = useRef<HTMLElement>(null)
  const [showHeaderCue, setShowHeaderCue] = useState(false)
  const [showFooterCue, setShowFooterCue] = useState(false)

  // Cues reflect the <main> scroll position: header divider once scrolled down
  // from the top, footer divider while there is more content below.
  const update = useCallback(() => {
    const el = mainRef.current
    if (el === null) return
    setShowHeaderCue(el.scrollTop > 0)
    setShowFooterCue(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    update()
    const el = mainRef.current
    // ResizeObserver is absent in the jsdom test env; guard so tests do not
    // throw (the initial update() still runs; cues just stay off under test).
    if (el === null || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update])

  // A new step starts at the top: without this, the scroll position of a
  // long step carries over to the next one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: contentKey is the trigger, not an input
  useEffect(() => {
    const el = mainRef.current
    if (el !== null) {
      el.scrollTop = 0
    }
    update()
  }, [contentKey])

  return (
    <div className="flex h-svh flex-col bg-background">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-transparent border-b px-6 py-4 transition-colors",
          showHeaderCue && "border-border"
        )}
      >
        <div className="flex items-center gap-2">{headerLeft}</div>
        <div className="flex items-center gap-2">{headerRight}</div>
      </div>
      {/* Vertical centering via my-auto on the child (not justify-center),
          so content centers when it fits and scrolls from the top when it
          overflows (justify-center on a scroll container clips the top). */}
      <main
        ref={mainRef}
        onScroll={update}
        className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6 md:p-10"
      >
        <div
          className={cn(
            "my-auto flex w-full max-w-2xl flex-col gap-8",
            contentClassName
          )}
        >
          {children}
        </div>
      </main>
      {footer ? (
        <div
          className={cn(
            "border-transparent border-t px-6 pt-4 pb-8 transition-colors",
            showFooterCue && "border-border"
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  )
}
