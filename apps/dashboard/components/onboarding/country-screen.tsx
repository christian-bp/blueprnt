"use client"

import { Globe02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  COUNTRY_KEYS,
  type CountryKey,
  defaultCurrencyFor,
  defaultLanguageFor,
} from "@workspace/constants"
import { Flag } from "@workspace/ui/flag"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { OptionCard } from "@/components/option-card"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { useAutoAdvance } from "@/hooks/use-auto-advance"

// The country list and the derived currency AND default language live in
// @workspace/constants (simplicity-first: neither is asked; "other" gets
// EUR and English). Adjustable later in the organization settings, outside
// onboarding. The org language is an ORGANIZATION setting (starter sets,
// invitations); it never drives the active user's UI language, which
// follows the browser unless overridden in the user menu.
const COUNTRY_LABEL_KEYS = {
  se: "countries.se",
  no: "countries.no",
  dk: "countries.dk",
  fi: "countries.fi",
  other: "countries.other",
} as const satisfies Record<CountryKey, string>

// Screen 3: country as option cards. Picking one stores the country and its
// derived currency, then auto-advances once the other cards have faded.
export function CountryScreen({
  orgId,
  savedCountry,
  onAdvance,
}: {
  orgId: string
  savedCountry: string | null
  onAdvance: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const { chosen, picked, failed, choose } = useAutoAdvance({
    persist: (code) =>
      updateSettings({
        orgId,
        country: code,
        currency: defaultCurrencyFor(code),
        language: defaultLanguageFor(code),
      }),
    onAdvance,
  })
  // Fresh flow marks nothing; a revisit marks the saved country. picked
  // survives a failed save so the choice stays marked next to the alert.
  const marked = picked ?? savedCountry

  return (
    <ScreenShell heading={tScreens("country.heading")}>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {COUNTRY_KEYS.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(COUNTRY_LABEL_KEYS[code])}
            // The media slot is aria-hidden (the title names the option), so
            // the flag is decorative: alt stays empty. "Other" has no flag
            // and gets a neutral globe in the same slot.
            media={
              code === "other" ? (
                <HugeiconsIcon
                  icon={Globe02Icon}
                  className="size-4 text-muted-foreground"
                />
              ) : (
                <Flag code={code} alt="" size="M" hasDropShadow />
              )
            }
            selected={marked === code}
            faded={chosen !== null && chosen !== code}
            onSelect={() => choose(code)}
          />
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </ScreenShell>
  )
}
