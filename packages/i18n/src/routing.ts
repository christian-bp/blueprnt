import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  // English is the default; Norwegian = bokmål (nb)
  locales: ["en", "sv", "nb", "da", "fi"],
  defaultLocale: "en",
  // The dashboard does not use URL-based locales (language is a user
  // setting); this prefix strategy only matters if a URL-routed app joins
  // the workspace again.
  localePrefix: "as-needed",
  // Remember the language choice across sessions (one year).
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
})

export type Locale = (typeof routing.locales)[number]

// Global next-intl time zone (Sweden-first product). Both apps pass this to
// their request configs and client providers so server and client render
// dates identically (avoids next-intl's ENVIRONMENT_FALLBACK warning and
// markup mismatches).
export const TIME_ZONE = "Europe/Stockholm"
