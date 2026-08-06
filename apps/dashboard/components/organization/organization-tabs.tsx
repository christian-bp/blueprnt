"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

// Sub-pages of the organization section, shown as header tabs (mirrors
// AccountTabs). The sidebar renders the same list under the Organization
// entry; both surfaces come from SECTION_PAGES so they cannot drift apart.
// General covers the org profile + logo; Members covers the team roster,
// invitations, and roles. The underline uses a distinct layoutId so it never
// cross-animates with other sections.
export function OrganizationTabs() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const active = deepestMatch(
    SECTION_PAGES.organization.map((page) => page.href),
    pathname
  )

  return (
    <nav
      aria-label={t("nav.organization")}
      className="flex h-full items-stretch gap-1"
    >
      {SECTION_PAGES.organization.map((page) => {
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
                layoutId="organization-tab-underline"
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
