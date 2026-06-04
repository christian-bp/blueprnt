import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import type sv from "../messages/sv.json"
import { routing } from "./routing"

type Messages = typeof sv

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
        ? import("../messages/sv.json")
        : import(`../messages/${locale}.json`))
    ).default
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    messages = (await import("../messages/sv.json")).default
  }

  return { locale, messages }
})
