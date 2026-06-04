import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  // Motsvarar typiskt `[locale]`-segmentet
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  let messages
  try {
    messages = (
      await (locale === routing.defaultLocale
        ? import("../messages/sv.json")
        : import(`../messages/${locale}.json`))
    ).default
  } catch (error) {
    console.error(`Kunde inte ladda meddelanden för locale: ${locale}`, error)
    messages = (await import("../messages/sv.json")).default
  }

  return { locale, messages }
})
