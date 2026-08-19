"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

// Sub-pages of the model section, shown as header tabs (mirrors the Work
// section's SectionTabs and the Admin section's AdminTabs). The sidebar
// renders the same list under the Model entry; both surfaces come from
// SECTION_PAGES so they cannot drift apart. Two tabs: the build view is the
// /model index (choosing criteria AND weighting them, one surface), and
// Method is the nested route (documentation, bias review, approval). What
// stays off the build view is the role-facing 1-5 evaluation scale, which
// belongs to rating a role: it is the weighting's own 1-5 that it would
// otherwise be confused with. The underline uses a layoutId distinct from the
// other sections' so they never cross-animate. The header only mounts this
// inside the model section, so one tab is always active.
export function ModelTabs() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const active = deepestMatch(
    SECTION_PAGES.model.map((page) => page.href),
    pathname
  )

  return (
    <nav
      aria-label={t("nav.model")}
      className="flex h-full items-stretch gap-1"
    >
      {SECTION_PAGES.model.map((page) => {
        const isActive = page.href === active
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex items-center px-2 font-medium text-sm transition-colors ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(page.labelKey)}
            {isActive && (
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
