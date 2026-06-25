"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of the model section, shown as header tabs (mirrors the Work
// section's SectionTabs and the Admin section's AdminTabs). Criteria is the
// /model index (the 0-5 evaluation scale); Weighting is the nested route (the
// 1-5 allocation). Splitting them across pages is what keeps the role-facing
// scale from being confused with the weighting. The underline uses a layoutId
// distinct from the other sections' so they never cross-animate. The header
// only mounts this inside the model section, so one tab is always active.
const TABS = [
  { labelKey: "criteria", href: "/model" },
  { labelKey: "weighting", href: "/model/weighting" },
] as const

export function ModelTabs() {
  const t = useTranslations("dashboard.model.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()

  return (
    <nav aria-label={tNav("model")} className="flex h-full items-stretch gap-1">
      {TABS.map((tab) => {
        // The index tab (Criteria, /model) is active unless the weighting
        // sub-route matches.
        const active =
          tab.href === "/model"
            ? !pathname.startsWith("/model/weighting")
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
                layoutId="model-tab-underline"
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
