import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  // Svenska är standard; norska = bokmål (nb)
  locales: ["sv", "en", "nb", "da", "fi"],
  defaultLocale: "sv",
  // Standardspråket utan prefix (/priser), övriga med (/en/pricing)
  localePrefix: "as-needed",
})

export type Locale = (typeof routing.locales)[number]
