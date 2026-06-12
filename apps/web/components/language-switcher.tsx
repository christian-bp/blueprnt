"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "@workspace/i18n/navigation"
import { type Locale, routing } from "@workspace/i18n/routing"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

// Each language is named in itself (a reader hunting for their language
// should not have to know the current one), so this is a local constant
// rather than translated messages.
const LOCALE_NAMES: Record<Locale, string> = {
  sv: "Svenska",
  en: "English",
  nb: "Norsk",
  da: "Dansk",
  fi: "Suomi",
}

export function LanguageSwitcher() {
  const t = useTranslations("web.language")
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label={t("label")}>
          {LOCALE_NAMES[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((candidate) => (
          <DropdownMenuItem
            key={candidate}
            onSelect={() => router.replace(pathname, { locale: candidate })}
          >
            {LOCALE_NAMES[candidate]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
