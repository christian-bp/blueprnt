import { useTranslations } from "next-intl"
import { BackgroundAurora } from "@/components/auth/background-aurora"
import { RotatingValueLine } from "@/components/auth/rotating-value-line"
import { Logo } from "@/components/logo"

// The branded left half of the auth/onboarding shell. Desktop only (the shell
// hides it below lg). A light surface with a soft drifting aurora behind a
// centered, animated value line and tagline (the midday composition, in light
// mode); the wordmark sits in the top-left corner. Content sits above the aurora
// via z-10; overflow-hidden clips the blobs to the panel.
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="relative hidden overflow-hidden bg-background lg:flex lg:w-1/2">
      <BackgroundAurora />
      <Logo
        label={t("title")}
        className="absolute top-12 left-12 z-10 h-8 text-brand"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-12 text-center">
        <RotatingValueLine />
        <p className="max-w-sm text-muted-foreground text-sm">
          {t("auth.brand.tagline")}
        </p>
      </div>
    </div>
  )
}
