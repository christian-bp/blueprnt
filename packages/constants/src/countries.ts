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

// The distinct currencies an organization can use (the set of CURRENCY_BY_COUNTRY
// values). Drives the currency picker. Order: the Nordic krona currencies, then EUR.
export const CURRENCY_KEYS = ["SEK", "NOK", "DKK", "EUR"] as const
export type CurrencyKey = (typeof CURRENCY_KEYS)[number]

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

// The organization's default language also derives from the country
// (simplicity-first); "other" and unknown values fall back to English.
export const LANGUAGE_BY_COUNTRY = {
  se: "sv",
  no: "nb",
  dk: "da",
  fi: "fi",
  other: "en",
} as const satisfies Record<CountryKey, string>

export function defaultLanguageFor(country: string | undefined): string {
  return LANGUAGE_BY_COUNTRY[clampCountry(country)]
}

// Inverse of LANGUAGE_BY_COUNTRY: the country key whose default language is the
// given code (sv -> se, nb -> no, da -> dk, fi -> fi, en -> other). Returns
// undefined for an unset or unknown language, so a picker shows no selection
// rather than defaulting to a country. Used where one CountrySelect drives both
// the country and the (country-derived) language field.
export function countryForLanguage(
  language: string | undefined
): CountryKey | undefined {
  if (language === undefined) return undefined
  const entry = COUNTRY_KEYS.find(
    (key) => LANGUAGE_BY_COUNTRY[key] === language
  )
  return entry
}

// The monthly hours that count as full time, per country: the customary
// collective-agreement divisor for the standard full-time week (SE 40 h with
// the 165 divisor most Swedish agreements use, NO 37.5 h, DK 37 h, FI 37.5 h,
// other 40 h x 52 / 12). Seeds the organization's default (editable in
// settings) and is the last fallback when neither the person nor the
// organization carries a value, so an hourly rate can always be converted.
export const FULL_TIME_HOURS_BY_COUNTRY = {
  se: 165,
  no: 162.5,
  dk: 160.33,
  fi: 162.5,
  other: 173.33,
} as const satisfies Record<CountryKey, number>

export function defaultFullTimeHoursFor(country: string | undefined): number {
  return FULL_TIME_HOURS_BY_COUNTRY[clampCountry(country)]
}
