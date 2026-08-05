"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { HeaderTabLink } from "@/components/header-tab-link"
import { NavCountBadge } from "@/components/nav-count-badge"
import { useOrganization } from "@/components/org-context"
import { useClassificationSummary } from "@/hooks/use-classification-summary"

// Sub-pages of the People section, shown as header tabs (mirrors ModelTabs).
// People is the /people index (the directory, including person detail pages);
// Classify is the nested route where HR maps titles to roles and seniorities. The
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
      {TABS.map((tab) => (
        <HeaderTabLink
          key={tab.href}
          href={tab.href}
          label={t(tab.labelKey)}
          // The index tab (People, /people) is active unless the classify
          // sub-route matches, so person detail pages keep People active.
          active={
            tab.href === "/people"
              ? !pathname.startsWith("/people/classify")
              : pathname.startsWith(tab.href)
          }
          underlineId="people-tab-underline"
          // Remaining-to-classify count on the Classify tab; hidden while
          // loading and (inside the badge) when everyone is classified.
          badge={
            tab.labelKey === "classify" && !loading ? (
              <NavCountBadge
                count={remaining}
                label={t("remainingLabel", { count: remaining })}
              />
            ) : undefined
          }
        />
      ))}
    </nav>
  )
}
