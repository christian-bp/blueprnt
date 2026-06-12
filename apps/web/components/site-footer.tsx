import { useTranslations } from "next-intl"
import { Link } from "@workspace/i18n/navigation"

import { Logo } from "@/components/logo"
import { LanguageSwitcher } from "@/components/language-switcher"

const FOOTER_LINK_CLASS =
  "rounded-sm transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export function SiteFooter() {
  const t = useTranslations("web")
  const email = t("contact.email")

  return (
    <footer className="border-hairline border-t bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="flex max-w-md flex-col gap-3">
            <Link
              href="/"
              aria-label="blueprnt"
              className="self-start rounded-sm text-brand focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
            >
              <Logo className="h-7 w-auto" />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-bold text-muted-foreground text-xs uppercase tracking-widest">
            <Link href="/how-it-works" className={FOOTER_LINK_CLASS}>
              {t("nav.how")}
            </Link>
            <Link href="/about" className={FOOTER_LINK_CLASS}>
              {t("nav.about")}
            </Link>
            {/* The address is data, not copy: it doubles as its own label. */}
            <a
              href={`mailto:${email}`}
              className={`normal-case tracking-normal ${FOOTER_LINK_CLASS}`}
            >
              {email}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 border-hairline border-t pt-6 sm:flex-row sm:items-center">
          <p className="font-bold text-muted-foreground text-xs uppercase tracking-widest">
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  )
}
