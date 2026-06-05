import { type Locale, routing } from "@workspace/i18n/routing"

// Re-export under the dashboard-local alias so callers do not need to reach
// into the i18n package directly.
export type SupportedLocale = Locale

// Name of the cookie that remembers the last-known dashboard UI language so
// SSR can serve it (and the right <html lang>) on reload before the reactive
// getUiLocale query resolves. The dashboard never carries a locale in the URL
// (PLAN-V1 section 7); the language is a setting.
export const LOCALE_COOKIE = "blueprnt-locale"

// One year, matching the marketing site's localeCookie maxAge (routing.ts).
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Clamp an arbitrary value to one of the five supported locales, falling back
// when it is missing or unsupported. Reused by the request config (cookie ->
// locale), the locale provider (query -> locale), and their tests so the
// supported set lives in exactly one place: routing.locales.
export function resolveUiLocale(
  value: string | null | undefined,
  fallback: Locale
): Locale {
  return value !== null &&
    value !== undefined &&
    (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : fallback
}

// Read the browser's primary language tag (navigator.language), strip the
// region suffix (e.g. "sv-SE" -> "sv"), and clamp to a supported locale.
// Falls back to the provided fallback when navigator is unavailable (SSR) or
// when the browser language is not among the supported five.
export function detectBrowserLocale(
  fallback: SupportedLocale
): SupportedLocale {
  if (typeof navigator === "undefined") return fallback
  const tag = navigator.language ?? ""
  const base = tag.split("-")[0] ?? ""
  return resolveUiLocale(base, fallback)
}
