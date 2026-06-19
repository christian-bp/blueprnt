"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"

// Sub-pages of the platform-admin section, shown as header tabs (mirrors the
// Work section's SectionTabs). Users is the /admin index; Organizations is the
// nested route. The underline uses a layoutId distinct from the Work tabs' so
// the two never cross-animate. The header only mounts this inside the admin
// section, so one tab is always active.
const TABS = [
  { labelKey: "users", href: "/admin" },
  { labelKey: "organizations", href: "/admin/organizations" },
  { labelKey: "auditLog", href: "/admin/audit-log" },
] as const

export function AdminTabs() {
  const t = useTranslations("dashboard.admin.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()
  const onOrganizations = pathname.startsWith("/admin/organizations")
  const onAuditLog = pathname.startsWith("/admin/audit-log")

  return (
    <nav aria-label={tNav("admin")} className="flex h-full items-stretch gap-1">
      {TABS.map((tab) => {
        // Users is the index, active for any admin path that is neither the
        // organizations nor the audit-log sub-route.
        const active =
          tab.href === "/admin/organizations"
            ? onOrganizations
            : tab.href === "/admin/audit-log"
              ? onAuditLog
              : !onOrganizations && !onAuditLog
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
                layoutId="admin-tab-underline"
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
