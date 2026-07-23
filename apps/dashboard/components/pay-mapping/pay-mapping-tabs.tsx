"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of one kartläggning (pay-mapping run), shown as header tabs
// (mirrors PeopleTabs). Unlike the static sections, the hrefs are per-run,
// built from the slug in the current path: /pay-mappings/<slug> is the
// Overview index; /analysis and /report nest under it. The header mounts this
// only inside a run (a slug segment exists), so the list page keeps its plain
// header. The underline uses a layoutId distinct from the other sections' so
// they never cross-animate.
const TABS = [
  { labelKey: "overview", sub: "" },
  { labelKey: "analysis", sub: "analysis" },
  { labelKey: "report", sub: "report" },
] as const

// Resolves a run path's first sub-segment to its tab label key, the single
// source of truth for what the sub-pages are called (the run shell reuses it
// for the page title). Any deeper segments still belong to their tab;
// unknown segments fall back to the Overview index.
export function payMappingSubPageKey(sub: string | undefined) {
  return TABS.find((tab) => tab.sub === (sub ?? ""))?.labelKey ?? "overview"
}

export function PayMappingTabs() {
  const t = useTranslations("dashboard.payMapping.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()
  // /pay-mappings/<slug>[/<sub>] -> ["pay-mappings", slug, sub?]
  const [, slug, sub] = pathname.split("/").filter(Boolean)
  if (slug === undefined) return null
  // The /review takeover is a fixed, full-viewport overlay covering the
  // site header; these tabs would only be hidden by that z-index, not
  // actually removed from the page, staying reachable by keyboard/screen
  // reader underneath it and matching no tab (there is no "review" entry).
  // Render nothing while it is up.
  if (sub === "review") return null

  return (
    <nav
      aria-label={tNav("payMapping")}
      className="flex h-full items-stretch gap-1"
    >
      {TABS.map((tab) => {
        const href =
          tab.sub === ""
            ? `/pay-mappings/${slug}`
            : `/pay-mappings/${slug}/${tab.sub}`
        const active = (sub ?? "") === tab.sub
        return (
          <Link
            key={tab.labelKey}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center px-2 font-medium text-sm transition-colors ${
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.labelKey)}
            {active && (
              <motion.span
                layoutId="pay-mapping-tab-underline"
                transition={SPRING}
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
