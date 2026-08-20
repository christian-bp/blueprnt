"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { HeaderTabLink } from "@/components/header-tab-link"
import { NavCountBadge } from "@/components/nav-count-badge"
import { useOrganization } from "@/components/org-context"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

// Sub-pages of the People section, shown as header tabs (mirrors SectionTabs).
// The sidebar renders the same list under the People entry; both surfaces
// come from SECTION_PAGES so they cannot drift apart. Directory is the
// /people index (including person detail pages, which deepestMatch keeps
// resolved to it); Classify is the nested route where HR maps titles to roles
// and seniorities. The Classify tab carries a count badge with the people
// still waiting for a confirmed classification. The underline uses a layoutId
// distinct from the other sections' so they never cross-animate. The header
// only mounts this inside the People section.
export function PeopleTabs() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { loading, remaining } = useClassificationSummary(orgId)
  const active = deepestMatch(
    SECTION_PAGES.people.map((page) => page.href),
    pathname
  )

  return (
    <nav
      aria-label={t("nav.people")}
      className="flex h-full items-stretch gap-1"
    >
      {SECTION_PAGES.people.map((page) => (
        <HeaderTabLink
          key={page.href}
          href={page.href}
          label={t(page.labelKey)}
          active={page.href === active}
          underlineId="people-tab-underline"
          // Remaining-to-classify count on the Classify tab; hidden while
          // loading and (inside the badge) when everyone is classified.
          badge={
            page.href === "/people/classify" && !loading ? (
              <NavCountBadge
                count={remaining}
                label={t("people.tabs.remainingLabel", { count: remaining })}
              />
            ) : undefined
          }
        />
      ))}
    </nav>
  )
}
