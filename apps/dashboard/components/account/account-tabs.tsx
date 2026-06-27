"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of the account section, shown as header tabs (mirrors ModelTabs).
// Profile covers display name, email and language; Security covers password,
// two-step verification, and account deletion. The underline uses a layoutId
// distinct from other sections so they never cross-animate.
const TABS = [
  { labelKey: "profile", href: "/account/profile" },
  { labelKey: "security", href: "/account/security" },
] as const

export function AccountTabs() {
  const t = useTranslations("dashboard.account.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()

  return (
    <nav
      aria-label={tNav("accountSettings")}
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
                layoutId="account-tab-underline"
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
