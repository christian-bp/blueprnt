"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useSetPreviewLocale } from "@/components/locale-provider"
import { OptionCard } from "@/components/option-card"
import { useAutoAdvance } from "@/hooks/use-auto-advance"
import { type SupportedLocale, detectBrowserLocale } from "@/lib/locale"

const LANGUAGES = ["sv", "en", "nb", "da", "fi"] as const

const LANGUAGE_KEYS = {
  sv: "languages.sv",
  en: "languages.en",
  nb: "languages.nb",
  da: "languages.da",
  fi: "languages.fi",
} as const satisfies Record<(typeof LANGUAGES)[number], string>

// Screen 2: the organization's default language as option cards. Picking a
// card previews the UI language instantly (the established behavior),
// persists it, and auto-advances once the other cards have faded away. In
// the fresh flow the marked card derives from the browser locale so the
// cards and the rendered page agree on first paint.
export function LanguageScreen({
  orgId,
  saved,
  onDone,
}: {
  orgId: string
  saved: string | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const setPreviewLocale = useSetPreviewLocale()
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const activeLocale = useLocale()
  const [detected] = useState<string>(
    () => saved ?? detectBrowserLocale(activeLocale as SupportedLocale)
  )
  // picked survives a failed save, so the marked card keeps agreeing with
  // the previewed page language while the error alert shows.
  const { chosen, picked, failed, choose } = useAutoAdvance({
    persist: (code) => updateSettings({ orgId, language: code }),
    onDone,
  })
  const marked = picked ?? detected

  // Fresh flow only: if the detected browser locale differs from the active
  // UI locale, preview it immediately so the selected card and the page
  // language never disagree on first paint. Mount-only by design.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (saved === null && detected !== activeLocale) {
      setPreviewLocale(detected)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("language.heading")}
      </h1>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {LANGUAGES.map((code) => (
          <OptionCard
            key={code}
            title={t(LANGUAGE_KEYS[code])}
            selected={marked === code}
            faded={chosen !== null && chosen !== code}
            onSelect={() => {
              setPreviewLocale(code)
              choose(code)
            }}
          />
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </div>
  )
}
