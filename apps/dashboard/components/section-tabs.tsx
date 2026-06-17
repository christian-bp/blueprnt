"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// The sub-pages of the Work section, in order. `section` is the first path
// segment that marks the tab active ("work" -> Overview, "roles" -> Roles).
const TABS = [
  { labelKey: "overview", href: "/work", section: "work" },
  { labelKey: "roles", href: "/roles", section: "roles" },
] as const

// Section tabs for the Work section, shown in the header (the sidebar is a flat
// menu now). Two link-tabs with a sliding underline; the active tab is resolved
// from the current path. Reduced motion is honored globally via the app
// MotionConfig. The header only mounts this inside the Work section, so it
// always assumes one of these tabs is active.
export function SectionTabs() {
  const t = useTranslations("dashboard.nav")
  const pathname = usePathname()
  const section = pathname.split("/").filter(Boolean)[0]

  return (
    // Reuse nav.work as the accessible name so this navigation landmark stays
    // distinct from the sidebar's.
    <nav aria-label={t("work")} className="flex h-full items-stretch gap-1">
      {TABS.map((tab) => {
        const active = section === tab.section
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
                layoutId="section-tab-underline"
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
