import { useTranslations } from "next-intl"
import { BackgroundAurora } from "@/components/auth/background-aurora"
import { Logo } from "@/components/logo"

// The branded left half of the auth/onboarding shell. Desktop only (the shell
// hides it below lg). A light surface with a soft drifting aurora and the
// wordmark in the top-left corner (the midday composition, in light mode).
// Content sits above the aurora via z-10; overflow-hidden clips the blobs to
// the panel.
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="relative hidden overflow-hidden bg-background lg:flex lg:w-1/2">
      <BackgroundAurora />
      <Logo
        label={t("title")}
        className="absolute top-12 left-12 z-10 h-8 text-brand"
      />
    </div>
  )
}
