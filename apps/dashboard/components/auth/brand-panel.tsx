import { useTranslations } from "next-intl"
import { Logo } from "@/components/logo"
import { RotatingValueLine } from "@/components/auth/rotating-value-line"

// The branded left half of the auth/onboarding shell. Desktop only (the shell
// hides it below lg). Fixed dark surface regardless of app theme, so the
// treatment is stable across both auth and onboarding. Wordmark top, the
// rotating value line and tagline at the bottom (the midday composition).
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="hidden flex-col justify-between bg-neutral-950 p-12 text-neutral-100 lg:flex lg:w-1/2">
      <Logo label={t("title")} className="h-8 text-brand" />
      <div className="flex flex-col gap-3">
        <RotatingValueLine />
        <p className="text-neutral-400 text-sm">{t("auth.brand.tagline")}</p>
      </div>
    </div>
  )
}
