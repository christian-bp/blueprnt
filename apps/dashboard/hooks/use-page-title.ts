"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { formatPageTitle } from "@/lib/page-title"

// Sets the browser-tab title for a page. The dashboard renders entirely on the
// client and swaps locale live (LocaleProvider), so titles are set from
// document.title in an effect rather than via Next.js server metadata: that way
// the tab follows a live language switch and dynamic names (a role or family)
// resolved from a client query can be used directly. The root layout still
// declares a server-side default ("blueprnt") for the first paint.
//
// Pass a single label or an ordered list of segments (e.g. ["Admin", "Users"]);
// undefined segments are dropped, so a still-loading dynamic name falls back to
// the brand alone.
export function usePageTitle(
  title: string | undefined | Array<string | undefined>
) {
  // The brand lives in i18n (dashboard.title) so it stays the single source and
  // tracks the active locale like every other string.
  const brand = useTranslations("dashboard")("title")
  const segments = Array.isArray(title) ? title : [title]
  const full = formatPageTitle(segments, brand)

  useEffect(() => {
    document.title = full
  }, [full])
}
