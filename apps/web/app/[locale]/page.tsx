import { use } from "react"
import { useTranslations } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { getPathname } from "@workspace/i18n/navigation"
import { routing, type Locale } from "@workspace/i18n/routing"

import { Button } from "@workspace/ui/components/button"

const localeNames: Record<Locale, string> = {
  sv: "Svenska",
  en: "English",
  nb: "Norsk",
  da: "Dansk",
  fi: "Suomi",
}

export default function Page({
  params,
}: Readonly<{ params: Promise<{ locale: Locale }> }>) {
  const { locale } = use(params)
  setRequestLocale(locale)

  const t = useTranslations("web.home")

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex min-w-0 max-w-md flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-heading font-medium text-2xl">{t("title")}</h1>
          <p>{t("tagline")}</p>
          <Button className="mt-2">{t("cta")}</Button>
        </div>
        <nav className="flex gap-3 font-mono text-muted-foreground text-xs">
          {routing.locales.map((l) => (
            <a
              key={l}
              href={getPathname({ href: "/", locale: l })}
              className={l === locale ? "text-foreground underline" : undefined}
            >
              {localeNames[l]}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
