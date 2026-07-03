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
import { toast } from "sonner"
import { useSetPreviewLocale } from "@/components/locale-provider"
import { FLAG_BY_LOCALE, LANGUAGE_LABEL_KEYS } from "@/lib/locales"

// The language picker submenu shared by every avatar/user menu (the
// onboarding header and the sidebar user menu). Render it inside a
// DropdownMenuContent. The trigger row shows the CURRENT language (flag +
// autonym); hovering it opens the list (native Radix submenu behavior).
// Picking persists the per-user override (the top of the getUiLocale
// chain, beating the browser fallback) optimistically.
export function LanguageMenuSub() {
  const t = useTranslations("dashboard")
  const tToast = useTranslations("dashboard.toast")
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
      toast.success(tToast("languageUpdated"))
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
