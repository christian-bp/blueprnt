"use client"

import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { InnerNavHeading } from "@/components/inner-sidebar-nav"
import { useOrganization } from "@/components/org-context"
import { SidebarFooterBlock } from "@/components/sidebar-footer-block"
import { SidebarStatRow } from "@/components/sidebar-stat-row"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { classificationBreakdown } from "@/lib/classification-summary"

// The people sidebar's bottom block: how the workforce splits across the
// classify surface's own states (confirmed / pending / unclassified), each
// with its share bar and live count. Reads the same shared query as the
// Classify tab badge and the register's summary line, so the three surfaces
// can never disagree. Renders nothing while loading and nothing before the
// first import: a split of zero people says nothing.
export function ClassificationFooter() {
  const t = useTranslations("dashboard.classify")
  const { orgId } = useOrganization()
  const { loading, people } = useClassificationSummary(orgId)
  if (loading) return null
  const breakdown = classificationBreakdown(people)
  if (breakdown.total === 0) return null
  const rows = [
    { key: "confirmed", count: breakdown.confirmed },
    { key: "pending", count: breakdown.pending },
    { key: "unclassified", count: breakdown.unclassified },
  ] as const
  // One value-column width for the whole block, sized from its largest
  // count (never under 2ch, so a single-digit block keeps some air), so
  // rows with different digit counts hold their bars on one vertical line
  // and a live count crossing a digit boundary never nudges its bar.
  const valueWidthCh = Math.max(
    2,
    ...rows.map((row) => row.count.toString().length)
  )
  return (
    <SidebarFooterBlock>
      <InnerNavHeading>{t("statusHeading")}</InnerNavHeading>
      {rows.map((row) => (
        <SidebarStatRow
          key={row.key}
          label={t(`state.${row.key}`)}
          share={row.count / breakdown.total}
          value={<NumberFlow value={row.count} />}
          valueWidthCh={valueWidthCh}
        />
      ))}
    </SidebarFooterBlock>
  )
}
