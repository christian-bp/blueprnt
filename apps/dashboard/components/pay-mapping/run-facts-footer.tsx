"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { InnerNavHeading } from "@/components/inner-sidebar-nav"
import { useOrganization } from "@/components/org-context"
import { SidebarFooterBlock } from "@/components/sidebar-footer-block"
import { SidebarStatRow } from "@/components/sidebar-stat-row"
import { percentText } from "@/lib/percent"

// The run sidebar's bottom block: the open kartläggning's frozen key
// figures, read from the runs-list wire the sidebar's switcher already
// subscribes to (Convex dedupes the identical subscription). Deliberately
// NOT the review queue's chapter progress: that derivation is built once in
// the run shell's provider, which lives inside the content pane this
// sidebar stands outside of, and deriving it a second time here is the
// drift shape the provider exists to prevent. Frozen values never change
// while on screen, so they render as plain text. The gap row is dropped
// when the run has no measurable org-level gap; the run's own Overview
// carries the explanation.
export function RunFactsFooter() {
  const t = useTranslations("dashboard.payMapping")
  const format = useFormatter()
  const pathname = usePathname()
  const { orgId } = useOrganization()
  // /pay-mappings/<slug>[/<sub>...] -> ["pay-mappings", slug, ...]
  const [, slug] = pathname.split("/").filter(Boolean)
  const runs = useQuery(
    api.payMapping.runs.listPayMappingRuns,
    slug === undefined ? "skip" : { orgId }
  )
  const run = runs?.find((candidate) => candidate.slug === slug)
  if (run === undefined) return null
  return (
    <SidebarFooterBlock>
      <InnerNavHeading>{t("runFacts")}</InnerNavHeading>
      <SidebarStatRow
        label={t("table.population")}
        value={format.number(run.populationCount)}
      />
      {run.orgGapPct !== null && (
        <SidebarStatRow
          label={t("overview.headlineGapLabel")}
          value={percentText(run.orgGapPct, format)}
        />
      )}
    </SidebarFooterBlock>
  )
}
