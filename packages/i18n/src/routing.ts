import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  // English is the default; Norwegian = bokmål (nb)
  locales: ["en", "sv", "nb", "da", "fi"],
  defaultLocale: "en",
  // Marketing site strategy: default locale without URL prefix (/pricing),
  // others prefixed (/sv/priser). The dashboard app will not use URL-based
  // locales at all (language is a user setting there).
  localePrefix: "as-needed",
  // Remember the language choice across sessions (one year).
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
})

export type Locale = (typeof routing.locales)[number]
