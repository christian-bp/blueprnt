import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  // Swedish is the default; Norwegian = bokmål (nb)
  locales: ["sv", "en", "nb", "da", "fi"],
  defaultLocale: "sv",
  // Default locale without URL prefix (/priser), others prefixed (/en/pricing)
  localePrefix: "as-needed",
})

export type Locale = (typeof routing.locales)[number]
