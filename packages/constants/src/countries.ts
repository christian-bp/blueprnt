// Shared country domain constants. The country list drives the onboarding
// country screen; the currency map is the simplicity-first derivation
// (derive instead of asking): every country has exactly one default
// currency, and anything outside the list falls back to EUR.

export const COUNTRY_KEYS = ["se", "no", "dk", "fi", "other"] as const
export type CountryKey = (typeof COUNTRY_KEYS)[number]

export const CURRENCY_BY_COUNTRY = {
  se: "SEK",
  no: "NOK",
  dk: "DKK",
  fi: "EUR",
  other: "EUR",
} as const satisfies Record<CountryKey, string>

const COUNTRY_KEY_SET = new Set<string>(COUNTRY_KEYS)

export function clampCountry(country: string | undefined): CountryKey {
  return country !== undefined && COUNTRY_KEY_SET.has(country)
    ? (country as CountryKey)
    : "other"
}

// The default currency for a country; unknown countries resolve to EUR
// (via the "other" clamp).
export function defaultCurrencyFor(country: string | undefined): string {
  return CURRENCY_BY_COUNTRY[clampCountry(country)]
}
