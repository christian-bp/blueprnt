"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { HeaderTabLink } from "@/components/header-tab-link"
import { NavCountBadge } from "@/components/nav-count-badge"
import { useOrganization } from "@/components/org-context"
import { useEvaluationSummary } from "@/hooks/use-evaluation-summary"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

// Section tabs for the Work section, shown in the header. The sidebar mirrors
// them as sub-pages under the Work entry while the section is open; both
// surfaces render from SECTION_PAGES so they cannot drift apart. Two
// link-tabs with a sliding underline; the active tab is resolved from the
// current path. The Roles tab carries a count badge with the roles still
// waiting for a completed evaluation (mirrors the Classify tab's badge).
// Reduced motion is honored globally via the app MotionConfig. The header only
// mounts this inside the Work section, so it always assumes one of these tabs
// is active.
export function SectionTabs() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { loading, remaining } = useEvaluationSummary(orgId)
  const active = deepestMatch(
    SECTION_PAGES.work.map((page) => page.href),
    pathname
  )

  return (
    // Reuse nav.work as the accessible name so this navigation landmark stays
    // distinct from the sidebar's.
    <nav aria-label={t("nav.work")} className="flex h-full items-stretch gap-1">
      {SECTION_PAGES.work.map((page) => (
        <HeaderTabLink
          key={page.href}
          href={page.href}
          label={t(page.labelKey)}
          active={page.href === active}
          underlineId="section-tab-underline"
          // Roles left to evaluate on the Roles tab; hidden while loading
          // and (inside the badge) when everything is evaluated.
          badge={
            page.href === "/roles" && !loading ? (
              <NavCountBadge
                count={remaining}
                label={t("nav.rolesRemainingLabel", { count: remaining })}
              />
            ) : undefined
          }
        />
      ))}
    </nav>
  )
}
