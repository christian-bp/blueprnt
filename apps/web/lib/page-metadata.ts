import type { Metadata } from "next"
import { getPathname } from "@workspace/i18n/navigation"
import type { Locale } from "@workspace/i18n/routing"
import { routing } from "@workspace/i18n/routing"

// All five marketing locales; driven by routing so it stays in sync when
// new locales are added. The default locale (en) is used as x-default.
const LOCALES = routing.locales

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://blueprnt.se"

type HrefPath = "/" | "/how-it-works" | "/about"

/**
 * Build Next.js Metadata for a marketing page: title, description, and full
 * hreflang alternates (canonical for the current locale + language map across
 * all five locales + x-default = en). Used by all three marketing pages so
 * the SEO plumbing stays in one place.
 */
export function buildPageMetadata({
  title,
  description,
  locale,
  href,
}: {
  title: string
  description: string
  locale: Locale
  href: HrefPath
}): Metadata {
  // getPathname already includes the locale prefix for non-default locales
  // when localePrefix is "as-needed" (e.g. "/sv/om-oss" for sv, "/about"
  // for en). We just prepend the base URL; no manual prefix needed.
  function absoluteUrl(l: Locale): string {
    const pathname = getPathname({ locale: l, href })
    return `${BASE_URL}${pathname}`
  }

  // Canonical: the URL for the current locale.
  const canonical = absoluteUrl(locale)

  // languages map: every locale + x-default → en URL.
  const languages: Record<string, string> = {}
  for (const l of LOCALES) {
    languages[l] = absoluteUrl(l)
  }
  // x-default points to the English (default) URL.
  languages["x-default"] = absoluteUrl(routing.defaultLocale as Locale)

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
  }
}
