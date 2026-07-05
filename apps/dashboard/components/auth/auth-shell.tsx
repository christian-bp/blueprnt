import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { BrandPanel } from "@/components/auth/brand-panel"
import { Logo } from "@/components/logo"

// The shared split-screen frame for sign-in, password, 2FA, onboarding, and import.
// Left: the branded panel (lg+ only). Right: a card pinned to viewport height.
// The brand panel, headerRight slot, mobile wordmark, and footer (step dots)
// stay fixed; only the <main> scrolls internally when content is taller than the
// viewport. Pass contentClassName to widen the content past the default max-w-sm
// (e.g. the onboarding steps).
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
  return (
    <div className="flex h-svh bg-background">
      <BrandPanel />
      {/* Right side: a bordered, rounded, inset card on lg (the polyform login
          treatment); full-bleed and borderless on mobile. min-h-0 + overflow-hidden
          constrain the card to the frame height so the rounded corners clip
          correctly and only <main> scrolls internally. */}
      <div className="relative flex min-h-0 w-full flex-col overflow-hidden lg:my-2 lg:mr-2 lg:w-1/2 lg:rounded-2xl lg:border lg:border-border lg:bg-card">
        {headerRight ? (
          <div className="absolute top-4 right-4 z-10">{headerRight}</div>
        ) : null}
        {/* Mobile-only wordmark, pinned top-left (on desktop the BrandPanel
            carries the wordmark, also top-left). */}
        <Logo
          label={t("title")}
          className="relative z-10 m-6 h-8 self-start text-brand lg:hidden"
        />
        {/* Vertical centering is via my-auto on the child (not justify-center here),
            so the content centers when it fits and scrolls from the top when it
            overflows. justify-center on a scroll container clips the top of
            overflowing content (the classic flexbox centering + overflow gotcha). */}
        <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6 md:p-10">
          <div
            className={cn(
              "my-auto flex w-full max-w-sm flex-col gap-8",
              contentClassName
            )}
          >
            {children}
          </div>
        </main>
        {footer ? <div className="pb-8">{footer}</div> : null}
      </div>
    </div>
  )
}
