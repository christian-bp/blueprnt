"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { AiUsageChart } from "@/components/admin/ai-usage-chart"
import { AiUsageKpis } from "@/components/admin/ai-usage-kpis"
import { AiUsageTable } from "@/components/admin/ai-usage-table"
import { PageHeading } from "@/components/page-heading"
import {
  computeOutlierOrgIds,
  computeTotals,
  periodToDate,
  recentPeriods,
} from "@/lib/admin-ai-usage"
import { onSelectValue } from "@/lib/select"

// The platform-admin AI usage overview (design doc
// docs/superpowers/plans/2026-08-13-admin-ai-usage.md): a period selector
// over the KPI strip, the ranked cost chart, and the per-org register, all
// reading one query (api.platform.aiUsage.usageByOrg) and one set of pure
// derivations (lib/admin-ai-usage.ts) so the three surfaces can never
// disagree with each other. The query itself is platform-gated server-side
// (platformQuery/requirePlatformAdmin) and the admin layout above this page
// already gates the whole section; this component renders nothing but
// skeletons before the query resolves, same as every other admin page.
export function AiUsageSection() {
  const t = useTranslations("dashboard.admin.aiUsage")
  const format = useFormatter()

  // Generated once per mount (not on every render), newest first; the
  // component is the only caller of Date.now() in this feature, so the pure
  // period math stays unit-testable with a fixed clock (lib/admin-ai-usage.ts).
  const periods = useMemo(() => recentPeriods(Date.now()), [])
  const [period, setPeriod] = useState<string>(periods[0] ?? "")

  const rows = useQuery(api.platform.aiUsage.usageByOrg, { period })

  const totals = rows === undefined ? undefined : computeTotals(rows)
  // Computed once here (not inside the chart or the table) so an outlier
  // flag can never differ between the bar it colors and the badge it puts
  // on the same org's row.
  const outliers = useMemo(
    () => (rows === undefined ? new Set<string>() : computeOutlierOrgIds(rows)),
    [rows]
  )

  const periodLabels = useMemo(
    () =>
      Object.fromEntries(
        periods.map((p) => [
          p,
          format.dateTime(periodToDate(p), {
            month: "long",
            year: "numeric",
          }),
        ])
      ),
    [periods, format]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PageHeading>{t("heading")}</PageHeading>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <Select
          items={periodLabels}
          value={period}
          onValueChange={onSelectValue(setPeriod)}
        >
          <SelectTrigger className="w-48" aria-label={t("periodLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {periodLabels[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AiUsageKpis totals={totals} />

      <AiUsageChart rows={rows} outliers={outliers} />

      <AiUsageTable
        rows={rows}
        outliers={outliers}
        totalCostNanos={totals?.costNanos ?? 0}
      />
    </div>
  )
}
