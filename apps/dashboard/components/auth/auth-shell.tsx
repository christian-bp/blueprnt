"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { BackgroundAurora } from "@/components/auth/background-aurora"
import { BrandPanel } from "@/components/auth/brand-panel"
import { Logo } from "@/components/logo"

// The shared split-screen frame for the auth surfaces: sign-in, the password
// flows, 2FA, and change email. Left: the branded panel (lg+ only). Right: a
// bordered rounded card on the aurora backdrop; content centers when it fits
// and <main> scrolls internally when it overflows. The step wizards
// (onboarding, import) use WizardShell instead.
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("dashboard")
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
        <Logo
          label={t("title")}
          className="relative z-10 m-6 h-8 self-start text-brand lg:hidden"
        />
        {/* Vertical centering via my-auto on the child (not justify-center),
            so content centers when it fits and scrolls from the top when it
            overflows (justify-center on a scroll container clips the top). */}
        <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6 md:p-10">
          <div className="my-auto flex w-full max-w-sm flex-col gap-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
