"use client"

import { SettingsFrame, SettingsRow } from "@/components/settings-frame"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Locale } from "@workspace/i18n/routing"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "@/lib/toast"
import { LanguageSelect } from "@/components/language-select"
import { useSetPreviewLocale } from "@/components/locale-provider"

// Inline display-language picker for the Profile tab of account settings.
// Uses the same optimistic locale-change logic as LanguageMenuSub: the preview
// switches immediately and rolls back to the server value on error. Selecting
// a locale persists it via the setUiLocale mutation with no submit button.
export function LanguageSection() {
  const t = useTranslations("dashboard")
  const tToast = useTranslations("dashboard.toast")
  const locale = useLocale()
  const setUiLocale = useMutation(api.accounts.onboarding.setUiLocale)
  const setPreviewLocale = useSetPreviewLocale()

  // Optimistic: preview instantly, persist the override, and let the
  // preview auto-release when the server confirms. On failure drop the
  // preview so the UI falls back to the server value.
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
    <SettingsFrame title={t("account.profile.languageLabel")}>
      <SettingsRow
        align="center"
        label={t("account.profile.languageLabel")}
        description={t("account.profile.languageDescription")}
      >
        <LanguageSelect
          value={active}
          onValueChange={handleLocaleChange}
          ariaLabel={t("account.profile.languageLabel")}
          className="w-full max-w-sm"
        />
      </SettingsRow>
    </SettingsFrame>
  )
}
