import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { BrandPanel } from "@/components/auth/brand-panel"
import { Logo } from "@/components/logo"

// The shared split-screen frame for sign-in, password, 2FA, and onboarding.
// Left: the branded panel (lg+ only). Right: a vertically centered, card-less
// content column with optional top-right (account menu) and bottom (step dots)
// slots, plus a mobile-only wordmark (the BrandPanel carries the wordmark on
// desktop). Pass contentClassName to widen the content past the default max-w-sm
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
    <div className="flex min-h-svh bg-background">
      <BrandPanel />
      {/* Right side: a bordered, rounded, inset card on lg (the polyform login
          treatment); full-bleed and borderless on mobile. The lg margins reveal
          the light base, and the column stretches to the inset height via the
          flex parent (so no min-h-svh is needed here). */}
      <div className="relative flex w-full flex-col lg:my-2 lg:mr-2 lg:w-1/2 lg:rounded-2xl lg:border lg:border-border lg:bg-card">
        {headerRight ? (
          <div className="absolute top-4 right-4 z-10">{headerRight}</div>
        ) : null}
        <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
          <div
            className={cn(
              "flex w-full max-w-sm flex-col gap-8",
              contentClassName
            )}
          >
            <Logo
              label={t("title")}
              className="h-10 self-center text-brand lg:hidden"
            />
            {children}
          </div>
        </main>
        {footer ? <div className="pb-8">{footer}</div> : null}
      </div>
    </div>
  )
}
