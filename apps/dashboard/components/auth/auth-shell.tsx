"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { BackgroundAurora } from "@/components/auth/background-aurora"
import { BrandPanel } from "@/components/auth/brand-panel"
import { Logo } from "@/components/logo"

// The shared split-screen frame for sign-in, password, 2FA, onboarding, and
// import. Left: the branded panel (lg+ only). Right: a card pinned to viewport
// height whose <main> scrolls internally when content is taller than the frame;
// the header bar and footer (step dots) stay pinned. When the content overflows,
// a subtle divider appears under the header and above the footer as a scroll cue
// (toggled via border COLOR, transparent -> border, so there is no layout shift).
// Surfaces that pass headerRight (the wizards) get a pinned header bar (mobile
// logo + controls); plain auth surfaces keep the standalone mobile wordmark.
export function AuthShell({
  children,
  headerRight,
  footer,
  contentClassName,
}: {
  children: ReactNode
  headerRight?: ReactNode
  footer?: ReactNode
  contentClassName?: string
}) {
  const t = useTranslations("dashboard")
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

  return (
    <div className="relative flex h-svh bg-background">
      {/* Full-viewport aurora backdrop (desktop only). It sits behind the brand
          column AND the content card, so the drifting glow shows in the card's
          margins (above/below/right) - a continuous living background, not just
          the left panel. Mobile is full-bleed content with no card bg, so the
          aurora is lg-only to keep small screens plain and legible. */}
      <BackgroundAurora className="hidden lg:block" />
      <BrandPanel />
      {/* Right side: bordered rounded inset card on lg; full-bleed on mobile.
          min-h-0 + overflow-hidden constrain it to the frame so only <main>
          scrolls and the rounded corners clip. */}
      <div className="relative flex min-h-0 w-full flex-col overflow-hidden lg:my-4 lg:mr-4 lg:flex-1 lg:rounded-2xl lg:border lg:border-border lg:bg-card">
        {headerRight ? (
          // Pinned header bar (wizards): mobile logo left, controls right.
          <div
            className={cn(
              "flex items-center gap-2 border-transparent border-b px-6 py-4 transition-colors",
              showHeaderCue && "border-border"
            )}
          >
            <Logo label={t("title")} className="h-8 text-brand lg:hidden" />
            <div className="ml-auto">{headerRight}</div>
          </div>
        ) : (
          // Plain auth surfaces: standalone mobile wordmark, unchanged.
          <Logo
            label={t("title")}
            className="relative z-10 m-6 h-8 self-start text-brand lg:hidden"
          />
        )}
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
              "my-auto flex w-full max-w-sm flex-col gap-8",
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
    </div>
  )
}
