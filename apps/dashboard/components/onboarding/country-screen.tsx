"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  COUNTRY_KEYS,
  type CountryKey,
  defaultCurrencyFor,
} from "@workspace/constants"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { OptionCard } from "@/components/option-card"
import { useAutoAdvance } from "@/hooks/use-auto-advance"

// The country list and the derived currency live in @workspace/constants
// (simplicity-first: currency is never asked, "other" defaults to EUR).
// Adjustable later in the organization settings, outside onboarding.
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
  onDone,
}: {
  orgId: string
  savedCountry: string | null
  onDone: () => void
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
      }),
    onDone,
  })
  // Fresh flow marks nothing; a revisit marks the saved country. picked
  // survives a failed save so the choice stays marked next to the alert.
  const marked = picked ?? savedCountry

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("country.heading")}
      </h1>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {COUNTRY_KEYS.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(COUNTRY_LABEL_KEYS[code])}
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
    </div>
  )
}
