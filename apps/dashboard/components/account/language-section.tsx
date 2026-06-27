"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { type Locale, routing } from "@workspace/i18n/routing"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Flag } from "@workspace/ui/flag"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useSetPreviewLocale } from "@/components/locale-provider"
import { FLAG_BY_LOCALE, LANGUAGE_LABEL_KEYS } from "@/lib/locales"

// Inline display-language picker for the Profile tab of account settings.
// Uses the same optimistic locale-change logic as LanguageMenuSub: the preview
// switches immediately and rolls back to the server value on error. Selecting
// a locale persists it via the setUiLocale mutation with no submit button.
export function LanguageSection() {
  const t = useTranslations("dashboard")
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
    } catch {
      setPreviewLocale(null)
    }
  }

  const active = locale as Locale

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.profile.languageLabel")}</CardTitle>
        <CardDescription>
          {t("account.profile.languageDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={active} onValueChange={handleLocaleChange}>
          <SelectTrigger
            aria-label={t("account.profile.languageLabel")}
            className="max-w-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {routing.locales.map((code) => (
              <SelectItem key={code} value={code}>
                <span className="flex items-center gap-2">
                  <Flag code={FLAG_BY_LOCALE[code]} alt="" size="S" />
                  {t(LANGUAGE_LABEL_KEYS[code])}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
