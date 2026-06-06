"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { OptionCard } from "@/components/option-card"

const COUNTRIES = ["se", "no", "dk", "fi", "other"] as const
const CURRENCIES = ["SEK", "NOK", "DKK", "EUR"] as const

const COUNTRY_KEYS = {
  se: "countries.se",
  no: "countries.no",
  dk: "countries.dk",
  fi: "countries.fi",
  other: "countries.other",
} as const satisfies Record<(typeof COUNTRIES)[number], string>

// Currency derives from the country (simplicity-first: derive instead of
// asking); the inline Select below the cards is the override.
const CURRENCY_BY_COUNTRY = {
  se: "SEK",
  no: "NOK",
  dk: "DKK",
  fi: "EUR",
  other: "EUR",
} as const satisfies Record<(typeof COUNTRIES)[number], string>

// Screen 3: country as option cards, currency derived with an override.
export function CountryScreen({
  orgId,
  savedCountry,
  savedCurrency,
  onDone,
}: {
  orgId: string
  savedCountry: string | null
  savedCurrency: string | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const [country, setCountry] = useState<string>(savedCountry ?? "se")
  const [currency, setCurrency] = useState<string>(
    savedCurrency ??
      CURRENCY_BY_COUNTRY[
        (savedCountry ?? "se") as keyof typeof CURRENCY_BY_COUNTRY
      ]
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("country.heading")}
      </h1>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {COUNTRIES.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(COUNTRY_KEYS[code])}
            selected={country === code}
            onSelect={() => {
              setCountry(code)
              setCurrency(CURRENCY_BY_COUNTRY[code])
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label id="currency-label" className="text-muted-foreground">
          {tProfile("currency")}
        </Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger
            size="sm"
            aria-labelledby="currency-label"
            className="w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await updateSettings({ orgId, country, currency })
            onDone()
          } catch {
            setFailed(true)
          } finally {
            setPending(false)
          }
        }}
      >
        {tScreens("continueCta")}
      </Button>
    </div>
  )
}
