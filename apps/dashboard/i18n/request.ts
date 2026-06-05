import { routing, TIME_ZONE } from "@workspace/i18n/routing"
import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, resolveUiLocale } from "@/lib/locale"

// The dashboard has no locale in the URL (PLAN-V1 section 7); the language is a
// setting resolved from the user/organization at runtime (see LocaleProvider).
// Here we serve the last-known language from the locale cookie so the initial
// SSR paint and <html lang> match before the reactive getUiLocale query lands.
export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = resolveUiLocale(cookieValue, routing.defaultLocale)
  // A literal map keeps the dynamic import statically analysable per locale and
  // matches the structural Messages type from en.json.
  const messages = (
    await {
      en: () => import("@workspace/i18n/messages/en.json"),
      sv: () => import("@workspace/i18n/messages/sv.json"),
      nb: () => import("@workspace/i18n/messages/nb.json"),
      da: () => import("@workspace/i18n/messages/da.json"),
      fi: () => import("@workspace/i18n/messages/fi.json"),
    }[locale]()
  ).default
  return { locale, messages, timeZone: TIME_ZONE }
})
