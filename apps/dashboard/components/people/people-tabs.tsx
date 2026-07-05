"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of the People section, shown as header tabs (mirrors ModelTabs).
// People is the /people index (the directory, including person detail pages);
// Classify is the nested route where HR maps titles to roles and levels. The
// underline uses a layoutId distinct from the other sections' so they never
// cross-animate. The header only mounts this inside the People section.
const TABS = [
  { labelKey: "people", href: "/people" },
  { labelKey: "classify", href: "/people/classify" },
] as const

export function PeopleTabs() {
  const t = useTranslations("dashboard.people.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()

  return (
    <nav
      aria-label={tNav("people")}
      className="flex h-full items-stretch gap-1"
    >
      {TABS.map((tab) => {
        // The index tab (People, /people) is active unless the classify
        // sub-route matches, so person detail pages keep People active.
        const active =
          tab.href === "/people"
            ? !pathname.startsWith("/people/classify")
            : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
                layoutId="people-tab-underline"
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
