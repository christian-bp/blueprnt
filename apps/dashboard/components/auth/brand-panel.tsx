import { useTranslations } from "next-intl"
import { Logo } from "@/components/logo"

// The branded left column of the auth shell. Desktop only (hidden below lg).
// Transparent: the shell's full-viewport aurora shows through it, so this just
// reserves the left half and carries the wordmark in the top-left corner (the
// midday composition, in light mode).
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="relative hidden lg:flex lg:w-1/2">
      <Logo
        label={t("title")}
        className="absolute top-12 left-12 z-10 h-8 text-brand"
      />
    </div>
  )
}
