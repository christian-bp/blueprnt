import da from "@workspace/i18n/messages/da.json"
import en from "@workspace/i18n/messages/en.json"
import fi from "@workspace/i18n/messages/fi.json"
import nb from "@workspace/i18n/messages/nb.json"
import sv from "@workspace/i18n/messages/sv.json"
import { routing, TIME_ZONE } from "@workspace/i18n/routing"
import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, resolveUiLocale } from "@/lib/locale"

// STATIC imports, deliberately, one per locale in routing.ts.
//
// These were dynamic `import()` calls behind a literal map, which is the
// pattern next-intl's own docs use and which loads only the requested locale.
// It cannot stay: under Turbopack (Next 16.3.0) a message file reached through
// `import()` is never re-read by a RUNNING dev server, so every newly added
// key renders as MISSING_MESSAGE until the server is restarted.
//
// Measured against a live server, editing one key repeatedly and re-fetching
// without restarting:
//   dynamic import  ->  0 of 3 edits visible
//   static import   ->  3 of 3 visible
//   swapping this file from dynamic to static mid-session flipped the SAME
//   process from 0/3 to 3/3, which is what pins it on the import style.
// Turbopack's persistent dev cache is NOT involved (3/3 with it both on and
// off), so do not "fix" a recurrence by disabling that again.
//
// vercel/next.js#91768 reports the same symptom, but it is closed as not
// reproducible and its reporter found static imports did NOT help them, so
// treat it as a lead rather than the explanation.
//
// The cost is that all locales sit in the SERVER bundle (~584 KB of JSON,
// parsed once per process) instead of one. Nothing changes for the browser:
// next-intl serializes only the active locale's messages into the provider.
const MESSAGES = { en, sv, nb, da, fi }

// The dashboard has no locale in the URL (PLAN-V1 section 7); the language is a
// setting resolved from the user/organization at runtime (see LocaleProvider).
// Here we serve the last-known language from the locale cookie so the initial
// SSR paint and <html lang> match before the reactive getUiLocale query lands.
export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = resolveUiLocale(cookieValue, routing.defaultLocale)
  return { locale, messages: MESSAGES[locale], timeZone: TIME_ZONE }
})
