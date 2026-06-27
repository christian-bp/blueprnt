import { useTranslations } from "next-intl"
import { BackgroundAurora } from "@/components/auth/background-aurora"
import { RotatingValueLine } from "@/components/auth/rotating-value-line"
import { Logo } from "@/components/logo"

// The branded left half of the auth/onboarding shell. Desktop only (the shell
// hides it below lg). A light surface with a soft drifting aurora behind the
// wordmark, rotating value line, and tagline (the midday composition, in light
// mode). Content sits above the aurora via z-10; overflow-hidden clips the blobs
// to the panel.
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-background p-12 lg:flex lg:w-1/2">
      <BackgroundAurora />
      {/* self-start so the SVG keeps its intrinsic width instead of being
          stretched full-width by the column's align-items (which would center
          the wordmark via preserveAspectRatio). */}
      <Logo
        label={t("title")}
        className="relative z-10 h-8 self-start text-brand"
      />
      <div className="relative z-10 flex flex-col gap-3">
        <RotatingValueLine />
        <p className="text-muted-foreground text-sm">
          {t("auth.brand.tagline")}
        </p>
      </div>
    </div>
  )
}
