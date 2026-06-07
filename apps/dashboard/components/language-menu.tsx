"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { type Locale, routing } from "@workspace/i18n/routing"
import { Flag } from "@workspace/ui/flag"
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useSetPreviewLocale } from "@/components/locale-provider"

// Language names are autonyms (each language in itself), identical across
// the message files, so the picker is readable whatever the active locale.
const LANGUAGE_LABEL_KEYS = {
  sv: "languages.sv",
  en: "languages.en",
  nb: "languages.nb",
  da: "languages.da",
  fi: "languages.fi",
} as const satisfies Record<Locale, string>

// Representative flag per language (decorative; the autonym is the label).
const FLAG_BY_LOCALE = {
  sv: "SE",
  en: "GB",
  nb: "NO",
  da: "DK",
  fi: "FI",
} as const satisfies Record<Locale, string>

// The language picker submenu shared by every avatar/user menu (the
// onboarding header and the sidebar user menu). Render it inside a
// DropdownMenuContent. The trigger row shows the CURRENT language (flag +
// autonym); hovering it opens the list (native Radix submenu behavior).
// Picking persists the per-user override (the top of the getUiLocale
// chain, beating the browser fallback) optimistically.
export function LanguageMenuSub() {
  const t = useTranslations("dashboard")
  const locale = useLocale()
  const setUiLocale = useMutation(api.accounts.onboarding.setUiLocale)
  const setPreviewLocale = useSetPreviewLocale()

  // Optimistic: preview instantly, persist the override, and let the
  // preview auto-release when the server confirms. On failure the preview
  // is dropped so the UI falls back to the server value.
  async function handleLocaleChange(value: string) {
    setPreviewLocale(value)
    try {
      await setUiLocale({ locale: value })
    } catch {
      setPreviewLocale(null)
    }
  }

  const active = locale as Locale

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Flag code={FLAG_BY_LOCALE[active] ?? "GB"} alt="" size="S" />
        {t(LANGUAGE_LABEL_KEYS[active] ?? "languages.en")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={handleLocaleChange}
        >
          {routing.locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} className="gap-2">
              <Flag code={FLAG_BY_LOCALE[code]} alt="" size="S" />
              {t(LANGUAGE_LABEL_KEYS[code])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
