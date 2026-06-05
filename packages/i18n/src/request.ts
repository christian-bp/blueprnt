import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import type en from "../messages/en.json"
import { routing, TIME_ZONE } from "./routing"

type Messages = typeof en

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  let messages: Messages
  try {
    messages = (
      await (locale === routing.defaultLocale
        ? import("../messages/en.json")
        : import(`../messages/${locale}.json`))
    ).default
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    messages = (await import("../messages/en.json")).default
  }

  return { locale, messages, timeZone: TIME_ZONE }
})
