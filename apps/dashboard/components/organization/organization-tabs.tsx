"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of the organization section, shown as header tabs (mirrors
// AccountTabs). General covers the org profile + logo; Members covers the team
// roster, invitations, and roles. The underline uses a distinct layoutId so it
// never cross-animates with other sections.
const TABS = [
  { labelKey: "general", href: "/organization/general" },
  { labelKey: "members", href: "/organization/members" },
] as const

export function OrganizationTabs() {
  const t = useTranslations("dashboard.organization.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()

  return (
    <nav
      aria-label={tNav("organization")}
      className="flex h-full items-stretch gap-1"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
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
