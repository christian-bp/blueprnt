import type { MetadataRoute } from "next"
import { getPathname } from "@workspace/i18n/navigation"
import type { Locale } from "@workspace/i18n/routing"
import { routing } from "@workspace/i18n/routing"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://blueprnt.se"

// All marketing pages and their canonical internal hrefs.
const PAGES = ["/", "/how-it-works", "/about"] as const

type PageHref = (typeof PAGES)[number]

// Build the absolute URL for a given locale and page href. getPathname
// already includes the locale prefix for non-default locales when
// localePrefix is "as-needed" (e.g. "/sv/sa-funkar-det"); for the default
// locale it returns the bare slug (e.g. "/how-it-works"). No manual prefix
// needed: just prepend the base URL.
function absoluteUrl(locale: Locale, href: PageHref): string {
  const pathname = getPathname({ locale, href })
  return `${BASE_URL}${pathname}`
}

// The sitemap lists every page × locale combination. Alternates per entry
// give crawlers the full hreflang map inline, which is the Google-recommended
// sitemap approach (https://developers.google.com/search/docs/specialty/international/localized-versions).
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const href of PAGES) {
    for (const locale of routing.locales) {
      const url = absoluteUrl(locale, href)

      // Build alternates for this page across every locale.
      const alternates: Record<string, string> = {}
      for (const l of routing.locales) {
        alternates[l] = absoluteUrl(l, href)
      }
      // x-default = English URL.
      alternates["x-default"] = absoluteUrl(
        routing.defaultLocale as Locale,
        href
      )

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: href === "/" ? 1 : 0.8,
        alternates: { languages: alternates },
      })
    }
  }

  return entries
}
