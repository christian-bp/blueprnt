import { useTranslations } from "next-intl"
import { Link } from "@workspace/i18n/navigation"
import { Logo } from "@/components/logo"
import { Button } from "@workspace/ui/components/button"

import { LanguageSwitcher } from "@/components/language-switcher"

const NAV_LINK_CLASS =
  "rounded-sm transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export function SiteHeader() {
  const t = useTranslations("web.nav")
  const tContact = useTranslations("web.contact")
  // External: the dashboard app lives on its own origin, so this is a plain
  // anchor, not a locale-aware Link.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.blueprnt.se"

  return (
    <header className="sticky top-0 z-50 border-hairline border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          aria-label="blueprnt"
          className="rounded-sm text-brand focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          <Logo className="h-11 w-auto" />
        </Link>
        <nav className="hidden items-center gap-9 font-bold text-[13px] text-muted-foreground uppercase tracking-widest sm:flex">
          <Link href="/how-it-works" className={NAV_LINK_CLASS}>
            {t("how")}
          </Link>
          <Link href="/about" className={NAV_LINK_CLASS}>
            {t("about")}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <a
            href={appUrl}
            className={`font-bold text-[13px] text-muted-foreground uppercase tracking-widest ${NAV_LINK_CLASS}`}
          >
            {t("login")}
          </a>
          <Button asChild>
            <a href={`mailto:${tContact("email")}`}>{t("cta")}</a>
          </Button>
        </div>
      </div>
    </header>
  )
}
