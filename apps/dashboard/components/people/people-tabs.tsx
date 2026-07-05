"use client"

import { Badge } from "@workspace/ui/components/badge"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useOrganization } from "@/components/org-context"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { SPRING } from "@/lib/motion"

// Sub-pages of the People section, shown as header tabs (mirrors ModelTabs).
// People is the /people index (the directory, including person detail pages);
// Classify is the nested route where HR maps titles to roles and levels. The
// Classify tab carries a count badge with the people still waiting for a
// confirmed classification. The underline uses a layoutId distinct from the
// other sections' so they never cross-animate. The header only mounts this
// inside the People section.
const TABS = [
  { labelKey: "people", href: "/people" },
  { labelKey: "classify", href: "/people/classify" },
] as const

export function PeopleTabs() {
  const t = useTranslations("dashboard.people.tabs")
  const tNav = useTranslations("dashboard.nav")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { loading, remaining } = useClassificationSummary(orgId)

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
            {/* Remaining-to-classify count on the Classify tab; hidden while
                loading and when everyone is classified. */}
            {tab.labelKey === "classify" && !loading && remaining > 0 && (
              // Brand-colored notification count (Badge default = brand).
              <Badge
                className="ml-1.5"
                aria-label={t("remainingLabel", { count: remaining })}
              >
                {remaining}
              </Badge>
            )}
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
